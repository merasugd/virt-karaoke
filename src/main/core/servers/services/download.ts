// ────────── Download Service ──────────

import fs from 'fs';
import path from 'path';
import ytSearch from 'yt-search';
import youtubedl from '../../../binaries/ytdlp';
import { additional_songs } from '../../utils/paths';
import { broadcastDownloadProgress } from '../../utils/state';

// Ensure downloads directory exists
const downloadsDir = additional_songs;
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

// Track active downloads
export const activeDownloads = new Map();

// Download a karaoke song from YouTube
export async function downloadKaraokeSong(downloadId: string, title: string, artist: string) {
  try {
    console.log(`[download] Starting download for: ${title} - ${artist}`);

    // Update status to searching
    broadcastDownloadProgress(downloadId, 0, 'searching');

    // Search for karaoke version
    const searchQuery = `${title} ${artist} karaoke`;
    console.log(`[download] Searching YouTube for: ${searchQuery}`);

    const searchResults = await ytSearch(searchQuery);

    if (!searchResults.videos || searchResults.videos.length === 0) {
      throw new Error('No karaoke videos found');
    }

    // Filter for preferred channels
    const filteredResults = searchResults.videos.filter(v =>
      v.author.name.toLowerCase().includes('my all time karaoke') ||
      v.author.name.toLowerCase().includes('coversph') ||
      v.author.name.toLowerCase().includes('atomic karaoke')
    );

    // Find the best match
    let bestMatch = filteredResults.find(v =>
      v.title.toLowerCase().includes('karaoke') &&
      v.title.toLowerCase().includes(title.toLowerCase())
    ) || searchResults.videos.find(v =>
      v.title.toLowerCase().includes('karaoke') &&
      v.title.toLowerCase().includes(title.toLowerCase())
    );

    if (!bestMatch) {
      bestMatch = searchResults.videos[0];
    }

    const videoUrl = bestMatch.url;
    const videoTitle = bestMatch.title;

    console.log(`[download] Found video: ${videoTitle}`);
    console.log(`[download] URL: ${videoUrl}`);

    // Validate video title
    if (!videoTitle.toLowerCase().includes(title.toLowerCase())) {
      console.warn(`[download] Video title doesn't match song title closely`);
    }

    // Update status with video title
    broadcastDownloadProgress(downloadId, 5, 'downloading', videoTitle);

    // Sanitize filename
    const sanitizedTitle = title.replace(/[^a-z0-9]/gi, '_');
    const sanitizedArtist = artist.replace(/[^a-z0-9]/gi, '_');
    const filename = `${sanitizedTitle} - ${sanitizedArtist}.mp4`;
    const outputPath = path.join(downloadsDir, filename);

    // Download with youtube-dl
    console.log(`[download] Downloading to: ${outputPath}`);

    const downloadPromise = youtubedl(videoUrl, {
      output: outputPath,
      format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      mergeOutputFormat: 'mp4',
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
      addMetadata: true,
    });

    // Track progress
    let lastProgress = 5;
    const progressInterval = setInterval(() => {
      if (lastProgress < 95) {
        lastProgress += 5;
        broadcastDownloadProgress(downloadId, lastProgress, 'downloading', videoTitle);
      }
    }, 2000);

    // Wait for download to complete
    await downloadPromise;
    clearInterval(progressInterval);

    console.log(`[download] Download complete: ${filename}`);

    // Final progress update
    broadcastDownloadProgress(downloadId, 100, 'complete', videoTitle, filename);

    // Clean up from active downloads
    setTimeout(() => {
      activeDownloads.delete(downloadId);
    }, 5000);

    return { success: true, filename, videoTitle };

  } catch (error) {
    console.error(`[download] Error downloading ${title}:`, error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    broadcastDownloadProgress(downloadId, 0, 'error', undefined, undefined, errorMessage);

    activeDownloads.delete(downloadId);

    return { success: false, error: errorMessage };
  }
}

// Get list of downloaded songs
export function getDownloadedSongs() {
  const files = fs.readdirSync(downloadsDir);

  const songs = files
    .filter(file => file.endsWith('.mp4'))
    .map(filename => {
      const nameWithoutExt = filename.replace('.mp4', '');
      const parts = nameWithoutExt.split(' - ');

      const title = parts[0]?.replace(/_/g, ' ') || 'Unknown Title';
      const artist = parts[1]?.replace(/_/g, ' ') || 'Unknown Artist';

      return {
        filename,
        title,
        artist,
        path: path.join(downloadsDir, filename)
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));

  return songs;
}

// Delete a downloaded song
export function deleteDownloadedSong(filename: string): void {
  // Security check
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new Error('Invalid filename');
  }

  const filePath = path.join(downloadsDir, filename);

  if (!fs.existsSync(filePath)) {
    throw new Error('File not found');
  }

  fs.unlinkSync(filePath);
  console.log('[download] Song deleted successfully:', filename);
}
