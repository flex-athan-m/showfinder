const cheerio = require('cheerio');
const { fetchHTML } = require('../../utils/http');
const log = require('../../utils/logger');

async function scrape(venue) {
  try {
    const html = await fetchHTML('https://www.warsawconcerts.com/calendar');
    const $ = cheerio.load(html);
    const events = [];

    // Warsaw concerts listing
    $('.event, .event-item, .show, [class*="event"], article, .tw-section').each((_, el) => {
      const $el = $(el);
      const artist =
        $el.find('.event-name, .headliner, h2, h3, .title, .tw-name').first().text().trim();
      const dateRaw =
        $el.find('.event-date, .date, time, [datetime], .tw-date').first();
      const date = dateRaw.attr('datetime') || dateRaw.text().trim();
      const time =
        $el.find('.event-time, .time, .doors, .tw-time').first().text().trim();
      const price =
        $el.find('.price, .tw-price').first().text().trim();
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
    log.warn(`Warsaw scrape failed: ${err.message}`);
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
  return `https://www.warsawconcerts.com${href}`;
}

module.exports = { scrape };
