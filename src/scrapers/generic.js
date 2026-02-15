/**
 * Generic HTML scraper — tries common event page patterns using Cheerio.
 * Each venue can override with a custom extractor.
 */
const cheerio = require('cheerio');
const { fetchHTML } = require('../utils/http');
const log = require('../utils/logger');

/**
 * Attempt to extract events from HTML using common selectors.
 * Returns an array of { artist, date, time, price, ticketUrl }.
 */
function extractEventsGeneric($, venue) {
  const events = [];

  // Common patterns for event listings
  const selectors = [
    // Pattern 1: article/div with class containing 'event'
    '[class*="event"]',
    // Pattern 2: list items in event containers
    '.events-list li, .event-list li, .eventList li',
    // Pattern 3: cards
    '.event-card, .show-card, .event-item, .show-item',
    // Pattern 4: table rows
    '.event-listing tr, .shows-listing tr',
    // Pattern 5: generic article tags
    'article',
  ];

  for (const selector of selectors) {
    const elements = $(selector);
    if (elements.length === 0) continue;

    elements.each((_, el) => {
      const $el = $(el);
      const text = $el.text().trim();
      if (!text || text.length < 10) return;

      // Try to find an artist name
      const artist =
        $el.find('[class*="artist"], [class*="title"], [class*="name"], h2, h3, h4, .headliner').first().text().trim() ||
        $el.find('a').first().text().trim();

      if (!artist || artist.length < 2 || artist.length > 200) return;

      // Try to find a date
      const dateEl =
        $el.find('[class*="date"], time, [datetime]').first();
      let date = dateEl.attr('datetime') || dateEl.text().trim() || '';
      date = normalizeDate(date);

      // Try to find time
      const time =
        $el.find('[class*="time"], [class*="doors"]').first().text().trim() || '';

      // Try to find price
      const price =
        $el.find('[class*="price"], [class*="cost"]').first().text().trim() || '';

      // Try to find ticket link
      const ticketUrl =
        $el.find('a[href*="ticket"]').attr('href') ||
        $el.find('a[href*="event"]').attr('href') ||
        $el.find('a').attr('href') ||
        '';

      if (artist) {
        events.push({
          artist: cleanArtist(artist),
          date,
          time: cleanTime(time),
          price: cleanPrice(price),
          ticketUrl: resolveUrl(ticketUrl, venue.url),
          venue: venue.name,
          source: 'scrape',
        });
      }
    });

    // If we found events with this selector, stop trying others
    if (events.length > 0) break;
  }

  return events;
}

function cleanArtist(raw) {
  let name = raw
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Deduplicate repeated names like "Florist Florist" or "Gary Bartz Gary Bartz"
  const half = Math.floor(name.length / 2);
  const firstHalf = name.slice(0, half).trim();
  const secondHalf = name.slice(half).trim();
  if (firstHalf && firstHalf === secondHalf) {
    name = firstHalf;
  }

  // Strip common prefixes/suffixes
  name = name
    .replace(/^(presented by|live:|up next|lpr presents?|p91 \+ lpr presents?|monster energy outbreak presents:?)\s*/i, '')
    .replace(/\s*(tickets?|buy tickets?|on sale.*|sold out)$/i, '')
    .trim()
    .slice(0, 150);

  return name;
}

function cleanTime(raw) {
  const match = raw.match(/\d{1,2}:\d{2}\s*(am|pm|AM|PM)?/);
  return match ? match[0] : '';
}

function cleanPrice(raw) {
  const match = raw.match(/\$[\d,.]+/);
  return match ? match[0] : raw.replace(/\n/g, ' ').trim().slice(0, 30);
}

function normalizeDate(raw) {
  if (!raw) return '';
  // If it's already ISO-ish
  const isoMatch = raw.match(/(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];

  // Try parsing common formats
  try {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch {
    // fall through
  }
  return raw.trim().slice(0, 30);
}

function resolveUrl(href, baseUrl) {
  if (!href) return '';
  if (href.startsWith('http')) return href;
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

/**
 * Scrape a venue URL and return events.
 */
async function scrapeVenue(venue) {
  try {
    const html = await fetchHTML(venue.url);
    const $ = cheerio.load(html);
    const events = extractEventsGeneric($, venue);
    return events;
  } catch (err) {
    log.warn(`Scrape failed for ${venue.name}: ${err.message}`);
    return null; // null signals fallback needed
  }
}

module.exports = { scrapeVenue, extractEventsGeneric };
