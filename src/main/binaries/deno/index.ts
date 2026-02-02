// ────────── Runtime (Deno, Node, Bun) Binary Manager ──────────

import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import { execFileSync } from 'child_process';
import { app, dialog } from 'electron';
import { createProgressWindow } from '../../core/utils/progress';
import { libraries } from '../../core/utils/paths';
import adm from 'adm-zip';
import * as tar from 'tar';

const RUNTIME_DIR = path.join(libraries, 'deno');
const VERSION_FILE = path.join(RUNTIME_DIR, 'version.txt');
const LAST_UPDATE_CHECK_FILE = path.join(RUNTIME_DIR, 'last-update-check.txt');
const RESOLVED_RUNTIME_FILE = path.join(RUNTIME_DIR, 'resolved-runtime.json');
const UPDATE_CHECK_INTERVAL = 3 * 24 * 60 * 60 * 1000;

const GITHUB_API_DENO = 'https://api.github.com/repos/denoland/deno/releases/latest';
const GITHUB_API_BUN = 'https://api.github.com/repos/oven-sh/bun/releases/latest';
const NODEJS_DIST_BASE = 'https://nodejs.org/dist';
const NODEJS_API = 'https://nodejs.org/api/releases.json';

type RuntimeName = 'deno' | 'bun' | 'node' | 'quickjs';

interface ResolvedRuntime {
  name: RuntimeName;
  path: string;
  source: 'system' | 'installed';
}

function showErrorAndExit(title: string, message: string): never {
  dialog.showErrorBox(title, message);
  app.quit();
  throw new Error(message);
}

function ensureRuntimeDir(): void {
  if (!fs.existsSync(RUNTIME_DIR)) {
    fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  }
}

function saveResolvedRuntime(runtime: ResolvedRuntime): void {
  try {
    fs.writeFileSync(RESOLVED_RUNTIME_FILE, JSON.stringify(runtime));
  } catch {}
}

function loadResolvedRuntime(): ResolvedRuntime | null {
  try {
    if (fs.existsSync(RESOLVED_RUNTIME_FILE)) {
      return JSON.parse(fs.readFileSync(RESOLVED_RUNTIME_FILE, 'utf-8'));
    }
  } catch {}
  return null;
}

function saveInstalledVersion(version: string): void {
  try {
    fs.writeFileSync(VERSION_FILE, version);
  } catch {}
}

function getInstalledVersion(): string | null {
  try {
    if (fs.existsSync(VERSION_FILE)) {
      return fs.readFileSync(VERSION_FILE, 'utf-8').trim();
    }
  } catch {}
  return null;
}

function shouldCheckForUpdate(): boolean {
  try {
    if (!fs.existsSync(LAST_UPDATE_CHECK_FILE)) return true;
    const lastCheck = parseInt(fs.readFileSync(LAST_UPDATE_CHECK_FILE, 'utf-8'), 10);
    return Date.now() - lastCheck > UPDATE_CHECK_INTERVAL;
  } catch {
    return true;
  }
}

function updateLastCheckTime(): void {
  try {
    fs.writeFileSync(LAST_UPDATE_CHECK_FILE, Date.now().toString());
  } catch {}
}

function validateBinary(resolvedPath: string, versionFlag: string): boolean {
  try {
    execFileSync(resolvedPath, [versionFlag], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000
    });
    return true;
  } catch {
    return false;
  }
}

