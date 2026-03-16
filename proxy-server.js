// ============================================================
//  SkyFly Proxy Server — يحل مشكلة CORS نهائياً
//  تشغيل: node proxy-server.js
//  المتطلبات: Node.js فقط (مثبت على كل جهاز)
//  بعد التشغيل افتح: http://localhost:3001
// ============================================================
const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

const PORT = process.env.PORT || 3001;

// ── CORS Headers ────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ── Main Request Handler ─────────────────────────────────────
const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  // ── Serve the HTML file ──────────────────────────────────
  if (parsed.pathname === '/' || parsed.pathname === '/index.html') {
    const htmlFile = path.join(__dirname, 'skyfly-live.html');
    if (!fs.existsSync(htmlFile)) {
      res.writeHead(404); res.end('skyfly-live.html not found in same folder');
      return;
    }
    const html = fs.readFileSync(htmlFile, 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...CORS });
    res.end(html);
    return;
  }

  // ── Proxy: /api?url=<encoded_aviationstack_url> ──────────
  if (parsed.pathname === '/api') {
    const target = parsed.query.url;
    if (!target) {
      res.writeHead(400, CORS); res.end('Missing ?url= parameter');
      return;
    }

    const targetUrl = url.parse(target);
    const options = {
      hostname: targetUrl.hostname,
      path:     targetUrl.path,
      method:   'GET',
      headers:  { 'User-Agent': 'SkyFly-Proxy/1.0' }
    };

    // Use https or http based on target protocol
    const transport = (targetUrl.protocol === 'https:') ? https : http;

    const proxyReq = transport.request(options, (proxyRes) => {
      let body = '';
      proxyRes.on('data', chunk => body += chunk);
      proxyRes.on('end', () => {
        res.writeHead(proxyRes.statusCode, {
          'Content-Type': 'application/json; charset=utf-8',
          ...CORS
        });
        res.end(body);
      });
    });

    proxyReq.on('error', (e) => {
      res.writeHead(502, CORS);
      res.end(JSON.stringify({ error: 'Proxy error: ' + e.message }));
    });

    proxyReq.end();
    return;
  }

  res.writeHead(404, CORS);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ✈  SkyFly Proxy Server');
  console.log('  ─────────────────────────────────────');
  console.log(`  🟢  Running at:  http://localhost:${PORT}`);
  console.log('  📂  Serving:     skyfly-live.html');
  console.log('  🔑  API Proxy:   http://localhost:' + PORT + '/api?url=...');
  console.log('  ─────────────────────────────────────');
  console.log('  افتح المتصفح على: http://localhost:' + PORT);
  console.log('');
});
