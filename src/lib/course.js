'use strict';
// Course content served ONLY to logged-in students (see api/course/lessons.js).
// Videos are matched at runtime from the Bunny Stream library (see src/lib/bunny.js): upload with
// `node scripts/videos.js upload <file> --module N` or name the video "M0N: …" in the Bunny dashboard.
// bunnyVideoId below is only the last-resort fallback when Bunny cannot be reached.

const CURRICULUM = [
  { id: 1, code: 'M01', title: 'Claude 101 — Foundation', duration: '45 Min', category: 'Foundation',
    bunnyVideoId: '4e8cdcac-b9ab-42db-9b72-bdc1d0a58b52',
    description: 'How to talk to Claude for accounting work: framing the task, what to ask, how to check what comes back. The foundation every other module builds on.' },
  { id: 2, code: 'M02', title: 'Journal entries', duration: '52 Min', category: 'Ledger',
    bunnyVideoId: '9c632bf7-9220-430b-a00f-77f6684d81bb',
    description: 'Invoice, bank statement or vendor bill in — correctly classified journal entry with narration out. You review, approve, post.' },
  { id: 3, code: 'M03', title: 'Bank reconciliation & fixed asset depreciation', duration: '58 Min', category: 'Ledger',
    bunnyVideoId: 'f66542f3-9a50-4f8e-a521-a6b7d7681667',
    description: 'Let Claude do the matching so your time goes to the items that do not reconcile. Depreciation schedules generated in one pass.' },
  { id: 4, code: 'M04', title: 'GST reconciliation', duration: '60 Min', category: 'Compliance',
    bunnyVideoId: '7785eb45-321b-4200-8ad7-fc8c82bcd4bd',
    description: 'GSTR-2A/2B vs purchase register: Claude flags the mismatches and gives you a clean exception list.' },
  { id: 5, code: 'M05', title: 'Month-end close (Capstone)', duration: '65 Min', category: 'Capstone',
    bunnyVideoId: 'e26a756b-7495-4fe5-9a98-b041362956f1',
    description: 'GL scrutiny, tie-outs, flux notes — everything from the earlier modules brought together into a close that finishes on Day 5.' },
];

function publicCurriculum() {
  return CURRICULUM.map(({ bunnyVideoId, ...m }) => m);
}

module.exports = { CURRICULUM, publicCurriculum };
