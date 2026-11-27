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
| Theme blocks | `extensions/booking-widget/` | 15 "VM" app blocks: header, mobile bar, hero (live next slot), pain map, services grid, founder, how it works, programs, video reels, reviews, pricing, first-time offer, booking form, contact (Viber-first), footer. Locales `mk` + `en` |
| Data | `prisma/schema.prisma` (SQLite) | Session, Service, Appointment, GoogleAuth, Program, Exercise, PainZone |

**Stack:** Shopify React Router app template (React Router 7.18.2 — pinned on purpose, see CHANGELOG), Prisma 6 + SQLite, `googleapis`, Polaris web components.

**Business rules currently in code**
- Working slots (Skopje time): 10:00, 11:15, 12:30, 14:00, 15:15, 16:30, 17:45, 19:00
- Slots < 30 min from now aren't offered; "next free slot" searches 14 days ahead
- 6 default services seeded per shop (500–2500 ден., 45–75 min) when the Service table is empty

---

## Session log — 2026-11-03

Picked up the codebase built with another AI, analysed it, and worked through the first four fixes.

### 1. Version control — `08cdde0`
- Repo had no commits. Made the initial commit of the existing work.
- Repo-local git identity set: `kikog <kikogjorevski@gmail.com>`.

### 2. Missing database migration — `0f9b719`
- **Problem:** `GoogleAuth`, `Program`, `Exercise`, `PainZone` and `Appointment.googleEventId` existed only in the local `dev.sqlite` (created via `db push`). A fresh/production `prisma migrate deploy` would have built an incomplete DB.
- **Fix:** added `prisma/migrations/20261103120000_add_google_auth_programs_pain_zones`. Verified a brand-new DB built from migrations matches the schema exactly. Local DB marked as applied (no data touched).

### 3. Timezone & overlap fixes — `d996154`
- **Problem:** slot "10:00" was stored as 10:00 **UTC** (= 11:00/12:00 in Skopje) → wrong times in Google Calendar. Conflicts only detected on exact start-time match, so overlapping/odd-time events didn't block slots. Unknown service IDs were silently booked as the cheapest service.
- **Fix:**
  - New `schedule.server.ts`: DST-aware Europe/Skopje ↔ UTC conversion; slot blocked if `[start, start+duration)` overlaps any appointment or Google busy block.
  - Google reads switched to the **FreeBusy API** (respects "free" events, any length); uses the shop's stored `calendarId`; events written with `timeZone: Europe/Skopje`.
  - Booking: validates date/time/slot, rejects unknown services (400), re-checks overlap inside a transaction (409 on clash), past slots rejected.
  - Dashboard shows Skopje times. Booking form passes `serviceId` and refreshes slots when the treatment changes; storefront "today" uses Skopje date.
- **Tested:** 10/10 (summer/winter/DST-day conversion, booking, double-book, fake service, off-grid time, past date, overlap edge).

### 4. Security — `d23ace0`
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

### Design implementation, in phases (do these before the cleanup in B)

Approved design: `docs/design/vigour-prototype.html`. `docs/design/README.md` lists its colours, fonts, pages and business data.
The existing 14 blocks were built from an earlier look, so they must be brought in line with the prototype.
Preview with `shopify app dev` (needs a Shopify login) on the dev store.

Each phase is done in order, on its own git branch. Tick a step when it's done.

#### Phase 1: Audit the current design (no code changes)

- [x] 1.1 Get `shopify app dev` running and add all 14 blocks to a test page on the dev store
- [x] 1.2 Screenshot each block (desktop + phone) next to the same section of the prototype
- [x] 1.3 Write a per-block list of differences into `docs/design/audit.md` (local only, not in git)
- Done 2026-11-21. Results and open decisions are in the local `docs/design/audit.md`.
- Test page: template `page.vigour-audit` in the **development theme only**. View it via the `shopify app dev` theme preview at
  `http://127.0.0.1:9293/pages/contact?view=vigour-audit`.
