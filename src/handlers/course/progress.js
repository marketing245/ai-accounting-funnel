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
  const lastModule = Number(body.lastModule) || null;
  const user = await auth.getUser(session.email);
  if (!user) return fail(res, 401, 'Session expired.');
  const prev = user.progress || {};
  const modules = Object.assign({}, prev.modules || {});
  const now = new Date().toISOString();
  // viewed deltas from the portal: { "<moduleId>": { views, watchSeconds, activeSeconds } } — added, never replaced
  const viewed = body.viewed && typeof body.viewed === 'object' ? body.viewed : {};
  let changed = false;
  for (const [k, v] of Object.entries(viewed)) {
    const id = Number(k); if (!valid.has(id) || !v || typeof v !== 'object') continue;
    const m = modules[id] = Object.assign({ views: 0, watchSeconds: 0, activeSeconds: 0, firstViewedAt: now, lastViewedAt: now }, modules[id] || {});
    const views = Math.min(50, Math.max(0, Number(v.views) || 0)), ws = Math.min(7200, Math.max(0, Number(v.watchSeconds) || 0)), as = Math.min(7200, Math.max(0, Number(v.activeSeconds) || 0));
    if (views || ws || as) { m.views += views; m.watchSeconds += Math.round(ws); m.activeSeconds += Math.round(as); m.lastViewedAt = now; changed = true; }
  }
  const prevCompleted = new Set(prev.completed || []);
  for (const id of completed) if (!prevCompleted.has(id)) { modules[id] = Object.assign({ views: 0, watchSeconds: 0, activeSeconds: 0, firstViewedAt: now, lastViewedAt: now }, modules[id] || {}, { completedAt: now }); changed = true; }
  for (const id of prevCompleted) if (!completed.includes(id) && modules[id]) { delete modules[id].completedAt; changed = true; }
  const same = !changed && JSON.stringify([...prevCompleted].sort()) === JSON.stringify([...completed].sort()) && (prev.lastModule || null) === lastModule;
  if (!same) { // skip the write when nothing changed (Blob operations are metered)
    user.progress = { completed, lastModule, modules, updatedAt: now, firstActivityAt: prev.firstActivityAt || now };
    await auth.saveUser(user);
  }
  send(res, 200, { ok: true, progress: user.progress });
});
