#!/usr/bin/env node
/**
 * Course video pipeline for Bunny Stream (library 786834).
 *
 *   node scripts/videos.js status                       what the portal will show per module + unmapped videos
 *   node scripts/videos.js upload <file> --module N     upload one video for module N (title = module title)
 *   node scripts/videos.js upload-folder <dir>          upload every video in a folder; module from the filename
 *                                                       ("1-intro.mp4", "M02 journal.mp4", "module3.mov" …)
 *   node scripts/videos.js wait                         wait until every module's video has finished encoding
 *   node scripts/videos.js protect on|off               toggle embed-token authentication on the library
 *   node scripts/videos.js delete <videoId>             delete a video from the library (asks for --yes)
 *
 * Needs BUNNY_STREAM_API_KEY (and BUNNY_API_KEY for `protect`) in .env.local or the environment.
 * The portal picks videos up by itself within 5 minutes — no deploy needed after an upload.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const envFile = path.join(ROOT, '.env.local');
if (fs.existsSync(envFile)) for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2]; }

const bunny = require('../src/lib/bunny');
const { CURRICULUM } = require('../src/lib/course');
const LIB = bunny.LIBRARY_ID;
const STREAM = 'https://video.bunnycdn.com';
const key = () => { const k = process.env.BUNNY_STREAM_API_KEY; if (!k) die('BUNNY_STREAM_API_KEY is not set (vercel env pull .env.local)'); return k; };
const die = (m) => { console.error('✖ ' + m); process.exit(1); };
const args = process.argv.slice(2);
const cmd = args[0];
const flag = (name) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : undefined; };
const has = (name) => args.includes('--' + name);

async function api(method, url, body, headers = {}) {
  const r = await fetch(url, { method, headers: { AccessKey: key(), Accept: 'application/json', ...(body && !(body instanceof fs.ReadStream) ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: body && !(body instanceof fs.ReadStream) ? JSON.stringify(body) : body, duplex: body instanceof fs.ReadStream ? 'half' : undefined });
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  if (!r.ok) throw new Error(`${method} ${url} → ${r.status} ${typeof data === 'string' ? data.slice(0, 200) : JSON.stringify(data).slice(0, 200)}`);
  return data;
}

function moduleFromFilename(file) {
  const base = path.basename(file).toLowerCase();
  const m = base.match(/^(?:m|module)?\s*0*(\d)\b/) || base.match(/(?:^|[^0-9])m0*(\d)(?:[^0-9]|$)/) || base.match(/module\s*0*(\d)/);
  return m ? Number(m[1]) : null;
}

async function status() {
  const videos = await bunny.listVideos({ force: true });
  const resolved = await bunny.resolveVideos(CURRICULUM);
  console.log(`Library ${LIB}: ${videos.length} videos, token auth ${bunny.signed() ? 'ON (key set)' : 'off / key not set'}\n`);
  for (const m of CURRICULUM) {
    const v = resolved[m.id];
    console.log(`${m.code} ${m.title}`);
    console.log(v ? `     → ${v.videoId}  ${v.statusText.padEnd(11)} ${bunny.durationLabel(v.lengthSec, '?')}  "${v.title}"  [${v.source}]` : '     → (no video)');
  }
  const used = new Set(Object.values(resolved).filter(Boolean).map((v) => v.videoId));
  const rest = videos.filter((v) => !used.has(v.guid));
  if (rest.length) { console.log('\nOther videos in the library (not shown in the portal):'); for (const v of rest) console.log(`   ${v.guid}  ${bunny.STATUS[v.status] || v.status}  ${bunny.durationLabel(v.length, '?')}  "${v.title}"  module=${bunny.moduleOfVideo(v) ?? '-'}`); }
}

async function upload(file, moduleId, title) {
  if (!fs.existsSync(file)) die(`file not found: ${file}`);
  const mod = CURRICULUM.find((m) => m.id === Number(moduleId));
  if (!mod) die(`unknown module ${moduleId} (1-${CURRICULUM.length})`);
  const size = fs.statSync(file).size;
  title = title || `${mod.code}: ${mod.title}`;
  console.log(`▶ ${path.basename(file)} (${(size / 1e6).toFixed(1)} MB) → ${title}`);
  const created = await api('POST', `${STREAM}/library/${LIB}/videos`, { title });
  const id = created.guid;
  console.log(`   created ${id}, uploading…`);
  await api('PUT', `${STREAM}/library/${LIB}/videos/${id}`, fs.createReadStream(file), { 'Content-Type': 'application/octet-stream', 'Content-Length': String(size) });
  await api('POST', `${STREAM}/library/${LIB}/videos/${id}`, { title, metaTags: [{ property: 'module', value: String(mod.id) }] });
  console.log(`   ✔ uploaded; Bunny is encoding it now (tagged module=${mod.id})`);
  return id;
}

async function wait() {
  process.stdout.write('Waiting for encoding');
  for (let i = 0; i < 360; i++) {
    const resolved = await bunny.resolveVideos(CURRICULUM);
    bunnyCacheReset();
    const pending = Object.values(resolved).filter((v) => v && !v.ready && !['error', 'upload_failed'].includes(v.statusText));
    const failed = Object.values(resolved).filter((v) => v && ['error', 'upload_failed'].includes(v.statusText));
    if (failed.length) { console.log('\n✖ failed:', failed.map((v) => v.videoId).join(', ')); process.exit(1); }
    if (!pending.length) { console.log('\n✔ all module videos are ready'); return; }
    process.stdout.write('.');
    await new Promise((r) => setTimeout(r, 10000));
  }
  die('timed out after 60 minutes');
}
function bunnyCacheReset() { try { delete require.cache[require.resolve('../src/lib/bunny')]; } catch {} }

async function protect(on) {
  const k = process.env.BUNNY_API_KEY; if (!k) die('BUNNY_API_KEY (account key) is not set');
  const r = await fetch(`https://api.bunny.net/videolibrary/${LIB}`, { method: 'POST', headers: { AccessKey: k, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ PlayerTokenAuthenticationEnabled: on }) });
  if (!r.ok) die(`Bunny account API → ${r.status}`);
  console.log(`✔ embed token authentication ${on ? 'ON' : 'OFF'} for library ${LIB}`);
  if (on) console.log('   make sure BUNNY_TOKEN_AUTH_KEY (= the ZoneSecurityKey of the library\'s pull zone, GET https://api.bunny.net/pullzone/<PullZoneId>) is set on Vercel and redeployed, otherwise the portal player is blocked.');
}

(async () => {
  switch (cmd) {
    case 'status': await status(); break;
    case 'upload': { const f = args[1]; const m = flag('module') || moduleFromFilename(f || ''); if (!f || !m) die('usage: upload <file> --module N'); await upload(f, m, flag('title')); if (!has('no-wait')) await wait(); await status(); break; }
    case 'upload-folder': {
      const dir = args[1]; if (!dir || !fs.existsSync(dir)) die('usage: upload-folder <dir>');
      const files = fs.readdirSync(dir).filter((f) => /\.(mp4|mov|m4v|mkv|webm|avi)$/i.test(f)).sort();
      if (!files.length) die('no video files in ' + dir);
      const plan = files.map((f) => ({ file: path.join(dir, f), module: moduleFromFilename(f) }));
      const bad = plan.filter((p) => !p.module); if (bad.length) die('cannot tell the module from these filenames (start them with 1-5 or M01..M05): ' + bad.map((p) => path.basename(p.file)).join(', '));
      for (const p of plan) await upload(p.file, p.module);
      if (!has('no-wait')) await wait();
      await status(); break;
    }
    case 'wait': await wait(); break;
    case 'protect': await protect(args[1] !== 'off'); break;
    case 'delete': { const id = args[1]; if (!id) die('usage: delete <videoId> --yes'); if (!has('yes')) die('add --yes to confirm'); await api('DELETE', `${STREAM}/library/${LIB}/videos/${id}`); console.log('✔ deleted', id); break; }
    default: console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^\/\*\*?/, '')); process.exit(cmd ? 1 : 0);
  }
})().catch((e) => die(e.message));
