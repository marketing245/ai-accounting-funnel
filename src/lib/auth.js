'use strict';
const crypto = require('crypto');
const { getCookies, setCookie, isHttps, fail } = require('./http');
const store = require('./store');

const COOKIE = 'aae_session';
const SESSION_DAYS = 30;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 24) return s;
  if (process.env.VERCEL_ENV === 'production') throw new Error('AUTH_SECRET is not configured');
  return 'dev-only-secret-change-me-before-going-live';
}

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const hmac = (data, salt = '') => crypto.createHmac('sha256', secret() + salt).update(data).digest();

function signToken(payload, ttlSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const body = b64u(JSON.stringify({ ...payload, iat: now, exp: now + ttlSeconds }));
  return `${body}.${b64u(hmac(body))}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const i = token.lastIndexOf('.');
  if (i < 0) return null;
  const body = token.slice(0, i), sig = token.slice(i + 1);
  const expected = b64u(hmac(body));
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { return null; }
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

// Passwords: scrypt with per-user salt.
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
  return `scrypt$${salt}$${hash}`;
}
function verifyPassword(pw, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const [algo, salt, hash] = stored.split('$');
  if (algo !== 'scrypt' || !salt || !hash) return false;
  const test = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  const ref = Buffer.from(hash, 'hex');
  return test.length === ref.length && crypto.timingSafeEqual(test, ref);
}

function normalizeEmail(email) { return String(email || '').trim().toLowerCase(); }
function userKey(email) { return crypto.createHash('sha256').update(normalizeEmail(email)).digest('hex'); }

async function getUser(email) { return store.readJson(`users/${userKey(email)}.json`); }
async function saveUser(user) { await store.writeJson(`users/${userKey(user.email)}.json`, user); }

function setSession(res, req, user) {
  const token = signToken({ sub: userKey(user.email), email: user.email, name: user.name, pv: user.passwordSetAt ? Date.parse(user.passwordSetAt) : 0 }, SESSION_DAYS * 86400);
  setCookie(res, COOKIE, token, { maxAge: SESSION_DAYS * 86400, secure: isHttps(req) });
}
function clearSession(res, req) { setCookie(res, COOKIE, '', { maxAge: 0, secure: isHttps(req) }); }

function getSession(req) { return verifyToken(getCookies(req)[COOKIE]); }

// Returns the session payload, or sends 401 and returns null.
function requireSession(req, res) {
  const s = getSession(req);
  if (!s) { fail(res, 401, 'Please log in to continue.', { code: 'UNAUTHENTICATED' }); return null; }
  return s;
}

// Does this account currently have course access? In LIVE mode only real (non-test) purchases count,
// unless the email is on ACCESS_ALLOWLIST (comma-separated, for the instructor / team demos).
function hasAccess(user) {
  if (!user || !Array.isArray(user.purchases) || !user.purchases.length) return false;
  const { paymentMode } = require('./config');
  if (paymentMode() === 'test') return true;
  const allow = String(process.env.ACCESS_ALLOWLIST || '').split(',').map((e) => normalizeEmail(e)).filter(Boolean);
  if (allow.includes(normalizeEmail(user.email))) return true;
  return user.purchases.some((p) => p.gateway && p.gateway !== 'test');
}

// Session + fresh user record in one go. Sends 401/403 itself and returns null when the caller must stop.
// A password change invalidates sessions issued before it (token.pv vs user.passwordSetAt).
async function loadSessionUser(req, res, { requireAccess = true } = {}) {
  const s = getSession(req);
  if (!s) { fail(res, 401, 'Please log in to continue.', { code: 'UNAUTHENTICATED' }); return null; }
  const user = await getUser(s.email);
  if (!user) { clearSession(res, req); fail(res, 401, 'Session expired.', { code: 'UNAUTHENTICATED' }); return null; }
  const pv = user.passwordSetAt ? Date.parse(user.passwordSetAt) : 0;
  if (pv && (s.pv || 0) < pv - 2000) { clearSession(res, req); fail(res, 401, 'Your password was changed. Please log in again.', { code: 'UNAUTHENTICATED' }); return null; }
  if (requireAccess && !hasAccess(user)) { fail(res, 403, 'No active course purchase on this account.', { code: 'NO_ACCESS' }); return null; }
  return user;
}

// Defence in depth against cross-site POSTs (cookies are SameSite=Lax already): a present Origin must be ours.
function sameOrigin(req, res) {
  const origin = req.headers.origin;
  if (!origin || req.method === 'GET') return true;
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim().toLowerCase();
  let oh = '';
  try { oh = new URL(origin).host.toLowerCase(); } catch { oh = ''; }
  if (oh && host && oh === host) return true;
  fail(res, 403, 'Cross-site request blocked.', { code: 'BAD_ORIGIN' });
  return false;
}

// Signed, time-boxed form token for public POSTs (checkout, inquiry): must be ≥3 s and ≤6 h old. Cheap bot filter.
function issueFormToken() { const t = Date.now(); return `${t}.${b64u(hmac(`form|${t}`, '|form'))}`; }
function checkFormToken(token) {
  const [t, sig] = String(token || '').split('.');
  if (!/^\d{10,16}$/.test(t || '') || !sig) return 'missing';
  const expected = b64u(hmac(`form|${t}`, '|form'));
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return 'invalid';
  const age = Date.now() - Number(t);
  if (age < 3000) return 'too_fast';
  if (age > 6 * 3600 * 1000) return 'expired';
  return null;
}

// Signed one-off tokens for the test gateway (no real money).
function signTestPayment(orderId) { return b64u(hmac(`test-payment|${orderId}`, '|test')); }
function verifyTestPayment(orderId, token) {
  const expected = signTestPayment(orderId);
  return typeof token === 'string' && token.length === expected.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

module.exports = { signToken, verifyToken, hashPassword, verifyPassword, normalizeEmail, userKey, getUser, saveUser,
  setSession, clearSession, getSession, requireSession, loadSessionUser, hasAccess, sameOrigin, issueFormToken, checkFormToken, signTestPayment, verifyTestPayment, COOKIE };
