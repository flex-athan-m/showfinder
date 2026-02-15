/**
 * Sends a weekly HTML email digest of top matched shows via Resend.
 * Design matches the showfinder React mockup.
 */
const fs = require('fs');
const path = require('path');
const { Resend } = require('resend');
const config = require('./config');
const log = require('./utils/logger');

const venueMap = Object.fromEntries(config.venues.map((v) => [v.name, v]));

function getMatchColor(score) {
  if (score >= 90) return '#22c55e';
  if (score >= 75) return '#eab308';
  if (score >= 60) return '#f97316';
  return '#94a3b8';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr + 'T12:00:00');
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function esc(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildShowCard(show) {
  const color = getMatchColor(show.score);
  const venue = venueMap[show.venue];
  const neighborhood = venue?.neighborhood || '';
  const venueLine = neighborhood ? `${esc(show.venue)} &middot; ${esc(neighborhood)}` : esc(show.venue);
  const dateLabel = formatDate(show.date);

  // Genre pills
  const genres = (show.spotifyGenres || []).slice(0, 3);
  const genrePills = genres.length > 0
    ? genres.map((g) =>
        `<span style="display:inline-block;padding:3px 10px;border-radius:100px;font-size:11px;font-weight:500;background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.55);border:1px solid rgba(255,255,255,0.08);margin-right:6px;margin-bottom:4px;">${esc(g)}</span>`
      ).join('')
    : '';

  // Match reason banner
  const matchBanner = show.matchReason && show.score > 0
    ? `<div style="margin-bottom:16px;padding:8px 12px;border-radius:8px;background:${color}18;border:1px solid ${color}30;">
        <span style="font-size:12px;color:${color};font-weight:500;">&#127911; ${esc(show.matchReason)}</span>
      </div>`
    : '';

  // Ticket link
  const ticketBtn = show.ticketUrl
    ? `<a href="${show.ticketUrl}" style="display:inline-block;padding:6px 14px;border-radius:8px;background:${color};color:#fff;font-size:12px;font-weight:600;text-decoration:none;">Get Tickets</a>`
    : '';

  return `
    <div style="background:rgba(255,255,255,0.03);border-radius:16px;border:1px solid rgba(255,255,255,0.06);overflow:hidden;margin-bottom:16px;">
      <!-- Color bar -->
      <div style="height:6px;background:linear-gradient(90deg, ${color}, ${color}88);"></div>

      <div style="padding:20px 22px;">
        <!-- Artist + Score -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
          <tr>
            <td style="vertical-align:top;">
              <div style="font-size:20px;font-weight:700;color:#f5f5f5;letter-spacing:-0.02em;margin:0;">${esc(show.artist)}</div>
              <div style="font-size:13px;color:rgba(255,255,255,0.45);font-weight:500;margin-top:4px;">${venueLine}</div>
            </td>
            <td style="vertical-align:top;text-align:right;width:56px;">
              <div style="width:48px;height:48px;border-radius:50%;border:3px solid ${color};display:inline-flex;align-items:center;justify-content:center;">
                <span style="font-family:'Courier New',monospace;font-size:14px;font-weight:700;color:${color};">${show.score}</span>
              </div>
            </td>
          </tr>
        </table>

        <!-- Genre pills -->
        ${genrePills ? `<div style="margin-bottom:14px;">${genrePills}</div>` : ''}

        <!-- Match reason -->
        ${matchBanner}

        <!-- Date + Price -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:13px;color:rgba(255,255,255,0.6);font-weight:500;">
              ${dateLabel ? esc(dateLabel) : ''}${show.time ? ` &middot; ${esc(show.time)}` : ''}
            </td>
            <td style="text-align:right;">
              ${show.price ? `<span style="font-size:15px;font-weight:700;color:#f0f0f0;font-family:'Courier New',monospace;">${esc(show.price)}</span>` : ''}
            </td>
          </tr>
        </table>
      </div>
    </div>`;
}

function buildHTML(matches) {
  const topN = config.email.topN || 10;
  const scored = matches.filter((m) => m.score > 0);
  const top = scored.slice(0, topN);
  const topPick = scored[0];

  if (top.length === 0) {
    return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:700px;margin:0 auto;padding:40px 32px;">
    <div style="margin-bottom:6px;">
      <span style="font-size:28px;">&#127908;</span>
      <span style="font-size:28px;font-weight:800;color:#f5f5f5;letter-spacing:-0.03em;margin-left:12px;">showfinder</span>
    </div>
    <p style="font-size:14px;color:rgba(255,255,255,0.4);font-weight:500;margin:0 0 30px;">Upcoming shows at your venues, ranked by your Spotify taste</p>
    <div style="text-align:center;padding:60px 20px;">
      <p style="font-size:18px;color:rgba(255,255,255,0.3);font-weight:500;">No matching shows found this week</p>
      <p style="font-size:14px;color:rgba(255,255,255,0.2);">We'll keep checking your venues and let you know when something comes up.</p>
    </div>
  </div>
</body></html>`;
  }

  // Top pick banner
  const topPickColor = getMatchColor(topPick.score);
  const topPickVenue = venueMap[topPick.venue];
  const topPickDate = formatDate(topPick.date);
  const topPickBanner = `
    <div style="margin-top:20px;padding:16px 20px;border-radius:12px;background:linear-gradient(135deg, ${topPickColor}20, ${topPickColor}10);border:1px solid ${topPickColor}40;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:middle;">
            <div style="font-size:11px;font-weight:600;color:${topPickColor};text-transform:uppercase;letter-spacing:0.1em;">&#128293; Top Pick for You</div>
            <div style="font-size:16px;font-weight:700;color:#f0f0f0;margin-top:4px;">${esc(topPick.artist)} at ${esc(topPickVenue?.name || topPick.venue)}</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.5);margin-top:2px;">${esc(topPickDate)}${topPick.price ? ` &middot; ${esc(topPick.price)}` : ''}</div>
          </td>
          <td style="vertical-align:middle;text-align:right;">
            ${topPick.ticketUrl ? `<a href="${topPick.ticketUrl}" style="display:inline-block;padding:8px 16px;border-radius:8px;background:${topPickColor};color:#fff;font-size:13px;font-weight:600;text-decoration:none;">Get Tickets</a>` : ''}
          </td>
        </tr>
      </table>
    </div>`;

  // Show cards
  const cards = top.map(buildShowCard).join('');

  // Counts
  const perfectCount = scored.filter((s) => s.score >= 90).length;
  const strongCount = scored.filter((s) => s.score >= 75 && s.score < 90).length;
  const worthCount = scored.filter((s) => s.score >= 60 && s.score < 75).length;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e8e8e8;">
  <div style="max-width:700px;margin:0 auto;">

    <!-- Header -->
    <div style="padding:40px 32px 28px;border-bottom:1px solid rgba(255,255,255,0.06);">
      <div style="margin-bottom:6px;">
        <span style="font-size:28px;">&#127908;</span>
        <span style="font-size:28px;font-weight:800;color:#f5f5f5;letter-spacing:-0.03em;margin-left:12px;">showfinder</span>
      </div>
      <p style="font-size:14px;color:rgba(255,255,255,0.4);font-weight:500;margin:0;">Upcoming shows at your venues, ranked by your Spotify taste</p>

      ${topPickBanner}
    </div>

    <!-- Content -->
    <div style="padding:24px 32px 60px;">

      <!-- Legend -->
      <div style="margin-bottom:20px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:13px;color:rgba(255,255,255,0.35);font-weight:500;">
              ${scored.length} show${scored.length !== 1 ? 's' : ''} found
            </td>
            <td style="text-align:right;font-size:11px;color:rgba(255,255,255,0.3);">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#22c55e;margin-right:4px;vertical-align:middle;"></span>Perfect Match
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#eab308;margin:0 4px 0 12px;vertical-align:middle;"></span>Strong Match
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#f97316;margin:0 4px 0 12px;vertical-align:middle;"></span>Worth Checking
            </td>
          </tr>
        </table>
      </div>

      <!-- Show Cards -->
      ${cards}

    </div>
  </div>
</body>
</html>`;
}

async function sendDigest(matches) {
  const data = matches || loadMatches();
  const html = buildHTML(data);

  // Always save a preview
  const outPath = path.join(config.outputDir, 'digest.html');
  fs.mkdirSync(config.outputDir, { recursive: true });
  fs.writeFileSync(outPath, html);

  if (!config.email.resendApiKey) {
    log.warn('Resend API key not configured — skipping send. Set RESEND_API_KEY in .env');
    log.ok(`Email preview saved to ${outPath}`);
    return;
  }

  const resend = new Resend(config.email.resendApiKey);
  const strongMatches = data.filter((m) => m.score >= 80).length;

  const { error } = await resend.emails.send({
    from: config.email.from,
    to: config.email.to,
    subject: `Showfinder — ${strongMatches} great matches this week`,
    html,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }

  log.ok(`Email sent to ${config.email.to}`);
}

function loadMatches() {
  const matchesPath = path.join(config.dataDir, 'matches.json');
  if (!fs.existsSync(matchesPath)) {
    log.err('No matches found. Run: npm run update');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(matchesPath, 'utf-8'));
}

// Run directly
if (require.main === module) {
  sendDigest().catch((err) => {
    log.err(err.message);
    process.exit(1);
  });
}

module.exports = { sendDigest, buildHTML };
