/**
 * Production server for AWS (EC2 behind CloudFront). Same app as Vercel: static files from /public + api/index.js.
 * Differences from server.js (local dev): no .env.local, no /dev/* routes, no hot reload, and the vercel.json
 * headers/redirects are applied here. Environment comes from the systemd EnvironmentFile.
 * Usage: node server-aws.js   (PORT defaults to 3000)
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

for (const k of ['AUTH_SECRET', 'BLOB_READ_WRITE_TOKEN', 'SITE_URL', 'PAYMENT_MODE']) {
  if (!process.env[k]) { console.error(`Missing ${k} in the environment`); process.exit(1); }
}
process.env.BLOB_PREFIX = process.env.BLOB_PREFIX || 'prod';

const handler = require('./api/index.js');
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml',
  '.pdf': 'application/pdf', '.woff2': 'font/woff2' };
const SECURITY = { 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN', 'Referrer-Policy': 'strict-origin-when-cross-origin' };
const PRIVATE_PAGES = /^\/(portal|thank-you|login|admin)(\.html)?$/;

function resolveStatic(pathname) {
  let p;
  try { p = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[\/\\])+/, ''); } catch { return null; }
  if (p === '/' || p === '') p = '/index.html';
  for (const c of [p, p + '.html', path.join(p, 'index.html')]) {
    const f = path.join(PUBLIC_DIR, c);
    if (f.startsWith(PUBLIC_DIR + path.sep) && fs.existsSync(f) && fs.statSync(f).isFile()) return f;
  }
  return null;
}

// CloudFront → the header names the app already reads (Vercel's), so geo, https and host checks keep working.
function adaptHeaders(req) {
  const h = req.headers;
  if (h['cloudfront-forwarded-proto'] && !h['x-forwarded-proto']) h['x-forwarded-proto'] = h['cloudfront-forwarded-proto'];
  if (h['cloudfront-viewer-country']) h['x-vercel-ip-country'] = h['cloudfront-viewer-country'];
  if (h['cloudfront-viewer-country-region']) h['x-vercel-ip-country-region'] = h['cloudfront-viewer-country-region'];
  if (h['cloudfront-viewer-city']) h['x-vercel-ip-city'] = h['cloudfront-viewer-city'];
}

const server = http.createServer(async (req, res) => {
  adaptHeaders(req);
  for (const [k, v] of Object.entries(SECURITY)) res.setHeader(k, v);
  const u = new URL(req.url, 'http://localhost');
  try {
    // Bare domain → www (one canonical address for cookies, pixels and Google).
    const host = String(req.headers.host || '').toLowerCase().split(':')[0];
    if (host === 'cavarshavaryani.com') { res.writeHead(301, { Location: 'https://www.cavarshavaryani.com' + req.url }); return res.end(); }
    if (u.pathname === '/workshops') { res.writeHead(307, { Location: '/' }); return res.end(); }
    if (u.pathname.startsWith('/api/')) { res.setHeader('Cache-Control', 'no-store'); return await handler(req, res); }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    const f = resolveStatic(u.pathname);
    if (!f) { res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end('<h1>404</h1>'); }
    const ext = path.extname(f).toLowerCase();
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=300' };
    if (PRIVATE_PAGES.test(u.pathname)) headers['X-Robots-Tag'] = 'noindex';
    res.writeHead(200, headers);
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(f).pipe(res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end('{"ok":false,"error":"Server error"}'); }
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`AI Accounting funnel (AWS) on :${PORT} payment=${process.env.PAYMENT_MODE} store=${process.env.BLOB_PREFIX}`));