- Gaps already known:
  - Colours and fonts: code uses Inter + gold `#C5A880`; prototype uses Onest + Cormorant Garamond italic accent, blush `#C7B6A6` / `#8A6A55`, paper `#F7F3EE`
  - Missing entirely: shop, cart and checkout, program tiers, FAQ, hero arch + spine animation, mobile bottom bar, header "slots today" chip + cart icon, open-now pill + hours table, 4-step booking
  - Data mismatch: prototype has hourly slots, Mon–Fri 09–21, Sat 10–16, Sun closed (code: 8 fixed slots, 7 days); prices 800/1300, 1000/1500, 500, 2500 (check seeded prices)

#### Phase 2: Brand foundation

- [x] 2.1 Update `vigour-tokens.css`: colours, fonts (Onest, Cormorant Garamond), radii, shadows
  - Found on the way: the host theme sets its root font size to 10px, so every `rem` in the blocks rendered at ~62%
    (body text 10–12px). All block sizes are now in px. Header breakpoints adjusted so it still fits (full rebuild in 2.3).
- [x] 2.2 Shared buttons, cards and section spacing
  - Buttons: `vm-btn-primary` / `-secondary` (ghost) / `-skin` / `-light` / `-outline-light`, plus `vm-btn-sm`.
    Section padding comes from `--vm-section-pad`; `vm-card` / `vm-section` utilities for the Phase 3 rebuilds.
