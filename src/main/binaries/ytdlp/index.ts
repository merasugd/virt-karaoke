// ────────── YTDLP Binary Manager ──────────

import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import { spawn, execFile } from 'child_process';
import { app, dialog } from 'electron';
import { createProgressWindow } from '../../core/utils/progress';
import { libraries } from '../../core/utils/paths';
import cookieManager from '../../core/utils/cookie';
import { ensureRuntime } from '../deno';
import { getFFmpegPath } from '../ffmpeg';

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
  cookies?: string;
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
  throw new Error(message);
}

/**
 * Get platform-specific information
 */
function getPlatformInfo(): PlatformInfo {
  const platform = process.platform;
  const arch = process.arch;

  let supported = true;
  let binaryName = 'yt-dlp';
  let downloadUrl = '';

  if (platform === 'win32') {
    binaryName = 'yt-dlp.exe';
    if (arch === 'x64' || arch === 'ia32' || arch === 'arm64') {
      supported = true;
      downloadUrl = 'yt-dlp.exe';
    } else {
      supported = false;
    }
  } else if (platform === 'darwin') {
    binaryName = 'yt-dlp';
    if (arch === 'x64' || arch === 'arm64') {
      supported = true;
      downloadUrl = 'yt-dlp_macos';
    } else {
      supported = false;
    }
  } else if (platform === 'linux') {
    binaryName = 'yt-dlp';
    if (arch === 'x64' || arch === 'arm64' || arch === 'arm' || arch === 'ia32') {
      supported = true;
      downloadUrl = 'yt-dlp';
    } else {
      supported = false;
    }
  } else {
    supported = false;
  }

  return { platform, arch, supported, binaryName, downloadUrl };
}

const platformInfo = getPlatformInfo();

if (!platformInfo.supported) {
  showErrorAndExit(
    'Unsupported Platform',
    `yt-dlp is not available for your platform.\n\n` +
    `Platform: ${platformInfo.platform}\n` +
    `Architecture: ${platformInfo.arch}\n\n` +
    `The application will now exit.`
  );
}

const YTDLP_BINARY = path.join(YTDLP_DIR, platformInfo.binaryName);
const VERSION_FILE = path.join(YTDLP_DIR, 'version.txt');
const LAST_UPDATE_CHECK_FILE = path.join(YTDLP_DIR, 'last-update-check.txt');

/**
 * Get cookies path from cookie manager
 */
function getCookiesPath(): string {
  try {
    const cookiesPath = cookieManager.getCookiesPath();

    if (!fs.existsSync(cookiesPath)) {
      console.log('[yt-dlp] No cookies file found');
      return '';
    }

    console.log(`[yt-dlp] Using cookies from ${cookiesPath}`);
    return cookiesPath;
  } catch (error) {
    console.error('[yt-dlp] Error getting cookies path:', error);
    return '';
  }
}

/**
 * Fetch latest version info from GitHub
 */
async function getLatestVersion(): Promise<{ version: string; url: string }> {
  return new Promise((resolve, reject) => {
    https.get(GITHUB_API, {
      headers: { 'User-Agent': 'yt-dlp-electron-installer' },
    }, (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        try {
          const release = JSON.parse(data);
          const version = release.tag_name;
          const url = `https://github.com/yt-dlp/yt-dlp/releases/download/${version}/${platformInfo.downloadUrl}`;
          resolve({ version, url });
        } catch (error) {
          reject(new Error('Failed to parse GitHub API response'));
        }
      });
    }).on('error', reject);
  });
}

/**
 * Download file with progress
 */
async function downloadFile(url: string, destPath: string, onProgress?: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
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
    }).on('error', reject);
  });
}

/**
 * Get installed version
 */
function getInstalledVersion(): string | null {
  try {
    if (fs.existsSync(VERSION_FILE)) {
      return fs.readFileSync(VERSION_FILE, 'utf-8').trim();
    }
  } catch {}
  return null;
}

/**
 * Check if update check is needed
 */
function shouldCheckForUpdate(): boolean {
  try {
    if (!fs.existsSync(LAST_UPDATE_CHECK_FILE)) return true;
    const lastCheck = parseInt(fs.readFileSync(LAST_UPDATE_CHECK_FILE, 'utf-8'), 10);
    return (Date.now() - lastCheck) > UPDATE_CHECK_INTERVAL;
  } catch {
    return true;
  }
}

/**
 * Install or update yt-dlp
 */
