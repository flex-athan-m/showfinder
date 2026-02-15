const cheerio = require('cheerio');
const { fetchHTML } = require('../../utils/http');
const log = require('../../utils/logger');

async function scrape(venue) {
  try {
    const html = await fetchHTML('https://www.brooklynparamount.com/events');
    const $ = cheerio.load(html);
    const events = [];

    // Brooklyn Paramount uses a common event listing pattern
    $('.eventItem, .event-item, [class*="EventItem"], .event-listing .event, article').each((_, el) => {
      const $el = $(el);
      const artist =
        $el.find('.eventItem-title, .event-title, h2, h3, .title, .headliner').first().text().trim();
      const dateRaw =
        $el.find('.eventItem-date, .event-date, time, [datetime], .date').first();
      const date = dateRaw.attr('datetime') || dateRaw.text().trim();
      const time =
        $el.find('.eventItem-time, .event-time, .time, .doors').first().text().trim();
      const price =
        $el.find('.eventItem-price, .price').first().text().trim();
      const ticketUrl =
        $el.find('a[href*="ticket"], a[href*="event"]').attr('href') ||
        $el.find('a').attr('href') || '';

      if (artist && artist.length > 1) {
        events.push({
          artist,
          date: normalizeDate(date),
          time,
          price,
          ticketUrl: ticketUrl.startsWith('http') ? ticketUrl : `https://www.brooklynparamount.com${ticketUrl}`,
          venue: venue.name,
          source: 'scrape',
        });
      }
    });

    return events;
  } catch (err) {
    log.warn(`Brooklyn Paramount scrape failed: ${err.message}`);
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

module.exports = { scrape };
