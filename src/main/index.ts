// ────────── App Entrypoint ──────────

import { app, BrowserWindow, dialog, nativeImage, nativeTheme, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import { initializeDatabase } from './core/utils/db';
import { settings } from './settings';
import { appState, initializeAppState } from './core/events/app_state';
import {
  prepareAssets,
  watchSongs,
} from './core/utils/helpers';
import { setupCycles } from './core/events/cycles';
import icon from '../../resources/icon.png?asset';

console.log(
  '[startup] Application starting… Electron:',
  process.versions.electron
);

import './core/events/ipc';
import { additional_songs, main_path } from './core/utils/paths';
import { getFFmpegPath } from './binaries/ffmpeg';
import { validate7zipBinaries } from './binaries/7zip';
import { is } from '@electron-toolkit/utils';
import cookieManager from './core/utils/cookie';
import { installYtDlp } from './binaries/ytdlp';
import { ensureRuntime } from './binaries/deno';

// Directory Validator
function isValidDirectory(dirPath: string): boolean {
  if (!dirPath) return false;

  try {
    const stat = fs.statSync(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

// Prompt for song directory
async function promptForSongsDirectory(): Promise<string | null> {
  console.log('[startup] Prompting user to select songs directory');

  const result = await dialog.showOpenDialog({
    title: 'Select Songs Directory',
    message: 'Please select the folder containing your karaoke MP4 files',
    properties: ['openDirectory', 'createDirectory'],
    buttonLabel: 'Select Folder',
  });

  if (result.canceled || result.filePaths.length === 0) {
    console.warn('[startup] User cancelled directory selection');
    return null;
  }

  const selectedPath = result.filePaths[0];
  console.log('[startup] User selected directory:', selectedPath);

  // Save the selected path to settings
  settings.set('searchPath', selectedPath);

  return selectedPath;
}

// Init

const getIconPath = () => {
  return nativeImage.createFromPath(icon);
};

app.whenReady().then(async () => {
  console.log('[app] Electron ready — initializing');

  // 0. Setup window / app lifecycle logic
  setupCycles();

  // 1. Prepare binaries
  const ffmpeg_path = await getFFmpegPath();
  ffmpeg.setFfmpegPath(ffmpeg_path);

  await validate7zipBinaries();
  await ensureRuntime();
  await installYtDlp();

  // 2. Create main control window (settings / library UI)
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    autoHideMenuBar: true,
    backgroundColor: '#121212', // dark theme background
    show: false, // create hidden, show later with fadeIn
    icon: getIconPath(),
    title: 'Virtual Karaoke',
    frame: true, // set to false for frameless window
    resizable: true,
    fullscreenable: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      devTools: is.dev, // only enable devtools in dev
    },
  });

  appState.setMainWindow(mainWindow);
  nativeTheme.themeSource = 'system';

  await mainWindow.loadFile(
    path.join(__dirname, '../renderer/index.html')
  );

  // 3. Load persisted settings
  const loaded = settings.getAll();
  console.log('[settings] Loaded from storage');

  // 4. Handle search path
  let searchPath = loaded.searchPath;

  // Validate the search path
  if (!searchPath || !isValidDirectory(searchPath)) {
    console.warn('[startup] Search path invalid or missing:', searchPath);
    console.log('[startup] Opening directory picker...');

    // Prompt user to select a directory
    const selectedPath = await promptForSongsDirectory();

    if (!selectedPath) {
      // User cancelled — quit the application
      console.error('[startup] No songs directory selected — quitting');

      await dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Songs Directory Required',
        message: 'A songs directory is required to run the karaoke application.',
        detail: 'The application will now exit.',
        buttons: ['OK'],
      });

      app.quit();
      return;
    }

    searchPath = selectedPath;
  }

  // 5.Initialize AppState + single-instance lock
  const ok = await initializeAppState();
  if (!ok) {
    console.error('[startup] Another instance detected — exiting');

    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'Instance Already Running',
      message: 'Another instance of the application is already running.',
      detail: 'If you do not have the karaoke window open and this is a bug, click "Fix" to open the state folder and manually delete the lock file (karaoke.lock).',
      buttons: ['Quit', 'Fix'],
      defaultId: 0,
      cancelId: 0
    });

    if (response === 1) {
      // Fix button clicked - open the app state folder
      const stateFolderPath = path.join(main_path, 'app_state');
      shell.openPath(stateFolderPath);
    }

    app.quit();
    return;
  }

  await appState.setIdleBackgroundPath(
    loaded.backgroundPath ?? ''
  );
  await appState.setIdleMode(
    loaded.idleMode ?? 'image'
  );
  await appState.setIdleVideoFiles(
    loaded.idleVideoFiles ?? []
  );
  await appState.setLoopingMusicEnabled(
    loaded.loopingMusic ?? false
  );
  await appState.setLoopingMusicFiles(
    loaded.musicFiles ?? []
  );
  await appState.setCustomFontPath(
    loaded.customFont ?? ''
  );
  await appState.setViewMode(
    loaded.viewMode ?? 'fullscreen'
  );
  await appState.setWindowSize(
    loaded.windowSize?.width ?? 1920,
    loaded.windowSize?.height ?? 1080
  );
  await appState.setKaraokePort(
    loaded.lanPort ?? 4545
  );
  await appState.setRemotePort(
    loaded.remotePort ?? 4646
  );
  await appState.setAnnounceKeys(
    loaded.announceKeys ?? true
  );

  await appState.setSearchPath(searchPath);
  console.log('[startup] AppState hydrated, searchPath:', searchPath);

  // 6. Prepare static assets (background, font, music, sounds)
  await prepareAssets();
  console.log('[startup] Assets prepared');

  // 7. Load song database
  initializeDatabase([searchPath, additional_songs]);
  console.log('[startup] Database initialized');

  // 8. Start file watcher for new songs
  watchSongs();
  console.log('[startup] File watcher started');

  // 9. Check YouTube cookie expiry
  try {
    const cookieStatus = await cookieManager.getCookieStatus();

    if (cookieStatus.exists && cookieStatus.expiry) {
      const expiryDate = new Date(cookieStatus.expiry);
      const now = new Date();

      // Check if cookies will expire within 7 days
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilExpiry <= 7 && daysUntilExpiry > 0) {
        console.warn(`[yt-cookies] YouTube session expires in ${daysUntilExpiry} days`);

        await dialog.showMessageBox(mainWindow, {
          type: 'warning',
          title: 'YouTube Session Expiring Soon',
          message: `Your YouTube session will expire in ${daysUntilExpiry} day(s).`,
          detail: 'Please login again in Settings to continue downloading age-restricted and members-only content.',
          buttons: ['OK']
        });
      } else if (daysUntilExpiry <= 0) {
        console.warn('[yt-cookies] YouTube session has expired');

        // Cookies expired - clean up
        await cookieManager.deleteCookies();

        await dialog.showMessageBox(mainWindow, {
          type: 'warning',
          title: 'YouTube Session Expired',
          message: 'Your YouTube session has expired.',
          detail: 'Please login again in Settings to download age-restricted and members-only content.',
          buttons: ['OK']
        });
      } else {
        console.log(`[yt-cookies] YouTube session active, expires in ${daysUntilExpiry} days`);
      }
    } else if (!cookieStatus.exists) {
      console.log('[yt-cookies] No YouTube session found');
    }
  } catch (error) {
    console.error('[yt-cookies] Error checking cookie status:', error);
  }

  // 10. Show the main window
  mainWindow.show();
});
