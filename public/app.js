/**
 * CA Varsha Varyani — checkout (landing page)
 * Flow: details → /api/checkout/create-order → Razorpay (or the clearly-labelled test gateway) → /api/checkout/verify → /thank-you
 * Nothing here grants access; the server verifies the payment and sets the session cookie.
 */
'use strict';

var CHECKOUT = null;      // server config (/api/checkout/config)
var currentOrder = null;  // order returned by create-order

function $(id) { return document.getElementById(id); }
function fmt(n) { return '₹' + Number(n || 0).toLocaleString('en-IN'); }

function selectedAddons() {
  var box = $('addonSkills');
  return box && box.checked ? [box.value] : [];
}

function amounts() {
  var ids = selectedAddons();
  if (CHECKOUT && CHECKOUT.amount) {
    if (!ids.length) return CHECKOUT.amount;
    var match = (CHECKOUT.addons || []).find(function (a) { return a.id === ids[0]; });
    if (match && match.amountWith) return match.amountWith;
  }
  return amountsFor(ids);
}

// Offline fallback only (server config not loaded yet); the server always recomputes the real amount.
function amountsFor(ids) {
  var base = 1499, add = ids.length ? 999 : 0, sub = base + add, gst = Math.round(sub * 0.18);
  return { base: base, addons: add, addonIds: ids, subtotal: sub, gst: gst, total: sub + gst, gstPercent: 18 };
}

function items(a) {
  var list = [{ item_id: 'aiae-course', item_name: 'AI in Accounting Course', price: a.base, quantity: 1 }];
  if (a.addons) list.push({ item_id: 'aiae-23-skills', item_name: '23 AI Skills pack', price: a.addons, quantity: 1 });
  return list;
}

async function loadCheckoutConfig() {
  try { var r = await fetch('/api/checkout/config', { cache: 'no-store' }); CHECKOUT = await r.json(); } catch (e) { CHECKOUT = null; }
  fillStates();
  updateCheckoutDisplay();
}

function fillStates() {
  var sel = $('custState');
  if (!sel || !CHECKOUT || !CHECKOUT.states || sel.options.length > 1) return;
  CHECKOUT.states.forEach(function (st) { var o = document.createElement('option'); o.value = st.code; o.textContent = st.name; sel.appendChild(o); });
}

// GSTIN starts with the GST state code: pick the matching state for the buyer.
function syncStateFromGstin() {
  var g = $('custGstin'), sel = $('custState');
  if (!g || !sel) return;
  g.value = g.value.toUpperCase().replace(/\s+/g, '');
  var code = g.value.slice(0, 2);
  if (/^\d{2}$/.test(code) && Array.prototype.some.call(sel.options, function (o) { return o.value === code; })) sel.value = code;
}
document.addEventListener('input', function (e) { if (e.target && e.target.id === 'custGstin') syncStateFromGstin(); });

function updateCheckoutDisplay() {
  var a = amounts();
  // Page price blocks always show the course alone; the checkout modal shows the basket (course + ticked add-ons).
  var course = (CHECKOUT && CHECKOUT.amount) || amountsFor([]);
  var pick = function (el) { return el.closest('#unifiedFunnelModal') ? a : course; };
  document.querySelectorAll('[data-price="base"]').forEach(function (el) { el.textContent = fmt(a.base); });
  document.querySelectorAll('[data-price="gst"]').forEach(function (el) { el.textContent = fmt(pick(el).gst); });
  document.querySelectorAll('[data-price="addons"]').forEach(function (el) { el.textContent = fmt(a.addons || 0); });
  if ($('addonRow')) $('addonRow').classList.toggle('hidden', !a.addons);
  document.querySelectorAll('[data-price="total"]').forEach(function (el) { el.textContent = fmt(pick(el).total); });
  if ($('checkoutTotalAmount')) $('checkoutTotalAmount').textContent = fmt(a.total);
  var isUpi = CHECKOUT && CHECKOUT.mode === 'upi';
  if ($('checkoutPayBtn') && !$('checkoutPayBtn').disabled) $('checkoutPayBtn').textContent = (isUpi ? 'Continue to UPI payment → ' : 'Proceed to secure payment → ') + fmt(a.total);
  if ($('paymentNote') && isUpi) $('paymentNote').textContent = 'You pay by UPI directly to CA Varsha Varyani. Your access is sent after we check the payment, within ' + ((CHECKOUT.upi && CHECKOUT.upi.accessWithin) || '24 hours') + '.';
  var badge = $('paymentModeBadge');
  if (badge) badge.classList.toggle('hidden', !(CHECKOUT && CHECKOUT.mode === 'test'));
}

