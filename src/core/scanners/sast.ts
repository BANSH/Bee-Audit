import * as fs from 'fs';
import * as path from 'path';
import { NormalizedScanResult, ScanFinding } from '../../models/result';
import { BeeAuditConfig } from '../../config/loader';

export const runInternalSast = async (repoDir: string, config: BeeAuditConfig): Promise<NormalizedScanResult> => {
  const startTime = Date.now();
  
  if (!config.sast.enabled) {
    return {
      step: 'internal-sast',
      category: 'sast',
      status: 'skipped',
      findings: [],
      durationMs: Date.now() - startTime
    };
  }

  const findings: ScanFinding[] = [];
  
  // A lightweight recursive regex-based scanner honoring exclusion rules
  const excludeDirs = new Set(config.monorepo.excludePatterns.concat(['.git', 'dist', 'build', 'tools', '.bee-tmp']));
  const targetExtensions = new Set(['.js', '.jsx', '.ts', '.tsx']);

  const scanDirectory = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!excludeDirs.has(entry.name)) {
          scanDirectory(path.join(dir, entry.name));
        }
      } else if (entry.isFile()) {
        if (targetExtensions.has(path.extname(entry.name).toLowerCase())) {
          scanFile(path.join(dir, entry.name), dir);
        }
      }
    }
  };

  const scanFile = (filePath: string, dirPath: string) => {
    const relativePath = path.relative(repoDir, filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // 1. Check for eval()
      if (config.sast.detectEval && /\beval\s*\(/.test(line)) {
        findings.push({
          severity: 'critical',
          summary: 'Use of eval() detected',
          details: 'eval() is extremely dangerous and can lead to arbitrary code execution attacks.',
          file: relativePath,
          line: index + 1,
          recommendation: 'Refactor logic to completely avoid interpreting strings as code.'
        });
      }

      // 2. Check for dangerouslySetInnerHTML
      if (config.sast.detectUnsafeInnerHTML && /dangerouslySetInnerHTML/.test(line)) {
        findings.push({
          severity: 'high',
          summary: 'dangerouslySetInnerHTML detected',
          details: 'Directly setting HTML bypassing React mitigations. Can result in XSS if input is untrusted.',
          file: relativePath,
          line: index + 1,
          recommendation: 'Ensure content is rigorously sanitized using DOMPurify before rendering.'
        });
      }

      // 3. Simple Hardcoded Credentials Check (fallback if Gitleaks missed context, e.g. JWT payload structure)
      if (/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/.test(line)) {
         findings.push({
          severity: 'high',
          summary: 'Hardcoded JWT Token detected',
          file: relativePath,
          line: index + 1,
          recommendation: 'Do not store active JWT tokens in source code.'
        });
      }
    });
  };

  try {
    scanDirectory(repoDir);
  } catch (e: any) {
    return {
      step: 'internal-sast',
      category: 'sast',
      status: 'warn',
      error: `Failed to scan files: ${e.message}`,
      findings: [],
      durationMs: Date.now() - startTime
    }
  }

  const hasHighCritical = findings.some(f => f.severity === 'high' || f.severity === 'critical');

  return {
    step: 'internal-sast',
    category: 'sast',
    status: hasHighCritical ? 'fail' : (findings.length > 0 ? 'warn' : 'pass'),
    findings,
    durationMs: Date.now() - startTime
  };
};
