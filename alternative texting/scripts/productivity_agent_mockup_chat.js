// ---------- shared utilities (see ../shared/mockup-shared.js) ----------
  var announce = MockShared.announce;
  var simulateRequest = MockShared.simulateRequest;
  var MockState = MockShared.MockState;
  var MockSync = MockShared.MockSync;

  var currentState = 'active';

  function activeLogEl(){
    return document.getElementById(currentState === 'new' ? 'log-new' : 'log-active');
  }
  function scrollLogBottom(){
    var scrollEl = document.querySelector('.scroll');
    scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  function setState(s){
    currentState = s;
    document.getElementById('log-active').style.display = (s==='active') ? 'flex' : 'none';
    document.getElementById('log-new').style.display = (s==='new') ? 'flex' : 'none';
    document.getElementById('pill-active').classList.toggle('active', s==='active');
    document.getElementById('pill-new').classList.toggle('active', s==='new');
    document.getElementById('chat-sub').textContent = (s==='new')
      ? "Just getting started — nothing sent yet"
      : "Sends a new thread most evenings";
    MockState.save('texting:view-state', s);
  }

  function toggleWhy(){
    MockShared.toggleWhy('why-panel', 'why-btn');
  }

  // ---------- trend: view choice persisted across reloads ----------
  var trendMonthOpen = MockState.load('texting:trend-month-open', false);
  function renderTrendView(){
    document.getElementById('trend-week-view').style.display = trendMonthOpen ? 'none' : 'block';
    document.getElementById('trend-month-view').style.display = trendMonthOpen ? 'block' : 'none';
    document.getElementById('trend-big').innerHTML = trendMonthOpen ? '69<small>%</small>' : '82<small>%</small>';
    document.getElementById('trend-delta').textContent = trendMonthOpen ? 'trending up over 4 weeks' : '↑ steadier than last week';
    document.getElementById('trend-note').textContent = trendMonthOpen
      ? "Each bar averages a full week. The climb tracks with your focus-time nudges landing more consistently."
      : "Tuesday's dip lines up with the team offsite, not a slip.";
    document.getElementById('trend-toggle-btn').textContent = trendMonthOpen ? '← Back to this week' : 'See full month →';
  }
  function toggleTrendView(){
    trendMonthOpen = !trendMonthOpen;
    MockState.save('texting:trend-month-open', trendMonthOpen);
    renderTrendView();
  }
  renderTrendView();

  function openRing(name){
    document.getElementById('ring-modal-name').textContent = name;
    document.getElementById('ring-modal-overlay').classList.add('open');
  }
  function closeRingModal(){
    document.getElementById('ring-modal-overlay').classList.remove('open');
  }

  /* ===== Conversational reply mechanic =====
     Tap a chip -> it hides -> a right-aligned echo bubble appends -> a brief typing
     indicator -> a left-aligned confirmation bubble appends. Reversible actions get
     their own Undo, which removes both new bubbles and restores the chip.

     The typing indicator IS this mockup's own pending-state affordance — it already
     communicates "in flight" the way a dimmed button does elsewhere, so sendReply()
     below uses MockShared.simulateRequest for its delay instead of adding a second,
     redundant pending visual on top of it. */

  function buildEcho(text){
    var row = document.createElement('div');
    row.className = 'msg-group mine';
    var b = document.createElement('div');
    b.className = 'bubble mine';
    b.textContent = text;
    var t = document.createElement('div');
    t.className = 'msg-time';
    t.textContent = 'Just now';
    row.appendChild(b);
    row.appendChild(t);
    return row;
  }
  function buildTyping(){
    var row = document.createElement('div');
    row.className = 'msg-group';
    var b = document.createElement('div');
    b.className = 'bubble';
    b.innerHTML = '<div class="typing-bubble"><span></span><span></span><span></span></div>';
    row.appendChild(b);
    return row;
  }
  function buildConfirm(text, tone, onUndo){
    var row = document.createElement('div');
    row.className = 'msg-group';
    var b = document.createElement('div');
    b.className = 'bubble confirm';
    var ct = document.createElement('div');
    ct.className = 'confirm-text ' + tone;
    var span = document.createElement('span');
    span.textContent = text;
    ct.appendChild(span);
    if(onUndo){
      var undoBtn = document.createElement('button');
      undoBtn.className = 'undo';
      undoBtn.type = 'button';
      undoBtn.textContent = 'Undo';
      undoBtn.addEventListener('click', onUndo);
      ct.appendChild(undoBtn);
    }
    b.appendChild(ct);
    row.appendChild(b);
    var t = document.createElement('div');
    t.className = 'msg-time';
    t.textContent = 'Just now';
    row.appendChild(t);
    return row;
  }

  // ---------- persisted reply history ----------
  // Each record is self-contained (echo/confirm text, tone, which log and
  // chip it belongs to) so restoreResolvedReplies() can rebuild the exact
  // bubbles on the next page load without re-deriving them from "kind".
  var resolvedReplies = MockState.load('texting:resolved', []);
  function saveResolvedReplies(){
    MockState.save('texting:resolved', resolvedReplies);
  }

  function sendReply(chipEl, echoText, confirmText, tone, restoreDisplay){
    chipEl.style.display = 'none';
    var log = activeLogEl();

    var echoRow = buildEcho(echoText);
    log.appendChild(echoRow);
    scrollLogBottom();

    var typingRow = buildTyping();
    log.appendChild(typingRow);
    scrollLogBottom();

    simulateRequest(function(){}, {
      delay: 550,
      onSuccess: function(){
        typingRow.remove();

        var record = {
          logId: log.id,
          chipId: chipEl.id,
          echoText: echoText,
          confirmText: confirmText,
          tone: tone,
          restoreDisplay: restoreDisplay || null
        };
        var onUndo = restoreDisplay ? function(){
          echoRow.remove();
          confirmRow.remove();
          chipEl.style.display = restoreDisplay;
          resolvedReplies = resolvedReplies.filter(function(r){ return r !== record; });
          saveResolvedReplies();
          announce('Undone.');
        } : null;
        var confirmRow = buildConfirm(confirmText, tone, onUndo);
        log.appendChild(confirmRow);
        scrollLogBottom();

        announce(confirmText);
        resolvedReplies.push(record);
        saveResolvedReplies();
        MockSync.broadcast('reply-sent', record);
      }
    });
  }

  // Rebuilds a persisted reply's bubbles instantly on load — no typing
  // delay, since nothing is actually "sending" again.
  function restoreResolvedReplies(){
    resolvedReplies.slice().forEach(function(record){
      var log = document.getElementById(record.logId);
      var chipEl = document.getElementById(record.chipId);
      if(!log) return;
      if(chipEl) chipEl.style.display = 'none';

      var echoRow = buildEcho(record.echoText);
      log.appendChild(echoRow);

      var onUndo = record.restoreDisplay ? function(){
        echoRow.remove();
        confirmRow.remove();
        if(chipEl) chipEl.style.display = record.restoreDisplay;
        resolvedReplies = resolvedReplies.filter(function(r){ return r !== record; });
        saveResolvedReplies();
        announce('Undone.');
      } : null;
      var confirmRow = buildConfirm(record.confirmText, record.tone, onUndo);
      log.appendChild(confirmRow);
    });
    scrollLogBottom();
  }

  function nudgeReply(kind){
    var chips = document.getElementById('nudge-chips');
    if(kind === 'moved'){
      sendReply(chips, 'Move it', '✓ Moved to 8:40am', 'positive', 'flex');
    } else {
      sendReply(chips, 'Not now', "Dismissed — won't ask again this week", 'muted', 'flex');
    }
  }

  var missCopy = {
    expense: { label:'Move to today', confirm:'✓ Moved "Submit expense report" to today' },
    dentist: { label:'Add a time block', confirm:'✓ Added a time block for "Call dentist"' }
  };
  function missReply(id){
    var chip = document.getElementById('miss-chip-' + id);
    sendReply(chip, missCopy[id].label, missCopy[id].confirm, 'positive', 'inline-flex');
  }

  function kudosReply(kind){
    var chips = document.getElementById('kudos-chips');
    if(kind === 'sent'){
      sendReply(chips, 'Send kudos', '✓ Kudos sent to Jordan', 'positive', 'flex');
    } else {
      sendReply(chips, 'Skip', "Skipped — we'll surface this less often", 'muted', 'flex');
    }
  }

  function addFriendsReply(){
    var chip = document.getElementById('newstate-chip');
    sendReply(chip, 'Add friends', 'This would open the Friends tab in the real app — add someone there to start sending and receiving kudos here.', 'info', null);
  }

  // ---------- keyboard support for div-as-button interactive elements ----------
  MockShared.initKeyboardSupport();

  // ---------- restore persisted view state and reply history on load ----------
  setState(MockState.load(
    'texting:view-state',
    MockState.load('onboarding-complete', false) ? 'active' : 'new'
  ));
  restoreResolvedReplies();
  MockSync.listen('onboarding-finished', function(){
    setState('active');
  });