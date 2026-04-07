import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import fs from 'fs';

import { cloneRepository } from '../core/git';
import { detectProjectSettings } from '../core/detector';
import { installDependencies, runChecks } from '../core/runner';
import { runGitleaks } from '../core/scanners/gitleaks';
import { runDependencyAudit } from '../core/scanners/audit';
import { runInternalSast } from '../core/scanners/sast';
import { runSemgrepScan } from '../core/scanners/semgrep';
import { runDastScan, parseZapReport } from '../core/scanners/dast';
import { runLogicScan, parsePlaywrightReport } from '../core/scanners/logic';

import { AuditReport } from '../models/result';
import { generateMarkdownReport } from '../reporters/markdown';
import { generateJsonReport } from '../reporters/json';
import { loadConfig } from '../config/loader';
import { evaluatePolicies, calculateScores } from '../core/policy';

program
  .name('bee-audit')
  .description('Comprehensive Security & Quality Gate System for JS/TS')
  .version('2.0.0');

program
  .command('audit', { isDefault: true })
  .description('Run a full audit against a repository')
  .requiredOption('--repo-url <url>', 'GitHub repository URL')
  .requiredOption('--branch <branch>', 'Branch to audit', 'main')
  .option('--skip-tests', 'Skip test/build executions for rapid static analysis', false)
  .option('--target-url <url>', 'Runtime Target URL to enable DAST and E2E Logic (ZAP/Playwright)', '')
  .action(async (options) => {
    console.log(chalk.yellow.bold('\n🐝 Starting Bee-Audit Security Gate Phase 2/3...'));

    const repoUrl = options.repoUrl;
    const branch = options.branch;
    const skipTests = options.skipTests;
    const targetUrl = options.targetUrl;

    const spinner = ora('Checking Environment...').start();
    let repoDir = '';

    try {
      spinner.text = 'Step 1: Cloning repository...';
      const tmpBase = path.join(process.cwd(), '.bee-tmp');
      repoDir = await cloneRepository(repoUrl, branch, tmpBase);
      spinner.succeed(`Cloned repository to ${repoDir}`);

      // Load Config Engine
      spinner.text = 'Step 2: Loading Policy Configurations...';
      const config = loadConfig(repoDir);
      
      // Override DAST enable flag if target Url is passed via CLI
      if (targetUrl) {
        config.dast.enabled = true;
      }
      spinner.succeed(`Loaded Config Policies.`);

      spinner.text = 'Step 3: Detecting environment...';
      const info = detectProjectSettings(repoDir);
      spinner.succeed(`Detected: ${info.packageManager} (Workspace: ${info.workspaceType})`);

      if (!skipTests) {
        spinner.text = 'Step 3.1: Installing dependencies...';
        installDependencies(repoDir, info.packageManager);
        spinner.succeed('Installed dependencies');
      }

      spinner.text = 'Step 4: Running Code Quality Checks (Static & Hygiene)...';
      const workspaces = runChecks(repoDir, info);
      spinner.succeed('Completed static checks');

      spinner.text = 'Step 5: Code Security Layer (Secrets, Semgrep & Internal SAST)...';
      const gitleaksRes = await runGitleaks(repoDir);
      const semgrepRes = await runSemgrepScan(repoDir, config);
      const sastRes = await runInternalSast(repoDir, config);
      spinner.succeed('Completed Code Security Layer');

      spinner.text = 'Step 6: Auditing dependencies...';
      const auditRes = runDependencyAudit(repoDir, info.packageManager);
      spinner.succeed('Completed Dependency Audit');

      spinner.text = 'Step 7: Runtime & Business Logic Scaffolding...';
      const dastRes = await runDastScan(config, targetUrl);
      const logicRes = await runLogicScan(config, targetUrl);
      spinner.succeed('Evaluated Runtime Context');

      spinner.text = 'Step 8: Applying Business Policies & Generating Scores...';
      
      const draftReport: Omit<AuditReport, 'scores' | 'summary'> = {
        workspaces,
        security: {
          secrets: gitleaksRes,
          dependencies: auditRes,
          sast: sastRes,
          semgrep: semgrepRes,
          dast: dastRes,
          logic: logicRes
        },
        metadata: {
          timestamp: new Date().toISOString(),
          runtimeTarget: targetUrl || undefined
        }
      };

      const finalReport: AuditReport = {
        summary: {
           status: 'pass',
           totalWorkspaces: workspaces.length,
           failedWorkspaces: 0,
           secretsFound: gitleaksRes.status === 'fail',
           highCriticalVulnerabilities: 0
        },
        scores: calculateScores(draftReport),
        ...draftReport
      };

      // Policy Evaluation
      finalReport.summary.status = evaluatePolicies(finalReport, config);

      spinner.text = 'Saving robust reports...';
      const reportDir = path.join(process.cwd(), 'bee-audit-report');
      generateMarkdownReport(reportDir, finalReport);
      generateJsonReport(reportDir, finalReport);
      spinner.succeed(`Audit complete! Reports saved to ${reportDir}`);

      if (finalReport.summary.status === 'fail') {
        console.log(chalk.red.bold(`\n❌ Policy Gate Failed! Final Score: ${finalReport.scores.overall}/100. Exiting with code 1.\n`));
        process.exit(1);
      } else if (finalReport.summary.status === 'warn') {
        console.log(chalk.yellow.bold(`\n⚠️ Audit Passed with Warnings. Final Score: ${finalReport.scores.overall}/100.\n`));
        process.exit(0);
      } else {
        console.log(chalk.green.bold(`\n✅ Audit Passed successfully. Final Score: ${finalReport.scores.overall}/100.\n`));
        process.exit(0);
      }

    } catch (err: any) {
      spinner.fail(`Audit failed unexpectedly: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command('merge')
  .description('Merge external reports into a unified Bee-Audit report')
  .requiredOption('--base-report <path>', 'Path to bee-audit details.json')
  .option('--zap-report <path>', 'Path to OWASP ZAP json report')
  .option('--playwright-report <path>', 'Path to Playwright json report')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🐝 Orchestrating DAST & E2E Merge...\n'));
    
    try {
      const baseReportPath = path.resolve(options.baseReport);
      if (!fs.existsSync(baseReportPath)) {
        throw new Error(`Base report not found at ${baseReportPath}`);
      }

      const rawBase = fs.readFileSync(baseReportPath, 'utf8');
      const baseReport: AuditReport = JSON.parse(rawBase);

      if (options.zapReport) {
        console.log(`Parsing ZAP Report from ${options.zapReport}...`);
        const dastResult = parseZapReport(options.zapReport);
        baseReport.security.dast = dastResult;
      }

      if (options.playwrightReport) {
        console.log(`Parsing Playwright Report from ${options.playwrightReport}...`);
        const logicResult = parsePlaywrightReport(options.playwrightReport);
        baseReport.security.logic = logicResult;
      }

      // Re-evaluate policies and scores natively without requiring the source code dir
      // Note: We might be missing config if it's not saved to details.json, so we'll load default or from current dir
      const c = loadConfig(process.cwd()); 

      console.log('Re-evaluating Policies & Scores with integrated Runtime data...');
      baseReport.scores = calculateScores(baseReport);
      baseReport.summary.status = evaluatePolicies(baseReport, c);
      
      const reportDir = path.dirname(baseReportPath);
      console.log(`Regenerating finalized markdown dashboard in ${reportDir}...`);
      generateMarkdownReport(reportDir, baseReport);
      generateJsonReport(reportDir, baseReport); // Overwrite Base

      if (baseReport.summary.status === 'fail') {
        console.log(chalk.red.bold(`\n❌ Policy Gate Failed after runtime! Final Score: ${baseReport.scores.overall}/100. Exiting with code 1.\n`));
        process.exit(1);
      } else if (baseReport.summary.status === 'warn') {
        console.log(chalk.yellow.bold(`\n⚠️ Audit Passed with Warnings after runtime. Final Score: ${baseReport.scores.overall}/100.\n`));
        process.exit(0);
      } else {
        console.log(chalk.green.bold(`\n✅ Audit Passed successfully. Final Score: ${baseReport.scores.overall}/100.\n`));
        process.exit(0);
      }

    } catch (err: any) {
      console.error(chalk.red(`Merge failed: ${err.message}`));
      process.exit(1);
    }
  });

program.parse(process.argv);
