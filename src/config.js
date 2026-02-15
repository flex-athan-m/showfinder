require('dotenv').config();
const path = require('path');

module.exports = {
  dataDir: path.join(__dirname, '..', 'data'),
  outputDir: path.join(__dirname, '..', 'output'),

  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:8888/callback',
    refreshToken: process.env.SPOTIFY_REFRESH_TOKEN,
  },

  bandsintown: {
    apiKey: process.env.BANDSINTOWN_API_KEY,
  },

  email: {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
    to: process.env.EMAIL_TO,
    topN: parseInt(process.env.EMAIL_TOP_N || '10', 10),
  },

  venues: [
    { name: 'Brooklyn Paramount', slug: 'brooklyn-paramount', url: 'https://www.brooklynparamount.com', bandsintownId: 'Brooklyn Paramount' },
    { name: 'Brooklyn Steel', slug: 'brooklyn-steel', url: 'https://www.bfrpresents.com/venues/brooklyn-steel', bandsintownId: 'Brooklyn Steel' },
    { name: 'Music Hall of Williamsburg', slug: 'music-hall-of-williamsburg', url: 'https://www.musichallofwilliamsburg.com', bandsintownId: 'Music Hall of Williamsburg' },
    { name: 'Brooklyn Bowl', slug: 'brooklyn-bowl', url: 'https://www.brooklynbowl.com/events', bandsintownId: 'Brooklyn Bowl Brooklyn' },
    { name: 'Warsaw', slug: 'warsaw', url: 'https://www.warsawconcerts.com', bandsintownId: 'Warsaw' },
    { name: 'Sony Hall', slug: 'sony-hall', url: 'https://www.sonyhall.com', bandsintownId: 'Sony Hall' },
    { name: 'Webster Hall', slug: 'webster-hall', url: 'https://www.websterhall.com', bandsintownId: 'Webster Hall' },
    { name: 'Le Poisson Rouge', slug: 'le-poisson-rouge', url: 'https://lpr.com', bandsintownId: 'Le Poisson Rouge' },
    { name: 'National Sawdust', slug: 'national-sawdust', url: 'https://nationalsawdust.org', bandsintownId: 'National Sawdust' },
    { name: 'Nublu', slug: 'nublu', url: 'https://nublu.net', bandsintownId: 'Nublu' },
  ],
};
