import { BeeAuditConfig } from '../../config/loader';
import { NormalizedScanResult } from '../../models/result';

export const runLogicScan = async (config: BeeAuditConfig, targetUrl?: string): Promise<NormalizedScanResult> => {
  const startTime = Date.now();
  
  if (!config.dast.enabled || !targetUrl) {
    return {
      step: 'playwright-logic',
      category: 'logic',
      status: 'skipped',
      findings: [],
      durationMs: Date.now() - startTime
    };
  }

  return {
    step: 'playwright-logic',
    category: 'logic',
    status: 'warn',
    error: 'Business Logic E2E scanning deferred to GitHub Actions (logic-e2e.yml).',
    findings: [],
    durationMs: Date.now() - startTime
  };
};
