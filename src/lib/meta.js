'use strict';
// Meta Conversions API (server-side events). Needs META_PIXEL_ID + META_CAPI_TOKEN. Fire-and-forget with a 4 s timeout.
// event_id = order id, and the browser pixel sends the same eventID, so Meta de-duplicates browser + server.
const crypto = require('crypto');

const sha = (v) => v ? crypto.createHash('sha256').update(String(v).trim().toLowerCase()).digest('hex') : undefined;
const configured = () => !!(process.env.META_PIXEL_ID && process.env.META_CAPI_TOKEN);

function userData(order) {
  const c = order.customer || {}, a = order.attribution || {};
  const [fn, ...rest] = String(c.name || '').trim().split(/\s+/);
  const phone = String(c.phone || '').replace(/\D/g, '');
  return {
    em: sha(c.email) ? [sha(c.email)] : undefined,
    ph: phone ? [sha('91' + phone.replace(/^91(?=\d{10}$)/, ''))] : undefined,
    fn: sha(fn) ? [sha(fn)] : undefined, ln: rest.length ? [sha(rest.join(' '))] : undefined,
    country: [sha('in')], external_id: a.vid ? [sha(a.vid)] : undefined,
    client_ip_address: order.ip || undefined, client_user_agent: a.userAgent || undefined,
    fbp: a.fbp || undefined, fbc: a.fbc || undefined,
  };
}

async function sendEvent(order, eventName, { value, eventTime } = {}) {
  if (!configured()) return { status: 'not_configured' };
  const body = {
    data: [{
      event_name: eventName, event_time: Math.floor((eventTime ? new Date(eventTime) : new Date()).getTime() / 1000),
      event_id: `${order.id}:${eventName}`, action_source: 'website', event_source_url: (order.attribution && order.attribution.page) || process.env.SITE_URL || undefined,
      user_data: userData(order),
      custom_data: { currency: 'INR', value: value ?? order.amount?.total, content_name: 'AI in Accounting Course', content_type: 'product', content_ids: ['aiae-course'], order_id: order.id, num_items: 1 },
    }],
  };
  if (process.env.META_TEST_EVENT_CODE) body.test_event_code = process.env.META_TEST_EVENT_CODE;
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 4000);
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${process.env.META_PIXEL_ID}/events?access_token=${encodeURIComponent(process.env.META_CAPI_TOKEN)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
    const data = await r.json().catch(() => ({}));
    return r.ok ? { status: 'sent', at: new Date().toISOString(), received: data.events_received, traceId: data.fbtrace_id } : { status: 'error', at: new Date().toISOString(), error: (data.error && data.error.message) || `HTTP ${r.status}` };
  } catch (e) { return { status: 'error', at: new Date().toISOString(), error: e.name === 'AbortError' ? 'timeout' : e.message }; }
  finally { clearTimeout(t); }
}

module.exports = { configured, sendEvent };
