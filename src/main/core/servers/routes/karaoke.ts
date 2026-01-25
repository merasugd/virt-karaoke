// ────────── Karaoke Routes ──────────

import { Express } from 'express';
import fs from 'fs';
import path from 'path';
import { appState } from '../../events/app_state';
import { karaokeHTML } from '../../../htmls';
import { getIPv4 } from '../../utils/helpers';
import { db } from '../../utils/db';
import { main_path } from '../../utils/paths';

export function setupKaraokeRoutes(karaokeApp: Express) {
  // Main karaoke display page
  karaokeApp.get('/', (_, res) => {
    if (appState.isKaraokeViewerActive) {
      return res.status(423).send(`
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Karaoke Display Locked</title>
<style>
  body {
    margin: 0;
    background: radial-gradient(circle at top, #111 0%, #000 70%);
    color: #fff;
    font-family: system-ui, -apple-system, BlinkMacSystemFont;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    text-align: center;
  }
  .card {
    background: rgba(255,255,255,0.05);
    border-radius: 20px;
    padding: 40px;
    max-width: 520px;
    box-shadow: 0 30px 80px rgba(0,0,0,0.7);
  }
  h1 {
    font-size: 2.2rem;
    margin-bottom: 10px;
  }
  p {
    opacity: 0.8;
    font-size: 1.1rem;
  }
  .hint {
    margin-top: 20px;
    font-size: 0.9rem;
    opacity: 0.6;
  }
</style>
</head>
<body>
  <div class="card">
    <h1>🎤 Karaoke Display In Use</h1>
    <p>The karaoke screen is already open on another device.</p>
    <div class="hint">
      Close the active display to connect here.
    </div>
  </div>
</body>
</html>
      `);
    }

    const ip = getIPv4('Wi-Fi') || getIPv4('Ethernet') || '127.0.0.1';
    return res.send(karaokeHTML({ IP: ip, PORT: String(appState.karaokePort) }));
  });

  // Serve media files
  karaokeApp.get('/media/:filename', (req, res) => {
    const filename = req.params.filename;
    const assetsDir = path.join(main_path, 'assets');

    // Background image or video
    if (filename === 'background') {
      if (appState.idleMode === 'image') {
        const bg = path.join(assetsDir, 'background.png');
        if (!fs.existsSync(bg)) return res.status(404).send('File not found');
        res.type('png');
        return res.sendFile(bg);
      } else {
        const bg = path.join(assetsDir, 'background.mp4');
        if (!fs.existsSync(bg)) return res.status(404).send('File not found');
        return streamVideo(bg, req, res);
      }
    }

    // Looping audio
    else if (filename === 'looping') {
      const loop = path.join(assetsDir, 'looping.mp3');
      if (!fs.existsSync(loop)) return res.status(404).send('File not found');
      return res.sendFile(loop);
    }

    // Song files
    else {
      const song = db.get(filename);
      if (song) {
        const filePath = song.path;
        if (!fs.existsSync(filePath)) return res.status(404).send('File not found');
        return streamVideo(filePath, req, res);
      } else {
        // Fallback to looping audio
        const fallback = path.join(assetsDir, 'looping.mp3');
        return res.sendFile(fallback);
      }
    }
  });
}

// Helper function to stream video with range support
function streamVideo(filePath: string, req: any, res: any) {
  const stat = fs.statSync(filePath);
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    const chunksize = (end - start) + 1;
    const stream = fs.createReadStream(filePath, { start, end });

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4'
    });

    stream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': stat.size,
      'Content-Type': 'video/mp4'
    });

    fs.createReadStream(filePath).pipe(res);
  }
}
