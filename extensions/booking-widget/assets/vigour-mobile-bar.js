/**
 * Vigour Massage Studio — mobile bottom bar
 * - moves the bar into <body>: the theme wraps sections in an animated element, and
 *   an ancestor with a transform turns position: fixed into position: relative to it
 * - leaves room under the page so the bar never covers the footer
 * - follows the MK / EN switch in the header
 */
(function () {
  'use strict';

  const BOOK_EN = 'Book a session';

  function savedLanguage() {
    try {
      if (localStorage.getItem('vm_language') === 'en') return 'en';
    } catch (e) {}
    return 'mk';
  }

  function init() {
    document.querySelectorAll('[data-vm-mobile-bar]').forEach((bar) => {
      // The theme editor re-renders the block; keep a single copy in <body>
      const id = bar.dataset.vmMobileBar;
      document.querySelectorAll(`body > [data-vm-mobile-bar="${CSS.escape(id)}"]`).forEach((old) => {
        if (old !== bar) old.remove();
      });
      if (bar.parentElement !== document.body) document.body.appendChild(bar);
      document.body.classList.add('vm-has-mobile-bar');

      const book = bar.querySelector('[data-vm-t="book"]');
      const bookDefault = book ? book.textContent : '';

      // "Viber" is the same in both languages
      function apply(lang) {
        if (book) book.textContent = lang === 'en' ? BOOK_EN : bookDefault;
      }

      apply(savedLanguage());
      window.addEventListener('vigour:language-changed', (e) => apply(e.detail && e.detail.lang === 'en' ? 'en' : 'mk'));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
