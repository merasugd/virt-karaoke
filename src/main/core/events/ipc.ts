// ────────── IPC Handlers ──────────

import { ipcMain, BrowserWindow, app, dialog, nativeImage, nativeTheme } from 'electron';
import path from 'path';

import { appState } from './app_state';
import { applyWindowSettings, getIPv4, createQrCode } from '../utils/helpers';
import { initializeDatabase } from '../utils/db';
import { settings } from '../../settings';
import { additional_songs } from '../utils/paths';

import icon from '../../../../resources/icon.png?asset';

// Manage Karaoke Display
const getIconPath = () => {
  return nativeImage.createFromPath(icon);
};

ipcMain.on('host-karaoke-view', async () => {
  if (appState.karaokeWin) {
    console.log('[window] Karaoke view already open — ignoring');
    return;
  }

  console.log('[window] Creating karaoke window');

  const karaokeWin = new BrowserWindow({
    width: appState.windowSize.width,
    height: appState.windowSize.height,
    minWidth: 800,
    minHeight: 600,
    frame: appState.viewMode !== 'borderless',
    fullscreen: appState.viewMode === 'fullscreen',
    autoHideMenuBar: true,
    resizable: true,
    backgroundColor: '#000000',
    icon: getIconPath(),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      devTools: process.env.NODE_ENV === 'development',
      spellcheck: false,
      sandbox: false,
    },
  });

  appState.setKaraokeWindow(karaokeWin);
  applyWindowSettings(karaokeWin);

  karaokeWin.on('ready-to-show', () => {
    karaokeWin.show();
  });

  nativeTheme.themeSource = 'system';

  karaokeWin.loadURL(`http://localhost:${appState.karaokePort}`);

  karaokeWin.webContents.on('did-finish-load', () => {
    karaokeWin.webContents.executeJavaScript('document.body.style.cursor = "none";');
  });

  karaokeWin.on('closed', () => {
    console.log('[window] Karaoke window closed → quitting app');
    appState.setKaraokeWindow(null);

    setTimeout(() => app.quit(), 300);
  });
});

// Load settings
ipcMain.handle('load-settings', () => {
  console.log('[settings] Loading settings');

  return {
    viewMode: appState.viewMode,
    windowSize: appState.windowSize,
    lanPort: appState.karaokePort,
    remotePort: appState.remotePort,
    backgroundPath: appState.idleBackgroundPath,
    idleMode: appState.idleMode,
    idleVideoFiles: appState.idleVideoFiles,
    loopingMusic: appState.loopingMusicEnabled,
    musicFiles: appState.loopingMusicFiles,
    customFont: appState.customFontPath,
    announceKeys: appState.announceKeys,
    searchPath: appState.searchPath,
  };
});

// Save settings
ipcMain.handle('save-settings', async (_, newSettings) => {
  console.log('[settings] Saving new settings');

  // Persist raw settings
  settings.update(newSettings);

  // Update AppState
  await appState.setIdleBackgroundPath(newSettings.backgroundPath ?? '');
  await appState.setIdleMode(newSettings.idleMode ?? 'image');
  await appState.setIdleVideoFiles(newSettings.idleVideoFiles ?? []);
  await appState.setLoopingMusicEnabled(newSettings.loopingMusic ?? false);
  await appState.setLoopingMusicFiles(newSettings.musicFiles ?? []);
  await appState.setCustomFontPath(newSettings.customFont ?? '');
  await appState.setViewMode(newSettings.viewMode ?? 'fullscreen');
  await appState.setWindowSize(
    newSettings.windowSize?.width ?? 1920,
    newSettings.windowSize?.height ?? 1080
  );
  await appState.setKaraokePort(newSettings.lanPort ?? 4545);
  await appState.setRemotePort(newSettings.remotePort ?? 4646);
  await appState.setSearchPath(
    newSettings.searchPath ??
      path.join(__dirname, '..', '..', 'test')
  );
  await appState.setAnnounceKeys(newSettings.announceKeys ?? false);

  console.log('[settings] AppState updated successfully');

  // Apply window changes live
  if (appState.karaokeWin && !appState.karaokeWin.isDestroyed()) {
    applyWindowSettings(appState.karaokeWin);
  }

  // Reload song database
  initializeDatabase([appState.searchPath, additional_songs]);

  // Ask for restart
  const { response } = await dialog.showMessageBox({
    type: 'info',
    title: 'Settings Saved',
    message: 'Changes saved successfully.',
    detail: 'Some settings require a restart.\n\nRestart now?',
    buttons: ['Restart'],
    defaultId: 0,
    cancelId: 1,
  });

  if (response === 0) {
    console.log('[app] Restart requested');
    app.relaunch();
    app.quit();
  }

  return true;
});

// Rescan songs
ipcMain.on('rescan-songs', () => {
  console.log('[db] Manual rescan requested');
  initializeDatabase([appState.searchPath, additional_songs]);
});

// Lan info
ipcMain.handle('get-lan-info', async() => {
  const ip =
    getIPv4('Wi-Fi') ||
    getIPv4('Ethernet') ||
    '127.0.0.1';

  return {
    karaokeIP: ip,
    karaokePort: appState.karaokePort,
    remoteIP: ip,
    remotePort: appState.remotePort,
    remoteQrCode: await createQrCode(ip, appState.remotePort.toString()),
  };
});

// Directory Picker
ipcMain.handle('open-directory', (_, options) => {
  if (options) {
    return dialog.showOpenDialogSync(options) || [];
  }

  const result = dialog.showOpenDialogSync({
    properties: ['openDirectory'],
  });

  return result ? result[0] : null;
});
