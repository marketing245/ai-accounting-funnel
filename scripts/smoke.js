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
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
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
  check('checkout config', r.status === 200 && r.data.amount.total === 1769 && !('amounts' in r.data) && !!r.data.formToken, JSON.stringify(r.data.amount));
  const formToken = r.data.formToken;
  r = await call('POST', '/api/checkout/create-order', { name: 'Smoke Tester', email, phone: '9876543210', formToken });
  check('create-order rejects a form token younger than 3 s', r.status === 400 && r.data.code === 'FORM_TOKEN');
  r = await call('POST', '/api/checkout/create-order', { name: 'Smoke Tester', email, phone: '9876543210' });
  check('create-order rejects a missing form token', r.status === 400 && r.data.code === 'FORM_TOKEN');
  r = await call('POST', '/api/checkout/create-order', { name: 'Smoke Tester', email, phone: '9876543210', formToken, website: 'http://spam.example' });
  check('create-order rejects honeypot', r.status === 400);
  await new Promise((res) => setTimeout(res, 3300));
  r = await call('POST', '/api/checkout/create-order', { name: 'CSRF Probe', email, phone: '9876543210', formToken }, { headers: { Origin: 'https://evil.example' } });
  check('create-order rejects foreign Origin', r.status === 403 && r.data.code === 'BAD_ORIGIN');

  r = await call('POST', '/api/checkout/create-order', { name: 'Smoke Tester', email, phone: '9876543210', formToken, bump: true /* must be ignored */, attribution: { first: { source: 'google', medium: 'cpc', campaign: 'smoke_campaign', gclid: 'x', landing: '/?utm_source=google' }, last: { source: 'google', medium: 'cpc', campaign: 'smoke_campaign', gclid: 'TeSt.gclid', landing: '/?utm_source=google' }, touches: [{ source: 'google', medium: 'cpc', campaign: 'smoke_campaign', gclid: 'TeSt.gclid', at: new Date().toISOString(), landing: '/' }], page: 'http://x/', screen: '1x1', vid: 'smokevid', sessions: 2, pageviews: 5 } });
  check('create order (test gateway)', r.status === 200 && r.data.gateway === 'test' && r.data.testToken, r.data?.orderId);
  const order = r.data;

  r = await call('POST', '/api/checkout/create-order', { name: 'X', email: 'bad', phone: '123', formToken });
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
  check('lessons (5 modules, embed urls, no video ids leaked)', r.status === 200 && mods.length === 5 && mods.every((m) => m.embedUrl && m.embedUrl.includes('iframe.mediadelivery.net') && m.videoStatus === 'ready' && m.description && !('bunnyVideoId' in m) && !('prompts' in m)));

  if (mods[0] && /[?&]token=/.test(mods[0].embedUrl)) {
    const e = await fetch(mods[0].embedUrl); const html = await e.text();
    check('signed embed url opens the player', e.status === 200 && /\.m3u8/.test(html));
    const u = await fetch(mods[0].embedUrl.split('?')[0] + '?nocache=' + Date.now()); const h2 = await u.text();
    check('unsigned embed url is blocked', !/\.m3u8/.test(h2));
  }
  r = await call('POST', '/api/course/progress', { completed: [1, 2, 99], lastModule: 2, viewed: { 1: { views: 2, watchSeconds: 90, activeSeconds: 120 }, 99: { views: 1 } } });
  check('progress saved (invalid ids dropped)', r.status === 200 && JSON.stringify(r.data.progress.completed) === '[1,2]');
  check('engagement merged per module', r.data.progress.modules && r.data.progress.modules[1] && r.data.progress.modules[1].views === 2 && r.data.progress.modules[1].watchSeconds === 90 && !!r.data.progress.modules[1].completedAt && !r.data.progress.modules[99]);
  r = await call('POST', '/api/course/progress', { completed: [1, 2], lastModule: 2, viewed: { 1: { views: 1, watchSeconds: 30 } } });
  check('engagement accumulates', r.data.progress.modules[1].views === 3 && r.data.progress.modules[1].watchSeconds === 120);
  r = await call('GET', '/api/course/lessons');
  check('progress persisted', r.data?.progress?.completed?.length === 2);

  r = await call('GET', '/api/certificate');
  check('certificate locked before completion', r.status === 200 && r.data.ready === false && r.data.remaining === 3);
  r = await call('GET', '/api/certificate/pdf');
  check('certificate pdf refused before completion', r.status === 409);
  r = await call('POST', '/api/course/progress', { completed: [1, 2, 3, 4, 5], lastModule: 5 });
  r = await call('GET', '/api/certificate');
  const certId = r.data?.certificate?.id;
  check('certificate issued after 5/5', r.status === 200 && r.data.ready === true && /^AAE-\d{4}-[A-Z2-9]{6}$/.test(certId || '') && r.data.certificate.linkedinUrl.includes('linkedin.com'), certId);
  r = await call('GET', '/api/certificate');
  check('certificate id is stable', r.data?.certificate?.id === certId);
  {
    const p = await fetch(BASE + '/api/certificate/pdf', { headers: { Cookie: cookie } });
    const buf = Buffer.from(await p.arrayBuffer());
    check('certificate pdf downloads', p.status === 200 && p.headers.get('content-type') === 'application/pdf' && buf.slice(0, 5).toString() === '%PDF-' && buf.length > 2000, `${buf.length} bytes`);
  }
  r = await call('GET', `/api/certificate/verify?id=${certId}`, null, { noCookie: true });
  check('public verify → valid', r.status === 200 && r.data.valid === true && r.data.certificate.name === 'Smoke Tester' && !('emailHash' in r.data.certificate));
  r = await call('GET', '/api/certificate/verify?id=AAE-2026-ZZZZZZ', null, { noCookie: true });
  check('public verify → invalid id', r.status === 200 && r.data.valid === false);

  r = await call('POST', '/api/auth/login', { email, password: 'whatever1' }, { noCookie: true });
  check('login before password set → NO_PASSWORD', r.status === 409 && r.data.code === 'NO_PASSWORD');

  r = await call('POST', '/api/auth/set-password', { password: 'short' });
  check('set-password rejects short', r.status === 400);
  const oldCookie = cookie;
  r = await call('POST', '/api/auth/set-password', { password });
  check('set-password (re-issues session)', r.status === 200 && r.data.ok && cookie !== oldCookie);
  { const o = await fetch(BASE + '/api/auth/me', { headers: { Cookie: oldCookie } }); check('session from before the password change is rejected', o.status === 401); }
  r = await call('GET', '/api/auth/me');
  check('new session works', r.status === 200);

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
  r = await call('GET', '/api/auth/me');
  check('me after login', r.status === 200);
  r = await call('GET', '/api/course/lessons');
  check('lessons after login', r.status === 200 && r.data.ok);

  r = await call('POST', '/api/auth/set-password', { password: 'AnotherPass123', currentPassword: 'nope' });
  check('change password needs current password', r.status === 400);

  // inquiries (1:1 / workshops form) must NOT create orders
  r = await call('POST', '/api/inquiry', { name: 'Smoke Inquirer', email: 'inq+' + Date.now() + '@example.com', phone: '9876543210', type: 'Corporate Webinar / Team Workshop', notes: 'team of 12', formToken, attribution: { last: { source: 'linkedin', medium: 'social', campaign: 'inq_test', landing: '/workshops' } } }, { noCookie: true });
  check('inquiry stored', r.status === 200 && r.data.ok && /^inq_/.test(r.data.id));
  r = await call('POST', '/api/inquiry', { name: 'x', email: 'bad', phone: '1', formToken }, { noCookie: true });
  check('inquiry validates', r.status === 400);

  // admin panel
  cookie = '';
  r = await call('GET', '/api/admin/overview');
  check('admin overview requires login', r.status === 401);
  r = await call('POST', '/api/admin/login', { password: 'wrong-password' });
  check('admin wrong password → 401', r.status === 401);
  const adminPw = process.env.ADMIN_PASSWORD;
  if (adminPw) {
    r = await call('POST', '/api/admin/login', { password: adminPw });
    check('admin login', r.status === 200 && r.data.ok && !!cookie);
    r = await call('GET', '/api/admin/overview');
    const ov = r.data || {};
    const mine = (ov.orders || []).find((o) => o.id === order.orderId);
    check('admin overview lists the order with attribution', r.status === 200 && mine && mine.status === 'paid' && mine.source === 'google' && mine.campaign === 'smoke_campaign' && typeof ov.stats.revenueAll === 'number', mine && `${mine.source}/${mine.campaign}`);
    const stu = (ov.students || []).find((u) => u.email === email);
    check('admin overview lists the student', stu && stu.completed === 5 && stu.certificate === certId);
    check('admin student engagement fields', stu && stu.loginCount >= 2 && stu.watchMin === 2 && stu.viewed >= 1 && stu.status === 'completed' && Array.isArray(stu.perModule) && stu.perModule.length === 5, stu && `logins=${stu.loginCount} watch=${stu.watchMin}`);
    check('admin engagement summary', ov.engagement && ov.engagement.modules.length === 5 && typeof ov.engagement.active7 === 'number');
    check('admin lists inquiries (not as orders)', Array.isArray(ov.inquiries) && ov.inquiries.some((q) => q.name === 'Smoke Inquirer' && q.campaign === 'inq_test') && !(ov.orders || []).some((o) => o.name === 'Smoke Inquirer'));
    r = await call('GET', `/api/admin/student?email=${encodeURIComponent(email)}`);
    check('admin student detail + timeline', r.status === 200 && r.data.student.email === email && r.data.timeline.length >= 4 && r.data.orders.length === 1);
    check('admin source table has google/cpc', (ov.bySource || []).some((b) => b.source === 'google' && b.paid >= 1));
    check('admin overview has breakdowns + settings', Array.isArray(ov.byCampaign) && Array.isArray(ov.byPlatform) && Array.isArray(ov.byDevice) && ov.settings && typeof ov.settings.paymentMode === 'string' && typeof ov.stats.conversion === 'number');
    check('admin order has geo/device/signals', mine && mine.platform === 'google_ads' && typeof mine.device === 'string' && ['not_configured', 'sent', 'error', ''].includes(mine.metaPurchase));
    r = await call('GET', '/api/admin/overview?days=7');
    check('admin overview date range', r.status === 200 && r.data.stats.days === 7);
    r = await call('GET', `/api/admin/order?id=${order.orderId}`);
    check('admin order detail', r.status === 200 && r.data.order.id === order.orderId && r.data.flat.campaign === 'smoke_campaign' && r.data.user && r.data.user.email === email);
    const e = await fetch(BASE + '/api/admin/export?type=orders', { headers: { Cookie: cookie } }); const csvText = await e.text();
    check('admin csv export', e.status === 200 && /text\/csv/.test(e.headers.get('content-type')) && csvText.includes(order.orderId) && csvText.includes('smoke_campaign') && csvText.includes('gclid'));
    const g = await fetch(BASE + '/api/admin/export?type=google-offline', { headers: { Cookie: cookie } }); const gText = await g.text();
    check('google offline conversions csv', g.status === 200 && gText.replace(/^\ufeff/, '').startsWith('Google Click ID,GBRAID,WBRAID,Conversion Name,Conversion Time') && gText.includes('+05:30'));
    const m = await fetch(BASE + '/api/admin/export?type=meta-offline', { headers: { Cookie: cookie } }); const mText = await m.text();
    check('meta offline events csv', m.status === 200 && mText.includes('event_name') && mText.includes('Purchase'));
    r = await call('POST', '/api/admin/logout');
    cookie = '';
    if (/localhost|127\.0\.0\.1/.test(BASE)) {
      let last = null; for (let i = 0; i < 11; i++) { last = await call('POST', '/api/admin/login', { password: 'wrong-' + i }, { noCookie: true }); if (last.status === 429) break; }
      check('admin lockout after repeated failures', last.status === 429);
      const fsx = require('fs'); const lockFile = require('path').join(process.cwd(), '.data', 'dev', 'admin', 'lockout.json'); if (fsx.existsSync(lockFile)) fsx.unlinkSync(lockFile);
      try { const { del, list } = require('@vercel/blob'); const pg = await list({ prefix: 'dev/admin/' }); if (pg.blobs.length) await del(pg.blobs.map((b) => b.url)); } catch {}
    }
  } else console.log('skip  admin login checks (ADMIN_PASSWORD not in env)');

  // static pages
  for (const p of ['/', '/login', '/thank-you', '/portal', '/privacy', '/terms', '/refund', '/contact', '/verify', '/admin', '/workshops']) {
    const s = await fetch(BASE + p, { redirect: 'manual' });
    const html = await s.text();
    check(`page ${p}`, s.status === 200 && /<html/i.test(html), `${s.status}`);
  }
  const home = await (await fetch(BASE + '/')).text();
  check('home has no fake scarcity / UPI / old portal links / invented rating', !/Long Weekend|Limited Spots|okhdfcbank|I Have Paid|cd-h|4\.9 \/ 5/.test(home));
  check('home keeps the funnel focused (consultation moved to /workshops)', !/id="consultation-webinars"|bookingModal/.test(home) && /href="\/workshops"/.test(home));
  check('home loads tracking config + checkout modal', /site-config\.js/.test(home) && /analytics\.js/.test(home) && /checkoutPayBtn/.test(home));
  const cfg = await (await fetch(BASE + '/site-config.js')).text();
  check('GA4 id configured', /G-YZVRBXJRME/.test(cfg));
  const portal = await (await fetch(BASE + '/portal')).text();
  check('home has no add-on', !/orderBumpCheckbox|SOP pack/.test(home));
  check('portal html has no video ids / fake auth', !/mediadelivery\.net\/embed\/786834\/[0-9a-f]/.test(portal) && !/AAE-ACTIVE-MEMBER|verifyExistingMemberPhone/.test(portal));

  console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
