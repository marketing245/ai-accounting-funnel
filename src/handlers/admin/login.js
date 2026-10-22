'use strict';
const { readJson, send, fail, allow, wrap } = require('../../lib/http');
const admin = require('../../lib/admin');
const auth = require('../../lib/auth');
const store = require('../../lib/store');
const MAX_FAILS = 10, LOCK_MIN = 15;
module.exports = wrap(async (req, res) => {
  if (!allow(req, res, ['POST'])) return;
  if (!auth.sameOrigin(req, res)) return;
  if (!process.env.ADMIN_PASSWORD) return fail(res, 503, 'ADMIN_PASSWORD is not configured on the server.');
  const body = await readJson(req);
  const lock = (await store.readJson('admin/lockout.json')) || { fails: 0, until: null, last: null };
  if (lock.until && new Date(lock.until) > new Date()) return fail(res, 429, `Too many attempts. Admin login is locked until ${new Date(lock.until).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST.`);
  await new Promise((r) => setTimeout(r, 400)); // slow down guessing
  if (!admin.checkPassword(String(body.password || ''))) {
    lock.fails = (lock.fails || 0) + 1; lock.last = new Date().toISOString();
    if (lock.fails >= MAX_FAILS) { lock.until = new Date(Date.now() + LOCK_MIN * 60000).toISOString(); lock.fails = 0; }
    await store.writeJson('admin/lockout.json', lock);
    return fail(res, 401, 'Wrong password.');
  }
  if (lock.fails || lock.until) await store.writeJson('admin/lockout.json', { fails: 0, until: null, last: lock.last });
  admin.setAdminSession(res, req);
  send(res, 200, { ok: true });
});
