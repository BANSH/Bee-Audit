import * as fs from 'fs';
import * as path from 'path';
import { BeeAuditConfig } from '../../config/loader';
import { NormalizedScanResult, ScanFinding } from '../../models/result';

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

export const parsePlaywrightReport = (reportPath: string): NormalizedScanResult => {
  const startTime = Date.now();
  const absolutePath = path.resolve(reportPath);
  
  const result: NormalizedScanResult = {
    step: 'playwright-logic',
    category: 'logic',
    status: 'pass',
    findings: [],
    durationMs: Date.now() - startTime
  };

  if (!fs.existsSync(absolutePath)) {
    result.status = 'skipped';
    result.error = `Playwright report not found at ${reportPath}`;
    return result;
  }

  try {
    const raw = fs.readFileSync(absolutePath, 'utf8');
    const parsed = JSON.parse(raw);
    
    // Playwright JSON Reporter format { errors: [], suites: [ { specs: [ { tests: [{ results: [{ status }]}]}]} ] }
    let hasFailures = false;

    if (parsed.errors && parsed.errors.length > 0) {
      hasFailures = true;
      parsed.errors.forEach((err: any) => {
        result.findings.push({
          severity: 'critical',
          summary: 'Global Playwright Error',
          details: err.message || err.value,
        });
      });
    }

    if (parsed.suites && Array.isArray(parsed.suites)) {
      const processSuite = (suite: any) => {
        if (suite.specs) {
          suite.specs.forEach((spec: any) => {
            if (!spec.ok) {
              const file = spec.file;
              const line = spec.line;
              const title = spec.title;
              hasFailures = true;
              
              result.findings.push({
                severity: 'high',
                summary: `Business Logic Failure: ${title}`,
                details: `Failed spec in file ${file}:${line}`,
                file,
                line
              });
            }
          });
        }
        if (suite.suites) {
          suite.suites.forEach(processSuite);
        }
      };
      parsed.suites.forEach(processSuite);
    }

    if (hasFailures) {
      result.status = 'fail';
    }

  } catch (err: any) {
    result.status = 'fail';
    result.error = `Failed to parse Playwright report: ${err.message}`;
  }

  return result;
};
