const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

const PORT    = process.env.PORT || 3001;
const API_KEY = 'cmmufiu140009jh04vcba593m';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ── Helper: make HTTPS request ──────────────────────────────
function httpsGet(targetUrl, headers) {
  return new Promise((resolve, reject) => {
    const parsed = url.parse(targetUrl);
    const opts = {
      hostname: parsed.hostname,
      path:     parsed.path,
      method:   'GET',
      headers:  headers
    };
    const req = https.request(opts, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS); res.end(); return;
  }

  // Serve HTML
  if (parsed.pathname === '/' || parsed.pathname === '/index.html') {
    const htmlPath = path.join(__dirname, 'index.html');
    if (!fs.existsSync(htmlPath)) {
      res.writeHead(404, CORS); res.end('index.html not found'); return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...CORS });
    res.end(fs.readFileSync(htmlPath, 'utf8')); return;
  }

  // ── Main proxy endpoint ──────────────────────────────────
  // GET /api?orig=DXB&dest=LHR&date=2026-03-17
  if (parsed.pathname === '/api') {
    const { orig, dest, date } = parsed.query;

    if (!orig || !dest || !date) {
      res.writeHead(400, CORS);
      res.end(JSON.stringify({ error: 'Missing orig, dest or date' }));
      return;
    }

    const fromDt = `${date}T00:00`;
    const toDt   = `${date}T23:59`;

    // AeroDataBox via api.market
    const apiUrl = `https://prod.api.market/api/v1/aedbx/aerodatabox/airports/iata/${orig}/flights/departures/${fromDt}/${toDt}?withLeg=true&direction=Departure&withCancelled=false&withCodeshared=true&withCargo=false&withPrivate=false`;

    try {
      console.log(`[API] Fetching: ${orig} → ${dest} on ${date}`);
      const result = await httpsGet(apiUrl, {
        'x-api-market-key': API_KEY,
        'Accept':           'application/json',
        'User-Agent':       'SkyFly/1.0'
      });

      console.log(`[API] Status: ${result.status}, Body length: ${result.body.length}`);

      if (result.status !== 200) {
        res.writeHead(result.status, CORS);
        res.end(result.body); return;
      }

      const data = JSON.parse(result.body);

      // Filter by destination
      const all = data.departures || data.items || (Array.isArray(data) ? data : []);
      console.log(`[API] Total departures from ${orig}: ${all.length}`);

      const filtered = all.filter(f => {
        const arrIata = (
          f.arrival?.airport?.iata  ||
          f.movement?.airport?.iata ||
          ''
        ).toUpperCase();
        return arrIata === dest.toUpperCase();
      });

      console.log(`[API] Filtered to ${dest}: ${filtered.length} flights`);

      res.writeHead(200, { 'Content-Type': 'application/json', ...CORS });
      res.end(JSON.stringify({ flights: filtered, total: filtered.length }));

    } catch (e) {
      console.error('[API] Error:', e.message);
      res.writeHead(500, CORS);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  res.writeHead(404, CORS); res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\n  ✈  SkyFly running at http://localhost:${PORT}\n`);
});
