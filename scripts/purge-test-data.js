#!/usr/bin/env node
/**
 * Go-live cleanup: delete TEST orders, users whose only purchases are test purchases, their certificates, and demo inquiries.
 *   node scripts/purge-test-data.js            → dry run (lists what would be deleted)
 *   node scripts/purge-test-data.js --yes      → delete
 * Uses the same Blob store/prefix as the server (BLOB_PREFIX / VERCEL_ENV). Deletes are free Blob operations.
 */
'use strict';
const fs = require('fs'); const path = require('path');
const envFile = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envFile)) for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2]; }
const store = require('../src/lib/store');
const auth = require('../src/lib/auth');
const YES = process.argv.includes('--yes');
(async () => {
  const [orders, users, certs] = await Promise.all([store.listJson('orders/'), store.listJson('users/'), store.listJson('certificates/')]);
  const testOrders = orders.filter((o) => o.gateway === 'test');
  const testUsers = users.filter((u) => (u.purchases || []).length && u.purchases.every((p) => p.gateway === 'test'));
  const hashes = new Set(testUsers.map((u) => auth.userKey(u.email)));
  const testCerts = certs.filter((c) => hashes.has(c.emailHash));
  console.log(`prefix ${store.PREFIX}: ${testOrders.length} test orders, ${testUsers.length} test-only users, ${testCerts.length} certificates` + (YES ? ' — deleting' : ' — dry run (add --yes)'));
  for (const u of testUsers) console.log('  user ', u.email);
  if (!YES) return;
  const { del } = require('@vercel/blob');
  const paths = [...testOrders.map((o) => `${store.PREFIX}/orders/${o.id}.json`), ...testUsers.map((u) => `${store.PREFIX}/users/${auth.userKey(u.email)}.json`), ...testCerts.map((c) => `${store.PREFIX}/certificates/${c.id}.json`)];
  if (!store.hasBlob) { for (const p of paths) { const f = path.join(process.cwd(), '.data', p); if (fs.existsSync(f)) fs.unlinkSync(f); } console.log('deleted locally', paths.length); return; }
  const { list } = require('@vercel/blob');
  const urls = [];
  let cursor; do { const page = await list({ prefix: `${store.PREFIX}/`, limit: 1000, cursor }); for (const b of page.blobs) if (paths.includes(b.pathname)) urls.push(b.url); cursor = page.hasMore ? page.cursor : undefined; } while (cursor);
  if (urls.length) await del(urls);
  console.log('deleted', urls.length, 'blobs');
})().catch((e) => { console.error(e); process.exit(1); });
