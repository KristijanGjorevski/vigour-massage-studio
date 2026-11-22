/**
 * Vigour Massage Studio — Hero Banner JavaScript
 * Fetches next available slot and handles smooth scrolling & pre-fill
 */
(function() {
  'use strict';

  function initHeroBanner() {
    const heroElements = document.querySelectorAll('.vm-hero-section');
    
    heroElements.forEach(hero => {
      const blockId = hero.dataset.blockId;
      const apiBase = hero.dataset.apiBase || '/apps/vigour';
      const slotCard = hero.querySelector('.vm-hero-slot-card');
      const livePill = hero.querySelector('.vm-hero-live-pill');

      if (!slotCard) return;

      const timeEl = slotCard.querySelector('.vm-slot-card-time');
      const dateEl = slotCard.querySelector('.vm-slot-card-date-text');
      const slotBtn = slotCard.querySelector('.vm-slot-btn');

      // Dates come from the booking calendar as YYYY-MM-DD in the studio's time zone
      function studioToday() {
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Skopje' }).format(new Date());
      }

      // "Денес" / "Утре" / "Пет, 28 ноември" (same wording as the header chip)
      function dayLabel(dateStr) {
        const toUtc = (s) => {
          const [y, m, d] = s.split('-').map(Number);
          return Date.UTC(y, m - 1, d);
        };
        const target = toUtc(dateStr);
        const diff = Math.round((target - toUtc(studioToday())) / 864e5);
        if (diff === 0) return 'Денес';
        if (diff === 1) return 'Утре';
        const days = ['Нед', 'Пон', 'Вто', 'Сре', 'Чет', 'Пет', 'Саб'];
        const months = ['јануари', 'февруари', 'март', 'април', 'мај', 'јуни', 'јули', 'август', 'септември', 'октомври', 'ноември', 'декември'];
        const d = new Date(target);
        return `${days[d.getUTCDay()]}, ${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
      }

      // No slot to show (calendar unreachable or fully booked): no made-up time,
      // just point the visitor to the booking form
      function showNoSlot() {
        if (timeEl) timeEl.hidden = true;
        if (dateEl) dateEl.textContent = 'Види ги слободните термини во календарот';
      }

      // Fetch next slot from API
      async function fetchNextSlot() {
        const apiUrl = `${apiBase}/bookings?nextSlot=true`;

        try {
          const res = await fetch(apiUrl, { credentials: 'omit' });
          if (!res.ok) throw new Error('API slot response not ok');
          const data = await res.json();
          const next = data && data.nextSlot;
          if (!next || !next.date || !next.time) {
            showNoSlot();
            return;
          }

          if (timeEl) timeEl.textContent = next.time;
          if (dateEl) dateEl.textContent = dayLabel(next.date);
          if (slotBtn) {
            slotBtn.href = `#najdo-booking-container?date=${encodeURIComponent(next.date)}&time=${encodeURIComponent(next.time)}`;
          }
          // "Free slots today" only when the next free slot really is today
          if (livePill) livePill.hidden = next.date !== studioToday();
        } catch (err) {
          showNoSlot();
        }
      }

      fetchNextSlot();

      // Smooth scroll for CTAs targeting anchors
      hero.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
          const href = this.getAttribute('href');
          const targetId = href.split('?')[0];
          if (targetId && targetId !== '#') {
            const targetEl = document.querySelector(targetId);
            if (targetEl) {
              e.preventDefault();
              targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }
        });
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeroBanner);
  } else {
    initHeroBanner();
  }
})();
