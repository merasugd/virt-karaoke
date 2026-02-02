// ────────── State Management ──────────

import { BrowserWindow, app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { Song } from '../utils/db';
import { main_path as main } from '../utils/paths';
import { existsSync, mkdirSync } from 'fs';

// Main Paths
const main_path = path.join(main, 'app_state');
if(!existsSync(main_path)) mkdirSync(main_path, { recursive: true });

interface StateSnapshot {
  currentCode: string;
  codeQueue: string[];
  queueHistory: Array<{ code: string; song: Song; timestamp: number }>;
  state: 'idle' | 'karaoke';
  currentSong: Song | null;
  idleBackgroundPath: string;
  idleMode: 'image' | 'video';
  idleVideoFiles: string[];
  loopingMusicEnabled: boolean;
  loopingMusicFiles: string[];
  customFontPath: string;
  announceKeys: boolean;
  viewMode: 'fullscreen' | 'borderless' | 'windowed';
  windowSize: { width: number; height: number };
  karaokePort: number;
  remotePort: number;
  searchPath: string;
  lastUpdate: number;
  instanceId: string;
  currentSignature: string;
}

type StateOperation =
  | { type: 'addToQueue'; code: string; timestamp: number; resolve?: (value: void) => void }
  | { type: 'removeFromQueue'; code: string; timestamp: number; resolve?: (value: void) => void }
  | { type: 'clearQueue'; timestamp: number; resolve?: (value: void) => void }
  | { type: 'shiftQueue'; timestamp: number; resolve?: (value: string | null) => void }
  | { type: 'setCurrentCode'; code: string; timestamp: number; resolve?: (value: void) => void }
  | { type: 'setIdleBackgroundPath'; path: string; timestamp: number; resolve?: (value: void) => void }
  | { type: 'setIdleMode'; mode: 'image' | 'video'; timestamp: number; resolve?: (value: void) => void }
  | { type: 'setIdleVideoFiles'; files: string[]; timestamp: number; resolve?: (value: void) => void }
  | { type: 'setLoopingMusicEnabled'; enabled: boolean; timestamp: number; resolve?: (value: void) => void }
  | { type: 'setLoopingMusicFiles'; files: string[]; timestamp: number; resolve?: (value: void) => void }
  | { type: 'setCustomFontPath'; path: string; timestamp: number; resolve?: (value: void) => void }
  | { type: 'setAnnounceKeys'; enabled: boolean; timestamp: number; resolve?: (value: void) => void }
  | { type: 'setWinningSoundPath'; path: string; timestamp: number; resolve?: (value: void) => void }
  | { type: 'setViewMode'; mode: 'fullscreen' | 'borderless' | 'windowed'; timestamp: number; resolve?: (value: void) => void }
  | { type: 'setWindowSize'; width: number; height: number; timestamp: number; resolve?: (value: void) => void }
  | { type: 'setKaraokePort'; port: number; timestamp: number; resolve?: (value: void) => void }
  | { type: 'setRemotePort'; port: number; timestamp: number; resolve?: (value: void) => void }
  | { type: 'setSearchPath'; path: string; timestamp: number; resolve?: (value: void) => void }
  | { type: 'enterIdle'; timestamp: number; resolve?: (value: void) => void }
  | { type: 'enterKaraoke'; code: string; song: Song; timestamp: number; resolve?: (value: void) => void }
  | { type: 'reset'; timestamp: number; resolve?: (value: void) => void }
  | { type: 'acquireKaraokeViewer'; timestamp: number; resolve: (success: boolean) => void }
  | { type: 'releaseKaraokeViewer'; timestamp: number; resolve?: (value: void) => void }
  | { type: 'setMainWindow'; window: BrowserWindow | null; timestamp: number; resolve?: (value: void) => void }
  | { type: 'setKaraokeWin'; window: BrowserWindow | null; timestamp: number; resolve?: (value: void) => void };


export class KaraokeAppState {

  // Windows
  private _mainWindow: BrowserWindow | null = null;
  private _karaokeWin: BrowserWindow | null = null;
  // Playback / queue
  private _currentCode: string = '';
  private _codeQueue: string[] = [];
  private _queueHistory: Array<{ code: string; song: Song; timestamp: number }> = []; // Queue history with full song data
  private _currentSong: Song | null = null;
  private _state: 'idle' | 'karaoke' = 'idle';

  // Idle screen configuration
  private _idleBackgroundPath: string = '';
  private _idleMode: 'image' | 'video' = 'image';
  private _idleVideoFiles: string[] = [];

  // Background music when idle
  private _loopingMusicEnabled: boolean = false;
  private _loopingMusicFiles: string[] = [];

  // Visual / UX settings
  private _customFontPath: string = '';
  private _announceKeys: boolean = true;

  // Window presentation
  private _viewMode: 'fullscreen' | 'borderless' | 'windowed' = 'fullscreen';
  private _windowSize: { width: number; height: number } = { width: 1920, height: 1080 };

  // Networking
  private _karaokePort: number = 4545;
  private _remotePort: number = 4646;

  // Search / library
  private _searchPath: string = '';

  // Karaoke Lock
  private _activeKaraokeViewer: boolean = false;

  // Validation
  private _currentSignature: string = '';

  // State Manager
  private _storageFilePath: string;
  private _lockFilePath: string;
  private _instanceId: string;
  private _saveTimeout: NodeJS.Timeout | null = null;
  private _stateOperations: StateOperation[] = [];
  private _isProcessingState: boolean = false;
  private _isSaving: boolean = false;

  constructor() {
    const userDataPath = main_path;
    this._storageFilePath = path.join(userDataPath, 'karaoke-state.json');
    this._lockFilePath = path.join(userDataPath, 'karaoke.lock');
    this._instanceId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    this._currentSignature = `VirtualKaraoke-sig=${this._instanceId}-${Date.now()}`;
    console.log('[AppState] Instance ID:', this._instanceId);
    console.log('[AppState] QR Code Signature:', this._currentSignature);
    console.log('[AppState] Storage path:', this._storageFilePath);
  }

  // Single Instance Failsafe
  async checkSingleInstance(): Promise<boolean> {
    try {
      // Check if lock file exists
      try {
        const lockContent = await fs.readFile(this._lockFilePath, 'utf-8');
        const lockData = JSON.parse(lockContent);
        // Check if lock is stale (older than 30 seconds)
        const lockAge = Date.now() - lockData.timestamp;
        if (lockAge > 30000) {
          console.warn('[AppState] Stale lock detected, removing...');
          await fs.unlink(this._lockFilePath).catch(() => {});
        } else {
          console.error('[AppState] Another instance is already running!');
          console.error('[AppState] Lock created by instance:', lockData.instanceId);
          return false;
        }
      } catch (err: any) {
        if (err.code !== 'ENOENT') {
          console.error('[AppState] Error reading lock file:', err);
        }
        // Lock file doesn't exist, proceed
      }
      // Create lock file
      await fs.writeFile(
        this._lockFilePath,
        JSON.stringify({
          instanceId: this._instanceId,
          timestamp: Date.now(),
          pid: process.pid
        }),
        'utf-8'
      );
      console.log('[AppState] ✓ Single instance lock acquired');
      // Update lock file every 10 seconds to prevent stale locks
      setInterval(async () => {
        try {
          await fs.writeFile(
            this._lockFilePath,
            JSON.stringify({
              instanceId: this._instanceId,
              timestamp: Date.now(),
              pid: process.pid
            }),
            'utf-8'
          );
        } catch (err) {
          console.error('[AppState] Failed to update lock file:', err);
        }
      }, 10000);
      return true;
    } catch (err) {
      console.error('[AppState] Single instance check failed:', err);
      return false;
    }
  }
  /**
   * Release the single instance lock
   */
  async releaseLock(): Promise<void> {
    try {
      await fs.unlink(this._lockFilePath);
      console.log('[AppState] ✓ Lock released');
    } catch (err) {
      console.warn('[AppState] Failed to release lock:', err);
    }
  }

  // Storage
  async loadState(): Promise<void> {
    try {
      const data = await fs.readFile(this._storageFilePath, 'utf-8');
      const snapshot: StateSnapshot = JSON.parse(data);
      // Verify instance ID to prevent loading another instance's state
      if (snapshot.instanceId && snapshot.instanceId !== this._instanceId) {
        const age = Date.now() - snapshot.lastUpdate;
        if (age < 60000) { // Less than 1 minute old
          console.warn('[AppState] State belongs to another instance, using defaults');
          return;
        }
      }
      // Restore state
      this._currentCode = '';
      this._codeQueue = [];
      this._queueHistory = snapshot.queueHistory || [];
      this._state = 'idle';
      this._currentSong = null;
      this._idleBackgroundPath = '';
      this._idleMode = 'image';
      this._idleVideoFiles = [];
      this._loopingMusicEnabled = false;
      this._loopingMusicFiles = [];
      this._customFontPath = '';
      this._announceKeys = true;
      this._viewMode = 'fullscreen';
      this._windowSize = { width: 1920, height: 1080 };
      this._karaokePort = 4545;
      this._remotePort = 4646;
      this._searchPath = '';
      console.log('[AppState] ✓ New State loaded');
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        console.log('[AppState] No saved state found, using defaults');
      } else {
        console.error('[AppState] Failed to load state:', err);
      }
    }
  }
  /**
   * Save state to disk (debounced)
   */
  private async saveState(): Promise<void> {
    // Debounce saves to avoid excessive disk writes
    if (this._saveTimeout) {
      clearTimeout(this._saveTimeout);
    }
    this._saveTimeout = setTimeout(async () => {
      if (this._isSaving) {
        // Already saving, schedule another save
        setTimeout(() => this.saveState(), 100);
        return;
      }
      this._isSaving = true;
      try {
        const snapshot: StateSnapshot = {
          currentCode: this._currentCode,
          codeQueue: [...this._codeQueue],
          queueHistory: this._queueHistory,
          state: this._state,
          currentSong: this._currentSong ? { ...this._currentSong } : null,
          idleBackgroundPath: this._idleBackgroundPath,
          idleMode: this._idleMode,
          idleVideoFiles: [...this._idleVideoFiles],
          loopingMusicEnabled: this._loopingMusicEnabled,
          loopingMusicFiles: [...this._loopingMusicFiles],
          customFontPath: this._customFontPath,
          announceKeys: this._announceKeys,
          viewMode: this._viewMode,
          windowSize: { ...this._windowSize },
          karaokePort: this._karaokePort,
          remotePort: this._remotePort,
          searchPath: this._searchPath,
          lastUpdate: Date.now(),
          instanceId: this._instanceId,
          currentSignature: this._currentSignature,
        };
        await fs.writeFile(this._storageFilePath, JSON.stringify(snapshot, null, 2), 'utf-8');
        console.log('[AppState] ✓ State saved to disk');
      } catch (err) {
        console.error('[AppState] Failed to save state:', err);
      } finally {
        this._isSaving = false;
      }
    }, 500); // Debounce 500ms
  }
  /**
   * Force immediate save (for shutdown/critical updates)
   */
  async forceSave(): Promise<void> {
    if (this._saveTimeout) {
      clearTimeout(this._saveTimeout);
      this._saveTimeout = null;
    }
    // Wait for any in-progress save
    while (this._isSaving) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    await this.saveState();
  }

  // Operations
  private async processStateOperations(): Promise<void> {
    if (this._isProcessingState) return;
    this._isProcessingState = true;
    try {
      while (this._stateOperations.length > 0) {
        const op = this._stateOperations.shift()!;
        switch (op.type) {
          case 'addToQueue':
            if (!op.code) {
              op.resolve?.();
              break;
            }

            const lastQueued = this._codeQueue[this._codeQueue.length - 1];

            if (lastQueued === op.code) {
              console.log(`[AppState] Skipped duplicate consecutive code: ${op.code}`);
              op.resolve?.();
              break;
            }

            this._codeQueue.push(op.code);
            console.log(`[AppState] Queued code: ${op.code}`);
            op.resolve?.();
            break;
          case 'removeFromQueue':
            if (op.code) {
              const index = this._codeQueue.indexOf(op.code);
              if (index > -1) {
                this._codeQueue.splice(index, 1);
                console.log(`[AppState] Removed code: ${op.code}`);
              }
            }
            op.resolve?.();
            break;
          case 'clearQueue':
            this._codeQueue = [];
            console.log('[AppState] Queue cleared');
            op.resolve?.();
            break;
          case 'shiftQueue':
            let shifted: string | null = null;
            if (this._codeQueue.length > 0) {
              shifted = this._codeQueue.shift()!;
            }
            op.resolve?.(shifted);
            break;
          case 'setCurrentCode':
            this._currentCode = op.code;
            op.resolve?.();
            break;
          case 'setIdleBackgroundPath':
            this._idleBackgroundPath = op.path;
            op.resolve?.();
            break;
          case 'setIdleMode':
            this._idleMode = op.mode;
            op.resolve?.();
            break;
          case 'setIdleVideoFiles':
            this._idleVideoFiles = [...op.files];
            op.resolve?.();
            break;
          case 'setLoopingMusicEnabled':
            this._loopingMusicEnabled = op.enabled;
            op.resolve?.();
            break;
          case 'setLoopingMusicFiles':
            this._loopingMusicFiles = [...op.files];
            op.resolve?.();
            break;
          case 'setCustomFontPath':
            this._customFontPath = op.path;
            op.resolve?.();
            break;
          case 'setAnnounceKeys':
            this._announceKeys = op.enabled;
            op.resolve?.();
            break;
          case 'setViewMode':
            this._viewMode = op.mode;
            op.resolve?.();
            break;
          case 'setWindowSize':
            this._windowSize = { width: op.width, height: op.height };
            op.resolve?.();
            break;
          case 'setKaraokePort':
            this._karaokePort = op.port;
            op.resolve?.();
            break;
          case 'setRemotePort':
            this._remotePort = op.port;
            op.resolve?.();
            break;
          case 'setSearchPath':
            this._searchPath = op.path;
            op.resolve?.();
            break;
          case 'enterIdle':
            if (this._state === 'idle') {
              console.log('[AppState] Already in IDLE mode');
              op.resolve?.();
              break;
            }
            this._state = 'idle';
            this._currentSong = null;
            console.log('[AppState] → IDLE mode');
            op.resolve?.();
            break;
          case 'enterKaraoke':
            if (this._state === 'karaoke' && this._currentCode === op.code) {
              console.log('[AppState] Already in KARAOKE mode with same song');
              op.resolve?.();
              break;
            }
            this._state = 'karaoke';
            this._currentSong = { ...op.song };
            // Add current song to history with full data (keep last 100 songs)
            if (op.code && op.song) {
              this._queueHistory.push({
                code: op.code,
                song: { ...op.song },
                timestamp: Date.now()
              });
              if (this._queueHistory.length > 100) {
                this._queueHistory.shift();
              }
            }
            console.log(`[AppState] → KARAOKE mode | ${op.code} - ${op.song.title}`);
            op.resolve?.();
            break;
          case 'reset':
            this._currentCode = '';
            this._codeQueue = [];
            this._currentSong = null;
            this._state = 'idle';
            console.log('[AppState] State reset');
            op.resolve?.();
            break;
          case 'acquireKaraokeViewer':
            const success = !this._activeKaraokeViewer;
            if (success) {
              this._activeKaraokeViewer = true;
              console.log('[AppState] Karaoke viewer LOCKED');
            }
            op.resolve(success);
            break;
          case 'releaseKaraokeViewer':
            if (this._activeKaraokeViewer) {
              this._activeKaraokeViewer = false;
              console.log('[AppState] Karaoke viewer UNLOCKED');
            }
            op.resolve?.();
            break;
          case 'setMainWindow':
            this._mainWindow = op.window;
            op.resolve?.();
            break;
          case 'setKaraokeWin':
            this._karaokeWin = op.window;
            op.resolve?.();
            break;
        }
        // Small delay to prevent blocking
        await new Promise(resolve => setImmediate(resolve));
      }
    } finally {
      this._isProcessingState = false;
      this.saveState();
    }
  }
  /**
   * Add a code to the queue (thread-safe)
   */
  async queueCode(code: string): Promise<void> {
    return new Promise(resolve => {
      this._stateOperations.push({
        type: 'addToQueue',
        code,
        timestamp: Date.now(),
        resolve
      });
      this.processStateOperations();
    });
  }
  /**
   * Remove a code from the queue (thread-safe)
   */
  async removeFromQueue(code: string): Promise<void> {
    return new Promise(resolve => {
      this._stateOperations.push({
        type: 'removeFromQueue',
        code,
        timestamp: Date.now(),
        resolve
      });
      this.processStateOperations();
    });
  }
  /**
   * Clear the entire queue (thread-safe)
   */
  async clearQueue(): Promise<void> {
    return new Promise(resolve => {
      this._stateOperations.push({
        type: 'clearQueue',
        timestamp: Date.now(),
        resolve
      });
      this.processStateOperations();
    });
  }
  /**
   * Get and remove the next code from queue (thread-safe)
   */
  async shiftNextCode(): Promise<string | null> {
    return new Promise(resolve => {
      this._stateOperations.push({
        type: 'shiftQueue',
        timestamp: Date.now(),
        resolve
      });
      this.processStateOperations();
    });
  }

  // READ-ONLY GETTERS
  // Windows
  get mainWindow(): BrowserWindow | null { return this._mainWindow; }
  get karaokeWin(): BrowserWindow | null { return this._karaokeWin; }
  // Playback state
  get currentCode(): string { return this._currentCode; }
  get codeQueue(): readonly string[] { return Object.freeze([...this._codeQueue]); }
  get queueHistory(): ReadonlyArray<{ code: string; song: Song; timestamp: number }> {
    return Object.freeze([...this._queueHistory]);
  }
  get currentSong(): Readonly<Song> | null {
    return this._currentSong ? Object.freeze({ ...this._currentSong }) : null;
  }
  get currentState(): 'idle' | 'karaoke' { return this._state; }
  get isIdle(): boolean { return this._state === 'idle'; }
  get isKaraoke(): boolean { return this._state === 'karaoke'; }
  // Configuration
  get idleBackgroundPath(): string { return this._idleBackgroundPath; }
  get idleMode(): 'image' | 'video' { return this._idleMode; }
  get idleVideoFiles(): readonly string[] { return Object.freeze([...this._idleVideoFiles]); }
  get loopingMusicEnabled(): boolean { return this._loopingMusicEnabled; }
  get loopingMusicFiles(): readonly string[] { return Object.freeze([...this._loopingMusicFiles]); }
  get customFontPath(): string { return this._customFontPath; }
  get announceKeys(): boolean { return this._announceKeys; }
  get viewMode(): 'fullscreen' | 'borderless' | 'windowed' { return this._viewMode; }
  get windowSize(): Readonly<{ width: number; height: number }> {
    return Object.freeze({ ...this._windowSize });
  }
  get karaokePort(): number { return this._karaokePort; }
  get remotePort(): number { return this._remotePort; }
  get searchPath(): string { return this._searchPath; }

  // Operation Request
  // Windows
  setMainWindow(window: BrowserWindow | null): void {
    this._stateOperations.push({
      type: 'setMainWindow',
      window,
      timestamp: Date.now()
    });
    this.processStateOperations();
  }
  setKaraokeWindow(window: BrowserWindow | null): void {
    this._stateOperations.push({
      type: 'setKaraokeWin',
      window,
      timestamp: Date.now()
    });
    this.processStateOperations();
  }
  // Configuration
  async setIdleBackgroundPath(path: string): Promise<void> {
    return new Promise(resolve => {
      this._stateOperations.push({
        type: 'setIdleBackgroundPath',
        path,
        timestamp: Date.now(),
        resolve
      });
      this.processStateOperations();
    });
  }
  async setCurrentCode(code: string): Promise<void> {
    return new Promise(resolve => {
      this._stateOperations.push({
        type: 'setCurrentCode',
        code,
        timestamp: Date.now(),
        resolve
      });
      this.processStateOperations();
    });
  }
  async setIdleMode(mode: 'image' | 'video'): Promise<void> {
    return new Promise(resolve => {
      this._stateOperations.push({
        type: 'setIdleMode',
        mode,
        timestamp: Date.now(),
        resolve
      });
      this.processStateOperations();
    });
  }
  async setIdleVideoFiles(files: string[]): Promise<void> {
    return new Promise(resolve => {
      this._stateOperations.push({
        type: 'setIdleVideoFiles',
        files,
        timestamp: Date.now(),
        resolve
      });
      this.processStateOperations();
    });
  }
  async setLoopingMusicEnabled(enabled: boolean): Promise<void> {
    return new Promise(resolve => {
      this._stateOperations.push({
        type: 'setLoopingMusicEnabled',
        enabled,
        timestamp: Date.now(),
        resolve
      });
      this.processStateOperations();
    });
  }
  async setLoopingMusicFiles(files: string[]): Promise<void> {
    return new Promise(resolve => {
      this._stateOperations.push({
        type: 'setLoopingMusicFiles',
        files,
        timestamp: Date.now(),
        resolve
      });
      this.processStateOperations();
    });
  }
  async setCustomFontPath(path: string): Promise<void> {
    return new Promise(resolve => {
      this._stateOperations.push({
        type: 'setCustomFontPath',
        path,
        timestamp: Date.now(),
        resolve
      });
      this.processStateOperations();
    });
  }
  async setAnnounceKeys(enabled: boolean): Promise<void> {
    return new Promise(resolve => {
      this._stateOperations.push({
        type: 'setAnnounceKeys',
        enabled,
        timestamp: Date.now(),
        resolve
      });
      this.processStateOperations();
    });
  }
  async setViewMode(mode: 'fullscreen' | 'borderless' | 'windowed'): Promise<void> {
    return new Promise(resolve => {
      this._stateOperations.push({
        type: 'setViewMode',
        mode,
        timestamp: Date.now(),
        resolve
      });
      this.processStateOperations();
    });
  }
  async setWindowSize(width: number, height: number): Promise<void> {
    return new Promise(resolve => {
      this._stateOperations.push({
        type: 'setWindowSize',
        width,
        height,
        timestamp: Date.now(),
        resolve
      });
      this.processStateOperations();
    });
  }
  async setKaraokePort(port: number): Promise<void> {
    return new Promise(resolve => {
      this._stateOperations.push({
        type: 'setKaraokePort',
        port,
        timestamp: Date.now(),
        resolve
      });
      this.processStateOperations();
    });
  }
  async setRemotePort(port: number): Promise<void> {
    return new Promise(resolve => {
      this._stateOperations.push({
        type: 'setRemotePort',
        port,
        timestamp: Date.now(),
        resolve
      });
      this.processStateOperations();
    });
  }
  async setSearchPath(path: string): Promise<void> {
    return new Promise(resolve => {
      this._stateOperations.push({
        type: 'setSearchPath',
        path,
        timestamp: Date.now(),
        resolve
      });
      this.processStateOperations();
    });
  }

  // Transitions
  /**
   * Transition to idle state
   */
  async enterIdle(): Promise<void> {
    return new Promise(resolve => {
      this._stateOperations.push({
        type: 'enterIdle',
        timestamp: Date.now(),
        resolve
      });
      this.processStateOperations();
    });
  }
  /**
   * Transition to karaoke state
   */
  async enterKaraoke(code: string, song: Song): Promise<void> {
    return new Promise(resolve => {
      this._stateOperations.push({
        type: 'enterKaraoke',
        code,
        song,
        timestamp: Date.now(),
        resolve
      });
      this.processStateOperations();
    });
  }

  // Utility
  /**
   * Reset state to defaults
   */
  async reset(): Promise<void> {
    return new Promise(resolve => {
      this._stateOperations.push({
        type: 'reset',
        timestamp: Date.now(),
        resolve
      });
      this.processStateOperations();
    });
  }
  /**
   * Get state snapshot (for debugging/export)
   */
  toJSON(): StateSnapshot {
    return {
      currentCode: this._currentCode,
      codeQueue: [...this._codeQueue],
      queueHistory: [...this._queueHistory],
      state: this._state,
      currentSong: this._currentSong ? { ...this._currentSong } : null,
      idleBackgroundPath: this._idleBackgroundPath,
      idleMode: this._idleMode,
      idleVideoFiles: [...this._idleVideoFiles],
      loopingMusicEnabled: this._loopingMusicEnabled,
      loopingMusicFiles: [...this._loopingMusicFiles],
      customFontPath: this._customFontPath,
      announceKeys: this._announceKeys,
      viewMode: this._viewMode,
      windowSize: { ...this._windowSize },
      karaokePort: this._karaokePort,
      remotePort: this._remotePort,
      searchPath: this._searchPath,
      lastUpdate: Date.now(),
      instanceId: this._instanceId,
      currentSignature: this._currentSignature,
    };
  }
  /**
   * Get queue length
   */
  get queueLength(): number {
    return this._codeQueue.length;
  }
  /**
   * Check if code is in queue
   */
  isInQueue(code: string): boolean {
    return this._codeQueue.includes(code);
  }
  /**
   * Get previous song code and remove from history
   */
  getPreviousSong(): string | null {
    // Remove current song from history if it's the last one
    if (this._queueHistory.length > 0 &&
        this._queueHistory[this._queueHistory.length - 1].code === this._currentCode) {
      this._queueHistory.pop();
    }

    // Get the previous song
    if (this._queueHistory.length > 0) {
      const prevEntry = this._queueHistory.pop();
      console.log('[AppState] Previous song:', prevEntry?.code);
      return prevEntry?.code || null;
    }

    console.log('[AppState] No previous song in history');
    return null;
  }
  // Karaoke Viewer Lock
  async acquireKaraokeViewer(): Promise<boolean> {
    return new Promise(resolve => {
      this._stateOperations.push({
        type: 'acquireKaraokeViewer',
        timestamp: Date.now(),
        resolve
      });
      this.processStateOperations();
    });
  }
  async releaseKaraokeViewer(): Promise<void> {
    return new Promise(resolve => {
      this._stateOperations.push({
        type: 'releaseKaraokeViewer',
        timestamp: Date.now(),
        resolve
      });
      this.processStateOperations();
    });
  }
  get isKaraokeViewerActive(): boolean {
    return this._activeKaraokeViewer;
  }
  /**
   * Signature
   */
  get signature(): string {
    return this._currentSignature;
  }
}

// Single Instance
export const appState = new KaraokeAppState();

// Init
export async function initializeAppState(): Promise<boolean> {
  console.log('[AppState] Initializing...');
  // Check for single instance
  const isSingleInstance = await appState.checkSingleInstance();
  if (!isSingleInstance) {
    console.error('[AppState] ✗ Another instance is already running!');
    return false;
  }
  // Load saved state
  await appState.loadState();
  // Setup cleanup on app quit
  app.on('quit', async () => {
    console.log('[AppState] App quitting, saving state...');
    await appState.forceSave();
    await appState.releaseLock();
  });
  // Handle unexpected crashes
  process.on('uncaughtException', async (err) => {
    console.error('[AppState] Uncaught exception:', err);
    await appState.forceSave();
    await appState.releaseLock();
  });
  process.on('SIGINT', async () => {
    console.log('[AppState] SIGINT received');
    await appState.forceSave();
    await appState.releaseLock();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    console.log('[AppState] SIGTERM received');
    await appState.forceSave();
    await appState.releaseLock();
    process.exit(0);
  });
  console.log('[AppState] ✓ Initialized successfully');
  return true;
}