- [x] 2.3 Header: logo, nav, live "slots today" chip, cart icon, Book button, mobile menu
  - Prototype logo (arch + spine) in the shared `vigour-logo` snippet, used by header and footer.
  - Slot chip is live from the booking calendar (today's free slots, else the next free slot) and stays hidden
    if it can't load, so no placeholder text. Cart count from Liquid, refreshed on the theme's `cart:update` event.
  - Breakpoints: chip above 1320px, menu button from 1060px, MK/EN + Book move into the menu below 640px.
  - The section holding the header is made sticky (`:has()`), because the theme's animated section wrapper
    kept the header from sticking and let the next section cover the phone menu.
  - Fixed: "Продавница" and "Контакт" links never scrolled (block ids have a suffix); in-page links now stop below the header.
  - Store setup later: place the header where it shows on every page and turn off the theme's own header.
- [x] 2.4 Footer
  - Restyled like the prototype (house-green, 4 columns, two columns on phones). Copyright year is automatic.
  - Fixed: the footer links "Пакети и ваучери" and "Контакт" pointed at ids that did not exist. Packages and contact
    sections now have the fixed ids `vm-packages` / `vm-contact`, and in-page jumps stop below the sticky header.
- [x] 2.5 Sticky mobile bottom bar (Book + Viber)
  - New block `VM Mobile Bar` (phones only, up to 760px). It moves itself into `<body>` because the theme's animated
    section wrapper would otherwise break `position: fixed`, and the page gets bottom padding so the footer is not covered.
  - Viber opens `viber://chat?number=38975304171` (same as the other blocks); the Book text follows the MK/EN switch.
  - Store setup later: add this block on every page (next to the header).
  - Found on the way: at 360px the Programs cards were wider than the screen. Fixed (see "Bug fixes" below).
- [x] 2.6 Hero: arch image, spine animation, live next-slot card, rating card
  - Rebuilt like the prototype: light background, headline with the italic accent word, two buttons (booking form, pain map),
    rating line, arch with the animated spine (a studio photo can replace it in the block settings), floating cards.
  - The old dark banner, stats row and "free slots today" pill are gone (the stats come back as the trust strip, 3.1).
  - Next-slot card is live from the calendar ("Утре во 10:00"); with no slot or no connection it says "Види го календарот", never a made-up time.
    Clicking it now pre-selects that date and time in the booking form (the old link put the date in a part of the address the form never read).
  - Fixed: the pain map section had a suffixed id, so the "Каде те боли?" button could not find it; it is now `#vm-painmap`.
  - Known: the card shows the next slot for the shortest treatment; if the form's selected treatment is longer, that exact time may not be offered and nothing is pre-selected.
- [x] 2.7 Macedonian + English: the interface texts of all blocks come from the `mk` / `en` locale files
  - Texts live in `extensions/booking-widget/locales/mk.json` and `en.default.json` (same 183 keys in both; English is the fallback file).
    Blocks use `{{ 'key' | t }}`. A text the merchant typed in the theme editor still wins, in both languages; when the field is empty the
    locale text is used (snippet `vigour-text`). Prices go through the snippet `vigour-price` (`1.300 ден.` / `1,300 MKD`).
  - The MK/EN switch is now the store's own language switch (snippet `vigour-lang-switcher`, a Shopify localization form). It reloads the
    page in the other language and is hidden while the store has only one language. The old browser-side switch (`vm_language`,
    the `vigour:language-changed` event) is gone.
  - Scripts no longer hold texts. The header, hero and reviews blocks write the few texts their script needs into a JSON `<script>`
    in the page language; the pain map and the booking form load longer texts from one file per language in `assets/`
    (`pain-zones-mk|en.json`, `booking-texts-mk|en.json`).
  - The Macedonian output is word-for-word the same as before (checked by rendering the old and new blocks and comparing the text).
  - **Store setup (manual, in Shopify admin → Settings → Languages):** add Macedonian and make it the default language, publish English
    as the second language. Until then the storefront shows the English fallback texts and no switch.
    **Also add the languages to the market** (Admin → Markets → the market → Domain / language): a language that is published but not
    in any market is not offered, and the MK/EN switch stays hidden. Done 2026-11-27: the one market ("United States", which also includes
    North Macedonia) offers Macedonian (default, no prefix) and English (`/en`). A North Macedonia market comes with Phase 5.
  - **Shopify limits that shaped this** (enforced when `shopify app dev` / `deploy` uploads the extension, checked 2026-11-26):
    - **15 KB per locale file.** `mk.json` is 13.8 KB (Cyrillic is 2 bytes a character), so there is almost no room left. Do not add
      long texts to it. Keep it one key per line without indentation, and run the key check (below) before committing.
    - **100 KB of Liquid across the whole extension** (now 89.5 KB). Phase 3 and 4 will hit this, so new sections must stay lean.
    - A `}` inside a string in `{{ ... }}` ends the tag early on Shopify's server (the local checks do not catch it). Placeholders
      handed to scripts therefore use `[name]`, never `{name}`.
  - **Still Macedonian in the English version, on purpose:** the card texts of the services grid, programs, reviews and packages (and the
    service names, which come from the Service table and are matched by name). They are content, too long for a locale file, and
    Phase 3 rebuilds them. Do that rebuild with merchant-editable data that Shopify can translate (block settings or metaobjects, then
    translate them in Shopify admin), not with locale files. Also not translated: text typed into block settings; the theme-editor
    labels (English).
  - Key check (scratch script, not in the repo): every key used exists in both files, no unused keys, same placeholders, both files
    under 14 KB, Liquid total under 95 KB.
- [ ] 2.8 Theme settings pass: make the pages we don't rebuild match the brand
  - The store runs on the Horizon theme ("Updated copy of Horizon"). Product, collection, cart, search, account and 404 pages stay
    Horizon's own, so they must look on-brand and not half-default.
  - Admin → Online Store → Themes → Customize → Theme settings: set colours (paper `#F7F3EE`, house-green, blush `#C7B6A6` / `#8A6A55`),
    fonts (Onest + Cormorant Garamond; if Onest is not in Shopify's font picker, load it in the theme code), buttons and corner radius
    to the prototype values in `docs/design/README.md`.
  - Checkout: Settings → Checkout and customer accounts → Customize (logo, colours, fonts, corner radius only; Shopify controls the layout).
  - Anything the settings cannot reach (layout differences on product, cart, 404) gets decided in Phase 5, as a VM block or a small
    theme code edit. Re-check these pages again in 7.1.
  - Theme cleanup done 2026-11-27: the theme's own header, announcement bar, hero and featured collection were removed from the theme code
    (`sections/header-group.json`, `templates/index.json` now empty), so the VM header is the only header and Home starts empty.
    The theme code lives only in the store. Pull it with `shopify theme pull` into a folder outside this repo if needed.

#### Phase 3: Home page sections

- [ ] 3.1 Trust strip (4 stats)
- [ ] 3.2 Pain map: 7 zones, each recommends a treatment + a program
  - Known: at 320px (very small phones) the zone panel is about 15px wider than the screen. Fix in this rebuild.
- [ ] 3.3 Services: restyle the 6 separate cards (decided 2026-11-22: no back/full-body toggle; Premium is 75 min), video popup
- [ ] 3.4 Video reels (9:16, swipe on phone)
- [ ] 3.5 How it works (4 steps)
- [ ] 3.6 Founder section
- [ ] 3.7 Reviews carousel
- [ ] 3.8 First-visit offer band (code PRVPAT)
- [ ] 3.9 Contact: hours table, open-now pill, map, message form, FAQ

#### Phase 4: Booking flow

- [ ] 4.1 Update `schedule.server.ts`: opening hours, hourly slots, Sundays closed
- [ ] 4.2 Service options: back / full body, each with its own duration and price
- [ ] 4.3 Step 1: choose treatment
- [ ] 4.4 Step 2: calendar (60 days ahead) + slot grid
- [ ] 4.5 Step 3: your details
- [ ] 4.6 Step 4: payment choice (card −5% or in studio) + PRVPAT −10% for first visits
- [ ] 4.7 Sticky booking summary + confirmation screen

#### Phase 5: Shop and payments (needs decisions first)

- [ ] 5.1 Decide the payment gateway. The prototype says cPay (CaSys); Shopify Payments isn't available in North Macedonia
- [ ] 5.2 Decide how online booking payments work: Shopify checkout or handled by the app
- [ ] 5.3 Programs as Shopify products with two tiers (Онлајн / Онлајн + студио)
- [ ] 5.4 Session packs, gift vouchers and equipment as Shopify products
- [ ] 5.5 Cart and checkout

#### Phase 6: Pages and navigation

Started early (2026-11-27), before Phases 3 to 5, so the real site can be checked page by page while the blocks are rebuilt.
The pages use the existing blocks; Phases 3 and 4 improve them in place.

- [x] 6.1 Create the Shopify pages: home, services, programs, shop, booking, contact
  - Admin pages `services`, `programs`, `shop`, `booking`, `contact` (the handles must match: the header, footer and buttons link to
    `/pages/<handle>`). Home is the theme's `index.json`. The links are built from `routes.root_url`, so they keep the language prefix (`/en/pages/…`).
- [x] 6.2 Place the app blocks on each page
  - Templates in the theme (`templates/index.json`, `page.services|programs|shop|booking|contact.json`), one generic Section per VM block, full width.
    Home: hero, pain map, services, reels, how it works, programs, founder, reviews, first-time offer. Services: services + offer.
    Programs: programs + reviews. Shop: pricing block (a stand-in until Phase 5 builds real products and collections). Booking: booking form.
    Contact: contact block (Horizon's contact form is gone; the message form comes with 3.9).
  - Still missing against the prototype: trust strip (3.1) on Home, FAQ and message form (3.9) on Contact.
- [x] 6.3 Set up the header and footer menus
  - VM Header Nav and VM Mobile Bar sit in the theme's header group, VM Footer in the footer group (shown on every page, full width).
    The theme's own header, announcement bar, hero, featured collection and footer are removed. The links inside the blocks do the navigation,
    so the theme's menus are not used.
  - Booking is its own page. The hero's next-slot card, the pain-map treatment button and the services cards open it with `?date=&time=` or
    `?service=`, and the form pre-selects them (`booking-form.js`).
- How to test: use the live storefront `https://<store>.myshopify.com` (store password needed while it is protected), not `127.0.0.1:9293`.
  That preview serves an older development theme without our templates.
- The theme code (templates, header and footer groups) lives only in the store. Pull it with `shopify theme pull` into a folder outside this repo.

#### Phase 7: Final check

- [ ] 7.1 Compare phone (≤480px) and desktop screenshots against the prototype
- [ ] 7.2 Lighthouse speed and accessibility check
- [ ] 7.3 Keyboard navigation, focus rings and reduced-motion support
- [ ] 7.4 Swap placeholders for real content: photos and video, founder portrait, address, Google reviews and rating, real video IDs

#### Final notices: review with Darko after all other steps (not bugs)

Decided 2026-11-23: these stay as they are until the end, because texts, massages and the number of cards may still change.

- **Ratings and claims:** the hero's "4,9 на Google" and rating card "4,9 од 5 · 40+ рецензии" are the prototype's placeholder numbers (editable in the hero block settings, or hide the card). The founder section's "600+ treatments" and "certified", and the trust strip's "4,9 ★" (3.1), need the same check. Replace with real, provable numbers or remove.
- **Texts, massages and cards:** some texts and massages may change and the number of cards may go lower. When that happens, re-check everything that lists them: services grid, booking form select, footer "Услуги" links, pain-map recommendations, seeded services (`proxy.bookings.ts`, `app._index.tsx`), prices in the shop.
- **Placeholder videos:** program and reel videos all use the test YouTube ID `dQw4w9WgXcQ` (the embed shows "This video is unavailable"). Replace with Darko's real videos (see 7.4 and the Step 5 list).

#### Bug fixes (from the 2026-11-23 bug clip)

- [x] Programs cards: grid minimum is now `min(100%, 300px)` and padding, gap and title size scale with the screen, so no card is ever wider than the screen.
- [x] Booking form: when the calendar can't be reached it shows a message (Retry, Viber, phone) instead of made-up services and times. If only the slots for a chosen date fail, it shows a message with Retry inside the form.

### B. Step 5 — Cleanup (do after the design phases; some items overlap Phases 3 and 4)
- `shopify.app.toml`: `application_url` / redirect URLs still `https://example.com` (CLI updates during dev; set real URL for prod).
- Remove template leftovers: `product.metafields.app.demo_info`, `metaobjects.app.example`, the "Additional page" route + nav link; review whether `write_products`/metaobject scopes are still needed.
- Replace placeholder YouTube IDs `dQw4w9WgXcQ` in `programs_preview.liquid`, `video_reels.liquid` and `DEFAULT_PROGRAMS` (`proxy.exercises.ts`) with real Vigour videos.
- Storefront fallbacks: done. `hero-banner.js` (2.3) and `booking-form.js` (bug fixes below) no longer invent a time or a service; they show a message with Retry, Viber and phone.
- Lint (`npm run lint`, 12 errors as of 2026-11-22): label/control association in the add-service form (`app._index.tsx`), `any` in `googleCalendar.server.ts`, React-hook naming in `booking-form.js`, unused variables in `hero-banner.js` and `programs-preview.js`, empty `catch` blocks in `vigour-header.js`.
- Template leftovers in the repo root: Shopify's template `CHANGELOG.md` and `README.md` → replace the README with a project README; check whether `pnpm-workspace.yaml` is needed (the project uses npm).
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
- AI assistant and editor files (Shopify AI Toolkit skills, MCP configs, assistant instructions) are kept locally and git-ignored, not part of the repo. Install the toolkit per the [Shopify AI Toolkit docs](https://shopify.dev/docs/apps/build/ai-toolkit) if needed.
