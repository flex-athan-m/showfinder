const cheerio = require('cheerio');
const { fetchHTML } = require('../../utils/http');
const log = require('../../utils/logger');

async function scrape(venue) {
  try {
    const html = await fetchHTML('https://www.warsawconcerts.com/shows');
    const $ = cheerio.load(html);
    const events = [];

    // Warsaw embeds Schema.org JSON-LD MusicEvent data
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

    // If JSON-LD worked, return those results
    if (events.length > 0) return events;

    // Fallback: scrape visible event cards
    $('[class*="event"], article, .show-card, a[href*="/shows/"]').each((_, el) => {
      const $el = $(el);
      const artist =
        $el.find('h2, h3, h4, [class*="title"], [class*="name"]').first().text().trim() ||
        $el.find('a').first().text().trim();
      const dateEl = $el.find('time, [datetime], [class*="date"]').first();
      const date = dateEl.attr('datetime') || dateEl.text().trim();
      const ticketUrl = $el.find('a[href*="ticket"]').attr('href') || $el.find('a').attr('href') || '';

      if (artist && artist.length > 1 && artist.length < 200) {
        events.push({
          artist,
          date: normalizeDate(date),
          time: '',
          price: '',
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

function resolveUrl(href) {
  if (!href) return '';
  if (href.startsWith('http')) return href;
  return `https://www.warsawconcerts.com${href}`;
}

module.exports = { scrape };
