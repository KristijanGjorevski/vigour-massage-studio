/**
 * Vigour Massage Studio — Video Reels JavaScript
 */
(function() {
  'use strict';

  function initVideoReels() {
    const sections = document.querySelectorAll('.vm-reels-section');

    sections.forEach(section => {
      const modal = section.querySelector('.vm-video-modal');
      const iframe = section.querySelector('.vm-video-iframe');
      const closeBtn = section.querySelector('.vm-video-modal-close');
      const cards = section.querySelectorAll('.vm-reel-card');

      if (!modal || !iframe) return;

      function openReel(videoId) {
        iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`;
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
      }

      function closeReel() {
        modal.classList.remove('active');
        iframe.src = '';
        document.body.style.overflow = '';
      }

      cards.forEach(card => {
        card.addEventListener('click', function() {
          const videoId = this.dataset.videoId || 'dQw4w9WgXcQ';
          openReel(videoId);
        });
      });

      if (closeBtn) closeBtn.addEventListener('click', closeReel);

      modal.addEventListener('click', function(e) {
        if (e.target === modal) closeReel();
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVideoReels);
  } else {
    initVideoReels();
  }
})();
