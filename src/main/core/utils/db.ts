/// ────────── Song Database ──────────

import fs from 'fs';
import path from 'path';
import { main_path } from './paths';

export interface Song {
  id: string;
  title: string;
  artist: string;
  isSkip?: boolean;
  path: string;
}

const DB_FILE = path.join(main_path, 'db.json');
const songs: Song[] = [];
let nextId = 1;

// Pad number to 6 digits with leading zeros
function padId(num: number): string {
  return num.toString().padStart(6, '0');
}

// Title Case function
function titleCase(str: string): string {
  return str
    .split(' ')
    .map(word => {
      if (word.toUpperCase() === word) return word; // preserve acronyms
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

// Parse title by filename
function parseFilename(filename: string): { title: string; artist: string } | null {
  // Remove extension
  let base = filename.replace(/\.(mp4)$/i, '');

  // Normalize underscores → spaces
  base = base.replace(/_+/g, ' ').trim();

  // Remove junk / karaoke / video tags
  const junkPatterns = [
    /\(.*?\)/g,               // (karaoke), (official video), etc.
    /\[.*?\]/g,               // [HD], [lyrics], etc.
    /\bkaraoke\b/gi,
    /\binstrumental\b/gi,
    /\bofficial\b/gi,
    /\blyrics?\b/gi,
    /\bvideo\b/gi,
    /\bhd\b/gi,
    /\bversion\b/gi,
  ];

  for (const pat of junkPatterns) {
    base = base.replace(pat, '').trim();
  }

  // Collapse multiple spaces
  base = base.replace(/\s{2,}/g, ' ').trim();

  // Split by dash (with spaces optional)
  const parts = base.split(/\s*-\s*/).filter(Boolean);

  if (parts.length < 2) {
    return {
      title: titleCase(base),
      artist: 'Unknown',
    };
  }

  // Format: Title - Artist
  let titleRaw: string;
  let artistRaw: string;
  titleRaw = parts[0];
  artistRaw = parts.slice(1).join(' - ');

  return {
    title: titleCase(titleRaw.trim()),
    artist: titleCase(artistRaw.trim()),
  };
}

// Initialize / load database
export function initializeDatabase(musicFolder: string[]): void {
  console.log(`Scanning for MP4 files in: ${musicFolder.join(', ')}`);

  songs.length = 0; // clear previous
  nextId = 1;

  function scanDir(dir: string) {
    let entries: string[];
    try {
      entries = fs.readdirSync(dir);
    } catch (err) {
      console.error(`Cannot read directory ${dir}:`, err);
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        scanDir(fullPath);
      } else if (stat.isFile() && entry.toLowerCase().endsWith('.mp4')) {
        const parsed = parseFilename(entry);
        if (parsed) {
          songs.push({
            id: padId(nextId++),
            title: parsed.title,
            artist: parsed.artist,
            path: fullPath,
          });
        } else {
          console.warn(`Could not parse filename: ${entry} → skipping`);
        }
      }
    }
  }

  musicFolder.filter(fs.existsSync).forEach(scanDir);

  // Sort by id (just in case)
  songs.sort((a, b) => a.id.localeCompare(b.id));

  // Save to JSON
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(songs, null, 2), 'utf-8');
    console.log(`Database initialized. Found ${songs.length} songs. Saved to ${DB_FILE}`);
  } catch (err) {
    console.error('Failed to save db.json:', err);
  }
}

// Load from disk if exists (for restarts)
function loadDatabase(): void {
  if (fs.existsSync(DB_FILE)) {
    try {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      const loaded = JSON.parse(data) as Song[];
      songs.push(...loaded);
      // Find next available ID
      if (loaded.length > 0) {
        const lastId = loaded[loaded.length - 1].id;
        nextId = parseInt(lastId, 10) + 1;
      }
      console.log(`Loaded ${songs.length} songs from db.json`);
    } catch (err) {
      console.error('Failed to load db.json — starting fresh:', err);
    }
  }
}

// Public API
export const db = {
  // Get all songs (sorted by id)
  list(): Song[] {
    return [...songs]; // return copy
  },

  // Check if song with this id exists
  has(id: string): boolean {
    return songs.some(s => s.id === id);
  },

  // Get song by id (6-digit string)
  get(id: string): Song | null {
    return songs.find(s => s.id === id) || null;
  },

  // Optional: force re-scan (e.g. new songs added)
  rescan(musicFolder: string): void {
    initializeDatabase([musicFolder]);
  },
};

// First try to load existing db.json
loadDatabase();
