/**
 * Bandsintown fallback — queries events by venue name.
 */
const { fetchJSON } = require('../utils/http');
const config = require('../config');
const log = require('../utils/logger');

const BASE = 'https://rest.bandsintown.com';

async function fetchVenueEvents(venue) {
  const appId = config.bandsintown.apiKey;
  if (!appId) {
    log.warn(`No Bandsintown API key — skipping fallback for ${venue.name}`);
    return [];
  }

  try {
    // Bandsintown v3: search events by venue via artist search + location filter
    // Since there's no direct venue endpoint in public API, we search for the venue name
    // as a "location" query against the events endpoint
    const url = `${BASE}/artists/events`;

    // Alternative approach: use the venue search via undocumented endpoint
    // We'll try a few known artists that commonly play these venues
    // Falling back to a location-based search
    const searchUrl = `https://rest.bandsintown.com/v4/venues/search`;
    const events = [];

    try {
      const venueData = await fetchJSON(searchUrl, {
        query: venue.bandsintownId,
        app_id: appId,
      });

      if (Array.isArray(venueData) && venueData.length > 0) {
        const venueId = venueData[0].id;
        const eventsData = await fetchJSON(
          `https://rest.bandsintown.com/v4/venues/${venueId}/events`,
          { app_id: appId }
        );

        if (Array.isArray(eventsData)) {
          for (const e of eventsData) {
            events.push({
              artist: e.artist?.name || e.lineup?.[0] || 'Unknown',
              date: e.datetime?.split('T')[0] || '',
              time: e.datetime?.split('T')[1]?.slice(0, 5) || '',
              price: e.offers?.[0]?.status === 'available' ? 'See link' : '',
              ticketUrl: e.offers?.[0]?.url || e.url || '',
              venue: venue.name,
              source: 'bandsintown',
            });
          }
        }
      }
    } catch {
      // v4 endpoint may not be available, try v3 artist-based approach
      log.warn(`Bandsintown v4 failed for ${venue.name}, trying artist search`);
    }

    if (events.length === 0) {
      // Fallback: search by encoding venue name as an artist query
      // This is a known workaround
      const encodedVenue = encodeURIComponent(venue.bandsintownId);
      try {
        const artistEvents = await fetchJSON(
          `${BASE}/artists/${encodedVenue}/events`,
          { app_id: appId, date: 'upcoming' }
        );

        if (Array.isArray(artistEvents)) {
          for (const e of artistEvents) {
            events.push({
              artist: e.lineup?.[0] || e.artist?.name || venue.bandsintownId,
              date: e.datetime?.split('T')[0] || '',
              time: e.datetime?.split('T')[1]?.slice(0, 5) || '',
              price: '',
              ticketUrl: e.offers?.[0]?.url || e.url || '',
              venue: venue.name,
              source: 'bandsintown',
            });
          }
        }
      } catch {
        log.warn(`Bandsintown artist fallback also failed for ${venue.name}`);
      }
    }

    return events;
  } catch (err) {
    log.warn(`Bandsintown error for ${venue.name}: ${err.message}`);
    return [];
  }
}

module.exports = { fetchVenueEvents };
