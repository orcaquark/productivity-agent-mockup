// ---------- shared utilities (see ../shared/mockup-shared.js) ----------
  var announce = MockShared.announce;
  var simulateRequest = MockShared.simulateRequest;
  var MockState = MockShared.MockState;
  var bindKeyboard = MockShared.bindKeyboard;

  // ---------- sidebar collapse ----------
  function toggleSidebar(){
    document.getElementById('sidebar').classList.toggle('collapsed');
  }

  // ---------- keyboard support for div-as-button interactive elements ----------
  MockShared.initKeyboardSupport();

  // ---------- theme: shared with every other mockup ----------
  var theme = MockShared.createThemeController({
    storageKey: 'theme',
    defaultMode: 'light'
  });
  function setTheme(mode){ theme.setTheme(mode); }
  function quickToggleTheme(){ theme.quickToggle(); }


  // ---------- toggle switches: persisted by element id ----------
  var toggleState = MockState.load('desktop-settings:toggles', {});
  function toggleSwitch(id){
    var el = document.getElementById(id);
    var on = el.classList.toggle('on');
    el.setAttribute('aria-checked', on ? 'true' : 'false');
    toggleState[id] = on;
    MockState.save('desktop-settings:toggles', toggleState);
  }
  function restoreToggles(){
    Object.keys(toggleState).forEach(function(id){
      var el = document.getElementById(id);
      if(!el) return;
      el.classList.toggle('on', toggleState[id]);
      el.setAttribute('aria-checked', toggleState[id] ? 'true' : 'false');
    });
  }
  restoreToggles();

  // ---------- audit trail: persisted so history survives a reload ----------
  var auditLog = MockState.load('desktop-settings:audit-log', [
    { label: 'Peak focus times', value: 'Early AM, Mid AM', when: 'Jul 18 · inferred from your activity' },
    { label: 'Tone preference', value: 'Direct', when: 'Jul 12 · set during onboarding' },
    { label: 'Planning style', value: 'Night-before', when: 'Jul 12 · set during onboarding' }
  ]);
  function logAuditChange(label, value){
    auditLog.unshift({ label: label, value: value, when: 'Just now · you changed this' });
    MockState.save('desktop-settings:audit-log', auditLog);
  }
  function openAuditModal(){
    document.getElementById('modal-icon').textContent = '🕘';
    document.getElementById('modal-title').textContent = "What's changed";
    document.getElementById('modal-body').innerHTML = auditLog.map(function(e){
      return '<b>' + e.label + '</b> → ' + e.value + '<br><span style="color:var(--text-faint);font-size:10.5px;">' + e.when + '</span>';
    }).join('<br><br>');
    var actionsEl = document.getElementById('modal-actions');
    actionsEl.innerHTML = '';
    var closeBtn = document.createElement('div');
    closeBtn.className = 'modal-btn2 cancel';
    closeBtn.textContent = 'Close';
    closeBtn.setAttribute('tabindex', '0');
    closeBtn.setAttribute('role', 'button');
    closeBtn.onclick = closeModal;
    bindKeyboard(closeBtn);
    actionsEl.appendChild(closeBtn);
    document.getElementById('modal-overlay').classList.add('open');
  }

  // ---------- learned-traits rows: selection persisted, restored on load ----------
  var learnedState = MockState.load('desktop-settings:learned', { planning: null, tone: null, focus: [] });

  function togglePlanningPanel(){
    document.getElementById('planning-panel').classList.toggle('open');
  }
  function selectPlanningChip(el){
    document.querySelectorAll('#planning-chip-grid .fchip').forEach(function(c){ c.classList.remove('selected'); });
    el.classList.add('selected');
    var val = el.textContent;
    document.getElementById('planning-pill-wrap').innerHTML = '<div class="pill">' + val + '</div>';
    logAuditChange('Planning style', val);
    learnedState.planning = val;
    MockState.save('desktop-settings:learned', learnedState);
    announce('Planning style set to ' + val + '.');
  }

  function toggleTonePanel(){
    document.getElementById('tone-panel').classList.toggle('open');
  }
  function selectToneChip(el){
    document.querySelectorAll('#tone-chip-grid .fchip').forEach(function(c){ c.classList.remove('selected'); });
    el.classList.add('selected');
    var val = el.textContent;
    document.getElementById('tone-pill-wrap').innerHTML = '<div class="pill">' + val + '</div>';
    logAuditChange('Tone preference', val);
    learnedState.tone = val;
    MockState.save('desktop-settings:learned', learnedState);
    announce('Tone preference set to ' + val + '.');
  }

  function toggleFocusPanel(){
    document.getElementById('focus-panel').classList.toggle('open');
  }
  function toggleFocusChip(el){
    el.classList.toggle('selected');
    updateFocusSummary();
    var selected = Array.from(document.querySelectorAll('#focus-chip-grid .fchip.selected')).map(function(c){ return c.textContent; });
    logAuditChange('Peak focus times', selected.length ? selected.join(', ') : 'No pattern yet');
    learnedState.focus = selected;
    MockState.save('desktop-settings:learned', learnedState);
  }
  function updateFocusSummary(){
    var selected = Array.from(document.querySelectorAll('#focus-chip-grid .fchip.selected')).map(function(c){ return c.textContent; });
    var wrap = document.getElementById('focus-pill-wrap');
    if(selected.length === 0){
      wrap.innerHTML = '<span style="font-size:11px;color:var(--text-faint);">No pattern yet</span>';
    } else {
      wrap.innerHTML = selected.map(function(s){ return '<div class="pill">' + s + '</div>'; }).join('');
    }
  }
  function restoreLearnedValues(){
    if(learnedState.planning){
      document.querySelectorAll('#planning-chip-grid .fchip').forEach(function(c){
        if(c.textContent === learnedState.planning) c.classList.add('selected');
      });
      document.getElementById('planning-pill-wrap').innerHTML = '<div class="pill">' + learnedState.planning + '</div>';
    }
    if(learnedState.tone){
      document.querySelectorAll('#tone-chip-grid .fchip').forEach(function(c){
        if(c.textContent === learnedState.tone) c.classList.add('selected');
      });
      document.getElementById('tone-pill-wrap').innerHTML = '<div class="pill">' + learnedState.tone + '</div>';
    }
    if(learnedState.focus && learnedState.focus.length){
      document.querySelectorAll('#focus-chip-grid .fchip').forEach(function(c){
        if(learnedState.focus.indexOf(c.textContent) !== -1) c.classList.add('selected');
      });
    }
    updateFocusSummary();
  }
  restoreLearnedValues();

  function resetLearnedValues(){
    document.querySelectorAll('#planning-chip-grid .fchip, #tone-chip-grid .fchip, #focus-chip-grid .fchip').forEach(function(c){ c.classList.remove('selected'); });
    document.getElementById('planning-pill-wrap').innerHTML = '<span style="font-size:11px;color:var(--text-faint);">Not set yet</span>';
    document.getElementById('tone-pill-wrap').innerHTML = '<span style="font-size:11px;color:var(--text-faint);">Not set yet</span>';
    updateFocusSummary();
    logAuditChange('Personalization', 'Reset to defaults');
    learnedState = { planning: null, tone: null, focus: [] };
    MockState.save('desktop-settings:learned', learnedState);
  }

  // ---------- nudges: frequency + quiet hours, persisted ----------
  var freqLabels = ['Light touch', 'Some check-ins', 'Frequent'];
  var freqIndex = MockState.load('desktop-settings:freq-index', 0);
  function renderFrequency(){
    for(var i=0;i<3;i++){
      document.getElementById('freq-' + i).classList.toggle('active', i === freqIndex);
    }
  }
  function setFrequency(idx){
    freqIndex = idx;
    renderFrequency();
    logAuditChange('Nudge frequency', freqLabels[idx]);
    MockState.save('desktop-settings:freq-index', idx);
    announce('Nudge frequency set to ' + freqLabels[idx] + '.');
  }
  renderFrequency();

  function toggleQuietPanel(){
    document.getElementById('quiet-panel').classList.toggle('open');
  }
  var quietSelection = MockState.load('desktop-settings:quiet', null);
  function selectQuietChip(el){
    document.querySelectorAll('#quiet-chip-grid .fchip').forEach(function(c){ c.classList.remove('selected'); });
    el.classList.add('selected');
    quietSelection = el.textContent;
    document.getElementById('quiet-pill-wrap').innerHTML = '<div class="pill">' + quietSelection + '</div>';
    MockState.save('desktop-settings:quiet', quietSelection);
    announce('Quiet hours set to ' + quietSelection + '.');
  }
  if(quietSelection){
    document.querySelectorAll('#quiet-chip-grid .fchip').forEach(function(c){
      if(c.textContent === quietSelection) c.classList.add('selected');
    });
    document.getElementById('quiet-pill-wrap').innerHTML = '<div class="pill">' + quietSelection + '</div>';
  }

  var pauseLabels = { today: 'Paused for the rest of today', week: 'Paused for 1 week', forever: 'Paused until you turn nudges back on' };
  function selectPause(el, value){
    document.querySelectorAll('.pause-pill').forEach(function(p){ p.classList.remove('active'); });
    el.classList.add('active');
    document.getElementById('pause-status').textContent = pauseLabels[value];
  }

  // ---------- data actions: simulated round trip + announced outcome ----------
  function exportData(){
    simulateRequest(function(){}, {
      onSuccess: function(){
        var note = document.getElementById('export-note');
        note.classList.add('show');
        announce('Personalization data exported.');
        clearTimeout(window._exportTimer);
        window._exportTimer = setTimeout(function(){ note.classList.remove('show'); }, 4000);
      }
    });
  }

  // ---------- status banner (paused / turned off / deleted), persisted ----------
  var bannerState = MockState.load('desktop-settings:banner', null); // { kind, detail } | null

  function showBanner(kind, detail){
    var banner = document.getElementById('status-banner');
    var text = document.getElementById('sb-text');
    var action = document.getElementById('sb-action');
    var dependent = document.getElementById('agent-dependent-sections');

    banner.classList.remove('turnedOff');

    if(kind === 'paused'){
      text.innerHTML = '<b>Personalization paused.</b> Nudges, briefings, and reports are off ' + detail + '.';
      action.textContent = 'Resume now';
      action.onclick = resumeAgent;
      dependent.classList.add('agent-disabled');
      announce('Personalization paused ' + detail + '.');
    } else if(kind === 'turnedOff'){
      banner.classList.add('turnedOff');
      text.innerHTML = '<b>Personalization is off.</b> Your tasks and rings are unaffected.';
      action.textContent = 'Turn back on';
      action.onclick = resumeAgent;
      dependent.classList.add('agent-disabled');
      announce('Personalization turned off.');
    } else if(kind === 'deleted'){
      banner.classList.add('turnedOff');
      text.innerHTML = '<b>Personalization data deleted.</b> Your patterns and history are gone — we\'ll start learning your personalization again from scratch. Tasks and rings are unaffected.';
      action.textContent = 'Dismiss';
      action.onclick = resumeAgent;
      dependent.classList.remove('agent-disabled');
      announce('Personalization data deleted.');
    }
    banner.classList.add('show');

    bannerState = { kind: kind, detail: detail };
    MockState.save('desktop-settings:banner', bannerState);
  }
  function resumeAgent(){
    document.getElementById('status-banner').classList.remove('show');
    document.getElementById('agent-dependent-sections').classList.remove('agent-disabled');
    bannerState = null;
    MockState.save('desktop-settings:banner', null);
    announce('Personalization resumed.');
  }
  if(bannerState) showBanner(bannerState.kind, bannerState.detail);

  // ---------- confirmation / info modal ----------
  var modalContent = {
    pause: {
      icon: '⏸️',
      title: 'Pause personalization?',
      body: "Nudges, briefings, and reports all stop until you resume. Nothing is deleted, and your settings stay exactly as they are.",
      actions: [
        { label: 'Pause for 1 day', style: 'primary', onClick: function(){ showBanner('paused', 'for 1 day'); } },
        { label: 'Pause for 1 week', style: 'primary', onClick: function(){ showBanner('paused', 'for 1 week'); } },
        { label: 'Pause until I resume', style: 'primary', onClick: function(){ showBanner('paused', 'until you resume'); } }
      ]
    },
    turnoff: {
      icon: '⚠️',
      title: 'Turn off personalization?',
      body: "You'll stop receiving nudges, briefings, and trend reports. Your tasks and rings stay exactly as they are. <b>This won't delete anything</b> — you can turn personalization back on later and pick up where you left off.",
      actions: [
        { label: 'Turn off personalization', style: 'danger', onClick: function(){ showBanner('turnedOff'); } }
      ]
    },
    delete: {
      icon: '⚠️',
      title: 'Delete all personalization data?',
      body: "This permanently erases everything we've learned for your personalization — your patterns, nudge history, and trend data. <b>This cannot be undone.</b> Your tasks and rings themselves are not affected.",
      actions: [
        { label: 'Delete everything', style: 'danger', onClick: function(){ resetLearnedValues(); showBanner('deleted'); } }
      ]
    },
    reset: {
      icon: '↺',
      title: 'Reset your personalization?',
      body: "Clears your planning style, tone, and focus-time pattern back to defaults. Your task and ring history is not affected, and personalization will start learning again from scratch.",
      actions: [
        { label: 'Reset preferences', style: 'danger', onClick: function(){
            resetLearnedValues();
            var note = document.getElementById('reset-note');
            note.classList.add('show');
            announce('Personalization reset to defaults.');
            clearTimeout(window._resetTimer);
            window._resetTimer = setTimeout(function(){ note.classList.remove('show'); }, 4000);
          } }
      ]
    },
    data: {
      icon: '🔍',
      title: 'What this uses',
      body: "Planning style and tone come directly from your onboarding answers. Peak focus times are inferred from your last 30 days of task completions, refreshed nightly. None of this is shared with friends, and none of it leaves your account unless you click Export.",
      actions: [
        { label: 'Got it', style: 'primary', onClick: function(){} }
      ]
    }
  };

  function openModal(kind){
    var c = modalContent[kind];
    document.getElementById('modal-icon').textContent = c.icon;
    document.getElementById('modal-title').textContent = c.title;
    document.getElementById('modal-body').innerHTML = c.body;

    var actionsEl = document.getElementById('modal-actions');
    actionsEl.innerHTML = '';
    c.actions.forEach(function(a){
      var btn = document.createElement('div');
      btn.className = 'modal-btn2 ' + (a.style || '');
      btn.textContent = a.label;
      btn.setAttribute('tabindex', '0');
      btn.setAttribute('role', 'button');
      btn.onclick = function(){
        // Every confirmation action gets a brief simulated round trip —
        // pausing, deleting, or resetting personalization would all hit
        // the real backend once this ships, so the mockup shouldn't
        // resolve instantly.
        actionsEl.querySelectorAll('.modal-btn2').forEach(function(b){ b.classList.add('pending'); });
        simulateRequest(function(){ a.onClick && a.onClick(); }, {
          onSuccess: function(){ closeModal(); }
        });
      };
      bindKeyboard(btn);
      actionsEl.appendChild(btn);
    });
    var cancel = document.createElement('div');
    cancel.className = 'modal-btn2 cancel';
    cancel.textContent = 'Cancel';
    cancel.setAttribute('tabindex', '0');
    cancel.setAttribute('role', 'button');
    cancel.onclick = closeModal;
    bindKeyboard(cancel);
    actionsEl.appendChild(cancel);

    document.getElementById('modal-overlay').classList.add('open');
  }
  function closeModal(){
    document.getElementById('modal-overlay').classList.remove('open');
  }