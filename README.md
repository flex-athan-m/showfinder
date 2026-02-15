# Showfinder

Scrapes upcoming concerts from your favorite NYC venues, matches them against your Spotify listening habits, and sends you a weekly email digest.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure secrets

```bash
cp .env.example .env
```

Fill in your `.env` file:

| Variable | Where to get it |
|---|---|
| `SPOTIFY_CLIENT_ID` | [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) — create an app, set redirect URI to `http://localhost:8888/callback` |
| `SPOTIFY_CLIENT_SECRET` | Same Spotify app |
| `BANDSINTOWN_API_KEY` | [Bandsintown API](https://www.bandsintown.com/api) (used as fallback when scraping fails) |
| `EMAIL_USER` | Your Gmail address (or other SMTP provider) |
| `EMAIL_PASS` | [Gmail App Password](https://myaccount.google.com/apppasswords) (not your real password) |
| `EMAIL_TO` | Where to send the digest |

### 3. Authorize Spotify (one-time)

```bash
npm run auth
```

This opens your browser, you log in to Spotify, and the refresh token is saved to `.env` automatically.

## Usage

### Full pipeline (scrape + score + email)

```bash
npm run update
```

Flags:
- `--no-email` — skip sending the email (still saves HTML preview)
- `--dry-run` — run everything but don't send email

### View matched shows in terminal

```bash
npm run shows
```

Prints a color-coded ranked table:

| Score | Meaning |
|---|---|
| 95-100 (green) | Direct match — artist is in your Spotify top artists |
| 80-94 (cyan) | Related artist — the performing artist is related to your top artists |
| 60-79 (yellow) | Genre match — the artist shares genres with your listening profile |
| 40-59 (gray) | Partial match — fuzzy name or genre overlap |

### Send email only (from cached data)

```bash
npm run email
```

## Venues

| Venue | Method |
|---|---|
| Brooklyn Paramount | Scrape → Bandsintown fallback |
| Brooklyn Steel | Scrape → Bandsintown fallback |
| Music Hall of Williamsburg | Scrape → Bandsintown fallback |
| Brooklyn Bowl | Scrape → Bandsintown fallback |
| Warsaw | Scrape → Bandsintown fallback |
| Sony Hall | Scrape → Bandsintown fallback |
| Webster Hall | Scrape → Bandsintown fallback |
| Le Poisson Rouge | Scrape → Bandsintown fallback |
| National Sawdust | Scrape → Bandsintown fallback |
| Nublu | Scrape → Bandsintown fallback |

Each venue has a custom Cheerio scraper. If scraping fails (JS-rendered pages, anti-bot, site changes), it automatically falls back to the Bandsintown API.

## Running on a schedule

### Option A: Cron job (macOS/Linux)

```bash
# Edit crontab
crontab -e

# Add this line (runs every Monday at 10 AM)
0 10 * * 1 cd /path/to/showfinder && /usr/local/bin/node src/pipeline.js >> /tmp/showfinder.log 2>&1
```

### Option B: GitHub Actions (free)

1. Push this repo to GitHub
2. Go to **Settings → Secrets and variables → Actions**
3. Add each `.env` variable as a repository secret:
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`
   - `SPOTIFY_REFRESH_TOKEN`
   - `BANDSINTOWN_API_KEY`
   - `EMAIL_HOST`
   - `EMAIL_PORT`
   - `EMAIL_USER`
   - `EMAIL_PASS`
   - `EMAIL_TO`
4. The workflow at `.github/workflows/weekly-digest.yml` runs every Monday at 10 AM UTC
5. You can also trigger it manually from the **Actions** tab

## Project structure

```
showfinder/
├── src/
│   ├── config.js              # Central config, reads .env
│   ├── spotify-auth.js        # One-time OAuth flow
│   ├── spotify-profile.js     # Fetches top artists, genres, recent tracks
│   ├── matcher.js             # Scoring engine (0-100)
│   ├── pipeline.js            # Full update pipeline
│   ├── cli-shows.js           # Terminal table output
│   ├── send-email.js          # HTML email digest
│   ├── scrapers/
│   │   ├── index.js           # Orchestrator with fallback logic
│   │   ├── generic.js         # Generic Cheerio extractor
│   │   ├── bandsintown.js     # Bandsintown API fallback
│   │   └── venues/            # Per-venue custom scrapers
│   └── utils/
│       ├── http.js            # Axios client
│       └── logger.js          # Colored console logging
├── data/                      # Generated: profiles, shows, matches (gitignored)
├── output/                    # Generated: HTML digest preview (gitignored)
├── .env.example
├── .github/workflows/
│   └── weekly-digest.yml
└── package.json
```
