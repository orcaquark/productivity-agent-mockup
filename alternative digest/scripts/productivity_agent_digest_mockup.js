// ---------- shared utilities (see ../shared/mockup-shared.js) ----------
  var announce = MockShared.announce;
  var simulateRequest = MockShared.simulateRequest;
  var MockState = MockShared.MockState;
  var MockSync = MockShared.MockSync;

  function setState(s){
    document.getElementById('state-active').style.display = (s==='active') ? 'block' : 'none';
    document.getElementById('state-new').style.display = (s==='new') ? 'block' : 'none';
    document.getElementById('pill-active').classList.toggle('active', s==='active');
    document.getElementById('pill-new').classList.toggle('active', s==='new');
    MockState.save('digest:view-state', s);
  }

  // Generalized why-panel disclosure — panel/button ids are always
  // "<id>-panel" / "<id>-btn" in this mockup, so this one function covers
  // every disclosure instead of one per card (there's currently only one,
  // but this is how the file already generalized it before these changes).
  function toggleDisclosure(id){
    var panel = document.getElementById(id + '-panel');
    var btn = document.getElementById(id + '-btn');
    var open = panel.classList.toggle('open');
    btn.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  // ---------- nudge: persisted, simulated async, announced ----------
  var nudgeResolution = MockState.load('digest:nudge', null); // 'moved' | 'dismissed' | null
  function renderNudge(){
    var resolved = !!nudgeResolution;
    document.getElementById('nudge-actions').style.display = resolved ? 'none' : 'block';
    var r = document.getElementById('nudge-resolved');
    r.classList.toggle('show', resolved);
    if(nudgeResolution === 'moved'){
      r.innerHTML = '<span>Moved to 8:40am ✓</span><button class="undo" onclick="undoNudge()">Undo</button>';
    } else if(nudgeResolution === 'dismissed'){
      r.innerHTML = '<span style="color:var(--text-muted)">Dismissed — won\'t ask again this week</span><button class="undo" onclick="undoNudge()">Undo</button>';
    } else {
      r.innerHTML = '';
    }
  }
  function resolveNudge(kind){
    var actions = document.getElementById('nudge-actions');
    actions.classList.add('pending');
    simulateRequest(
      function(){
        nudgeResolution = kind;
        MockState.save('digest:nudge', kind);
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
    MockState.save('digest:nudge', null);
    renderNudge();
    announce('Undone — nudge restored.');
  }
  renderNudge();

  // ---------- missed-task follow-ups: same pattern ----------
  var missedActions = {
    expense: { done: 'Moved to today ✓', announce: 'Expense report moved to today.' },
    dentist: { done: 'Time block added ✓', announce: 'Time block added for calling the dentist.' }
  };
  var resolvedMissed = MockState.load('digest:resolved-missed', {});
  function renderMissed(id){
    var isResolved = !!resolvedMissed[id];
    document.getElementById('miss-cta-' + id).style.display = isResolved ? 'none' : 'inline';
    document.getElementById('miss-resolved-' + id).innerHTML = isResolved
      ? '<span>' + missedActions[id].done + '</span><button class="undo" onclick="undoMissed(\'' + id + '\')">Undo</button>'
      : '';
  }
  function resolveMissed(id){
    var cta = document.getElementById('miss-cta-' + id);
    cta.classList.add('pending');
    simulateRequest(
      function(){
        resolvedMissed[id] = true;
        MockState.save('digest:resolved-missed', resolvedMissed);
      },
      {
        onSuccess: function(){
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
    MockState.save('digest:resolved-missed', resolvedMissed);
    renderMissed(id);
    announce('Undone — item restored to missed list.');
  }
  Object.keys(missedActions).forEach(renderMissed);

  // ---------- kudos: same pattern ----------
  var kudosResolution = MockState.load('digest:kudos', null); // 'sent' | 'skipped' | null
  function renderKudos(){
    var resolved = !!kudosResolution;
    document.getElementById('kudos-actions').style.display = resolved ? 'none' : 'inline';
    var r = document.getElementById('kudos-resolved');
    if(kudosResolution === 'sent'){
      r.innerHTML = '<span>Kudos sent to Jordan ✓</span><button class="undo" onclick="undoKudos()">Undo</button>';
    } else if(kudosResolution === 'skipped'){
      r.innerHTML = '<span style="color:var(--text-muted)">Skipped — we\'ll surface this less often</span><button class="undo" onclick="undoKudos()">Undo</button>';
    } else {
      r.innerHTML = '';
    }
  }
  function resolveKudos(kind){
    var actions = document.getElementById('kudos-actions');
    actions.classList.add('pending');
    simulateRequest(
      function(){
        kudosResolution = kind;
        MockState.save('digest:kudos', kind);
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
    MockState.save('digest:kudos', null);
    renderKudos();
    announce('Undone — kudos restored.');
  }
  renderKudos();

  // ---------- nav modals ----------
  var navModalContent = {
    ring: {
      icon: '🔗',
      title: 'This would open Rings',
      body: 'In the real app, this deep-links to the Rings tab scoped to <b>Gym</b> — it doesn\'t close the ring from here. Closing a ring likely involves more than one tap (duration, reps, streak), so this mockup shows the intended destination instead of faking that interaction.'
    },
    friends: {
      icon: '👥',
      title: 'This would open Friends',
      body: 'In the real app, this deep-links to the Friends tab to search for and add someone. Adding a friend involves sending a request and waiting on their acceptance — more than a single tap — so this mockup shows the intended destination instead of faking that flow.'
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

  // ---------- keyboard support for div-as-button interactive elements ----------
  // This file had no such binding at all before — a real accessibility gap
  // for any keyboard-only reviewer stepping through the mockup.
  MockShared.initKeyboardSupport();

  // ---------- restore persisted view state on load ----------
  setState(MockState.load(
    'digest:view-state',
    MockState.load('onboarding-complete', false) ? 'active' : 'new'
  ));
  MockSync.listen('onboarding-finished', function(){
    setState('active');
  });