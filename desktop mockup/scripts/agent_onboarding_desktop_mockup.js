  // ---------- sidebar collapse ----------
  function toggleSidebar(){
    document.getElementById('sidebar').classList.toggle('collapsed');
  }

  // ---------- keyboard support for div-as-button interactive elements ----------
  function bindKeyboard(el){
    el.addEventListener('keydown', function(e){
      if(e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        el.click();
      }
    });
  }
  document.querySelectorAll('[tabindex="0"]').forEach(function(el){
    if(!el.hasAttribute('role')) el.setAttribute('role','button');
    bindKeyboard(el);
  });

  // ---------- theme: light / dark / system, one source of truth ----------
  var themeMode = 'light'; // 'light' | 'dark' | 'system'

  function systemPrefersDark(){
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function effectiveTheme(){
    return themeMode === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : themeMode;
  }
  function applyTheme(){
    var dark = effectiveTheme() === 'dark';
    document.getElementById('app-shell').classList.toggle('dark-mode', dark);
    var btn = document.getElementById('theme-toggle-icon');
    if(btn) btn.setAttribute('href', dark ? '#ic-sun' : '#ic-moon');
    var segs = document.querySelectorAll('[data-theme]');
    segs.forEach(function(s){ s.classList.toggle('active', s.getAttribute('data-theme') === themeMode); });
    if(typeof onThemeChange === 'function') onThemeChange(dark);
  }
  function setTheme(mode){
    themeMode = mode;
    applyTheme();
  }
  // Sidebar's quick toggle: a true bidirectional flip between light and dark,
  // matching the mobile settings file's sun/moon behavior — an explicit choice,
  // same source of truth the settings page's System/Light/Dark control reads from.
  function quickToggleTheme(){
    setTheme(effectiveTheme() === 'dark' ? 'light' : 'dark');
  }
  applyTheme();


  var currentStep = 0;

  function goToStep(n){
    if(n < 0 || n > 4) return;
    document.querySelectorAll('.step-page').forEach(function(p){ p.classList.remove('active'); });
    document.querySelector('.step-page[data-step="' + n + '"]').classList.add('active');
    document.querySelectorAll('.page-dot').forEach(function(d){
      d.classList.toggle('active', d.getAttribute('data-dot') === String(n));
    });
    currentStep = n;
    if(n === 4) updateSummary();
    var screen = document.querySelector('.step-page[data-step="' + n + '"] .ob-screen');
    if(screen) screen.scrollTop = 0;
  }

  function finishOnboarding(){
    var btn = document.getElementById('finish-btn');
    btn.textContent = '✓ All set!';
    btn.setAttribute('disabled', 'true');
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
  }
  function toggleChip(el){
    el.classList.toggle('selected');
  }

  var sliderDisplay = {
    freq: { idx: 0, labels: ['Light touch', 'Some check-ins', 'Frequent'] }
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
