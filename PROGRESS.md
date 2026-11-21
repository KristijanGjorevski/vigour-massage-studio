# Vigour Massage Studio — Progress Log

Shopify app + theme app extension for **Vigour Massage Studio** (Darko, Skopje).
Also referred to as the **"Najdo studio"** project (claude.ai). All customer-facing copy is Macedonian.

> **Starting a new session?** Read this file first, then `git log`. The "Next steps" section is the to-do list.

---

## Project overview

| Part | Where | What it does |
|---|---|---|
| Admin dashboard | `app/routes/app._index.tsx` | Booking metrics, appointments table (complete/cancel/delete), services & price list (+ add service), Google Calendar connect, theme-block guide |
| Storefront API | `app/routes/proxy.*.ts` | Reached via Shopify App Proxy `/apps/vigour/*` → app `/proxy/*`. `bookings` (services, free slots, next slot, create booking), `exercises`, `pain-map` |
| Scheduling | `app/services/schedule.server.ts` | Europe/Skopje time handling, working slots, overlap-based availability, next free slot |
| Proxy auth | `app/services/proxy.server.ts` | `requireProxyShop()` — verifies Shopify signature, returns trusted shop |
| Google Calendar | `app/services/googleCalendar.server.ts`, `app/routes/api.google-callback.ts` | OAuth (signed state), FreeBusy reads, event creation |
| Theme blocks | `extensions/booking-widget/` | 14 "VM" app blocks: header, hero (live next slot), pain map, services grid, founder, how it works, programs, video reels, reviews, pricing, first-time offer, booking form, contact (Viber-first), footer. Locales `mk` + `en` |
| Data | `prisma/schema.prisma` (SQLite) | Session, Service, Appointment, GoogleAuth, Program, Exercise, PainZone |

**Stack:** Shopify React Router app template (React Router 7.18.2 — pinned on purpose, see CHANGELOG), Prisma 6 + SQLite, `googleapis`, Polaris web components.

**Business rules currently in code**
- Working slots (Skopje time): 10:00, 11:15, 12:30, 14:00, 15:15, 16:30, 17:45, 19:00
- Slots < 30 min from now aren't offered; "next free slot" searches 14 days ahead
- 6 default services seeded per shop (500–2500 ден., 45–75 min) when the Service table is empty

---

## Session log — 2026-11-03

Picked up the codebase built with another AI, analysed it, and worked through the first four fixes.

### 1. Version control — `1a9f460`
- Repo had no commits. Made the initial commit of the existing work.
- Repo-local git identity set: `kikog <kikogjorevski@gmail.com>`.

### 2. Missing database migration — `85e7bfa`
- **Problem:** `GoogleAuth`, `Program`, `Exercise`, `PainZone` and `Appointment.googleEventId` existed only in the local `dev.sqlite` (created via `db push`). A fresh/production `prisma migrate deploy` would have built an incomplete DB.
- **Fix:** added `prisma/migrations/20261103120000_add_google_auth_programs_pain_zones`. Verified a brand-new DB built from migrations matches the schema exactly. Local DB marked as applied (no data touched).

### 3. Timezone & overlap fixes — `f89db1a`
- **Problem:** slot "10:00" was stored as 10:00 **UTC** (= 11:00/12:00 in Skopje) → wrong times in Google Calendar. Conflicts only detected on exact start-time match, so overlapping/odd-time events didn't block slots. Unknown service IDs were silently booked as the cheapest service.
- **Fix:**
  - New `schedule.server.ts`: DST-aware Europe/Skopje ↔ UTC conversion; slot blocked if `[start, start+duration)` overlaps any appointment or Google busy block.
  - Google reads switched to the **FreeBusy API** (respects "free" events, any length); uses the shop's stored `calendarId`; events written with `timeZone: Europe/Skopje`.
  - Booking: validates date/time/slot, rejects unknown services (400), re-checks overlap inside a transaction (409 on clash), past slots rejected.
  - Dashboard shows Skopje times. Booking form passes `serviceId` and refreshes slots when the treatment changes; storefront "today" uses Skopje date.
