  // ---------- generic helpers ----------
  function bindKeyboard(el){
    el.addEventListener('keydown', function(e){
      if(e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        el.click();
      }
    });
  }
  document.querySelectorAll('[tabindex="0"]').forEach(bindKeyboard);

  function toggleSwitch(id){
    var el = document.getElementById(id);
    var on = el.classList.toggle('on');
    el.setAttribute('aria-checked', on ? 'true' : 'false');
  }

  // ---------- audit trail ----------
  var auditLog = [
    { label: 'Peak focus times', value: 'Early AM, Mid AM', when: 'Jul 18 · inferred from your activity' },
    { label: 'Tone preference', value: 'Direct', when: 'Jul 12 · set during onboarding' },
    { label: 'Planning style', value: 'Night-before', when: 'Jul 12 · set during onboarding' }
  ];
  function logAuditChange(label, value){
    auditLog.unshift({ label: label, value: value, when: 'Just now · you changed this' });
  }
  function openAuditSheet(){
    document.getElementById('sheet-icon').textContent = '🕘';
    document.getElementById('sheet-title').textContent = "What's changed";
    document.getElementById('sheet-body').innerHTML = auditLog.map(function(e){
      return '<b>' + e.label + '</b> → ' + e.value + '<br><span style="color:var(--text-faint);font-size:10.5px;">' + e.when + '</span>';
    }).join('<br><br>');
    var actionsEl = document.getElementById('sheet-actions');
    actionsEl.innerHTML = '';
    var closeBtn = document.createElement('div');
    closeBtn.className = 'sheet-btn cancel';
    closeBtn.textContent = 'Close';
    closeBtn.setAttribute('tabindex', '0');
    closeBtn.setAttribute('role', 'button');
    closeBtn.onclick = closeSheet;
    bindKeyboard(closeBtn);
    actionsEl.appendChild(closeBtn);
    document.getElementById('sheet-overlay').style.display = 'flex';
  }

  // ---------- learned-traits rows ----------
  var planningOptions = ['Night-before','Morning of','No real plan','Varies week to week'];
  var planningIndex = 0;
  function cyclePlanning(){
    planningIndex = (planningIndex + 1) % planningOptions.length;
    var val = planningOptions[planningIndex];
    document.getElementById('planning-text').textContent = val;
    logAuditChange('Planning style', val);
  }

  var toneOptions = ['Direct','Cheerful','Quiet'];
  var toneIndex = 0;
  function cycleTone(){
    toneIndex = (toneIndex + 1) % toneOptions.length;
    var val = toneOptions[toneIndex];
    document.getElementById('tone-text').textContent = val;
    logAuditChange('Tone preference', val);
  }

  function toggleFocusPanel(){
    document.getElementById('focus-panel').classList.toggle('open');
  }
  function toggleFocusChip(el){
    el.classList.toggle('selected');
    updateFocusSummary();
    var selected = Array.from(document.querySelectorAll('.fchip.selected')).map(function(c){ return c.textContent; });
    logAuditChange('Peak focus times', selected.length ? selected.join(', ') : 'No pattern yet');
  }
  function updateFocusSummary(){
    var selected = Array.from(document.querySelectorAll('.fchip.selected')).map(function(c){ return c.textContent; });
    var wrap = document.getElementById('focus-pill-wrap');
    if(selected.length === 0){
      wrap.innerHTML = '<span style="font-size:11px;color:var(--text-faint);">No pattern yet</span>';
    } else {
      wrap.innerHTML = selected.map(function(s){ return '<div class="pill">' + s + '</div>'; }).join('');
    }
  }

  function resetLearnedValues(){
    planningIndex = 0;
    toneIndex = 0;
    document.getElementById('planning-text').textContent = 'Not set yet';
    document.getElementById('tone-text').textContent = 'Not set yet';
    document.querySelectorAll('.fchip').forEach(function(c){ c.classList.remove('selected'); });
    updateFocusSummary();
    auditLog.unshift({ label: 'Personalization', value: 'Reset to defaults', when: 'Just now · you reset this' });
  }

  // ---------- nudges ----------
  var freqOptions = [
    { label: 'Light touch', pct: 28 },
    { label: 'Some check-ins', pct: 55 },
    { label: 'Frequent', pct: 85 }
  ];
  var freqIndex = 0;
  function cycleFrequency(){
    freqIndex = (freqIndex + 1) % freqOptions.length;
    var f = freqOptions[freqIndex];
    document.getElementById('freq-label').textContent = f.label;
    document.getElementById('freq-fill').style.width = f.pct + '%';
    document.getElementById('freq-knob').style.left = f.pct + '%';
  }

  var quietOptions = ['9pm–7am','10pm–8am','Off'];
  var quietIndex = 0;
  function cycleQuietHours(){
    quietIndex = (quietIndex + 1) % quietOptions.length;
    document.getElementById('quiet-text').textContent = quietOptions[quietIndex];
  }

  var pauseLabels = { today: 'Paused for the rest of today', week: 'Paused for 1 week', forever: 'Paused until you turn nudges back on' };
  function selectPause(el, value){
    document.querySelectorAll('.pause-pill').forEach(function(p){ p.classList.remove('active'); });
    el.classList.add('active');
    document.getElementById('pause-status').textContent = pauseLabels[value];
  }

  // ---------- appearance ----------
  function setTheme(mode){
    document.querySelectorAll('.seg-btn').forEach(function(b){ b.classList.remove('active'); });
    document.getElementById('seg-' + mode).classList.add('active');
    document.getElementById('phone').classList.toggle('dark-mode', mode === 'dark');
  }

  // ---------- data actions ----------
  function exportData(){
    var note = document.getElementById('export-note');
    note.classList.add('show');
    clearTimeout(window._exportTimer);
    window._exportTimer = setTimeout(function(){ note.classList.remove('show'); }, 4000);
  }

  // ---------- status banner (paused / turned off / deleted) ----------
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
    } else if(kind === 'turnedOff'){
      banner.classList.add('turnedOff');
      text.innerHTML = '<b>Personalization is off.</b> Your tasks and rings are unaffected.';
      action.textContent = 'Turn back on';
      action.onclick = resumeAgent;
      dependent.classList.add('agent-disabled');
    } else if(kind === 'deleted'){
      banner.classList.add('turnedOff');
      text.innerHTML = '<b>Personalization data deleted.</b> Your patterns and history are gone — we&#39;ll start learning your personalization again from scratch. Tasks and rings are unaffected.';
      action.textContent = 'Dismiss';
      action.onclick = resumeAgent;
      dependent.classList.remove('agent-disabled');
    }
    banner.classList.add('show');
  }
  function resumeAgent(){
    document.getElementById('status-banner').classList.remove('show');
    document.getElementById('agent-dependent-sections').classList.remove('agent-disabled');
  }

  // ---------- confirmation / info sheet ----------
  var sheetContent = {
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
            clearTimeout(window._resetTimer);
            window._resetTimer = setTimeout(function(){ note.classList.remove('show'); }, 4000);
          } }
      ]
    },
    data: {
      icon: '🔍',
      title: 'What this uses',
      body: "Planning style and tone come directly from your onboarding answers. Peak focus times are inferred from your last 30 days of task completions, refreshed nightly. None of this is shared with friends, and none of it leaves your account unless you tap Export.",
      actions: [
        { label: 'Got it', style: 'primary', onClick: function(){} }
      ]
    }
  };

  function openSheet(kind){
    var c = sheetContent[kind];
    document.getElementById('sheet-icon').textContent = c.icon;
    document.getElementById('sheet-title').textContent = c.title;
    document.getElementById('sheet-body').innerHTML = c.body;

    var actionsEl = document.getElementById('sheet-actions');
    actionsEl.innerHTML = '';
    c.actions.forEach(function(a){
      var btn = document.createElement('div');
      btn.className = 'sheet-btn ' + (a.style || '');
      btn.textContent = a.label;
      btn.setAttribute('tabindex', '0');
      btn.setAttribute('role', 'button');
      btn.onclick = function(){ a.onClick && a.onClick(); closeSheet(); };
      bindKeyboard(btn);
      actionsEl.appendChild(btn);
    });
    var cancel = document.createElement('div');
    cancel.className = 'sheet-btn cancel';
    cancel.textContent = 'Cancel';
    cancel.setAttribute('tabindex', '0');
    cancel.setAttribute('role', 'button');
    cancel.onclick = closeSheet;
    bindKeyboard(cancel);
    actionsEl.appendChild(cancel);

    document.getElementById('sheet-overlay').style.display = 'flex';
  }
  function closeSheet(){
    document.getElementById('sheet-overlay').style.display = 'none';
  }
  function closeSheetOnBackdrop(e){
    if(e.target.id === 'sheet-overlay') closeSheet();
  }
