// ────────── All Helpers ──────────

import { BrowserWindow, dialog } from "electron";
import path from "path";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import chokidar from "chokidar";

import { db, initializeDatabase } from "./db";
import { appState } from "../events/app_state";
import { broadcastState } from "./state";
import { createProgressWindow } from "./progress";
import { settings } from "../../settings";
import { additional_songs, main_path } from "./paths";
import { HorizontalAlign, Jimp, JimpInstance, VerticalAlign } from "jimp";
import QRCode from 'qrcode';

// Song code to id resolution
export function resolveSongIdFromCode(code: string): string | null {
  if (!code) return null;

  console.log("[db:lookup] Resolving code:", code);

  if (db.has(code)) {
    console.log("[db:lookup] Found exact match:", code);
    return code;
  }

  const trimmed = code.replace(/^0+/, "");
  if (trimmed && db.has(trimmed)) {
    console.log("[db:lookup] Found trimmed match:", trimmed);
    return trimmed;
  }

  const numeric = String(Number(trimmed || code));
  if (numeric && db.has(numeric)) {
    console.log("[db:lookup] Found numeric match:", numeric);
    return numeric;
  }

  console.warn("[db:lookup] No match found for code:", code);
  return null;
}

// Get IPv4 addresses
export function getIPv4(interfaceName?: string): string | null {
  const os = require('os');
  const interfaces = os.networkInterfaces();

  if (interfaceName && interfaces[interfaceName]) {
    for (const iface of interfaces[interfaceName]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }

  // Fallback: find any IPv4 address
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }

  return null;
}

// Apply Window Settings
export function applyWindowSettings(win: BrowserWindow) {
  console.log(
    "[window] Applying settings → mode:",
    appState.viewMode,
    "size:",
    appState.windowSize
  );

  if (appState.viewMode === "fullscreen") {
    win.setFullScreen(true);
  } else {
    win.setFullScreen(false);
    win.setBounds({
      width: appState.windowSize.width,
      height: appState.windowSize.height,
    });
    win.setResizable(appState.viewMode === "windowed");
    win.setMenuBarVisibility(appState.viewMode === "windowed");
  }
}

