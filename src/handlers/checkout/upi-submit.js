'use strict';
// POST /api/checkout/upi-submit — direct-UPI checkout, step 2: the buyer says the payment went through in their UPI app
// (plus email/WhatsApp/name/state when the order was started without details on /pay). The UTR is optional: the admin matches the
// payment by amount + the order's note code (e.g. "VVTCPSG6", sent in the UPI note). The order then waits for approval in /admin.
const { readJson, send, fail, allow, wrap } = require('../../lib/http');
const store = require('../../lib/store');
const auth = require('../../lib/auth');
const upi = require('../../lib/upi');
const { UPI } = require('../../lib/config');
const { checkPlaceOfSupply } = require('../../lib/states');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[6-9]\d{9}$/;

module.exports = wrap(async (req, res) => {
  if (!allow(req, res, ['POST'])) return;
  if (!auth.sameOrigin(req, res)) return;
  const body = await readJson(req);
  const orderId = String(body.orderId || '').trim();
  if (!/^order_upi_[a-f0-9]{16}$/.test(orderId)) return fail(res, 400, 'Invalid order reference.');
  if (!auth.verifyClaim(orderId, String(body.submitToken || ''))) return fail(res, 403, 'This payment page has expired. Please start the checkout again.');

  const order = await store.readJson(`orders/${orderId}.json`);
  if (!order || order.gateway !== 'upi') return fail(res, 404, 'Order not found.');
  if (order.status === 'paid') return send(res, 200, { ok: true, orderId, status: 'paid', accessWithin: UPI.accessWithin, email: order.customer && order.customer.email });

  const utr = upi.cleanUtr(body.utr);
  if (utr && !upi.validUtr(utr)) return fail(res, 400, 'The UPI transaction ID (UTR / UPI Ref No.) has 12 digits. Please check it, or leave it empty.', { code: 'BAD_UTR' });
  if (utr) {
    const seen = await store.readJson(`upi-utr/${utr}.json`);
    if (seen && seen.orderId !== orderId) return fail(res, 409, 'This UPI transaction ID has already been used for another order. Please check the number, or email us.', { code: 'UTR_USED' });
  }

  if (!(order.customer && order.customer.email)) {
    const name = String(body.name || '').trim().replace(/\s+/g, ' ').slice(0, 80);
    const email = auth.normalizeEmail(body.email);
    const phone = String(body.phone || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
    if (!EMAIL_RE.test(email)) return fail(res, 400, 'Please enter a valid email address. Your course access is sent here.');
    if (!PHONE_RE.test(phone)) return fail(res, 400, 'Please enter a valid 10-digit Indian mobile number.');
    if (name.length < 2) return fail(res, 400, 'Please enter your full name.');
    const place = checkPlaceOfSupply(body.state, body.gstin);
    if (place.error) return fail(res, 400, place.error);
    order.customer = { name, email, phone, state: place.state.name, stateCode: place.state.code, gstin: place.gstin };
    order.claimedAt = new Date().toISOString();
  }

  const now = new Date().toISOString();
  order.upi = order.upi || {};
  order.upi.history = (order.upi.history || []).concat([{ utr: utr || null, at: now }]).slice(-10);
  if (utr) order.upi.utr = utr;
  order.upi.submittedAt = now;
  order.status = 'awaiting_verification';
  if (utr) await store.writeJson(`upi-utr/${utr}.json`, { orderId, at: now });
  await store.writeJson(`orders/${order.id}.json`, order);
  send(res, 200, { ok: true, orderId, status: order.status, accessWithin: UPI.accessWithin, email: order.customer.email, ref: order.upi.ref,
    amount: order.amount, items: order.items.map((i) => ({ id: i.id, name: i.name, price: i.price, qty: i.qty })) });
});