export async function installYtDlp(forceUpdate: boolean = false): Promise<string> {
  let progressController;

  try {
    if (!fs.existsSync(YTDLP_DIR)) {
      fs.mkdirSync(YTDLP_DIR, { recursive: true });
    }

    const installedVersion = getInstalledVersion();

    if (!forceUpdate && fs.existsSync(YTDLP_BINARY) && installedVersion) {
      if (shouldCheckForUpdate()) {
        try {
          const { version: latestVersion } = await getLatestVersion();
          fs.writeFileSync(LAST_UPDATE_CHECK_FILE, Date.now().toString());

          if (latestVersion !== installedVersion) {
            // Update available
          } else {
            return YTDLP_BINARY;
          }
        } catch {
          fs.writeFileSync(LAST_UPDATE_CHECK_FILE, Date.now().toString());
          return YTDLP_BINARY;
        }
      } else {
        return YTDLP_BINARY;
      }
    }

    progressController = await createProgressWindow(true, false);
    progressController.setTitle(installedVersion ? 'Updating yt-dlp' : 'Installing yt-dlp');
    progressController.setMessage('Fetching latest version...');
    progressController.setIndeterminate(true);

    const { version, url } = await getLatestVersion();

    progressController.setMessage(`Downloading yt-dlp ${version}...`);
    progressController.setIndeterminate(false);

    const tempPath = YTDLP_BINARY + '.tmp';
    await downloadFile(url, tempPath, (percent) => {
      progressController?.setProgress(percent);
    });

    if (fs.existsSync(YTDLP_BINARY)) {
      fs.unlinkSync(YTDLP_BINARY);
    }
    fs.renameSync(tempPath, YTDLP_BINARY);

    if (process.platform !== 'win32') {
      fs.chmodSync(YTDLP_BINARY, 0o755);
    }

    fs.writeFileSync(VERSION_FILE, version);
    fs.writeFileSync(LAST_UPDATE_CHECK_FILE, Date.now().toString());

    progressController.setProgress(100);
    progressController.setMessage('Installation complete!');
    await new Promise(resolve => setTimeout(resolve, 500));
    progressController.close();

    return YTDLP_BINARY;
  } catch (error) {
    if (progressController) progressController.close();
    showErrorAndExit(
      'yt-dlp Installation Failed',
      `Failed to install yt-dlp.\n\n` +
      `Error: ${error instanceof Error ? error.message : String(error)}\n\n` +
      `The application will now exit.`
    );
  }
}

/**
 * Convert options to command line arguments
 */
function optionsToArgs(options: YtDlpOptions): string[] {
  const args: string[] = [];

  for (const [key, value] of Object.entries(options)) {
    if (value === undefined || value === null) continue;

    const argName = key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);

    if (typeof value === 'boolean') {
      if (value) args.push(`--${argName}`);
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
 * Parse progress from output
 */
function parseProgress(line: string): DownloadProgress | null {
  const match = line.match(/\[download\]\s+(\d+\.?\d*)%(?:\s+of\s+([^\s]+))?(?:\s+at\s+([^\s]+))?(?:\s+ETA\s+([^\s]+))?/);
  if (match) {
    return {
      percent: parseFloat(match[1]),
      total: match[2],
      speed: match[3],
      eta: match[4],
    };
  }
  return null;
}

/**
 * Execute yt-dlp with cookies and runtime support
 */
export async function youtubedl(
  url: string,
  options: YtDlpOptions = {},
  onProgress?: ProgressCallback
): Promise<{ stdout: string; stderr: string; output?: string }> {
  // Ensure runtime and yt-dlp
  const runtime = await ensureRuntime();
  const ytdlpPath = await installYtDlp();

  // Get cookies path
  const cookiesPath = getCookiesPath();

  // Build arguments
  const args = optionsToArgs(options);

  // Add cookies if available
  if (cookiesPath && !options.cookies) {
    args.push('--cookies', cookiesPath);
  }

  // Add JS runtime explicitly
  args.push('--js-runtimes', `${runtime.name}:${runtime.path}`);

  // FFmpeg Location
  args.push('--ffmpeg-location', await getFFmpegPath());

  args.push(url);

  console.log(`[yt-dlp] Executing: ${ytdlpPath} ${args.join(' ')}`);

  return new Promise((resolve, reject) => {
    const child = spawn(ytdlpPath, args);

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;

      if (onProgress) {
        const lines = text.split('\n');
        for (const line of lines) {
          const progress = parseProgress(line);
          if (progress) onProgress(progress);
        }
      }
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, output: options.output });
      } else {
        const errorMessage = stderr || 'Unknown error occurred';
        dialog.showErrorBox(
          'Download Failed',
          `Failed to download video.\n\nURL: ${url}\n\nError: ${errorMessage.slice(0, 500)}`
        );
        reject(new Error(`yt-dlp exited with code ${code}\n${stderr}`));
      }
    });

    child.on('error', (error) => {
      dialog.showErrorBox('yt-dlp Error', `Failed to execute yt-dlp.\n\nError: ${error.message}`);
      reject(error);
    });
  });
}

/**
 * Get video info
 */
export async function getVideoInfo(url: string): Promise<any> {
  const runtime = await ensureRuntime();
  const ytdlpPath = await installYtDlp();
  const cookiesPath = getCookiesPath();

  return new Promise((resolve, reject) => {
    const args = ['--dump-json', '--no-warnings', '--js-runtimes', `${runtime.name}:${runtime.path}`];
    if (cookiesPath) args.push('--cookies', cookiesPath);
    args.push(url);

    execFile(ytdlpPath, args, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Failed to get video info: ${stderr}`));
      } else {
        try {
          resolve(JSON.parse(stdout));
        } catch {
          reject(new Error('Failed to parse video info'));
        }
      }
    });
  });
}

/**
 * Extract audio
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

export function isYtDlpInstalled(): boolean {
  return fs.existsSync(YTDLP_BINARY);
}

export function getYtDlpVersion(): string | null {
  return getInstalledVersion();
}

export async function updateYtDlp(): Promise<string> {
  return installYtDlp(true);
}

export function uninstallYtDlp(): void {
  if (fs.existsSync(YTDLP_DIR)) {
    fs.rmSync(YTDLP_DIR, { recursive: true, force: true });
  }
}

export default youtubedl;