// Prepare all assets for the server
export async function prepareAssets() {
  console.log("[assets] Preparing assets (cached)");

  const assetsDir = path.join(main_path, "assets");
  fs.mkdirSync(assetsDir, { recursive: true });

  const cache = loadCache();
  const progress = await createProgressWindow(true);

  try {
    progress.setTitle("Preparing Assets");
    progress.setProgress(0);

    // Idle Image Mode
    if (appState.idleMode === "image") {
      // Check if background image file exists
      if (appState.idleBackgroundPath && !fs.existsSync(appState.idleBackgroundPath)) {
        console.warn("[assets] Background image file not found:", appState.idleBackgroundPath);
        await appState.setIdleBackgroundPath("");
        settings.set("backgroundPath", "");

        await dialog.showMessageBox({
          type: "warning",
          title: "Missing Background Image",
          message: "The background image file no longer exists.",
          detail: "It has been removed from your settings.",
          buttons: ["OK"],
        });
      }

      const hash = hashFiles([appState.idleBackgroundPath]);

      if (cache.backgroundHash !== hash) {
        console.log("[assets] Regenerating background image");

        progress.setMessage("Processing background image...");
        progress.setIndeterminate(true);

        const bgPath = path.join(assetsDir, "background.png");
        let image: JimpInstance;

        if (appState.idleBackgroundPath) {
          image = await Jimp.read(appState.idleBackgroundPath) as JimpInstance;
        } else {
          image = new Jimp({ width: 1920, height: 1080, color: 0x000000ff });
        }

        image.cover({
          w: 1920,
          h: 1080,
          align: HorizontalAlign.CENTER | VerticalAlign.MIDDLE
        });

        await image.write(bgPath as any);

        cache.backgroundHash = hash;
        progress.setIndeterminate(false);
        progress.setProgress(33);
      } else {
        console.log("[assets] Background image cached");
        progress.setMessage("Background image cached ✓");
        progress.setProgress(33);
      }
    } else {
      progress.setProgress(33);
    }

    // Idle Video Mode
    if (appState.idleMode === "video") {
      // Filter out missing video files
      const validVideoFiles = appState.idleVideoFiles.filter((f) => {
        const exists = fs.existsSync(f);
        if (!exists) {
          console.warn("[assets] Video file not found:", f);
        }
        return exists;
      });

      // Warn if any files were removed
      const removedCount = appState.idleVideoFiles.length - validVideoFiles.length;
      if (removedCount > 0) {
        await appState.setIdleVideoFiles(validVideoFiles);
        settings.set("idleVideoFiles", validVideoFiles);

        await dialog.showMessageBox({
          type: "warning",
          title: "Missing Video Files",
          message: `${removedCount} video file(s) no longer exist.`,
          detail: "The missing files have been removed from your settings. Remaining files will be used.",
          buttons: ["OK"],
        });
      }

      const idleVideoFiles: string[] = [...validVideoFiles];
      const hash = hashFiles(idleVideoFiles);
      const output = path.join(assetsDir, "background.mp4");

      if (idleVideoFiles.length === 0) {
        console.log("[assets] No valid video files to encode");
        progress.setMessage("No video files available");
        progress.setProgress(66);
      } else if (cache.videoHash !== hash) {
        console.log("[assets] Regenerating idle video");

        progress.setTitle("Processing Video");
        progress.setMessage(`Encoding ${idleVideoFiles.length} video file(s)...`);

        await new Promise<void>((resolve, reject) => {
          const cmd = ffmpeg();

          idleVideoFiles.forEach((f) => cmd.input(f));

          cmd
            .videoCodec("libx264")
            .audioCodec("aac")
            .on("progress", (p) => {
              const percent = Math.min(100, Math.round(p.percent || 0));
              progress.setProgress(33 + Math.round(percent * 0.33));
              progress.setMessage(`Encoding video: ${percent}%`);
            })
            .on("end", () => {
              cache.videoHash = hash;
              progress.setMessage("Video encoded ✓");
              resolve();
            })
            .on("error", reject)
            .save(output);
        });

        progress.setProgress(66);
      } else {
        console.log("[assets] Idle video cached");
        progress.setMessage("Idle video cached ✓");
        progress.setProgress(66);
      }
    } else {
      progress.setProgress(66);
    }

    // Looping music
    if (appState.loopingMusicEnabled) {
      // Filter out missing music files
      const validMusicFiles = appState.loopingMusicFiles.filter((f) => {
        const exists = fs.existsSync(f);
        if (!exists) {
          console.warn("[assets] Music file not found:", f);
        }
        return exists;
      });

      // Warn if any files were removed
      const removedCount = appState.loopingMusicFiles.length - validMusicFiles.length;
      if (removedCount > 0) {
        await appState.setLoopingMusicFiles(validMusicFiles);
        settings.set("musicFiles", validMusicFiles);

        await dialog.showMessageBox({
          type: "warning",
          title: "Missing Music Files",
          message: `${removedCount} audio file(s) no longer exist.`,
          detail: "The missing files have been removed from your settings. Remaining files will be used.",
          buttons: ["OK"],
        });
      }

      const loopingMusicFiles: string[] = [...validMusicFiles];
      const hash = hashFiles(loopingMusicFiles);
      const output = path.join(assetsDir, "looping.mp3");

      if (loopingMusicFiles.length === 0) {
        console.log("[assets] No valid music files to encode");
        progress.setMessage("No music files available");
        progress.setProgress(100);
      } else if (cache.musicHash !== hash) {
        console.log("[assets] Regenerating looping music");

        progress.setTitle("Processing Audio");
        progress.setMessage(`Encoding ${loopingMusicFiles.length} audio file(s)...`);

        await new Promise<void>((resolve, reject) => {
          const cmd = ffmpeg();
          loopingMusicFiles.forEach((f) => cmd.input(f));

          cmd
            .audioCodec("libmp3lame")
            .on("progress", (p) => {
              const percent = Math.min(100, Math.round(p.percent || 0));
              progress.setProgress(66 + Math.round(percent * 0.34));
              progress.setMessage(`Encoding audio: ${percent}%`);
            })
            .on("end", () => {
              cache.musicHash = hash;
              progress.setMessage("Audio encoded ✓");
              resolve();
            })
            .on("error", reject)
            .save(output);
        });

        progress.setProgress(100);
      } else {
        console.log("[assets] Looping music cached");
        progress.setMessage("Looping music cached ✓");
        progress.setProgress(100);
      }
    } else {
      progress.setProgress(100);
    }

    saveCache(cache);

    // Brief completion message before closing
    progress.setTitle("Complete");
    progress.setMessage("All assets ready!");
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log("[assets] Asset preparation complete");
  } finally {
    progress.close();
  }
}

