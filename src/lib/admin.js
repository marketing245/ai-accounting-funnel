'use strict';
// Admin panel helpers: password login (ADMIN_PASSWORD), signed admin cookie, data aggregation, CSV.
const crypto = require('crypto');
const { getCookies, setCookie, isHttps, fail } = require('./http');
const auth = require('./auth');
const store = require('./store');
const { CURRICULUM } = require('./course');

const COOKIE = 'aae_admin';
const TTL = 12 * 3600;

function checkPassword(pw) {
  const expected = process.env.ADMIN_PASSWORD || '';
  if (!expected || typeof pw !== 'string') return false;
  const a = crypto.createHash('sha256').update(pw).digest(), b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}
function setAdminSession(res, req) { setCookie(res, COOKIE, auth.signToken({ role: 'admin' }, TTL), { maxAge: TTL, secure: isHttps(req) }); }
function clearAdminSession(res, req) { setCookie(res, COOKIE, '', { maxAge: 0, secure: isHttps(req) }); }
function requireAdmin(req, res) {
  const t = auth.verifyToken(getCookies(req)[COOKIE]);
  if (!t || t.role !== 'admin') { fail(res, 401, 'Admin login required.', { code: 'UNAUTHENTICATED' }); return null; }
  return t;
}

const src = (o) => { const a = (o.attribution && (o.attribution.last || o.attribution.first)) || {}; return { source: a.source || 'unknown', medium: a.medium || '', campaign: a.campaign || '', term: a.term || '', content: a.content || '', gclid: !!a.gclid, fbclid: !!a.fbclid, referrer: a.referrer || '', landing: a.landing || '' }; };

async function overview() {
  const [orders, users, certs] = await Promise.all([store.listJson('orders/'), store.listJson('users/'), store.listJson('certificates/')]);
  orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const now = Date.now(), day = 86400000;
  const paid = orders.filter((o) => o.status === 'paid');
  const leads = orders.filter((o) => o.status !== 'paid');
  const within = (o, d) => now - new Date(o.paidAt || o.createdAt).getTime() < d * day;
  const sum = (arr) => arr.reduce((n, o) => n + (o.amount?.total || 0), 0);
  const stats = {
    paidAll: paid.length, revenueAll: sum(paid),
    paid7: paid.filter((o) => within(o, 7)).length, revenue7: sum(paid.filter((o) => within(o, 7))),
    paid30: paid.filter((o) => within(o, 30)).length, revenue30: sum(paid.filter((o) => within(o, 30))),
    leadsAll: leads.length, leads7: leads.filter((o) => within(o, 7)).length,
    students: users.filter((u) => (u.purchases || []).length).length,
    certificates: certs.length,
    checkoutConversion: orders.length ? Math.round((paid.length / orders.length) * 100) : 0,
    testOrders: orders.filter((o) => o.gateway === 'test').length,
  };
  // by source/campaign
  const bySource = {};
  for (const o of orders) {
    const s = src(o); const k = `${s.source}|${s.medium}|${s.campaign}`;
    bySource[k] = bySource[k] || { source: s.source, medium: s.medium, campaign: s.campaign, leads: 0, paid: 0, revenue: 0 };
    if (o.status === 'paid') { bySource[k].paid++; bySource[k].revenue += o.amount?.total || 0; } else bySource[k].leads++;
  }
  // daily series (last 30 days)
  const daily = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * day).toISOString().slice(0, 10);
    const dp = paid.filter((o) => (o.paidAt || '').slice(0, 10) === d), dl = orders.filter((o) => (o.createdAt || '').slice(0, 10) === d);
    daily.push({ date: d, paid: dp.length, revenue: sum(dp), checkouts: dl.length });
  }
  const certByEmailHash = new Map(certs.map((c) => [c.emailHash, c]));
  const students = users.filter((u) => (u.purchases || []).length).map((u) => ({
    name: u.name, email: u.email, phone: u.phone, purchasedAt: (u.purchases[u.purchases.length - 1] || {}).at, paid: u.purchases.reduce((n, p) => n + (p.amount || 0), 0),
    completed: ((u.progress && u.progress.completed) || []).length, total: CURRICULUM.length, hasPassword: !!u.passwordHash,
    certificate: (u.certificate && u.certificate.id) || (certByEmailHash.get(auth.userKey(u.email)) || {}).id || null, lastModule: u.progress && u.progress.lastModule,
  })).sort((a, b) => new Date(b.purchasedAt || 0) - new Date(a.purchasedAt || 0));
  const orderRows = orders.map((o) => ({ id: o.id, createdAt: o.createdAt, paidAt: o.paidAt, status: o.status, gateway: o.gateway, paymentId: o.paymentId,
    name: o.customer?.name, email: o.customer?.email, phone: o.customer?.phone, amount: o.amount?.total, gst: o.amount?.gst, ...src(o), page: o.attribution?.page || '', device: /Mobile|Android|iPhone/i.test(o.attribution?.userAgent || '') ? 'mobile' : 'desktop' }));
  return { stats, bySource: Object.values(bySource).sort((a, b) => b.paid - a.paid || b.leads - a.leads), daily, orders: orderRows, students };
}

function csv(rows, columns) {
  const esc = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [columns.join(','), ...rows.map((r) => columns.map((c) => esc(r[c])).join(','))].join('\n') + '\n';
}

module.exports = { checkPassword, setAdminSession, clearAdminSession, requireAdmin, overview, csv };
