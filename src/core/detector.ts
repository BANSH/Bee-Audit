import fs from 'fs';
import path from 'path';

export type PackageManager = 'pnpm' | 'yarn' | 'npm';
export type WorkspaceType = 'monorepo' | 'single';

export interface ProjectInfo {
  packageManager: PackageManager;
  workspaceType: WorkspaceType;
  hasTurbo: boolean;
  hasNx: boolean;
}

export function detectProjectSettings(repoDir: string): ProjectInfo {
  let packageManager: PackageManager = 'npm';
  if (fs.existsSync(path.join(repoDir, 'pnpm-lock.yaml'))) {
    packageManager = 'pnpm';
  } else if (fs.existsSync(path.join(repoDir, 'yarn.lock'))) {
    packageManager = 'yarn';
  }

  const hasTurbo = fs.existsSync(path.join(repoDir, 'turbo.json'));
  const hasNx = fs.existsSync(path.join(repoDir, 'nx.json'));
  const hasPnpmWorkspace = fs.existsSync(path.join(repoDir, 'pnpm-workspace.yaml'));
  const hasLerna = fs.existsSync(path.join(repoDir, 'lerna.json'));

  const workspaceType: WorkspaceType = (hasTurbo || hasNx || hasPnpmWorkspace || hasLerna) ? 'monorepo' : 'single';

  return {
    packageManager,
    workspaceType,
    hasTurbo,
    hasNx
  };
}
