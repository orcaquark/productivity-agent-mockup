  function setState(s){
    document.getElementById('state-active').style.display = (s==='active') ? 'block' : 'none';
    document.getElementById('state-new').style.display = (s==='new') ? 'block' : 'none';
    document.getElementById('pill-active').classList.toggle('active', s==='active');
    document.getElementById('pill-new').classList.toggle('active', s==='new');
  }

  function toggleDisclosure(id){
    var panel = document.getElementById(id + '-panel');
    var btn = document.getElementById(id + '-btn');
    var open = panel.classList.toggle('open');
    btn.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function resolveNudge(kind){
    document.getElementById('nudge-actions').style.display = 'none';
    var r = document.getElementById('nudge-resolved');
    r.classList.add('show');
    if(kind === 'moved'){
      r.innerHTML = '<span>Moved to 8:40am ✓</span><button class="undo" onclick="undoNudge()">Undo</button>';
    } else {
      r.innerHTML = '<span style="color:var(--text-muted)">Dismissed — won\'t ask again this week</span><button class="undo" onclick="undoNudge()">Undo</button>';
    }
  }
  function undoNudge(){
    document.getElementById('nudge-actions').style.display = 'block';
    var r = document.getElementById('nudge-resolved');
    r.classList.remove('show');
    r.innerHTML = '';
  }

  var missedCopy = {
    expense: 'Moved to today ✓',
    dentist: 'Time block added ✓'
  };
  function resolveMissed(id){
    document.getElementById('miss-cta-' + id).style.display = 'none';
    document.getElementById('miss-resolved-' + id).innerHTML =
      '<span>' + missedCopy[id] + '</span><button class="undo" onclick="undoMissed(\'' + id + '\')">Undo</button>';
  }
  function undoMissed(id){
    document.getElementById('miss-cta-' + id).style.display = 'inline';
    document.getElementById('miss-resolved-' + id).innerHTML = '';
  }

  function resolveKudos(kind){
    document.getElementById('kudos-actions').style.display = 'none';
    var r = document.getElementById('kudos-resolved');
    if(kind === 'sent'){
      r.innerHTML = '<span>Kudos sent to Jordan ✓</span><button class="undo" onclick="undoKudos()">Undo</button>';
    } else {
      r.innerHTML = '<span style="color:var(--text-muted)">Skipped — we\'ll surface this less often</span><button class="undo" onclick="undoKudos()">Undo</button>';
    }
  }
  function undoKudos(){
    document.getElementById('kudos-actions').style.display = 'inline';
    document.getElementById('kudos-resolved').innerHTML = '';
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