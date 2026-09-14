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
 * Two preferences are stated, not inferred: planning style and tone.
 * getEffectiveStated() reads them with onboarding's answers (SharedState's
 * 'onboarding' key) as a live fallback — not copied in once, since a
 * one-time copy made at this module's load time can't know onboarding
 * will finish moments later in the same tab. setStatedPreference() is
 * what settings pages call on every later change; it writes directly, so
 * it always wins over the onboarding fallback from then on. Tone actually
 * changes the agent's copy — see TONE_MESSAGES below and its counterpart
 * in agent-simulation.js — so it's a setting that genuinely does
 * something, not just a stored value.
 *
 * Every write here also fires a MockSync broadcast, so a second mockup
 * open in a separate browser tab (not just a compare-mode iframe) updates
 * its own copy live instead of only picking up the change on next load.
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
  var MockSync = global.MockShared && global.MockShared.MockSync;
  var AgentSimulation = global.AgentSimulation;

  var STATE_KEY = 'agent-personalization';
  var MAX_EVENTS = 200;

  // Minimum samples before a pattern is trusted enough to change copy.
  // Below these, computeProfile() reports null rather than a preference
  // built on one or two data points.
  var MIN_BUCKET_SAMPLES = 3;
  var MIN_TASK_SAMPLES = 2;

  // `stated` preferences are told to us directly (onboarding answers,
  // settings choices) rather than inferred from event history — kept
  // separate from computeProfile()'s inferred fields so one stays a pure
  // function of `events` and the other is a plain, immediately-available
  // fact. getProfile() merges the two into one preferences object.
  var defaults = { events: [], stated: { planning: null, tone: null } };

  function cloneDefaults() {
    return JSON.parse(JSON.stringify(defaults));
  }

  function load() {
    var state = SharedState.get(STATE_KEY, cloneDefaults());
    // Defensive upgrade for state saved before `stated` existed — avoids
    // crashing on state.stated.* for anyone with an older event log
    // already in localStorage.
    if (!state.events) state.events = [];
    if (!state.stated) state.stated = { planning: null, tone: null };
    return state;
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
    var state = load();
    var profile = computeProfile(state.events);
    var stated = getEffectiveStated();
    profile.preferences.planningStyle = stated.planning;
    profile.preferences.tone = stated.tone;
    return profile;
  }

  // Defaults to 'Direct' (matching the settings UI's own default
  // selection) so copy always has a definite voice to render in, even
  // before onboarding or settings has ever set one.
  function getTone() {
    return getEffectiveStated().tone || 'Direct';
  }

  // Settings pages call this to record a stated preference — always
  // written directly, so it takes precedence over getEffectiveStated()'s
  // onboarding fallback from this point on. Broadcasts a quiet cross-tab
  // refresh — no toast, since nothing the user *did* just happened, the
  // agent's voice just needs to catch up elsewhere.
  function setStatedPreference(key, value) {
    var state = load();
    state.stated[key] = value;
    persist(state);
    updateProfile();
    if (MockSync) MockSync.broadcast('agent-preference-changed', { key: key, value: value });
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
  // Same two messages, three voices — mirrors agent-simulation.js's
  // TONE_MESSAGES. {bucket} is replaced with the actual preferred time of
  // day after picking the variant.
  // ---------------------------------------------------------------------
  var TONE_MESSAGES = {
    smallerSteps: {
      direct: {
        title: 'Smaller steps work better for you',
        body: 'You tend to put off bigger tasks \u2014 I\u2019ll suggest breaking them into smaller pieces when I can.'
      },
      cheerful: {
        title: 'Small wins add up!',
        body: 'Bigger tasks tend to stall out for you \u2014 let\u2019s break them into smaller pieces so the wins keep coming!'
      },
      quiet: {
        title: 'Smaller steps',
        body: 'Bigger tasks tend to stall. I\u2019ll suggest smaller pieces instead.'
      }
    },
    timedForYou: {
      direct: {
        title: 'Timed for you',
        body: 'You respond to nudges best in the {bucket} \u2014 I\u2019ll keep timing suggestions around then.'
      },
      cheerful: {
        title: 'Found your sweet spot!',
        body: 'Turns out the {bucket} is when you\u2019re most likely to act on a nudge \u2014 I\u2019ll time things around then!'
      },
      quiet: {
        title: 'Timed for you',
        body: 'You respond best in the {bucket}. I\u2019ll time things accordingly.'
      }
    }
  };

  function toneVariant(key) {
    var tone = getTone().toLowerCase();
    var group = TONE_MESSAGES[key];
    return group[tone] || group.direct;
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
      var smallerSteps = toneVariant('smallerSteps');
      return { title: smallerSteps.title, body: smallerSteps.body };
    }

    if (prefs.preferredNudgeTime) {
      var timedForYou = toneVariant('timedForYou');
      return {
        title: timedForYou.title,
        body: timedForYou.body.replace('{bucket}', prefs.preferredNudgeTime)
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

  // ---------------------------------------------------------------------
  // Day-one seed data: onboarding already asks for planning style and
  // tone (see the desktop/mobile onboarding scripts' `onboardingState`),
  // and its answers are saved to the same MockShared.SharedState blob
  // this module reads everything else from — under the 'onboarding' key,
  // not this module's own STATE_KEY. Without this, personalization starts
  // completely blank even for a user who just answered these exact
  // questions, and Level 4 reads as disconnected from onboarding instead
  // of a continuation of it.
  //
  // Only fills in a field that's still null — a later settings change
  // (setStatedPreference, called directly, unconditionally) always wins
  // and this never runs again for that field. Checked on every init()
  // rather than once-and-flagged, since onboarding might not have been
  // completed yet the first time some other mockup loads.
  // ---------------------------------------------------------------------
  // Onboarding's option copy ("Morning-of planner", "Direct,
  // matter-of-fact") is written for a wizard question, not a settings
  // chip — normalized here to the exact label the settings pages' chips
  // use, so a seeded value highlights the right chip instead of just
  // showing an oddly-worded pill with nothing selected underneath it.
  var ONBOARDING_PLAN_LABELS = {
    'Night-before planner': 'Night-before',
    'Morning-of planner': 'Morning of'
  };
  var ONBOARDING_TONE_LABELS = {
    'Direct, matter-of-fact': 'Direct'
  };

  // Live fallback, not a one-time copy: reads onboarding's answers fresh
  // every time, so it's correct the instant onboarding finishes even in
  // the same tab that's still open (a copy made once at this module's
  // load time — before onboarding necessarily finished — would miss
  // that). A stated preference set directly (below) always overrides it.
  function getEffectiveStated() {
    var state = load();
    var onboarding = SharedState.get('onboarding', null);
    var fromOnboarding = onboarding && onboarding.completed ? onboarding : null;

    return {
      planning: state.stated.planning ||
        (fromOnboarding && fromOnboarding.plan
          ? (ONBOARDING_PLAN_LABELS[fromOnboarding.plan] || fromOnboarding.plan)
          : null),
      tone: state.stated.tone ||
        (fromOnboarding && fromOnboarding.tone
          ? (ONBOARDING_TONE_LABELS[fromOnboarding.tone] || fromOnboarding.tone)
          : null)
    };
  }

  // ---------------------------------------------------------------------
  // Everything this module has on the user, as one plain object — real
  // event log, the profile derived from it, and stated preferences.
  // Bundled by the settings pages' "Export my personalization data" into
  // a downloaded file alongside Level 3's counters and the page's own
  // settings state (frequency, quiet hours, peak focus times).
  // ---------------------------------------------------------------------
  function exportData() {
    var state = load();
    return {
      events: state.events,
      stated: state.stated,
      profile: computeProfile(state.events)
    };
  }

  function reset() {
    persist(cloneDefaults());
    applyMissInsights();
    if (MockSync) MockSync.broadcast('agent-preference-changed', { reason: 'reset' });
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

  function setupCrossTabSync() {
    if (!MockSync) return;
    // Another tab recorded a real action or changed a stated preference —
    // either way, this tab's own miss-insight copy might now be stale.
    // No toast here; agent-simulation.js owns that half of the reaction.
    MockSync.listen('agent-simulation-changed', applyMissInsights);
    MockSync.listen('agent-preference-changed', applyMissInsights);
    // Onboarding finishing elsewhere just made getEffectiveStated()'s
    // fallback available for the first time — refresh to pick it up.
    MockSync.listen('onboarding-finished', applyMissInsights);
  }

  function init() {
    if (!SharedState || !AgentSimulation) return;
    injectStyles();
    setupCrossTabSync();
    applyMissInsights();
  }

  global.AgentPersonalization = {
    init: init,
    getProfile: getProfile,
    getPreferredNudgeTime: getPreferredNudgeTime,
    getTone: getTone,
    setStatedPreference: setStatedPreference,
    shouldNudge: shouldNudge,
    getTaskRecommendation: getTaskRecommendation,
    getRecommendation: getRecommendation,
    getExplanation: getExplanation,
    exportData: exportData,
    seedDemoHistory: seedDemoHistory,
    reset: reset
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window);
