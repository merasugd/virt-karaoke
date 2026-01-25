// ────────── App Settings ──────────

import fs from 'fs';
import path from 'path';
import { main_path } from './core/utils/paths';
export interface AppSettings {
  backgroundPath?: string;
  idleMode?: 'image' | 'video';
  idleVideoFiles?: string[];
  loopingMusic?: boolean;
  musicFiles?: string[];
  customFont?: string;
  viewMode?: 'fullscreen' | 'borderless' | 'windowed';
  windowSize?: { width: number; height: number };
  lanPort?: number;
  remotePort?: number;
  searchPath?: string;
  announceKeys?: boolean;
}
const DEFAULT_SETTINGS: AppSettings = {
  backgroundPath: '',
  idleMode: 'image',
  idleVideoFiles: [],
  loopingMusic: false,
  musicFiles: [],
  customFont: '',
  viewMode: 'fullscreen',
  windowSize: { width: 1920, height: 1080 },
  lanPort: 4545,
  remotePort: 4646,
  searchPath: undefined,
  announceKeys: true,
};
export class Settings {
  private static instance: Settings;
  private filePath: string;
  private data: AppSettings;
  private constructor() {
    this.filePath = path.join(main_path, 'config.json');
    this.data = this.load();
  }
  public static getInstance(): Settings {
    if (!Settings.instance) {
      Settings.instance = new Settings();
    }
    return Settings.instance;
  }
  private load(): AppSettings {
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(content);
        // Basic validation / defaults merging
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          windowSize: parsed.windowSize
            ? { ...DEFAULT_SETTINGS.windowSize, ...parsed.windowSize }
            : DEFAULT_SETTINGS.windowSize,
          musicFiles: Array.isArray(parsed.musicFiles) ? parsed.musicFiles : [],
          idleVideoFiles: Array.isArray(parsed.idleVideoFiles) ? parsed.idleVideoFiles : [],
        };
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
    return { ...DEFAULT_SETTINGS };
  }
  public save(): void {
    try {
      // Make sure the directory exists
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(
        this.filePath,
        JSON.stringify(this.data, null, 2),
        'utf-8'
      );
      console.log('Settings saved to:', this.filePath);
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  }
  public get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.data[key];
  }
  public set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    this.data[key] = value;
    this.save();
  }
  public getAll(): AppSettings {
    return { ...this.data };
  }
  public update(partial: Partial<AppSettings>): void {
    this.data = { ...this.data, ...partial };
    this.save();
  }
  public reset(): void {
    this.data = { ...DEFAULT_SETTINGS };
    this.save();
  }
}
// Convenience export
export const settings = Settings.getInstance();
