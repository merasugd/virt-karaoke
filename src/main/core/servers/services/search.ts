// ────────── Search Service ──────────

import ytSearch from 'yt-search';

// Search multiple sources for a song
export async function searchSourcesForSong(query: string) {
  const allResults: Array<{ title: string; artist: string; source: string }> = [];

  // Helper to avoid duplicates
  const addUniqueResult = (title: string, artist: string, source: string) => {
    const normalized = {
      title: title.trim().toLowerCase(),
      artist: artist.trim().toLowerCase()
    };

    const isDuplicate = allResults.some(r =>
      r.title.toLowerCase() === normalized.title &&
      r.artist.toLowerCase() === normalized.artist
    );

    if (!isDuplicate && title && artist) {
      allResults.push({ title: title.trim(), artist: artist.trim(), source });
    }
  };

  // Search MusicBrainz
  try {
    console.log(`[search] Searching MusicBrainz for: ${query}`);
    const musicBrainzUrl = `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(query)}&fmt=json&limit=20`;

    const response = await fetch(musicBrainzUrl, {
      headers: {
        'User-Agent': 'KaraokeApp/1.0.0 (your-email@example.com)'
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (data.recordings && data.recordings.length > 0) {
        data.recordings.forEach((recording: any) => {
          const title = recording.title;
          const artist = recording['artist-credit']?.[0]?.name || 'Unknown Artist';
          addUniqueResult(title, artist, 'MusicBrainz');
        });
      }
      console.log(`[search] MusicBrainz: Found ${data.recordings?.length || 0} results`);
    }
  } catch (error) {
    console.error('[search] MusicBrainz failed:', error);
  }

  // Search iTunes
  try {
    console.log(`[search] Searching iTunes for: ${query}`);
    const iTunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=20`;

    const response = await fetch(iTunesUrl);

    if (response.ok) {
      const data = await response.json();
      if (data.results && data.results.length > 0) {
        data.results.forEach((track: any) => {
          const title = track.trackName;
          const artist = track.artistName;
          addUniqueResult(title, artist, 'iTunes');
        });
      }
      console.log(`[search] iTunes: Found ${data.results?.length || 0} results`);
    }
  } catch (error) {
    console.error('[search] iTunes failed:', error);
  }

  // Search YouTube
  try {
    console.log(`[search] Searching YouTube for: ${query}`);
    const ytResults = await ytSearch(query);

    if (ytResults.videos && ytResults.videos.length > 0) {
      ytResults.videos.slice(0, 20).forEach(video => {
        const titleParts = video.title.split(/\s*-\s*/);

        if (titleParts.length >= 2) {
          const title = titleParts[0].trim();
          const artist = titleParts[1].replace(/\(.*?\)/g, '').replace(/karaoke/gi, '').trim();
          addUniqueResult(title, artist, 'YouTube');
        } else {
          const title = video.title.replace(/karaoke/gi, '').trim();
          const artist = video.author?.name || 'Unknown Artist';
          addUniqueResult(title, artist, 'YouTube');
        }
      });
      console.log(`[search] YouTube: Found ${ytResults.videos.length} results`);
    }
  } catch (error) {
    console.error('[search] YouTube failed:', error);
  }

  console.log(`[search] Total unique results: ${allResults.length}`);

  // Prioritize: MusicBrainz and iTunes first, then YouTube
  const sortedResults = allResults.sort((a, b) => {
    const sourceOrder = { 'MusicBrainz': 0, 'iTunes': 1, 'YouTube': 2 };
    return sourceOrder[a.source] - sourceOrder[b.source];
  });

  // Return without source field
  return sortedResults.map(({ title, artist }) => ({ title, artist }));
}
