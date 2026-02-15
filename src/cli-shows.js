/**
 * CLI: npm run shows
 * Prints a ranked table of matched shows from the latest data.
 */
const fs = require('fs');
const path = require('path');
const Table = require('cli-table3');
const config = require('./config');
const log = require('./utils/logger');

function run() {
  const matchesPath = path.join(config.dataDir, 'matches.json');

  if (!fs.existsSync(matchesPath)) {
    log.err('No matches found. Run: npm run update');
    process.exit(1);
  }

  const matches = JSON.parse(fs.readFileSync(matchesPath, 'utf-8'));
  const scored = matches.filter((m) => m.score > 0);

  if (scored.length === 0) {
    log.warn('No shows matched your listening profile.');
    log.info('Try running: npm run update  to refresh data.');
    return;
  }

  // Color-code scores
  function colorScore(score) {
    if (score >= 95) return `\x1b[32m${score}\x1b[0m`; // green
    if (score >= 80) return `\x1b[36m${score}\x1b[0m`; // cyan
    if (score >= 60) return `\x1b[33m${score}\x1b[0m`; // yellow
    return `\x1b[90m${score}\x1b[0m`; // gray
  }

  const table = new Table({
    head: ['Score', 'Artist', 'Venue', 'Date', 'Match Reason'],
    colWidths: [7, 28, 26, 12, 42],
    style: { head: ['cyan'] },
    wordWrap: true,
  });

  scored.forEach((show) => {
    table.push([
      colorScore(show.score),
      show.artist.slice(0, 26),
      show.venue.slice(0, 24),
      show.date || '—',
      show.matchReason.slice(0, 40),
    ]);
  });

  console.log(`\n  Showfinder — ${scored.length} matched shows\n`);
  console.log(table.toString());

  // Summary stats
  const tiers = {
    'Direct match (95-100)': scored.filter((s) => s.score >= 95).length,
    'Related artist (80-94)': scored.filter((s) => s.score >= 80 && s.score < 95).length,
    'Genre match (60-79)': scored.filter((s) => s.score >= 60 && s.score < 80).length,
    'Partial match (40-59)': scored.filter((s) => s.score >= 40 && s.score < 60).length,
  };

  console.log('\n  Score breakdown:');
  for (const [label, count] of Object.entries(tiers)) {
    if (count > 0) console.log(`    ${label}: ${count}`);
  }
  console.log();
}

run();
