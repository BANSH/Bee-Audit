import shell from 'shelljs';
import path from 'path';
import fs from 'fs';
import { BeeAuditConfig } from '../../config/loader';
import { NormalizedScanResult, ScanFinding } from '../../models/result';

export const runSemgrepScan = async (repoDir: string, config: BeeAuditConfig): Promise<NormalizedScanResult> => {
  const startTime = Date.now();
  
  const result: NormalizedScanResult = {
    step: 'semgrep',
    category: 'sast',
    status: 'pass',
    findings: [],
    durationMs: 0
  };

  if (!config.semgrep.enabled) {
    result.status = 'skipped';
    result.error = 'Semgrep is disabled in config.';
    result.durationMs = Date.now() - startTime;
    return result;
  }

  // Check if semgrep is installed
  if (!shell.which('semgrep')) {
    result.status = 'skipped';
    result.error = 'semgrep binary not found. Please install it (e.g. `brew install semgrep` or `pip install semgrep`) and ensure it is in PATH.';
    result.durationMs = Date.now() - startTime;
    return result;
  }

  const reportPath = path.join(repoDir, '.bee-tmp-semgrep-report.json');
  const rulesets = config.semgrep.rulesets.map(r => `--config="${r}"`).join(' ');
  
  const cmd = `semgrep scan ${rulesets} --json --metrics=off --quiet --output="${reportPath}"`;
  
  console.log(`[Semgrep] Running SAST Scan...`);
  shell.exec(cmd, { cwd: repoDir, silent: true });

  if (fs.existsSync(reportPath)) {
    try {
      const raw = fs.readFileSync(reportPath, 'utf8');
      const parsed = JSON.parse(raw);
      
      let hasCriticalOrHigh = false;
      const findings: ScanFinding[] = [];

      if (parsed.results && Array.isArray(parsed.results)) {
        parsed.results.forEach((issue: any) => {
          // Semgrep usually maps extra.severity to INFO, WARNING, ERROR
          const semgrepSeverity = issue.extra?.severity?.toUpperCase();
          let mappedSeverity: ScanFinding['severity'] = 'info';

          if (semgrepSeverity === 'ERROR') {
            mappedSeverity = 'high';
            hasCriticalOrHigh = true;
          } else if (semgrepSeverity === 'WARNING') {
            mappedSeverity = 'medium';
          } else if (semgrepSeverity === 'INFO') {
            mappedSeverity = 'low';
          }

          findings.push({
            severity: mappedSeverity,
            summary: issue.check_id || 'Semgrep Issue',
            details: issue.extra?.message,
            file: issue.path,
            line: issue.start?.line,
            evidence: issue.extra?.lines
          });
        });
      }

      result.findings = findings;

      if (hasCriticalOrHigh) {
        result.status = 'fail';
      } else if (findings.length > 0) {
        result.status = 'warn';
      }

      // Cleanup
      fs.unlinkSync(reportPath);

    } catch (err: any) {
      result.status = 'fail';
      result.error = `Failed to parse Semgrep output: ${err.message}`;
    }
  } else {
    result.status = 'fail';
    result.error = 'Semgrep ran but output JSON was not generated.';
  }

  result.durationMs = Date.now() - startTime;
  return result;
};
