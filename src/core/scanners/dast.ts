import * as fs from 'fs';
import * as path from 'path';
import { BeeAuditConfig } from '../../config/loader';
import { NormalizedScanResult, ScanFinding } from '../../models/result';

export const runDastScan = async (config: BeeAuditConfig, targetUrl?: string): Promise<NormalizedScanResult> => {
  const startTime = Date.now();
  
  if (!config.dast.enabled || !targetUrl) {
    return {
      step: 'zap-dast',
      category: 'dast',
      status: 'skipped',
      findings: [],
      durationMs: Date.now() - startTime
    };
  }

  // Phase 3 implementation scaffolding
  // At this stage, local CLI does not force Docker OWASP ZAP execution.
  // It records that a target URL was passed, and defers execution to CI.
  return {
    step: 'zap-dast',
    category: 'dast',
    status: 'warn',
    error: 'DAST scans are currently restricted to GitHub Actions execution. Trigger the runtime-security.yml workflow instead.',
    findings: [],
    durationMs: Date.now() - startTime
  };
};

export const parseZapReport = (reportPath: string): NormalizedScanResult => {
  const startTime = Date.now();
  const absolutePath = path.resolve(reportPath);
  
  const result: NormalizedScanResult = {
    step: 'zap-dast',
    category: 'dast',
    status: 'pass',
    findings: [],
    durationMs: Date.now() - startTime
  };

  if (!fs.existsSync(absolutePath)) {
    result.status = 'skipped';
    result.error = `ZAP report not found at ${reportPath}`;
    return result;
  }

  try {
    const raw = fs.readFileSync(absolutePath, 'utf8');
    const parsed = JSON.parse(raw);
    
    // ZAP JSON Structure is typically { site: [ { alerts: [ ... ] } ] }
    let hasCriticalOrHigh = false;

    if (parsed.site && Array.isArray(parsed.site)) {
      parsed.site.forEach((s: any) => {
        if (s.alerts && Array.isArray(s.alerts)) {
          s.alerts.forEach((alert: any) => {
            const riskCode = parseInt(alert.riskcode, 10);
            let severity: ScanFinding['severity'] = 'info';
            
            if (riskCode === 1) severity = 'low';
            else if (riskCode === 2) severity = 'medium';
            else if (riskCode === 3) {
              severity = 'high';
              hasCriticalOrHigh = true;
            } else if (riskCode === 4) {
              severity = 'critical';
              hasCriticalOrHigh = true;
            }

            result.findings.push({
              severity,
              summary: alert.name || 'ZAP Alert',
              details: alert.desc,
              recommendation: alert.solution,
              evidence: alert.instances ? `${alert.instances.length} instances found` : undefined
            });
          });
        }
      });
    }

    if (hasCriticalOrHigh) {
      result.status = 'fail';
    } else if (result.findings.length > 0) {
      result.status = 'warn';
    }

  } catch (err: any) {
    result.status = 'fail';
    result.error = `Failed to parse ZAP report: ${err.message}`;
  }

  return result;
};
