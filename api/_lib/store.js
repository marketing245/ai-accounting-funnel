'use strict';
// JSON document store on a PRIVATE Vercel Blob store (consistent reads: useCache:false).
// Falls back to a local ./.data folder when no Blob token is present (local dev without Vercel).
const fs = require('fs');
const path = require('path');

const PREFIX = process.env.BLOB_PREFIX || (process.env.VERCEL_ENV === 'production' ? 'prod' : 'dev');
const hasBlob = !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL === '1');
const LOCAL_DIR = path.join(process.cwd(), '.data', PREFIX);

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

async function writeJson(pathname, obj) {
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

module.exports = { readJson, writeJson, PREFIX, hasBlob };
