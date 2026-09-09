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
  // keyboard support for div-as-button interactive elements
  document.querySelectorAll('[tabindex="0"]').forEach(function(el){
    el.setAttribute('role','button');
    el.addEventListener('keydown', function(e){
      if(e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        el.click();
      }
    });
  });
