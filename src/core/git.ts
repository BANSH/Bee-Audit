import shell from 'shelljs';
import path from 'path';
import fs from 'fs';

export async function cloneRepository(repoUrl: string, branch: string, workdir: string): Promise<string> {
  const repoName = repoUrl.split('/').pop()?.replace('.git', '') || 'audit-repo';
  const targetDir = path.join(workdir, repoName);

  if (!fs.existsSync(workdir)) {
    shell.mkdir('-p', workdir);
  }

  if (fs.existsSync(targetDir)) {
    console.log(`[Git] Reusing existing repo directory: ${targetDir}`);
    // Hard reset and clean to get fresh state, then pull latest
    shell.exec('git reset --hard HEAD', { cwd: targetDir, silent: true });
    shell.exec('git clean -fd', { cwd: targetDir, silent: true });
    const pullRes = shell.exec(`git pull origin ${branch}`, { cwd: targetDir, silent: true });
    if (pullRes.code !== 0) {
      throw new Error(`Failed to pull latest from branch ${branch}`);
    }
  } else {
    console.log(`[Git] Cloning ${repoUrl} (branch: ${branch}) into ${targetDir}`);
    // Wrap targetDir in quotes in case of spaces
    const cloneRes = shell.exec(`git clone --branch ${branch} --single-branch "${repoUrl}" "${targetDir}"`, { silent: true });
    if (cloneRes.code !== 0) {
      throw new Error(`Git clone failed: ${cloneRes.stderr}`);
    }
  }

  return targetDir;
}