function showStep(step) {
  ['checkoutFormSection', 'testGatewaySection', 'checkoutProcessing', 'upiSection'].forEach(function (id) { if ($(id)) $(id).classList.add('hidden'); });
  var map = { form: 'checkoutFormSection', test: 'testGatewaySection', processing: 'checkoutProcessing', upi: 'upiSection' };
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
  btn.textContent = busy ? 'Preparing secure payment…' : ((CHECKOUT && CHECKOUT.mode === 'upi') ? 'Continue to UPI payment → ' : 'Proceed to secure payment → ') + fmt(amounts().total);
}

function startUnifiedFunnel() {
  // UPI mode: payment first (Google Pay), details after → the one-page checkout at /pay (UTM tags and click ids travel along).
  if (!CHECKOUT) { loadCheckoutConfig().then(function () { if (CHECKOUT) startUnifiedFunnel(); }); return; } // decide after the config is known
  if (CHECKOUT.mode === 'upi') {
    var q = new URLSearchParams(location.search); q.delete('open'); q.delete('enroll'); q.set('src', 'pay');
    location.href = '/pay?' + q.toString(); return;
  }
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
  var state = ($('custState') && $('custState').value) || '';
  var gstin = (($('custGstin') && $('custGstin').value) || '').toUpperCase().replace(/\s+/g, '');
  if (!state) return showError('Please select your state.'), false;
  if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) return showError('Please enter a valid 15-character GSTIN, or leave it blank.'), false;

  setBusy(true);
  var data;
  var payload = function () { return JSON.stringify({ name: name, email: email, phone: phone, state: state, gstin: gstin, website: ($('custWebsite') && $('custWebsite').value) || '', formToken: CHECKOUT && CHECKOUT.formToken, addons: selectedAddons(), attribution: window.aaeAttribution ? aaeAttribution() : null }); };
  try { data = await postForm('/api/checkout/create-order', payload); }
  catch (e) { data = { ok: false, error: 'Network error. Please check your connection and try again.' }; }
  if (!data || !data.ok) { setBusy(false); showError(data && data.error); return false; }

  currentOrder = data;
  var a = data.amount || amounts();
  if (window.aaeTrack) aaeTrack('add_payment_info', { currency: 'INR', value: a.total, payment_type: data.gateway, items: items(a) });

  if (data.gateway === 'razorpay') openRazorpay(data);
  else if (data.gateway === 'upi') showUpi(data, a);
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
      name: 'CA Varsha Varyani', description: d.description, prefill: d.prefill, theme: { color: '#c4953a' },
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

