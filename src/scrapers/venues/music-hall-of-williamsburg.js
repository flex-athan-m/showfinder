const cheerio = require('cheerio');
const { fetchHTML } = require('../../utils/http');
const log = require('../../utils/logger');

async function scrape(venue) {
  try {
    const html = await fetchHTML('https://www.musichallofwilliamsburg.com/events');
    const $ = cheerio.load(html);
    const events = [];

    // Music Hall of Williamsburg is also BFR Presents
    $('.event-card, .event-item, .show, [class*="event"], article').each((_, el) => {
      const $el = $(el);
      const artist =
        $el.find('.event-name, .artist-name, h3, h2, .title').first().text().trim();
      const dateRaw =
        $el.find('.event-date, .date, time, [datetime]').first();
      const date = dateRaw.attr('datetime') || dateRaw.text().trim();
      const time =
        $el.find('.event-time, .time, .doors').first().text().trim();
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
    log.warn(`Music Hall of Williamsburg scrape failed: ${err.message}`);
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
  return `https://www.musichallofwilliamsburg.com${href}`;
}

module.exports = { scrape };
