/**
 * Vigour Massage Studio — Interactive Body Pain Map
 * Handles zone selection, SVG highlighting, recommendations & GA4 dataLayer events
 */
(function() {
  'use strict';

  // The service the "Book for this area" button pre-selects. It is matched against the service names
  // in the booking calendar, so it is not translated.
  const SERVICE_BY_ZONE = {
    neck: 'Релакс масажа - Грб',
    shoulders: 'Спортска масажа - Грб',
    upper_back: 'Спортска масажа - Грб',
    lower_back: 'Релакс масажа - Грб',
    hips: 'Спортска масажа - Цело тело',
    legs: 'Спортска масажа - Цело тело',
    feet: 'Масажа на стапала'
  };

  function initPainMap() {
    const sections = document.querySelectorAll('.vm-painmap-section');

    sections.forEach(section => {
      const container = section.querySelector('.vm-bodymap-container');
      let ZONES_DATA = {}; // zone texts for the page language, loaded from assets/pain-zones-<lang>.json
      const zonesUrl = container ? container.dataset.zonesUrl : null;
      const svgUrl = container ? container.dataset.svgUrl : null;

      function setupSection() {
        const pills = section.querySelectorAll('.vm-zone-pill-btn');
        const svgZones = section.querySelectorAll('.vm-svg-zone, .vm-svg-pin');
      
      const zoneTagEl = section.querySelector('.vm-zone-tag-text');
      const zoneNameEl = section.querySelector('.vm-zone-name');
      const zoneCausesEl = section.querySelector('.vm-zone-causes-text');
      const recTitleEl = section.querySelector('.vm-rec-card-title');
      const recDescEl = section.querySelector('.vm-rec-card-desc');
      const recDurationEl = section.querySelector('.vm-rec-duration-text');
      const recPriceEl = section.querySelector('.vm-rec-price-text');
      const recBtn = section.querySelector('.vm-rec-book-btn');
      const exTitleEl = section.querySelector('.vm-exercise-rec-title');
      const exSubEl = section.querySelector('.vm-exercise-rec-sub');

      let currentZone = 'neck';

      function updateZone(zoneKey) {
        if (!ZONES_DATA[zoneKey]) return;
        currentZone = zoneKey;
        const data = ZONES_DATA[zoneKey];
        const servicePreselect = SERVICE_BY_ZONE[zoneKey];

        // GA4 / Retargeting dataLayer event
        if (typeof window !== 'undefined') {
          window.dataLayer = window.dataLayer || [];
          window.dataLayer.push({
            event: 'pain_zone_click',
            pain_zone_key: zoneKey,
            pain_zone_name: data.name,
            recommended_treatment: data.treatmentTitle
          });
        }

        // Update pills UI
        pills.forEach(p => {
          if (p.dataset.zone === zoneKey) {
            p.classList.add('active');
          } else {
            p.classList.remove('active');
          }
        });

        // Update SVG zones UI
        svgZones.forEach(z => {
          if (z.dataset.zone === zoneKey) {
            z.classList.add('active');
          } else {
            z.classList.remove('active');
          }
        });

        // Update content panel
        if (zoneTagEl) zoneTagEl.textContent = data.tag;
        if (zoneNameEl) zoneNameEl.textContent = data.name;
        if (zoneCausesEl) zoneCausesEl.textContent = data.causes;
        if (recTitleEl) recTitleEl.textContent = data.treatmentTitle;
        if (recDescEl) recDescEl.textContent = data.treatmentDesc;
        if (recDurationEl) recDurationEl.textContent = data.duration;
        if (recPriceEl) recPriceEl.textContent = data.price;
        if (exTitleEl) exTitleEl.textContent = data.exerciseTitle;
        if (exSubEl) exSubEl.textContent = data.exerciseSub;

        if (recBtn) {
          recBtn.dataset.serviceName = servicePreselect;
          recBtn.href = `#najdo-booking-container?service=${encodeURIComponent(servicePreselect)}&zone=${encodeURIComponent(zoneKey)}`;
        }
      }

      // Pill click
      pills.forEach(pill => {
        pill.addEventListener('click', function() {
          const zoneKey = this.dataset.zone;
          updateZone(zoneKey);
        });
      });

      // SVG Zone click
      svgZones.forEach(zone => {
        zone.addEventListener('click', function() {
          const zoneKey = this.dataset.zone;
          updateZone(zoneKey);
        });
      });

      // Handle Book CTA click from pain map
      if (recBtn) {
        recBtn.addEventListener('click', function(e) {
          const serviceName = this.dataset.serviceName;
          const target = this.getAttribute('href').split('?')[0];

          window.dispatchEvent(new CustomEvent('vigour:select-service', {
            detail: {
              serviceName: serviceName,
              zone: currentZone
            }
          }));

          if (target && target.startsWith('#')) {
            const bookingWidget = document.querySelector(target);
            if (bookingWidget) {
              e.preventDefault();
              bookingWidget.scrollIntoView({ behavior: 'smooth', block: 'start' });

              setTimeout(() => {
                const selectEl = bookingWidget.querySelector('select[name="serviceId"]');
                if (selectEl) {
                  for (let i = 0; i < selectEl.options.length; i++) {
                    if (selectEl.options[i].text.toLowerCase().includes(serviceName.toLowerCase())) {
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
      }

      // Initialize with default zone
      updateZone('neck');
    }

    const loadSvg = (svgUrl && container && !container.querySelector('.vm-body-svg'))
      ? fetch(svgUrl)
        .then(res => res.text())
        .then(svgText => {
          container.insertAdjacentHTML('afterbegin', svgText);
          const svgEl = container.querySelector('.vm-body-svg');
          if (svgEl && container.dataset.svgLabel) svgEl.setAttribute('aria-label', container.dataset.svgLabel);
        })
        .catch(() => {})
      : Promise.resolve();

    const loadZones = zonesUrl
      ? fetch(zonesUrl)
        .then(res => res.json())
        .then(data => { ZONES_DATA = data; })
        .catch(() => {})
      : Promise.resolve();

    Promise.all([loadSvg, loadZones]).then(setupSection);
  });
}

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPainMap);
  } else {
    initPainMap();
  }
})();
