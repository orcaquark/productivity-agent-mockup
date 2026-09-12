/**
 * mockup-shared.js
 *
 * Utilities shared across every Kindred personalization mockup (desktop,
 * mobile, and the digest/swiping/texting alternatives). Previously each
 * mockup's own script reimplemented keyboard support, theme handling, the
 * radial gauge, and the "why am I seeing this" disclosure. This file is the
 * single source of truth for those, plus four capabilities none of the
 * mockups had: persisted state, an accessible live-region announcer,
 * simulated async/optimistic actions, and cross-iframe sync.
 *
 * Include this BEFORE a mockup's own script:
 *   <script src="../shared/mockup-shared.js"></script>
 *   <script src="scripts/your_mockup.js"></script>
 *
 * Everything is namespaced under window.MockShared so existing globals
 * (e.g. a mockup's own `toggleWhy`) aren't clobbered — call
 * MockShared.toggleWhy(...) from the mockup script, or alias it locally.
 */
(function (global) {
  'use strict';

  // ---------------------------------------------------------------------
  // State persistence — namespaced localStorage, JSON in/out.
  // Use this so a mockup's interaction state survives a reload instead of
  // resetting every time, which is what happens today.
  // ---------------------------------------------------------------------
  var STORAGE_PREFIX = 'kindred-mock:';

  var MockState = {
    save: function (key, value) {
      try {
        global.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
      } catch (e) {
        // Storage unavailable (private browsing, quota, etc.) — the mockup
        // still works, it just won't remember state across reloads.
      }
    },
    load: function (key, fallback) {
      try {
        var raw = global.localStorage.getItem(STORAGE_PREFIX + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    clear: function (key) {
      try { global.localStorage.removeItem(STORAGE_PREFIX + key); } catch (e) {}
    }
  };

  // ---------------------------------------------------------------------
  // Keyboard support for div-as-button interactive elements.
  // Identical to what each mockup already inlined.
  // ---------------------------------------------------------------------
  function bindKeyboard(el) {
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        el.click();
      }
    });
  }
  function initKeyboardSupport(root) {
    (root || document).querySelectorAll('[tabindex="0"]').forEach(function (el) {
      if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
      bindKeyboard(el);
    });
  }

  // ---------------------------------------------------------------------
  // Theme: light / dark / system, one source of truth.
  // Reads/writes the same #app-shell / #theme-toggle-icon / [data-theme]
  // structure every desktop mockup already uses. Pass a storageKey to
  // persist the choice; omit it to keep today's in-memory-only behavior.
  // ---------------------------------------------------------------------
  function createThemeController(opts) {
    opts = opts || {};
    var shellId = opts.shellId || 'app-shell';
    var iconId = opts.iconId || 'theme-toggle-icon';
    var storageKey = opts.storageKey || null;
    var onChange = opts.onChange;

    var mode = (storageKey && MockState.load(storageKey, null)) || opts.defaultMode || 'light';

    function systemPrefersDark() {
      return global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    function effectiveTheme() {
      return mode === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : mode;
    }
    function apply() {
      var dark = effectiveTheme() === 'dark';
      var shell = document.getElementById(shellId);
      if (shell) shell.classList.toggle('dark-mode', dark);
      var icon = document.getElementById(iconId);
      if (icon) icon.setAttribute('href', dark ? '#ic-sun' : '#ic-moon');
      document.querySelectorAll('[data-theme]').forEach(function (seg) {
        seg.classList.toggle('active', seg.getAttribute('data-theme') === mode);
      });
      if (storageKey) MockState.save(storageKey, mode);
      if (typeof onChange === 'function') onChange(dark);
    }
    function setTheme(next) { mode = next; apply(); }
    function quickToggle() { setTheme(effectiveTheme() === 'dark' ? 'light' : 'dark'); }

    apply();
    return { setTheme: setTheme, quickToggle: quickToggle, effectiveTheme: effectiveTheme, apply: apply };
  }

  // ---------------------------------------------------------------------
  // Radial gauge fill (the completion-ring SVG on the feed mockups).
  // ---------------------------------------------------------------------
  function setGauge(elId, pct, radius) {
    var el = document.getElementById(elId || 'gauge-fill');
    if (!el) return;
    var c = 2 * Math.PI * (radius || 53);
    el.style.strokeDasharray = c.toFixed(1);
    el.style.strokeDashoffset = (c * (1 - pct / 100)).toFixed(1);
  }

  // ---------------------------------------------------------------------
  // "Why am I seeing this" disclosure. Parameterized because the deck
  // mockup uses different ids (nudge-why-panel / nudge-why-btn) than the
  // feed mockups (why-panel / why-btn) — defaults match the common case.
  // ---------------------------------------------------------------------
  function toggleWhy(panelId, btnId) {
    var panel = document.getElementById(panelId || 'why-panel');
    var btn = document.getElementById(btnId || 'why-btn');
    if (!panel) return;
    var open = panel.classList.toggle('open');
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  // ---------------------------------------------------------------------
  // Accessible live-region announcer. The confirmation toasts (e.g.
  // "Moved to 8:40am") are currently sighted-only — they're painted via
  // innerHTML with no aria-live wrapper, so screen reader users never hear
  // the outcome of their action. announce() speaks it independently of
  // whatever DOM the toast itself uses.
  // ---------------------------------------------------------------------
  var liveRegion = null;
  function getLiveRegion() {
    if (liveRegion && document.body.contains(liveRegion)) return liveRegion;
    liveRegion = document.createElement('div');
    liveRegion.id = 'mock-live-region';
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('role', 'status');
    // Visually hidden, not display:none — display:none is stripped from
    // the accessibility tree and would never be announced.
    liveRegion.style.position = 'absolute';
    liveRegion.style.width = '1px';
    liveRegion.style.height = '1px';
    liveRegion.style.overflow = 'hidden';
    liveRegion.style.clip = 'rect(0 0 0 0)';
    liveRegion.style.whiteSpace = 'nowrap';
    document.body.appendChild(liveRegion);
    return liveRegion;
  }
  function announce(message) {
    var region = getLiveRegion();
    // Clear first so two identical messages in a row (e.g. resolve, undo,
    // resolve again) are both announced — most screen readers only speak
    // an aria-live region on a text *change*.
    region.textContent = '';
    global.setTimeout(function () { region.textContent = message; }, 30);
  }

  // ---------------------------------------------------------------------
  // Simulated async / optimistic UI. Wraps an instant DOM mutation in a
  // fake network delay so a demo shows a pending state before the
  // confirmation lands — closer to how the real Go/Huma backend behaves
  // than the current zero-latency resolve*() calls.
  // ---------------------------------------------------------------------
  function simulateRequest(action, opts) {
    opts = opts || {};
    var delay = opts.delay != null ? opts.delay : 400;
    if (typeof opts.onPending === 'function') opts.onPending();
    return new Promise(function (resolve) {
      global.setTimeout(function () {
        var result = action();
        if (typeof opts.onSuccess === 'function') opts.onSuccess(result);
        resolve(result);
      }, delay);
    });
  }

  // ---------------------------------------------------------------------
  // Cross-mockup sync via postMessage. A mockup running inside the design
  // viewer's iframe can broadcast a state change (theme, onboarding
  // finished, a card resolved) up to the parent; the parent — main.js in
  // the viewer, or another mockup in compare mode — can relay it onward or
  // react to it. All messages are tagged with SYNC_CHANNEL so mockups can
  // safely ignore messages meant for something else on the page.
  // ---------------------------------------------------------------------
  var SYNC_CHANNEL = 'kindred-mock-sync';
  var MockSync = {
    broadcast: function (type, payload) {
      var message = { channel: SYNC_CHANNEL, type: type, payload: payload };
      if (global.parent && global.parent !== global) {
        global.parent.postMessage(message, '*');
      }
    },
    // Send into a specific iframe (used by the viewer to relay a message
    // from pane A into pane B during compare mode).
    sendTo: function (targetWindow, type, payload) {
      if (!targetWindow) return;
      targetWindow.postMessage({ channel: SYNC_CHANNEL, type: type, payload: payload }, '*');
    },
    listen: function (type, handler) {
      global.addEventListener('message', function (event) {
        var data = event.data;
        if (!data || data.channel !== SYNC_CHANNEL) return;
        if (type && data.type !== type) return;
        handler(data.payload, data.type);
      });
    }
  };

  global.MockShared = {
    MockState: MockState,
    initKeyboardSupport: initKeyboardSupport,
    bindKeyboard: bindKeyboard,
    createThemeController: createThemeController,
    setGauge: setGauge,
    toggleWhy: toggleWhy,
    announce: announce,
    simulateRequest: simulateRequest,
    MockSync: MockSync
  };

})(window);