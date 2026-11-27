/**
 * Vigour Massage Studio — mobile bottom bar
 * - moves the bar into <body>: the theme wraps sections in an animated element, and
 *   an ancestor with a transform turns position: fixed into position: relative to it
 * - leaves room under the page so the bar never covers the footer
 */
(function () {
  'use strict';

  function init() {
    document.querySelectorAll('[data-vm-mobile-bar]').forEach((bar) => {
      // The theme editor re-renders the block; keep a single copy in <body>
      const id = bar.dataset.vmMobileBar;
      document.querySelectorAll(`body > [data-vm-mobile-bar="${CSS.escape(id)}"]`).forEach((old) => {
        if (old !== bar) old.remove();
      });
      if (bar.parentElement !== document.body) document.body.appendChild(bar);
      document.body.classList.add('vm-has-mobile-bar');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
