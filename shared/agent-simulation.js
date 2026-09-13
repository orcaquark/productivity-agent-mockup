/**
 * agent-simulation.js
 *
 * Level 3 (agent simulation) for the Kindred personalization mockups.
 *
 * A single shared "agent" that every interface (desktop, mobile, digest,
 * swiping, texting) reads from and writes to via MockShared.SharedState.
 * That's what makes this a *shared* layer instead of five copies of the
 * same behavior:
 *
 *   User acts on a nudge, a missed task, or a kudos card in ANY mockup
 *     -> AgentSimulation.recordAction() updates one counter set
 *     -> SharedState persists it to localStorage
 *     -> getRecommendation() derives a message from those counters
 *     -> the next screen the user opens (any mockup) shows that message
 *
 * This is a simulation, not a model or a backend: the agent's
 * "reasoning" is four hard-coded thresholds over four counters. What
 * makes it read as agentic is that those counters are shared and
 * persistent, and that they drive both the nudge copy and the "why"
 * explanation — not that anything is actually being learned.
 *
 * Include this AFTER mockup-shared.js and ui-interactions.js, and
 * BEFORE a mockup's own script:
 *   <script src="../shared/mockup-shared.js"></script>
 *   <script src="../shared/ui-interactions.js"></script>
 *   <script src="../shared/agent-simulation.js"></script>
 *   <script src="scripts/your_mockup.js"></script>
 */
