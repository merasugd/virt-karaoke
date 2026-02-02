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
    const filename = (`${sanitizedTitle} - ${sanitizedArtist}.mp4`).replaceAll(' ', '_');
    const outputPath = path.join(downloadsDir, filename);

    // Download with youtube-dl
    console.log(`[download] Downloading to: ${outputPath}`);
    console.log(`[download] Video URL: ${videoUrl}`);

    const downloadPromise = youtubedl(videoUrl, {
      output: outputPath,
      format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      mergeOutputFormat: 'mp4',
      noCheckCertificates: true,
      noWarnings: false, // Enable warnings to see what's happening
      preferFreeFormats: true,
      verbose: true,
      addMetadata: true,
      restrictFilenames: true, // Restrict filenames to ASCII characters
      noOverwrites: false, // Allow overwrites
      forceOverwrites: true, // Force overwrite existing files
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
    let downloadResult;
    try {
      downloadResult = await downloadPromise;
      console.log('[download] yt-dlp completed successfully');
      console.log('[download] Download result:', downloadResult);
    } catch (dlError) {
      clearInterval(progressInterval);
      console.error('[download] yt-dlp error:', dlError);
      throw dlError;
    }

    clearInterval(progressInterval);

    // Wait a bit for file system to sync
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check for the file with various possible extensions
    const possibleFiles = [
      outputPath,
      outputPath.replace('.mp4', '.webm'),
      outputPath.replace('.mp4', '.mkv'),
    ];

    let actualFile: string | null = null;
    for (const filePath of possibleFiles) {
      if (fs.existsSync(filePath)) {
        actualFile = filePath;
        console.log(`[download] Found file: ${filePath}`);
        break;
      }
    }

    // Also check the downloads directory for any new files
    if (!actualFile) {
      console.log('[download] Checking directory for new files...');
      const files = fs.readdirSync(downloadsDir);
      console.log('[download] Files in directory:', files);

      // Look for files that might match
      const searchPattern = sanitizedTitle.substring(0, 20); // First 20 chars of title
      const matchingFiles = files.filter(f =>
        f.includes(searchPattern) &&
        (f.endsWith('.mp4') || f.endsWith('.webm') || f.endsWith('.mkv'))
      );

      if (matchingFiles.length > 0) {
        actualFile = path.join(downloadsDir, matchingFiles[0]);
        console.log(`[download] Found matching file: ${actualFile}`);
      }
    }

    // Validate the downloaded file exists and has content
    if (!actualFile || !fs.existsSync(actualFile)) {
      console.error('[download] File not found at expected location');
      console.error('[download] Expected:', outputPath);
      console.error('[download] Downloads directory:', downloadsDir);
      console.error('[download] Directory contents:', fs.readdirSync(downloadsDir));
      throw new Error('The downloaded file does not exist. yt-dlp may have failed silently.');
    }

    const fileStats = fs.statSync(actualFile);
    if (fileStats.size === 0) {
      // Delete the empty file
      fs.unlinkSync(actualFile);
      throw new Error('The downloaded file is empty. This may be due to YouTube restrictions or the video being unavailable.');
    }

    console.log(`[download] Download complete: ${path.basename(actualFile)} (${(fileStats.size / 1024 / 1024).toFixed(2)} MB)`);

    // If the actual file is different from expected, rename it
    const finalFilename = path.basename(actualFile);
    if (actualFile !== outputPath && actualFile.endsWith('.mp4')) {
      try {
        fs.renameSync(actualFile, outputPath);
        console.log(`[download] Renamed ${actualFile} to ${outputPath}`);
      } catch (renameErr) {
        console.warn('[download] Could not rename file:', renameErr);
        // Use the actual filename instead
      }
    }

    // Final progress update
    broadcastDownloadProgress(downloadId, 100, 'complete', videoTitle, finalFilename);

    // Clean up from active downloads immediately
    activeDownloads.delete(downloadId);

    return { success: true, filename: finalFilename, videoTitle };

  } catch (error) {
    console.error(`[download] Error downloading ${title}:`, error);
    let errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('HTTP Error 403') || errorMessage.includes('Forbidden')) {
      errorMessage = 'Download failed: YouTube blocked the download (HTTP 403 Forbidden). This usually means:\n\n' +
                    '1. No JavaScript runtime installed (Node.js required for YouTube downloads)\n' +
                    '2. Video may be age-restricted or region-locked\n' +
                    '3. YouTube cookies may have expired\n\n' +
                    'SOLUTION: Install Node.js from https://nodejs.org and restart the app.';
    } else if (errorMessage.includes('Signature solving failed') || errorMessage.includes('JS runtimes: none')) {
      errorMessage = 'Download failed: JavaScript runtime required but not found.\n\n' +
                    'YouTube downloads require Node.js, Deno, Bun, or QuickJS to decrypt video URLs.\n\n' +
                    'SOLUTION: Install Node.js from https://nodejs.org and restart the app.';
    } else if (errorMessage.includes('The downloaded file is empty')) {
      errorMessage = 'Download completed but the file is empty. This usually means:\n\n' +
                    '1. All video fragments failed to download (likely due to missing JavaScript runtime)\n' +
                    '2. Video may be restricted or unavailable\n\n' +
                    'SOLUTION: Install Node.js from https://nodejs.org and restart the app.';
    }

    broadcastDownloadProgress(downloadId, 0, 'error', undefined, undefined, errorMessage);

    // Clean up from active downloads
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
