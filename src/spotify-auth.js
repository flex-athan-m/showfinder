/**
 * One-time Spotify OAuth flow.
 * Run: npm run auth
 * Opens a browser, you log in, and it saves the refresh token to .env.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const SpotifyWebApi = require('spotify-web-api-node');
const config = require('./config');
const log = require('./utils/logger');

const scopes = [
  'user-top-read',
  'user-read-recently-played',
  'user-read-email',
];

async function run() {
  const api = new SpotifyWebApi({
    clientId: config.spotify.clientId,
    clientSecret: config.spotify.clientSecret,
    redirectUri: config.spotify.redirectUri,
  });

  const authorizeURL = api.createAuthorizeURL(scopes, 'showfinder-state');
  log.info('Opening browser for Spotify login...');
  log.info(`If it doesn't open, visit:\n${authorizeURL}\n`);

  const open = (await import('open')).default;
  await open(authorizeURL);

  // Start a temporary server to catch the callback
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost:8888`);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h1>Authorization denied.</h1>');
        server.close();
        reject(new Error(`Auth denied: ${error}`));
        return;
      }

      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h1>No code received.</h1>');
        return;
      }

      try {
        const data = await api.authorizationCodeGrant(code);
        const refreshToken = data.body.refresh_token;

        // Write refresh token to .env
        const envPath = path.join(__dirname, '..', '.env');
        let envContent = '';
        if (fs.existsSync(envPath)) {
          envContent = fs.readFileSync(envPath, 'utf-8');
        }

        if (envContent.includes('SPOTIFY_REFRESH_TOKEN=')) {
          envContent = envContent.replace(
            /SPOTIFY_REFRESH_TOKEN=.*/,
            `SPOTIFY_REFRESH_TOKEN=${refreshToken}`
          );
        } else {
          envContent += `\nSPOTIFY_REFRESH_TOKEN=${refreshToken}\n`;
        }

        fs.writeFileSync(envPath, envContent);
        log.ok('Refresh token saved to .env');
        log.ok(`Token: ${refreshToken.slice(0, 12)}...`);

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(
          '<h1>Showfinder authorized!</h1><p>You can close this tab.</p>'
        );
        server.close();
        resolve();
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end('<h1>Token exchange failed.</h1>');
        server.close();
        reject(err);
      }
    });

    server.listen(8888, () => {
      log.info('Waiting for callback on http://localhost:8888/callback ...');
    });
  });
}

run().catch((err) => {
  log.err(err.message);
  process.exit(1);
});
