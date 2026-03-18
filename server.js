const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const PORT     = process.env.PORT || 3001;
const SERP_KEY = '6597815d9772c000bf2addb28480236f722ddf2ccd882e6a0e033e1c62b93ade';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    https.request({ hostname: u.hostname, path: u.pathname + u.search, method: 'GET',
      headers: { 'User-Agent': 'SkyFly/1.0', 'Accept': 'application/json' }
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject).end();
  });
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return; }

  // Serve HTML
  if (u.pathname === '/' || u.pathname === '/index.html') {
    const p = path.join(__dirname, 'index.html');
    if (!fs.existsSync(p)) { res.writeHead(404, CORS); res.end('index.html not found'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...CORS });
    res.end(fs.readFileSync(p, 'utf8')); return;
  }

  // /api?orig=DXB&dest=LHR&date=2026-03-18&cabin=ECONOMY&adults=1
  if (u.pathname === '/api') {
    const orig   = u.searchParams.get('orig')   || '';
    const dest   = u.searchParams.get('dest')   || '';
    const date   = u.searchParams.get('date')   || '';
    const cabin  = u.searchParams.get('cabin')  || 'ECONOMY';
    const adults = u.searchParams.get('adults') || '1';

    if (!orig || !dest || !date) {
      res.writeHead(400, CORS);
      res.end(JSON.stringify({ error: 'Missing orig, dest or date' })); return;
    }

    // SerpAPI Google Flights
    // travel_class: 1=Economy 2=PremiumEconomy 3=Business 4=First
    const classMap = { ECONOMY: 1, PREMIUM_ECONOMY: 2, BUSINESS: 3, FIRST: 4 };
    const travelClass = classMap[cabin.toUpperCase()] || 1;

    const params = new URLSearchParams({
      engine:        'google_flights',
      departure_id:  orig,
      arrival_id:    dest,
      outbound_date: date,
      currency:      'USD',
      hl:            'en',
      adults:        adults,
      travel_class:  travelClass,
      type:          '2', // one-way
      api_key:       SERP_KEY
    });

    const apiUrl = `https://serpapi.com/search?${params.toString()}`;
    console.log(`[SERP] ${orig} → ${dest} | ${date} | ${cabin}`);

    try {
      const result = await httpsGet(apiUrl);
      console.log(`[SERP] Status: ${result.status} | Size: ${result.body.length}`);

      if (result.status !== 200) {
        console.log(`[SERP] Error body: ${result.body.slice(0, 500)}`);
        res.writeHead(result.status, CORS);
        res.end(result.body); return;
      }

      const data = JSON.parse(result.body);

      // SerpAPI Google Flights response structure
      const bestFlights  = data.best_flights  || [];
      const otherFlights = data.other_flights || [];
      const allFlights   = [...bestFlights, ...otherFlights];

      console.log(`[SERP] Found ${allFlights.length} results (best:${bestFlights.length} other:${otherFlights.length})`);

      // Parse into our format
      const flights = [];
      allFlights.forEach((offer, idx) => {
        const legs = offer.flights || [];
        if (!legs.length) return;

        const first = legs[0];
        const last  = legs[legs.length - 1];

        const fn       = first.flight_number || `${first.airline_logo?.match(/\/([A-Z]{2})\./)?.[1] || '??'}${idx}`;
        const airline  = first.airline || '';
        const depTime  = (first.departure_airport?.time || '').substring(11, 16) || '--:--';
        const arrTime  = (last.arrival_airport?.time   || '').substring(11, 16) || '--:--';
        const fromCode = first.departure_airport?.id   || orig;
        const toCode   = last.arrival_airport?.id      || dest;
        const aircraft = first.airplane || '';
        const stops    = legs.length - 1;
        const price    = offer.price || 0;
        const dur      = offer.total_duration
          ? `${Math.floor(offer.total_duration/60)}h ${String(offer.total_duration%60).padStart(2,'0')}m`
          : '';

        // Build legs info
        const legDetails = legs.map(l => ({
          fn:       l.flight_number || '',
          airline:  l.airline || '',
          from:     l.departure_airport?.id   || '',
          to:       l.arrival_airport?.id     || '',
          dep:      (l.departure_airport?.time || '').substring(11, 16) || '--:--',
          arr:      (l.arrival_airport?.time  || '').substring(11, 16) || '--:--',
          aircraft: l.airplane || '',
          dur:      l.duration ? `${Math.floor(l.duration/60)}h ${String(l.duration%60).padStart(2,'0')}m` : ''
        }));

        flights.push({
          id:          `${fn}-${idx}`,
          flightNum:   fn,
          airline:     airline,
          from:        fromCode,
          to:          toCode,
          depTime,
          arrTime,
          duration:    dur,
          aircraft,
          stops,
          price,
          cabin,
          legs:        legDetails,
          isBest:      idx < bestFlights.length
        });
      });

      res.writeHead(200, { 'Content-Type': 'application/json', ...CORS });
      res.end(JSON.stringify({ flights, total: flights.length }));

    } catch (e) {
      console.error('[SERP] Error:', e.message);
      res.writeHead(500, CORS);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  res.writeHead(404, CORS); res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\n  ✈  SkyFly + SerpAPI running at http://localhost:${PORT}\n`);
});
