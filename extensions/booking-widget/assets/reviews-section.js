/**
 * Vigour Massage Studio — Reviews Carousel JavaScript
 */
(function() {
  'use strict';

  // "Go to slide [number]", written by the block (reviews_section.liquid) in the language of the page
  function readGoToSlide(section) {
    const el = document.getElementById('vm-reviews-i18n-' + section.dataset.blockId);
    try {
      return JSON.parse(el.textContent).goToSlide;
    } catch (e) {
      return '[number]';
    }
  }

  function initReviewsCarousel() {
    const sections = document.querySelectorAll('.vm-reviews-section');

    sections.forEach(section => {
      const track = section.querySelector('.vm-reviews-track');
      const cards = section.querySelectorAll('.vm-review-card');
      const prevBtn = section.querySelector('.vm-carousel-prev');
      const nextBtn = section.querySelector('.vm-carousel-next');
      const dotsContainer = section.querySelector('.vm-carousel-dots');
      const goToSlide = readGoToSlide(section);

      if (!track || cards.length === 0) return;

      let currentIndex = 0;
      let autoPlayInterval = null;

      function getVisibleCardsCount() {
        if (window.innerWidth <= 640) return 1;
        if (window.innerWidth <= 992) return 2;
        return 3;
      }

      function getMaxIndex() {
        const visible = getVisibleCardsCount();
        return Math.max(0, cards.length - visible);
      }

      function updateDots() {
        if (!dotsContainer) return;
        const max = getMaxIndex();
        dotsContainer.innerHTML = '';
        for (let i = 0; i <= max; i++) {
          const dot = document.createElement('button');
          dot.className = `vm-carousel-dot ${i === currentIndex ? 'active' : ''}`;
          dot.setAttribute('aria-label', goToSlide.replace('[number]', i + 1));
          dot.addEventListener('click', () => {
            currentIndex = i;
            updateCarousel();
            resetAutoPlay();
          });
          dotsContainer.appendChild(dot);
        }
      }

      function updateCarousel() {
        const max = getMaxIndex();
        if (currentIndex > max) currentIndex = max;
        if (currentIndex < 0) currentIndex = 0;

        const cardWidth = cards[0].offsetWidth;
        const gap = 28;
        const offset = currentIndex * (cardWidth + gap);

        track.style.transform = `translateX(-${offset}px)`;

        // Update active dot
        const dots = dotsContainer ? dotsContainer.querySelectorAll('.vm-carousel-dot') : [];
        dots.forEach((dot, idx) => {
          if (idx === currentIndex) dot.classList.add('active');
          else dot.classList.remove('active');
        });
      }

      function nextSlide() {
        const max = getMaxIndex();
        if (currentIndex >= max) {
          currentIndex = 0;
        } else {
          currentIndex++;
        }
        updateCarousel();
      }

      function prevSlide() {
        const max = getMaxIndex();
        if (currentIndex <= 0) {
          currentIndex = max;
        } else {
          currentIndex--;
        }
        updateCarousel();
      }

      if (nextBtn) {
        nextBtn.addEventListener('click', () => {
          nextSlide();
          resetAutoPlay();
        });
      }

      if (prevBtn) {
        prevBtn.addEventListener('click', () => {
          prevSlide();
          resetAutoPlay();
        });
      }

      function startAutoPlay() {
        autoPlayInterval = setInterval(nextSlide, 5000);
      }

      function stopAutoPlay() {
        if (autoPlayInterval) clearInterval(autoPlayInterval);
      }

      function resetAutoPlay() {
        stopAutoPlay();
        startAutoPlay();
      }

      section.addEventListener('mouseenter', stopAutoPlay);
      section.addEventListener('mouseleave', startAutoPlay);

      window.addEventListener('resize', () => {
        updateDots();
        updateCarousel();
      });

      updateDots();
      updateCarousel();
      startAutoPlay();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReviewsCarousel);
  } else {
    initReviewsCarousel();
  }
})();
