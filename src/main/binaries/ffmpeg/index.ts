// ────────── FFmpeg Binary Manager ──────────

import * as path from 'path'
import * as fs from 'fs'
import * as https from 'https'
import * as http from 'http'
import { execFileSync } from 'child_process'
import { app, dialog } from 'electron'
import { createProgressWindow } from '../../core/utils/progress'
import { libraries } from '../../core/utils/paths'
import adm from 'adm-zip'
import * as tar from 'tar'
import * as sevenBin from '../7zip/index'
import seven from 'node-7z'

type UrlResolver = string | ((platform: Pick<PlatformInfo, 'name'>) => string)
type BinaryPathResolver = string | ((platform: PlatformInfo<string>) => string)

interface PlatformInfo<
  Url extends UrlResolver = UrlResolver,
  BinaryPath extends BinaryPathResolver = BinaryPathResolver
> {
  name: string
  url: Url
  binaryPath?: BinaryPath
}

const FFMPEG_DIR = path.join(libraries, 'ffmpeg')
const VERSION_FILE = path.join(FFMPEG_DIR, 'version.txt')
const LAST_UPDATE_CHECK_FILE = path.join(FFMPEG_DIR, 'last-update-check.txt')
const UPDATE_CHECK_INTERVAL = 7 * 24 * 60 * 60 * 1000
const SYSTEM_BINARY_MARKER = path.join(FFMPEG_DIR, 'system-binary.txt')

function showErrorAndExit(title: string, message: string): never {
  dialog.showErrorBox(title, message)
  app.quit();
  throw new Error(message)
}

function probeSystemBinary(): string | null {
  const candidates = process.platform === 'win32'
    ? ['ffmpeg.exe', 'ffmpeg']
    : ['ffmpeg']

  for (const name of candidates) {
    try {
      const resolved = execFileSync(
        process.platform === 'win32' ? 'where' : 'which',
        [name],
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 3000 }
      ).trim().split(/\r?\n/)[0].trim()

      if (!resolved || !fs.existsSync(resolved)) continue

      execFileSync(resolved, ['-version'], {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 5000
      })

      console.log('[ffmpeg] Found valid system binary:', resolved)
      return resolved
    } catch {
      continue
    }
  }

  return null
}

function getJohnVanSicklePlatform(name: string) {
  switch (name) {
    case 'linux-arm':
      return 'armhf'
    case 'linux-arm64':
      return 'arm64'
    case 'linux-ia32':
      return 'i686'
    case 'linux-x64':
      return 'amd64'
    default:
      throw new Error(`Unknown: ${name}`)
  }
}

const getJohnVanSickleUrl: UrlResolver = ({ name }) => {
  const platform = getJohnVanSicklePlatform(name)
  return `https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-${platform}-static.tar.xz`
}

const getJohnVanSickleBinaryPath: BinaryPathResolver = ({ url }) => {
  const segments = url.split('/')
  const tarFileName = segments[segments.length - 1]
  const tarFileNameSegments = tarFileName.split('.')
  const directory = tarFileNameSegments[0]
  return path.join(directory, 'ffmpeg')
}

const platforms: PlatformInfo[] = [
  {
    name: 'linux-arm',
    url: getJohnVanSickleUrl,
    binaryPath: getJohnVanSickleBinaryPath
  },
  {
    name: 'linux-arm64',
    url: getJohnVanSickleUrl,
    binaryPath: getJohnVanSickleBinaryPath
  },
  {
    name: 'linux-ia32',
    url: getJohnVanSickleUrl,
    binaryPath: getJohnVanSickleBinaryPath
  },
  {
    name: 'linux-x64',
    url: getJohnVanSickleUrl,
    binaryPath: getJohnVanSickleBinaryPath
  },
  {
    name: 'darwin-x64',
    url: 'https://evermeet.cx/ffmpeg/getrelease/ffmpeg/7z',
    binaryPath: 'ffmpeg'
  },
  {
    name: 'darwin-arm64',
    url: 'https://evermeet.cx/ffmpeg/getrelease/ffmpeg/7z',
    binaryPath: 'ffmpeg'
  },
  {
    name: 'win32-ia32',
    url: 'https://github.com/sudo-nautilus/FFmpeg-Builds-Win32/releases/download/latest/ffmpeg-master-latest-win32-gpl.zip',
    binaryPath: () => {
      return path.join('ffmpeg-master-latest-win32-gpl', 'bin', 'ffmpeg.exe')
    }
  },
  {
    name: 'win32-x64',
    url: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',
    binaryPath: () => {
      return path.join('ffmpeg-master-latest-win64-gpl', 'bin', 'ffmpeg.exe')
    }
  }
]

