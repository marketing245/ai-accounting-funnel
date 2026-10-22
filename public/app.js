/**
 * AI Accounting Engineer — checkout (landing page)
 * Flow: details → /api/checkout/create-order → Razorpay (or the clearly-labelled test gateway) → /api/checkout/verify → /thank-you
 * Nothing here grants access; the server verifies the payment and sets the session cookie.
 */
'use strict';

var CHECKOUT = null;      // server config (/api/checkout/config)
var currentOrder = null;  // order returned by create-order

function $(id) { return document.getElementById(id); }
function fmt(n) { return '₹' + Number(n || 0).toLocaleString('en-IN'); }

function amounts() {
  if (CHECKOUT && CHECKOUT.amount) return CHECKOUT.amount;
  var base = 1499, gst = Math.round(base * 0.18);
  return { base: base, subtotal: base, gst: gst, total: base + gst, gstPercent: 18 };
}

function items(a) {
  return [{ item_id: 'aiae-course', item_name: 'AI in Accounting Course', price: a.base, quantity: 1 }];
}

async function loadCheckoutConfig() {
  try { var r = await fetch('/api/checkout/config', { cache: 'no-store' }); CHECKOUT = await r.json(); } catch (e) { CHECKOUT = null; }
  updateCheckoutDisplay();
}

function updateCheckoutDisplay() {
  var a = amounts();
  document.querySelectorAll('[data-price="base"]').forEach(function (el) { el.textContent = fmt(a.base); });
  document.querySelectorAll('[data-price="gst"]').forEach(function (el) { el.textContent = fmt(a.gst); });
  document.querySelectorAll('[data-price="total"]').forEach(function (el) { el.textContent = fmt(a.total); });
  if ($('checkoutTotalAmount')) $('checkoutTotalAmount').textContent = fmt(a.total);
  if ($('checkoutPayBtn') && !$('checkoutPayBtn').disabled) $('checkoutPayBtn').textContent = 'Proceed to secure payment → ' + fmt(a.total);
  var badge = $('paymentModeBadge');
  if (badge) badge.classList.toggle('hidden', !(CHECKOUT && CHECKOUT.mode === 'test'));
}

function showStep(step) {
  ['checkoutFormSection', 'testGatewaySection', 'checkoutProcessing'].forEach(function (id) { if ($(id)) $(id).classList.add('hidden'); });
  var map = { form: 'checkoutFormSection', test: 'testGatewaySection', processing: 'checkoutProcessing' };
  if ($(map[step])) $(map[step]).classList.remove('hidden');
}

function showError(msg) {
  var el = $('checkoutError');
  if (!el) return;
  el.textContent = msg || 'Something went wrong. Please try again.';
  el.classList.remove('hidden');
}
function clearError() { if ($('checkoutError')) $('checkoutError').classList.add('hidden'); }

function setBusy(busy) {
  var btn = $('checkoutPayBtn');
  if (!btn) return;
  btn.disabled = busy;
  btn.textContent = busy ? 'Preparing secure payment…' : 'Proceed to secure payment → ' + fmt(amounts().total);
}

function startUnifiedFunnel() {
  var modal = $('unifiedFunnelModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  clearError();
  showStep('form');
  updateCheckoutDisplay();
  var a = amounts();
  if (window.aaeTrack) aaeTrack('begin_checkout', { currency: 'INR', value: a.total, items: items(a) });
  setTimeout(function () { if ($('custName')) $('custName').focus(); }, 50);
}

function closeUnifiedModal() {
  var modal = $('unifiedFunnelModal');
  if (modal) modal.classList.add('hidden');
  document.body.style.overflow = '';
}

function backToDetails() { clearError(); setBusy(false); showStep('form'); }

async function submitCheckout(ev) {
  if (ev) ev.preventDefault();
  clearError();
  var name = ($('custName').value || '').trim();
  var email = ($('custEmail').value || '').trim();
  var phone = ($('custPhone').value || '').replace(/\D/g, '');
  if (name.length < 2) return showError('Please enter your full name.'), false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return showError('Please enter a valid email — it becomes your student login.'), false;
  if (!/^[6-9]\d{9}$/.test(phone)) return showError('Please enter a valid 10-digit mobile number.'), false;

  setBusy(true);
  var data;
  var payload = function () { return JSON.stringify({ name: name, email: email, phone: phone, website: ($('custWebsite') && $('custWebsite').value) || '', formToken: CHECKOUT && CHECKOUT.formToken, attribution: window.aaeAttribution ? aaeAttribution() : null }); };
  try { data = await postForm('/api/checkout/create-order', payload); }
  catch (e) { data = { ok: false, error: 'Network error. Please check your connection and try again.' }; }
  if (!data || !data.ok) { setBusy(false); showError(data && data.error); return false; }

  currentOrder = data;
  var a = data.amount || amounts();
  if (window.aaeTrack) aaeTrack('add_payment_info', { currency: 'INR', value: a.total, payment_type: data.gateway, items: items(a) });

  if (data.gateway === 'razorpay') openRazorpay(data);
  else { $('testOrderId').textContent = data.orderId; $('testOrderAmount').textContent = fmt(a.total); showStep('test'); }
  return false;
}

// POST JSON to a form endpoint; if the signed form token is rejected, fix it (wait 3.2 s when too fast, refresh when stale) and retry once.
async function postForm(path, buildBody) {
  var r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: buildBody() });
  var data = await r.json();
  if (data && data.code === 'FORM_TOKEN') {
    if (data.reason === 'too_fast') await new Promise(function (res) { setTimeout(res, 3300); });
    else await loadCheckoutConfig();
    r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: buildBody() });
    data = await r.json();
  }
  return data;
}

