'use strict';
// POST /api/inquiry — 1:1 consultation / corporate workshop requests (not course orders). Stored under inquiries/ and shown in /admin.
const crypto = require('crypto');
const { readJson, send, fail, allow, wrap, clientIp } = require('../lib/http');
const store = require('../lib/store');
const auth = require('../lib/auth');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[6-9]\d{9}$/;

module.exports = wrap(async (req, res) => {
  if (!allow(req, res, ['POST'])) return;
  const body = await readJson(req);
  const name = String(body.name || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  const email = auth.normalizeEmail(body.email);
  const phone = String(body.phone || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  const type = String(body.type || body.inquiryType || 'Inquiry').trim().slice(0, 80);
  const notes = String(body.notes || '').trim().slice(0, 1000);
  if (name.length < 2) return fail(res, 400, 'Please enter your full name.');
  if (!EMAIL_RE.test(email)) return fail(res, 400, 'Please enter a valid email address.');
  if (!PHONE_RE.test(phone)) return fail(res, 400, 'Please enter a valid 10-digit mobile number.');
  const a = body.attribution && typeof body.attribution === 'object' ? body.attribution : {};
  const last = a.last && typeof a.last === 'object' ? a.last : {};
  const id = `inq_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
  const inquiry = { id, type, name, email, phone, notes, status: 'new', createdAt: new Date().toISOString(), ip: clientIp(req),
    source: String(last.source || '').slice(0, 100), medium: String(last.medium || '').slice(0, 100), campaign: String(last.campaign || '').slice(0, 150), landing: String(last.landing || '').slice(0, 300), page: String(a.page || '').slice(0, 300),
    userAgent: String(req.headers['user-agent'] || '').slice(0, 200), country: String(req.headers['x-vercel-ip-country'] || '').slice(0, 8), city: String(req.headers['x-vercel-ip-city'] ? decodeURIComponent(req.headers['x-vercel-ip-city']) : '').slice(0, 60) };
  await store.writeJson(`inquiries/${id}.json`, inquiry);
  send(res, 200, { ok: true, id });
});
