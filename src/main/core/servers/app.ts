// ────────── Express Apps ──────────

import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { appState } from '../events/app_state';
import { main_path } from '../utils/paths';
import { setupCors } from './middleware/cors';
import { setupApiRoutes } from './routes/api';
import { setupKaraokeRoutes } from './routes/karaoke';
import { setupRemoteRoutes } from './routes/remote';

// Initialize Express apps
const karaokeApp = express();
const remoteApp = express();
const apiApp = express();

// Setup middleware
apiApp.use(express.json());
setupCors(apiApp);

// Setup routes
setupApiRoutes(apiApp);
setupKaraokeRoutes(karaokeApp);
setupRemoteRoutes(remoteApp);

// Serve static assets
karaokeApp.use('/assets', express.static(path.join(main_path, 'assets')));

// Create HTTP servers
const karaokeServer = createServer(karaokeApp);
const remoteServer = createServer(remoteApp);

// Start servers
karaokeServer.listen(appState.karaokePort, () => {
  console.log(`[server] Karaoke view running at http://localhost:${appState.karaokePort}`);
});

remoteServer.listen(appState.remotePort, () =>
  console.log(`[server] Remote control running at http://localhost:${appState.remotePort}`)
);

const apiServer = apiApp.listen(5151, () => 
  console.log('[server] Local API running at http://localhost:5151')
);

export { karaokeServer, remoteServer, karaokeApp, remoteApp, apiApp, apiServer };