function getPlatformInfo(): PlatformInfo {
  const platformName = `${process.platform}-${process.arch}`
  const platform = platforms.find((p) => p.name === platformName)

  if (!platform) {
    showErrorAndExit(
      'Unsupported Platform',
      `FFmpeg is not available for your platform.\n\n` +
        `Platform: ${process.platform}\n` +
        `Architecture: ${process.arch}\n\n` +
        `Supported platforms:\n` +
        `• Windows (x64, x86)\n` +
        `• macOS (Intel x64, Apple Silicon arm64)\n` +
        `• Linux (x64, arm64, arm, x86)\n\n` +
        `The application will now exit.`
    )
  }

  return platform
}

function resolvePlatformInfo(platform: PlatformInfo) {
  const url =
    typeof platform.url === 'function' ? platform.url({ name: platform.name }) : platform.url

  let binaryPath: string

  if (!platform.binaryPath) {
    binaryPath = 'ffmpeg'
  } else if (typeof platform.binaryPath === 'function') {
    binaryPath = platform.binaryPath({ name: platform.name, url, binaryPath: platform.binaryPath })
  } else {
    binaryPath = platform.binaryPath
  }

  return { url, binaryPath }
}

function getVersionFromUrl(url: string): string {
  if (url.includes('/latest/')) {
    return new Date().toISOString().split('T')[0]
  }
  if (url.includes('evermeet.cx')) {
    return new Date().toISOString().split('T')[0]
  }
  const match = url.match(/ffmpeg-release-(.+)-static/)
  if (match) {
    return match[1]
  }
  return 'unknown'
}

function getInstalledVersion(): string | null {
  try {
    if (fs.existsSync(VERSION_FILE)) {
      return fs.readFileSync(VERSION_FILE, 'utf-8').trim()
    }
  } catch (error) {
  }
  return null
}

function saveInstalledVersion(version: string): void {
  try {
    fs.writeFileSync(VERSION_FILE, version)
  } catch (error) {
  }
}

function shouldCheckForUpdate(): boolean {
  try {
    if (!fs.existsSync(LAST_UPDATE_CHECK_FILE)) {
      return true
    }

    const lastCheck = parseInt(fs.readFileSync(LAST_UPDATE_CHECK_FILE, 'utf-8'), 10)
    const now = Date.now()

    return now - lastCheck > UPDATE_CHECK_INTERVAL
  } catch (error) {
    return true
  }
}

function updateLastCheckTime(): void {
  try {
    fs.writeFileSync(LAST_UPDATE_CHECK_FILE, Date.now().toString())
  } catch (error) {
  }
}

