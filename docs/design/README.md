# Vigour Massage Studio — Approved Design

**Source of truth:** `vigour-prototype.html` (this folder) — a single-file interactive prototype, copied from the
claude.ai artifact "Vigour Massage Studio" (https://claude.ai/artifact/SWtQ6p8BpYsBbUEFCnUbsQ, last updated 2026-09-23,
originally built in the "Najdo studio" claude.ai project). Open it in a browser to click through everything.
The prototype's `Marketing notes` toggle (top ribbon) shows the reasoning behind each section.

All copy is Macedonian. The prototype is hash-routed (`#home #services #programs #shop #booking #checkout #contact`).

## Design system (from the prototype)

| | Prototype |
|---|---|
| Fonts | Montserrat 500–700 (headings), **Onest** 400–700 (body), **Cormorant Garamond italic** (accent words like *енергија.*) |
| Greens | house `#243F3A`, green `#2F5A51`, soft `#D5E0DA`, mist `#ECF1EE` |
| Neutrals | paper `#F7F3EE`, skin `#DDD2C8`, skin-2 `#EEE8E1`, card `#FFFFFF`, ink `#1B2724`, muted `#56625D`, line `#E4DBD2` |
| Accent | blush `#C7B6A6`, blush-deep `#8A6A55` (used for accent text, badges, cart count) |
| Shape | pill buttons (999px), cards 22–28px radius, hero **arch** image (rounded top), wrap 1180px |
| Motion | live-dot pulse, spine vertebrae highlight animation in hero, `prefers-reduced-motion` respected |
| Header | sticky, blurred paper bg; logo mark (spine in arch) + "VIGOUR / massage studio"; nav; live "slots today" chip; cart; Book button; mobile burger |
| Mobile | sticky bottom bar ("Закажи термин" + "Viber"), horizontal snap carousels for reels/reviews |

## Pages & sections

**Home:** hero (arch + spine animation, live "next free slot" card, Google rating card) → trust strip (4 stats) →
**interactive body pain map** (7 zones: врат, рамена, горен грб, долен грб, колк, колена, стапала → symptoms, cause,
recommended treatment + program) → services teaser → 4 video reels (9:16) → how it works (4 steps) → programs teaser →
founder (Дарко, quote) → Google reviews carousel → first-visit CTA band (code `PRVPAT`, −10%).

**Services:** filter chips, cards with video thumb, tags, **Back / Full-body toggle** that changes price+duration, "Закажи".
**Programs:** 4 video programs (Здрав грб, Врат и рамена, Силно колено, Мобилност 30+) — weeks/videos/min per day, who it's
for, expandable curriculum, two tiers each (**Онлајн** vs **Онлајн + студио**, includes massage sessions), buy button.
**Shop:** filters Пакети / Ваучери / Опрема — 5- and 10-session packs, gift voucher (800/1300/2500), oil, ball, roller, bands.
**Booking:** 4-step flow (Третман → Датум и час → Твои податоци → Плаќање) with step spine, calendar (60 days, no Sundays),
slot grid, sticky summary; pay online by card (−5%) or in studio (cash); first-timer −10% with `PRVPAT`.
**Checkout:** cart (bookings + programs + products), delivery (pickup free / Skopje 150 / MK 200), promo code, card via cPay.
**Contact:** address, phone/Viber/WhatsApp, Instagram, open-now pill + hours, map, message form, FAQ (5 questions).
**Footer:** logo, service links, studio links, contact, cPay note.

## Business data in the prototype (differs from what's in code today)

- Hours: Mon–Fri 09:00–21:00, Sat 10:00–16:00, Sun closed. Slots **hourly** (code currently uses 8 slots from 10:00, Mon–Sun).
- Prices: Релакс 800 (грб 45′) / 1.300 (цело 60′); Спортска 1.000 / 1.500; Стапала 500 (45′); Премиум 2.500 (60′).
- Phone `+389 75 304 171`, IG `@vigour.massagestudio`, address is a placeholder ("ул. Пример бр. 12").
- Reviews are placeholders; rating 4,9 / 40+ is a placeholder until pulled from Google.
