// ────────── API Routes ──────────

import { Express } from 'express';
import { app } from 'electron';
import { appState } from '../../events/app_state';
import { db } from '../../utils/db';
import { resolveSongIdFromCode, playNextInQueuePromise } from '../../utils/helpers';
import { broadcastSongEnd, broadcastState } from '../../utils/state';
import { 
  downloadKaraokeSong, 
  activeDownloads, 
  getDownloadedSongs, 
  deleteDownloadedSong 
} from '../services/download';
import { searchSourcesForSong } from '../services/search';

export function setupApiRoutes(apiApp: Express) {
  // Get signature
  apiApp.get('/sig', (_, res) => {
    return res.type('text/plain').send(appState.signature);
  });

  // Get downloaded songs list
  apiApp.get('/downloaded-songs', async (_, res) => {
    try {
      console.log('[api] Fetching downloaded songs list');
      const songs = getDownloadedSongs();

      return res.json({
        songs,
        count: songs.length
      });
    } catch (error) {
      console.error('[api] Failed to fetch downloaded songs:', error);
      return res.status(500).json({
        error: 'Failed to fetch downloaded songs',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Delete downloaded song
  apiApp.post('/delete-song', async (req, res) => {
    const { filename } = req.body;

    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({ error: 'Filename is required' });
    }

    try {
      console.log('[api] Delete song requested:', filename);
      deleteDownloadedSong(filename);

      return res.json({
        ok: true,
        message: 'Song deleted successfully',
        filename
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      
      if (message === 'Invalid filename') {
        return res.status(400).json({ error: message });
      }
      if (message === 'File not found') {
        return res.status(404).json({ error: message });
      }

      console.error('[api] Failed to delete song:', error);
      return res.status(500).json({
        error: 'Failed to delete song',
        message
      });
    }
  });

  // Main action endpoint
  apiApp.post('/action', async (req, res) => {
    const { action, digit, query, downloadId, title, artist } = req.body;
    console.log('[api] Action received:', action, { digit, query, downloadId, title, artist });

    let lastDigit: string | null = null;

    switch (action) {
      // Input digit
      case 'digit':
        if (digit && appState.currentCode.length < 6) {
          await appState.setCurrentCode(appState.currentCode + digit);
          lastDigit = digit;
        }
        break;

      // Delete last digit
      case 'delete':
        await appState.setCurrentCode(appState.currentCode.slice(0, -1));
        lastDigit = "delete";
        break;

      // Enter song code
      case 'enter': {
        const padded = (appState.currentCode || '').padStart(6, '0');
        const resolvedId = resolveSongIdFromCode(padded);

        if (resolvedId) {
          // Prevent consecutive duplicate of current song
          if (appState.currentSong?.id !== resolvedId || appState.codeQueue.length > 0) {
            appState.queueCode(resolvedId);
            console.log(`[queue] Song ${resolvedId} added to queue`);
          } else {
            console.log(`[queue] Skipped adding song ${resolvedId} (same as current)`);
          }

          // Reset code after enter
          await appState.setCurrentCode("");
          broadcastState("enter");

          // Start next song if idle
          if (appState.isIdle && appState.codeQueue.length > 0) {
            await playNextInQueuePromise();
          } else {
            broadcastState(null);
          }
        }
        break;
      }

      // Skip current song
      case 'skip':
        if (appState.currentSong) {
          console.log('[skip] Skipping current song', appState.currentSong.id);
          broadcastSongEnd(appState.currentSong, 'skip');
          await playNextInQueuePromise();
        }
        break;

      // Search song
      case 'search': {
        const q = (query || '').toLowerCase();
        const results = db.list().filter(
          s => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)
        );
        return res.json({ type: 'songList', songs: results });
      }

      // Download song
      case 'download': {
        if (!downloadId || !title || !artist) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        if (activeDownloads.has(downloadId)) {
          return res.status(409).json({ error: 'Download already in progress' });
        }

        // Start download in background
        activeDownloads.set(downloadId, { title, artist, startTime: Date.now() });

        downloadKaraokeSong(downloadId, title, artist).catch(err => {
          console.error('[download] Background download failed:', err);
        });

        return res.json({ ok: true, downloadId });
      }

      // Get current state
      case 'getState':
        return res.json({
          state: appState.currentState,
          code: appState.currentCode.padStart(6, '0'),
          status: appState.currentSong
            ? `${appState.currentSong.title} - ${appState.currentSong.artist}`
            : 'Select A Song',
          queue: [...appState.codeQueue],
          songId: appState.currentSong?.id ?? null,
          announceKeys: appState.announceKeys,
          backgroundType: appState.idleMode
        });

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    // Broadcast updated state
    broadcastState(lastDigit);
    return res.json({ ok: true });
  });

  // Query song from multiple sources
  apiApp.post('/query-song', async (req, res) => {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required' });
    }

    console.log('[query-song] Searching for:', query);

    try {
      const results = await searchSourcesForSong(query);

      return res.json({
        query,
        results,
        count: results.length
      });
    } catch (error) {
      console.error('[query-song] Search failed:', error);
      return res.status(500).json({
        error: 'Search failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Shutdown application
  apiApp.post('/shutdown', (_, res) => {
    console.log('[api] Shutdown requested');
    res.json({ ok: true });

    setTimeout(() => {
      console.log('[shutdown] Terminating application');
      app.quit();
    }, 100);
  });
}
