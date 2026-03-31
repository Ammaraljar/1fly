const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const PORT     = process.env.PORT || 3001;
const SERP_KEY = '6597815d9772c000bf2addb28480236f722ddf2ccd882e6a0e033e1c62b93ade';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    https.request({
      hostname: u.hostname, path: u.pathname + u.search, method: 'GET',
      headers: { 'User-Agent': 'OtlahTravel/1.0', 'Accept': 'application/json' }
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject).end();
  });
}

function fmtTime(t) {
  if (!t) return '--:--';
  const m = t.match(/(\d{1,2}):(\d{2})/);
  return m ? `${String(m[1]).padStart(2,'0')}:${m[2]}` : '--:--';
}

function fmtDur(mins) {
  if (!mins || mins <= 0) return '';
  return `${Math.floor(mins/60)}h ${String(mins%60).padStart(2,'0')}m`;
}

function serveFile(res, filename, contentType) {
  const p = path.join(__dirname, filename);
  if (!fs.existsSync(p)) {
    res.writeHead(404, CORS);
    res.end(filename + ' not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': contentType + '; charset=utf-8', ...CORS });
  res.end(fs.readFileSync(p, 'utf8'));
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return; }

  // ── Pages ──
  if (u.pathname === '/' || u.pathname === '/index.html') return serveFile(res, 'index.html', 'text/html');
  if (u.pathname === '/admin' || u.pathname === '/admin.html') return serveFile(res, 'admin.html', 'text/html');

  // ── Flight Search API ──
  if (u.pathname === '/api') {
    const orig   = (u.searchParams.get('orig')  || '').toUpperCase().trim();
    const dest   = (u.searchParams.get('dest')  || '').toUpperCase().trim();
    const date   = u.searchParams.get('date')   || '';
    const cabin  = u.searchParams.get('cabin')  || 'ECONOMY';
    const adults = u.searchParams.get('adults') || '1';

    if (!orig || !dest || !date) {
      res.writeHead(400, CORS);
      res.end(JSON.stringify({ error: 'Missing orig, dest or date' }));
      return;
    }

    // Validate IATA codes (must be exactly 3 letters)
    if (!/^[A-Z]{3}$/.test(orig) || !/^[A-Z]{3}$/.test(dest)) {
      res.writeHead(400, CORS);
      res.end(JSON.stringify({ error: 'Invalid airport codes', orig, dest }));
      return;
    }

    const classMap = { ECONOMY:1, PREMIUM_ECONOMY:2, BUSINESS:3, FIRST:4 };
    const params = new URLSearchParams({
      engine: 'google_flights',
      departure_id: orig,   // EXACT origin airport
      arrival_id:   dest,   // EXACT destination airport
      outbound_date: date,
      currency: 'USD',
      hl: 'en',
      adults,
      travel_class: classMap[cabin.toUpperCase()] || 1,
      type: '2',            // one-way (we handle RT separately)
      api_key: SERP_KEY
    });

    console.log(`[SERP] ${orig} → ${dest} | ${date} | ${cabin} | adults:${adults}`);

    try {
      const result = await httpsGet(`https://serpapi.com/search?${params}`);
      console.log(`[SERP] Status:${result.status} Size:${result.body.length}`);

      if (result.status !== 200) {
        res.writeHead(result.status, CORS);
        res.end(result.body);
        return;
      }

      const data = JSON.parse(result.body);
      const allOffers = [...(data.best_flights||[]), ...(data.other_flights||[])];
      console.log(`[SERP] Offers found: ${allOffers.length}`);

      const flights = [];
      allOffers.forEach((offer, idx) => {
        const legs     = offer.flights || [];
        if (!legs.length) return;
        const first    = legs[0];
        const last     = legs[legs.length-1];
        const layovers = offer.layovers || [];
        const stops    = legs.length - 1;
        const fn       = (first.flight_number||`FL${idx}`).trim();
        const totalDur = offer.total_duration
          ? fmtDur(offer.total_duration)
          : fmtDur(legs.reduce((s,l)=>s+(l.duration||0),0));

        // Build per-leg details
        const legDetails = legs.map((l, li) => ({
          fn:          (l.flight_number||'').trim(),
          airline:     l.airline||'',
          from:        (l.departure_airport?.id || '').toUpperCase(),
          to:          (l.arrival_airport?.id   || '').toUpperCase(),
          fromCity:    l.departure_airport?.name || '',
          toCity:      l.arrival_airport?.name   || '',
          dep:         fmtTime(l.departure_airport?.time || ''),
          arr:         fmtTime(l.arrival_airport?.time   || ''),
          dur:         fmtDur(l.duration||0),
          aircraft:    l.airplane || '',
          layoverMins: layovers[li]?.duration || null,
        }));

        // Verify flight actually goes from orig → dest
        const flightOrig = (first.departure_airport?.id||'').toUpperCase();
        const flightDest = (last.arrival_airport?.id||'').toUpperCase();
        if (flightOrig !== orig || flightDest !== dest) {
          console.log(`[SKIP] Wrong route: ${flightOrig}→${flightDest} (expected ${orig}→${dest})`);
          return;
        }

        flights.push({
          id:          `${fn.replace(' ','')}-${idx}`,
          flightNum:   fn,
          airline:     first.airline || '',
          from:        orig,
          to:          dest,
          fromCity:    first.departure_airport?.name || '',
          toCity:      last.arrival_airport?.name    || '',
          depTime:     fmtTime(first.departure_airport?.time || ''),
          arrTime:     fmtTime(last.arrival_airport?.time   || ''),
          duration:    totalDur,
          aircraft:    first.airplane || '',
          stops,
          via:         stops>0 ? (legs[0].arrival_airport?.id||null) : null,
          viaCity:     stops>0 ? (legs[0].arrival_airport?.name || layovers[0]?.name || null) : null,
          layoverMins: stops>0 && layovers[0] ? layovers[0].duration : null,
          price:       offer.price || 0,
          cabin,
          legs:        legDetails,
          isBest:      idx < (data.best_flights||[]).length
        });
      });

      console.log(`[SERP] Valid ${orig}→${dest} flights: ${flights.length}`);
      res.writeHead(200, { 'Content-Type': 'application/json', ...CORS });
      res.end(JSON.stringify({ flights, total: flights.length, orig, dest, date }));

    } catch(e) {
      console.error('[SERP] Error:', e.message);
      res.writeHead(500, CORS);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  res.writeHead(404, CORS);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\n  ✈  Otlah Travel Server`);
  console.log(`  🟢  Running at: http://localhost:${PORT}`);
  console.log(`  📂  Serving: index.html + admin.html`);
  console.log(`  🔑  SerpAPI: Google Flights\n`);
});
