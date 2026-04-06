import { BeeAuditConfig } from '../../config/loader';
import { NormalizedScanResult } from '../../models/result';

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
