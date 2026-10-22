'use strict';
// Admin panel: password login (ADMIN_PASSWORD), signed admin cookie, data aggregation (cached 60 s), CSV + ad-platform exports.
const crypto = require('crypto');
const { getCookies, setCookie, isHttps, fail } = require('./http');
const auth = require('./auth');
const store = require('./store');
const { CURRICULUM } = require('./course');
const { paymentMode, PRODUCT } = require('./config');

const COOKIE = 'aae_admin';
const TTL = 12 * 3600;
const CACHE_MS = 60 * 1000;
let cache = { at: 0, data: null };

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

const CLICK_IDS = ['gclid', 'gbraid', 'wbraid', 'dclid', 'fbclid', 'ttclid', 'msclkid', 'li_fat_id', 'twclid', 'sclid'];
const touchOf = (o, which) => (o.attribution && o.attribution[which]) || null;
function flat(o) {
  const a = o.attribution || {}; const last = touchOf(o, 'last') || {}; const first = touchOf(o, 'first') || {};
  const clickIds = Object.fromEntries(CLICK_IDS.map((k) => [k, last[k] || first[k] || '']));
  const platform = clickIds.gclid || clickIds.gbraid || clickIds.wbraid ? 'google_ads' : clickIds.fbclid ? 'meta_ads' : clickIds.ttclid ? 'tiktok_ads' : clickIds.msclkid ? 'microsoft_ads' : clickIds.li_fat_id ? 'linkedin_ads' : '';
  const sig = o.signals || {};
  return {
    id: o.id, createdAt: o.createdAt, paidAt: o.paidAt, status: o.status, gateway: o.gateway, paymentId: o.paymentId, paidVia: o.paidVia,
    name: o.customer?.name, email: o.customer?.email, phone: o.customer?.phone, amount: o.amount?.total, gst: o.amount?.gst,
    source: last.source || 'unknown', medium: last.medium || '', campaign: last.campaign || '', term: last.term || '', content: last.content || '', utmId: last.id || '',
    firstSource: first.source || '', firstMedium: first.medium || '', firstCampaign: first.campaign || '', firstAt: first.at || a.firstSeen || '',
    referrer: last.referrerHost || first.referrerHost || '', landing: last.landing || first.landing || '', page: a.page || '',
    ...clickIds, platform,
    device: a.device || '', os: a.os || '', browser: a.browser || '', inApp: a.inApp || '', screen: a.screen || '', lang: a.lang || '', tz: a.tz || '',
    country: a.geo?.country || '', region: a.geo?.region || '', city: a.geo?.city || '', ip: o.ip || '',
    vid: a.vid || '', sessions: a.sessions || 0, pageviews: a.pageviews || 0, touches: (a.touches || []).length,
    hoursToPurchase: o.paidAt && (first.at || a.firstSeen) ? Math.round((new Date(o.paidAt) - new Date(first.at || a.firstSeen)) / 36e5 * 10) / 10 : null,
    fbp: !!a.fbp, fbc: !!a.fbc,
    metaInitiateCheckout: sig.metaInitiateCheckout?.status || '', metaPurchase: sig.metaPurchase?.status || '', metaError: sig.metaPurchase?.error || sig.metaInitiateCheckout?.error || '',
  };
}

function group(rows, keyFn, labelFn) {
  const m = {};
  for (const r of rows) {
    const k = keyFn(r); if (!m[k]) m[k] = Object.assign({ checkouts: 0, leads: 0, paid: 0, revenue: 0 }, labelFn(r));
    m[k].checkouts++; if (r.status === 'paid') { m[k].paid++; m[k].revenue += r.amount || 0; } else m[k].leads++;
  }
  return Object.values(m).map((g) => ({ ...g, conversion: g.checkouts ? Math.round((g.paid / g.checkouts) * 100) : 0 })).sort((a, b) => b.paid - a.paid || b.revenue - a.revenue || b.checkouts - a.checkouts);
}

async function loadAll(force) {
  if (!force && cache.data && Date.now() - cache.at < CACHE_MS) return cache.data;
  const [orders, users, certs, inquiries] = await Promise.all([store.listJson('orders/'), store.listJson('users/'), store.listJson('certificates/'), store.listJson('inquiries/')]);
  orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  inquiries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  cache = { at: Date.now(), data: { orders, users, certs, inquiries } };
  return cache.data;
}
function invalidate() { cache = { at: 0, data: null }; }
store.setOnWrite(() => invalidate());

