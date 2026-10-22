# AI Accounting Engineer — course funnel

Landing page, Razorpay checkout and a login-protected student portal for the **AI in Accounting** course by CA Varsha Varyani.
Runs on Vercel: static pages in `public/`, serverless functions in `api/`, data in a **private** Vercel Blob store.

```
public/            landing (index), login, thank-you, portal, privacy, terms, refund, contact
api/[...path].js   the ONE serverless function (Hobby plan limit) — routes /api/* to src/handlers
src/handlers/      checkout (config · create-order · verify · webhook · order) · auth (login · logout · me · set-password)
                   course (lessons · progress) · certificate (status/issue · pdf · verify) · health
src/lib/           config (prices) · course (5 modules + Bunny video ids — edit here to change videos) · store (Blob JSON) · auth · razorpay · bunny · fulfil · certificate
server.js          local dev server (node server.js) — mirrors Vercel routing
scripts/smoke.js   end-to-end test: node scripts/smoke.js [baseUrl]
```

## How a purchase works
1. Visitor fills name / email / phone in the checkout modal (single product, no add-ons) → `POST /api/checkout/create-order` (server computes ₹ + 18% GST, creates the Razorpay order, stores `orders/<id>.json`).
2. Razorpay Checkout opens in the browser. On success → `POST /api/checkout/verify` (server checks the HMAC signature **and** re-fetches the payment from Razorpay: amount + order must match).
3. Server marks the order paid, creates/updates `users/<sha256(email)>.json`, sets an HttpOnly session cookie, redirects to `/thank-you` where the student sets a password. GA4 `purchase` fires there, once per order.
4. `/portal` loads `GET /api/course/lessons` — only a valid session with a paid purchase gets the curriculum, prompts and video embed URLs. Video ids never appear in public HTML.
5. Marking all modules complete unlocks a certificate: unique id `AAE-YYYY-XXXXXX`, PDF download, LinkedIn add-to-profile link, public check at `/verify?id=`.
6. `POST /api/checkout/webhook` (Razorpay `payment.captured` / `order.paid`) grants access even if the browser was closed mid-way.

**Test mode** (`PAYMENT_MODE=test`): the Razorpay window is replaced by a clearly labelled "simulated payment" step; everything else is identical. No money moves.

## Environment variables (Vercel → Settings → Environment Variables)
| Name | Required | Notes |
|---|---|---|
| `BLOB_READ_WRITE_TOKEN` | yes | added automatically when the private Blob store `aiae-data` was linked |
| `AUTH_SECRET` | yes | ≥ 32 random bytes; signs session cookies and test-payment tokens |
| `PAYMENT_MODE` | yes | `test` (demo) or `razorpay` (live) |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | live | from Razorpay dashboard → Account & Settings → API keys |
| `RAZORPAY_WEBHOOK_SECRET` | live | set when creating the webhook `https://<domain>/api/checkout/webhook` |
| `SITE_URL` | recommended | canonical URL, e.g. `https://course.aiaccountingengineer.com` |
| `BUNNY_LIBRARY_ID` | optional | defaults to `786834` |
| `BUNNY_TOKEN_AUTH_KEY` | recommended | Bunny Stream → library → Security → "Embed view token authentication"; makes video URLs expire |
| `WHATSAPP_GROUP_URL` | optional | shows the group button in the portal |
| `SUPPORT_EMAIL` | optional | defaults to hello@aiaccountingengineer.com |

Public tags (GA4, Google Ads conversion label, Meta pixel) live in `public/site-config.js`.

## Go-live checklist
- [ ] Custom domain on Vercel (e.g. `course.aiaccountingengineer.com`) and `SITE_URL` updated
- [ ] Razorpay keys + webhook secret set, `PAYMENT_MODE=razorpay`, one real ₹1 test refunded
- [ ] Legal entity name, address, GSTIN and grievance officer filled in `privacy.html`, `terms.html`, `contact.html`; refund window confirmed in `refund.html` and the "draft" note removed
- [ ] Real lesson videos in Bunny (ids in `api/_lib/course.js`), token authentication on
- [ ] Downloadable templates uploaded and `RESOURCES[].url` filled in `api/_lib/course.js`
- [ ] Google Ads conversion label in `site-config.js`; GA4 `purchase` visible in Realtime after a test order
- [ ] Password-reset email provider (Resend / Gmail) — until then resets are handled by support email

## Local development
```
npm install
vercel env pull .env.local     # or set BLOB_READ_WRITE_TOKEN / AUTH_SECRET yourself
node server.js                 # http://localhost:3000, PAYMENT_MODE=test, Blob prefix "dev"
node scripts/smoke.js          # full checkout → portal → login test
```
Deploy: `vercel --prod`.