// Play next song from queue
let isAdvancingQueue = false;

export async function playNextInQueuePromise(): Promise<void> {
  if (isAdvancingQueue) {
    console.warn('[queue] Advance already in progress, ignoring');
    return;
  }

  isAdvancingQueue = true;

  try {
    const nextCode = await appState.shiftNextCode();

    if (!nextCode) {
      await appState.enterIdle();
      broadcastState();
      return;
    }

    const song = db.get(nextCode);
    if (!song) {
      console.warn(`[queue] Song not found: ${nextCode}`);
      return await playNextInQueuePromise();
    }

    await appState.enterKaraoke(nextCode, song);
    broadcastState();

  } finally {
    isAdvancingQueue = false;
  }
}

// Watch the search paths for new addition
export function watchSongs() {
  const pathsToWatch: string[] = [];

  if (appState.searchPath) pathsToWatch.push(appState.searchPath);
  if (additional_songs) pathsToWatch.push(additional_songs);

  if (pathsToWatch.length === 0) {
    console.warn("[watcher] No search paths configured — song watching disabled");
    return;
  }

  console.log("[watcher] Starting file watcher on:", pathsToWatch.join(", "));

  // Watch all paths at once
  const watcher = chokidar.watch(pathsToWatch, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    ignoreInitial: true, // skip files already present at startup
  });

  watcher.on("all", (event, filePath) => {
    // Only react to .mp4 files
    if (!filePath.endsWith(".mp4")) return;
    if (filePath.endsWith('.f136.mp4') || filePath.endsWith('.temp.mp4')) return;

    // Skip if the file is already in the database
    if (db.list().some(v => v.path === filePath)) return;

    console.log(`[watcher] .mp4 file event: ${event} → ${filePath}`);

    // Initialize database with all watch paths
    initializeDatabase(pathsToWatch);
  });
};

// Graceful shutdown
export function cleanupAndExit(
  wssKaraoke: any,   // WebSocket.Server
  wssRemote: any,
  karaokeServer: any,
  remoteServer: any,
  apiServer: any,
  karaokeWin?: BrowserWindow | null,
  mainWindow?: BrowserWindow | null
) {
  console.log("[shutdown] Cleaning up...");

  [wssKaraoke, wssRemote].forEach((ws) => {
    ws.clients.forEach((c: any) => c.close());
    ws.close();
  });

  [karaokeServer, remoteServer, apiServer].forEach((s) => {
    try {
      s.close();
    } catch (e) {}
  });

  karaokeWin?.destroy();
  mainWindow?.destroy();

  console.log("[shutdown] Goodbye.");
  process.exit(0);
}

// Cache Assets
const CACHE_FILE = path.join(main_path, "cache.json");

type AssetCache = {
  backgroundHash?: string;
  videoHash?: string;
  musicHash?: string;
};

function hashFiles(files: string[]): string {
  return files
    .map((f) => {
      try {
        const s = fs.statSync(f);
        return `${f}:${s.size}:${s.mtimeMs}`;
      } catch {
        return `${f}:missing`;
      }
    })
    .join("|");
}

function loadCache(): AssetCache {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveCache(cache: AssetCache) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

// Generate a QRCode
export async function createQrCode(ip: string, port: string): Promise<string> {
  try {
    // Generate QR code as base64 data URL
    const qrCodeDataUrl = await QRCode.toDataURL(JSON.stringify({
      ip,
      port,
      signature: appState.signature,
    }), {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M'
    });

    return qrCodeDataUrl;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
}
