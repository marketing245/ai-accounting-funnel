'use strict';
const crypto = require('crypto');
const { readJson, send, fail, allow, wrap, clientIp } = require('../../lib/http');
const { PRODUCT, computeAmount, paymentMode } = require('../../lib/config');
const store = require('../../lib/store');
const auth = require('../../lib/auth');
const rzp = require('../../lib/razorpay');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[6-9]\d{9}$/;

module.exports = wrap(async (req, res) => {
  if (!allow(req, res, ['POST'])) return;
  if (!auth.sameOrigin(req, res)) return;
  const body = await readJson(req);
  if (String(body.website || body.company_url || '').trim()) return fail(res, 400, 'Spam check failed.');
  const ft = auth.checkFormToken(body.formToken);
  if (ft) return fail(res, 400, ft === 'too_fast' ? 'Please take a moment and try again.' : 'Your form session expired — please refresh the page and try again.', { code: 'FORM_TOKEN', reason: ft });
  const name = String(body.name || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  const email = auth.normalizeEmail(body.email);
  const phone = String(body.phone || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');

  if (name.length < 2) return fail(res, 400, 'Please enter your full name.');
  if (!EMAIL_RE.test(email)) return fail(res, 400, 'Please enter a valid email address — it becomes your login.');
  if (!PHONE_RE.test(phone)) return fail(res, 400, 'Please enter a valid 10-digit Indian mobile number.');

  const mode = paymentMode();
  if (mode === 'disabled') return fail(res, 503, 'Payments are not configured yet. Please try again later.');

  const amount = computeAmount();
  const items = [{ id: PRODUCT.id, name: PRODUCT.name, price: amount.base, qty: 1 }];

  // Attribution: everything the browser remembered (see public/analytics.js) + what the request itself tells us.
  const str = (v, n = 200) => String(v == null ? '' : v).slice(0, n);
  const TOUCH_KEYS = ['at', 'landing', 'referrer', 'referrerHost', 'source', 'medium', 'campaign', 'term', 'content', 'id', 'gclid', 'gbraid', 'wbraid', 'dclid', 'fbclid', 'ttclid', 'msclkid', 'li_fat_id', 'twclid', 'sclid'];
  const cleanTouch = (t) => t && typeof t === 'object' ? Object.fromEntries(TOUCH_KEYS.map((k) => [k, str(t[k], k === 'referrer' || k === 'landing' ? 300 : 200)])) : null;
  const a = body.attribution && typeof body.attribution === 'object' ? body.attribution : {};
  const ua = require('../../lib/ua').parse(req.headers['user-agent']);
  const attribution = {
    vid: str(a.vid, 40), firstSeen: str(a.firstSeen, 40), sessions: Number(a.sessions) || 0, pageviews: Number(a.pageviews) || 0,
    first: cleanTouch(a.first), last: cleanTouch(a.last), touches: Array.isArray(a.touches) ? a.touches.slice(-10).map(cleanTouch).filter(Boolean) : [],
    page: str(a.page, 300), screen: str(a.screen, 20), tz: str(a.tz, 60), lang: str(a.lang, 20), fbp: str(a.fbp, 100), fbc: str(a.fbc, 300), ga: str(a.ga, 100),
    userAgent: str(req.headers['user-agent'], 300), ...ua,
    geo: { country: str(req.headers['x-vercel-ip-country'], 8), region: str(req.headers['x-vercel-ip-country-region'], 40), city: str(req.headers['x-vercel-ip-city'] ? decodeURIComponent(req.headers['x-vercel-ip-city']) : '', 60) },
  };

  const order = {
    id: null, gateway: mode, status: 'created',
    customer: { name, email, phone },
    items, amount,
    createdAt: new Date().toISOString(), paidAt: null, paymentId: null,
    ip: clientIp(req),
    attribution,
    signals: {},
  };

  let response;
  if (mode === 'razorpay') {
    const receipt = `aiae_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
    const r = await rzp.createOrder({ amountPaise: amount.totalPaise, receipt, notes: { email, phone, name, product: PRODUCT.id } });
    order.id = r.id; order.receipt = receipt;
    response = {
      gateway: 'razorpay', orderId: r.id, keyId: rzp.keyId(), amountPaise: amount.totalPaise, currency: 'INR',
      description: PRODUCT.shortName,
      prefill: { name, email, contact: `+91${phone}` },
    };
  } else {
    order.id = `order_test_${crypto.randomBytes(8).toString('hex')}`;
    response = { gateway: 'test', orderId: order.id, amountPaise: amount.totalPaise, currency: 'INR', testToken: auth.signTestPayment(order.id) };
  }

  const meta = require('../../lib/meta');
  if (meta.configured()) { order.signals.metaInitiateCheckout = await meta.sendEvent(order, 'InitiateCheckout'); }
  await store.writeJson(`orders/${order.id}.json`, order);
  send(res, 200, { ok: true, ...response, amount });
});