function probeSystemRuntime(name: RuntimeName): string | null {
  const versionFlags: Record<RuntimeName, string> = {
    deno: '--version',
    bun: '--version',
    node: '--version',
    quickjs: '--version'
  };

  const binNames: Record<RuntimeName, string[]> = {
    deno: process.platform === 'win32' ? ['deno.exe', 'deno'] : ['deno'],
    bun: process.platform === 'win32' ? ['bun.exe', 'bun'] : ['bun'],
    node: process.platform === 'win32' ? ['node.exe', 'node'] : ['node'],
    quickjs: process.platform === 'win32' ? ['quickjs.exe', 'quickjs'] : ['quickjs']
  };

  for (const binName of binNames[name]) {
    try {
      const resolved = execFileSync(
        process.platform === 'win32' ? 'where' : 'which',
        [binName],
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 3000 }
      ).trim().split(/\r?\n/)[0].trim();

      if (!resolved || !fs.existsSync(resolved)) continue;

      if (validateBinary(resolved, versionFlags[name])) {
        console.log(`[runtime] Found system ${name}:`, resolved);
        return resolved;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function probeAllSystemRuntimes(): ResolvedRuntime | null {
  const priority: RuntimeName[] = ['deno', 'bun', 'node', 'quickjs'];

  for (const name of priority) {
    const binPath = probeSystemRuntime(name);
    if (binPath) {
      return { name, path: binPath, source: 'system' };
    }
  }

  return null;
}

async function fetchJson<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'runtime-electron-installer' } }, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data) as T);
          } catch {
            reject(new Error(`Failed to parse JSON from ${url}`));
          }
        });
      })
      .on('error', reject);
  });
}

async function downloadFile(
  url: string,
  destPath: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'runtime-electron-installer' } }, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            downloadFile(redirectUrl, destPath, onProgress).then(resolve).catch(reject);
            return;
          }
        }

        if (response.statusCode === 404) {
          reject(new Error(`Asset not found (404): ${url}`));
          return;
        }
        if (response.statusCode !== 200) {
          reject(new Error(`Download failed with status ${response.statusCode}: ${url}`));
          return;
        }

        const totalSize = parseInt(response.headers['content-length'] || '0', 10);
        let downloadedSize = 0;
        const fileStream = fs.createWriteStream(destPath);

        response.on('data', (chunk) => {
          downloadedSize += chunk.length;
          if (totalSize > 0 && onProgress) {
            onProgress((downloadedSize / totalSize) * 100);
          }
        });

        response.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          resolve();
        });
        fileStream.on('error', (err) => {
          fs.unlink(destPath, () => {});
          reject(err);
        });
      })
      .on('error', reject);
  });
}

// Deno Installer

interface DenoAsset {
  asset: string;
  binaryInArchive: string;
}

function getDenoAsset(): DenoAsset | null {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === 'win32') {
    if (arch === 'x64' || arch === 'ia32' || arch === 'arm64') {
      return { asset: 'deno-x86_64-pc-windows-msvc.zip', binaryInArchive: 'deno.exe' };
    }
  }
  if (platform === 'darwin') {
    if (arch === 'arm64') {
      return { asset: 'deno-aarch64-apple-darwin.zip', binaryInArchive: 'deno' };
    }
    return { asset: 'deno-x86_64-apple-darwin.zip', binaryInArchive: 'deno' };
  }
  if (platform === 'linux') {
    if (arch === 'arm64') {
      return { asset: 'deno-aarch64-unknown-linux-gnu.zip', binaryInArchive: 'deno' };
    }
    return { asset: 'deno-x86_64-unknown-linux-gnu.zip', binaryInArchive: 'deno' };
  }
  return null;
}

async function installDenoRuntime(progressController: any): Promise<string | null> {
  const asset = getDenoAsset();
  if (!asset) return null;

  try {
    const release = await fetchJson<{ tag_name: string }>(GITHUB_API_DENO);
    const version = release.tag_name;
    const downloadUrl = `https://github.com/denoland/deno/releases/download/${version}/${asset.asset}`;
    const zipPath = path.join(RUNTIME_DIR, asset.asset);
    const binaryName = process.platform === 'win32' ? 'deno.exe' : 'deno';
    const finalPath = path.join(RUNTIME_DIR, binaryName);

    progressController.setMessage(`Downloading Deno ${version}…`);
    progressController.setIndeterminate(false);

    await downloadFile(downloadUrl, zipPath, (percent) => {
      progressController?.setProgress(percent);
    });

    progressController.setIndeterminate(true);
    progressController.setMessage('Extracting Deno…');

    const zip = new adm(zipPath);
    zip.extractAllTo(RUNTIME_DIR, true, true, undefined);

    try { fs.unlinkSync(zipPath); } catch {}

    if (!fs.existsSync(finalPath)) return null;

    if (process.platform !== 'win32') {
      fs.chmodSync(finalPath, 0o755);
    }

    saveInstalledVersion(version);
    return finalPath;
  } catch (err) {
    console.warn('[runtime] Deno install failed:', err);
    return null;
  }
}

