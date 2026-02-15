const cheerio = require('cheerio');
const { fetchHTML } = require('../../utils/http');
const log = require('../../utils/logger');

async function scrape(venue) {
  try {
    const html = await fetchHTML('https://www.brooklynparamount.com/shows');
    const $ = cheerio.load(html);
    const events = [];

    // Try JSON-LD structured data first (Schema.org MusicEvent)
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).html());
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (item['@type'] !== 'MusicEvent') continue;
          const artist = item.name || '';
          const startDate = item.startDate || '';
          const ticketUrl = item.url || '';
          if (artist) {
            events.push({
              artist,
              date: startDate ? startDate.split('T')[0] : '',
              time: startDate && startDate.includes('T')
                ? formatTime(startDate)
                : '',
              price: '',
              ticketUrl,
              venue: venue.name,
              source: 'scrape',
            });
          }
        }
      } catch {
        // Skip malformed JSON-LD blocks
      }
    });

    if (events.length > 0) return events;

    // Fallback: DOM scraping
    $('.eventItem, .event-item, [class*="EventItem"], .event-listing .event, article, [class*="event"]').each((_, el) => {
      const $el = $(el);
      const artist =
        $el.find('.eventItem-title, .event-title, h2, h3, .title, .headliner, [class*="name"]').first().text().trim();
      const dateRaw = $el.find('.eventItem-date, .event-date, time, [datetime], .date').first();
      const date = dateRaw.attr('datetime') || dateRaw.text().trim();
      const ticketUrl =
        $el.find('a[href*="ticket"], a[href*="event"]').attr('href') ||
        $el.find('a').attr('href') || '';

      if (artist && artist.length > 1 && artist.length < 200) {
        events.push({
          artist,
          date: normalizeDate(date),
          time: '',
          price: '',
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

function formatTime(isoString) {
  try {
    const d = new Date(isoString);
    if (isNaN(d)) return '';
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch { return ''; }
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
