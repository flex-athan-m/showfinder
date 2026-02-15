/**
 * Full pipeline: npm run update
 * 1. Refresh Spotify profile
 * 2. Scrape all venues
 * 3. Score shows against profile
 * 4. Save results
 * 5. Send email digest
 */
const fs = require('fs');
const path = require('path');
const config = require('./config');
const log = require('./utils/logger');
const { fetchProfile } = require('./spotify-profile');
const { scrapeAllVenues } = require('./scrapers');
const { scoreAllShows } = require('./matcher');
const { sendDigest } = require('./send-email');

/**
 * Normalize scraped date/time fields into clean formats for the dashboard.
 */
function normalizeMatch(match) {
  const m = { ...match };

  // --- Normalize date to YYYY-MM-DD ---
  if (m.date) {
    let ds = m.date.replace(/\s+/g, ' ').trim();
    // Remove ordinal suffixes (1st, 2nd, 3rd, 4th, etc.)
    ds = ds.replace(/(\d+)(st|nd|rd|th)\b/gi, '$1');
    // Remove embedded time at end of date string (e.g., "Feb 18th, 2026 6:30")
    ds = ds.replace(/\s+\d{1,2}:\d{2}\s*$/, '').trim();
    // Fix stuck day+month like "WednesdayFeb" -> "Wednesday Feb"
    ds = ds.replace(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday)(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/gi, '$1 $2');
    // Add current year if missing
    if (!/\d{4}/.test(ds)) ds += ', 2026';
    const parsed = new Date(ds);
    if (!isNaN(parsed)) {
      m.date = parsed.toISOString().split('T')[0];
    }
  }

  // --- Normalize time to "H:MM PM" ---
  if (m.time) {
    let ts = m.time.replace(/\s+/g, ' ').trim();
    // Prefer "Show:" time over "Doors:" time
    const showMatch = ts.match(/Show:\s*(\d{1,2}:\d{2}\s*(AM|PM)?)/i);
    const doorsMatch = ts.match(/Doors:\s*(\d{1,2}:\d{2}\s*(AM|PM)?)/i);
    if (showMatch) ts = showMatch[1].trim();
    else if (doorsMatch) ts = doorsMatch[1].trim();
    // Ensure space before AM/PM
    ts = ts.replace(/(\d)(AM|PM)/gi, '$1 $2');
    m.time = ts.toUpperCase();
  }

  return m;
}

async function run() {
  const dryRun = process.argv.includes('--dry-run');
  const skipEmail = process.argv.includes('--no-email');
  const start = Date.now();

  console.log('\n  =============================');
  console.log('   Showfinder Pipeline');
  console.log('  =============================\n');

  // Step 1: Refresh Spotify profile
  log.info('Step 1/4: Refreshing Spotify profile...');
  let profile;
  try {
    profile = await fetchProfile();
  } catch (err) {
    log.err(`Spotify refresh failed: ${err.message}`);
    // Try loading cached profile
    const cached = path.join(config.dataDir, 'spotify-profile.json');
    if (fs.existsSync(cached)) {
      log.warn('Using cached Spotify profile');
      profile = JSON.parse(fs.readFileSync(cached, 'utf-8'));
    } else {
      log.err('No cached profile available. Run: npm run auth');
      process.exit(1);
    }
  }

  // Step 2: Scrape venues
  log.info('Step 2/4: Scraping venues...');
  const shows = await scrapeAllVenues();

  // Save raw shows
  const showsPath = path.join(config.dataDir, 'shows.json');
  fs.writeFileSync(showsPath, JSON.stringify(shows, null, 2));
  log.ok(`Saved ${shows.length} raw events to data/shows.json`);

  if (shows.length === 0) {
    log.warn('No shows scraped. Check venue URLs or Bandsintown API key.');
    log.warn('The email digest will still be generated with any cached data.');
  }

  // Step 3: Score shows
  log.info('Step 3/4: Scoring shows...');
  const matches = await scoreAllShows(shows, profile);

  // Save matches
  const matchesPath = path.join(config.dataDir, 'matches.json');
  fs.writeFileSync(matchesPath, JSON.stringify(matches, null, 2));
  log.ok(`Saved ${matches.length} scored matches to data/matches.json`);

  // Step 3b: Generate dashboard data (docs/data.json)
  const docsDir = path.join(__dirname, '..', 'docs');
  fs.mkdirSync(docsDir, { recursive: true });
  const dashboardData = {
    updatedAt: new Date().toISOString(),
    matches: matches.map(normalizeMatch),
    profile: {
      topArtists: (profile.topArtists || []).slice(0, 10),
      topGenres: (profile.topGenres || []).slice(0, 10),
      recentArtists: (profile.recentArtists || []).slice(0, 10),
    },
    venues: config.venues.map(v => ({ name: v.name, neighborhood: v.neighborhood })),
  };
  fs.writeFileSync(path.join(docsDir, 'data.json'), JSON.stringify(dashboardData, null, 2));
  log.ok('Dashboard data saved to docs/data.json');

  // Step 4: Email digest
  if (!skipEmail && !dryRun) {
    log.info('Step 4/4: Sending email digest...');
    try {
      await sendDigest(matches);
    } catch (err) {
      log.err(`Email failed: ${err.message}`);
    }
  } else {
    log.info('Step 4/4: Skipping email (--no-email or --dry-run)');
    // Still save the HTML preview
    const { buildHTML } = require('./send-email');
    const html = buildHTML(matches);
    fs.mkdirSync(config.outputDir, { recursive: true });
    fs.writeFileSync(path.join(config.outputDir, 'digest.html'), html);
    log.ok('Email preview saved to output/digest.html');
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const topMatches = matches.filter((m) => m.score >= 80).length;

  console.log('\n  =============================');
  console.log(`   Done in ${elapsed}s`);
  console.log(`   ${shows.length} shows scraped`);
  console.log(`   ${topMatches} strong matches (80+)`);
  console.log('  =============================\n');
}

run().catch((err) => {
  log.err(`Pipeline failed: ${err.message}`);
  console.error(err);
  process.exit(1);
});
