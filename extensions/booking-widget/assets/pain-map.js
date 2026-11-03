/**
 * Vigour Massage Studio — Interactive Body Pain Map
 * Handles zone selection, SVG highlighting, recommendations & GA4 dataLayer events
 */
(function() {
  'use strict';

  const ZONES_DATA = {
    neck: {
      name: 'Врат и глава',
      tag: 'Најчеста канцелариска тензија',
      causes: 'Долго седење пред монитор, неправилна положба на спиење, психолошки стрес и акумулирана напнатост во горниот трапез.',
      treatmentTitle: 'Релакс или Терапевтска Масажа за Врат',
      treatmentDesc: 'Фокусирано ослободување на спазмите во цервикалниот дел, рамената и базата на черепот за моментално олеснување од главоболки и вкочанетост.',
      duration: '45 мин',
      price: '800 - 1.000 ден.',
      servicePreselect: 'Релакс масажа - Грб',
      exerciseTitle: '2-минутно истегнување на врат',
      exerciseSub: 'Вежби за мобилност и декомпресија на трапез'
    },
    shoulders: {
      name: 'Рамена и трапез',
      tag: 'Мускулен спазам & носење товар',
      causes: 'Подигнати рамена при работа на компјутер, носење тежок ранец или торба на едно рамо, хронично мускулно затегање.',
      treatmentTitle: 'Спортска Масажа за Грб и Рамена',
      treatmentDesc: 'Длабока мускулна обработка на скапуларната регија, ослободување на тригер точки и враќање на полниот опсег на движење.',
      duration: '45 мин',
      price: '1.000 ден.',
      servicePreselect: 'Спортска масажа - Грб',
      exerciseTitle: 'Кругови со рамена & лопатки',
      exerciseSub: 'Отворање на граден кош и декомпресија'
    },
    upper_back: {
      name: 'Горен грб и лопатки',
      tag: 'Кифотично држење & седење',
      causes: 'Повиткано држење на телото (наведнат грб), прекумерно истегнати паравертебрални мускули и напор од долго возење или пишување.',
      treatmentTitle: 'Длабоко-ткивна Масажа на Грб',
      treatmentDesc: 'Интензивно таргетирање на мускулните слоеви меѓу лопатките, забрзување на циркулацијата и исправување на постурата.',
      duration: '45 - 60 мин',
      price: '1.000 - 1.300 ден.',
      servicePreselect: 'Спортска масажа - Грб',
      exerciseTitle: 'Y-T-W вежби за грб',
      exerciseSub: 'Активација на ромбоидните мускули'
    },
    lower_back: {
      name: 'Долен грб (Лумбален дел)',
      tag: 'Хроничен замор & седечки начин',
      causes: 'Неактивен абдоминален труп, затегнати мускули на колковите, долго статично седење на стол и неправилно кревање тежина.',
      treatmentTitle: 'Терапевтска Релакс Масажа за Грб',
      treatmentDesc: 'Намалување на притисокот во долниот ' + "'рбет, опуштање на лумбалната фасција и ослободување на длабоките мускули.",
      duration: '45 - 60 мин',
      price: '800 - 1.300 ден.',
      servicePreselect: 'Релакс масажа - Грб',
      exerciseTitle: 'Мачка-крава & Детска поза',
      exerciseSub: 'Декомпресија на лумбален ' + "'рбет"
    },
    hips: {
      name: 'Колк и седало (Глутеус)',
      tag: 'Ишијасна болка & стегнатост',
      causes: 'Скратени флексори на колк од седење, иритација на пириформис мускулот што може да предизвика болка кон ногата (псевдо-ишијас).',
      treatmentTitle: 'Спортска Масажа за Долно Тело',
      treatmentDesc: 'Терапевтска мобилизација на глутеалната мускулатура и пелвичниот појас со специјализирани техники за истегнување.',
      duration: '60 мин',
      price: '1.500 ден.',
      servicePreselect: 'Спортска масажа - Цело тело',
      exerciseTitle: 'Пириформис истегнување на стол',
      exerciseSub: 'Отворање на карлицата и колковите'
    },
    legs: {
      name: 'Колена и нозе',
      tag: 'Спортско оптоварување & тренинг',
      causes: 'Интензивно трчање или фитнес, преоптоварени квадрицепси и задна ложа, акумулација на млечна киселина и замор.',
      treatmentTitle: 'Спортска Масажа за Цело Тело',
      treatmentDesc: 'Интензивно дренирање на нозете, ослободување на тетивата и мускулната обвивка за брзо мускулно регенерирање.',
      duration: '60 мин',
      price: '1.500 ден.',
      servicePreselect: 'Спортска масажа - Цело тело',
      exerciseTitle: 'Истегнување на квадрицепс & листови',
      exerciseSub: 'Подобра циркулација и флексибилност'
    },
    feet: {
      name: 'Стапала (Рефлексологија)',
      tag: 'Долго стоење & тешки нозе',
      causes: 'Долго стоење на работа, неудобни чевли, спуштен свод на стапалото и напнатост во плантарната фасција.',
      treatmentTitle: 'Масажа на Стапала (Рефлексологија)',
      treatmentDesc: 'Стимулација на акупресурните рефлексни точки на стапалото што го олеснува чекорот и носи баланс на целиот организам.',
      duration: '45 мин',
      price: '500 ден.',
      servicePreselect: 'Масажа на стапала',
      exerciseTitle: 'Тркалање тениско топче со стапало',
      exerciseSub: 'Опуштање на плантарната фасција'
    }
  };

  function initPainMap() {
    const sections = document.querySelectorAll('.vm-painmap-section');

    sections.forEach(section => {
      const container = section.querySelector('.vm-bodymap-container');
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
          recBtn.dataset.serviceName = data.servicePreselect;
          recBtn.href = `#najdo-booking-container?service=${encodeURIComponent(data.servicePreselect)}&zone=${encodeURIComponent(zoneKey)}`;
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

    if (svgUrl && container && !container.querySelector('.vm-body-svg')) {
      fetch(svgUrl)
        .then(res => res.text())
        .then(svgText => {
          container.insertAdjacentHTML('afterbegin', svgText);
          setupSection();
        })
        .catch(() => setupSection());
    } else {
      setupSection();
    }
  });
}

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPainMap);
  } else {
    initPainMap();
  }
})();
