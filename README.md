# AI Accounting Engineer — course funnel

Landing page, Razorpay checkout and a login-protected student portal for the **AI in Accounting** course by CA Varsha Varyani.
Runs on Vercel: static pages in `public/`, serverless functions in `api/`, data in a **private** Vercel Blob store.

```
public/            landing (index), login, thank-you, portal, privacy, terms, refund, contact
api/index.js       the ONE serverless function (Hobby plan limit); vercel.json rewrites /api/* to it, it routes to src/handlers
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

## Course videos (Bunny Stream library 786834)
The portal reads the library at runtime (cached 5 min) and matches videos to modules by the `module` meta tag
(set by the script) or by a title starting with `M01`…`M05`. The newest finished video per module wins, so
re-uploading a lesson replaces it automatically — **no deploy needed**. Overrides: `src/lib/videos.json` (`{"1": "<videoId>"}`).

```
node scripts/videos.js status                          # what each module will play
node scripts/videos.js upload-folder ~/Downloads/varsha # files named 1-….mp4 … 5-….mp4 (or M01…M05); uploads, waits for encoding
node scripts/videos.js upload lesson2.mp4 --module 2    # single file
node scripts/videos.js protect on                      # embed-token authentication (needs BUNNY_TOKEN_AUTH_KEY on Vercel)
```
Varsha can also upload in the Bunny dashboard: title the video `M03: …` and the portal picks it up within 5 minutes.

**Moving to the instructor's own Bunny account** (the current one is a demo): she creates a Bunny account + one Stream library and shares the account API key; then
`node scripts/videos.js setup --account-key <key>` → `vercel --prod` → `node scripts/videos.js upload-folder <videos>`. Nothing else changes.

## Admin panel — `/admin`
Tabs: Overview (revenue, paid, checkouts, leads, conversion, AOV, time-to-buy, per-day chart, funnel), Paid orders, Leads (WhatsApp link per row),
Students (progress, certificate), Traffic sources (by source/medium/campaign/term/content, ad platform, landing page, device/OS, country/city, referrer),
Conversion signals (Google Ads offline-conversion CSV with gclid/gbraid/wbraid, Meta offline CSV, CAPI status), Settings & health. Click any order for the full record
(all touches, click ids, device, geo, signal results, raw JSON). Date range 7/30/90/365/all.

**Conversion signals**: browser → GA4 (`purchase` with transaction_id), Google Ads tag with enhanced conversions, Meta pixel with `eventID` = order id.
Server → Meta Conversions API `InitiateCheckout` (on checkout) and `Purchase` (on payment) when `META_PIXEL_ID` + `META_CAPI_TOKEN` are set (optional `META_TEST_EVENT_CODE`).
Google Ads server-side upload is manual: download the offline CSV and upload it under Conversions → Uploads (needs auto-tagging on; name via `GOOGLE_OFFLINE_CONVERSION_NAME`, default "Course Purchase").

**Storage quota (Hobby):** Vercel Blob includes only 2,000 advanced operations (writes/lists) and 10,000 simple operations per month; over the limit Blob is blocked for 30 days.
Each paid student costs ~10 writes, each lead 1, each admin load 3 list ops (cached 60 s). Fine for a demo; **before real ad traffic move orders/users to a database (Supabase/Neon) or upgrade Vercel** — see `src/lib/store.js`.

Password from `ADMIN_PASSWORD`. Shows revenue/orders (7 / 30 days / all), **leads** (people who typed name, email, phone but did not pay — each row has a WhatsApp link),
students with progress and certificates, and **where every order came from**: UTM source/medium/campaign, gclid/fbclid or referrer, captured on the visitor's first and last visit
(`localStorage` in `public/analytics.js`, stored on the order at checkout). CSV export for orders, leads and students. Only Google Ads links need UTMs or auto-tagging; GA4 keeps its own data.

## Environment variables (Vercel → Settings → Environment Variables)
| Name | Required | Notes |
|---|---|---|
| `BLOB_READ_WRITE_TOKEN` | yes | added automatically when the private Blob store `aiae-data` was linked |
| `AUTH_SECRET` | yes | ≥ 32 random bytes; signs session cookies and test-payment tokens |
| `PAYMENT_MODE` | yes | `test` (demo) or `razorpay` (live) |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | live | from Razorpay dashboard → Account & Settings → API keys |
| `RAZORPAY_WEBHOOK_SECRET` | live | set when creating the webhook `https://<domain>/api/checkout/webhook` |
| `ADMIN_PASSWORD` | yes | password for `/admin` |
| `META_PIXEL_ID`, `META_CAPI_TOKEN` | ads | Meta Conversions API (Events Manager → Settings → Generate access token); `META_TEST_EVENT_CODE` optional |
| `GOOGLE_OFFLINE_CONVERSION_NAME` | optional | conversion action name in the Google Ads offline CSV |
| `SITE_URL` | recommended | canonical URL, e.g. `https://course.aiaccountingengineer.com` |
| `BUNNY_LIBRARY_ID` | optional | defaults to `786834` |
| `BUNNY_STREAM_API_KEY` | yes | the library's API key (Stream → library → API) — lets the portal list videos |
| `BUNNY_API_KEY` | scripts | account API key, only for `scripts/videos.js protect` |
| `BUNNY_TOKEN_AUTH_KEY` | yes (ON now) | signing key for embed-token authentication = `ZoneSecurityKey` of the library's pull zone (account API `GET /pullzone/<PullZoneId>`); video URLs expire after 6 h and cannot be embedded elsewhere |
| `WHATSAPP_GROUP_URL` | optional | shows the group button in the portal |
| `SUPPORT_EMAIL` | optional | defaults to hello@aiaccountingengineer.com |

Public tags (GA4, Google Ads conversion label, Meta pixel) live in `public/site-config.js`.

## Go-live checklist
- [ ] Custom domain on Vercel (e.g. `course.aiaccountingengineer.com`) and `SITE_URL` updated
- [ ] Razorpay keys + webhook secret set, `PAYMENT_MODE=razorpay`, one real ₹1 test refunded
- [ ] Legal entity name, address, GSTIN and grievance officer filled in `privacy.html`, `terms.html`, `contact.html`; refund window confirmed in `refund.html` and the "draft" note removed
- [ ] Real lesson videos uploaded with `scripts/videos.js` (test clips deleted) — token authentication is already ON
- [ ] Google Ads conversion label in `site-config.js`; GA4 `purchase` visible in Realtime after a test order
- [ ] Password-reset email provider (Resend / Gmail) — until then resets are handled by support email

## Branches & deployment (important)
- **`vercel` branch → Vercel production** (this is what https://ai-accounting-funnel.vercel.app serves). Work in the worktree `~/ai-accounting-funnel-vercel`: commit → `git push origin vercel` → `vercel --prod`.
- **`main` branch → Railway** (maintained by Antigravity). The two branches are deployed independently; merge `main` into `vercel` deliberately, never edit both checkouts at once.

## Local development
```
npm install
vercel env pull .env.local     # or set BLOB_READ_WRITE_TOKEN / AUTH_SECRET yourself
node server.js                 # http://localhost:3000, PAYMENT_MODE=test, Blob prefix "dev"
node scripts/smoke.js          # full checkout → portal → login test
```
Deploy: `vercel --prod`.
