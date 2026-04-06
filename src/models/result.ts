export type AuditStatus = 'pass' | 'warn' | 'fail' | 'skipped';

export interface ScanResult {
  step: string;
  status: AuditStatus;
  details?: Record<string, any>;
  error?: string;
}

export interface WorkspaceResult {
  workspace: string;
  lint: ScanResult;
  typeCheck: ScanResult;
  test: ScanResult;
}

export interface SecurityResult {
  secrets: ScanResult;
  dependencies: ScanResult;
}

export interface AuditReport {
  summary: {
    status: AuditStatus;
    totalWorkspaces: number;
    failedWorkspaces: number;
    secretsFound: boolean;
    highCriticalVulnerabilities: number;
  };
  workspaces: WorkspaceResult[];
  security: SecurityResult;
}
