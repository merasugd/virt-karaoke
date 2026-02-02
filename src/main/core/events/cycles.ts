// ────────── App Cycles ──────────

import { app, dialog } from "electron";

// Flag to track if shutdown was initiated programmatically
let skipQuitConfirmation = false;

export function setSkipQuitConfirmation(skip: boolean) {
  skipQuitConfirmation = skip;
}

import { cleanupAndExit } from "../utils/helpers";
import { karaokeServer, remoteServer, apiApp } from "../servers/app";
import { wssKaraoke, wssRemote } from "../servers/websocket";
import { appState } from "./app_state";

// Confirmation dialog before quitting
async function confirmQuit() {
  // Skip confirmation if shutdown was programmatic
  if (skipQuitConfirmation) {
    return true;
  }

  const response = await dialog.showMessageBox({
    type: 'question',
    buttons: ['Cancel', 'Yes'],
    defaultId: 0,
    title: 'Confirm Quit',
    message: 'Are you sure you want to quit?',
    detail: 'All connections will be closed.'
  });

  return response.response === 1; // Returns true if "Quit" was clicked
}

// Handle cleanup and shutdown
async function handleQuit() {
  const shouldQuit = await confirmQuit();

  if (shouldQuit) {
    console.log('[app] User confirmed quit');
    cleanupAndExit(
      wssKaraoke,
      wssRemote,
      karaokeServer,
      remoteServer,
      apiApp,
      appState.karaokeWin,
      appState.mainWindow
    );
  } else {
    console.log('[app] Quit cancelled by user');
  }
}

// Setup application lifecycle handlers
export function setupCycles() {
  // Handle window close on non-Mac platforms
  app.on('window-all-closed', async () => {
    if (process.platform !== 'darwin') {
      console.log('[app] All windows closed');
      await handleQuit();
    }
  });

  // Handle app quit event
  app.on('before-quit', async (event) => {
    event.preventDefault();
    console.log('[app] Quit requested');
    await handleQuit();
  });

  // Handle termination signals
  process.on('SIGINT', async () => {
    console.log('[signal] SIGINT received');
    await handleQuit();
  });

  process.on('SIGTERM', async () => {
    console.log('[signal] SIGTERM received');
    await handleQuit();
  });

  // Handle critical errors
  process.on('uncaughtException', (err) => {
    console.error('[error] Critical error:', err);
    // Skip confirmation on crashes
    cleanupAndExit(
      wssKaraoke,
      wssRemote,
      karaokeServer,
      remoteServer,
      apiApp,
      appState.karaokeWin,
      appState.mainWindow
    );
  });

  console.log('[app] Lifecycle handlers ready');
}
