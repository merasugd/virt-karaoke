// ────────── App Paths ──────────

import { app } from 'electron';
import { existsSync, mkdirSync, statSync, unlinkSync } from 'node:fs';
import path from 'node:path';

// Initiate global paths
export const user_data = app.getPath('userData');
export const main_path = path.join(user_data, 'AppData');
export const additional_songs = path.join(main_path, 'additional_songs');
export const libraries = path.join(user_data, 'Libraries');

// Ensure all paths exists
[
  user_data,
  main_path,
  additional_songs,
  libraries
].forEach(folder => {
  if (!existsSync(folder)) {
    mkdirSync(folder, { recursive: true });
  } else if (!statSync(folder).isDirectory()) {
    unlinkSync(folder);
    mkdirSync(folder, { recursive: true });
  };
})
