'use strict';
// Razorpay webhook (Dashboard > Settings > Webhooks > URL: https://<domain>/api/checkout/webhook, events: payment.captured, order.paid).
// Grants access even if the customer closed the browser before the checkout handler ran.
const { readRaw, send, fail, allow, wrap } = require('../../lib/http');
const store = require('../../lib/store');
const rzp = require('../../lib/razorpay');
const { fulfil } = require('../../lib/fulfil');

// Cashfree webhook: sent to order_meta.notify_url (set per order in create-order), so no dashboard setup is needed.
// The signature is checked, then the order is re-confirmed with the Cashfree API before access is granted.
async function cashfreeHook(req, res, raw) {
  const cf = require('../../lib/cashfree');
  if (!cf.verifyWebhookSignature(raw, req.headers['x-webhook-timestamp'], req.headers['x-webhook-signature'])) return fail(res, 400, 'Bad signature');
  let event;
  try { event = JSON.parse(raw.toString('utf8')); } catch { return fail(res, 400, 'Bad JSON'); }
  const orderId = event?.data?.order?.order_id;
  if (event.type !== 'PAYMENT_SUCCESS_WEBHOOK' || !orderId) return send(res, 200, { ok: true, ignored: event.type || 'unknown' });
  const order = await store.readJson(`orders/${orderId}.json`);
  if (!order || order.gateway !== 'cashfree') return send(res, 200, { ok: true, ignored: 'unknown order' });
  if (order.status === 'paid') return send(res, 200, { ok: true, already: true });
  const r = await cf.confirmPaid(orderId, order.amount.total);
  if (!r.paid) return send(res, 200, { ok: true, ignored: r.status });
  if (order.flow === 'payfirst' && !(order.customer && order.customer.email)) order.payer = { email: r.payer.email || '', phone: r.payer.phone || (order.payer && order.payer.phone) || '' };
  await fulfil(order, r.paymentId, 'webhook');
  send(res, 200, { ok: true });
}

async function handler(req, res) {
  if (!allow(req, res, ['POST'])) return;
  if (req.headers['x-webhook-signature']) return cashfreeHook(req, res, await readRaw(req));
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) return fail(res, 503, 'Webhook secret not configured');
  const raw = await readRaw(req);
  if (!rzp.verifyWebhookSignature(raw, req.headers['x-razorpay-signature'])) return fail(res, 400, 'Bad signature');

  let event;
  try { event = JSON.parse(raw.toString('utf8')); } catch { return fail(res, 400, 'Bad JSON'); }
  const type = event.event;
  const payment = event.payload?.payment?.entity;
  if (!['payment.captured', 'order.paid'].includes(type) || !payment?.order_id) return send(res, 200, { ok: true, ignored: type });

  const order = await store.readJson(`orders/${payment.order_id}.json`);
  if (!order) return send(res, 200, { ok: true, ignored: 'unknown order' });
  if (Number(payment.amount) !== order.amount.totalPaise) return send(res, 200, { ok: true, ignored: 'amount mismatch' });
  // Pay-first order whose buyer closed the page before giving details: keep Razorpay's contact so the team can follow up.
  if (order.flow === 'payfirst' && !(order.customer && order.customer.email) && !order.payer) order.payer = require('./verify').payerFrom(payment);
  await fulfil(order, payment.id, 'webhook');
  send(res, 200, { ok: true });
}

module.exports = wrap(handler);
module.exports.config = { api: { bodyParser: false } };
