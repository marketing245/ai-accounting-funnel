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
  const body = b64u(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds }));
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
  const token = signToken({ sub: userKey(user.email), email: user.email, name: user.name }, SESSION_DAYS * 86400);
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

// Signed one-off tokens for the test gateway (no real money).
function signTestPayment(orderId) { return b64u(hmac(`test-payment|${orderId}`, '|test')); }
function verifyTestPayment(orderId, token) {
  const expected = signTestPayment(orderId);
  return typeof token === 'string' && token.length === expected.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

module.exports = { signToken, verifyToken, hashPassword, verifyPassword, normalizeEmail, userKey, getUser, saveUser,
  setSession, clearSession, getSession, requireSession, signTestPayment, verifyTestPayment, COOKIE };