// Bun Installer

function getBunAsset(): { asset: string; binaryInArchive: string } | null {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === 'win32') {
    if (arch === 'x64' || arch === 'ia32') {
      return { asset: 'bun-windows-x64.zip', binaryInArchive: 'bun.exe' };
    }
    if (arch === 'arm64') {
      return { asset: 'bun-windows-arm64.zip', binaryInArchive: 'bun.exe' };
    }
  }
  if (platform === 'darwin') {
    if (arch === 'arm64') {
      return { asset: 'bun-darwin-arm64.zip', binaryInArchive: 'bun' };
    }
    return { asset: 'bun-darwin-x64.zip', binaryInArchive: 'bun' };
  }
  if (platform === 'linux') {
    if (arch === 'arm64') {
      return { asset: 'bun-linux-arm64.zip', binaryInArchive: 'bun' };
    }
    return { asset: 'bun-linux-x64.zip', binaryInArchive: 'bun' };
  }
  return null;
}

async function installBunRuntime(progressController: any): Promise<string | null> {
  const asset = getBunAsset();
  if (!asset) return null;

  try {
    const release = await fetchJson<{ tag_name: string }>(GITHUB_API_BUN);
    const version = release.tag_name;
    const downloadUrl = `https://github.com/oven-sh/bun/releases/download/${version}/${asset.asset}`;
    const zipPath = path.join(RUNTIME_DIR, asset.asset);
    const binaryName = process.platform === 'win32' ? 'bun.exe' : 'bun';
    const finalPath = path.join(RUNTIME_DIR, binaryName);

    progressController.setMessage(`Downloading Bun ${version}…`);
    progressController.setIndeterminate(false);

    await downloadFile(downloadUrl, zipPath, (percent) => {
      progressController?.setProgress(percent);
    });

    progressController.setIndeterminate(true);
    progressController.setMessage('Extracting Bun…');

    const zip = new adm(zipPath);
    zip.extractAllTo(RUNTIME_DIR, true, true, undefined);

    try { fs.unlinkSync(zipPath); } catch {}

    if (!fs.existsSync(finalPath)) return null;

    if (process.platform !== 'win32') {
      fs.chmodSync(finalPath, 0o755);
    }

    saveInstalledVersion(version);
    return finalPath;
  } catch (err) {
    console.warn('[runtime] Bun install failed:', err);
    return null;
  }
}

// Node Installer

function getNodeTarget(): { platform: string; arch: string; ext: string } | null {
  const platform = process.platform;
  const arch = process.arch;

  const archMap: Record<string, string> = {
    x64: 'x64',
    ia32: 'x86',
    arm64: 'arm64',
    arm: 'armv7l'
  };

  const nodePlatform = platform === 'win32' ? 'win' : platform === 'darwin' ? 'darwin' : 'linux';
  const nodeArch = archMap[arch];

  if (!nodeArch) return null;

  return {
    platform: nodePlatform,
    arch: nodeArch,
    ext: platform === 'win32' ? 'zip' : 'tar.gz'
  };
}

