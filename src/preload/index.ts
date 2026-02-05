import { contextBridge, ipcRenderer } from 'electron'

// Custom APIs for renderer
const api = {}

const electronAP = {
  openFileDialog: (options: Electron.OpenDialogSyncOptions) => ipcRenderer.invoke('open-directory', options) || [],
  openDirectoryDialog: () => ipcRenderer.invoke('open-directory'),
  hostKaraokeView: () => ipcRenderer.send('host-karaoke-view'),
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  saveSettings: (settings: any) => ipcRenderer.invoke('save-settings', settings),
  resetSettings: () => ipcRenderer.invoke('reset-settings'),
  rescanSongs: () => ipcRenderer.send('rescan-songs'),
  getLanInfo: () => ipcRenderer.invoke('get-lan-info'),
  getYtCookieStatus: () => ipcRenderer.invoke('get-yt-cookie-status'),
  loginYouTube: () => ipcRenderer.invoke('login-youtube'),
  deleteYtCookie: () => ipcRenderer.invoke('delete-yt-cookie'),
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electronAPI', electronAP)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.api = api
  // @ts-ignore (define in dts)
  window.electronAPI = electronAP
}
