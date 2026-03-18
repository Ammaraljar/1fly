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

function httpsGet(targetUrl, headers) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(targetUrl);
    const opts = {
      hostname: parsed.hostname,
      path:     parsed.pathname + parsed.search,
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
  const reqUrl  = new URL(req.url, `http://localhost:${PORT}`);
  const path2   = reqUrl.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS); res.end(); return;
  }

  // Serve HTML
  if (path2 === '/' || path2 === '/index.html') {
    const htmlPath = path.join(__dirname, 'index.html');
    if (!fs.existsSync(htmlPath)) {
      res.writeHead(404, CORS); res.end('index.html not found'); return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...CORS });
    res.end(fs.readFileSync(htmlPath, 'utf8')); return;
  }

  // API proxy: /api?orig=DXB&dest=LHR&date=2026-03-17
  if (path2 === '/api') {
    const orig = reqUrl.searchParams.get('orig');
    const dest = reqUrl.searchParams.get('dest');
    const date = reqUrl.searchParams.get('date');

    if (!orig || !dest || !date) {
      res.writeHead(400, CORS);
      res.end(JSON.stringify({ error: 'Missing orig, dest or date' })); return;
    }

    const fromDt = `${date}T00:00`;
    const toDt   = `${date}T23:59`;

    // AeroDataBox via api.market — correct base URL for api.market keys
    const apiUrl = `https://prod.api.market/api/v1/aedbx/aerodatabox/airports/iata/${orig}/flights/departures/${fromDt}/${toDt}?withLeg=true&direction=Departure&withCancelled=false&withCodeshared=true&withCargo=false&withPrivate=false`;

    console.log(`[API] ${orig} → ${dest} | ${date}`);
    console.log(`[API] URL: ${apiUrl}`);

    try {
      const result = await httpsGet(apiUrl, {
        'x-api-market-key': API_KEY,
        'Accept':           'application/json',
        'User-Agent':       'SkyFly/1.0'
      });

      console.log(`[API] Status: ${result.status}`);
      console.log(`[API] Body preview: ${result.body.slice(0, 300)}`);

      if (result.status !== 200) {
        // If api.market fails, try RapidAPI endpoint
        console.log('[API] Trying RapidAPI endpoint...');
        const rapidUrl = `https://aerodatabox.p.rapidapi.com/airports/iata/${orig}/flights/departures/${fromDt}/${toDt}?withLeg=true&direction=Departure&withCancelled=false&withCodeshared=true&withCargo=false&withPrivate=false`;
        
        const r2 = await httpsGet(rapidUrl, {
          'X-RapidAPI-Key':  API_KEY,
          'X-RapidAPI-Host': 'aerodatabox.p.rapidapi.com',
          'Accept':          'application/json',
        });

        console.log(`[RapidAPI] Status: ${r2.status}`);
        console.log(`[RapidAPI] Body preview: ${r2.body.slice(0, 300)}`);

        if (r2.status === 200) {
          const data2 = JSON.parse(r2.body);
          const all2  = data2.departures || data2.items || (Array.isArray(data2) ? data2 : []);
          const filtered2 = all2.filter(f => {
            const arrIata = (f.arrival?.airport?.iata || f.movement?.airport?.iata || '').toUpperCase();
            return arrIata === dest.toUpperCase();
          });
          console.log(`[RapidAPI] Found ${filtered2.length} flights to ${dest}`);
          res.writeHead(200, { 'Content-Type': 'application/json', ...CORS });
          res.end(JSON.stringify({ flights: filtered2, total: filtered2.length, source: 'rapidapi' }));
          return;
        }

        res.writeHead(result.status, CORS);
        res.end(JSON.stringify({ error: `API error ${result.status}`, body: result.body })); return;
      }

      const data = JSON.parse(result.body);
      const all  = data.departures || data.items || (Array.isArray(data) ? data : []);
      console.log(`[API] Total departures from ${orig}: ${all.length}`);

      const filtered = all.filter(f => {
        const arrIata = (f.arrival?.airport?.iata || f.movement?.airport?.iata || '').toUpperCase();
        return arrIata === dest.toUpperCase();
      });

      console.log(`[API] Flights to ${dest}: ${filtered.length}`);

      res.writeHead(200, { 'Content-Type': 'application/json', ...CORS });
      res.end(JSON.stringify({ flights: filtered, total: filtered.length, source: 'apimarket' }));

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
