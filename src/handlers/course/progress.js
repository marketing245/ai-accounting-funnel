'use strict';
const { readJson, send, fail, allow, wrap } = require('../../lib/http');
const auth = require('../../lib/auth');
const { CURRICULUM } = require('../../lib/course');

module.exports = wrap(async (req, res) => {
  if (!allow(req, res, ['POST'])) return;
  const session = auth.requireSession(req, res); if (!session) return;
  const body = await readJson(req);
  const valid = new Set(CURRICULUM.map((m) => m.id));
  const completed = Array.isArray(body.completed) ? [...new Set(body.completed.map(Number).filter((n) => valid.has(n)))] : null;
  if (!completed) return fail(res, 400, 'completed must be an array of module ids.');
  const user = await auth.getUser(session.email);
  if (!user) return fail(res, 401, 'Session expired.');
  const lastModule = Number(body.lastModule) || null;
  const prev = user.progress || {};
  const same = JSON.stringify([...(prev.completed || [])].sort()) === JSON.stringify([...completed].sort()) && (prev.lastModule || null) === lastModule;
  if (!same) { // skip the write when nothing changed (Blob operations are metered)
    user.progress = { completed, updatedAt: new Date().toISOString(), lastModule };
    await auth.saveUser(user);
  }
  send(res, 200, { ok: true, progress: user.progress });
});
