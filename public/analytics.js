// Loads GA4 / Google Ads / Meta tags from AAE_CONFIG and exposes aaeTrack(name, params).
(function () {
  var cfg = window.AAE_CONFIG || {};
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  var ids = [cfg.GA4_ID, cfg.GOOGLE_ADS_ID].filter(Boolean);
  if (ids.length) {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ids[0]);
    document.head.appendChild(s);
    gtag('js', new Date());
    ids.forEach(function (id) { gtag('config', id, { anonymize_ip: true }); });
  }

  if (cfg.META_PIXEL_ID) {
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', cfg.META_PIXEL_ID);
    window.fbq('track', 'PageView');
  }

  // ── Attribution: remember where the visitor came from (first touch + last touch) for the admin panel ──
  function touch() {
    var p = new URLSearchParams(location.search);
    var ref = '';
    try { ref = document.referrer ? new URL(document.referrer).hostname : ''; } catch (e) {}
    var own = ref && ref === location.hostname;
    var t = { source: p.get('utm_source') || '', medium: p.get('utm_medium') || '', campaign: p.get('utm_campaign') || '', term: p.get('utm_term') || '', content: p.get('utm_content') || '',
      gclid: p.get('gclid') || '', fbclid: p.get('fbclid') || '', referrer: own ? '' : ref, landing: location.pathname + location.search, at: new Date().toISOString() };
    if (!t.source) {
      if (t.gclid) { t.source = 'google'; t.medium = t.medium || 'cpc'; }
      else if (t.fbclid) { t.source = 'facebook'; t.medium = t.medium || 'social'; }
      else if (t.referrer) { t.source = t.referrer.replace(/^www\./, ''); t.medium = t.medium || 'referral'; }
      else { t.source = 'direct'; t.medium = t.medium || 'none'; }
    }
    t.meaningful = !!(p.get('utm_source') || t.gclid || t.fbclid || t.referrer);
    return t;
  }
  try {
    var t = touch();
    if (!localStorage.getItem('aae_first_touch')) localStorage.setItem('aae_first_touch', JSON.stringify(t));
    if (t.meaningful || !localStorage.getItem('aae_last_touch')) localStorage.setItem('aae_last_touch', JSON.stringify(t));
  } catch (e) {}
  window.aaeAttribution = function () {
    var out = { first: null, last: null, page: location.href, screen: (screen && screen.width) + 'x' + (screen && screen.height) };
    try { out.first = JSON.parse(localStorage.getItem('aae_first_touch') || 'null'); out.last = JSON.parse(localStorage.getItem('aae_last_touch') || 'null'); } catch (e) {}
    return out;
  };

  // aaeTrack('purchase', {...}) → GA4 event (+ Google Ads conversion for purchase, + Meta when configured)
  window.aaeTrack = function (name, params) {
    params = params || {};
    try { if (ids.length) gtag('event', name, params); } catch (e) {}
    try {
      if (name === 'purchase' && cfg.GOOGLE_ADS_ID && cfg.GOOGLE_ADS_PURCHASE_LABEL) {
        gtag('event', 'conversion', { send_to: cfg.GOOGLE_ADS_ID + '/' + cfg.GOOGLE_ADS_PURCHASE_LABEL, value: params.value, currency: params.currency || 'INR', transaction_id: params.transaction_id });
      }
    } catch (e) {}
    try {
      if (window.fbq && cfg.META_PIXEL_ID) {
        var map = { begin_checkout: 'InitiateCheckout', add_payment_info: 'AddPaymentInfo', purchase: 'Purchase' };
        if (map[name]) window.fbq('track', map[name], { value: params.value, currency: params.currency || 'INR' });
      }
    } catch (e) {}
  };
})();
