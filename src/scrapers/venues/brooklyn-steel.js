const cheerio = require('cheerio');
const { fetchHTML } = require('../../utils/http');
const log = require('../../utils/logger');

async function scrape(venue) {
  try {
    const html = await fetchHTML('https://www.bfrpresents.com/venues/brooklyn-steel');
    const $ = cheerio.load(html);
    const events = [];

    // BFR Presents / Brooklyn Steel pattern
    $('.event-card, .event-item, .show, .eventWrapper, [class*="event"]').each((_, el) => {
      const $el = $(el);
      const artist =
        $el.find('.event-name, .artist-name, h3, h2, .title, .headliner').first().text().trim();
      const dateRaw =
        $el.find('.event-date, .date, time, [datetime]').first();
      const date = dateRaw.attr('datetime') || dateRaw.text().trim();
      const time =
        $el.find('.event-time, .time, .doors').first().text().trim();
      const price =
        $el.find('.price, .event-price').first().text().trim();
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
    log.warn(`Brooklyn Steel scrape failed: ${err.message}`);
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
  return `https://www.bfrpresents.com${href}`;
}

module.exports = { scrape };
