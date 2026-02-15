/**
 * Sends a weekly HTML email digest of top matched shows.
 */
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const config = require('./config');
const log = require('./utils/logger');

function buildHTML(matches) {
  const topN = config.email.topN || 10;
  const top = matches.filter((m) => m.score > 0).slice(0, topN);

  if (top.length === 0) {
    return '<p>No matching shows found this week.</p>';
  }

  const rows = top
    .map((show) => {
      const scoreBg =
        show.score >= 95
          ? '#22c55e'
          : show.score >= 80
            ? '#06b6d4'
            : show.score >= 60
              ? '#eab308'
              : '#6b7280';

      const ticketLink = show.ticketUrl
        ? `<a href="${show.ticketUrl}" style="color:#818cf8;text-decoration:none;">Tickets &rarr;</a>`
        : '';

      return `
      <tr style="border-bottom:1px solid #2d2d3d;">
        <td style="padding:14px 12px;text-align:center;">
          <span style="background:${scoreBg};color:#fff;padding:4px 10px;border-radius:12px;font-weight:700;font-size:14px;">${show.score}</span>
        </td>
        <td style="padding:14px 12px;">
          <div style="font-weight:600;font-size:15px;color:#f1f5f9;">${escapeHtml(show.artist)}</div>
          <div style="font-size:12px;color:#94a3b8;margin-top:2px;">${escapeHtml(show.venue)}</div>
        </td>
        <td style="padding:14px 12px;color:#cbd5e1;font-size:14px;white-space:nowrap;">
          ${show.date || '—'}<br>
          <span style="color:#64748b;font-size:12px;">${show.time || ''}</span>
        </td>
        <td style="padding:14px 12px;font-size:13px;color:#94a3b8;">${escapeHtml(show.matchReason)}</td>
        <td style="padding:14px 12px;font-size:13px;">${show.price || ''}<br>${ticketLink}</td>
      </tr>`;
    })
    .join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0f0f1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:700px;margin:0 auto;padding:32px 16px;">
    <div style="text-align:center;margin-bottom:28px;">
      <h1 style="color:#f1f5f9;font-size:24px;margin:0;">Showfinder</h1>
      <p style="color:#64748b;font-size:14px;margin:6px 0 0;">Your weekly concert digest — ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
    </div>

    <table style="width:100%;border-collapse:collapse;background:#1a1a2e;border-radius:12px;overflow:hidden;">
      <thead>
        <tr style="background:#16162a;border-bottom:2px solid #2d2d3d;">
          <th style="padding:12px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;text-align:center;">Score</th>
          <th style="padding:12px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;text-align:left;">Artist</th>
          <th style="padding:12px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;text-align:left;">Date</th>
          <th style="padding:12px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;text-align:left;">Why</th>
          <th style="padding:12px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;text-align:left;">Tickets</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <div style="text-align:center;margin-top:24px;">
      <p style="color:#475569;font-size:12px;">
        Matched from ${config.venues.length} venues against your Spotify profile.
        <br>Run <code style="background:#1e1e2e;padding:2px 6px;border-radius:4px;color:#818cf8;">npm run shows</code> for the full list.
      </p>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sendDigest(matches) {
  if (!config.email.user || !config.email.pass) {
    log.warn('Email not configured — skipping send. Set EMAIL_USER and EMAIL_PASS in .env');
    // Save the HTML to output/ instead
    const html = buildHTML(matches || loadMatches());
    const outPath = path.join(config.outputDir, 'digest.html');
    fs.mkdirSync(config.outputDir, { recursive: true });
    fs.writeFileSync(outPath, html);
    log.ok(`Email preview saved to ${outPath}`);
    return;
  }

  const data = matches || loadMatches();
  const html = buildHTML(data);

  // Save preview
  const outPath = path.join(config.outputDir, 'digest.html');
  fs.mkdirSync(config.outputDir, { recursive: true });
  fs.writeFileSync(outPath, html);

  const transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.port === 465,
    auth: {
      user: config.email.user,
      pass: config.email.pass,
    },
  });

  await transporter.sendMail({
    from: `"Showfinder" <${config.email.user}>`,
    to: config.email.to,
    subject: `Showfinder — ${data.filter((m) => m.score >= 80).length} great matches this week`,
    html,
  });

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
