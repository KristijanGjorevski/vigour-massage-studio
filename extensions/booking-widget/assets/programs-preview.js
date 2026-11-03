/**
 * Vigour Massage Studio — Programs Preview & Video Modal JavaScript
 */
(function() {
  'use strict';

  function initProgramsPreview() {
    const sections = document.querySelectorAll('.vm-programs-section');

    sections.forEach(section => {
      const modal = section.querySelector('.vm-video-modal');
      const modalContent = section.querySelector('.vm-video-modal-content');
      const closeBtn = section.querySelector('.vm-video-modal-close');
      const iframe = section.querySelector('.vm-video-iframe');
      const playTriggers = section.querySelectorAll('.vm-open-video-btn');

      if (!modal || !iframe) return;

      function openModal(videoId) {
        iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`;
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
      }

      function closeModal() {
        modal.classList.remove('active');
        iframe.src = '';
        document.body.style.overflow = '';
      }

      playTriggers.forEach(trigger => {
        trigger.addEventListener('click', function(e) {
          e.preventDefault();
          const videoId = this.dataset.videoId || 'dQw4w9WgXcQ';
          openModal(videoId);
        });
      });

      if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
      }

      modal.addEventListener('click', function(e) {
        if (e.target === modal) {
          closeModal();
        }
      });

      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
          closeModal();
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProgramsPreview);
  } else {
    initProgramsPreview();
  }
})();
