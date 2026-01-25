// ────────── YTDLP Binary Manager ──────────

import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import { spawn, execFile } from 'child_process';
import { app, dialog } from 'electron';
import { createProgressWindow } from '../../core/utils/progress';
import { libraries } from '../../core/utils/paths';

interface YtDlpOptions {
  output?: string;
  format?: string;
  mergeOutputFormat?: string;
  noCheckCertificates?: boolean;
  noWarnings?: boolean;
  preferFreeFormats?: boolean;
  addMetadata?: boolean;
  extractAudio?: boolean;
  audioFormat?: string;
  audioQuality?: string | number;
  noPlaylist?: boolean;
  playlistStart?: number;
  playlistEnd?: number;
  maxDownloads?: number;
  quiet?: boolean;
  verbose?: boolean;
  [key: string]: any;
}

interface DownloadProgress {
  percent?: number;
  downloaded?: string;
  total?: string;
  speed?: string;
  eta?: string;
}

type ProgressCallback = (progress: DownloadProgress) => void;

interface RuntimeInfo {
  name: 'node' | 'deno' | 'bun' | 'quickjs';
  path: string;
  version: string;
}

interface PlatformInfo {
  platform: string;
  arch: string;
  supported: boolean;
  binaryName: string;
  downloadUrl: string;
}

const YTDLP_DIR = path.join(libraries, 'yt-dlp');
const GITHUB_API = 'https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest';
const UPDATE_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Show error dialog and exit app
 */
function showErrorAndExit(title: string, message: string): never {
  dialog.showErrorBox(title, message);
  app.quit();
  throw new Error(message); // TypeScript never type satisfaction
}

/**
 * Get platform-specific information with full architecture support
 */
function getPlatformInfo(): PlatformInfo {
  const platform = process.platform;
  const arch = process.arch;

  let supported = true;
  let binaryName = 'yt-dlp';
  let downloadUrl = '';

  // Windows - all architectures supported (x64, ia32, arm64)
  if (platform === 'win32') {
    binaryName = 'yt-dlp.exe';

    // yt-dlp provides universal Windows binary that works on all Windows architectures
    if (arch === 'x64' || arch === 'ia32' || arch === 'arm64') {
      supported = true;
      downloadUrl = 'yt-dlp.exe';
    } else {
      supported = false;
    }
  }
  // macOS - Intel (x64) and Apple Silicon (arm64)
  else if (platform === 'darwin') {
    binaryName = 'yt-dlp';

    if (arch === 'x64' || arch === 'arm64') {
      supported = true;
      // yt-dlp provides universal macOS binary
      downloadUrl = 'yt-dlp_macos';
    } else {
      supported = false;
    }
  }
  // Linux - multiple architectures (x64, arm64, arm, ia32)
  else if (platform === 'linux') {
    binaryName = 'yt-dlp';

    if (arch === 'x64' || arch === 'arm64' || arch === 'arm' || arch === 'ia32') {
      supported = true;
      // yt-dlp provides universal Linux binary
      downloadUrl = 'yt-dlp';
    } else {
      supported = false;
    }
  }
  // Unsupported platform (FreeBSD, OpenBSD, etc.)
  else {
    supported = false;
  }

  return {
    platform,
    arch,
    supported,
    binaryName,
    downloadUrl,
  };
}

// Initialize platform info
const platformInfo = getPlatformInfo();

// Check platform support immediately
if (!platformInfo.supported) {
  showErrorAndExit(
    'Unsupported Platform',
    `yt-dlp is not available for your platform.\n\n` +
    `Platform: ${platformInfo.platform}\n` +
    `Architecture: ${platformInfo.arch}\n\n` +
    `Supported platforms:\n` +
    `• Windows (x64, x86, ARM64)\n` +
    `• macOS (Intel, Apple Silicon)\n` +
    `• Linux (x64, ARM64, ARM, x86)\n\n` +
    `The application will now exit.`
  );
}

const YTDLP_BINARY = path.join(YTDLP_DIR, platformInfo.binaryName);
const VERSION_FILE = path.join(YTDLP_DIR, 'version.txt');
const LAST_UPDATE_CHECK_FILE = path.join(YTDLP_DIR, 'last-update-check.txt');

/**
 * Get platform-specific download URL for yt-dlp
 */
function getPlatformUrl(version: string): string {
  const baseUrl = `https://github.com/yt-dlp/yt-dlp/releases/download/${version}`;
  return `${baseUrl}/${platformInfo.downloadUrl}`;
}

