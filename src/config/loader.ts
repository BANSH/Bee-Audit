import * as fs from 'fs';
import * as path from 'path';

export interface PolicyConfig {
  failOnSecrets: boolean;
  maxHighCriticalVulnerabilities: number;
  failOnTestFailure: boolean;
  failOnLintFailure: boolean;
}

export interface MonorepoConfig {
  enabled: boolean;
  excludePatterns: string[];
}

export interface SastConfig {
  enabled: boolean;
  detectEval: boolean;
  detectUnsafeInnerHTML: boolean;
  detectConsoleEnv: boolean;
}

export interface DastConfig {
  enabled: boolean;
  targetUrl?: string; // Automatically triggers Phase 3 checks
  zapReportPath?: string;
  auth?: {
    enabled: boolean;
    loginPath: string;
  };
}

export interface LogicConfig {
  enabled: boolean;
  playwrightReportPath?: string;
}

export interface BeeAuditConfig {
  policies: PolicyConfig;
  monorepo: MonorepoConfig;
  sast: SastConfig;
  dast: DastConfig;
  logic: LogicConfig;
}

const DEFAULT_CONFIG: BeeAuditConfig = {
  policies: {
    failOnSecrets: true,
    maxHighCriticalVulnerabilities: 0,
    failOnTestFailure: true,
    failOnLintFailure: true,
  },
  monorepo: {
    enabled: true,
    excludePatterns: ['node_modules', 'dist', '.next'],
  },
  sast: {
    enabled: true,
    detectEval: true,
    detectUnsafeInnerHTML: true,
    detectConsoleEnv: true,
  },
  dast: {
    enabled: false,
    zapReportPath: './report_json.json'
  },
  logic: {
    enabled: false,
    playwrightReportPath: './playwright-report/results.json'
  }
};

export const loadConfig = (repoDir: string): BeeAuditConfig => {
  const possiblePaths = [
    'bee-audit.config.json',
    'bee-audit.config.js',
  ];

  for (const file of possiblePaths) {
    const configPath = path.join(repoDir, file);
    if (fs.existsSync(configPath)) {
      try {
        if (file.endsWith('.json')) {
          const raw = fs.readFileSync(configPath, 'utf8');
          const parsed = JSON.parse(raw);
          return mergeConfig(DEFAULT_CONFIG, parsed);
        } else {
          // Future proofing js loading securely, though dynamic require is tricky in global cli without robust eval handling.
          // For now, JSON is the deeply supported base.
          const req = require(configPath);
          return mergeConfig(DEFAULT_CONFIG, req.default || req);
        }
      } catch (err) {
        console.warn(`[Config] Failed to load config from ${file}, using defaults.`);
      }
    }
  }

  return DEFAULT_CONFIG;
};

function mergeConfig(base: BeeAuditConfig, overrides: Partial<BeeAuditConfig>): BeeAuditConfig {
  return {
    policies: { ...base.policies, ...(overrides.policies || {}) },
    monorepo: { ...base.monorepo, ...(overrides.monorepo || {}) },
    sast: { ...base.sast, ...(overrides.sast || {}) },
    dast: { ...base.dast, ...(overrides.dast || {}) },
    logic: { ...base.logic, ...(overrides.logic || {}) },
  };
}
