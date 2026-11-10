'use strict';
// Admin "Funnels": every marketing funnel that sells the course (or the B2B call), with live status, where its
// checkout button points, and real numbers (test data excluded). Course funnels are matched by the order's
// source (?src=… set by each funnel) and flow; the B2B funnel keeps its own leads under the b2b-prod/ prefix.
const store = require('./store');
const { PRODUCT } = require('./config');

const CACHE_MS = 5 * 60 * 1000;
let probeCache = { at: 0, data: {} };

function siteHost() { try { return new URL(PRODUCT.siteUrl).host; } catch { return ''; } }

const FUNNELS = [
  { id: 'website', name: 'Website · Enroll popup', kind: 'course', url: () => PRODUCT.siteUrl, deployed: true,
    what: 'Main website. "Enroll Now" opens the checkout popup (details first, then payment).', match: (o) => o.flow !== 'payfirst' && !o.checkoutSource },
  { id: 'pay', name: 'Website · /pay page', kind: 'course', url: () => PRODUCT.siteUrl.replace(/\/$/, '') + '/pay', deployed: true,
    what: 'One-page checkout: pay first, details after. The funnels below send buyers here.', match: (o) => o.flow === 'payfirst' && (!o.checkoutSource || o.checkoutSource === 'pay') },
  { id: 'express', name: 'Express funnel', kind: 'course', url: () => 'https://express.cavarshavaryani.com', deployed: true, probe: true,
    what: 'Short sales page; every button goes to /pay.', match: (o) => o.checkoutSource === 'express' },
  { id: 'calculator', name: 'Time calculator funnel', kind: 'course', url: () => 'https://calculator.cavarshavaryani.com', deployed: true, probe: true,
    what: 'One tap on hours spent per month → time saved → /pay.', match: (o) => o.checkoutSource === 'calculator' },
  { id: 'quiz_payfirst', name: 'Quiz funnel (pay first)', kind: 'course', url: () => null, deployed: false,
    what: '7-question quiz → score → /pay. Built, not live yet.', match: (o) => o.checkoutSource === 'quiz_payfirst' },
  { id: 'quiz_lead', name: 'Quiz funnel (lead first)', kind: 'external', url: () => null, deployed: false,
    what: 'Quiz that sends buyers to the SuperProfile course page. Built, not live; its sales happen on SuperProfile, so they are not counted here.' },
  { id: 'b2b', name: 'B2B team-training funnel', kind: 'b2b', url: () => 'https://teams.cavarshavaryani.com', deployed: true, probe: true,
    what: 'Lead form for companies + paid 30-minute consultancy call (₹999 incl. GST).' },
];

// Is the funnel page up, and where does its checkout button go? (reads the funnel's public /config.js)
async function probe(f) {
  const url = f.url();
  const out = { up: null, checkoutUrl: null, checkoutOk: null };
  if (!url) return out;
  const get = async (u) => { const c = new AbortController(); const t = setTimeout(() => c.abort(), 4000); try { return await fetch(u, { signal: c.signal, redirect: 'follow' }); } finally { clearTimeout(t); } };
  try { out.up = (await get(url)).ok; } catch { out.up = false; }
  if (f.kind === 'course') {
    try {
      const txt = await (await get(url.replace(/\/$/, '') + '/config.js')).text();
      const m = txt.match(/CHECKOUT_URL\s*:\s*['"]([^'"]+)['"]/);
      if (m) { out.checkoutUrl = m[1]; try { out.checkoutOk = new URL(m[1]).host === siteHost(); } catch { out.checkoutOk = false; } }
    } catch {}
  }
  return out;
}

async function probes() {
  if (Date.now() - probeCache.at < CACHE_MS) return probeCache.data;
  const list = FUNNELS.filter((f) => f.probe);
  const res = await Promise.all(list.map((f) => probe(f).catch(() => ({}))));
  probeCache = { at: Date.now(), data: Object.fromEntries(list.map((f, i) => [f.id, res[i]])) };
  return probeCache.data;
}

let b2bCache = { at: 0, leads: null };
async function b2bLeads() {
  if (b2bCache.leads && Date.now() - b2bCache.at < 60 * 1000) return b2bCache.leads;
  const prefix = process.env.B2B_BLOB_PREFIX || 'b2b-prod';
  let leads = [];
  try { leads = await store.listJsonAt(prefix, 'leads/'); } catch (e) { console.error('[funnels] b2b leads', e.message); }
  b2bCache = { at: Date.now(), leads };
  return leads;
}
const isTestLead = (l) => /@example\.com$/i.test(String(l.email || '')) || (l.payment && l.payment.gateway === 'test');

// rows: flattened real orders (admin.flat), already limited to the chosen date range. inRange: date filter for B2B leads.
async function funnelReport(rows, inRange) {
  const [pr, leadsAll] = await Promise.all([probes(), b2bLeads()]);
  const matched = new Set();
  const out = FUNNELS.map((f) => {
    const base = { id: f.id, name: f.name, kind: f.kind, url: f.url(), deployed: f.deployed, what: f.what, ...(pr[f.id] || {}) };
    if (f.kind === 'course') {
      const mine = rows.filter((r) => f.match(r));
      mine.forEach((r) => matched.add(r.id));
      const paid = mine.filter((r) => r.status === 'paid');
      return { ...base, started: mine.length, toVerify: mine.filter((r) => r.status === 'awaiting_verification').length, paid: paid.length,
        revenue: paid.reduce((n, r) => n + (r.amount || 0), 0), conversion: mine.length ? Math.round((paid.length / mine.length) * 100) : 0,
        lastAt: mine.map((r) => r.createdAt).sort().pop() || null };
    }
    if (f.kind === 'b2b') {
      const real = leadsAll.filter((l) => !isTestLead(l));
      const leads = real.filter((l) => inRange({ createdAt: l.createdAt }));
      const paid = leads.filter((l) => l.status === 'paid');
      return { ...base, started: leads.length, checkout: leads.filter((l) => l.status === 'checkout').length, paid: paid.length,
        revenue: paid.reduce((n, l) => n + Number((l.payment && l.payment.amount) || 0), 0), conversion: leads.length ? Math.round((paid.length / leads.length) * 100) : 0,
        lastAt: leads.map((l) => l.createdAt).sort().pop() || null, hiddenTest: leadsAll.length - real.length, unit: 'leads' };
    }
    return { ...base, started: null, paid: null, revenue: null };
  });
  const other = rows.filter((r) => !matched.has(r.id));
  if (other.length) {
    const paid = other.filter((r) => r.status === 'paid');
    out.push({ id: 'other', name: 'Other sources', kind: 'course', url: null, deployed: true, what: 'Checkouts tagged with a source no funnel above uses: ' + [...new Set(other.map((r) => r.checkoutSource))].join(', '),
      started: other.length, toVerify: other.filter((r) => r.status === 'awaiting_verification').length, paid: paid.length, revenue: paid.reduce((n, r) => n + (r.amount || 0), 0),
      conversion: Math.round((paid.length / other.length) * 100), lastAt: other.map((r) => r.createdAt).sort().pop() || null });
  }
  return out;
}

module.exports = { funnelReport, FUNNELS };
