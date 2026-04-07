export type ScanCategory = 'static' | 'sast' | 'dast' | 'logic' | 'security' | 'hygiene';
export type ScanSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export type ScanStatus = 'pass' | 'warn' | 'fail' | 'skipped';

export interface ScanFinding {
  severity: ScanSeverity;
  summary: string;
  details?: string;
  evidence?: string;
  recommendation?: string;
  file?: string;
  line?: number;
}

export interface NormalizedScanResult {
  step: string;
  category: ScanCategory;
  status: ScanStatus;
  findings: ScanFinding[];
  error?: string;
  durationMs?: number;
}

export interface WorkspaceResult {
  workspace: string; // e.g., "root", "apps/web"
  lint: NormalizedScanResult;
  typeCheck: NormalizedScanResult;
  test: NormalizedScanResult;
}

export interface SecurityResult {
  secrets: NormalizedScanResult;
  dependencies: NormalizedScanResult;
  sast: NormalizedScanResult; // Internal baseline SAST
  semgrep: NormalizedScanResult; // Dedicated Semgrep CE SAST
  dast: NormalizedScanResult;
  logic: NormalizedScanResult;
}

export interface Scores {
  quality: number;
  security: number;
  dependencies: number;
  runtime: number;
  overall: number;
}

export interface AuditReport {
  summary: {
    status: ScanStatus;
    totalWorkspaces: number;
    failedWorkspaces: number;
    secretsFound: boolean;
    highCriticalVulnerabilities: number;
  };
  scores: Scores;
  workspaces: WorkspaceResult[];
  security: SecurityResult;
  metadata: {
    timestamp: string;
    runtimeTarget?: string;
  };
}
