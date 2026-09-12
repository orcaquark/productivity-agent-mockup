// ---------- shared utilities (see ../shared/mockup-shared.js) ----------
  var announce = MockShared.announce;
  var MockState = MockShared.MockState;
  var MockSync = MockShared.MockSync;

  // ---------- sidebar collapse ----------
  function toggleSidebar(){
    document.getElementById('sidebar').classList.toggle('collapsed');
  }

  // ---------- keyboard support for div-as-button interactive elements ----------
  MockShared.initKeyboardSupport();

  // ---------- theme: shared with every other mockup ----------
  var theme = MockShared.createThemeController({ storageKey: 'theme', defaultMode: 'light' });
  function setTheme(mode){ theme.setTheme(mode); }
  function quickToggleTheme(){ theme.quickToggle(); }


  // ---------- persisted onboarding progress ----------
  // `null` (not a fallback object) distinguishes "nothing saved yet" from
  // "saved, and happens to match the defaults" — only the former should
  // leave the slider's static starting position in the HTML untouched.
  var storedOnboarding = MockShared.SharedState.get(
    'onboarding',
    null
  );

  if (storedOnboarding && storedOnboarding.completed) {
    storedOnboarding = {
      step: storedOnboarding.step,
      plan: storedOnboarding.plan,
      tone: storedOnboarding.tone,
      focus: storedOnboarding.focus || [],
      freqIdx: storedOnboarding.freqIdx || 0
    };
  }
  var hasPersistedOnboarding = !!storedOnboarding;
  var onboardingState = storedOnboarding || { step: 0, plan: null, tone: null, focus: [], freqIdx: 0 };
  var currentStep = onboardingState.step;

  function saveOnboardingState(){
    var shared = MockShared.SharedState.load();

    shared.onboarding = {
      step: onboardingState.step,
      plan: onboardingState.plan,
      tone: onboardingState.tone,
      focus: onboardingState.focus.slice(),
      freqIdx: onboardingState.freqIdx,
      completed: shared.onboarding.completed || false
    };

    MockShared.SharedState.save(shared);
  }

  function goToStep(n){
    if(n < 0 || n > 4) return;
    document.querySelectorAll('.step-page').forEach(function(p){ p.classList.remove('active'); });
    document.querySelector('.step-page[data-step="' + n + '"]').classList.add('active');
    document.querySelectorAll('.page-dot').forEach(function(d){
      d.classList.toggle('active', d.getAttribute('data-dot') === String(n));
    });
    currentStep = n;
    onboardingState.step = n;
    saveOnboardingState();
    if(n === 4) updateSummary();
    var screen = document.querySelector('.step-page[data-step="' + n + '"] .ob-screen');
    if(screen) screen.scrollTop = 0;
  }

  function finishOnboarding(){
    var btn = document.getElementById('finish-btn');
    btn.textContent = '✓ All set!';
    btn.setAttribute('disabled', 'true');

    // Two different jobs: MockState is what the feed mockup reads the
    // *next* time it loads (a separate page load, not live right now).
    // MockSync is for whoever is hosting this iframe *right now* — the
    // viewer's compare mode, if a second pane happens to be open.
    var shared = MockShared.SharedState.load();

    shared.onboarding = {
      step: onboardingState.step,
      plan: onboardingState.plan,
      tone: onboardingState.tone,
      focus: onboardingState.focus.slice(),
      freqIdx: onboardingState.freqIdx,
      completed: true
    };

    MockShared.SharedState.save(shared);
    MockState.save('onboarding-complete', true);
    MockSync.broadcast('onboarding-finished', {});
    announce('Onboarding complete — personalization is now set up.');
  }

  function skipToDefaults(){
    // Jumps straight to the confirm screen using whatever is already
    // pre-selected (plan, frequency, tone, focus times) — no answers lost,
    // just no extra taps for someone who doesn't want to walk through it.
    goToStep(4);
  }

  function selectOption(el){
    var group = el.getAttribute('data-group');
    document.querySelectorAll('[data-group="'+group+'"]').forEach(function(o){
      o.classList.remove('selected');
      o.querySelector('.opt-check').textContent = '';
    });
    el.classList.add('selected');
    el.querySelector('.opt-check').textContent = '✓';
    if(group === 'plan' || group === 'tone'){
      onboardingState[group] = el.getAttribute('data-summary');
      saveOnboardingState();
    }
  }
  function toggleChip(el){
    el.classList.toggle('selected');
    if(el.classList.contains('time-chip')){
      onboardingState.focus = Array.from(document.querySelectorAll('.time-chip.selected')).map(function(c){ return c.textContent; });
      saveOnboardingState();
    }
  }

  var sliderDisplay = {
    freq: { idx: onboardingState.freqIdx, labels: ['Light touch', 'Some check-ins', 'Frequent'] }
  };

  function setupSlider(trackId, fillId, knobId, labelId, labels, stateKey){
    var track = document.getElementById(trackId);
    var fill = document.getElementById(fillId);
    var knob = document.getElementById(knobId);
    var label = document.getElementById(labelId);
    var dragging = false;

    function pctFromEvent(e){
      var rect = track.getBoundingClientRect();
      var clientX = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
      var x = clientX - rect.left;
      return Math.max(0, Math.min(100, (x / rect.width) * 100));
    }
    function update(pct){
      pct = Math.round(pct);
      fill.style.width = pct + '%';
      knob.style.left = pct + '%';
      knob.setAttribute('aria-valuenow', pct);
      var idx = pct < 34 ? 0 : (pct < 67 ? 1 : 2);
      label.textContent = labels[idx];
      sliderDisplay[stateKey].idx = idx;
      if(stateKey === 'freq'){
        onboardingState.freqIdx = idx;
        saveOnboardingState();
      }
    }
    function start(e){ dragging = true; update(pctFromEvent(e)); e.preventDefault(); }
    function move(e){ if(dragging){ update(pctFromEvent(e)); e.preventDefault(); } }
    function end(){ dragging = false; }

    track.addEventListener('pointerdown', start);
    window.addEventListener('pointermove', move, { passive:false });
    window.addEventListener('pointerup', end);
    track.addEventListener('touchstart', start, { passive:false });
    window.addEventListener('touchmove', move, { passive:false });
    window.addEventListener('touchend', end);

    knob.addEventListener('keydown', function(e){
      var current = parseFloat(knob.style.left) || 0;
      if(e.key === 'ArrowRight' || e.key === 'ArrowUp'){ update(Math.min(100, current + 5)); e.preventDefault(); }
      if(e.key === 'ArrowLeft' || e.key === 'ArrowDown'){ update(Math.max(0, current - 5)); e.preventDefault(); }
    });

    // Only override the slider's static starting position from the HTML
    // if there's actually persisted state to restore.
    if(stateKey === 'freq' && hasPersistedOnboarding){
      var restoredPct = onboardingState.freqIdx === 0 ? 17 : (onboardingState.freqIdx === 1 ? 50 : 83);
      update(restoredPct);
    }
  }
  setupSlider('freq-track', 'freq-fill', 'freq-knob', 'freq-label', ['LIGHT TOUCH', 'SOME CHECK-INS', 'FREQUENT'], 'freq');

  function updateSummary(){
    var planEl = document.querySelector('.option.selected[data-group="plan"]');
    document.getElementById('summary-plan').textContent = planEl ? planEl.getAttribute('data-summary') : 'Not set yet';

    document.getElementById('summary-freq').textContent = sliderDisplay.freq.labels[sliderDisplay.freq.idx];

    var toneEl = document.querySelector('.option.selected[data-group="tone"]');
    document.getElementById('summary-tone').textContent = toneEl ? toneEl.getAttribute('data-summary') : 'Not set yet';

    var times = Array.from(document.querySelectorAll('.time-chip.selected')).map(function(c){ return c.textContent; });
    document.getElementById('summary-focus').textContent = times.length
      ? times.join(', ')
      : 'No pattern yet — we\'ll use your activity instead';
  }

  function toggleLearnMore(){
    var panel = document.getElementById('learn-more-panel');
    var link = document.getElementById('learn-more-link');
    var open = panel.classList.toggle('open');
    link.textContent = open ? 'Show less ↑' : 'Learn more about how this data is used →';
  }

  var navModalContent = {
    settings: {
      icon: '⚙️',
      title: 'This would open Settings',
      body: 'In the real app, this deep-links to Personalization settings — quiet hours, nudge frequency, and tone all live there.'
    }
  };
  function openNavModal(kind){
    var c = navModalContent[kind];
    document.getElementById('nav-modal-icon').textContent = c.icon;
    document.getElementById('nav-modal-title').textContent = c.title;
    document.getElementById('nav-modal-body').innerHTML = c.body;
    document.getElementById('nav-modal-overlay').classList.add('open');
  }
  function closeNavModal(){
    document.getElementById('nav-modal-overlay').classList.remove('open');
  }

  // ---------- restore selections and jump back to the last step ----------
  if(hasPersistedOnboarding){
    if(onboardingState.plan){
      document.querySelectorAll('[data-group="plan"]').forEach(function(o){
        if(o.getAttribute('data-summary') === onboardingState.plan){
          o.classList.add('selected');
          o.querySelector('.opt-check').textContent = '✓';
        }
      });
    }
    if(onboardingState.tone){
      document.querySelectorAll('[data-group="tone"]').forEach(function(o){
        if(o.getAttribute('data-summary') === onboardingState.tone){
          o.classList.add('selected');
          o.querySelector('.opt-check').textContent = '✓';
        }
      });
    }
    if(onboardingState.focus && onboardingState.focus.length){
      document.querySelectorAll('.time-chip').forEach(function(c){
        if(onboardingState.focus.indexOf(c.textContent) !== -1) c.classList.add('selected');
      });
    }
    goToStep(currentStep);
  }