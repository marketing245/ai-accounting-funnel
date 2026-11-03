#!/usr/bin/env node
'use strict';
/**
 * Upload / check the paid add-on files in the private Blob store (shared/addons/<id>/<file name>).
 *
 *   node scripts/addon-files.js status
 *   node scripts/addon-files.js upload <folder>     folder must contain every file listed in src/lib/config.js ADDONS[].files
 *
 * Needs BLOB_READ_WRITE_TOKEN in .env.local or the environment. Files are shared by prod and dev.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const envFile = path.join(ROOT, '.env.local');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
  }
}

const { ADDONS } = require('../src/lib/config');
const store = require('../src/lib/store');

async function status() {
  for (const a of ADDONS) {
    console.log(`${a.id}  (${a.shortName}, ₹${a.price})`);
    for (const f of a.files) {
      const r = await store.readSharedFile(`addons/${a.id}/${f.name}`);
      if (r && r.stream && r.stream.cancel) await r.stream.cancel().catch(() => {});
      if (r && r.stream && r.stream.destroy) r.stream.destroy();
      console.log(`  ${r ? 'OK     ' : 'MISSING'}  ${f.name}${r && r.size ? `  (${(r.size / 1024).toFixed(0)} KB)` : ''}`);
    }
  }
}

async function upload(dir) {
  if (!dir || !fs.existsSync(dir)) throw new Error('Folder not found: ' + dir);
  for (const a of ADDONS) {
    for (const f of a.files) {
      const p = path.join(dir, f.name);
      if (!fs.existsSync(p)) { console.log(`  skip (not in folder)  ${f.name}`); continue; }
      const buf = fs.readFileSync(p);
      await store.writeSharedFile(`addons/${a.id}/${f.name}`, buf, f.type);
      console.log(`  uploaded  ${a.id}/${f.name}  (${(buf.length / 1024).toFixed(0)} KB)`);
    }
  }
}

const [cmd, arg] = process.argv.slice(2);
(cmd === 'upload' ? upload(arg) : status()).catch((e) => { console.error(e.message || e); process.exit(1); });
