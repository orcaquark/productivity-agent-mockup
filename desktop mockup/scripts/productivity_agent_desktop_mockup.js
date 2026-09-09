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


  var GAUGE_C = 2 * Math.PI * 53;
  function setGauge(pct){
    var el = document.getElementById('gauge-fill');
    if(!el) return;
    el.style.strokeDasharray = GAUGE_C.toFixed(1);
    el.style.strokeDashoffset = (GAUGE_C * (1 - pct / 100)).toFixed(1);
  }
  setGauge(82);

  function setState(s){
    document.getElementById('state-active').style.display = (s==='active') ? 'block' : 'none';
    document.getElementById('state-new').style.display = (s==='new') ? 'block' : 'none';
    document.getElementById('pill-active').classList.toggle('active', s==='active');
    document.getElementById('pill-new').classList.toggle('active', s==='new');
    var greet = document.getElementById('greet-name');
    var sub = document.getElementById('subline');
    if(s==='new'){
      greet.textContent = 'Welcome, Maya.';
      sub.textContent = "Your personalization hasn't kicked in yet — insights show up here as you use Kindred.";
    } else {
      greet.textContent = 'Evening, Maya.';
      sub.textContent = "Here's where your thread picked up today.";
    }
  }
  function toggleWhy(){
    var panel = document.getElementById('why-panel');
    var btn = document.getElementById('why-btn');
    var open = panel.classList.toggle('open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  var trendMonthOpen = false;
  function toggleTrendView(){
    trendMonthOpen = !trendMonthOpen;
    document.getElementById('trend-week-view').style.display = trendMonthOpen ? 'none' : 'block';
    document.getElementById('trend-month-view').style.display = trendMonthOpen ? 'block' : 'none';
    document.getElementById('trend-big').innerHTML = trendMonthOpen ? '69<small>%</small>' : '82<small>%</small>';
    document.getElementById('trend-delta').textContent = trendMonthOpen ? 'trending up over 4 weeks' : '↑ steadier than last week';
    document.getElementById('trend-note').textContent = trendMonthOpen
      ? "Each bar averages a full week. The climb tracks with your focus-time nudges landing more consistently."
      : "Tuesday's dip lines up with the team offsite, not a slip.";
    document.getElementById('trend-toggle-btn').textContent = trendMonthOpen ? '← Back to this week' : 'See full month →';
    setGauge(trendMonthOpen ? 69 : 82);
  }
  var missedActions = {
    expense: { done: '✓ Moved to today', undone: 'Move to today' },
    dentist: { done: '✓ Time block added', undone: 'Add a time block' }
  };
  function resolveMissed(id){
    document.getElementById('miss-cta-' + id).style.display = 'none';
    var fb = document.getElementById('miss-feedback-' + id);
    fb.classList.add('show');
    fb.innerHTML = '<span>' + missedActions[id].done + '</span><button class="undo" onclick="undoMissed(\'' + id + '\')">Undo</button>';
  }
  function undoMissed(id){
    document.getElementById('miss-cta-' + id).style.display = 'inline-flex';
    var fb = document.getElementById('miss-feedback-' + id);
    fb.classList.remove('show');
    fb.innerHTML = '';
  }
  function resolveNudge(kind){
    document.getElementById('nudge-actions').style.display = 'none';
    var fb = document.getElementById('nudge-feedback');
    fb.classList.add('show');
    if(kind === 'moved'){
      fb.innerHTML = '<span>✓ Moved to 8:40am</span><button class="undo" onclick="undoNudge()">Undo</button>';
    } else {
      fb.innerHTML = '<span style="color:var(--text-muted)">Dismissed — won\'t ask again this week</span><button class="undo" onclick="undoNudge()">Undo</button>';
    }
  }
  function undoNudge(){
    document.getElementById('nudge-actions').style.display = 'flex';
    var fb = document.getElementById('nudge-feedback');
    fb.classList.remove('show');
    fb.innerHTML = '';
  }
  function resolveKudos(kind){
    document.getElementById('kudos-actions').style.display = 'none';
    var fb = document.getElementById('kudos-feedback');
    fb.classList.add('show');
    if(kind === 'sent'){
      fb.innerHTML = '<span>✓ Kudos sent to Jordan</span><button class="undo" onclick="undoKudos()">Undo</button>';
    } else {
      fb.innerHTML = '<span style="color:var(--text-muted)">Skipped — we\'ll surface this less often</span><button class="undo" onclick="undoKudos()">Undo</button>';
    }
  }
  function undoKudos(){
    document.getElementById('kudos-actions').style.display = 'flex';
    var fb = document.getElementById('kudos-feedback');
    fb.classList.remove('show');
    fb.innerHTML = '';
  }
  var navModalContent = {
    ring: {
      icon: '🔗',
      title: 'This would open Rings',
      body: 'In the real app, this deep-links to the Rings tab scoped to <b>Gym</b> — it doesn\'t close the ring from here. Closing a ring likely involves more than one tap of state (duration, reps, streak), so this mockup shows the intended destination instead of faking that interaction.'
    },
    friends: {
      icon: '👥',
      title: 'This would open Friends',
      body: 'In the real app, this deep-links to the Friends tab to search for and add someone. Adding a friend involves sending a request and waiting on their acceptance — more than a single tap — so this mockup shows the intended destination instead of faking that flow.'
    },
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
