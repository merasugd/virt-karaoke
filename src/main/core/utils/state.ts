// ────────── State Broadcast ──────────

import { appState } from '../events/app_state';
import { wssKaraoke, wssRemote } from '../servers/websocket';
import { db, Song } from './db';

// Broadcast AppState to WebSocket
export function broadcastState(lastDigit: string | null = null) {
  const payload: any = {
    type: 'state',
    code: appState.currentCode.padStart(6, '0'),
    status: appState.currentSong
      ? `${appState.currentSong.title} - ${appState.currentSong.artist}`
      : appState.currentCode
        ? (() => {
            const s = db.get(appState.currentCode.padStart(6, '0'));
            return s ? `${s.title} - ${s.artist}` : 'No song found';
          })()
        : 'Select A Song',
    queue: [...appState.codeQueue],
    queueHistory: [...appState.queueHistory],
    lastDigit,
    announceKeys: appState.announceKeys,
    backgroundType: appState.idleMode,
    state: appState.currentState,
    songId: appState.currentSong?.id ?? null,
  };
  const data = JSON.stringify(payload);
  [wssKaraoke, wssRemote].forEach(wsServer =>
    wsServer.clients.forEach((client: any) => {
      if (client.readyState === client.OPEN) client.send(data);
    })
  );
}

// Broadcast song end event to the Websocket
export function broadcastSongEnd(endedSong: Song | null, reason: 'skip' | 'natural' = 'natural') {
  if (!endedSong) return;
  const payload = {
    type: 'songEnd',
    reason,
    songId: endedSong.id,
    title: endedSong.title,
    artist: endedSong.artist
  };
  const data = JSON.stringify(payload);
  [wssKaraoke, wssRemote].forEach(wsServer =>
    wsServer.clients.forEach((client: any) => {
      if (client.readyState === client.OPEN) client.send(data);
    })
  );
}

// Broadcast download progress to the WebSocket
export function broadcastDownloadProgress(
  downloadId: string,
  progress: number,
  status: 'searching' | 'downloading' | 'complete' | 'error',
  videoTitle?: string,
  filename?: string,
  error?: string
) {
  const payload: any = {
    type: status === 'complete' ? 'downloadComplete' : status === 'error' ? 'downloadError' : 'downloadProgress',
    downloadId,
    progress,
    status
  };

  if (videoTitle) payload.videoTitle = videoTitle;
  if (filename) payload.filename = filename;
  if (error) payload.error = error;

  const data = JSON.stringify(payload);

  // Only broadcast to remote clients (not karaoke display)
  wssRemote.clients.forEach((client: any) => {
    if (client.readyState === client.OPEN) client.send(data);
  });
}

// Broadcast playback control commands to the Karaoke WebSocket
export function broadcastPlaybackControl(
  action: 'pause' | 'resume' | 'prev' | 'seekForward' | 'seekBackward' | 'setVolume',
  value?: number
) {
  const payload: any = {
    type: 'playbackControl',
    action
  };

  if (value !== undefined) {
    payload.value = value;
  }

  const data = JSON.stringify(payload);

  // Broadcast to karaoke display only
  wssKaraoke.clients.forEach((client: any) => {
    if (client.readyState === client.OPEN) client.send(data);
  });
}
