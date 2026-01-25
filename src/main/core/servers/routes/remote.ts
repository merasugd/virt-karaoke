// ────────── Remote Routes ──────────

import { Express } from 'express';
import { appState } from '../../events/app_state';
import { remoteHTML } from '../../../htmls';
import { getIPv4 } from '../../utils/helpers';

export function setupRemoteRoutes(remoteApp: Express) {
  // Main remote control page
  remoteApp.get('/', (_, res) => {
    const ip = getIPv4('Wi-Fi') || getIPv4('Ethernet') || '127.0.0.1';
    res.send(remoteHTML({ IP: ip, PORT: String(appState.remotePort) }));
  });
}
