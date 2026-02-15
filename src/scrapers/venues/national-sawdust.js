const cheerio = require('cheerio');
const { fetchHTML } = require('../../utils/http');
const log = require('../../utils/logger');

async function scrape(venue) {
  try {
    const html = await fetchHTML('https://nationalsawdust.org/events');
    const $ = cheerio.load(html);
    const events = [];

    $('.event, .event-item, .event-card, [class*="event"], article, .performance').each((_, el) => {
      const $el = $(el);
      const artist =
        $el.find('.event-title, .event-name, h2, h3, .title, .headliner, .performance-title').first().text().trim();
      const dateRaw =
        $el.find('.event-date, .date, time, [datetime], .performance-date').first();
      const date = dateRaw.attr('datetime') || dateRaw.text().trim();
      const time =
        $el.find('.event-time, .time, .doors, .performance-time').first().text().trim();
      const price =
        $el.find('.price').first().text().trim();
      const ticketUrl =
        $el.find('a[href*="ticket"]').attr('href') ||
        $el.find('a').attr('href') || '';

      if (artist && artist.length > 1) {
        events.push({
          artist,
          date: normalizeDate(date),
          time,
          price,
          ticketUrl: resolveUrl(ticketUrl),
          venue: venue.name,
          source: 'scrape',
        });
      }
    });

    return events;
  } catch (err) {
    log.warn(`National Sawdust scrape failed: ${err.message}`);
    return null;
  }
}

function normalizeDate(raw) {
  if (!raw) return '';
  const iso = raw.match(/\d{4}-\d{2}-\d{2}/);
  if (iso) return iso[0];
  try {
    const d = new Date(raw);
    if (!isNaN(d)) return d.toISOString().split('T')[0];
  } catch {}
  return raw;
}

function resolveUrl(href) {
  if (!href) return '';
  if (href.startsWith('http')) return href;
  return `https://nationalsawdust.org${href}`;
}

module.exports = { scrape };
