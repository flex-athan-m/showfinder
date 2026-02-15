/**
 * Matching engine: scores each show 0-100 based on Spotify listening profile.
 *
 * Scoring tiers:
 *   95-100  Direct match to a top artist
 *   80-94   Related artist overlap
 *   60-79   Genre overlap
 *   40-59   Partial match (name similarity, recent plays)
 *   0-39    Weak or no match
 */
const SpotifyWebApi = require('spotify-web-api-node');
const config = require('./config');
const log = require('./utils/logger');
const { getArtistTags, getSimilarArtists } = require('./utils/lastfm');

// Cache for Spotify API lookups to avoid repeated calls
const artistCache = new Map();

function getApi() {
  return new SpotifyWebApi({
    clientId: config.spotify.clientId,
    clientSecret: config.spotify.clientSecret,
    redirectUri: config.spotify.redirectUri,
    refreshToken: config.spotify.refreshToken,
  });
}

/**
 * Extract the core artist name from a scraped event title.
 * Strips tour names, "presents:", featured guests, etc.
 */
function extractArtistName(raw) {
  let name = raw;

  // Strip everything after common delimiters that indicate non-artist info
  name = name.replace(/\s*[-–—:]\s*(an all[- ]star|album release|performs?|presents?|tour|live|solo acoustic|ft\.?|feat\.?|w\/|with special).*/i, '');
  // Strip "w/ ..." or "feat. ..." at the end
  name = name.replace(/\s+(w\/|feat\.?|ft\.?|with)\s+.*/i, '');
  // Strip parenthetical descriptions
  name = name.replace(/\s*\(.*?\)\s*/g, ' ');
  // Strip leading "presents:" style prefixes
  name = name.replace(/^.*?presents?:?\s+/i, '');

  return name.trim();
}

/**
 * Score a single show against the user's Spotify profile.
 */
