import shell from 'shelljs';
import path from 'path';
import fs from 'fs';
import os from 'os';
import axios from 'axios';
import { ScanResult } from '../../models/result';

const GITLEAKS_VERSION = '8.18.2';
const TOOLS_DIR = path.join(__dirname, '../../../../tools/scanners'); // Moved deeper so it's safe

async function downloadGitleaks(): Promise<string | null> {
  if (!fs.existsSync(TOOLS_DIR)) {
    shell.mkdir('-p', TOOLS_DIR);
  }

  const platform = os.platform();
  const arch = os.arch();
  
  let osName = '';
  if (platform === 'darwin') osName = 'darwin';
  else if (platform === 'linux') osName = 'linux';
  else if (platform === 'win32') osName = 'windows';
  else return null;

  let archName = '';
  if (arch === 'x64') archName = 'x64';
  else if (arch === 'arm64') archName = 'arm64';
  else return null;

  const binaryName = platform === 'win32' ? 'gitleaks.exe' : 'gitleaks';
  const binaryPath = path.join(TOOLS_DIR, binaryName);

  if (fs.existsSync(binaryPath)) {
    return binaryPath;
  }

  console.log(`[Gitleaks] Binary not found. Downloading version ${GITLEAKS_VERSION} for ${osName}-${archName}...`);
  const ext = platform === 'win32' ? 'zip' : 'tar.gz';
  const downloadUrl = `https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_${osName}_${archName}.${ext}`;
  const archivePath = path.join(TOOLS_DIR, `gitleaks.${ext}`);

  try {
    const response = await axios({ url: downloadUrl, responseType: 'stream' });
    const writer = fs.createWriteStream(archivePath);
    response.data.pipe(writer);
    
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    if (ext === 'tar.gz') {
      shell.exec(`tar -xzf "${archivePath}" -C "${TOOLS_DIR}"`, { silent: true });
    } else {
      shell.exec(`unzip -o "${archivePath}" -d "${TOOLS_DIR}"`, { silent: true });
    }

    fs.chmodSync(binaryPath, 0o755);
    fs.unlinkSync(archivePath);
    return binaryPath;
  } catch (error) {
    console.warn(`[Gitleaks] Failed to download binary:`, error);
    return null;
  }
}

export async function runGitleaks(repoDir: string): Promise<ScanResult> {
  const customBinary = await downloadGitleaks();
  let cmd = 'gitleaks';
  
  if (customBinary) {
    cmd = customBinary;
  } else {
    const checkSys = shell.exec('gitleaks version', { silent: true });
    if (checkSys.code !== 0) {
      return { 
        step: 'gitleaks', 
        status: 'warn', 
        error: 'Gitleaks missing. Auto-download failed and not found in PATH.',
        details: { findings: 0 }
      };
    }
  }

  console.log(`[Gitleaks] Scanning repository for secrets...`);
  const reportPath = path.join(repoDir, 'gitleaks-report.json');
  
  const res = shell.exec(`"${cmd}" detect --source="${repoDir}" -v --report-path="${reportPath}" --report-format=json`, { silent: true });
  
  let findingsCount = 0;
  if (fs.existsSync(reportPath)) {
    try {
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
      findingsCount = report.length || 0;
    } catch(e) {}
  }

  if (res.code === 0 && findingsCount === 0) {
    return { step: 'gitleaks', status: 'pass', details: { findings: 0 } };
  } else if (res.code === 1 || findingsCount > 0) {
    return { step: 'gitleaks', status: 'fail', error: `Found ${findingsCount} potential secrets.`, details: { findings: findingsCount } };
  } else {
    return { step: 'gitleaks', status: 'warn', error: 'Gitleaks execution failed unpredictably.', details: { code: res.code } };
  }
}
