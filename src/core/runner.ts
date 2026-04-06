import shell from 'shelljs';
import path from 'path';
import fs from 'fs';
import { PackageManager, ProjectInfo } from './detector';
import { NormalizedScanResult, WorkspaceResult } from '../models/result';

function executeCommand(command: string, cwd: string, stepName: string): NormalizedScanResult {
  const startTime = Date.now();
  console.log(`[Runner] Executing: ${command}`);
  const result = shell.exec(command, { cwd, silent: true });
  
  if (result.code === 0) {
    return { step: stepName, category: 'static', status: 'pass', findings: [], durationMs: Date.now() - startTime };
  } else {
    // If it fails, capture output for debugging
    return { step: stepName, category: 'static', status: 'fail', error: result.stderr || result.stdout, findings: [], durationMs: Date.now() - startTime };
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

export function installDependencies(repoDir: string, pm: PackageManager): NormalizedScanResult {
  const installCmd = pm === 'npm' ? 'npm install --legacy-peer-deps' : `${pm} install`;
  return executeCommand(installCmd, repoDir, 'install');
}

export function runChecks(repoDir: string, info: ProjectInfo): WorkspaceResult[] {
  const results: WorkspaceResult[] = [];
  const rootPkgPath = path.join(repoDir, 'package.json');

  const runScript = (scriptName: string, fallbackCmd?: string): NormalizedScanResult => {
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
      return { step: scriptName, category: 'static', status: 'skipped', error: "No script found", findings: [] };
    }

    return executeCommand(cmdToRun, repoDir, scriptName);
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
