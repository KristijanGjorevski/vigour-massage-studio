/**
 * Vigour Massage Studio — Header Navigation & Geolocation Language Controller
 * Detects visitor location: North Macedonia -> MK, International -> EN
 * Supports manual switcher & sync across all theme blocks
 */
(function() {
  'use strict';

  const I18N = {
    mk: {
      navHome: 'Почетна',
      navServices: 'Услуги',
      navPrograms: 'Програми',
      navShop: 'Продавница',
      navContact: 'Контакт',
      ctaBook: 'Закажи термин',
      availability: count => `Уште ${count} слободни термини денес`,
      defaultAvailability: 'Уште 2 слободни термини денес'
    },
    en: {
      navHome: 'Home',
      navServices: 'Services',
      navPrograms: 'Programs',
      navShop: 'Packages',
      navContact: 'Contact',
      ctaBook: 'Book Appointment',
      availability: count => `${count} open slots today`,
      defaultAvailability: '2 open slots today'
    }
  };

  /**
   * Macedonian first: only the header has an English version so far (the other
   * blocks are Macedonian only), so auto-detecting English produced a mixed page.
   * English is shown only when the visitor picks EN in the switcher.
   */
  function detectClientLanguage() {
    try {
      if (localStorage.getItem('vm_language') === 'en') return 'en';
    } catch (e) {}
    return 'mk';
  }

  function applyLanguage(lang, header) {
    const t = I18N[lang] || I18N.mk;
    document.documentElement.lang = lang;

    // Update switcher active states
    header.querySelectorAll('.vm-lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    // Update navigation text
    const navMap = [
      { selector: 'a[href*="#vigour-services"]', text: t.navServices },
      { selector: 'a[href*="#vigour-programs"]', text: t.navPrograms },
      { selector: 'a[href*="#vm-packages"]', text: t.navShop },
      { selector: 'a[href*="#vm-contact"]', text: t.navContact }
    ];

    // Home links
    header.querySelectorAll('.vm-nav-item, .vm-mobile-nav-item').forEach(link => {
      const href = link.getAttribute('href');
      if (href === '#' || href === '/') {
        link.textContent = t.navHome;
      } else {
        navMap.forEach(item => {
          if (link.matches(item.selector)) link.textContent = item.text;
        });
      }
    });

    // Update CTA button text
    header.querySelectorAll('.vm-header-cta-btn span, .vm-mobile-drawer-bottom .vm-btn-primary span').forEach(el => {
      el.textContent = t.ctaBook;
    });

    // Update availability fallback if present
    const availText = header.querySelector('.vm-availability-text');
    if (availText && !availText.dataset.hasLiveSlots) {
      availText.textContent = t.defaultAvailability;
    }

    // Broadcast change to other blocks (Booking Form, Pain Map, Reels, etc.)
    window.dispatchEvent(new CustomEvent('vigour:language-changed', {
      detail: { lang, isMacedonia: lang === 'mk' }
    }));
  }

  function initVigourHeader() {
    const headers = document.querySelectorAll('.vm-header-wrapper');

    headers.forEach(header => {
      const hamburger = header.querySelector('.vm-hamburger-btn');
      const drawer = header.querySelector('.vm-mobile-drawer');
      const navLinks = header.querySelectorAll('.vm-nav-item, .vm-mobile-nav-item');
      const availabilityBadge = header.querySelector('.vm-header-availability');
      const apiBase = header.dataset.apiBase || '/apps/vigour';

      // Detect and apply initial language based on client location
      let currentLang = detectClientLanguage(header);
      applyLanguage(currentLang, header);

      // Language Switcher Click Event
      header.querySelectorAll('.vm-lang-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          const chosenLang = this.dataset.lang;
          if (chosenLang && (chosenLang === 'mk' || chosenLang === 'en')) {
            currentLang = chosenLang;
            localStorage.setItem('vm_language', chosenLang);
            applyLanguage(chosenLang, header);
          }
        });
      });

      // Sticky shadow on scroll
      function checkScroll() {
        if (window.scrollY > 20) {
          header.classList.add('scrolled');
        } else {
          header.classList.remove('scrolled');
        }
      }
      window.addEventListener('scroll', checkScroll, { passive: true });
      checkScroll();

      // Mobile Hamburger toggle
      if (hamburger && drawer) {
        hamburger.addEventListener('click', function() {
          const isOpen = drawer.classList.contains('open');
          if (isOpen) {
            drawer.classList.remove('open');
            hamburger.classList.remove('active');
            hamburger.setAttribute('aria-expanded', 'false');
          } else {
            drawer.classList.add('open');
            hamburger.classList.add('active');
            hamburger.setAttribute('aria-expanded', 'true');
          }
        });

        drawer.querySelectorAll('a').forEach(link => {
          link.addEventListener('click', () => {
            drawer.classList.remove('open');
            hamburger.classList.remove('active');
            hamburger.setAttribute('aria-expanded', 'false');
          });
        });
      }

      // Smooth scroll for anchors
      navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
          const href = this.getAttribute('href');
          if (href && href.startsWith('#') && href !== '#') {
            const targetEl = document.querySelector(href);
            if (targetEl) {
              e.preventDefault();
              targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

              navLinks.forEach(l => l.classList.remove('active'));
              this.classList.add('active');
            }
          }
        });
      });

      // Live availability fetch
      async function updateLiveAvailability() {
        if (!availabilityBadge) return;
        try {
          const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Skopje' }).format(new Date());
          const res = await fetch(`${apiBase}/bookings?date=${today}`, {
            headers: { Accept: 'application/json' }
          });
          if (res.ok) {
            const data = await res.json();
            const count = data.availableSlots ? data.availableSlots.length : 0;
            if (count > 0) {
              const textSpan = availabilityBadge.querySelector('.vm-availability-text');
              if (textSpan) {
                textSpan.dataset.hasLiveSlots = "true";
                const t = I18N[currentLang] || I18N.mk;
                textSpan.textContent = t.availability(count);
              }
            }
          }
        } catch (e) {}
      }

      updateLiveAvailability();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVigourHeader);
  } else {
    initVigourHeader();
  }
})();
