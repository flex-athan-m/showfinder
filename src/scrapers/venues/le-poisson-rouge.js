const cheerio = require('cheerio');
const { fetchHTML } = require('../../utils/http');
const log = require('../../utils/logger');

async function scrape(venue) {
  try {
    const html = await fetchHTML('https://lpr.com/events/');
    const $ = cheerio.load(html);
    const events = [];

    // LPR uses WordPress-style event listings
    $('.event, .event-item, .event-card, [class*="event"], .tribe-events-calendar-list__event-row, article').each((_, el) => {
      const $el = $(el);
      const artist =
        $el.find('.tribe-events-calendar-list__event-title, .event-title, h2, h3, .title, .headliner').first().text().trim();
      const dateRaw =
        $el.find('.tribe-events-calendar-list__event-datetime, .event-date, time, [datetime], .date').first();
      const date = dateRaw.attr('datetime') || dateRaw.text().trim();
      const time =
        $el.find('.tribe-events-calendar-list__event-datetime, .time, .doors').first().text().trim();
      const price =
        $el.find('.price, .tribe-events-c-small-cta__price').first().text().trim();
      const ticketUrl =
        $el.find('a[href*="ticket"]').attr('href') ||
        $el.find('a.tribe-events-calendar-list__event-title-link').attr('href') ||
        $el.find('a').attr('href') || '';

      if (artist && artist.length > 1) {
        events.push({
          artist,
          date: normalizeDate(date),
          time: cleanTime(time),
          price,
          ticketUrl: resolveUrl(ticketUrl),
          venue: venue.name,
          source: 'scrape',
        });
      }
    });

    return events;
  } catch (err) {
    log.warn(`Le Poisson Rouge scrape failed: ${err.message}`);
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

function cleanTime(raw) {
  const match = raw.match(/\d{1,2}:\d{2}\s*(am|pm|AM|PM)?/);
  return match ? match[0] : '';
}

function resolveUrl(href) {
  if (!href) return '';
  if (href.startsWith('http')) return href;
  return `https://lpr.com${href}`;
}

module.exports = { scrape };
