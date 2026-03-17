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

const server = http.createServer((req, res) => {
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

  // CORS Proxy: /api?url=ENCODED_URL&apikey=KEY
  if (parsed.pathname === '/api') {
    const target = parsed.query.url;
    if (!target) { res.writeHead(400, CORS); res.end('Missing url'); return; }

    const apiKey = parsed.query.apikey || API_KEY;
    let targetUrl;
    try { targetUrl = url.parse(decodeURIComponent(target)); }
    catch(e) { res.writeHead(400, CORS); res.end('Bad url'); return; }

    const options = {
      hostname: targetUrl.hostname,
      path:     targetUrl.path,
      method:   'GET',
      headers:  {
        'User-Agent':       'SkyFly/1.0',
        'x-api-market-key': apiKey,
        'X-RapidAPI-Key':   apiKey,
        'X-RapidAPI-Host':  targetUrl.hostname,
        'Accept':           'application/json',
      }
    };

    const transport = targetUrl.protocol === 'https:' ? https : http;
    const proxyReq  = transport.request(options, proxyRes => {
      let body = '';
      proxyRes.on('data', chunk => body += chunk);
      proxyRes.on('end', () => {
        res.writeHead(proxyRes.statusCode, {
          'Content-Type': 'application/json; charset=utf-8', ...CORS
        });
        res.end(body);
      });
    });
    proxyReq.on('error', e => {
      res.writeHead(502, CORS);
      res.end(JSON.stringify({ error: e.message }));
    });
    proxyReq.end(); return;
  }

  res.writeHead(404, CORS); res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\n  ✈  SkyFly running at http://localhost:${PORT}\n`);
});