async function installNodeRuntime(progressController: any): Promise<string | null> {
  const target = getNodeTarget();
  if (!target) return null;

  try {
    const releases = await fetchJson<Array<{ version: string; lts: string | false }>>(NODEJS_API);

    const ltsRelease = releases.find(r => r.lts !== false);
    if (!ltsRelease) return null;

    const version = ltsRelease.version;
    const archiveName = `node-${version}-${target.platform}-${target.arch}.${target.ext}`;
    const downloadUrl = `${NODEJS_DIST_BASE}/${version}/${archiveName}`;
    const archivePath = path.join(RUNTIME_DIR, archiveName);
    const extractDir = path.join(RUNTIME_DIR, '_node_extract');
    const binaryName = process.platform === 'win32' ? 'node.exe' : 'node';
    const finalPath = path.join(RUNTIME_DIR, binaryName);

    progressController.setMessage(`Downloading Node.js ${version}…`);
    progressController.setIndeterminate(false);

    await downloadFile(downloadUrl, archivePath, (percent) => {
      progressController?.setProgress(percent);
    });

    progressController.setIndeterminate(true);
    progressController.setMessage('Extracting Node.js…');

    if (!fs.existsSync(extractDir)) {
      fs.mkdirSync(extractDir, { recursive: true });
    }

    if (target.ext === 'zip') {
      const zip = new adm(archivePath);
      zip.extractAllTo(extractDir, true, true, undefined);
    } else {
      await tar.x({ file: archivePath, cwd: extractDir });
    }

    try { fs.unlinkSync(archivePath); } catch {}

    const extractedRoot = path.join(extractDir, `node-${version}-${target.platform}-${target.arch}`);
    const sourceBin = process.platform === 'win32'
      ? path.join(extractedRoot, 'node.exe')
      : path.join(extractedRoot, 'bin', 'node');

    if (!fs.existsSync(sourceBin)) {
      try { fs.rmSync(extractDir, { recursive: true, force: true }); } catch {}
      return null;
    }

    fs.copyFileSync(sourceBin, finalPath);

    if (process.platform !== 'win32') {
      fs.chmodSync(finalPath, 0o755);
    }

    try { fs.rmSync(extractDir, { recursive: true, force: true }); } catch {}

    saveInstalledVersion(version);
    return finalPath;
  } catch (err) {
    console.warn('[runtime] Node install failed:', err);
    return null;
  }
}

// Orchestrator

async function resolveRuntime(forceUpdate: boolean = false): Promise<string> {
  ensureRuntimeDir();

  if (!forceUpdate) {
    const cached = loadResolvedRuntime();
    if (cached && fs.existsSync(cached.path)) {
      const versionFlag = cached.name === 'quickjs' ? '--version' : '--version';
      if (validateBinary(cached.path, versionFlag)) {
        console.log(`[runtime] Using cached resolved runtime: ${cached.name} @ ${cached.path}`);
        return cached.path;
      }
      console.warn('[runtime] Cached runtime no longer valid, re-resolving…');
    }
  }

  const systemRuntime = probeAllSystemRuntimes();
  if (systemRuntime) {
    saveResolvedRuntime(systemRuntime);
    console.log(`[runtime] Resolved to system ${systemRuntime.name}: ${systemRuntime.path}`);
    return systemRuntime.path;
  }

  console.log('[runtime] No system JS runtime found — attempting installs…');

  let progressController;
  try {
    progressController = await createProgressWindow(true, false);
    progressController.setTitle('Installing JS Runtime');
    progressController.setMessage('Preparing…');
    progressController.setIndeterminate(true);

    const installers: Array<{ name: RuntimeName; install: () => Promise<string | null> }> = [
      { name: 'deno', install: () => installDenoRuntime(progressController) },
      { name: 'bun', install: () => installBunRuntime(progressController) },
      { name: 'node', install: () => installNodeRuntime(progressController) }
    ];

    for (const { name, install } of installers) {
      console.log(`[runtime] Trying to install ${name}…`);
      progressController.setTitle(`Installing ${name.charAt(0).toUpperCase() + name.slice(1)}`);
      progressController.setIndeterminate(true);

      const result = await install();
      if (result) {
        const resolved: ResolvedRuntime = { name, path: result, source: 'installed' };
        saveResolvedRuntime(resolved);
        updateLastCheckTime();

        progressController.setProgress(100);
        progressController.setMessage(`${name.charAt(0).toUpperCase() + name.slice(1)} installed successfully!`);
        await new Promise((resolve) => setTimeout(resolve, 500));
        progressController.close();

        console.log(`[runtime] Successfully installed ${name}: ${result}`);
        return result;
      }

      console.warn(`[runtime] ${name} install failed, trying next…`);
    }

    if (progressController) progressController.close();

    showErrorAndExit(
      'No JS Runtime Available',
      `Failed to install any JavaScript runtime.\n\n` +
        `Attempted: Deno, Bun, Node.js\n\n` +
        `All installers failed. This may indicate:\n` +
        `• No internet connection\n` +
        `• Platform not supported by any runtime\n` +
        `• Network firewall blocking downloads\n\n` +
        `You can also manually install any of the following\n` +
        `and add it to your system PATH:\n` +
        `• Deno (https://deno.com)\n` +
        `• Bun (https://bun.sh)\n` +
        `• Node.js (https://nodejs.org)\n\n` +
        `The application will now exit.`
    );
  } catch (error) {
    if (progressController) progressController.close();
    showErrorAndExit(
      'Runtime Installation Error',
      `An unexpected error occurred during JS runtime installation.\n\n` +
        `Error: ${error instanceof Error ? error.message : String(error)}\n\n` +
        `The application will now exit.`
    );
  }
}