async function overview({ days = 30, force = false } = {}) {
  const { orders, users, certs, inquiries } = await loadAll(force);
  const now = Date.now(), day = 86400000;
  const inRange = (o) => days === 'all' || now - new Date(o.createdAt).getTime() < Number(days) * day;
  const inquiryRows = inquiries.filter(inRange).map((q) => ({ id: q.id, createdAt: q.createdAt, type: q.type, name: q.name, email: q.email, phone: q.phone, notes: q.notes, status: q.status, source: q.source || 'unknown', medium: q.medium || '', campaign: q.campaign || '', landing: q.landing || '', city: q.city || '', country: q.country || '' }));
  const rowsAll = orders.map(flat);
  const rows = rowsAll.filter(inRange);
  const paid = rows.filter((r) => r.status === 'paid'), leads = rows.filter((r) => r.status !== 'paid');
  const sum = (arr) => arr.reduce((n, r) => n + (r.amount || 0), 0);
  const median = (arr) => { const v = arr.filter((x) => x != null).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; };
  const stats = {
    days, checkouts: rows.length, leads: leads.length, paid: paid.length, revenue: sum(paid), gst: paid.reduce((n, r) => n + (r.gst || 0), 0),
    conversion: rows.length ? Math.round((paid.length / rows.length) * 100) : 0, aov: paid.length ? Math.round(sum(paid) / paid.length) : 0,
    medianHoursToPurchase: median(paid.map((r) => r.hoursToPurchase)),
    paidAll: rowsAll.filter((r) => r.status === 'paid').length, revenueAll: sum(rowsAll.filter((r) => r.status === 'paid')),
    students: users.filter((u) => (u.purchases || []).length).length, certificates: certs.length,
    activeStudents7d: users.filter((u) => u.progress && u.progress.updatedAt && now - new Date(u.progress.updatedAt) < 7 * day).length,
    completed: users.filter((u) => u.certificate && u.certificate.id).length,
    testOrders: rows.filter((r) => r.gateway === 'test').length,
    withClickId: rows.filter((r) => r.platform).length,
    metaSent: rows.filter((r) => r.metaPurchase === 'sent').length,
    inquiries: inquiryRows.length,
  };
  const series = [];
  const n = days === 'all' ? 90 : Math.min(Number(days), 365);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now - i * day).toISOString().slice(0, 10);
    const dp = rowsAll.filter((r) => (r.paidAt || '').slice(0, 10) === d), dc = rowsAll.filter((r) => (r.createdAt || '').slice(0, 10) === d);
    series.push({ date: d, checkouts: dc.length, paid: dp.length, revenue: sum(dp) });
  }
  const certByHash = new Map(certs.map((c) => [c.emailHash, c]));
  const students = users.filter((u) => (u.purchases || []).length).map((u) => studentRow(u, certByHash)).sort((a, b) => new Date(b.purchasedAt || 0) - new Date(a.purchasedAt || 0));
  const engagement = engagementSummary(students);
  return {
    stats, series, orders: rows, students, engagement, inquiries: inquiryRows,
    bySource: group(rows, (r) => `${r.source}|${r.medium}`, (r) => ({ source: r.source, medium: r.medium })),
    byCampaign: group(rows, (r) => `${r.source}|${r.medium}|${r.campaign}|${r.term}|${r.content}`, (r) => ({ source: r.source, medium: r.medium, campaign: r.campaign, term: r.term, content: r.content })),
    byPlatform: group(rows, (r) => r.platform || 'no click id', (r) => ({ platform: r.platform || 'no click id' })),
    byLanding: group(rows, (r) => (r.landing || '').split('?')[0] || '/', (r) => ({ landing: (r.landing || '').split('?')[0] || '/' })),
    byDevice: group(rows, (r) => `${r.device}|${r.os}`, (r) => ({ device: r.device || 'unknown', os: r.os || '' })),
    byCountry: group(rows, (r) => `${r.country}|${r.city}`, (r) => ({ country: r.country || '—', city: r.city || '' })),
    byReferrer: group(rows.filter((r) => r.referrer), (r) => r.referrer, (r) => ({ referrer: r.referrer })),
    settings: settingsHealth(),
  };
}

