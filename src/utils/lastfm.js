/**
 * Music metadata utilities — genre tags from MusicBrainz, similar artists from Deezer.
 * Both APIs are free and require no API key.
 */
const axios = require('axios');
const log = require('./logger');

const MB_BASE = 'https://musicbrainz.org/ws/2';
const MB_UA = 'Showfinder/1.0 (https://github.com/flex-athan-m/showfinder)';
const DEEZER_BASE = 'https://api.deezer.com';

// In-memory caches
const tagsCache = new Map();
const similarCache = new Map();

// MusicBrainz enforces 1 request/sec — throttle accordingly
let lastMbReq = 0;
async function mbThrottle() {
  const wait = Math.max(0, 1500 - (Date.now() - lastMbReq));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastMbReq = Date.now();
}

/**
 * Fetch genre tags for an artist via MusicBrainz.
 * Returns up to 10 lowercased tag strings.
 */
async function getArtistTags(artistName) {
  const key = artistName.toLowerCase();
  if (tagsCache.has(key)) return tagsCache.get(key);

  try {
    await mbThrottle();
    const { data } = await axios.get(`${MB_BASE}/artist/`, {
      params: { query: `artist:"${artistName}"`, fmt: 'json', limit: 1 },
      headers: { 'User-Agent': MB_UA, Accept: 'application/json' },
      timeout: 10000,
    });

    const artist = data.artists?.[0];
    const tags = (artist?.tags || [])
      .sort((a, b) => (b.count || 0) - (a.count || 0))
      .slice(0, 10)
      .map((t) => t.name.toLowerCase());

    tagsCache.set(key, tags);
    return tags;
  } catch (err) {
    log.warn(`MusicBrainz tags failed for "${artistName}": ${err.message}`);
    tagsCache.set(key, []);
    return [];
  }
}

/**
 * Fetch similar artists via Deezer (search + related endpoint).
 * Returns up to 20 lowercased artist name strings.
 */
async function getSimilarArtists(artistName) {
  const key = artistName.toLowerCase();
  if (similarCache.has(key)) return similarCache.get(key);

  try {
    const search = await axios.get(`${DEEZER_BASE}/search/artist`, {
      params: { q: artistName },
      headers: { Accept: 'application/json' },
      timeout: 10000,
    });

    const artist = search.data?.data?.[0];
    if (!artist) {
      similarCache.set(key, []);
      return [];
    }

    const related = await axios.get(`${DEEZER_BASE}/artist/${artist.id}/related`, {
      headers: { Accept: 'application/json' },
      timeout: 10000,
    });

    const names = (related.data?.data || [])
      .slice(0, 20)
      .map((a) => a.name.toLowerCase());

    similarCache.set(key, names);
    return names;
  } catch (err) {
    log.warn(`Deezer similar failed for "${artistName}": ${err.message}`);
    similarCache.set(key, []);
    return [];
  }
}

module.exports = { getArtistTags, getSimilarArtists };
