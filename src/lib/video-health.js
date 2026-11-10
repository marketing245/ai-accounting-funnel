'use strict';
// Admin "Course videos": is the video service up, which Bunny video each module plays, and how students watch it.
// Service status needs the Bunny ACCOUNT key (BUNNY_API_KEY): library → its pull zone (Enabled?) + account balance.
// Without it, only the per-module video list (BUNNY_STREAM_API_KEY) is used. Cached 5 minutes.
const bunny = require('./bunny');
const { CURRICULUM } = require('./course');

const CACHE_MS = 5 * 60 * 1000;
let cache = { at: 0, data: null };

async function bunnyGet(path) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), 6000);
  try {
    const r = await fetch('https://api.bunny.net' + path, { headers: { AccessKey: process.env.BUNNY_API_KEY, Accept: 'application/json' }, signal: c.signal });
    return r.ok ? r.json() : { _status: r.status };
  } finally { clearTimeout(t); }
}

async function serviceStatus() {
  if (!process.env.BUNNY_API_KEY) return { checked: false, note: 'Add BUNNY_API_KEY (Bunny account key) on the server to see the video service status here.' };
  const libId = process.env.BUNNY_LIBRARY_ID || '786834';
  try {
    const lib = await bunnyGet(`/videolibrary/${libId}`);
    if (lib._status) return { checked: true, ok: false, problem: `Bunny did not answer (HTTP ${lib._status}). Check the Bunny account.` };
    const [pz, user] = await Promise.all([lib.PullZoneId ? bunnyGet(`/pullzone/${lib.PullZoneId}`) : null, bunnyGet('/user')]);
    const enabled = pz && !pz._status ? pz.Enabled !== false && !pz.Suspended : null;
    const balance = user && !user._status ? Number(user.Balance || 0) : null;
    const suspended = user && !user._status ? !!user.Suspended : null;
    const ok = enabled !== false && !suspended;
    let problem = null;
    if (!ok) problem = balance !== null && balance <= 0
      ? 'Videos are OFF: the Bunny account has no credit left (the free trial has ended), so Bunny switched the video zone off. Students see a 404 instead of the lesson. Add credit in Bunny (Billing) and the videos come back on their own.'
      : 'Videos are OFF: Bunny has switched the video zone off. Open the Bunny account to see why.';
    return { checked: true, ok, problem, balanceUsd: balance, suspended, zoneEnabled: enabled, videoCount: lib.VideoCount, storageMb: Math.round((lib.StorageUsage || 0) / 1048576), trafficMb: Math.round((lib.TrafficUsage || 0) / 1048576) };
  } catch (e) { return { checked: true, ok: false, problem: 'Could not reach Bunny: ' + e.message }; }
}

// engagementModules: admin.engagementSummary(...).modules (viewed / completed / avg watch per module, real students only)
async function videoReport(engagementModules, studentCount) {
  if (!cache.data || Date.now() - cache.at > CACHE_MS) {
    const [service, resolved] = await Promise.all([serviceStatus(), bunny.resolveVideos(CURRICULUM).catch(() => ({}))]);
    cache = { at: Date.now(), data: { service, resolved } };
  }
  const { service, resolved } = cache.data;
  const modules = CURRICULUM.map((m) => {
    const v = resolved[m.id] || null; const e = (engagementModules || []).find((x) => x.id === m.id) || {};
    return { id: m.id, code: m.code, title: m.title, plannedDuration: m.duration,
      video: v ? { id: v.videoId, title: v.title, status: v.source === 'static' ? 'not checked (Bunny did not answer)' : v.statusText, ready: v.source === 'static' ? null : v.ready, lengthMin: v.lengthSec ? Math.round(v.lengthSec / 60) : null, source: v.source } : null,
      viewed: e.viewed || 0, completed: e.completed || 0, viewedPct: e.viewedPct || 0, completedPct: e.completedPct || 0, avgWatchMin: e.avgWatchMin || 0 };
  });
  return { service, modules, students: studentCount };
}

module.exports = { videoReport };
