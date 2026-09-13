/**
 * agent-personalization.js
 *
 * Level 4 (personalization) for the Kindred mockups. Builds on top of
 * Level 3 (agent-simulation.js) instead of replacing it:
 *
 *   USER ACTION
 *       -> AgentSimulation.recordAction(type, meta)   [Level 3 — counters]
 *       -> AgentSimulation notifies its listeners
 *       -> AgentPersonalization logs a timestamped event   [Level 4]
 *       -> computeProfile() derives rates from the event log
 *       -> AgentSimulation.resolveRecommendation() asks this module first
 *          and only falls back to its own generic thresholds if this
 *          module doesn't have anything specific enough to say yet
 *
 * This is a small deterministic learning system, not a fake LLM: every
 * number below comes from counting real events (real clicks, or, for
 * demo purposes, seedDemoHistory() — see the note above that function).
 * There's no random or generated-sounding text; a given event history
 * always produces the same profile and the same copy.
 *
 * Include this AFTER agent-simulation.js and BEFORE a mockup's own
 * script:
 *   <script src="../shared/agent-simulation.js"></script>
 *   <script src="../shared/agent-personalization.js"></script>
 *   <script src="scripts/your_mockup.js"></script>
 */
(function (global) {
  'use strict';

  var SharedState = global.MockShared && global.MockShared.SharedState;
  var AgentSimulation = global.AgentSimulation;

  var STATE_KEY = 'agent-personalization';
  var MAX_EVENTS = 200;

  // Minimum samples before a pattern is trusted enough to change copy.
  // Below these, computeProfile() reports null rather than a preference
  // built on one or two data points.
  var MIN_BUCKET_SAMPLES = 3;
  var MIN_TASK_SAMPLES = 2;

  var defaults = { events: [] };

  function cloneDefaults() {
    return JSON.parse(JSON.stringify(defaults));
  }

  function load() {
    return SharedState.get(STATE_KEY, cloneDefaults());
  }

  function persist(state) {
    SharedState.update(STATE_KEY, state);
  }

  function bucketFor(hour) {
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  }

  // ---------------------------------------------------------------------
  // computeProfile() is a pure function of the event log: same events in,
  // same profile out, every time. Nothing here is cached or mutated —
  // getProfile() and friends just call this fresh, which is what keeps
  // "deterministic" true even as the event log grows.
  // ---------------------------------------------------------------------
  function computeProfile(events) {
    var buckets = ['morning', 'afternoon', 'evening'];
    var byTimeOfDay = {};

    buckets.forEach(function (bucket) {
      var inBucket = events.filter(function (e) {
        return e.bucket === bucket && (e.type === 'nudge-accepted' || e.type === 'nudge-dismissed');
      });
      var accepted = inBucket.filter(function (e) { return e.type === 'nudge-accepted'; }).length;
      var dismissed = inBucket.length - accepted;
      byTimeOfDay[bucket] = {
        accepted: accepted,
        dismissed: dismissed,
        total: inBucket.length,
        rate: inBucket.length ? accepted / inBucket.length : null
      };
    });

    var preferredNudgeTime = null;
    buckets.forEach(function (bucket) {
      var d = byTimeOfDay[bucket];
      if (d.total < MIN_BUCKET_SAMPLES) return;
      if (preferredNudgeTime === null || d.rate > byTimeOfDay[preferredNudgeTime].rate) {
        preferredNudgeTime = bucket;
      }
    });

    var allNudgeEvents = events.filter(function (e) {
      return e.type === 'nudge-accepted' || e.type === 'nudge-dismissed';
    });
    var totalAccepted = allNudgeEvents.filter(function (e) { return e.type === 'nudge-accepted'; }).length;
    var nudgeAcceptanceRate = allNudgeEvents.length ? totalAccepted / allNudgeEvents.length : null;

    var nudgeFrequency = null;
    if (allNudgeEvents.length >= MIN_BUCKET_SAMPLES) {
      if (nudgeAcceptanceRate < 0.34) nudgeFrequency = 'low';
      else if (nudgeAcceptanceRate > 0.66) nudgeFrequency = 'high';
    }

    var sizedEvents = events.filter(function (e) { return e.type === 'task-completed' && e.size; });
    var smallCount = sizedEvents.filter(function (e) { return e.size === 'small'; }).length;
    var largeCount = sizedEvents.filter(function (e) { return e.size === 'large'; }).length;
    var preferredTaskSize = null;
    if (sizedEvents.length >= MIN_TASK_SAMPLES && smallCount !== largeCount) {
      preferredTaskSize = smallCount > largeCount ? 'small' : 'large';
    }

    var learnedPatterns = [];
    if (preferredNudgeTime) {
      learnedPatterns.push(
        'Responds best to ' + preferredNudgeTime + ' nudges (' +
        Math.round(byTimeOfDay[preferredNudgeTime].rate * 100) + '% accepted).'
      );
    }
    if (nudgeFrequency === 'low') {
      learnedPatterns.push('Dismisses most nudges — prefers fewer interruptions.');
    } else if (nudgeFrequency === 'high') {
      learnedPatterns.push('Consistently acts on nudges sent this way.');
    }
    if (preferredTaskSize === 'small') {
      learnedPatterns.push('Resolves short tasks more often than long ones.');
    } else if (preferredTaskSize === 'large') {
      learnedPatterns.push('Follows through on bigger tasks rather than deferring them.');
    }

    return {
      preferences: {
        nudgeFrequency: nudgeFrequency,
        preferredNudgeTime: preferredNudgeTime,
        preferredTaskSize: preferredTaskSize
      },
      behavior: {
        nudgeAcceptanceRate: nudgeAcceptanceRate,
        byTimeOfDay: byTimeOfDay,
        sampleSize: events.length
      },
      learnedPatterns: learnedPatterns
    };
  }

  function getProfile() {
    return computeProfile(load().events);
  }

  function getPreferredNudgeTime() {
    return getProfile().preferences.preferredNudgeTime;
  }

  // Whether the agent would nudge right now, given what it's learned.
  // Only says no when there's enough same-bucket history to trust it —
  // otherwise it defaults to yes, same as if personalization weren't
  // there at all.
  function shouldNudge(hourOverride) {
    var hour = hourOverride != null ? hourOverride : new Date().getHours();
    var bucket = bucketFor(hour);
    var d = getProfile().behavior.byTimeOfDay[bucket];
    if (d && d.total >= MIN_BUCKET_SAMPLES && d.rate < 0.25) return false;
    return true;
  }

  // Given a task's size, says whether this user's history suggests
  // breaking it down. Returns null (not "no opinion" text) when there
  // isn't a task-size preference to act on yet — callers should treat
  // null as "say nothing," not as a real recommendation.
  function getTaskRecommendation(task) {
    task = task || {};
    var preferredTaskSize = getProfile().preferences.preferredTaskSize;
    if (!preferredTaskSize) return null;

    if (task.size === 'large' && preferredTaskSize === 'small') {
      return 'You tend to complete short tasks more often than long ones \u2014 want this broken into a smaller step?';
    }
    if (task.size === 'small' && preferredTaskSize === 'small') {
      return 'Tasks like this usually get done quickly for you.';
    }
    if (task.size === 'large' && preferredTaskSize === 'large') {
      return 'You\u2019ve been following through on bigger tasks lately.';
    }
    return null;
  }

  // ---------------------------------------------------------------------
  // The recommendation AgentSimulation.resolveRecommendation() prefers
  // over its own generic thresholds, once there's something genuinely
  // more specific to say than "you've accepted N nudges." Returns null
  // (deferring to Level 3) until the profile clears MIN_BUCKET_SAMPLES /
  // MIN_TASK_SAMPLES — this module should never talk before it has
  // enough to say something true.
  // ---------------------------------------------------------------------
  function getRecommendation() {
    var profile = getProfile();
    var prefs = profile.preferences;

    if (prefs.preferredTaskSize === 'small') {
      return {
        title: 'Smaller steps work better for you',
        body: 'You tend to put off bigger tasks \u2014 I\u2019ll suggest breaking them into smaller pieces when I can.'
      };
    }

    if (prefs.preferredNudgeTime) {
      return {
        title: 'Timed for you',
        body: 'You respond to nudges best in the ' + prefs.preferredNudgeTime +
          ' \u2014 I\u2019ll keep timing suggestions around then.'
      };
    }

    return null;
  }

  // One or two learned patterns, in a single line, for the "why" panel's
  // "Learned preference" section. Null (not an empty string) when there's
  // nothing learned yet, so agent-simulation.js knows to omit the section
  // entirely instead of showing an empty box.
  function getExplanation() {
    var patterns = getProfile().learnedPatterns;
    if (!patterns.length) return null;
    return patterns.slice(0, 2).join(' ');
  }

  // ---------------------------------------------------------------------
  // Writes getTaskRecommendation() into the two missed-task cards
  // (#miss-insight-expense / #miss-insight-dentist — present on every
  // mockup, empty until there's something to say). Mirrors how
  // agent-simulation.js's applyNudgeCopy() drives #nudge-desc.
  // ---------------------------------------------------------------------
  function applyMissInsights() {
    var expenseEl = document.getElementById('miss-insight-expense');
    if (expenseEl) expenseEl.textContent = getTaskRecommendation({ size: 'large' }) || '';

    var dentistEl = document.getElementById('miss-insight-dentist');
    if (dentistEl) dentistEl.textContent = getTaskRecommendation({ size: 'small' }) || '';
  }

  function updateProfile() {
    applyMissInsights();
  }

  // ---------------------------------------------------------------------
  // Every AgentSimulation.recordAction() call arrives here with its
  // metadata attached, timestamped and bucketed, then appended to this
  // module's own event log (kept separate from Level 3's plain counters
  // in shared/agent-simulation.js). Registered at load time, not inside
  // init(), so it's listening from the first action regardless of
  // DOMContentLoaded timing.
  // ---------------------------------------------------------------------
  function handleAction(type, meta) {
    meta = meta || {};
    var now = new Date();
    var hour = typeof meta.hour === 'number' ? meta.hour : now.getHours();

    var state = load();
    state.events.push({
      type: type,
      hour: hour,
      bucket: bucketFor(hour),
      size: meta.size || null,
      minutes: typeof meta.minutes === 'number' ? meta.minutes : null,
      category: meta.category || null,
      taskId: meta.taskId || null,
      at: now.getTime()
    });
    if (state.events.length > MAX_EVENTS) {
      state.events = state.events.slice(-MAX_EVENTS);
    }
    persist(state);
    updateProfile();
  }

  if (AgentSimulation && typeof AgentSimulation.onAction === 'function') {
    AgentSimulation.onAction(handleAction);
  }

  // ---------------------------------------------------------------------
  // Demo/testing convenience — NOT called automatically. Seeds a batch of
  // synthetic historical events (spread across hours and both task sizes)
  // so time-of-day and task-size personalization can be demonstrated
  // immediately, without waiting for real usage to accumulate across
  // different times of day. The learning math applied to this data is
  // identical to the math applied to real clicks; only the source of the
  // events differs, the same way seeding fixtures for a test doesn't
  // change what the code under test does. Run from the console:
  //   AgentPersonalization.seedDemoHistory()
  // ---------------------------------------------------------------------
  function seedDemoHistory() {
    var now = Date.now();
    var seeded = [
      { type: 'nudge-accepted', hour: 8 },
      { type: 'nudge-accepted', hour: 8 },
      { type: 'nudge-accepted', hour: 9 },
      { type: 'nudge-dismissed', hour: 9 },
      { type: 'nudge-accepted', hour: 14 },
      { type: 'nudge-dismissed', hour: 14 },
      { type: 'nudge-dismissed', hour: 15 },
      { type: 'nudge-dismissed', hour: 18 },
      { type: 'nudge-dismissed', hour: 19 },
      { type: 'nudge-dismissed', hour: 20 },
      { type: 'task-completed', hour: 9, size: 'small', taskId: 'dentist', minutes: 10 },
      { type: 'task-completed', hour: 10, size: 'small', taskId: 'dentist', minutes: 12 },
      { type: 'task-completed', hour: 16, size: 'large', taskId: 'expense', minutes: 40 }
    ];

    var state = load();
    seeded.forEach(function (e, i) {
      state.events.push({
        type: e.type,
        hour: e.hour,
        bucket: bucketFor(e.hour),
        size: e.size || null,
        minutes: typeof e.minutes === 'number' ? e.minutes : null,
        category: e.category || (e.type.indexOf('nudge') === 0 ? 'nudge' : 'missed-task'),
        taskId: e.taskId || null,
        // Spread across the recent past, oldest first, so this reads as
        // history rather than everything happening in the same instant.
        at: now - (seeded.length - i) * 3600000
      });
    });

    if (state.events.length > MAX_EVENTS) state.events = state.events.slice(-MAX_EVENTS);
    persist(state);
    updateProfile();
  }

  function reset() {
    persist(cloneDefaults());
    applyMissInsights();
  }

  function injectStyles() {
    if (document.getElementById('agent-personalization-styles')) return;

    var style = document.createElement('style');
    style.id = 'agent-personalization-styles';
    style.textContent =
      '.miss-insight{' +
        'display:block;font-size:.8rem;line-height:1.4;color:var(--violet,#854dff);margin-top:4px;' +
      '}' +
      '.miss-insight:empty{display:none;margin:0;}';

    document.head.appendChild(style);
  }

  function init() {
    if (!SharedState || !AgentSimulation) return;
    injectStyles();
    applyMissInsights();
  }

  global.AgentPersonalization = {
    init: init,
    getProfile: getProfile,
    getPreferredNudgeTime: getPreferredNudgeTime,
    shouldNudge: shouldNudge,
    getTaskRecommendation: getTaskRecommendation,
    getRecommendation: getRecommendation,
    getExplanation: getExplanation,
    seedDemoHistory: seedDemoHistory,
    reset: reset
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window);
