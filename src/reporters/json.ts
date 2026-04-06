import fs from 'fs';
import path from 'path';
import { AuditReport } from '../models/result';

export function generateJsonReport(reportDir: string, report: AuditReport) {
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const dest = path.join(reportDir, 'details.json');
  fs.writeFileSync(dest, JSON.stringify(report, null, 2), 'utf-8');
}
