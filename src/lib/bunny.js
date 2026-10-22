'use strict';
// Bunny Stream integration.
// 1) Runtime sync: the portal asks Bunny which videos exist in the library and maps them to modules —
//    by metaTag module=<id> (set by scripts/videos.js) or by title prefix "M01"/"Module 1". Newest finished video wins.
//    Manual overrides in src/lib/videos.json ({ "1": "<videoId>" }) take precedence. Static ids in course.js are the last fallback.
// 2) Signed embed URLs when BUNNY_TOKEN_AUTH_KEY is set (library setting "Embed view token authentication").
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const LIBRARY_ID = process.env.BUNNY_LIBRARY_ID || '786834';
const STREAM_API = 'https://video.bunnycdn.com';
const CACHE_MS = 5 * 60 * 1000;
const STATUS = { 0: 'created', 1: 'uploaded', 2: 'processing', 3: 'transcoding', 4: 'ready', 5: 'error', 6: 'upload_failed' };

let cache = { at: 0, videos: null };

function streamKey() { return process.env.BUNNY_STREAM_API_KEY || null; }

async function listVideos({ force = false } = {}) {
  if (!streamKey()) return null;
  if (!force && cache.videos && Date.now() - cache.at < CACHE_MS) return cache.videos;
  const all = [];
  for (let page = 1; page <= 10; page++) {
    const r = await fetch(`${STREAM_API}/library/${LIBRARY_ID}/videos?page=${page}&itemsPerPage=100&orderBy=date`, { headers: { AccessKey: streamKey(), Accept: 'application/json' } });
    if (!r.ok) throw new Error(`Bunny list videos failed: ${r.status}`);
    const data = await r.json();
    all.push(...(data.items || []));
    if (!data.items || data.items.length < 100) break;
  }
  cache = { at: Date.now(), videos: all };
  return all;
}

function moduleOfVideo(v) {
  const tag = (v.metaTags || []).find((t) => String(t.property).toLowerCase() === 'module');
  if (tag && /^\d+$/.test(String(tag.value))) return Number(tag.value);
  const m = String(v.title || '').match(/^\s*(?:m|module)\s*0*(\d+)\b/i);
  return m ? Number(m[1]) : null;
}

function readOverrides() {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'videos.json'), 'utf8')) || {}; } catch { return {}; }
}

// Returns { [moduleId]: { videoId, status, statusText, lengthSec, title, source } }
async function resolveVideos(curriculum) {
  const overrides = readOverrides();
  let videos = null;
  try { videos = await listVideos(); } catch (e) { console.error('[bunny]', e.message); }
  const byId = new Map((videos || []).map((v) => [v.guid, v]));
  const out = {};
  for (const m of curriculum) {
    let chosen = null, source = null;
    if (overrides[String(m.id)]) { chosen = byId.get(overrides[String(m.id)]) || { guid: overrides[String(m.id)], status: 4, length: 0, title: m.title }; source = 'override'; }
    if (!chosen && videos) {
      const candidates = videos.filter((v) => moduleOfVideo(v) === m.id).sort((a, b) => new Date(b.dateUploaded) - new Date(a.dateUploaded));
      chosen = candidates.find((v) => v.status === 4) || candidates[0] || null;
      if (chosen) source = 'bunny';
    }
    if (!chosen && m.bunnyVideoId) { chosen = byId.get(m.bunnyVideoId) || { guid: m.bunnyVideoId, status: 4, length: 0, title: m.title }; source = 'static'; }
    out[m.id] = chosen ? { videoId: chosen.guid, status: chosen.status, statusText: STATUS[chosen.status] || 'unknown', ready: chosen.status === 4, lengthSec: chosen.length || 0, title: chosen.title, source } : null;
  }
  return out;
}

function durationLabel(sec, fallback) {
  if (!sec || sec < 30) return fallback || '';
  const min = Math.round(sec / 60);
  return min >= 60 ? `${Math.floor(min / 60)} hr ${min % 60} min` : `${min} min`;
}

function embedUrl(videoId, ttlSeconds = 6 * 3600) {
  const params = new URLSearchParams({ autoplay: 'false', loop: 'false', muted: 'false', preload: 'true', responsive: 'true' });
  const key = process.env.BUNNY_TOKEN_AUTH_KEY;
  if (key) {
    const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
    params.set('token', crypto.createHash('sha256').update(`${key}${videoId}${expires}`).digest('hex'));
    params.set('expires', String(expires));
  }
  return `https://iframe.mediadelivery.net/embed/${LIBRARY_ID}/${videoId}?${params.toString()}`;
}

module.exports = { LIBRARY_ID, STATUS, listVideos, resolveVideos, moduleOfVideo, durationLabel, embedUrl, signed: () => !!process.env.BUNNY_TOKEN_AUTH_KEY };