async function downloadFile(
  url: string,
  destPath: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http

    const request = protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location
        if (redirectUrl) {
          downloadFile(redirectUrl, destPath, onProgress).then(resolve).catch(reject)
          return
        }
      }

      if (response.statusCode === 404) {
        reject(new Error(`File not found (404): ${url}`))
        return
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Download failed with status ${response.statusCode}: ${url}`))
        return
      }

      const totalSize = parseInt(response.headers['content-length'] || '0', 10)
      let downloadedSize = 0

      const fileStream = fs.createWriteStream(destPath)

      response.on('data', (chunk) => {
        downloadedSize += chunk.length
        if (totalSize > 0 && onProgress) {
          const percent = (downloadedSize / totalSize) * 100
          onProgress(percent)
        }
      })

      response.pipe(fileStream)

      fileStream.on('finish', () => {
        fileStream.close()
        resolve()
      })

      fileStream.on('error', (err) => {
        fs.unlink(destPath, () => {})
        reject(err)
      })
    })

    request.on('error', (err) => {
      reject(err)
    })

    request.setTimeout(30000, () => {
      request.destroy()
      reject(new Error('Download timeout'))
    })
  })
}

async function extractArchive(
  archivePath: string,
  extractDir: string,
  onProgress?: (message: string) => void
): Promise<void> {
  const ext = path.extname(archivePath).toLowerCase()

  if (onProgress) {
    onProgress('Extracting archive...')
  }

  try {
    if (ext === '.zip') {
      const zip = new adm(archivePath)
      zip.extractAllTo(extractDir, true, true, undefined)
    } else if (ext === '.7z') {
      seven.extractFull(archivePath, extractDir, {
        $bin: sevenBin.path7za
      })
    } else if (ext === '.xz' || archivePath.endsWith('.tar.xz')) {
      await tar.x({
        file: archivePath,
        cwd: extractDir
      })
    } else {
      throw new Error(`Unsupported archive format: ${ext}`)
    }
  } catch (error) {
    throw new Error(
      `Failed to extract archive: ${error instanceof Error ? error.message : String(error)}`
    )
  }

  if (onProgress) {
    onProgress('Extraction complete')
  }
}

function findFFmpegBinary(extractDir: string, binaryPath: string): string | null {
  const searchPaths = [
    path.join(extractDir, binaryPath),
    path.join(extractDir, 'bin', binaryPath),
    path.join(extractDir, 'bin', 'ffmpeg'),
    path.join(extractDir, 'bin', 'ffmpeg.exe')
  ]

  function searchDirectory(dir: string, depth: number = 0): string | null {
    if (depth > 4) return null

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)

        if (entry.isFile()) {
          if (entry.name === 'ffmpeg' || entry.name === 'ffmpeg.exe') {
            return fullPath
          }
          if (
            entry.name.startsWith('ffmpeg') &&
            (entry.name.endsWith('.exe') || !entry.name.includes('.'))
          ) {
            return fullPath
          }
        }

        if (entry.isDirectory() && entry.name !== 'doc' && entry.name !== 'presets') {
          const found = searchDirectory(fullPath, depth + 1)
          if (found) return found
        }
      }
    } catch (err) {
    }

    return null
  }

  for (const searchPath of searchPaths) {
    if (fs.existsSync(searchPath)) {
      return searchPath
    }
  }

  return searchDirectory(extractDir)
}

async function installFFmpeg(forceUpdate: boolean = false): Promise<string> {
  if (!fs.existsSync(FFMPEG_DIR)) {
    fs.mkdirSync(FFMPEG_DIR, { recursive: true })
  }

  if (!forceUpdate) {
    const cachedSystemBin = fs.existsSync(SYSTEM_BINARY_MARKER)
      ? fs.readFileSync(SYSTEM_BINARY_MARKER, 'utf-8').trim()
      : null

    if (cachedSystemBin && fs.existsSync(cachedSystemBin)) {
      try {
        execFileSync(cachedSystemBin, ['-version'], {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 5000
        })
        console.log('[ffmpeg] Using cached system binary:', cachedSystemBin)
        return cachedSystemBin
      } catch {
        try { fs.unlinkSync(SYSTEM_BINARY_MARKER) } catch {}
      }
    }

    const systemBin = probeSystemBinary()
    if (systemBin) {
      try {
        fs.writeFileSync(SYSTEM_BINARY_MARKER, systemBin)
      } catch {}
      return systemBin
    }
  }

  const platform = getPlatformInfo()
  const { url, binaryPath } = resolvePlatformInfo(platform)

  const finalBinaryName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  const installedBinaryPath = path.join(FFMPEG_DIR, finalBinaryName)

  const installedVersion = getInstalledVersion()

  if (!forceUpdate && fs.existsSync(installedBinaryPath) && installedVersion) {
    if (shouldCheckForUpdate()) {
      const currentVersion = getVersionFromUrl(url)
      updateLastCheckTime()

      if (installedVersion === currentVersion) {
        return installedBinaryPath
      }
    } else {
      return installedBinaryPath
    }
  } else if (!forceUpdate && fs.existsSync(installedBinaryPath)) {
    return installedBinaryPath
  }

  let progressController

  try {
    progressController = await createProgressWindow(true, false);
    progressController.setTitle(installedVersion ? 'Updating FFmpeg' : 'Installing FFmpeg')
    progressController.setMessage('Preparing download...')

    if (!fs.existsSync(libraries)) {
      fs.mkdirSync(libraries, { recursive: true })
    }
    if (!fs.existsSync(FFMPEG_DIR)) {
      fs.mkdirSync(FFMPEG_DIR, { recursive: true })
    }

    const fileName = path.basename(url.split('?')[0])
    const downloadPath = path.join(FFMPEG_DIR, fileName)

    progressController.setMessage('Downloading FFmpeg...')

    try {
      await downloadFile(url, downloadPath, (percent) => {
        progressController?.setProgress(percent)
      })
    } catch (downloadError) {
      const errorMsg =
        downloadError instanceof Error ? downloadError.message : String(downloadError)

      if (progressController) {
        progressController.close()
      }

      showErrorAndExit(
        'FFmpeg Download Failed',
        `Failed to download FFmpeg binary.\n\n` +
          `URL: ${url}\n\n` +
          `Error: ${errorMsg}\n\n` +
          `Possible causes:\n` +
          `• No internet connection\n` +
          `• Download URL changed or invalid (404)\n` +
          `• Network firewall blocking download\n` +
          `• Server temporarily unavailable\n\n` +
          `Please check your connection and try again.\n\n` +
          `The application will now exit.`
      )
    }

    progressController.setIndeterminate(true)
    progressController.setMessage('Extracting archive...')

    const extractDir = path.join(FFMPEG_DIR, 'extracted')
    if (!fs.existsSync(extractDir)) {
      fs.mkdirSync(extractDir, { recursive: true })
    }

    try {
      await extractArchive(downloadPath, extractDir, (message) => {
        progressController?.setMessage(message)
      })
    } catch (extractError) {
      const errorMsg = extractError instanceof Error ? extractError.message : String(extractError)

      if (progressController) {
        progressController.close()
      }

      try {
        fs.unlinkSync(downloadPath)
      } catch {}

      showErrorAndExit(
        'FFmpeg Extraction Failed',
        `Failed to extract FFmpeg archive.\n\n` +
          `Error: ${errorMsg}\n\n` +
          `The downloaded file may be corrupted.\n\n` +
          `The application will now exit.`
      )
    }

    progressController.setMessage('Installing binary...')

    const foundBinary = findFFmpegBinary(extractDir, binaryPath)

    if (!foundBinary) {
      if (progressController) {
        progressController.close()
      }

      try {
        fs.rmSync(extractDir, { recursive: true, force: true })
        fs.unlinkSync(downloadPath)
      } catch {}

      showErrorAndExit(
        'FFmpeg Binary Not Found',
        `FFmpeg binary not found in the downloaded archive.\n\n` +
          `Expected location: ${binaryPath}\n` +
          `Archive: ${fileName}\n\n` +
          `This may indicate:\n` +
          `• Archive structure changed\n` +
          `• Corrupted download\n` +
          `• Platform mismatch\n\n` +
          `The application will now exit.`
      )
    }

    fs.copyFileSync(foundBinary, installedBinaryPath)

    if (process.platform !== 'win32') {
      fs.chmodSync(installedBinaryPath, 0o755)
    }

    const version = getVersionFromUrl(url)
    saveInstalledVersion(version)
    updateLastCheckTime()

    progressController.setMessage('Cleaning up...')
    fs.rmSync(extractDir, { recursive: true, force: true })
    fs.unlinkSync(downloadPath)

    progressController.setProgress(100)
    progressController.setMessage('Installation complete!')

    await new Promise((resolve) => setTimeout(resolve, 500))
    progressController.close()

    return installedBinaryPath
  } catch (error) {
    if (progressController) {
      progressController.close()
    }

    showErrorAndExit(
      'FFmpeg Installation Error',
      `An unexpected error occurred during FFmpeg installation.\n\n` +
        `Error: ${error instanceof Error ? error.message : String(error)}\n\n` +
        `The application will now exit.`
    )
  }
}

export async function getFFmpegPath(): Promise<string> {
  return installFFmpeg(false)
}

export async function updateFFmpeg(): Promise<string> {
  return installFFmpeg(true)
}

export function isFFmpegInstalled(): boolean {
  const finalBinaryName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  const installedBinaryPath = path.join(FFMPEG_DIR, finalBinaryName)
  return fs.existsSync(installedBinaryPath) || fs.existsSync(SYSTEM_BINARY_MARKER)
}

export function getFFmpegVersion(): string | null {
  return getInstalledVersion()
}

export function uninstallFFmpeg(): void {
  if (fs.existsSync(FFMPEG_DIR)) {
    fs.rmSync(FFMPEG_DIR, { recursive: true, force: true })
  }
}

export function shouldUpdate(): boolean {
  return shouldCheckForUpdate() || !isFFmpegInstalled()
}
