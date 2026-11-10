/**
 * Express (pay-first) checkout: /pay
 * 1. One button. /api/checkout/create-order with flow 'payfirst' (no details) → Razorpay (or the labelled test gateway).
 * 2. /api/checkout/verify → order is paid → claim token.
 * 3. Buyer adds email / WhatsApp / name / state → /api/checkout/claim → account + session + welcome email → /thank-you.
 * A paid-but-unclaimed order is remembered in this browser (and via /pay?claim=<id>&t=<token>) so the buyer can finish later.
 * Funnel pages send people here with ?src=<funnel-name> plus their UTM tags / fbclid.
 */
'use strict';
(function () {
  var CFG = null;
  var ORDER = null;
  var UPI_PENDING = null; // UPI mode: { orderId, submitToken, utr, total } between "I have paid" and the details form
  var isUpi = function () { return CFG && CFG.mode === 'upi'; };
  var payLabel = function (a) { return 'Pay ' + fmt(a.total) + (isUpi() ? ' by UPI' : ' securely'); };
  var CLAIM_KEY = 'aae_pending_claim';
  var $ = function (id) { return document.getElementById(id); };
  var fmt = function (n) { return '₹' + Number(n || 0).toLocaleString('en-IN'); };
  var params = new URLSearchParams(location.search);
  var source = (params.get('src') || 'pay').replace(/[^a-z0-9_-]/gi, '').slice(0, 40);
  var store = {
    get: function () { try { return JSON.parse(localStorage.getItem(CLAIM_KEY)); } catch (e) { return null; } },
    set: function (v) { try { localStorage.setItem(CLAIM_KEY, JSON.stringify(v)); } catch (e) {} },
    clear: function () { try { localStorage.removeItem(CLAIM_KEY); } catch (e) {} },
  };

  function selectedAddons() { return $('addonSkills').checked ? [$('addonSkills').value] : []; }
  function amount() {
    if (!CFG) return null;
    if (!selectedAddons().length) return CFG.amount;
    var a = (CFG.addons || []).find(function (x) { return x.id === selectedAddons()[0]; });
    return a ? a.amountWith : CFG.amount;
  }
  function render() {
    var a = amount(); if (!a) return;
    document.querySelectorAll('[data-amt]').forEach(function (el) { el.textContent = fmt(a[el.getAttribute('data-amt')] || 0); });
    $('addonRow').hidden = !a.addons;
    if (!$('payBtn').disabled) $('payBtn').textContent = payLabel(a);
  }
  function showError(id, msg) { var el = $(id); el.textContent = msg || 'Something went wrong. Please try again.'; el.hidden = false; }
  function clearError(id) { $(id).hidden = true; }
  function setStep(step) {
    var order = ['pay', 'details', 'start'];
    var shown = step; if (step === 'done') step = 'start';
    document.querySelectorAll('#steps li').forEach(function (li) {
      var i = order.indexOf(li.getAttribute('data-step')), cur = order.indexOf(step);
      li.className = i < cur ? 'is-done' : i === cur ? 'is-on' : '';
      if (i < cur && li.textContent.indexOf('✓') === -1) li.textContent = li.textContent + ' ✓';
    });
    $('payStep').hidden = step !== 'pay';
    $('claimStep').hidden = step !== 'details';
    $('upiDoneStep').hidden = shown !== 'done';
    window.scrollTo(0, 0);
  }

  async function loadConfig() {
    var r = await fetch('/api/checkout/config', { cache: 'no-store' });
    CFG = await r.json();
    $('testBadge').hidden = CFG.mode !== 'test';
    if (isUpi()) {
      var within = (CFG.upi && CFG.upi.accessWithin) || '24 hours';
      $('payReassure').textContent = 'Pay by UPI to CA Varsha Varyani, then tell us where to send your access. It takes about a minute.';
      $('payMethods').innerHTML = 'UPI: GPay · PhonePe · Paytm · BHIM · any bank app<br><span>Paid directly to CA Varsha Varyani. Access within ' + within + ' after we check the payment.</span>';
      $('stepStart').textContent = '3 · Get access';
      document.querySelectorAll('.upiWithin').forEach(function (el) { el.textContent = within; });
    }
    var sel = $('cState');
    if (sel.options.length === 1) (CFG.states || []).forEach(function (s) { var o = document.createElement('option'); o.value = s.code; o.textContent = s.name; sel.appendChild(o); });
    render();
  }

  // POST with the signed form token; if it is too fresh (< 3 s) or stale, wait / refresh and retry once.
  async function postForm(path, build) {
    var r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: build() });
    var d = await r.json();
    if (d && d.code === 'FORM_TOKEN') {
      if (d.reason === 'too_fast') await new Promise(function (ok) { setTimeout(ok, 3300); });
      else await loadConfig();
      r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: build() });
      d = await r.json();
    }
    return d;
  }
  async function postJson(path, body) {
    var r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return r.json();
  }

  function busy(on, label) { var b = $('payBtn'); b.disabled = on; b.textContent = on ? (label || 'Opening secure payment…') : payLabel(amount()); }

  async function startPayment() {
    clearError('payError');
    if (!CFG) { try { await loadConfig(); } catch (e) { return showError('payError', 'Could not reach the server. Please check your connection.'); } }
    busy(true);
    var a = amount();
    if (window.aaeTrack) aaeTrack('begin_checkout', { currency: 'INR', value: a.total, checkout_flow: 'payfirst', checkout_source: source });
    var d;
    try {
      d = await postForm('/api/checkout/create-order', function () {
        return JSON.stringify({ flow: 'payfirst', source: source, addons: selectedAddons(), website: $('hpWebsite').value || '', formToken: CFG && CFG.formToken, attribution: window.aaeAttribution ? aaeAttribution() : null });
      });
    } catch (e) { d = { ok: false, error: 'Network error. Please check your connection and try again.' }; }
    if (!d || !d.ok) { busy(false); return showError('payError', d && d.error); }
    ORDER = d;
    if (d.gateway === 'razorpay') openRazorpay(d);
    else if (d.gateway === 'upi') showUpiPanel(d);
    else { $('testOrderId').textContent = d.orderId; $('testAmount').textContent = fmt(d.amount.total); $('testPanel').hidden = false; busy(false); $('testPanel').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }

  function loadScript(src) {
    return new Promise(function (ok, bad) {
      if (document.querySelector('script[src="' + src + '"]')) return ok();
      var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { bad(new Error('Could not load payment library')); };
      document.head.appendChild(s);
    });
  }
  function openRazorpay(d) {
    loadScript('https://checkout.razorpay.com/v1/checkout.js').then(function () {
      var rz = new window.Razorpay({
        key: d.keyId, amount: d.amountPaise, currency: d.currency || 'INR', order_id: d.orderId,
        name: 'CA Varsha Varyani', description: d.description, theme: { color: '#c4953a' },
        handler: function (resp) { verify({ orderId: d.orderId, paymentId: resp.razorpay_payment_id, signature: resp.razorpay_signature }); },
        modal: { ondismiss: function () { busy(false); } },
      });
      rz.on('payment.failed', function (r) { busy(false); showError('payError', 'Payment failed' + (r && r.error && r.error.description ? ': ' + r.error.description : '') + '. Nothing has been charged. Please try again.'); });
      rz.open();
    }).catch(function (e) { busy(false); showError('payError', e.message); });
  }

  async function verify(body) {
    busy(true, 'Confirming your payment…');
    var d;
    try { d = await postJson('/api/checkout/verify', body); } catch (e) { d = { ok: false, error: 'Network error while confirming. If money was deducted, your access is safe: refresh this page.' }; }
    if (!d || !d.ok) { busy(false); return showError('payError', d && d.error); }
    if (!d.claim) { location.href = d.next; return; }
    var pending = { orderId: d.orderId, claimToken: d.claimToken, payer: d.payer || {}, total: d.amount && d.amount.total, at: Date.now() };
    store.set(pending);
    showClaim(pending);
  }

  // ── UPI mode: pay in any UPI app → UTR → details → submitted (access after the payment is checked in /admin) ──
  var isPhone = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  function showUpiPanel(d) {
    var u = d.upi || {};
    $('upiAmt').textContent = fmt(d.amount.total);
    $('upiVpa').textContent = u.vpa || ''; $('upiPayee').textContent = u.payeeName || '';
    $('upiQr').innerHTML = u.qrSvg || '';
    $('upiAppBtn').href = u.link || '#';
    $('upiAppBtn').hidden = !isPhone;
    $('upiHint').textContent = isPhone ? 'Or scan this QR from another phone' : "Scan with your phone's UPI app";
    $('upiPanel').hidden = false; $('payBtn').hidden = true; $('payReassure').hidden = true;
    $('addonSkills').disabled = true; // the amount is fixed once the QR is shown
    busy(false);
    $('upiPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (window.aaeTrack) aaeTrack('upi_payment_shown', { currency: 'INR', value: d.amount.total, checkout_source: source });
  }
  function upiNext() {
    clearError('upiError');
    var utr = $('upiUtr').value.replace(/\D/g, '');
    if (!/^\d{12}$/.test(utr)) return showError('upiError', 'Please enter the 12-digit UPI transaction ID (UTR / UPI Ref No.) from your UPI app.');
    UPI_PENDING = { orderId: ORDER.orderId, submitToken: ORDER.submitToken, utr: utr, total: ORDER.amount.total };
    $('paidLabel').textContent = 'Payment submitted';
    $('paidAmount').textContent = fmt(UPI_PENDING.total);
    $('paidSub').textContent = 'UTR ' + utr + '. We will check it and send your access.';
    $('claimHeading').textContent = 'Where should we send your course access?';
    $('claimReassure').textContent = 'Your access is sent to this email and WhatsApp within ' + ((CFG.upi && CFG.upi.accessWithin) || '24 hours') + ', after we check the payment.';
    $('claimBtn').textContent = 'Submit';
    setStep('details');
    setTimeout(function () { $('cEmail').focus(); }, 60);
  }

  function showClaim(p) {
    $('paidAmount').textContent = p.total ? fmt(p.total) : 'confirmed';
    if (p.payer && p.payer.email && !$('cEmail').value) $('cEmail').value = p.payer.email;
    if (p.payer && p.payer.phone && !$('cPhone').value) $('cPhone').value = p.payer.phone;
    setStep('details');
    setTimeout(function () { ($('cEmail').value ? $('cName') : $('cEmail')).focus(); }, 60);
  }

  async function submitClaim(ev) {
    ev.preventDefault();
    clearError('claimError');
    var p = store.get() || {};
    var email = $('cEmail').value.trim().toLowerCase();
    var phone = $('cPhone').value.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
    var name = $('cName').value.trim().replace(/\s+/g, ' ');
    var state = $('cState').value;
    var gstin = $('cGstin').value.toUpperCase().replace(/\s+/g, '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return showError('claimError', 'Please enter a valid email. It becomes your login.');
    if (!/^[6-9]\d{9}$/.test(phone)) return showError('claimError', 'Please enter a valid 10-digit mobile number.');
    if (name.length < 2) return showError('claimError', 'Please enter your full name.');
    if (!state) return showError('claimError', 'Please select your state.');
    if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) return showError('claimError', 'Please enter a valid 15-character GSTIN, or leave it blank.');
    var btn = $('claimBtn'); btn.disabled = true; btn.textContent = UPI_PENDING ? 'Submitting…' : 'Setting up your access…';
    var d;
    if (UPI_PENDING) {
      try { d = await postJson('/api/checkout/upi-submit', { orderId: UPI_PENDING.orderId, submitToken: UPI_PENDING.submitToken, utr: UPI_PENDING.utr, email: email, phone: phone, name: name, state: state, gstin: gstin }); }
      catch (e) { d = { ok: false, error: 'Network error. Your payment is safe. Please try again.' }; }
      btn.disabled = false; btn.textContent = 'Submit';
      if (!d || !d.ok) {
        if (d && (d.code === 'BAD_UTR' || d.code === 'UTR_USED')) { setStep('pay'); return showError('upiError', d.error); }
        return showError('claimError', d && d.error);
      }
      $('upiDoneUtr').textContent = UPI_PENDING.utr; $('upiDoneEmail').textContent = d.email || email;
      var sup = (window.AAE_CONFIG || {}).SUPPORT_EMAIL; if (sup) { $('upiDoneSupport').textContent = sup; $('upiDoneSupport').href = 'mailto:' + sup; }
      if (window.aaeTrack) aaeTrack('upi_payment_submitted', { currency: 'INR', value: UPI_PENDING.total, checkout_source: source });
      UPI_PENDING = null;
      setStep('done');
      return;
    }
    try { d = await postJson('/api/checkout/claim', { orderId: p.orderId, claimToken: p.claimToken, email: email, phone: phone, name: name, state: state, gstin: gstin }); }
    catch (e) { d = { ok: false, error: 'Network error. Your payment is safe. Please try again.' }; }
    if (!d || !d.ok) { btn.disabled = false; btn.textContent = 'Get my access'; return showError('claimError', d && d.error); }
    store.clear();
    setStep('start');
    location.href = d.next;
  }

  // GSTIN starts with the GST state code: pick the matching state.
  $('cGstin').addEventListener('input', function () {
    this.value = this.value.toUpperCase().replace(/\s+/g, '');
    var code = this.value.slice(0, 2), sel = $('cState');
    if (/^\d{2}$/.test(code) && Array.prototype.some.call(sel.options, function (o) { return o.value === code; })) sel.value = code;
  });
  $('addonSkills').addEventListener('change', render);
  $('payBtn').addEventListener('click', startPayment);
  $('upiNextBtn').addEventListener('click', upiNext);
  $('upiCopy').addEventListener('click', function () {
    var b = this, done = function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy'; }, 1500); };
    if (navigator.clipboard) navigator.clipboard.writeText($('upiVpa').textContent).then(done, done); else done();
  });
  $('testPayBtn').addEventListener('click', function () { if (ORDER) verify({ orderId: ORDER.orderId, testToken: ORDER.testToken }); });
  $('claimForm').addEventListener('submit', submitClaim);

  // Resume a paid-but-unclaimed order: from the link (?claim=&t=) or this browser's memory (7 days).
  var linkClaim = params.get('claim') && params.get('t') ? { orderId: params.get('claim'), claimToken: params.get('t'), payer: {}, at: Date.now() } : null;
  if (linkClaim) store.set(linkClaim);
  var pending = store.get();
  if (pending && Date.now() - (pending.at || 0) > 7 * 864e5) { store.clear(); pending = null; }

  loadConfig().catch(function () { showError('payError', 'Could not reach the server. Please refresh the page.'); })
    .then(function () { if (pending && pending.orderId && pending.claimToken) showClaim(pending); });
})();
