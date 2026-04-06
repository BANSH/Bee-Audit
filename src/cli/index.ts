import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import { cloneRepository } from '../core/git';
import { detectProjectSettings } from '../core/detector';
import { installDependencies, runChecks } from '../core/runner';
import { runGitleaks } from '../core/scanners/gitleaks';
import { runDependencyAudit } from '../core/scanners/audit';
import { generateJsonReport } from '../reporters/json';
import { generateMarkdownReport } from '../reporters/markdown';
import { AuditReport, AuditStatus } from '../models/result';

const program = new Command();

program
  .name('bee-audit')
  .description('Comprehensive Code Inspection System for JS/TS & Monorepos')
  .requiredOption('--repo-url <url>', 'GitHub repository URL')
  .option('--branch <branch>', 'Branch to clone', 'main')
  .option('--workdir <dir>', 'Temporary working directory', path.join(process.cwd(), '.bee-tmp'))
  .option('--skip-tests', 'Skip test phase')
  .parse(process.argv);

const options = program.opts();

async function run() {
  console.log(chalk.bold.blue('\n🐝 Starting Bee-Audit...\n'));

  let repoDir = '';
  try {
    console.log(chalk.cyan('➤ Step 1: Cloning repository...'));
    repoDir = await cloneRepository(options.repoUrl, options.branch, options.workdir);

    console.log(chalk.cyan('➤ Step 2: Detecting environment...'));
    const projectInfo = detectProjectSettings(repoDir);
    console.log(chalk.gray(`  - Package Manager: ${projectInfo.packageManager}`));
    console.log(chalk.gray(`  - Workspace: ${projectInfo.workspaceType}`));

    console.log(chalk.cyan('➤ Step 3: Installing dependencies...'));
    const installRes = installDependencies(repoDir, projectInfo.packageManager);
    if (installRes.status === 'fail') {
      console.log(chalk.yellow('⚠️ Installation failed, execution might be unstable.'));
    }

    console.log(chalk.cyan('➤ Step 4: Running code quality checks (lint, type, test)...'));
    let workspaces = runChecks(repoDir, projectInfo);
    if (options.skipTests) {
      workspaces = workspaces.map(w => ({ ...w, test: { step: 'test', status: 'skipped' } }));
    }

    console.log(chalk.cyan('➤ Step 5: Scanning for hardcoded secrets...'));
    const gitleaksRes = await runGitleaks(repoDir);

    console.log(chalk.cyan('➤ Step 6: Auditing dependencies...'));
    const auditRes = runDependencyAudit(repoDir, projectInfo.packageManager);

    console.log(chalk.cyan('\n➤ Step 7: Generating Reports...'));
    
    let status: AuditStatus = 'pass';
    const failedWorkspaces = workspaces.filter(w => w.lint.status === 'fail' || w.test.status === 'fail' || w.typeCheck.status === 'fail').length;
    
    if (gitleaksRes.status === 'fail' || auditRes.status === 'fail' || failedWorkspaces > 0) {
      status = 'fail';
    } else if (gitleaksRes.status === 'warn' || auditRes.status === 'warn') {
      status = 'warn';
    }

    const report: AuditReport = {
      summary: {
        status,
        totalWorkspaces: workspaces.length,
        failedWorkspaces,
        secretsFound: gitleaksRes.status === 'fail',
        highCriticalVulnerabilities: auditRes.details?.highCritical || 0,
      },
      workspaces,
      security: {
        secrets: gitleaksRes,
        dependencies: auditRes
      }
    };

    const outDir = path.join(process.cwd(), 'bee-audit-report');
    generateJsonReport(outDir, report);
    generateMarkdownReport(outDir, report);

    console.log(chalk.green(`\n✅ Audit complete! Reports saved to './bee-audit-report/'`));

    if (status === 'fail') {
      console.log(chalk.red.bold('\n❌ Critical failures detected. Exiting with code 1.\n'));
      process.exit(1);
    } else {
      process.exit(0);
    }

  } catch (error: any) {
    console.error(chalk.red(`\n💥 Fatal Error: ${error.message}`));
    process.exit(1);
  }
}

run();
