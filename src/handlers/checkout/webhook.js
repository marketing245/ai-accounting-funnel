'use strict';
// Razorpay webhook (Dashboard > Settings > Webhooks > URL: https://<domain>/api/checkout/webhook, events: payment.captured, order.paid).
// Grants access even if the customer closed the browser before the checkout handler ran.
const { readRaw, send, fail, allow, wrap } = require('../../lib/http');
const store = require('../../lib/store');
const rzp = require('../../lib/razorpay');
const { fulfil } = require('../../lib/fulfil');

async function handler(req, res) {
  if (!allow(req, res, ['POST'])) return;
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
  await fulfil(order, payment.id, 'webhook');
  send(res, 200, { ok: true });
}

module.exports = wrap(handler);
module.exports.config = { api: { bodyParser: false } };
