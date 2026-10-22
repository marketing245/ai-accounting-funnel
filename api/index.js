'use strict';
// Single serverless function for every /api/* route (Vercel Hobby allows 12 functions; we route in-process instead).
// vercel.json rewrites /api/<route> → /api/index?route=<route>; locally server.js calls this directly with the original URL.
// Body parsing is disabled so the Razorpay webhook can verify the raw body; handlers read JSON via src/lib/http.readJson.
const ROUTES = {
  'health': () => require('../src/handlers/health'),
  'inquiry': () => require('../src/handlers/inquiry'),
  'checkout/config': () => require('../src/handlers/checkout/config'),
  'checkout/create-order': () => require('../src/handlers/checkout/create-order'),
  'checkout/verify': () => require('../src/handlers/checkout/verify'),
  'checkout/webhook': () => require('../src/handlers/checkout/webhook'),
  'checkout/order': () => require('../src/handlers/checkout/order'),
  'auth/login': () => require('../src/handlers/auth/login'),
  'auth/logout': () => require('../src/handlers/auth/logout'),
  'auth/me': () => require('../src/handlers/auth/me'),
  'auth/set-password': () => require('../src/handlers/auth/set-password'),
  'course/lessons': () => require('../src/handlers/course/lessons'),
  'course/progress': () => require('../src/handlers/course/progress'),
  'certificate': () => require('../src/handlers/certificate'),
  'certificate/pdf': () => require('../src/handlers/certificate/pdf'),
  'certificate/verify': () => require('../src/handlers/certificate/verify'),
  'admin/login': () => require('../src/handlers/admin/login'),
  'admin/logout': () => require('../src/handlers/admin/logout'),
  'admin/overview': () => require('../src/handlers/admin/overview'),
  'admin/export': () => require('../src/handlers/admin/export'),
  'admin/order': () => require('../src/handlers/admin/order'),
  'admin/student': () => require('../src/handlers/admin/student'),
};

module.exports = async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let rel = (u.searchParams.get('route') || '').trim();
  if (!rel) rel = u.pathname.replace(/^\/api\/?/, '').replace(/\/+$/, '');
  rel = rel.replace(/^\/+|\/+$/g, '').toLowerCase();
  if (rel === 'index') rel = '';
  const load = ROUTES[rel];
  if (!load) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ ok: false, error: 'Not found' }));
  }
  return load()(req, res);
};
module.exports.config = { api: { bodyParser: false } };
