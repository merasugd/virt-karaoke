// ────────── WebSocket ──────────

import { WebSocketServer, WebSocket } from "ws";
import { karaokeServer, remoteServer } from "./app";
import { appState } from "../events/app_state";

const wssKaraoke = new WebSocketServer({ server: karaokeServer });
const wssRemote = new WebSocketServer({ server: remoteServer });

// Acquire Lock for Karaoke Display
wssKaraoke.on('connection', (ws: WebSocket) => {
  if (!appState.acquireKaraokeViewer()) {
    console.log('[ws:karaoke] Rejected - viewer already active');
    ws.close(1008, 'Karaoke display already in use');
    return;
  }

  console.log('[ws:karaoke] Karaoke viewer connected (LOCKED)');

  ws.on('close', () => {
    console.log('[ws:karaoke] Karaoke viewer disconnected');
    appState.releaseKaraokeViewer();
  });

  ws.on('error', (err) => {
    console.error('[ws:karaoke] Error:', err);
  });
});

// Check if remote successfully connected
wssRemote.on('connection', () => console.log('[ws:remote] New client connected'));

export { wssKaraoke, wssRemote };
