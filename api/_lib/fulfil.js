'use strict';
// Marks an order paid and grants course access to the customer. Idempotent (safe for checkout + webhook).
const store = require('./store');
const auth = require('./auth');

async function fulfil(order, paymentId, source) {
  const now = new Date().toISOString();
  if (order.status !== 'paid') {
    order.status = 'paid'; order.paidAt = now; order.paymentId = paymentId; order.paidVia = source;
    await store.writeJson(`orders/${order.id}.json`, order);
  }
  const email = auth.normalizeEmail(order.customer.email);
  let user = await auth.getUser(email);
  if (!user) {
    user = { email, name: order.customer.name, phone: order.customer.phone, createdAt: now, passwordHash: null,
      purchases: [], progress: { completed: [] }, hasBump: false, failedLogins: 0, lockedUntil: null };
  }
  if (!user.purchases.some((p) => p.orderId === order.id)) {
    user.purchases.push({ orderId: order.id, paymentId, amount: order.amount.total, currency: order.amount.currency, items: order.items, bump: !!order.bump, at: now, gateway: order.gateway });
    if (order.bump) user.hasBump = true;
    if (!user.phone && order.customer.phone) user.phone = order.customer.phone;
    await auth.saveUser(user);
  }
  return { order, user };
}

module.exports = { fulfil };