- **Tested:** 10/10 (summer/winter/DST-day conversion, booking, double-book, fake service, off-grid time, past date, overlap edge).

### 4. Security — `a7d87d1`
- **Problems:** public API trusted `?shop=` from the client + wildcard CORS (anyone could create bookings / seed data for any shop); unauthenticated `/api/google-auth` with `state=shop` (anyone could attach their Google account to the shop); OAuth callback used relative `Response.redirect` (throws in Node); Google consent can't load inside the admin iframe; dashboard status/delete not scoped to shop.
- **Fix:**
  - **App Proxy:** `[app_proxy] url="/proxy" prefix="apps" subpath="vigour"` + `write_app_proxy` scope in `shopify.app.toml`. Routes renamed `api.*` → `proxy.*`, each calls `requireProxyShop()` (`authenticate.public.appProxy`). Unsigned/forged → 400, app not installed → 401. CORS removed. Email + length validation on bookings.
  - Theme blocks: removed "Backend App URL" setting; JS calls `/apps/vigour/...` (`data-api-base`). Client no longer sends `shop`.
  - **Google OAuth:** `/api/google-auth` deleted. Connect = authenticated dashboard action (`intent=google_connect`) → opens consent with `window.open(url, "_top")`. State is HMAC-signed (app secret), 10-min expiry. Callback verifies state, redirects to `https://{shop}/admin/apps/{API_KEY}?google=success|google_error=…`; dashboard shows a toast. Redirect URI defaults to `{SHOPIFY_APP_URL}/api/google-callback`; fake client-id fallbacks removed.
  - Dashboard status/delete scoped by shop; status values whitelisted.
- **Tested:** 18/18 (unsigned/forged/tampered proxy requests, not-installed shop, body `shop` spoof ignored, validation, OAuth state forgery/tamper/legacy, redirect URL). Typecheck + production build pass.

---

## Next steps

### A. Required before it works end-to-end (manual, by you)
1. **Run `shopify app dev`** and approve the new `write_app_proxy` scope. Check `https://<store>/apps/vigour/bookings` returns JSON on the dev store.
   - Proxy prefix/subpath only apply to *new* installs — if the dev store already had the app, set it in admin (Settings → Apps → app → App proxy) or reinstall.
2. **Google Cloud setup** (never configured yet):
   - Create OAuth client (Web), enable Google Calendar API.
   - Env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, optionally `GOOGLE_REDIRECT_URI`.
   - Add `https://<app-url>/api/google-callback` as an authorized redirect URI. Dev tunnel URLs change each run → pin `GOOGLE_REDIRECT_URI` / use a fixed tunnel.
   - In the dashboard click "Поврзи Google Calendar" and test a booking lands in Darko's calendar at the right Skopje time.
3. **Production deploy:** `shopify app deploy` (not run yet). Also choose hosting — SQLite is fine for a single server but needs a persistent disk; consider Postgres.

### Design implementation (inserted 2026-11-21 — do this before the cleanup in B)
Approved design = `docs/design/vigour-prototype.html` (+ `docs/design/README.md` with tokens, pages, data). The existing 14 blocks were
built from an earlier look; they must be brought in line with the prototype. Preview with `shopify app dev` (needs Shopify login) on the dev store.

**D0. Audit (first, no code changes):** render each block on the dev store next to the prototype, list per-block differences. Known gaps already:
- Tokens: code uses Inter + gold `#C5A880`; prototype uses **Onest + Cormorant Garamond italic accent** and blush `#C7B6A6/#8A6A55`, paper `#F7F3EE`. Update `vigour-tokens.css`.
- Missing entirely: **Shop** (packs, vouchers, gear), **cart/checkout**, **programs purchase with Онлајн / Онлајн+студио tiers**, FAQ, services **Back/Full-body toggle**, hero **arch + spine animation**, sticky **mobile bottom bar**, header live "slots today" chip + cart icon, **open-now pill** + hours table, 4-step booking with calendar/slot grid/summary/pay choice.
- Data mismatch: hourly slots + Mon–Fri 09–21 / Sat 10–16 / Sun closed (code: 8 fixed slots, 7 days); price list 800/1300, 1000/1500, 500, 2500 (check seeded prices).