function studentRow(u, certByHash) {
  const p = u.progress || {}; const mods = p.modules || {};
  const perModule = CURRICULUM.map((m) => { const x = mods[m.id] || {}; return { id: m.id, code: m.code, title: m.title, views: x.views || 0, watchMin: Math.round((x.watchSeconds || 0) / 60), activeMin: Math.round((x.activeSeconds || 0) / 60), firstViewedAt: x.firstViewedAt || null, lastViewedAt: x.lastViewedAt || null, completedAt: x.completedAt || null, completed: (p.completed || []).includes(m.id) }; });
  const watchMin = perModule.reduce((n, m) => n + m.watchMin, 0), activeMin = perModule.reduce((n, m) => n + m.activeMin, 0);
  const last = u.purchases[u.purchases.length - 1] || {};
  const lastActive = [p.updatedAt, u.lastLoginAt].filter(Boolean).sort().pop() || null;
  const completed = (p.completed || []).length;
  return {
    name: u.name, email: u.email, phone: u.phone, purchasedAt: last.at, paid: u.purchases.reduce((n, x) => n + (x.amount || 0), 0), orders: u.purchases.length,
    completed, total: CURRICULUM.length, completionPct: Math.round((completed / CURRICULUM.length) * 100), viewed: perModule.filter((m) => m.views > 0).length,
    watchMin, activeMin, lastActive, lastLoginAt: u.lastLoginAt || null, firstLoginAt: u.firstLoginAt || null, loginCount: u.loginCount || 0, failedLogins: u.failedLogins || 0, lockedUntil: u.lockedUntil || null,
    hasPassword: !!u.passwordHash, passwordSetAt: u.passwordSetAt || null, certificate: (u.certificate && u.certificate.id) || (certByHash.get(auth.userKey(u.email)) || {}).id || null, certificateAt: u.certificate && u.certificate.issuedAt,
    createdAt: u.createdAt, lastModule: p.lastModule || null, perModule,
    status: !u.passwordHash ? 'no password' : completed === CURRICULUM.length ? 'completed' : lastActive && Date.now() - new Date(lastActive) < 7 * 86400000 ? 'active' : lastActive && Date.now() - new Date(lastActive) < 30 * 86400000 ? 'idle' : 'inactive',
  };
}

function engagementSummary(students) {
  const now = Date.now(), day = 86400000;
  const within = (iso, d) => iso && now - new Date(iso).getTime() < d * day;
  const n = students.length || 1;
  const modules = CURRICULUM.map((m) => {
    const rows = students.map((s) => s.perModule.find((x) => x.id === m.id));
    const viewed = rows.filter((x) => x.views > 0).length, completed = rows.filter((x) => x.completed).length;
    const mins = rows.filter((x) => x.watchMin > 0).map((x) => x.watchMin);
    return { id: m.id, code: m.code, title: m.title, viewed, completed, viewedPct: Math.round((viewed / n) * 100), completedPct: Math.round((completed / n) * 100), avgWatchMin: mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length) : 0, totalWatchMin: rows.reduce((a, x) => a + x.watchMin, 0) };
  });
  return {
    students: students.length,
    activeToday: students.filter((s) => within(s.lastActive, 1)).length, active7: students.filter((s) => within(s.lastActive, 7)).length, active30: students.filter((s) => within(s.lastActive, 30)).length,
    neverLoggedIn: students.filter((s) => !s.loginCount).length, noPassword: students.filter((s) => !s.hasPassword).length,
    notStarted: students.filter((s) => s.viewed === 0).length, completedAll: students.filter((s) => s.completed === CURRICULUM.length).length,
    avgCompletionPct: Math.round(students.reduce((a, s) => a + s.completionPct, 0) / n), avgWatchMin: Math.round(students.reduce((a, s) => a + s.watchMin, 0) / n), totalWatchMin: students.reduce((a, s) => a + s.watchMin, 0),
    totalLogins: students.reduce((a, s) => a + s.loginCount, 0), lockedOut: students.filter((s) => s.lockedUntil && new Date(s.lockedUntil) > new Date()).length,
    modules,
  };
}

async function studentDetail(email) {
  const { orders, users, certs } = await loadAll(false);
  const u = users.find((x) => auth.normalizeEmail(x.email) === auth.normalizeEmail(email));
  if (!u) return null;
  const certByHash = new Map(certs.map((c) => [c.emailHash, c]));
  const row = studentRow(u, certByHash);
  const theirOrders = orders.filter((o) => auth.normalizeEmail(o.customer?.email) === auth.normalizeEmail(email)).map(flat);
  const timeline = [];
  for (const o of theirOrders) { timeline.push({ at: o.createdAt, what: `Checkout started (${o.source}${o.campaign ? ' · ' + o.campaign : ''})` }); if (o.paidAt) timeline.push({ at: o.paidAt, what: `Paid ${o.amount} via ${o.gateway}` }); }
  if (u.passwordSetAt) timeline.push({ at: u.passwordSetAt, what: 'Password set' });
  if (u.firstLoginAt) timeline.push({ at: u.firstLoginAt, what: 'First login' });
  if (u.lastLoginAt && u.lastLoginAt !== u.firstLoginAt) timeline.push({ at: u.lastLoginAt, what: `Last login (${u.loginCount || 0} total)` });
  for (const m of row.perModule) { if (m.firstViewedAt) timeline.push({ at: m.firstViewedAt, what: `Started ${m.code} ${m.title}` }); if (m.completedAt) timeline.push({ at: m.completedAt, what: `Completed ${m.code}` }); }
  if (u.certificate && u.certificate.issuedAt) timeline.push({ at: u.certificate.issuedAt, what: `Certificate ${u.certificate.id}` });
  timeline.sort((a, b) => new Date(a.at) - new Date(b.at));
  return { student: row, orders: theirOrders, timeline, lastLoginUa: u.lastLoginUa || '' };
}

