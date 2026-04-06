import shell from 'shelljs';
import path from 'path';
import fs from 'fs';
import { PackageManager, ProjectInfo } from './detector';
import { AuditStatus, ScanResult, WorkspaceResult } from '../models/result';

function executeCommand(command: string, cwd: string): ScanResult {
  console.log(`[Runner] Executing: ${command}`);
  const result = shell.exec(command, { cwd, silent: true });
  
  if (result.code === 0) {
    return { step: command, status: 'pass' };
  } else {
    // If it fails, capture output for debugging
    return { step: command, status: 'fail', error: result.stderr || result.stdout };
  }
}

function hasScript(packageJsonPath: string, scriptName: string): boolean {
  if (!fs.existsSync(packageJsonPath)) return false;
  try {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    return !!(pkg.scripts && pkg.scripts[scriptName]);
  } catch (e) {
    return false;
  }
}

export function installDependencies(repoDir: string, pm: PackageManager): ScanResult {
  const installCmd = pm === 'npm' ? 'npm install --legacy-peer-deps' : `${pm} install`;
  return executeCommand(installCmd, repoDir);
}

export function runChecks(repoDir: string, info: ProjectInfo): WorkspaceResult[] {
  const results: WorkspaceResult[] = [];
  const rootPkgPath = path.join(repoDir, 'package.json');

  const runScript = (scriptName: string, fallbackCmd?: string): ScanResult => {
    let cmdToRun = '';
    
    if (info.hasTurbo) {
      cmdToRun = `npx turbo run ${scriptName} --continue`;
    } else if (hasScript(rootPkgPath, scriptName)) {
      cmdToRun = `${info.packageManager} run ${scriptName}`;
    } else if (fallbackCmd && scriptName === 'type-check') {
      const tsconfigExists = fs.existsSync(path.join(repoDir, 'tsconfig.json'));
      if (tsconfigExists) cmdToRun = fallbackCmd;
    }

    if (!cmdToRun) {
      return { step: scriptName, status: 'skipped', details: { reason: "No script found" } };
    }

    return executeCommand(cmdToRun, repoDir);
  };

  const lintRes = runScript('lint');
  const typeRes = runScript('type-check', 'npx tsc --noEmit');
  const testRes = runScript('test');

  results.push({
    workspace: info.workspaceType === 'monorepo' ? 'monorepo-global' : 'root',
    lint: lintRes,
    typeCheck: typeRes,
    test: testRes
  });

  return results;
}
