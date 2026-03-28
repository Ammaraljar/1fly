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
      headers: { 'User-Agent': 'SkyFly/1.0', 'Accept': 'application/json' }
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
  if (!m) return '--:--';
  return `${String(m[1]).padStart(2,'0')}:${m[2]}`;
}

function fmtDur(mins) {
  if (!mins || mins <= 0) return '';
  return `${Math.floor(mins/60)}h ${String(mins%60).padStart(2,'0')}m`;
}

function serveFile(res, filename, contentType) {
  const p = path.join(__dirname, filename);
  if (!fs.existsSync(p)) { res.writeHead(404, CORS); res.end(filename + ' not found'); return; }
  res.writeHead(200, { 'Content-Type': contentType + '; charset=utf-8', ...CORS });
  res.end(fs.readFileSync(p, 'utf8'));
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return; }

  // ── Serve pages ──────────────────────────────────────────
  if (u.pathname === '/' || u.pathname === '/index.html') {
    return serveFile(res, 'index.html', 'text/html');
  }
  if (u.pathname === '/admin' || u.pathname === '/admin.html') {
    return serveFile(res, 'admin.html', 'text/html');
  }

  // ── Flight Search API ─────────────────────────────────────
  if (u.pathname === '/api') {
    const orig   = (u.searchParams.get('orig')  || '').toUpperCase();
    const dest   = (u.searchParams.get('dest')  || '').toUpperCase();
    const date   = u.searchParams.get('date')   || '';
    const cabin  = u.searchParams.get('cabin')  || 'ECONOMY';
    const adults = u.searchParams.get('adults') || '1';

    if (!orig || !dest || !date) {
      res.writeHead(400, CORS);
      res.end(JSON.stringify({ error: 'Missing orig, dest or date' })); return;
    }

    const classMap = { ECONOMY:1, PREMIUM_ECONOMY:2, BUSINESS:3, FIRST:4 };
    const params = new URLSearchParams({
      engine: 'google_flights', departure_id: orig, arrival_id: dest,
      outbound_date: date, currency: 'USD', hl: 'en',
      adults, travel_class: classMap[cabin.toUpperCase()]||1,
      type: '2', api_key: SERP_KEY
    });

    console.log(`[SERP] ${orig}→${dest} | ${date} | ${cabin}`);
    try {
      const result = await httpsGet(`https://serpapi.com/search?${params}`);
      console.log(`[SERP] Status:${result.status} Size:${result.body.length}`);
      if (result.status !== 200) { res.writeHead(result.status, CORS); res.end(result.body); return; }

      const data = JSON.parse(result.body);
      const allOffers = [...(data.best_flights||[]), ...(data.other_flights||[])];
      console.log(`[SERP] Offers:${allOffers.length}`);

      const flights = [];
      allOffers.forEach((offer, idx) => {
        const legs     = offer.flights || [];
        if (!legs.length) return;
        const first    = legs[0];
        const last     = legs[legs.length-1];
        const layovers = offer.layovers || [];
        const stops    = legs.length - 1;
        const fn       = (first.flight_number||`??${idx}`).trim();
        const totalDur = offer.total_duration ? fmtDur(offer.total_duration)
          : fmtDur(legs.reduce((s,l)=>s+(l.duration||0),0));

        const legDetails = legs.map((l,li) => {
          const lay = layovers[li]||null;
          return {
            fn:             (l.flight_number||'').trim(),
            airline:        l.airline||'',
            from:           l.departure_airport?.id ||'',
            to:             l.arrival_airport?.id   ||'',
            fromCity:       l.departure_airport?.name||'',
            toCity:         l.arrival_airport?.name ||'',
            dep:            fmtTime(l.departure_airport?.time||''),
            arr:            fmtTime(l.arrival_airport?.time ||''),
            dur:            fmtDur(l.duration||0),
            aircraft:       l.airplane||'',
            layoverMins:    lay?.duration   ||null,
            layoverAirport: lay?.name       ||null,
            layoverIata:    lay?.id         ||null,
          };
        });

        flights.push({
          id:          `${fn.replace(' ','')}-${idx}`,
          flightNum:   fn,
          airline:     first.airline||'',
          from:        first.departure_airport?.id ||orig,
          to:          last.arrival_airport?.id    ||dest,
          fromCity:    first.departure_airport?.name||'',
          toCity:      last.arrival_airport?.name  ||'',
          depTime:     fmtTime(first.departure_airport?.time||''),
          arrTime:     fmtTime(last.arrival_airport?.time  ||''),
          duration:    totalDur,
          aircraft:    first.airplane||'',
          stops, via:  stops>0?(legs[0].arrival_airport?.id||null):null,
          viaCity:     stops>0?(legs[0].arrival_airport?.name||layovers[0]?.name||null):null,
          layoverMins: stops>0&&layovers[0]?layovers[0].duration:null,
          price:       offer.price||0,
          cabin, legs: legDetails,
          isBest:      idx < (data.best_flights||[]).length
        });
      });

      res.writeHead(200, { 'Content-Type': 'application/json', ...CORS });
      res.end(JSON.stringify({ flights, total: flights.length }));
    } catch(e) {
      console.error('[SERP] Error:', e.message);
      res.writeHead(500, CORS);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  res.writeHead(404, CORS); res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\n  ✈  Otlah Travel + SerpAPI running at http://localhost:${PORT}\n`);
});
