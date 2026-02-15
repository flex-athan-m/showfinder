const axios = require('axios');

const client = axios.create({
  timeout: 15000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
});

async function fetchHTML(url) {
  const { data } = await client.get(url);
  return data;
}

async function fetchJSON(url, params = {}) {
  const { data } = await client.get(url, { params });
  return data;
}

module.exports = { client, fetchHTML, fetchJSON };
