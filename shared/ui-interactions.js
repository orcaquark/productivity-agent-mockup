/*
 * Level 1 interaction polish.
 *
 * Keeps the mockups feeling like usable interfaces without introducing
 * application/business logic. This layer handles keyboard activation,
 * switch controls, Escape-to-close, and lightweight press feedback.
 */
(function (global) {
  'use strict';

  function activate(el, event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      el.click();
    }
  }

  function initKeyboard(root) {
    (root || document).querySelectorAll('[tabindex="0"]').forEach(function (el) {
      if (el.dataset.level1Keyboard === 'true') return;
      el.dataset.level1Keyboard = 'true';
      el.addEventListener('keydown', function (event) {
        activate(el, event);
      });
    });

    // Switches are the one control where arrow keys are also useful.
    (root || document).querySelectorAll('[role="switch"][tabindex="0"]').forEach(function (el) {
      if (el.dataset.level1Switch === 'true') return;
      el.dataset.level1Switch = 'true';
      el.addEventListener('keydown', function (event) {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
          event.preventDefault();
          if (el.getAttribute('aria-checked') === 'true') el.click();
        } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
          event.preventDefault();
          if (el.getAttribute('aria-checked') !== 'true') el.click();
        }
      });
    });
  }

  function closeOpenOverlays() {
    var overlays = document.querySelectorAll('.modal-overlay.open, .sheet-overlay[style*="display: flex"]');
    var closed = false;

    overlays.forEach(function (overlay) {
      // Prefer the mockup's existing close behavior so its own state stays
      // authoritative rather than manipulating classes directly.
      overlay.click();
      closed = true;
    });

    return closed;
  }

  function initPressFeedback(root) {
    (root || document).querySelectorAll('button, .btn, .cta, .chip.reply, .action-link, .kudos-btn, .miss-cta').forEach(function (el) {
      if (el.dataset.level1Press === 'true') return;
      el.dataset.level1Press = 'true';
      el.addEventListener('pointerdown', function () {
        if (!el.disabled) el.classList.add('is-pressed');
      });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (type) {
        el.addEventListener(type, function () { el.classList.remove('is-pressed'); });
      });
    });
  }

  function init() {
    initKeyboard(document);
    initPressFeedback(document);
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeOpenOverlays();
    });

    // Dynamic cards/dialog actions are injected after page load in several
    // mockups, so re-scan whenever the DOM changes.
    var observer = new MutationObserver(function () {
      initKeyboard(document);
      initPressFeedback(document);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.MockLevel1 = {
    initKeyboard: initKeyboard,
    closeOpenOverlays: closeOpenOverlays,
    initPressFeedback: initPressFeedback
  };
})(window);
