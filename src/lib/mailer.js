'use strict';
// Transactional email via Resend (https://resend.com). Needs RESEND_API_KEY and MAIL_FROM
// (e.g. "CA Varsha Varyani <hello@aiaccountingengineer.com>", sending domain verified in Resend).
// Without them every send returns { status: 'not_configured' } and nothing else changes.
const { PRODUCT } = require('./config');

const configured = () => !!(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

async function send({ to, subject, html, text }) {
  if (!configured()) return { status: 'not_configured' };
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, html, text, reply_to: PRODUCT.supportEmail }),
      signal: ctrl.signal,
    });
    const data = await r.json().catch(() => ({}));
    return r.ok ? { status: 'sent', id: data.id, at: new Date().toISOString() } : { status: 'error', error: data.message || `HTTP ${r.status}` };
  } catch (e) {
    return { status: 'error', error: e.name === 'AbortError' ? 'timeout' : e.message };
  } finally { clearTimeout(t); }
}

/** Sent once per paid order, after access is granted. */
function sendWelcome(order, user) {
  const site = PRODUCT.siteUrl.replace(/\/$/, '');
  const first = esc(String(user.name || order.customer.name || '').split(' ')[0] || 'there');
  const items = (order.items || []).map((i) => `<tr><td style="padding:6px 0">${esc(i.name)}</td><td style="padding:6px 0;text-align:right">${inr(i.price)}</td></tr>`).join('');
  const hasAddon = (order.items || []).some((i) => i.addon);
  const loginUrl = user.passwordHash ? `${site}/login` : `${site}/thank-you?order=${encodeURIComponent(order.id)}`;
  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1a1f2e;line-height:1.55">
    <h2 style="font-family:Georgia,serif;color:#0f1b2d;margin:0 0 12px">Welcome to AI in Accounting, ${first}</h2>
    <p>Your payment is confirmed and your access is ready.</p>
    <p style="margin:20px 0"><a href="${loginUrl}" style="background:#c4953a;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block">${user.passwordHash ? 'Log in to the student portal' : 'Set your password and start'}</a></p>
    <p><strong>Your login:</strong> ${esc(user.email)}</p>
    <p><strong>What you get:</strong> 5 recorded modules on Claude for real accounting work (journal entries, bank reconciliation and depreciation, GST 2A/2B reconciliation, month-end close), sample files and a guidance PDF with every module, lifetime access, and a certificate of completion.${hasAddon ? ' Your 23 AI Skills pack is in the portal under "Your add-ons".' : ''}</p>
    <table style="width:100%;border-top:1px solid #e5e2da;margin-top:16px;font-size:14px">${items}
      <tr><td style="padding:6px 0;color:#666">GST (${order.amount.gstPercent}%)</td><td style="padding:6px 0;text-align:right;color:#666">${inr(order.amount.gst)}</td></tr>
      <tr><td style="padding:8px 0;font-weight:700;border-top:1px solid #e5e2da">Total paid</td><td style="padding:8px 0;text-align:right;font-weight:700;border-top:1px solid #e5e2da">${inr(order.amount.total)}</td></tr>
    </table>
    <p style="font-size:13px;color:#666">Order ${esc(order.id)}${order.customer && order.customer.gstin ? ` · GSTIN ${esc(order.customer.gstin)}` : ''}. Questions? Reply to this email or write to ${esc(PRODUCT.supportEmail)}.</p>
    <p style="font-size:13px;color:#666">CA Varsha Varyani · AI in Accounting</p>
  </div>`;
  const text = `Welcome to AI in Accounting. Your payment is confirmed. Login: ${user.email}. Start here: ${loginUrl}. Total paid ${inr(order.amount.total)} (order ${order.id}).`;
  return send({ to: user.email, subject: 'Your AI in Accounting access is ready', html, text });
}

module.exports = { configured, send, sendWelcome };
