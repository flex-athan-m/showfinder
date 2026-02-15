/**
 * Fetches Spotify listening profile and saves to data/spotify-profile.json.
 */
const fs = require('fs');
const path = require('path');
const SpotifyWebApi = require('spotify-web-api-node');
const config = require('./config');
const log = require('./utils/logger');

function getApi() {
  return new SpotifyWebApi({
    clientId: config.spotify.clientId,
    clientSecret: config.spotify.clientSecret,
    redirectUri: config.spotify.redirectUri,
    refreshToken: config.spotify.refreshToken,
  });
}

async function refreshAccessToken(api) {
  const data = await api.refreshAccessToken();
  api.setAccessToken(data.body.access_token);
  return api;
}

async function fetchProfile() {
  if (!config.spotify.refreshToken) {
    throw new Error('No Spotify refresh token. Run: npm run auth');
  }

  const api = getApi();
  await refreshAccessToken(api);
  log.info('Spotify token refreshed');

  // Fetch top artists (medium_term = ~6 months, long_term = all time)
  const [topMedium, topLong, recentlyPlayed] = await Promise.all([
    api.getMyTopArtists({ limit: 50, time_range: 'medium_term' }),
    api.getMyTopArtists({ limit: 50, time_range: 'long_term' }),
    api.getMyRecentlyPlayedTracks({ limit: 50 }),
  ]);

  const extractArtist = (a) => ({
    id: a.id,
    name: a.name,
    genres: a.genres || [],
    popularity: a.popularity,
    url: a.external_urls?.spotify,
  });

  const mediumArtists = topMedium.body.items.map(extractArtist);
  const longArtists = topLong.body.items.map(extractArtist);

  // Deduplicate and merge
  const artistMap = new Map();
  mediumArtists.forEach((a, i) => {
    artistMap.set(a.id, { ...a, mediumRank: i + 1 });
  });
  longArtists.forEach((a, i) => {
    const existing = artistMap.get(a.id);
    if (existing) {
      existing.longRank = i + 1;
    } else {
      artistMap.set(a.id, { ...a, longRank: i + 1 });
    }
  });

  let allArtists = Array.from(artistMap.values());

  // Hydrate genres via getArtists (batch endpoint, max 50 per call)
  // The top artists endpoint sometimes returns empty genres
  const artistIds = allArtists.map((a) => a.id);
  for (let i = 0; i < artistIds.length; i += 50) {
    const batch = artistIds.slice(i, i + 50);
    try {
      const details = await api.getArtists(batch);
      for (const artist of details.body.artists) {
        if (!artist) continue;
        const existing = artistMap.get(artist.id);
        if (existing && artist.genres?.length > 0) {
          existing.genres = artist.genres;
        }
      }
    } catch (err) {
      log.warn(`Failed to hydrate genres for batch ${i}: ${err.message}`);
    }
  }
  allArtists = Array.from(artistMap.values());

  // Extract genre frequency
  const genreCounts = {};
  allArtists.forEach((a) => {
    a.genres.forEach((g) => {
      genreCounts[g] = (genreCounts[g] || 0) + 1;
    });
  });
  const topGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([genre, count]) => ({ genre, count }));

  // Recently played artists
  const recentArtists = [];
  const seenRecent = new Set();
  for (const item of recentlyPlayed.body.items) {
    for (const artist of item.track.artists) {
      if (!seenRecent.has(artist.id)) {
        seenRecent.add(artist.id);
        recentArtists.push({ id: artist.id, name: artist.name });
      }
    }
  }

  const profile = {
    updatedAt: new Date().toISOString(),
    topArtists: allArtists,
    topGenres,
    recentArtists,
    artistNames: allArtists.map((a) => a.name.toLowerCase()),
    recentArtistNames: recentArtists.map((a) => a.name.toLowerCase()),
    genreList: topGenres.map((g) => g.genre),
  };

  const outPath = path.join(config.dataDir, 'spotify-profile.json');
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(profile, null, 2));
  log.ok(`Spotify profile saved (${allArtists.length} artists, ${topGenres.length} genres)`);

  return profile;
}

module.exports = { fetchProfile, getApi, refreshAccessToken };
