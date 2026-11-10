'use strict';
// POST /api/admin/video-upload { module } — start a direct upload of a new video for a course module (admin only).
// Returns the TUS endpoint + signature; the browser uploads the file straight to Bunny. The portal switches to the newest
// ready video of that module by itself (module meta tag), so the old video stays live until the new one has finished processing.
const { readJson, send, fail, allow, wrap } = require('../../lib/http');
const admin = require('../../lib/admin');
const auth = require('../../lib/auth');
const bunny = require('../../lib/bunny');
const { CURRICULUM } = require('../../lib/course');

module.exports = wrap(async (req, res) => {
  if (!allow(req, res, ['POST'])) return;
  if (!auth.sameOrigin(req, res)) return;
  if (!admin.requireAdmin(req, res)) return;
  const body = await readJson(req);
  const m = CURRICULUM.find((x) => x.id === Number(body.module));
  if (!m) return fail(res, 400, 'Unknown module.');
  try {
    const up = await bunny.createUpload(m.id, `${m.code}: ${m.title}`);
    send(res, 200, { ok: true, module: m.id, title: `${m.code}: ${m.title}`, ...up });
  } catch (e) { fail(res, e.status || 500, e.message); }
});
