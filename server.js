/**
 * Local development server — mirrors Vercel: static files from /public (clean URLs) + api/*.js functions.
 * Usage: node server.js   (reads .env.local if present)
 * Production runs on Vercel; this file is not used there.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

// Load .env.local (simple KEY=VALUE parser) without extra dependencies.
const envFile = path.join(__dirname, '.env.local');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}
if (process.env.VERCEL !== '1') { // dev defaults only; on Vercel the environment variables rule
  process.env.PAYMENT_MODE = process.env.PAYMENT_MODE || 'test';
  process.env.BLOB_PREFIX = process.env.BLOB_PREFIX || 'dev';
}

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const API_DIR = path.join(__dirname, 'api');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml' };

function resolveStatic(pathname) {
  let p = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[\/\\])+/, '');
  if (p === '/' || p === '') p = '/index.html';
  const candidates = [p, p + '.html', path.join(p, 'index.html')];
  for (const c of candidates) {
    const f = path.join(PUBLIC_DIR, c);
    if (f.startsWith(PUBLIC_DIR) && fs.existsSync(f) && fs.statSync(f).isFile()) return f;
  }
  return null;
}

async function runApi(req, res, pathname) {
  const rel = pathname.replace(/^\/api\//, '').replace(/\/+$/, '');
  if (!/^[a-z0-9_\-\/]+$/i.test(rel)) { res.writeHead(404); return res.end('Not found'); }
  const file = path.join(API_DIR, rel + '.js');
  if (!file.startsWith(API_DIR) || !fs.existsSync(file) || rel.startsWith('_lib')) { res.writeHead(404, { 'Content-Type': 'application/json' }); return res.end('{"ok":false,"error":"Not found"}'); }
  delete require.cache[require.resolve(file)]; // hot reload in dev
  const mod = require(file);
  const handler = typeof mod === 'function' ? mod : mod.default;
  // Vercel-style conveniences
  const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  req.query = Object.fromEntries(u.searchParams.entries());
  const parse = !(mod.config && mod.config.api && mod.config.api.bodyParser === false);
  if (parse && (req.headers['content-type'] || '').includes('application/json')) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString('utf8');
    try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = {}; }
  }
  await handler(req, res);
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    // DEV ONLY (never runs on Vercel): /dev/login-as?email=x sets a session cookie for an existing user, for screenshots/QA.
    if (u.pathname === '/dev/login-as' && process.env.VERCEL !== '1') {
      const auth = require('./api/_lib/auth');
      const user = await auth.getUser(u.searchParams.get('email') || '');
      if (!user) { res.writeHead(404); return res.end('no such user'); }
      auth.setSession(res, req, user);
      res.writeHead(302, { Location: u.searchParams.get('next') || '/portal' }); return res.end();
    }
    if (u.pathname.startsWith('/api/')) return await runApi(req, res, u.pathname);
    const f = resolveStatic(u.pathname);
    if (!f) { res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end('<h1>404</h1>'); }
    const ext = path.extname(f).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=60' });
    fs.createReadStream(f).pipe(res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end('{"ok":false,"error":"Server error"}'); }
  }
});

if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => console.log(`AI Accounting funnel (dev) → http://localhost:${PORT}  payment=${process.env.PAYMENT_MODE} storage=${process.env.BLOB_READ_WRITE_TOKEN ? 'vercel-blob/' + process.env.BLOB_PREFIX : 'local .data/'}`));
}
module.exports = server;
