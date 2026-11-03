/**
 * Vigour Massage Studio — Services Grid JavaScript
 * Category filter tabs & service pre-selection in booking form
 */
(function() {
  'use strict';

  function initServicesGrid() {
    const sections = document.querySelectorAll('.vm-services-section');

    sections.forEach(section => {
      const tabs = section.querySelectorAll('.vm-tab-btn');
      const cards = section.querySelectorAll('.vm-service-card');

      // Category tab filtering
      tabs.forEach(tab => {
        tab.addEventListener('click', function() {
          const category = this.dataset.category;

          tabs.forEach(t => t.classList.remove('active'));
          this.classList.add('active');

          cards.forEach(card => {
            const cardCat = card.dataset.category;
            if (category === 'all' || cardCat === category) {
              card.style.display = 'flex';
              card.style.animation = 'vm-card-fade 0.35s ease forwards';
            } else {
              card.style.display = 'none';
            }
          });
        });
      });

      // Handle Reserve button click
      const bookButtons = section.querySelectorAll('.vm-book-service-btn');
      bookButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
          const serviceName = this.dataset.serviceName;
          const serviceId = this.dataset.serviceId;
          const bookingTarget = this.getAttribute('href');

          // Dispatch event for any active booking widgets
          window.dispatchEvent(new CustomEvent('vigour:select-service', {
            detail: {
              serviceName: serviceName,
              serviceId: serviceId
            }
          }));

          // Check if target is an in-page anchor
          if (bookingTarget && bookingTarget.startsWith('#')) {
            const bookingWidget = document.querySelector(bookingTarget);
            if (bookingWidget) {
              e.preventDefault();
              bookingWidget.scrollIntoView({ behavior: 'smooth', block: 'start' });

              // Attempt to select service in select dropdown
              setTimeout(() => {
                const selectEl = bookingWidget.querySelector('select[name="serviceId"]');
                if (selectEl) {
                  for (let i = 0; i < selectEl.options.length; i++) {
                    const optText = selectEl.options[i].text.toLowerCase();
                    if (optText.includes(serviceName.toLowerCase()) || 
                       (serviceId && selectEl.options[i].value === serviceId)) {
                      selectEl.selectedIndex = i;
                      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
                      break;
                    }
                  }
                }
              }, 400);
            }
          }
        });
      });
    });
  }

  // Simple keyframe injection for smooth tab transition
  const style = document.createElement('style');
  style.textContent = `
    @keyframes vm-card-fade {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initServicesGrid);
  } else {
    initServicesGrid();
  }
})();