export async function installDeno(forceUpdate: boolean = false): Promise<string> {
  return resolveRuntime(forceUpdate);
}

export async function getDenoPath_(): Promise<string> {
  return resolveRuntime(false);
}

export const getDenoBinaryPath = getDenoPath_;

export async function updateDeno(): Promise<string> {
  return resolveRuntime(true);
}

export function isDenoInstalled(): boolean {
  const cached = loadResolvedRuntime();
  if (cached && fs.existsSync(cached.path)) return true;

  const binaryNames = process.platform === 'win32'
    ? ['deno.exe', 'bun.exe', 'node.exe']
    : ['deno', 'bun', 'node'];

  for (const name of binaryNames) {
    if (fs.existsSync(path.join(RUNTIME_DIR, name))) return true;
  }
  return false;
}

export function getDenoVersion(): string | null {
  return getInstalledVersion();
}

export function uninstallDeno(): void {
  if (fs.existsSync(RUNTIME_DIR)) {
    fs.rmSync(RUNTIME_DIR, { recursive: true, force: true });
  }
}

export function shouldUpdate(): boolean {
  return shouldCheckForUpdate() || !isDenoInstalled();
}

export function getResolvedRuntime(): ResolvedRuntime | null {
  return loadResolvedRuntime();
}

export interface RuntimeInfo {
  name: 'node' | 'deno' | 'bun' | 'quickjs';
  path: string;
  version: string;
}

export async function ensureRuntime(): Promise<RuntimeInfo> {
  const runtimePath = await resolveRuntime(false);
  const resolved = loadResolvedRuntime();

  if (!resolved) {
    throw new Error('Failed to resolve runtime information');
  }

  // Extract version from the runtime binary
  let version = 'unknown';
  try {
    const versionOutput = execFileSync(runtimePath, ['--version'], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000
    }).trim();

    // Parse version based on runtime type
    if (resolved.name === 'deno') {
      // Deno outputs: "deno 1.x.x (release, x86_64-unknown-linux-gnu)"
      const match = versionOutput.match(/deno (\d+\.\d+\.\d+)/);
      version = match ? match[1] : versionOutput.split('\n')[0];
    } else if (resolved.name === 'bun') {
      // Bun outputs: "1.x.x"
      version = versionOutput.split('\n')[0];
    } else if (resolved.name === 'node') {
      // Node outputs: "v18.x.x"
      version = versionOutput.replace(/^v/, '');
    } else if (resolved.name === 'quickjs') {
      // QuickJS version format may vary
      version = versionOutput.split('\n')[0];
    }
  } catch (err) {
    console.warn('[runtime] Failed to extract version:', err);
  }

  return {
    name: resolved.name,
    path: runtimePath,
    version
  };
}
