/**
 * Orchestrates all venue scrapers with Bandsintown fallback.
 */
const config = require('../config');
const log = require('../utils/logger');
const { scrapeVenue: scrapeGeneric } = require('./generic');
const bandsintown = require('./bandsintown');

// Map venue slugs to custom scrapers
const customScrapers = {
  'brooklyn-paramount': require('./venues/brooklyn-paramount'),
  'brooklyn-steel': require('./venues/brooklyn-steel'),
  'music-hall-of-williamsburg': require('./venues/music-hall-of-williamsburg'),
  'brooklyn-bowl': require('./venues/brooklyn-bowl'),
  'warsaw': require('./venues/warsaw'),
  'sony-hall': require('./venues/sony-hall'),
  'webster-hall': require('./venues/webster-hall'),
  'le-poisson-rouge': require('./venues/le-poisson-rouge'),
  'national-sawdust': require('./venues/national-sawdust'),
  'nublu': require('./venues/nublu'),
};

async function scrapeAllVenues() {
  const allEvents = [];
  const results = { success: [], fallback: [], failed: [] };

  for (const venue of config.venues) {
    log.info(`Scraping ${venue.name}...`);
    let events = null;

    // Try custom scraper first
    const custom = customScrapers[venue.slug];
    if (custom) {
      events = await custom.scrape(venue);
    }

    // If custom scraper returned nothing useful, try generic
    if (!events || events.length === 0) {
      log.info(`  Custom scraper got 0 results, trying generic for ${venue.name}`);
      events = await scrapeGeneric(venue);
    }

    // If scraping failed or returned nothing, fall back to Bandsintown
    if (!events || events.length === 0) {
      log.info(`  Scraping got 0 results, falling back to Bandsintown for ${venue.name}`);
      events = await bandsintown.fetchVenueEvents(venue);
      if (events.length > 0) {
        results.fallback.push(venue.name);
      } else {
        results.failed.push(venue.name);
      }
    } else {
      results.success.push(venue.name);
    }

    // Filter junk entries and deduplicate
    const junkPatterns = /^(events? list|upcoming shows?|closed|open for bowling|buy tickets?|vip bowling|bowlin'|lpr presents?|p91|upcoming events?)$/i;
    const seen = new Set();
    const dedupedEvents = events.filter((e) => {
      if (!e.artist || e.artist.length < 3) return false;
      if (junkPatterns.test(e.artist.trim())) return false;
      const key = `${e.artist.toLowerCase()}-${e.date}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    allEvents.push(...dedupedEvents);
    log.ok(`  ${venue.name}: ${dedupedEvents.length} events`);
  }

  log.info('\n--- Scrape Summary ---');
  log.ok(`Scraped: ${results.success.join(', ') || 'none'}`);
  if (results.fallback.length) log.warn(`Bandsintown fallback: ${results.fallback.join(', ')}`);
  if (results.failed.length) log.err(`No events found: ${results.failed.join(', ')}`);
  log.info(`Total events: ${allEvents.length}\n`);

  return allEvents;
}

module.exports = { scrapeAllVenues };
