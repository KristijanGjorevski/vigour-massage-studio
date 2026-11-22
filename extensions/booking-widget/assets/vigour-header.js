/**
 * Vigour Massage Studio — header
 * - MK / EN switch (Macedonian unless the visitor picked English; broadcast to other blocks)
 * - phone menu (open/close, Escape, click outside, closes on link click)
 * - live "free slots today" chip from the booking calendar (hidden if it can't load)
 * - cart count, kept in sync when the theme updates the cart
 * - smooth scrolling for the in-page links
 */
(function () {
  'use strict';

  const I18N = {
    mk: {
      navHome: 'Почетна',
      navServices: 'Услуги',
      navPrograms: 'Програми',
      navShop: 'Продавница',
      navContact: 'Контакт',
      ctaBook: 'Закажи термин',
      cart: 'Кошничка',
      menuOpen: 'Отвори мени',
      menuClose: 'Затвори мени',
      slotsToday: (n) => (n === 1 ? 'Уште 1 слободен термин денес' : `Уште ${n} слободни термини денес`),
      nextSlot: (day, time) => `Следен термин: ${day} во ${time}`,
      today: 'Денес',
      tomorrow: 'Утре',
      days: ['Нед', 'Пон', 'Вто', 'Сре', 'Чет', 'Пет', 'Саб'],
      months: ['јануари', 'февруари', 'март', 'април', 'мај', 'јуни', 'јули', 'август', 'септември', 'октомври', 'ноември', 'декември']
    },
    en: {
      navHome: 'Home',
      navServices: 'Services',
      navPrograms: 'Programs',
      navShop: 'Shop',
      navContact: 'Contact',
      ctaBook: 'Book a session',
      cart: 'Cart',
      menuOpen: 'Open menu',
      menuClose: 'Close menu',
      slotsToday: (n) => (n === 1 ? '1 free slot left today' : `${n} free slots left today`),
      nextSlot: (day, time) => `Next slot: ${day} at ${time}`,
      today: 'Today',
      tomorrow: 'Tomorrow',
      days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    }
  };

  // Keep in sync with the breakpoints in vigour-header.css
  const MOBILE_QUERY = window.matchMedia('(max-width: 1060px)');
  const CHIP_QUERY = window.matchMedia('(min-width: 1321px)');
  const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Macedonian first: English only when the visitor picked EN in the switcher.
  function savedLanguage() {
    try {
      if (localStorage.getItem('vm_language') === 'en') return 'en';
    } catch (e) {}
    return 'mk';
  }

  function saveLanguage(lang) {
    try {
      localStorage.setItem('vm_language', lang);
    } catch (e) {}
  }

  // Today's date in the studio's time zone, as YYYY-MM-DD
  function studioToday() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Skopje' }).format(new Date());
  }

  // "Денес" / "Утре" / "Пет, 28 ноември" for a YYYY-MM-DD date
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

  // "#vm-contact" also matches blocks whose id carries a suffix, e.g. "vm-contact-<block id>"
  function findAnchorTarget(href) {
    if (!href || href.charAt(0) !== '#' || href.length < 2) return null;
    const id = href.slice(1);
    return document.getElementById(id) || document.querySelector(`[id^="${CSS.escape(id)}-"]`);
  }

  // Layout position on the page. Unlike getBoundingClientRect it ignores the theme's
  // slide-in animation, which shifts a section down until it has been revealed.
  function pageTop(el) {
    let y = 0;
    for (let n = el; n; n = n.offsetParent) y += n.offsetTop;
    return y;
  }

  function initHeader(header) {
    const nav = header.querySelector('.vm-header-nav');
    const burger = header.querySelector('.vm-burger');
    const chip = header.querySelector('.vm-slot-chip');
    const cartCount = header.querySelector('.vm-cart-count');
    const cartBtn = header.querySelector('.vm-cart-btn');
    const apiBase = header.dataset.apiBase || '/apps/vigour';

    let lang = savedLanguage();
    let slotInfo = null; // { count } or { date, time }

    function renderChip() {
      if (!chip || !slotInfo) return;
      const t = I18N[lang];
      chip.querySelector('.vm-slot-chip-text').textContent = slotInfo.count
        ? t.slotsToday(slotInfo.count)
        : t.nextSlot(dayLabel(slotInfo.date, t), slotInfo.time);
      chip.hidden = false;
    }

    function setCartLabel() {
      if (!cartBtn) return;
      const n = cartCount ? Number(cartCount.textContent) || 0 : 0;
      cartBtn.setAttribute('aria-label', n ? `${I18N[lang].cart} (${n})` : I18N[lang].cart);
    }

    function applyLanguage(next) {
      lang = I18N[next] ? next : 'mk';
      const t = I18N[lang];
      document.documentElement.lang = lang;

      header.querySelectorAll('.vm-lang-btn').forEach((btn) => {
        const on = btn.dataset.lang === lang;
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-pressed', String(on));
      });
      header.querySelectorAll('[data-vm-t]').forEach((el) => {
        const text = t[el.dataset.vmT];
        if (typeof text === 'string') el.textContent = text;
      });
      if (burger) {
        const open = burger.getAttribute('aria-expanded') === 'true';
        burger.setAttribute('aria-label', open ? t.menuClose : t.menuOpen);
      }
      setCartLabel();
      renderChip();

      // Lets the other blocks (booking form, pain map, …) follow the switch
      window.dispatchEvent(new CustomEvent('vigour:language-changed', {
        detail: { lang, isMacedonia: lang === 'mk' }
      }));
    }

    // Language switch
    header.querySelectorAll('.vm-lang-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.lang === lang) return;
        saveLanguage(btn.dataset.lang);
        applyLanguage(btn.dataset.lang);
      });
    });

    // Phone menu
    function setMenu(open) {
      if (!nav || !burger) return;
      nav.classList.toggle('open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? I18N[lang].menuClose : I18N[lang].menuOpen);
    }

    if (nav && burger) {
      burger.addEventListener('click', () => {
        const open = !nav.classList.contains('open');
        setMenu(open);
        // The menu sits before the button in the page, so move keyboard focus into it
        if (open) {
          const first = nav.querySelector('.vm-nav-item');
          if (first) first.focus();
        }
      });
      // Close when keyboard focus leaves the header
      header.addEventListener('focusout', (e) => {
        if (nav.classList.contains('open') && e.relatedTarget && !header.contains(e.relatedTarget)) setMenu(false);
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && nav.classList.contains('open')) {
          setMenu(false);
          burger.focus();
        }
      });
      document.addEventListener('click', (e) => {
        if (nav.classList.contains('open') && !header.contains(e.target)) setMenu(false);
      });
      MOBILE_QUERY.addEventListener('change', (e) => {
        if (!e.matches) setMenu(false);
      });
    }

    // In-page links: smooth scroll, mark the nav item, close the menu
    header.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', (e) => {
        const target = findAnchorTarget(link.getAttribute('href'));
        setMenu(false);
        if (!target) return;
        e.preventDefault();
        // Stop just below the sticky header so it doesn't cover the section's top
        const top = pageTop(target) - header.offsetHeight;
        window.scrollTo({ top: Math.max(0, top), behavior: REDUCED_MOTION.matches ? 'auto' : 'smooth' });
        if (link.classList.contains('vm-nav-item')) {
          header.querySelectorAll('.vm-nav-item').forEach((l) => {
            l.classList.toggle('active', l === link);
            if (l === link) l.setAttribute('aria-current', 'location');
            else l.removeAttribute('aria-current');
          });
        }
      });
    });

    // Shadow once the page scrolls
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // Cart count: refresh when the theme changes the cart or the page comes back from history
    async function refreshCart() {
      if (!cartCount) return;
      try {
        const root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
        const res = await fetch(`${root}cart.js`, { headers: { Accept: 'application/json' } });
        if (!res.ok) return;
        const cart = await res.json();
        cartCount.textContent = cart.item_count;
        cartCount.hidden = !cart.item_count;
        setCartLabel();
      } catch (e) {}
    }
    document.addEventListener('cart:update', refreshCart);
    window.addEventListener('pageshow', (e) => {
      if (e.persisted) refreshCart();
    });

    // Live slot chip: today's free slots, otherwise the next free slot
    async function loadSlots() {
      if (!chip) return;
      try {
        const res = await fetch(`${apiBase}/bookings?date=${studioToday()}`, { headers: { Accept: 'application/json' } });
        if (!res.ok) return;
        const data = await res.json();
        const count = Array.isArray(data.availableSlots) ? data.availableSlots.length : 0;
        if (count > 0) {
          slotInfo = { count };
        } else {
          const nextRes = await fetch(`${apiBase}/bookings?nextSlot=true`, { headers: { Accept: 'application/json' } });
          if (!nextRes.ok) return;
          const next = (await nextRes.json()).nextSlot;
          if (!next || !next.date || !next.time) return;
          slotInfo = { date: next.date, time: next.time };
        }
        renderChip();
      } catch (e) {}
    }

    applyLanguage(lang);

    // The chip only shows on wide screens (see vigour-header.css), so only fetch there
    if (chip) {
      if (CHIP_QUERY.matches) {
        loadSlots();
      } else {
        const onWide = (e) => {
          if (!e.matches) return;
          CHIP_QUERY.removeEventListener('change', onWide);
          loadSlots();
        };
        CHIP_QUERY.addEventListener('change', onWide);
      }
    }
  }

  function init() {
    document.querySelectorAll('.vm-header-wrapper').forEach(initHeader);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
