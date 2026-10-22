'use strict';
const { allow, wrap, getQuery, fail } = require('../../lib/http');
const admin = require('../../lib/admin');
module.exports = wrap(async (req, res) => {
  if (!allow(req, res, ['GET'])) return;
  if (!admin.requireAdmin(req, res)) return;
  const type = String(getQuery(req).type || 'orders');
  const data = await admin.overview();
  let rows, cols;
  if (type === 'students') { rows = data.students; cols = ['name', 'email', 'phone', 'purchasedAt', 'paid', 'completed', 'total', 'certificate', 'hasPassword']; }
  else if (type === 'leads') { rows = data.orders.filter((o) => o.status !== 'paid'); cols = ['createdAt', 'name', 'email', 'phone', 'amount', 'source', 'medium', 'campaign', 'landing', 'device', 'id']; }
  else if (type === 'orders') { rows = data.orders; cols = ['createdAt', 'paidAt', 'status', 'name', 'email', 'phone', 'amount', 'gst', 'gateway', 'paymentId', 'source', 'medium', 'campaign', 'term', 'content', 'referrer', 'landing', 'device', 'id']; }
  else return fail(res, 400, 'type must be orders, leads or students');
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="aiae-${type}-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.end('﻿' + admin.csv(rows, cols));
});
