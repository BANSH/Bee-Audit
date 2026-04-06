import shell from 'shelljs';
import { PackageManager } from '../detector';
import { ScanResult } from '../../models/result';

export function runDependencyAudit(repoDir: string, pm: PackageManager): ScanResult {
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
  
  let highOrCriticalCount = 0;
  let totalVulns = 0;
  
  try {
    const report = JSON.parse(res.stdout);
    
    if (pm === 'npm') {
      const vulns = report.metadata?.vulnerabilities || {};
      highOrCriticalCount = (vulns.high || 0) + (vulns.critical || 0);
      totalVulns = Object.values(vulns).reduce((a: any, b: any) => a + b, 0) as number;
    } else {
      const str = res.stdout.toLowerCase();
      const matchHigh = str.match(/"high":\s*(\d+)/g);
      const matchCrit = str.match(/"critical":\s*(\d+)/g);
      if (matchHigh) highOrCriticalCount += parseInt(matchHigh[0].split(':')[1].trim());
      if (matchCrit) highOrCriticalCount += parseInt(matchCrit[0].split(':')[1].trim());
    }

    if (highOrCriticalCount > 0) {
      return { 
        step: 'dependency-audit', 
        status: 'fail', 
        error: `Found ${highOrCriticalCount} high/critical vulnerabilities.`,
        details: { total: totalVulns, highCritical: highOrCriticalCount }
      };
    } else {
      return { 
        step: 'dependency-audit', 
        status: 'pass',
        details: { total: totalVulns, highCritical: 0 }
      };
    }
  } catch (e) {
    return { step: 'dependency-audit', status: 'warn', error: 'Failed to parse JSON audit output.' };
  }
}
