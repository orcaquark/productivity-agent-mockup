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

  function escapeHTML(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ---------------------------------------------------------------------
  // Toast. Deliberately NOT themed off the page's CSS variables: it's
  // appended to document.body so position:fixed isn't clipped by the
  // desktop mockup's .device-frame (overflow:hidden), and #app-shell —
  // the only element dark-mode variables are scoped to — isn't in that
  // ancestor chain from body, so inherited theming wouldn't work anyway.
  // A fixed dark snackbar is the simpler, correct choice here.
  // ---------------------------------------------------------------------
  function createAgentToast() {
    var existing = document.getElementById('agent-simulation-toast');
    if (existing) existing.remove();

    var recommendation = getRecommendation();

    var toast = document.createElement('div');
    toast.id = 'agent-simulation-toast';
    toast.setAttribute('role', 'status');
    toast.innerHTML =
      '<div class="agent-toast-title"><span class="agent-toast-spark">\u2726</span>' +
        escapeHTML(recommendation.title) +
      '</div>' +
      '<div class="agent-toast-body">' + escapeHTML(recommendation.body) + '</div>';

    document.body.appendChild(toast);

    requestAnimationFrame(function () {
      toast.classList.add('show');
    });

    global.setTimeout(function () {
      toast.classList.remove('show');
      global.setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 250);
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
    var recommendation = getRecommendation();
    if (recommendation.isDefault) return;

    var el = document.getElementById('nudge-desc');
    if (!el) return;
    el.textContent = recommendation.body;
  }

  function recordAction(type) {
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

    var recommendation = getRecommendation();

    var panel = document.createElement('div');
    panel.id = 'agent-explanation';
    panel.innerHTML =
      '<div class="agent-explanation-title">Why this recommendation?</div>' +
      '<div class="agent-explanation-body">' + escapeHTML(recommendation.body) + '</div>';

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
        recordAction('nudge-accepted');
      } else if (text === 'not now') {
        recordAction('nudge-dismissed');
      } else if (text.indexOf('move to today') !== -1 || text.indexOf('add a time block') !== -1) {
        recordAction('task-completed');
      } else if (text.indexOf('send kudos') !== -1) {
        recordAction('kudos-sent');
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
      '#agent-simulation-toast{' +
        'position:fixed;right:20px;bottom:20px;width:min(340px,calc(100vw - 32px));' +
        'padding:14px 16px;border-radius:12px;background:#1c1a24;color:#fff;' +
        'box-shadow:0 14px 40px rgba(0,0,0,.32);opacity:0;transform:translateY(12px);' +
        'transition:opacity .22s ease,transform .22s ease;z-index:9999;pointer-events:none;' +
        'font-family:\'Inter\',sans-serif;' +
      '}' +
      '#agent-simulation-toast.show{opacity:1;transform:translateY(0);}' +
      '.agent-toast-title{font-weight:650;margin-bottom:5px;font-size:.95rem;}' +
      '.agent-toast-spark{margin-right:6px;color:#a78bfa;}' +
      '.agent-toast-body{color:#c7c5d1;font-size:.87rem;line-height:1.45;}' +
      '#agent-explanation{' +
        'margin:10px 0 0;padding:12px 14px;border-radius:8px;' +
        'border-left:2px solid var(--violet,#854dff);' +
        'background:var(--card-raised,#f1eef8);color:var(--text,#221d33);' +
      '}' +
      '.agent-explanation-title{font-weight:650;margin-bottom:4px;font-size:.85rem;}' +
      '.agent-explanation-body{color:var(--text-muted,#5b5570);font-size:.85rem;line-height:1.45;}';

    document.head.appendChild(style);
  }

  function reset() {
    persist(cloneDefaults());
    applyNudgeCopy();
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
    reset: reset,
    autoTrackClicks: true
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window);
