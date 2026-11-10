'use strict';
// JSON document store on a PRIVATE Vercel Blob store (consistent reads: useCache:false).
// Falls back to a local folder when no Blob token is present, or always with STORAGE=local (the AWS server keeps its data on
// its own disk: DATA_DIR, e.g. /var/lib/aiae). Default folder ./.data (local dev).
const fs = require('fs');
const path = require('path');

const PREFIX = process.env.BLOB_PREFIX || (process.env.VERCEL_ENV === 'production' ? 'prod' : 'dev');
const hasBlob = process.env.STORAGE !== 'local' && !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL === '1');
const DATA_ROOT = process.env.DATA_DIR || path.join(process.cwd(), '.data');
const LOCAL_DIR = path.join(DATA_ROOT, PREFIX);

function key(pathname) { return `${PREFIX}/${pathname}`; }

async function readJson(pathname) {
  if (!hasBlob) {
    const f = path.join(LOCAL_DIR, pathname);
    if (!fs.existsSync(f)) return null;
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  }
  const { get } = require('@vercel/blob');
  let r;
  try { r = await get(key(pathname), { access: 'private', useCache: false }); }
  catch (e) { if (/not.?found/i.test(String(e && e.message)) || e?.name === 'BlobNotFoundError') return null; throw e; }
  if (!r || r.statusCode !== 200) return null;
  const text = await new Response(r.stream).text();
  return text ? JSON.parse(text) : null;
}

let onWrite = null;
async function writeJson(pathname, obj) {
  if (onWrite) { try { onWrite(pathname); } catch {} }
  const body = JSON.stringify(obj, null, 0);
  if (!hasBlob) {
    const f = path.join(LOCAL_DIR, pathname);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, body);
    return;
  }
  const { put } = require('@vercel/blob');
  await put(key(pathname), body, {
    access: 'private', addRandomSuffix: false, allowOverwrite: true,
    contentType: 'application/json', cacheControlMaxAge: 60,
  });
}

// List every JSON document under a folder (e.g. 'orders/'). Reads are consistent (no CDN cache).
async function listJson(folder, { limit = 2000 } = {}) {
  const out = [];
  if (!hasBlob) {
    const dir = path.join(LOCAL_DIR, folder);
    if (!fs.existsSync(dir)) return out;
    for (const f of fs.readdirSync(dir)) if (f.endsWith('.json')) { try { out.push(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))); } catch {} }
    return out;
  }
  const { list } = require('@vercel/blob');
  const paths = [];
  let cursor;
  do {
    const page = await list({ prefix: key(folder), limit: 1000, cursor });
    for (const b of page.blobs) if (b.pathname.endsWith('.json')) paths.push(b.pathname.replace(/^.*?\//, ''));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor && paths.length < limit);
  for (let i = 0; i < paths.length; i += 12) {
    const batch = await Promise.all(paths.slice(i, i + 12).map((p) => readJson(p).catch(() => null)));
    for (const d of batch) if (d) out.push(d);
  }
  return out;
}


// Raw files shared by every environment (not prefixed with prod/ or dev/), e.g. paid add-on downloads.
// Returns { stream, size, contentType } or null.
async function readSharedFile(pathname) {
  const k = `shared/${pathname}`;
  if (!hasBlob) {
    const f = path.join(DATA_ROOT, k);
    if (!fs.existsSync(f)) return null;
    return { stream: fs.createReadStream(f), size: fs.statSync(f).size, contentType: null };
  }
  const { get } = require('@vercel/blob');
  let r;
  try { r = await get(k, { access: 'private', useCache: false }); }
  catch (e) { if (/not.?found/i.test(String(e && e.message)) || e?.name === 'BlobNotFoundError') return null; throw e; }
  if (!r || r.statusCode !== 200) return null;
  return { stream: r.stream, size: r.blob && r.blob.size, contentType: r.blob && r.blob.contentType };
}

async function writeSharedFile(pathname, buffer, contentType) {
  const k = `shared/${pathname}`;
  if (!hasBlob) {
    const f = path.join(DATA_ROOT, k);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, buffer);
    return { pathname: k };
  }
  const { put } = require('@vercel/blob');
  return put(k, buffer, { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType });
}

// Read-only: every JSON document under another app's prefix in the same Blob store (e.g. the B2B funnel's 'b2b-prod/leads/').
async function listJsonAt(prefix, folder) {
  const out = [];
  if (!hasBlob) {
    const dir = path.join(DATA_ROOT, prefix, folder);
    if (!fs.existsSync(dir)) return out;
    for (const f of fs.readdirSync(dir)) if (f.endsWith('.json')) { try { out.push(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))); } catch {} }
    return out;
  }
  const { list, get } = require('@vercel/blob');
  const paths = [];
  let cursor;
  do {
    const page = await list({ prefix: `${prefix}/${folder}`, limit: 1000, cursor });
    for (const b of page.blobs) if (b.pathname.endsWith('.json')) paths.push(b.pathname);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor && paths.length < 2000);
  for (let i = 0; i < paths.length; i += 12) {
    const batch = await Promise.all(paths.slice(i, i + 12).map(async (p) => {
      try { const r = await get(p, { access: 'private', useCache: false }); if (!r || r.statusCode !== 200) return null; const t = await new Response(r.stream).text(); return t ? JSON.parse(t) : null; } catch { return null; }
    }));
    for (const d of batch) if (d) out.push(d);
  }
  return out;
}

module.exports = { readJson, writeJson, listJson, listJsonAt, readSharedFile, writeSharedFile, PREFIX, hasBlob, setOnWrite: (fn) => { onWrite = fn; } };