async function scoreShow(show, profile, api) {
  const cleanName = extractArtistName(show.artist);
  const artistLower = cleanName.toLowerCase().trim();
  const result = {
    ...show,
    score: 0,
    matchReason: '',
    spotifyArtistId: null,
    spotifyGenres: [],
  };

  // 1. Direct match against top artists (try both raw and cleaned name)
  const directMatch = profile.topArtists.find(
    (a) => {
      const pLower = a.name.toLowerCase();
      return pLower === artistLower || pLower === show.artist.toLowerCase().trim();
    }
  );
  if (directMatch) {
    const rank = directMatch.mediumRank || directMatch.longRank || 50;
    // Higher ranked = higher score within 95-100 range
    result.score = Math.min(100, 100 - Math.floor(rank / 10));
    result.score = Math.max(95, result.score);
    result.matchReason = `Direct match — #${rank} in your top artists`;
    result.spotifyArtistId = directMatch.id;
    result.spotifyGenres = directMatch.genres;
    return result;
  }

  // 2. Check recently played
  const recentMatch = profile.recentArtists.find(
    (a) => {
      const pLower = a.name.toLowerCase();
      return pLower === artistLower || pLower === show.artist.toLowerCase().trim();
    }
  );
  if (recentMatch) {
    result.score = 90;
    result.matchReason = 'Recently played artist';
    result.spotifyArtistId = recentMatch.id;
    return result;
  }

  // 3. Look up artist on Spotify for genre/related artist matching
  //    Uses Last.fm for genres and similar artists (Spotify blocks these in dev mode)
  let spotifyArtist = null;
  let relatedNames = [];

  if (artistCache.has(artistLower)) {
    const cached = artistCache.get(artistLower);
    spotifyArtist = cached.artist;
    relatedNames = cached.relatedNames;
  } else {
    try {
      const searchResult = await api.searchArtists(cleanName, { limit: 1 });
      const items = searchResult.body.artists?.items;
      if (items && items.length > 0) {
        spotifyArtist = items[0];
        result.spotifyArtistId = spotifyArtist.id;
        result.spotifyGenres = spotifyArtist.genres || [];

        // If Spotify returned empty genres, hydrate from Last.fm
        if (!result.spotifyGenres.length) {
          const tags = await getArtistTags(cleanName);
          result.spotifyGenres = tags;
          spotifyArtist.genres = tags;
        }

        // Fetch similar artists from Last.fm instead of Spotify
        relatedNames = await getSimilarArtists(cleanName);
      }
      artistCache.set(artistLower, { artist: spotifyArtist, relatedNames });
    } catch {
      // Search failed — can't score further
      artistCache.set(artistLower, { artist: null, relatedNames: [] });
    }
  }

  // 4. Related artist overlap (relatedNames are already lowercased from Last.fm)
  if (relatedNames.length > 0) {
    const myArtistNames = new Set(profile.artistNames);
    const overlapping = relatedNames.filter((name) => myArtistNames.has(name));

    if (overlapping.length >= 3) {
      result.score = 94;
      result.matchReason = `Related to ${overlapping.length} of your top artists: ${overlapping.slice(0, 3).join(', ')}`;
      return result;
    } else if (overlapping.length >= 1) {
      result.score = 80 + overlapping.length * 4;
      result.score = Math.min(94, result.score);
      result.matchReason = `Related to your artist${overlapping.length > 1 ? 's' : ''}: ${overlapping.join(', ')}`;
      return result;
    }
  }

  // 5. Genre overlap
  if (spotifyArtist && spotifyArtist.genres?.length > 0) {
    const myGenres = new Set(profile.genreList);
    const matchingGenres = spotifyArtist.genres.filter((g) => myGenres.has(g));

    if (matchingGenres.length >= 3) {
      result.score = 79;
      result.matchReason = `Strong genre match: ${matchingGenres.slice(0, 3).join(', ')}`;
      return result;
    } else if (matchingGenres.length >= 1) {
      result.score = 60 + matchingGenres.length * 8;
      result.score = Math.min(79, result.score);
      result.matchReason = `Genre match: ${matchingGenres.join(', ')}`;
      return result;
    }
  }

  // 6. Partial name match (substring matching for featured artists, side projects, etc.)
  // Also check against multi-artist show titles (e.g., "Teen Suicide Cloud Nothings, University")
  const showWords = show.artist.toLowerCase();
  const partialMatch = profile.artistNames.find(
    (name) => artistLower.includes(name) || name.includes(artistLower) || showWords.includes(name)
  );
  if (partialMatch) {
    result.score = 55;
    result.matchReason = `Partial name match with "${partialMatch}"`;
    return result;
  }

  // 7. Fuzzy genre: check if any of the artist's genres partially overlap
  if (spotifyArtist && spotifyArtist.genres?.length > 0) {
    const myGenreWords = new Set();
    profile.genreList.forEach((g) => g.split(/\s+/).forEach((w) => myGenreWords.add(w)));

    const fuzzyGenreMatches = spotifyArtist.genres.filter((g) =>
      g.split(/\s+/).some((w) => myGenreWords.has(w) && w.length > 3)
    );

    if (fuzzyGenreMatches.length > 0) {
      result.score = 40 + Math.min(19, fuzzyGenreMatches.length * 5);
      result.matchReason = `Fuzzy genre overlap: ${fuzzyGenreMatches.slice(0, 2).join(', ')}`;
      return result;
    }
  }

  // No meaningful match
  result.score = 0;
  result.matchReason = 'No match found';
  return result;
}

/**
 * Score all shows and return sorted by score descending.
 */
async function scoreAllShows(shows, profile) {
  const api = getApi();

  // Refresh token
  try {
    const data = await api.refreshAccessToken();
    api.setAccessToken(data.body.access_token);
  } catch (err) {
    log.err(`Failed to refresh Spotify token: ${err.message}`);
    log.warn('Scoring will work for direct/recent matches only');
  }

  log.info(`Scoring ${shows.length} shows against your profile...`);

  const scored = [];
  // Process in batches to avoid rate limits
  const BATCH_SIZE = 5;
  for (let i = 0; i < shows.length; i += BATCH_SIZE) {
    const batch = shows.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((show) => scoreShow(show, profile, api))
    );
    scored.push(...results);

    // Brief pause between batches to respect rate limits
    if (i + BATCH_SIZE < shows.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  scored.sort((a, b) => b.score - a.score);

  const matched = scored.filter((s) => s.score > 0);
  log.ok(`Scored: ${matched.length}/${scored.length} shows matched your profile`);

  return scored;
}

module.exports = { scoreAllShows, scoreShow };