// ── Direct UPI (PAYMENT_MODE=upi), gateway style: phone → the UPI app opens; desktop → QR. Back on the page, one tap
// ("Yes, I have paid") sends the buyer to /payment-received, the conversion page. Access follows after the admin approves. ──
var UA = navigator.userAgent;
var isAndroid = /Android/i.test(UA);
var isIOS = /iPhone|iPad|iPod/i.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
var upiState = { launchedAt: 0, link: '' };
function upiAppLink(link, app) {
  var q = link.split('?')[1] || '';
  return { gpay: 'tez://upi/pay?' + q, phonepe: 'phonepe://pay?' + q, paytm: 'paytmmp://pay?' + q, upi: 'upi://pay?' + q }[app] || link;
}
function upiShow(id, on) { var el = $(id); if (el) el.classList.toggle('hidden', !on); }
function upiLaunch(href) {
  upiState.launchedAt = Date.now();
  upiShow('upiNoApp', false);
  window.location.href = href;
  // still here after 2.5 s → the app did not open (no UPI app, or the browser blocked it)
  setTimeout(function () { if (document.visibilityState === 'visible' && Date.now() - upiState.launchedAt < 4000 && $('upiConfirm').classList.contains('hidden')) { upiShow('upiNoApp', true); upiShow('upiQrBox', true); upiShow('upiShowQr', false); } }, 2500);
  if (window.aaeTrack) aaeTrack('upi_app_opened', { currency: 'INR', value: (currentOrder && currentOrder.amount || {}).total });
}
function showUpi(d, a) {
  setBusy(false);
  var u = d.upi || {};
  upiState = { launchedAt: 0, link: u.link || '' };
  $('upiAmount').textContent = fmt(a.total);
  document.querySelectorAll('.upiAmt').forEach(function (el) { el.textContent = fmt(a.total); });
  $('upiPayee').textContent = u.payeeName || '';
  $('upiVpa').textContent = u.vpa || '';
  $('upiQr').innerHTML = u.qrSvg || '';
  $('upiPayLink').href = u.link || '#';
  document.querySelectorAll('.upiWithin').forEach(function (el) { el.textContent = u.accessWithin || '24 hours'; });
  upiShow('upiPayBox', true); upiShow('upiConfirm', false); upiShow('upiNoApp', false); $('upiError').classList.add('hidden');
  upiShow('upiPayLink', isAndroid); upiShow('upiIos', isIOS);
  var phone = isAndroid || isIOS;
  upiShow('upiQrBox', !phone); upiShow('upiShowQr', phone);
  showStep('upi');
  if (window.aaeTrack) aaeTrack('upi_payment_shown', { currency: 'INR', value: a.total });
  if (isAndroid && u.link) upiLaunch(u.link); // straight into the UPI app, like a gateway
}
function upiAskConfirm() { upiShow('upiPayBox', false); upiShow('upiConfirm', true); }
function upiError(msg) { var el = $('upiError'); el.textContent = msg || 'Something went wrong. Please try again.'; el.classList.remove('hidden'); }
async function upiConfirmPaid() {
  var btn = $('upiYes'), btn2 = $('upiDesktopDone');
  [btn, btn2].forEach(function (b) { if (b) { b.disabled = true; b.dataset.label = b.dataset.label || b.textContent; b.textContent = 'One moment…'; } });
  var data;
  try {
    var r = await fetch('/api/checkout/upi-submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: currentOrder.orderId, submitToken: currentOrder.submitToken }) });
    data = await r.json();
  } catch (e) { data = { ok: false, error: 'Network error. Your payment is safe. Please tap again.' }; }
  [btn, btn2].forEach(function (b) { if (b) { b.disabled = false; b.textContent = b.dataset.label; } });
  if (!data || !data.ok) return upiError(data && data.error);
  try {
    sessionStorage.setItem('aae_upi_paid', JSON.stringify({ orderId: data.orderId, ref: data.ref, amount: data.amount, items: data.items, email: data.email,
      name: ($('custName') && $('custName').value) || '', phone: ($('custPhone') && $('custPhone').value) || '', within: data.accessWithin }));
  } catch (e) {}
  window.location.href = '/payment-received?order=' + encodeURIComponent(data.orderId);
}
document.addEventListener('visibilitychange', function () {
  // back from the UPI app → ask "did it go through?"
  if (document.visibilityState === 'visible' && upiState.launchedAt && Date.now() - upiState.launchedAt > 1500 && $('upiSection') && !$('upiSection').classList.contains('hidden')) upiAskConfirm();
});
document.addEventListener('click', function (e) {
  var t = e.target && e.target.closest ? e.target.closest('a,button') : null;
  if (!t) return;
  if (t.id === 'upiPayLink') { e.preventDefault(); upiLaunch(t.href); }
  else if (t.classList.contains('upi-app')) { e.preventDefault(); upiLaunch(upiAppLink(upiState.link, t.getAttribute('data-app'))); }
  else if (t.id === 'upiShowQr') { upiShow('upiQrBox', true); upiShow('upiShowQr', false); }
  else if (t.id === 'upiDesktopDone' || t.id === 'upiYes') upiConfirmPaid();
  else if (t.id === 'upiRetry') { upiShow('upiConfirm', false); upiShow('upiPayBox', true); upiState.launchedAt = 0; }
  else if (t.id === 'upiCopy') {
    var v = $('upiVpa').textContent, done = function () { t.textContent = 'Copied'; setTimeout(function () { t.textContent = 'Copy'; }, 1500); };
    if (navigator.clipboard) navigator.clipboard.writeText(v).then(done, done); else done();
  }
});

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
  var btnText = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
  var inqBody = function () { return JSON.stringify({ name: name, email: email, phone: phone, type: type, notes: notes, website: ($('bookWebsite') && $('bookWebsite').value) || '', formToken: CHECKOUT && CHECKOUT.formToken, attribution: window.aaeAttribution ? aaeAttribution() : null }); };
  postForm('/api/inquiry', inqBody).then(function (d) {
    if (d && d.ok) {
      if (window.aaeTrack) aaeTrack('generate_lead', { lead_type: type });
      if ($('bookingFormWrap')) $('bookingFormWrap').classList.add('hidden');
      if ($('bookingSuccessWrap')) $('bookingSuccessWrap').classList.remove('hidden');
    } else showErr((d && d.error) || 'Could not send your request. Please try again.');
  }).catch(function () { showErr('Network error. Please try again.'); })
    .finally(function () { if (btn) { btn.disabled = false; btn.textContent = btnText; } });
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
