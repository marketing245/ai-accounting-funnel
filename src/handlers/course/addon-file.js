'use strict';
// GET /api/course/addon-file?addon=<id>&file=<index>
// Streams a paid add-on file from the private Blob store. Only logged-in buyers of that add-on get it.
const { fail, allow, wrap, getQuery } = require('../../lib/http');
const auth = require('../../lib/auth');
const store = require('../../lib/store');
const { ADDONS } = require('../../lib/config');

module.exports = wrap(async (req, res) => {
  if (!allow(req, res, ['GET'])) return;
  const user = await auth.loadSessionUser(req, res, { requireAccess: false }); if (!user) return;
  const q = getQuery(req);
  const addon = ADDONS.find((a) => a.id === String(q.addon || ''));
  const idx = Number(q.file);
  if (!addon || !Number.isInteger(idx) || !addon.files[idx]) return fail(res, 404, 'File not found.');
  if (!auth.ownedAddons(user).includes(addon.id)) return fail(res, 403, 'This file is part of an add-on you have not purchased.', { code: 'NOT_PURCHASED' });

  const meta = addon.files[idx];
  const file = await store.readSharedFile(`addons/${addon.id}/${meta.name}`);
  if (!file) return fail(res, 404, 'This file is being prepared. Please try again shortly or contact support.');

  const ascii = meta.name.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');
  res.statusCode = 200;
  res.setHeader('Content-Type', meta.type || file.contentType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(meta.name)}`);
  res.setHeader('Cache-Control', 'private, no-store');
  if (file.size) res.setHeader('Content-Length', String(file.size));
  const { Readable } = require('stream');
  const node = typeof file.stream.pipe === 'function' ? file.stream : Readable.fromWeb(file.stream);
  await new Promise((resolve, reject) => { node.on('error', reject); res.on('finish', resolve); res.on('close', resolve); node.pipe(res); });
});
