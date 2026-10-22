'use strict';
// Small helpers that work both on Vercel's Node runtime and the local dev server (server.js).

async function readRaw(req) {
  if (req.rawBody !== undefined) return Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(String(req.rawBody));
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body);
  if (req.body && typeof req.body === 'object') return Buffer.from(JSON.stringify(req.body));
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  const raw = (await readRaw(req)).toString('utf8').trim();
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { const e = new Error('Invalid JSON body'); e.status = 400; throw e; }
}

function send(res, status, body, extraHeaders) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (extraHeaders) for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

function fail(res, status, message, extra) {
  send(res, status, Object.assign({ ok: false, error: message }, extra || {}));
}

function allow(req, res, methods) {
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.setHeader('Allow', methods.join(', ')); res.end(); return false; }
  if (!methods.includes(req.method)) { res.setHeader('Allow', methods.join(', ')); fail(res, 405, 'Method not allowed'); return false; }
  return true;
}

function getCookies(req) {
  if (req.cookies && typeof req.cookies === 'object') return req.cookies;
  const out = {};
  const h = req.headers.cookie || '';
  for (const part of h.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

function isHttps(req) {
  return process.env.VERCEL === '1' || (req.headers['x-forwarded-proto'] || '').split(',')[0] === 'https';
}

function setCookie(res, name, value, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${opts.path || '/'}`);
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.httpOnly !== false) parts.push('HttpOnly');
  parts.push(`SameSite=${opts.sameSite || 'Lax'}`);
  if (opts.secure) parts.push('Secure');
  const prev = res.getHeader('Set-Cookie');
  const list = prev ? (Array.isArray(prev) ? prev : [prev]) : [];
  list.push(parts.join('; '));
  res.setHeader('Set-Cookie', list);
}

function getQuery(req) {
  if (req.query && typeof req.query === 'object') return req.query;
  const u = new URL(req.url, 'http://localhost');
  return Object.fromEntries(u.searchParams.entries());
}

function clientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || '';
}

// Wrap a handler so thrown errors become JSON responses instead of 500 HTML.
function wrap(fn) {
  return async (req, res) => {
    try { await fn(req, res); }
    catch (err) {
      const status = err.status || 500;
      if (status >= 500) console.error('[api]', req.method, req.url, err);
      if (!res.headersSent) fail(res, status, status >= 500 ? 'Something went wrong. Please try again.' : err.message);
    }
  };
}

module.exports = { readRaw, readJson, send, fail, allow, getCookies, setCookie, getQuery, clientIp, isHttps, wrap };
