'use strict';
// Certificate of completion: issued once per student when every module is marked complete.
// Record lives at certificates/<id>.json (public verification) and on the user (user.certificate).
const crypto = require('crypto');
const store = require('./store');
const auth = require('./auth');
const { CURRICULUM } = require('./course');
const { PRODUCT } = require('./config');

const COURSE_TITLE = 'AI in Accounting';
const INSTRUCTOR = 'CA Varsha Varyani';
const INSTRUCTOR_LINE = 'Instructor  ·  Chartered Accountant, CFA, Dip. IFRS';
const MODULE_SUMMARY = 'Five recorded modules: Claude foundations, journal entries, bank reconciliation & fixed-asset depreciation, GST reconciliation and month-end close.';

function isComplete(user) {
  const done = new Set((user.progress && user.progress.completed) || []);
  return CURRICULUM.every((m) => done.has(m.id));
}
function remaining(user) {
  const done = new Set((user.progress && user.progress.completed) || []);
  return CURRICULUM.filter((m) => !done.has(m.id)).length;
}

function newId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
  const bytes = crypto.randomBytes(6);
  let s = '';
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return `AAE-${new Date().getFullYear()}-${s}`;
}

function verifyUrl(id) { return `${PRODUCT.siteUrl.replace(/\/$/, '')}/verify?id=${encodeURIComponent(id)}`; }

// Idempotent: returns the existing certificate or issues a new one.
async function ensureCertificate(user) {
  if (user.certificate && user.certificate.id) return user.certificate;
  if (!isComplete(user)) return null;
  const issuedAt = new Date().toISOString();
  let id, clash = true;
  for (let i = 0; i < 5 && clash; i++) { id = newId(); clash = !!(await store.readJson(`certificates/${id}.json`)); }
  const record = { id, name: user.name, emailHash: auth.userKey(user.email), course: COURSE_TITLE, instructor: INSTRUCTOR, issuedAt, modules: CURRICULUM.map((m) => m.title) };
  await store.writeJson(`certificates/${id}.json`, record);
  user.certificate = { id, issuedAt };
  await auth.saveUser(user);
  return user.certificate;
}

async function getPublicRecord(id) {
  if (!/^AAE-\d{4}-[A-Z2-9]{6}$/.test(id)) return null;
  const r = await store.readJson(`certificates/${id}.json`);
  if (!r) return null;
  return { id: r.id, name: r.name, course: r.course, instructor: r.instructor, issuedAt: r.issuedAt, modules: r.modules };
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

// Latin-only text for the standard PDF fonts; anything else becomes '?'.
const latin = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7E]/g, '?').trim();

function buildPdf(cert) {
  const PDFDocument = require('pdfkit');
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0, info: { Title: `Certificate of Completion — ${cert.name}`, Author: PRODUCT.brand, Subject: COURSE_TITLE } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width, H = doc.page.height;
    const NAVY = '#0f1b2d', GOLD = '#c4953a', CREAM = '#faf8f3', MUTED = '#5b6473';
    const name = latin(cert.name) || 'Student';

    doc.rect(0, 0, W, H).fill(CREAM);
    doc.lineWidth(3).strokeColor(GOLD).rect(24, 24, W - 48, H - 48).stroke();
    doc.lineWidth(0.8).strokeColor(NAVY).rect(34, 34, W - 68, H - 68).stroke();
    // corner accents
    for (const [x, y, dx, dy] of [[34, 34, 1, 1], [W - 34, 34, -1, 1], [34, H - 34, 1, -1], [W - 34, H - 34, -1, -1]]) {
      doc.lineWidth(2).strokeColor(GOLD).moveTo(x, y + dy * 22).lineTo(x, y).lineTo(x + dx * 22, y).stroke();
    }

    // wordmark
    doc.font('Times-Bold').fontSize(20);
    const ai = 'AI', rest = 'AccountingEngineer';
    const wAi = doc.widthOfString(ai), wRest = doc.widthOfString(rest);
    const x0 = (W - wAi - wRest) / 2;
    doc.fillColor(GOLD).text(ai, x0, 62, { lineBreak: false });
    doc.fillColor(NAVY).text(rest, x0 + wAi, 62, { lineBreak: false });

    doc.font('Helvetica-Bold').fontSize(10).fillColor(GOLD).text('VERIFIED COURSE CERTIFICATE', 0, 108, { align: 'center', characterSpacing: 4, width: W });
    doc.font('Times-Bold').fontSize(34).fillColor(NAVY).text('Certificate of Completion', 0, 126, { align: 'center', width: W });

    doc.font('Helvetica').fontSize(13).fillColor(MUTED).text('This certifies that', 0, 196, { align: 'center', width: W });

    let size = 38;
    doc.font('Times-Bold').fontSize(size);
    while (doc.widthOfString(name) > W - 160 && size > 20) { size -= 2; doc.fontSize(size); }
    doc.fillColor(NAVY).text(name, 0, 220, { align: 'center', width: W });
    const nameW = Math.min(Math.max(doc.widthOfString(name) + 40, 220), W - 160);
    doc.lineWidth(1.2).strokeColor(GOLD).moveTo((W - nameW) / 2, 274).lineTo((W + nameW) / 2, 274).stroke();

    doc.font('Helvetica').fontSize(13).fillColor(MUTED).text('has successfully completed the course', 0, 292, { align: 'center', width: W });
    doc.font('Times-Bold').fontSize(24).fillColor(NAVY).text(COURSE_TITLE, 0, 314, { align: 'center', width: W });
    doc.font('Helvetica').fontSize(10.5).fillColor(MUTED).text(MODULE_SUMMARY, (W - 560) / 2, 352, { align: 'center', width: 560, lineGap: 2 });

    // bottom left: details
    const by = 455;
    doc.font('Helvetica-Bold').fontSize(8).fillColor(GOLD).text('DATE OF COMPLETION', 80, by, { characterSpacing: 1.5 });
    doc.font('Helvetica').fontSize(11).fillColor(NAVY).text(fmtDate(cert.issuedAt), 80, by + 12);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(GOLD).text('CERTIFICATE ID', 80, by + 36, { characterSpacing: 1.5 });
    doc.font('Helvetica').fontSize(11).fillColor(NAVY).text(cert.id, 80, by + 48);
    doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(`Verify at ${verifyUrl(cert.id)}`, 80, by + 68);

    // bottom right: signature
    const sx = W - 80 - 230;
    doc.lineWidth(1).strokeColor(NAVY).moveTo(sx, by + 30).lineTo(sx + 230, by + 30).stroke();
    doc.font('Times-Bold').fontSize(13).fillColor(NAVY).text(INSTRUCTOR, sx, by + 36, { width: 230, align: 'center' });
    doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(INSTRUCTOR_LINE, sx, by + 53, { width: 230, align: 'center' });
    doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text('aiaccountingengineer.com', sx, by + 66, { width: 230, align: 'center' });

    doc.end();
  });
}

module.exports = { isComplete, remaining, ensureCertificate, getPublicRecord, buildPdf, verifyUrl, COURSE_TITLE };
