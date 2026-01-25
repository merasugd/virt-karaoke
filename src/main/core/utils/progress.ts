// ────────── Progress ──────────

import { BrowserWindow, screen } from 'electron';

export interface ProgressController {
  win: BrowserWindow;
  setProgress: (percent: number) => void;
  setMessage: (text: string) => void;
  setTitle: (text: string) => void;
  setIndeterminate: (indeterminate: boolean) => void;
  close: () => void;
}

export async function createProgressWindow(alwaysOnTop: boolean): Promise<ProgressController> {
  const win = new BrowserWindow({
    width: 460,
    height: 140,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    transparent: true,
    alwaysOnTop: alwaysOnTop,
    hasShadow: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    show: false,
  });

  // HTML Design for the progress
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          margin: 0;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: rgba(20, 20, 25, 0.95);
          color: #fff;
          border-radius: 12px;
          backdrop-filter: blur(10px);
          -webkit-app-region: drag;
        }
        h3 {
          margin: 0 0 16px 0;
          font-size: 15px;
          font-weight: 500;
        }
        .progress-container {
          height: 8px;
          background: rgba(255,255,255,0.1);
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 12px;
        }
        .progress-bar {
          height: 100%;
          background: linear-gradient(90deg, #00d4ff, #0099ff);
          width: 0%;
          border-radius: 4px;
          transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .indeterminate .progress-bar {
          width: 100%;
          background: linear-gradient(90deg, transparent, #00d4ff, transparent);
          animation: indeterminate 1.5s infinite;
        }
        @keyframes indeterminate {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .percent {
          font-size: 14px;
          text-align: center;
          opacity: 0.9;
        }
      </style>
    </head>
    <body>
      <h3 id="title">Preparing assets…</h3>
      <div class="progress-container">
        <div id="bar" class="progress-bar"></div>
      </div>
      <div id="percent" class="percent">0%</div>

      <script>
        const { ipcRenderer } = require('electron');
        const bar = document.getElementById('bar');
        const percentEl = document.getElementById('percent');
        const titleEl = document.getElementById('title');
        const container = document.querySelector('.progress-container');

        ipcRenderer.on('progress', (_, value) => {
          bar.style.width = value + '%';
          percentEl.innerText = Math.round(value) + '%';
          container.classList.remove('indeterminate');
        });

        ipcRenderer.on('message', (_, msg) => {
          titleEl.innerText = msg;
        });

        ipcRenderer.on('title', (_, txt) => {
          titleEl.innerText = txt;
        });

        ipcRenderer.on('indeterminate', (_, isIndet) => {
          container.classList.toggle('indeterminate', isIndet);
          if (isIndet) {
            percentEl.innerText = '…';
            bar.style.width = '100%';
          }
        });
      </script>
    </body>
    </html>
  `;

  win.loadURL(`data:text/html,${encodeURIComponent(html)}`);

  // Wait for load
  await new Promise<void>(resolve =>
    win.webContents.once('did-finish-load', () => resolve())
  );

  // Auto-center on primary display
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  const x = Math.round((width - 460) / 2);
  const y = Math.round((height - 140) / 2);
  win.setPosition(x, y);
  win.show();

  // Control API
  const controller: ProgressController = {
    win,

    setProgress: (percent: number) => {
      if (percent >= 0 && percent <= 100) {
        win.webContents.send('progress', percent);
      }
    },

    setMessage: (text: string) => {
      win.webContents.send('message', text);
    },

    setTitle: (text: string) => {
      win.webContents.send('title', text);
    },

    setIndeterminate: (indeterminate: boolean) => {
      win.webContents.send('indeterminate', indeterminate);
    },

    close: () => {
      if (!win.isDestroyed()) {
        win.close();
      }
    },
  };

  return controller;
}
