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
