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

  // ── Attribution: every click id / UTM the visitor arrived with, first touch, last touch and up to 10 touches ──
  var CLICK_IDS = ['gclid', 'gbraid', 'wbraid', 'dclid', 'fbclid', 'ttclid', 'msclkid', 'li_fat_id', 'twclid', 'sclid'];
  var UTMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id'];
  function rand() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
  function getCookie(n) { var m = document.cookie.match(new RegExp('(?:^|; )' + n + '=([^;]*)')); return m ? decodeURIComponent(m[1]) : ''; }
  function touch() {
    var p = new URLSearchParams(location.search);
    var ref = '', refHost = '';
    try { if (document.referrer) { var u = new URL(document.referrer); refHost = u.hostname; ref = document.referrer.slice(0, 300); } } catch (e) {}
    var own = refHost && refHost === location.hostname;
    var t = { at: new Date().toISOString(), landing: (location.pathname + location.search).slice(0, 300), referrer: own ? '' : ref, referrerHost: own ? '' : refHost.replace(/^www\./, '') };
    UTMS.forEach(function (k) { t[k.replace('utm_', '')] = (p.get(k) || '').slice(0, 150); });
    CLICK_IDS.forEach(function (k) { t[k] = (p.get(k) || '').slice(0, 200); });
    if (!t.source) {
      if (t.gclid || t.gbraid || t.wbraid) { t.source = 'google'; t.medium = t.medium || 'cpc'; }
      else if (t.fbclid) { t.source = 'facebook'; t.medium = t.medium || 'paid_social'; }
      else if (t.ttclid) { t.source = 'tiktok'; t.medium = t.medium || 'paid_social'; }
      else if (t.msclkid) { t.source = 'bing'; t.medium = t.medium || 'cpc'; }
      else if (t.li_fat_id) { t.source = 'linkedin'; t.medium = t.medium || 'paid_social'; }
      else if (t.referrerHost) { t.source = t.referrerHost; t.medium = t.medium || (/google|bing|yahoo|duckduckgo/.test(t.referrerHost) ? 'organic' : /facebook|instagram|linkedin|twitter|x\.com|youtube|whatsapp|t\.co/.test(t.referrerHost) ? 'social' : 'referral'); }
      else { t.source = 'direct'; t.medium = t.medium || 'none'; }
    }
    t.meaningful = !!(p.get('utm_source') || CLICK_IDS.some(function (k) { return t[k]; }) || t.referrerHost);
    return t;
  }
  try {
    var t = touch();
    if (!localStorage.getItem('aae_vid')) { localStorage.setItem('aae_vid', rand()); localStorage.setItem('aae_first_seen', t.at); }
    if (!localStorage.getItem('aae_first_touch')) localStorage.setItem('aae_first_touch', JSON.stringify(t));
    if (t.meaningful || !localStorage.getItem('aae_last_touch')) localStorage.setItem('aae_last_touch', JSON.stringify(t));
    if (t.meaningful) { var arr = JSON.parse(localStorage.getItem('aae_touches') || '[]'); arr.push(t); localStorage.setItem('aae_touches', JSON.stringify(arr.slice(-10))); }
    var sess = sessionStorage.getItem('aae_sid'); if (!sess) { sessionStorage.setItem('aae_sid', rand()); localStorage.setItem('aae_sessions', String((parseInt(localStorage.getItem('aae_sessions') || '0', 10) || 0) + 1)); }
    localStorage.setItem('aae_pageviews', String((parseInt(localStorage.getItem('aae_pageviews') || '0', 10) || 0) + 1));
  } catch (e) {}
  window.aaeAttribution = function () {
    var out = { vid: '', firstSeen: '', sessions: 0, pageviews: 0, first: null, last: null, touches: [], page: location.href.slice(0, 300), screen: (screen && screen.width) + 'x' + (screen && screen.height), tz: '', lang: navigator.language || '', fbp: getCookie('_fbp'), fbc: getCookie('_fbc'), ga: getCookie('_ga') };
    try {
      out.vid = localStorage.getItem('aae_vid') || ''; out.firstSeen = localStorage.getItem('aae_first_seen') || '';
      out.sessions = parseInt(localStorage.getItem('aae_sessions') || '0', 10) || 0; out.pageviews = parseInt(localStorage.getItem('aae_pageviews') || '0', 10) || 0;
      out.first = JSON.parse(localStorage.getItem('aae_first_touch') || 'null'); out.last = JSON.parse(localStorage.getItem('aae_last_touch') || 'null'); out.touches = JSON.parse(localStorage.getItem('aae_touches') || '[]');
      out.tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      if (!out.fbc && out.last && out.last.fbclid) out.fbc = 'fb.1.' + Date.now() + '.' + out.last.fbclid;
    } catch (e) {}
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
        if (map[name]) window.fbq('track', map[name], { value: params.value, currency: params.currency || 'INR', content_name: 'AI in Accounting Course' }, params.transaction_id ? { eventID: params.transaction_id } : undefined);
      }
    } catch (e) {}
  };
})();
