/**
 * Vigour Massage Studio — hero
 * - "next free slot" card, live from the booking calendar (shown only when there is real data)
 * - clicking it asks the booking form to pre-select that date and time
 * - smooth scrolling for the hero buttons
 */
(function () {
  'use strict';

  const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Dates come from the booking calendar as YYYY-MM-DD in the studio's time zone
  function studioToday() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Skopje' }).format(new Date());
  }

  // Texts written by the block (hero_banner.liquid) in the language of the page
  function readTexts(hero) {
    const el = document.getElementById('vm-hero-i18n-' + hero.id.replace('vm-hero-', ''));
    try {
      return JSON.parse(el.textContent);
    } catch (e) {
      return { noSlot: '', atTime: '[day] [time]', today: '', tomorrow: '', days: [], months: [] };
    }
  }

  // "Денес" / "Утре" / "Пет, 28 ноември" (same wording as the header chip)
  function dayLabel(dateStr, t) {
    const toUtc = (s) => {
      const [y, m, d] = s.split('-').map(Number);
      return Date.UTC(y, m - 1, d);
    };
    const target = toUtc(dateStr);
    const diff = Math.round((target - toUtc(studioToday())) / 864e5);
    if (diff === 0) return t.today;
    if (diff === 1) return t.tomorrow;
    const d = new Date(target);
    return `${t.days[d.getUTCDay()]}, ${d.getUTCDate()} ${t.months[d.getUTCMonth()]}`;
  }

  function initHero(hero) {
    const apiBase = hero.dataset.apiBase || '/apps/vigour';
    const t = readTexts(hero);
    const card = hero.querySelector('.vm-hero-slot-card');
    const text = card ? card.querySelector('.vm-hero-slot-text') : null;
    let slot = null;

    // Calendar says nothing is free (or can't be reached): no made-up time, point to the calendar
    function showNoSlot() {
      if (!card) return;
      text.textContent = t.noSlot;
      card.hidden = false;
    }

    async function loadNextSlot() {
      if (!card) return;
      try {
        const res = await fetch(`${apiBase}/bookings?nextSlot=true`, { credentials: 'omit', headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error('calendar not ok');
        const data = await res.json();
        const next = data && data.nextSlot;
        if (!next || !next.date || !next.time) {
          showNoSlot();
          return;
        }
        slot = { date: next.date, time: next.time };
        text.textContent = t.atTime.replace('[day]', dayLabel(next.date, t)).replace('[time]', next.time);
        card.hidden = false;
      } catch (e) {
        showNoSlot();
      }
    }

    // Tell the booking form which slot was chosen; the link itself still scrolls to the form
    if (card) {
      card.addEventListener('click', () => {
        if (slot) window.dispatchEvent(new CustomEvent('vigour:prefill-slot', { detail: slot }));
      });
    }

    // In-page buttons: smooth scroll (the block's scroll-margin keeps it below the sticky header)
    hero.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', (e) => {
        const id = link.getAttribute('href').slice(1);
        const target = id && document.getElementById(id);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: REDUCED_MOTION.matches ? 'auto' : 'smooth', block: 'start' });
      });
    });

    loadNextSlot();
  }

  function init() {
    document.querySelectorAll('.vm-hero').forEach(initHero);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
