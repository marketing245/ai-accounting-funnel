'use strict';
// POST /api/checkout/claim — second half of the pay-first (express) checkout.
// The buyer has already paid; here they tell us where to send the login. Creates the student account,
// starts a session and sends the welcome email. Only the browser that paid holds the claim token.
const { readJson, send, fail, allow, wrap } = require('../../lib/http');
const store = require('../../lib/store');
const auth = require('../../lib/auth');
const { fulfil } = require('../../lib/fulfil');
const { checkPlaceOfSupply } = require('../../lib/states');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[6-9]\d{9}$/;

module.exports = wrap(async (req, res) => {
  if (!allow(req, res, ['POST'])) return;
  if (!auth.sameOrigin(req, res)) return;
  const body = await readJson(req);
  const orderId = String(body.orderId || '').trim();
  if (!/^order_[A-Za-z0-9_]{6,64}$/.test(orderId)) return fail(res, 400, 'Invalid order reference.');
  if (!auth.verifyClaim(orderId, String(body.claimToken || ''))) return fail(res, 403, 'This link is not valid for that order.');

  const order = await store.readJson(`orders/${orderId}.json`);
  if (!order) return fail(res, 404, 'Order not found.');
  if (order.status !== 'paid') return fail(res, 409, 'This order is not paid yet.');

  const name = String(body.name || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  const email = auth.normalizeEmail(body.email);
  const phone = String(body.phone || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  if (name.length < 2) return fail(res, 400, 'Please enter your full name.');
  if (!EMAIL_RE.test(email)) return fail(res, 400, 'Please enter a valid email address. It becomes your login.');
  if (!PHONE_RE.test(phone)) return fail(res, 400, 'Please enter a valid 10-digit Indian mobile number.');
  const place = checkPlaceOfSupply(body.state, body.gstin);
  if (place.error) return fail(res, 400, place.error);

  // Claimed once. A repeat with the same email is fine (double tap / refresh); a different email is not.
  if (order.customer && order.customer.email && order.customer.email !== email) {
    return fail(res, 409, 'This order has already been linked to another email. Please contact support.');
  }
  if (!(order.customer && order.customer.email)) {
    order.customer = { name, email, phone, state: place.state.name, stateCode: place.state.code, gstin: place.gstin };
    order.claimedAt = new Date().toISOString();
    await store.writeJson(`orders/${order.id}.json`, order);
  }

  const { user } = await fulfil(order, order.paymentId, order.paidVia || 'checkout');
  if (!user) return fail(res, 500, 'Could not create your access. Please contact support.');
  if (!user.firstLoginAt) { user.firstLoginAt = new Date().toISOString(); user.lastLoginAt = user.firstLoginAt; user.loginCount = (user.loginCount || 0) + 1; await auth.saveUser(user); }
  auth.setSession(res, req, user);
  send(res, 200, { ok: true, orderId: order.id, needsPassword: !user.passwordHash, next: `/thank-you?order=${encodeURIComponent(order.id)}` });
});
