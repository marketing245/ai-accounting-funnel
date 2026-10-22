/**
 * End-to-end smoke test against a running server (default http://localhost:3000).
 * Usage: node scripts/smoke.js [baseUrl]
 * Exercises: health → checkout config → create test order → verify → session → lessons → progress → set password → logout → login → order summary → auth failures.
 */
'use strict';
const BASE = (process.argv[2] || process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
let cookie = '';
let failures = 0;

function check(name, cond, extra) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`);
  if (!cond) failures++;
}
async function call(method, path, body, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie && !opts.noCookie) headers.Cookie = cookie;
  const r = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' });
  const sc = r.headers.get('set-cookie');
  if (sc && !opts.noCookie) cookie = sc.split(';')[0];
  let data = null; try { data = await r.json(); } catch {}
  return { status: r.status, data, raw: r };
}

(async () => {
  const email = `smoke+${Date.now()}@example.com`;
  const password = 'Str0ngPass!word';

  let r = await call('GET', '/api/health');
  check('health', r.status === 200 && r.data.ok, `mode=${r.data?.paymentMode} storage=${r.data?.storage}`);
  if (r.data?.paymentMode !== 'test') { console.log('Server is not in test payment mode; cannot run the paid-flow checks.'); process.exit(1); }

  r = await call('GET', '/api/checkout/config');
  check('checkout config', r.status === 200 && r.data.amount.total === 1769 && !('amounts' in r.data), JSON.stringify(r.data.amount));

  r = await call('POST', '/api/checkout/create-order', { name: 'Smoke Tester', email, phone: '9876543210', bump: true /* must be ignored */ });
  check('create order (test gateway)', r.status === 200 && r.data.gateway === 'test' && r.data.testToken, r.data?.orderId);
  const order = r.data;

  r = await call('POST', '/api/checkout/create-order', { name: 'X', email: 'bad', phone: '123' });
  check('create order rejects bad input', r.status === 400, r.data?.error);

  r = await call('POST', '/api/checkout/verify', { orderId: order.orderId, testToken: 'forged' });
  check('verify rejects forged token', r.status === 400);

  r = await call('GET', '/api/course/lessons', null, { noCookie: true });
  check('lessons require login', r.status === 401);

  r = await call('POST', '/api/checkout/verify', { orderId: order.orderId, testToken: order.testToken });
  check('verify grants access + session cookie', r.status === 200 && r.data.ok && r.data.needsPassword === true && !!cookie, r.data?.next);

  r = await call('POST', '/api/checkout/verify', { orderId: order.orderId, testToken: order.testToken });
  check('verify is idempotent', r.status === 200 && r.data.ok);

  r = await call('GET', '/api/auth/me');
  check('me', r.status === 200 && r.data.user.email === email && r.data.user.hasAccess && !('hasBump' in r.data.user) && !r.data.user.hasPassword);

  r = await call('GET', `/api/checkout/order?id=${order.orderId}`);
  check('order summary for buyer', r.status === 200 && r.data.order.status === 'paid' && r.data.order.amount.total === 1769 && r.data.order.items.length === 1);

  r = await call('GET', '/api/course/lessons');
  const mods = r.data?.course?.modules || [];
  check('lessons (5 modules, embed urls, no video ids leaked)', r.status === 200 && mods.length === 5 && mods.every((m) => m.embedUrl && m.embedUrl.includes('iframe.mediadelivery.net') && m.description && !('bunnyVideoId' in m) && !('prompts' in m)));

  r = await call('POST', '/api/course/progress', { completed: [1, 2, 99], lastModule: 2 });
  check('progress saved (invalid ids dropped)', r.status === 200 && JSON.stringify(r.data.progress.completed) === '[1,2]');
  r = await call('GET', '/api/course/lessons');
  check('progress persisted', r.data?.progress?.completed?.length === 2);

  r = await call('POST', '/api/auth/login', { email, password: 'whatever1' }, { noCookie: true });
  check('login before password set → NO_PASSWORD', r.status === 409 && r.data.code === 'NO_PASSWORD');

  r = await call('POST', '/api/auth/set-password', { password: 'short' });
  check('set-password rejects short', r.status === 400);
  r = await call('POST', '/api/auth/set-password', { password });
  check('set-password', r.status === 200 && r.data.ok);

  r = await call('POST', '/api/auth/logout');
  check('logout clears cookie', r.status === 200 && /aae_session=;?$/.test(cookie) || cookie === 'aae_session=');
  cookie = '';
  r = await call('GET', '/api/auth/me');
  check('me after logout → 401', r.status === 401);

  r = await call('POST', '/api/auth/login', { email, password: 'WrongPass123' });
  check('login wrong password → 401', r.status === 401);
  cookie = '';
  r = await call('POST', '/api/auth/login', { email, password });
  check('login correct → session', r.status === 200 && r.data.ok && !!cookie);
  r = await call('GET', '/api/course/lessons');
  check('lessons after login', r.status === 200 && r.data.ok);

  r = await call('POST', '/api/auth/set-password', { password: 'AnotherPass123', currentPassword: 'nope' });
  check('change password needs current password', r.status === 400);

  // static pages
  for (const p of ['/', '/login', '/thank-you', '/portal', '/privacy', '/terms', '/refund', '/contact']) {
    const s = await fetch(BASE + p, { redirect: 'manual' });
    const html = await s.text();
    check(`page ${p}`, s.status === 200 && /<html/i.test(html), `${s.status}`);
  }
  const home = await (await fetch(BASE + '/')).text();
  check('home has no fake scarcity / UPI / old portal links', !/Long Weekend|Limited Spots|okhdfcbank|I Have Paid|cd-h/.test(home));
  check('home loads tracking config + checkout modal', /site-config\.js/.test(home) && /analytics\.js/.test(home) && /checkoutPayBtn/.test(home));
  const cfg = await (await fetch(BASE + '/site-config.js')).text();
  check('GA4 id configured', /G-YZVRBXJRME/.test(cfg));
  const portal = await (await fetch(BASE + '/portal')).text();
  check('home has no add-on', !/orderBumpCheckbox|SOP pack/.test(home));
  check('portal html has no video ids / fake auth', !/mediadelivery\.net\/embed\/786834\/[0-9a-f]/.test(portal) && !/AAE-ACTIVE-MEMBER|verifyExistingMemberPhone/.test(portal));

  console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