(function (global) {
  'use strict';

  var SharedState = global.MockShared && global.MockShared.SharedState;

  var AGENT_STATE_KEY = 'agent-simulation';

  var defaults = {
    actions: 0,
    completedTasks: 0,
    dismissedNudges: 0,
    acceptedNudges: 0,
    kudosSent: 0
  };

  // Never hand out the `defaults` object itself as a fallback — SharedState
  // returns the fallback by reference when nothing is saved yet, and the
  // first increment() would then mutate `defaults` in place, corrupting
  // future reset() calls. Always fall back to a fresh clone.
  function cloneDefaults() {
    return JSON.parse(JSON.stringify(defaults));
  }

  function load() {
    return SharedState.get(AGENT_STATE_KEY, cloneDefaults());
  }

  function persist(state) {
    SharedState.update(AGENT_STATE_KEY, state);
  }

  // ---------------------------------------------------------------------
  // Lightweight pub-sub so other shared modules (agent-personalization.js)
  // can observe every recorded action — including its metadata — without
  // agent-simulation.js needing to know they exist. Level 3 works fine
  // with zero listeners; Level 4 subscribes to build a learned profile
  // from the same event stream instead of duplicating the click wiring.
  // ---------------------------------------------------------------------
  var actionListeners = [];

  function onAction(listener) {
    if (typeof listener === 'function') actionListeners.push(listener);
  }

  function notifyListeners(type, meta) {
    for (var i = 0; i < actionListeners.length; i++) {
      try {
        actionListeners[i](type, meta || {});
      } catch (e) {
        /* a listener failing shouldn't break the simulation layer */
      }
    }
  }

  function increment(field) {
    var state = load();
    state[field] = Math.max(0, (state[field] || 0) + 1);
    state.actions = (state.actions || 0) + 1;
    persist(state);
    return state;
  }

  // ---------------------------------------------------------------------
  // The agent's "reasoning": four hard-coded rules over the shared
  // counters, checked in priority order. This is the only place that
  // decides what the agent says.
  // ---------------------------------------------------------------------
  function getRecommendation() {
    var state = load();

    if (state.dismissedNudges >= 2 && state.acceptedNudges === 0) {
      return {
        title: 'I\u2019ll ease up',
        body: 'You\u2019ve dismissed a few nudges. I\u2019ll be more selective about when I interrupt you.'
      };
    }

    if (state.acceptedNudges >= 2) {
      return {
        title: 'Your schedule is working',
        body: 'You\u2019ve been acting on my timing suggestions. I\u2019ll keep prioritizing schedule adjustments like this.'
      };
    }

    if (state.completedTasks >= 2) {
      return {
        title: 'You\u2019re building momentum',
        body: 'You\u2019ve cleared what was sitting missed. I\u2019ll prioritize keeping your next actions small and actionable.'
      };
    }

    return {
      title: 'One thing at a time',
      body: 'I\u2019ll learn from what you act on and use that to make future suggestions more useful.',
      isDefault: true
    };
  }

  // ---------------------------------------------------------------------
  // Indirection the UI-writing functions below call instead of
  // getRecommendation() directly. If agent-personalization.js is loaded
  // and has learned something specific enough to say, its recommendation
  // wins; otherwise this falls back to the plain Level 3 reasoning above.
  // Keeping this check in one place means Level 3 keeps working
  // standalone (nothing here breaks if agent-personalization.js is never
  // included), and Level 4 only has to implement getRecommendation() on
  // its own object to take over.
  // ---------------------------------------------------------------------
  function resolveRecommendation() {
    var personalization = global.AgentPersonalization;
    if (personalization && typeof personalization.getRecommendation === 'function') {
      var learned = personalization.getRecommendation();
      if (learned) return learned;
    }
    return getRecommendation();
  }

  function escapeHTML(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ---------------------------------------------------------------------
  // Which element represents "the screen" for this mockup. The toast is
  // appended inside it (not document.body) so it's clipped to, and reads
  // as part of, the actual device/window mockup rather than floating in
  // the browser chrome around it. Both containers are position:relative
  // with overflow:hidden, so an absolutely-positioned child is contained
  // correctly and — for desktop — still inherits #app-shell's dark-mode
  // variables, which body-level placement never could.
  // ---------------------------------------------------------------------
  function getScreenContainer() {
    return document.getElementById('app-shell') || document.querySelector('.phone') || document.body;
  }

  // ---------------------------------------------------------------------
  // Toast, styled like an actual push notification (icon + app name +
  // timestamp row, bold title, body) rather than a generic snackbar.
  // Placement follows the container: a banner dropping in below the
  // notch on the phone mockups, a corner card sliding in top-right on
  // desktop (matching where each platform actually shows notifications).
  // ---------------------------------------------------------------------
  function createAgentToast() {
    var existing = document.getElementById('agent-simulation-toast');
    if (existing) existing.remove();

    var recommendation = resolveRecommendation();
    var container = getScreenContainer();
    var variant =
      container.id === 'app-shell' ? 'corner' :
      container.classList && container.classList.contains('phone') ? 'banner' :
      'fallback';

    var toast = document.createElement('div');
    toast.id = 'agent-simulation-toast';
    toast.className = 'agent-toast agent-toast--' + variant;
    toast.setAttribute('role', 'status');
    toast.innerHTML =
      '<div class="agent-toast-head">' +
        '<span class="agent-toast-icon">\u2726</span>' +
        '<span class="agent-toast-app">Kindred</span>' +
        '<span class="agent-toast-time">now</span>' +
      '</div>' +
      '<div class="agent-toast-title">' + escapeHTML(recommendation.title) + '</div>' +
      '<div class="agent-toast-body">' + escapeHTML(recommendation.body) + '</div>';

    container.appendChild(toast);

    requestAnimationFrame(function () {
      toast.classList.add('show');
    });

    global.setTimeout(function () {
      toast.classList.remove('show');
      global.setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 280);
    }, 4200);
  }

  // ---------------------------------------------------------------------
  // Pushes the current recommendation into the nudge's description.
  // Desktop, mobile, digest, and texting ship this text as static markup
  // (`id="nudge-desc"` on the .desc/.nudge-sub element); the swiping deck
  // builds the same markup in JS with the same id. One function updates
  // all five without per-mockup rendering code.
  //
  // The cold-start recommendation (isDefault: true) is intentionally left
  // in place rather than overwriting the shipped copy — "You complete
  // reading tasks 3x more often..." is a real, specific insight, and
  // "I'll learn from what you act on" is a weaker thing to show someone
  // who hasn't done anything yet. The copy only changes once the agent
  // has an actual pattern to report.
  // ---------------------------------------------------------------------
  function applyNudgeCopy() {
    var recommendation = resolveRecommendation();
    if (recommendation.isDefault) return;

    var el = document.getElementById('nudge-desc');
    if (!el) return;
    el.textContent = recommendation.body;
  }

  function recordAction(type, meta) {
    switch (type) {
      case 'task-completed':
        increment('completedTasks');
        break;
      case 'nudge-accepted':
        increment('acceptedNudges');
        break;
      case 'nudge-dismissed':
        increment('dismissedNudges');
        break;
      case 'kudos-sent':
        increment('kudosSent');
        break;
      default:
        return;
    }

    notifyListeners(type, meta);
    applyNudgeCopy();
    global.setTimeout(createAgentToast, 350);
  }

  // ---------------------------------------------------------------------
  // "Why am I seeing this" -> also surfaces the agent's live reasoning,
  // in a panel inserted right after the mockup's own why-panel. Anchored
  // on #why-panel (desktop/mobile/digest/texting) or #nudge-why-btn's
  // sibling #nudge-why-panel (the swiping deck's own ids for the same
  // disclosure) — real ids from the markup, not a guessed class name.
  // ---------------------------------------------------------------------
  function explainRecommendation() {
    var existing = document.getElementById('agent-explanation');
    if (existing) {
      existing.remove();
      return;
    }

    var anchor = document.getElementById('why-panel') || document.getElementById('nudge-why-panel');
    if (!anchor) return;

    var recommendation = resolveRecommendation();
    var learned =
      global.AgentPersonalization && typeof global.AgentPersonalization.getExplanation === 'function'
        ? global.AgentPersonalization.getExplanation()
        : null;

    var panel = document.createElement('div');
    panel.id = 'agent-explanation';
    panel.innerHTML =
      '<div class="agent-explanation-title">Why this recommendation?</div>' +
      '<div class="agent-explanation-body">' + escapeHTML(recommendation.body) + '</div>' +
      (learned
        ? '<div class="agent-explanation-learned">' +
            '<span class="agent-explanation-learned-label">Learned preference</span>' +
            escapeHTML(learned) +
          '</div>'
        : '');

    anchor.parentNode.insertBefore(panel, anchor.nextSibling);
  }

  // ---------------------------------------------------------------------
  // Global click detection, delegated on document so it works without
  // touching each mockup's own handlers. Selectors and text are matched
  // against what's actually in the markup (checked across every mockup),
  // not guessed — e.g. there's no task-checkbox or "Mark complete"
  // anywhere in this app, and a bare "continue" match would also catch
  // the deck's info-card "Continue \u2192" button and onboarding's own
  // continue button, so neither is used here.
  //
  // Set AgentSimulation.autoTrackClicks = false to opt a page out. The
  // swiping deck does this: its drag gesture and its fallback button
  // both resolve through applyResolution(), which it instruments
  // directly, so leaving this on would double-count the button path.
  // ---------------------------------------------------------------------
  function observeActions() {
    document.addEventListener('click', function (event) {
      if (!global.AgentSimulation.autoTrackClicks) return;

      var target = event.target.closest('button, [role="button"]');
      if (!target) return;

      var text = (target.textContent || '').trim().toLowerCase();

      if (text.indexOf('move it') !== -1) {
        recordAction('nudge-accepted', { category: 'nudge' });
      } else if (text === 'not now') {
        recordAction('nudge-dismissed', { category: 'nudge' });
      } else if (text.indexOf('move to today') !== -1) {
        recordAction('task-completed', { taskId: 'expense', category: 'missed-task', size: 'large', minutes: 45 });
      } else if (text.indexOf('add a time block') !== -1) {
        recordAction('task-completed', { taskId: 'dentist', category: 'missed-task', size: 'small', minutes: 10 });
      } else if (text.indexOf('send kudos') !== -1) {
        recordAction('kudos-sent', { category: 'kudos' });
      }
    });

    document.addEventListener('click', function (event) {
      var target = event.target.closest('#why-btn, #nudge-why-btn');
      if (!target) return;
      global.setTimeout(explainRecommendation, 50);
    });
  }

  function injectStyles() {
    if (document.getElementById('agent-simulation-styles')) return;

    var style = document.createElement('style');
    style.id = 'agent-simulation-styles';
    style.textContent =
      '.agent-toast{' +
        'position:absolute;width:min(300px,calc(100% - 24px));box-sizing:border-box;' +
        'padding:11px 13px;border-radius:16px;' +
        'background:var(--card,#fff);border:1px solid var(--border,rgba(0,0,0,.08));' +
        'box-shadow:0 12px 30px rgba(0,0,0,.2);opacity:0;z-index:9999;pointer-events:none;' +
        'transition:opacity .25s ease,transform .25s ease;font-family:\'Inter\',sans-serif;' +
      '}' +
      '.agent-toast.show{opacity:1;}' +
      '.agent-toast--banner{top:46px;left:50%;transform:translate(-50%,-130%);}' +
      '.agent-toast--banner.show{transform:translate(-50%,0);}' +
      '.agent-toast--corner{top:16px;right:16px;transform:translateX(120%);}' +
      '.agent-toast--corner.show{transform:translateX(0);}' +
      '.agent-toast--fallback{position:fixed;right:20px;bottom:20px;transform:translateY(14px);}' +
      '.agent-toast--fallback.show{transform:translateY(0);}' +
      '.agent-toast-head{display:flex;align-items:center;gap:6px;margin-bottom:6px;}' +
      '.agent-toast-icon{' +
        'width:18px;height:18px;border-radius:6px;background:var(--violet,#854dff);color:#fff;' +
        'font-size:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0;' +
      '}' +
      '.agent-toast-app{' +
        'font-size:.7rem;font-weight:700;color:var(--text,#221d33);' +
        'text-transform:uppercase;letter-spacing:.03em;' +
      '}' +
      '.agent-toast-time{font-size:.7rem;color:var(--text-muted,#8a8398);margin-left:auto;}' +
      '.agent-toast-title{font-weight:650;font-size:.88rem;color:var(--text,#221d33);margin-bottom:2px;}' +
      '.agent-toast-body{color:var(--text-muted,#5b5570);font-size:.82rem;line-height:1.4;}' +
      '#agent-explanation{' +
        'margin:10px 0 0;padding:12px 14px;border-radius:8px;' +
        'border-left:2px solid var(--violet,#854dff);' +
        'background:var(--card-raised,#f1eef8);color:var(--text,#221d33);' +
      '}' +
      '.agent-explanation-title{font-weight:650;margin-bottom:4px;font-size:.85rem;}' +
      '.agent-explanation-body{color:var(--text-muted,#5b5570);font-size:.85rem;line-height:1.45;}' +
      '.agent-explanation-learned{' +
        'margin-top:8px;padding-top:8px;border-top:1px solid var(--border,rgba(0,0,0,.08));' +
        'font-size:.82rem;line-height:1.4;color:var(--text,#221d33);' +
      '}' +
      '.agent-explanation-learned-label{' +
        'display:block;font-weight:650;font-size:.7rem;text-transform:uppercase;' +
        'letter-spacing:.03em;color:var(--violet,#854dff);margin-bottom:3px;' +
      '}';

    document.head.appendChild(style);
  }

  function reset() {
    persist(cloneDefaults());
    applyNudgeCopy();
    if (global.AgentPersonalization && typeof global.AgentPersonalization.reset === 'function') {
      global.AgentPersonalization.reset();
    }
  }

  function init() {
    if (!SharedState) return;
    injectStyles();
    observeActions();
    applyNudgeCopy();
  }

  global.AgentSimulation = {
    init: init,
    recordAction: recordAction,
    getRecommendation: getRecommendation,
    explainRecommendation: explainRecommendation,
    onAction: onAction,
    reset: reset,
    autoTrackClicks: true
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window);
