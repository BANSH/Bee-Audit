import shell from 'shelljs';
import { PackageManager } from '../detector';
import { NormalizedScanResult, ScanFinding } from '../../models/result';

export function runDependencyAudit(repoDir: string, pm: PackageManager): NormalizedScanResult {
  const startTime = Date.now();
  console.log(`[Security] Running Dependency Audit using ${pm}...`);
  let auditCmd = '';
  
  if (pm === 'npm') {
    auditCmd = 'npm audit --json';
  } else if (pm === 'pnpm') {
    auditCmd = 'pnpm audit --json';
  } else if (pm === 'yarn') {
    auditCmd = 'yarn audit --json';
  }

  const res = shell.exec(auditCmd, { cwd: repoDir, silent: true });
  
  const findings: ScanFinding[] = [];
  let totalVulns = 0;
  
  try {
    const report = JSON.parse(res.stdout);
    
    if (pm === 'npm') {
      const vulns = report.metadata?.vulnerabilities || {};
      const high = vulns.high || 0;
      const critical = vulns.critical || 0;
      totalVulns = Object.values(vulns).reduce((a: any, b: any) => a + b, 0) as number;
      if (critical > 0) findings.push({ severity: 'critical', summary: `${critical} Critical vulnerabilities found in tree.`});
      if (high > 0) findings.push({ severity: 'high', summary: `${high} High vulnerabilities found in tree.`});
    } else {
      const str = res.stdout.toLowerCase();
      const matchHigh = str.match(/"high":\s*(\d+)/g);
      const matchCrit = str.match(/"critical":\s*(\d+)/g);
      const critical = matchCrit ? parseInt(matchCrit[0].split(':')[1].trim()) : 0;
      const high = matchHigh ? parseInt(matchHigh[0].split(':')[1].trim()) : 0;
      if (critical > 0) findings.push({ severity: 'critical', summary: `${critical} Critical vulnerabilities found in tree.`});
      if (high > 0) findings.push({ severity: 'high', summary: `${high} High vulnerabilities found in tree.`});
    }

    if (findings.length > 0) {
      return { 
        step: 'dependency-audit', 
        category: 'security',
        status: 'fail', 
        error: `Found high/critical vulnerabilities.`,
        findings,
        durationMs: Date.now() - startTime
      };
    } else {
      return { 
        step: 'dependency-audit', 
        category: 'security',
        status: 'pass',
        findings: [],
        durationMs: Date.now() - startTime
      };
    }
  } catch (e) {
    return { step: 'dependency-audit', category: 'security', status: 'warn', error: 'Failed to parse JSON audit output.', findings: [], durationMs: Date.now() - startTime };
  }
}