/**
 * Fetch latest version info from GitHub
 */
async function getLatestVersion(): Promise<{ version: string; url: string }> {
  return new Promise((resolve, reject) => {
    https.get(GITHUB_API, {
      headers: {
        'User-Agent': 'yt-dlp-electron-installer',
      },
    }, (response) => {
      let data = '';

      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', () => {
        try {
          const release = JSON.parse(data);
          const version = release.tag_name;
          const url = getPlatformUrl(version);
          resolve({ version, url });
        } catch (error) {
          reject(new Error('Failed to parse GitHub API response'));
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Download file with progress tracking
 */
async function downloadFile(url: string, destPath: string, onProgress?: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          downloadFile(redirectUrl, destPath, onProgress).then(resolve).catch(reject);
          return;
        }
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      const totalSize = parseInt(response.headers['content-length'] || '0', 10);
      let downloadedSize = 0;

      const fileStream = fs.createWriteStream(destPath);

      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (totalSize > 0 && onProgress) {
          const percent = (downloadedSize / totalSize) * 100;
          onProgress(percent);
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
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Check if a runtime is available
 */
async function checkRuntime(name: string): Promise<RuntimeInfo | null> {
  return new Promise((resolve) => {
    execFile(name, ['--version'], (error, stdout) => {
      if (error) {
        resolve(null);
      } else {
        const version = stdout.trim().split('\n')[0];
        resolve({
          name: name as any,
          path: name,
          version,
        });
      }
    });
  });
}

/**
 * Detect available JavaScript runtime for signature decryption
 */
async function detectRuntime(): Promise<RuntimeInfo | null> {
  const runtimes = ['node', 'deno', 'bun', 'quickjs'];

  for (const runtime of runtimes) {
    const info = await checkRuntime(runtime);
    if (info) {
      return info;
    }
  }

  return null;
}

/**
 * Ensure JavaScript runtime is available, show error dialog if not
 */


function getRuntimeInstallGuide(): string {
  const platform = process.platform;

  // Common runtimes
  const runtimes = [
    { name: 'Node.js', url: 'https://nodejs.org', recommended: true },
    { name: 'Deno', url: 'https://deno.land', recommended: false },
    { name: 'Bun', url: 'https://bun.sh', recommended: false },
    { name: 'QuickJS', url: '', recommended: false }, // often via package manager
  ];

  const lines: string[] = [];

  lines.push('yt-dlp requires a JavaScript runtime for YouTube signature decryption.');
  lines.push('');
  lines.push('No supported runtime detected. Please install one of the following:');
  lines.push('');

  runtimes.forEach(runtime => {
    lines.push(`• ${runtime.name}${runtime.recommended ? ' (Recommended)' : ''}`);

    // Platform-specific instructions
    switch (platform) {
      case 'win32':
        lines.push(`  Download: ${runtime.url}`);
        break;
      case 'darwin':
        if (runtime.name === 'QuickJS') {
          lines.push('  Install via Homebrew: brew install quickjs');
        } else {
          lines.push(`  Install: ${runtime.url}`);
        }
        break;
      case 'linux':
        if (runtime.name === 'QuickJS') {
          lines.push('  Install via package manager (e.g., apt, pacman, dnf)');
        } else if (runtime.name === 'Bun') {
          lines.push(`  Install: curl -fsSL ${runtime.url}/install | bash`);
        } else if (runtime.name === 'Deno') {
          lines.push(`  Install: curl -fsSL ${runtime.url}/install.sh | sh`);
        } else {
          lines.push(`  Download: ${runtime.url}`);
        }
        break;
      default:
        lines.push(`  Visit: ${runtime.url}`);
    }
    lines.push('');
  });

  lines.push('After installing a runtime, restart the application.');
  lines.push('');
  lines.push('The application will now exit.');

  return lines.join('\n');
}

export async function ensureRuntime(): Promise<RuntimeInfo> {
  const runtime = await detectRuntime();

  if (!runtime) {
    showErrorAndExit(
      'JavaScript Runtime Required',
      getRuntimeInstallGuide());
  }

  return runtime;
}

/**
 * Get current installed version
 */
function getInstalledVersion(): string | null {
  try {
    if (fs.existsSync(VERSION_FILE)) {
      return fs.readFileSync(VERSION_FILE, 'utf-8').trim();
    }
  } catch (error) {
    // Ignore
  }
  return null;
}

/**
 * Save installed version
 */
function saveInstalledVersion(version: string): void {
  fs.writeFileSync(VERSION_FILE, version);
}

/**
 * Check if update check is needed
 */
function shouldCheckForUpdate(): boolean {
  try {
    if (!fs.existsSync(LAST_UPDATE_CHECK_FILE)) {
      return true;
    }

    const lastCheck = parseInt(fs.readFileSync(LAST_UPDATE_CHECK_FILE, 'utf-8'), 10);
    const now = Date.now();

    return (now - lastCheck) > UPDATE_CHECK_INTERVAL;
  } catch (error) {
    return true;
  }
}

/**
 * Update last check timestamp
 */
function updateLastCheckTime(): void {
  fs.writeFileSync(LAST_UPDATE_CHECK_FILE, Date.now().toString());
}

/**
 * Install or update yt-dlp
 */
export async function installYtDlp(forceUpdate: boolean = false): Promise<string> {
  let progressController;

  try {
    // Create directory
    if (!fs.existsSync(YTDLP_DIR)) {
      fs.mkdirSync(YTDLP_DIR, { recursive: true });
    }

    const installedVersion = getInstalledVersion();

    // Check if update is needed
    if (!forceUpdate && fs.existsSync(YTDLP_BINARY) && installedVersion) {
      // Check if we should check for updates
      if (shouldCheckForUpdate()) {
        try {
          const { version: latestVersion } = await getLatestVersion();
          updateLastCheckTime();

          if (latestVersion !== installedVersion) {
            // Update available, continue with installation
          } else {
            // Already up to date
            return YTDLP_BINARY;
          }
        } catch (error) {
          // Failed to check for updates, use existing version
          updateLastCheckTime();
          return YTDLP_BINARY;
        }
      } else {
        // No need to check yet
        return YTDLP_BINARY;
      }
    }

    progressController = await createProgressWindow(true);
    progressController.setTitle(installedVersion ? 'Updating yt-dlp' : 'Installing yt-dlp');
    progressController.setMessage('Fetching latest version...');
    progressController.setIndeterminate(true);

    // Get latest version
    const { version, url } = await getLatestVersion();

    progressController.setMessage(`Downloading yt-dlp ${version}...`);
    progressController.setIndeterminate(false);

    // Download
    const tempPath = YTDLP_BINARY + '.tmp';
    await downloadFile(url, tempPath, (percent) => {
      progressController?.setProgress(percent);
    });

    // Move to final location
    if (fs.existsSync(YTDLP_BINARY)) {
      fs.unlinkSync(YTDLP_BINARY);
    }
    fs.renameSync(tempPath, YTDLP_BINARY);

    // Make executable on Unix
    if (process.platform !== 'win32') {
      fs.chmodSync(YTDLP_BINARY, 0o755);
    }

    // Save version
    saveInstalledVersion(version);
    updateLastCheckTime();

    progressController.setProgress(100);
    progressController.setMessage('Installation complete!');

    await new Promise(resolve => setTimeout(resolve, 500));
    progressController.close();

    return YTDLP_BINARY;
  } catch (error) {
    if (progressController) {
      progressController.close();
    }

    // Show error dialog and exit
    showErrorAndExit(
      'yt-dlp Installation Failed',
      `Failed to install yt-dlp.\n\n` +
      `Error: ${error instanceof Error ? error.message : String(error)}\n\n` +
      `Please check your internet connection and try again.\n\n` +
      `The application will now exit.`
    );
  }
}

/**
 * Convert options object to command line arguments
 */
function optionsToArgs(options: YtDlpOptions): string[] {
  const args: string[] = [];

  for (const [key, value] of Object.entries(options)) {
    if (value === undefined || value === null) continue;

    // Convert camelCase to kebab-case
    const argName = key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);

    if (typeof value === 'boolean') {
      if (value) {
        args.push(`--${argName}`);
      }
    } else if (Array.isArray(value)) {
      value.forEach(v => {
        args.push(`--${argName}`, String(v));
      });
    } else {
      args.push(`--${argName}`, String(value));
    }
  }

  return args;
}

/**
 * Parse yt-dlp output for progress
 */
function parseProgress(line: string): DownloadProgress | null {
  // Example: [download]  45.2% of 123.45MiB at 1.23MiB/s ETA 00:30
  const match = line.match(/\[download\]\s+(\d+\.?\d*)%(?:\s+of\s+([^\s]+))?(?:\s+at\s+([^\s]+))?(?:\s+ETA\s+([^\s]+))?/);

  if (match) {
    return {
      percent: parseFloat(match[1]),
      total: match[2],
      speed: match[3],
      eta: match[4],
    };
  }

  // Check for downloaded size
  const downloadedMatch = line.match(/\[download\]\s+([^\s]+)\s+at\s+([^\s]+)/);
  if (downloadedMatch) {
    return {
      downloaded: downloadedMatch[1],
      speed: downloadedMatch[2],
    };
  }

  return null;
}

/**
 * Execute yt-dlp with given URL and options
 */
export async function youtubedl(
  url: string,
  options: YtDlpOptions = {},
  onProgress?: ProgressCallback
): Promise<{ stdout: string; stderr: string; output?: string }> {
  // Ensure JavaScript runtime is available
  await ensureRuntime();

  // Ensure yt-dlp is installed
  const ytdlpPath = await installYtDlp();

  // Build arguments
  const args = optionsToArgs(options);
  args.push(url);

  return new Promise((resolve, reject) => {
    const child = spawn(ytdlpPath, args);

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;

      // Parse progress
      if (onProgress) {
        const lines = text.split('\n');
        for (const line of lines) {
          const progress = parseProgress(line);
          if (progress) {
            onProgress(progress);
          }
        }
      }
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({
          stdout,
          stderr,
          output: options.output,
        });
      } else {
        // Show error dialog for download failures
        const errorMessage = stderr || 'Unknown error occurred';

        dialog.showErrorBox(
          'Download Failed',
          `Failed to download video.\n\n` +
          `URL: ${url}\n\n` +
          `Error: ${errorMessage.slice(0, 500)}${errorMessage.length > 500 ? '...' : ''}`
        );

        reject(new Error(`yt-dlp exited with code ${code}\n${stderr}`));
      }
    });

    child.on('error', (error) => {
      dialog.showErrorBox(
        'yt-dlp Error',
        `Failed to execute yt-dlp.\n\n` +
        `Error: ${error.message}`
      );

      reject(error);
    });
  });
}

/**
 * Check if yt-dlp is installed
 */
export function isYtDlpInstalled(): boolean {
  return fs.existsSync(YTDLP_BINARY);
}

/**
 * Get installed yt-dlp version
 */
export function getYtDlpVersion(): string | null {
  return getInstalledVersion();
}

/**
 * Force update yt-dlp to latest version
 */
export async function updateYtDlp(): Promise<string> {
  return installYtDlp(true);
}

/**
 * Uninstall yt-dlp
 */
export function uninstallYtDlp(): void {
  if (fs.existsSync(YTDLP_DIR)) {
    fs.rmSync(YTDLP_DIR, { recursive: true, force: true });
  }
}

/**
 * Get information about available JavaScript runtime
 */
export async function getRuntimeInfo(): Promise<RuntimeInfo | null> {
  return detectRuntime();
}

/**
 * Check if an update is available
 */
export async function checkForUpdate(): Promise<{ available: boolean; currentVersion: string | null; latestVersion: string } | null> {
  try {
    const currentVersion = getInstalledVersion();
    const { version: latestVersion } = await getLatestVersion();

    return {
      available: currentVersion !== latestVersion,
      currentVersion,
      latestVersion,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Get video info without downloading
 */
export async function getVideoInfo(url: string): Promise<any> {
  // Ensure runtime and yt-dlp are available
  await ensureRuntime();
  const ytdlpPath = await installYtDlp();

  return new Promise((resolve, reject) => {
    execFile(
      ytdlpPath,
      ['--dump-json', '--no-warnings', url],
      { maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          dialog.showErrorBox(
            'Failed to Get Video Info',
            `Could not retrieve video information.\n\n` +
            `URL: ${url}\n\n` +
            `Error: ${stderr || error.message}`
          );
          reject(new Error(`Failed to get video info: ${stderr}`));
        } else {
          try {
            const info = JSON.parse(stdout);
            resolve(info);
          } catch (parseError) {
            reject(new Error('Failed to parse video info'));
          }
        }
      }
    );
  });
}

/**
 * Extract audio from video
 */
export async function extractAudio(
  url: string,
  outputPath: string,
  format: string = 'mp3',
  quality: string | number = '192K',
  onProgress?: ProgressCallback
): Promise<{ stdout: string; stderr: string; output?: string }> {
  return youtubedl(url, {
    output: outputPath,
    extractAudio: true,
    audioFormat: format,
    audioQuality: quality,
    noWarnings: true,
    preferFreeFormats: true,
  }, onProgress);
}

/**
 * Get platform information (useful for debugging)
 */
export function getPlatform(): PlatformInfo {
  return platformInfo;
}

export default youtubedl;