**D1. Foundation:** tokens/fonts, buttons, cards, section scaffolding, header + footer + mobile bar, hero (arch, spine, live next slot).
**D2. Content blocks:** trust strip, pain map (7 zones, recommendations link to service + program), services (toggle, video modal), reels, how-it-works, founder, reviews, PRVPAT band, contact + FAQ.
**D3. Booking:** rebuild booking-form as the 4-step flow (calendar 60 days, slot grid, summary, pay card −5% / in studio, PRVPAT −10%); update `schedule.server.ts` hours + slot grid + service options (back/full → duration).
**D4. Commerce (needs decisions):** programs, packs, vouchers, gear as real Shopify products/variants; cart + checkout.
  - Open question: prototype says card payments via **cPay (CaSys)** — Shopify Payments isn't available in North Macedonia; confirm gateway before building checkout.
  - Open question: how are bookings paid online (card −5%) — Shopify checkout vs app-side? Decide with D4.
**D5. Page templates:** map the prototype's pages (`home, services, programs, shop, booking, contact`) to Shopify theme pages/templates that use the app blocks; set up nav.
**D6. QA:** mobile (≤480px) + desktop screenshots vs prototype, Lighthouse, keyboard/focus, `prefers-reduced-motion`.
Placeholders to replace with real content: photos/video, founder portrait, address, Google reviews + rating, real YouTube/video IDs.

### B. Step 5 — Cleanup (do after the design work; some items overlap D2/D3)
- `shopify.app.toml`: `application_url` / redirect URLs still `https://example.com` (CLI updates during dev; set real URL for prod).
- Remove template leftovers: `product.metafields.app.demo_info`, `metaobjects.app.example`, the "Additional page" route + nav link; review whether `write_products`/metaobject scopes are still needed.
- Replace placeholder YouTube IDs `dQw4w9WgXcQ` in `programs_preview.liquid`, `video_reels.liquid` and `DEFAULT_PROGRAMS` (`proxy.exercises.ts`) with real Vigour videos.
- Storefront fallbacks: when the API fails, `booking-form.js` shows **fake** services/slots and `hero-banner.js` invents a slot → replace with a clear "contact us on Viber/phone" message.
- Lint: label/control association in the add-service form (`app._index.tsx`), `any` in `googleCalendar.server.ts`.
- Seed data duplicated in `proxy.bookings.ts` and `app._index.tsx` → move to one shared module.

### C. Later / ideas
- Customer confirmation email/SMS (Viber?) after booking; reminder before appointment.
- Cancel/complete in dashboard should update/delete the Google Calendar event (`googleEventId` is stored but unused for that).
- Admin UI to edit/delete services, working hours, days off, and pain-map zones (PainZone table exists but nothing seeds/edits it).
- Rate limiting on booking POST (proxy is signed, but a bot on the storefront can still spam).
- Escape user input in the booking receipt `innerHTML` (`booking-form.js`).
- Upgrade path: React Router is pinned to 7.18.2 — don't bump to 7.18.3+ until the template fixes the action-origin issue.

---

## Notes for whoever continues
- Times in DB are real UTC instants; always convert via `schedule.server.ts` (`studioTimeToUtc`, `studioToday`). Never build dates with `new Date("…Z")` from local slot strings.
- Storefront code must not send `shop`; the server gets it from the signed proxy request.
- Test pattern used: temporary `app/__*_test.ts` run with `npx tsx`, calling route `loader`/`action` directly with signed URLs. **Back up `prisma/dev.sqlite` first** and restore after.
- The toolkit skills in `.agents/skills` (`shopify-dev` → `scripts/search_docs.mjs`) were used for docs lookup.