function loadScript(src) {
  return new Promise(function (resolve, reject) {
    if (document.querySelector('script[src="' + src + '"]')) return resolve();
    var s = document.createElement('script'); s.src = src; s.onload = resolve; s.onerror = function () { reject(new Error('Could not load payment library')); };
    document.head.appendChild(s);
  });
}

function openRazorpay(d) {
  loadScript('https://checkout.razorpay.com/v1/checkout.js').then(function () {
    var rz = new window.Razorpay({
      key: d.keyId, amount: d.amountPaise, currency: d.currency || 'INR', order_id: d.orderId,
      name: 'AI Accounting Engineer', description: d.description, prefill: d.prefill, theme: { color: '#c4953a' },
      handler: function (resp) { verifyPayment({ orderId: d.orderId, paymentId: resp.razorpay_payment_id, signature: resp.razorpay_signature }); },
      modal: { ondismiss: function () { backToDetails(); } }
    });
    rz.on('payment.failed', function (r) {
      backToDetails();
      showError('Payment failed' + (r && r.error && r.error.description ? ': ' + r.error.description : '') + '. Nothing has been charged — please try again or use another method.');
    });
    rz.open();
  }).catch(function (e) { backToDetails(); showError(e.message); });
}

function simulateTestPayment() {
  if (!currentOrder) return backToDetails();
  verifyPayment({ orderId: currentOrder.orderId, testToken: currentOrder.testToken });
}

async function verifyPayment(payload) {
  showStep('processing');
  var data;
  try {
    var r = await fetch('/api/checkout/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    data = await r.json();
  } catch (e) { data = { ok: false, error: 'Network error while confirming your payment. If money was deducted, email ' + ((window.AAE_CONFIG || {}).SUPPORT_EMAIL || 'support') + ' with your payment ID.' }; }
  if (!data || !data.ok) { backToDetails(); showError(data && data.error); return; }
  window.location.href = data.next || '/thank-you';
}

// ── 1:1 Consultation & Corporate Webinar Booking Modal ──
function openBookingModal(type) {
  var modal = $('bookingModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  if ($('bookingType')) $('bookingType').value = type || '1:1 Strategic AI Consultation';
  if ($('bookingModalTitle')) $('bookingModalTitle').textContent = type || 'Schedule 1:1 Consultation';
  if ($('bookingFormWrap')) $('bookingFormWrap').classList.remove('hidden');
  if ($('bookingSuccessWrap')) $('bookingSuccessWrap').classList.add('hidden');
}

function closeBookingModal() {
  var modal = $('bookingModal');
  if (modal) modal.classList.add('hidden');
}

function submitBookingInquiry(e) {
  if (e) e.preventDefault();
  var name = ($('bookName') && $('bookName').value.trim()) || '';
  var email = ($('bookEmail') && $('bookEmail').value.trim()) || '';
  var phone = ($('bookPhone') && $('bookPhone').value.replace(/\D/g, '')) || '';
  var type = ($('bookingType') && $('bookingType').value) || '1:1 Consultation';
  var notes = ($('bookNotes') && $('bookNotes').value.trim()) || '';
  var btn = $('bookingForm') && $('bookingForm').querySelector('button[type=submit]');
  var errEl = $('bookingError');
  var showErr = function (msg) { if (errEl) { errEl.textContent = msg; errEl.classList.remove('hidden'); } else alert(msg); };
  if (errEl) errEl.classList.add('hidden');
  if (name.length < 2) return showErr('Please enter your full name.'), false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return showErr('Please enter a valid email address.'), false;
  if (!/^[6-9]\d{9}$/.test(phone)) return showErr('Please enter a valid 10-digit mobile number.'), false;
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
  var inqBody = function () { return JSON.stringify({ name: name, email: email, phone: phone, type: type, notes: notes, website: ($('bookWebsite') && $('bookWebsite').value) || '', formToken: CHECKOUT && CHECKOUT.formToken, attribution: window.aaeAttribution ? aaeAttribution() : null }); };
  postForm('/api/inquiry', inqBody).then(function (d) {
    if (d && d.ok) {
      if (window.aaeTrack) aaeTrack('generate_lead', { lead_type: type });
      if ($('bookingFormWrap')) $('bookingFormWrap').classList.add('hidden');
      if ($('bookingSuccessWrap')) $('bookingSuccessWrap').classList.remove('hidden');
    } else showErr((d && d.error) || 'Could not send your request. Please try again.');
  }).catch(function () { showErr('Network error. Please try again.'); })
    .finally(function () { if (btn) { btn.disabled = false; btn.textContent = 'Request a quote →'; } });
  return false;
}

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    closeUnifiedModal();
    closeBookingModal();
  }
});

window.addEventListener('DOMContentLoaded', function () {
  loadCheckoutConfig();
  var params = new URLSearchParams(window.location.search);
  if (params.get('open') === 'checkout' || params.get('enroll') === 'true') startUnifiedFunnel();
  var overlay = $('unifiedFunnelModal');
  if (overlay) overlay.addEventListener('click', function (e) { if (e.target === overlay) closeUnifiedModal(); });
  var bookOverlay = $('bookingModal');
  if (bookOverlay) bookOverlay.addEventListener('click', function (e) { if (e.target === bookOverlay) closeBookingModal(); });
});