function settingsHealth() {
  const env = (k) => !!process.env[k];
  return {
    paymentMode: paymentMode(), razorpayKeys: env('RAZORPAY_KEY_ID') && env('RAZORPAY_KEY_SECRET'), razorpayWebhook: env('RAZORPAY_WEBHOOK_SECRET'),
    metaCapi: env('META_PIXEL_ID') && env('META_CAPI_TOKEN'), metaPixelIdServer: process.env.META_PIXEL_ID || '', metaTestEventCode: env('META_TEST_EVENT_CODE'),
    googleOfflineConversionName: process.env.GOOGLE_OFFLINE_CONVERSION_NAME || 'Course Purchase',
    bunnyTokenAuth: env('BUNNY_TOKEN_AUTH_KEY'), bunnyStreamKey: env('BUNNY_STREAM_API_KEY'), whatsappGroup: env('WHATSAPP_GROUP_URL'),
    siteUrl: PRODUCT.siteUrl, storage: store.hasBlob ? 'vercel-blob' : 'local', blobPrefix: store.PREFIX, adminPassword: env('ADMIN_PASSWORD'), authSecret: env('AUTH_SECRET') && process.env.AUTH_SECRET.length >= 24,
  };
}

async function orderDetail(id) {
  const { orders, users, certs } = await loadAll(false);
  const o = orders.find((x) => x.id === id) || await store.readJson(`orders/${id}.json`);
  if (!o) return null;
  const u = users.find((x) => auth.normalizeEmail(x.email) === auth.normalizeEmail(o.customer?.email)) || null;
  const cert = u ? certs.find((c) => c.emailHash === auth.userKey(u.email)) || null : null;
  return { order: o, flat: flat(o), user: u ? { name: u.name, email: u.email, phone: u.phone, createdAt: u.createdAt, hasPassword: !!u.passwordHash, passwordSetAt: u.passwordSetAt, progress: u.progress, purchases: u.purchases, certificate: u.certificate } : null, certificate: cert };
}

function csv(rows, columns, header) {
  const esc = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [(header || columns).join(','), ...rows.map((r) => columns.map((c) => esc(typeof c === 'function' ? c(r) : r[c])).join(','))].join('\n') + '\n';
}

// Google Ads offline conversion import format (Conversions → Uploads → "Conversions from clicks").
function googleOfflineCsv(rows) {
  const name = process.env.GOOGLE_OFFLINE_CONVERSION_NAME || 'Course Purchase';
  const fmt = (iso) => { const d = new Date(iso); const p = (n) => String(n).padStart(2, '0'); const ist = new Date(d.getTime() + 5.5 * 3600 * 1000); return `${ist.getUTCFullYear()}-${p(ist.getUTCMonth() + 1)}-${p(ist.getUTCDate())} ${p(ist.getUTCHours())}:${p(ist.getUTCMinutes())}:${p(ist.getUTCSeconds())}+05:30`; };
  const paid = rows.filter((r) => r.status === 'paid' && (r.gclid || r.gbraid || r.wbraid));
  return csv(paid, [(r) => r.gclid, (r) => r.gbraid, (r) => r.wbraid, () => name, (r) => fmt(r.paidAt), (r) => r.amount, () => 'INR', (r) => r.id], ['Google Click ID', 'GBRAID', 'WBRAID', 'Conversion Name', 'Conversion Time', 'Conversion Value', 'Conversion Currency', 'Order ID']);
}
// Meta offline events upload format (Events Manager → Offline event set → Upload).
function metaOfflineCsv(rows) {
  const sha = (v) => crypto.createHash('sha256').update(String(v).trim().toLowerCase()).digest('hex');
  const paid = rows.filter((r) => r.status === 'paid');
  return csv(paid, [(r) => sha(r.email), (r) => sha('91' + String(r.phone).replace(/\D/g, '')), () => 'Purchase', (r) => Math.floor(new Date(r.paidAt).getTime() / 1000), (r) => r.amount, () => 'INR', (r) => r.id, (r) => r.fbc ? 'yes' : ''], ['email', 'phone', 'event_name', 'event_time', 'value', 'currency', 'order_id', 'had_fbc']);
}

module.exports = { checkPassword, setAdminSession, clearAdminSession, requireAdmin, overview, orderDetail, studentDetail, csv, googleOfflineCsv, metaOfflineCsv, settingsHealth, invalidate, flat };
