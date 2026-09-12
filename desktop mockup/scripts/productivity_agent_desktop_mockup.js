// ---------- shared utilities (see ../shared/mockup-shared.js) ----------
  var announce = MockShared.announce;
  var simulateRequest = MockShared.simulateRequest;
  var MockState = MockShared.MockState;
  var MockSync = MockShared.MockSync;

  // ---------- sidebar collapse ----------
  function toggleSidebar(){
    document.getElementById('sidebar').classList.toggle('collapsed');
  }

  // ---------- keyboard support for div-as-button interactive elements ----------
  MockShared.initKeyboardSupport();

  // ---------- theme: light / dark / system, persisted across reloads ----------
  var theme = MockShared.createThemeController({
    storageKey: 'theme', // shared across every mockup, not scoped per-screen
    defaultMode: 'light',
    onChange: function(dark){
      if (typeof onThemeChange === 'function') onThemeChange(dark);
      MockSync.broadcast('theme-changed', { dark: dark });
    }
  });
  function setTheme(mode){ theme.setTheme(mode); }
  // Sidebar's quick toggle: a true bidirectional flip between light and dark,
  // matching the mobile settings file's sun/moon behavior.
  function quickToggleTheme(){ theme.quickToggle(); }

  MockShared.setGauge('gauge-fill', 82);

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
    MockState.save('desktop-feed:view-state', s);
  }

  function toggleWhy(){
    MockShared.toggleWhy('why-panel', 'why-btn');
  }

  // ---------- trend gauge: view choice persisted across reloads ----------
  var trendMonthOpen = MockState.load('desktop-feed:trend-month-open', false);
  function renderTrendView(){
    document.getElementById('trend-week-view').style.display = trendMonthOpen ? 'none' : 'block';
    document.getElementById('trend-month-view').style.display = trendMonthOpen ? 'block' : 'none';
    document.getElementById('trend-big').innerHTML = trendMonthOpen ? '69<small>%</small>' : '82<small>%</small>';
    document.getElementById('trend-delta').textContent = trendMonthOpen ? 'trending up over 4 weeks' : '↑ steadier than last week';
    document.getElementById('trend-note').textContent = trendMonthOpen
      ? "Each bar averages a full week. The climb tracks with your focus-time nudges landing more consistently."
      : "Tuesday's dip lines up with the team offsite, not a slip.";
    document.getElementById('trend-toggle-btn').textContent = trendMonthOpen ? '← Back to this week' : 'See full month →';
    MockShared.setGauge('gauge-fill', trendMonthOpen ? 69 : 82);
  }
  function toggleTrendView(){
    trendMonthOpen = !trendMonthOpen;
    MockState.save('desktop-feed:trend-month-open', trendMonthOpen);
    renderTrendView();
  }
  renderTrendView();

  // ---------- missed-task follow-ups: persisted, simulated async, announced ----------
  var missedActions = {
    expense: { done: '✓ Moved to today', announce: 'Expense report moved to today.' },
    dentist: { done: '✓ Time block added', announce: 'Time block added for calling the dentist.' }
  };
  var resolvedMissed = MockState.load('desktop-feed:resolved-missed', {});

  function renderMissed(id){
    var isResolved = !!resolvedMissed[id];
    document.getElementById('miss-cta-' + id).style.display = isResolved ? 'none' : 'inline-flex';
    var fb = document.getElementById('miss-feedback-' + id);
    fb.classList.toggle('show', isResolved);
    fb.innerHTML = isResolved
      ? '<span>' + missedActions[id].done + '</span><button class="undo" onclick="undoMissed(\'' + id + '\')">Undo</button>'
      : '';
  }
  function resolveMissed(id){
    var cta = document.getElementById('miss-cta-' + id);
    cta.disabled = true;
    cta.classList.add('pending');
    simulateRequest(
      function(){
        resolvedMissed[id] = true;
        MockState.save('desktop-feed:resolved-missed', resolvedMissed);
      },
      {
        onSuccess: function(){
          cta.disabled = false;
          cta.classList.remove('pending');
          renderMissed(id);
          announce(missedActions[id].announce);
          MockSync.broadcast('missed-resolved', { id: id });
        }
      }
    );
  }
  function undoMissed(id){
    delete resolvedMissed[id];
    MockState.save('desktop-feed:resolved-missed', resolvedMissed);
    renderMissed(id);
    announce('Undone — item restored to missed list.');
  }
  Object.keys(missedActions).forEach(renderMissed);

  // ---------- nudge: same pattern ----------
  var nudgeResolution = MockState.load('desktop-feed:nudge', null); // 'moved' | 'dismissed' | null
  function renderNudge(){
    var resolved = !!nudgeResolution;
    document.getElementById('nudge-actions').style.display = resolved ? 'none' : 'flex';
    var fb = document.getElementById('nudge-feedback');
    fb.classList.toggle('show', resolved);
    if(nudgeResolution === 'moved'){
      fb.innerHTML = '<span>✓ Moved to 8:40am</span><button class="undo" onclick="undoNudge()">Undo</button>';
    } else if(nudgeResolution === 'dismissed'){
      fb.innerHTML = '<span style="color:var(--text-muted)">Dismissed — won\'t ask again this week</span><button class="undo" onclick="undoNudge()">Undo</button>';
    } else {
      fb.innerHTML = '';
    }
  }
  function resolveNudge(kind){
    var actions = document.getElementById('nudge-actions');
    actions.classList.add('pending');
    simulateRequest(
      function(){
        nudgeResolution = kind;
        MockState.save('desktop-feed:nudge', kind);
      },
      {
        onSuccess: function(){
          actions.classList.remove('pending');
          renderNudge();
          announce(kind === 'moved' ? 'Reading task moved to 8:40 AM.' : 'Nudge dismissed for this week.');
          MockSync.broadcast('nudge-resolved', { kind: kind });
        }
      }
    );
  }
  function undoNudge(){
    nudgeResolution = null;
    MockState.save('desktop-feed:nudge', null);
    renderNudge();
    announce('Undone — nudge restored.');
  }
  renderNudge();

  // ---------- kudos: same pattern ----------
  var kudosResolution = MockState.load('desktop-feed:kudos', null); // 'sent' | 'skipped' | null
  function renderKudos(){
    var resolved = !!kudosResolution;
    document.getElementById('kudos-actions').style.display = resolved ? 'none' : 'flex';
    var fb = document.getElementById('kudos-feedback');
    fb.classList.toggle('show', resolved);
    if(kudosResolution === 'sent'){
      fb.innerHTML = '<span>✓ Kudos sent to Jordan</span><button class="undo" onclick="undoKudos()">Undo</button>';
    } else if(kudosResolution === 'skipped'){
      fb.innerHTML = '<span style="color:var(--text-muted)">Skipped — we\'ll surface this less often</span><button class="undo" onclick="undoKudos()">Undo</button>';
    } else {
      fb.innerHTML = '';
    }
  }
  function resolveKudos(kind){
    var actions = document.getElementById('kudos-actions');
    actions.classList.add('pending');
    simulateRequest(
      function(){
        kudosResolution = kind;
        MockState.save('desktop-feed:kudos', kind);
      },
      {
        onSuccess: function(){
          actions.classList.remove('pending');
          renderKudos();
          announce(kind === 'sent' ? 'Kudos sent to Jordan.' : 'Kudos skipped.');
          MockSync.broadcast('kudos-resolved', { kind: kind });
        }
      }
    );
  }
  function undoKudos(){
    kudosResolution = null;
    MockState.save('desktop-feed:kudos', null);
    renderKudos();
    announce('Undone — kudos restored.');
  }
  renderKudos();

  // ---------- nav modals ----------
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

  // ---------- restore persisted view state on load ----------
  // Default depends on onboarding: if onboarding has never been finished
  // (checked via MockState, which is what survives between separate page
  // loads), show the "new user" state instead of hardcoding 'active'.
  setState(MockState.load(
    'desktop-feed:view-state',
    MockState.load('onboarding-complete', false) ? 'active' : 'new'
  ));

  // If onboarding finishes while this mockup happens to be open in the
  // other pane during compare mode, flip live instead of waiting for a
  // reload — this is the "second job" MockSync does that MockState can't:
  // reacting to something that just happened in a sibling iframe.
  MockSync.listen('onboarding-finished', function(){
    setState('active');
  });