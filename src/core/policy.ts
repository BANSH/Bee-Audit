import { BeeAuditConfig } from '../config/loader';
import { AuditReport, ScanStatus } from '../models/result';

export const evaluatePolicies = (report: AuditReport, config: BeeAuditConfig): ScanStatus => {
  let finalStatus: ScanStatus = 'pass';

  // Evaluate Workspaces
  for (const ws of report.workspaces) {
    if (config.policies.failOnLintFailure && ws.lint.status === 'fail') {
      finalStatus = 'fail';
    }
    if (config.policies.failOnTestFailure && ws.test.status === 'fail') {
      finalStatus = 'fail';
    }
    if (ws.typeCheck.status === 'fail') {
      finalStatus = 'fail';
    }
  }

  // Evaluate Security (Secrets & Dependencies)
  if (config.policies.failOnSecrets && report.security.secrets.status === 'fail') {
    finalStatus = 'fail';
  }

  if (report.security.dependencies.status === 'fail') {
    // Audit parser handles the high/critical count check and sets status to fail, 
    // but here we enforce logic based on config if needed.
    finalStatus = 'fail';
  }

  // SAST constraints
  if (report.security.sast.status === 'fail') {
    finalStatus = 'fail';
  }

  // DAST constraints
  if (report.security.dast.status === 'fail') {
    finalStatus = 'fail';
  }
  
  if (report.security.logic.status === 'fail') {
    finalStatus = 'fail';
  }
  
  if (report.security.semgrep.status === 'fail') {
    finalStatus = 'fail';
  }

  // Emulate Warn mapping if any steps were warnings and we aren't failing
  if (finalStatus === 'pass') {
    const hasWarn = 
      report.workspaces.some(w => w.lint.status === 'warn' || w.test.status === 'warn') ||
      report.security.secrets.status === 'warn' ||
      report.security.dependencies.status === 'warn' ||
      report.security.sast.status === 'warn' ||
      report.security.semgrep.status === 'warn' ||
      report.security.dast.status === 'warn' ||
      report.security.logic.status === 'warn';
      
    if (hasWarn) finalStatus = 'warn';
  }

  return finalStatus;
};

export const calculateScores = (report: Omit<AuditReport, 'scores' | 'summary'>): AuditReport['scores'] => {
  // Quality Score (Based on lint, types, tests)
  let quality = 100;
  const wsCount = report.workspaces.length;
  if (wsCount > 0) {
    let penalty = 0;
    report.workspaces.forEach(ws => {
      if (ws.lint.status === 'fail') penalty += 15;
      if (ws.typeCheck.status === 'fail') penalty += 15;
      if (ws.test.status === 'fail') penalty += 20;
      if (ws.lint.status === 'skipped' || ws.test.status === 'skipped') penalty += 5; // Slight penalty for absence of quality checks
    });
    quality = Math.max(0, 100 - (penalty / wsCount));
  }

  // Security Score (SAST + Secrets)
  let security = 100;
  if (report.security.secrets.status === 'fail') security -= 50;
  if (report.security.sast.status === 'fail') security -= Math.min(50, report.security.sast.findings.length * 10);
  if (report.security.semgrep.status === 'fail') security -= Math.min(50, report.security.semgrep.findings.length * 15);
  security = Math.max(0, security);

  // Dependency Score
  let dependencies = 100;
  if (report.security.dependencies.status === 'fail') dependencies -= 60;
  if (report.security.dependencies.status === 'warn') dependencies -= 20;
  dependencies = Math.max(0, dependencies);

  // Runtime Score
  let runtime = 100;
  if (report.security.dast.status === 'fail') runtime -= 50;
  if (report.security.logic.status === 'fail') runtime -= 50;
  if (report.security.dast.status === 'skipped') runtime = 0; // Not applicable
  runtime = Math.max(0, runtime);

  const applicableScores = [quality, security, dependencies];
  if (report.security.dast.status !== 'skipped') applicableScores.push(runtime);
  
  const overall = applicableScores.reduce((a, b) => a + b, 0) / applicableScores.length;

  return {
    quality: Math.round(quality),
    security: Math.round(security),
    dependencies: Math.round(dependencies),
    runtime: Math.round(runtime),
    overall: Math.round(overall)
  };
};
