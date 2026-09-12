// ---------------- card data ----------------
  // Shared utilities (see ../shared/mockup-shared.js).
  var MockState = MockShared.MockState;
  var announce = MockShared.announce;
  var MockSync = MockShared.MockSync;

  var cardDefs = {
    briefing:{ label:"Today's briefing", glyph:"✦", glyphTone:"", kind:"info" },
    nudge:{ label:"Suggested nudge", glyph:"!", glyphTone:"", kind:"decision",
      rightLabel:"Move it", leftLabel:"Not now", rightTone:"violet",
      toastRight:"✓ Moved to 8:40am", toastLeft:"Dismissed — won't ask again this week",
      skipReason:"Move \"Read 20 min\" to 8:40am?" },
    trend:{ label:"This week's pattern", glyph:"~", glyphTone:"sage", kind:"info" },
    missExpense:{ label:"What got missed", glyph:"·", glyphTone:"muted", kind:"decision",
      rightLabel:"Move to today", leftLabel:"Leave for now", rightTone:"violet",
      toastRight:"✓ Moved to today", toastLeft:"Left for now — we'll surface it again tomorrow",
      skipReason:"Submit expense report" },
    missDentist:{ label:"What got missed", glyph:"·", glyphTone:"muted", kind:"decision",
      rightLabel:"Add a time block", leftLabel:"Leave for now", rightTone:"violet",
      toastRight:"✓ Time block added", toastLeft:"Left for now — we'll surface it again tomorrow",
      skipReason:"Call dentist" },
    kudos:{ label:"Worth celebrating", glyph:"♥", glyphTone:"sage", kind:"decision",
      rightLabel:"Send kudos", leftLabel:"Skip", rightTone:"sage",
      toastRight:"✓ Kudos sent to Jordan", toastLeft:"Skipped — we'll surface this less often",
      skipReason:"Kudos for Jordan" }
  };
  var ORDER_ACTIVE = ["briefing","nudge","trend","missExpense","missDentist","kudos"];
  var TOTAL = ORDER_ACTIVE.length;

  var mode = "active";
  var queue = [];
  var resolvedIds = new Set();
  var skipped = [];       // {id, reason}
  var lastAction = null;  // {id, dir}

  // ---------------- content templates ----------------
  function contentTemplate(id){
    switch(id){
      case "briefing": return (
        '<div class="card-label"><span class="lbl"><span class="glyph">✦</span>Today\'s briefing</span></div>' +
        '<div class="briefing-title">A lighter day, mostly mornings</div>' +
        '<div class="briefing-text">You closed <b>4 of 6</b> rings today. Your focus held strongest before noon — that\'s the third day this week your completions cluster before 1pm.</div>' +
        '<div class="chip-row">' +
          '<div class="chip active">✦ Mornings work for you</div>' +
          '<button class="chip task" onclick="openRingModal()"><span class="dot"></span>Gym ring open<span class="go">→</span></button>' +
        '</div>' +
        '<div class="chip-caption">Purple = a pattern we noticed about you · Green = an open ring you can still close today</div>'
      );
      case "nudge": return (
        '<div class="card-label"><span class="lbl"><span class="glyph">!</span>Suggested nudge</span><span class="cap-note">1 of 2 today</span></div>' +
        '<div class="nudge-title">Move "Read 20 min" to 8:40am?</div>' +
        '<div class="nudge-desc">You complete reading tasks 3x more often when they\'re scheduled before your commute.</div>' +
        '<button class="why-link" id="nudge-why-btn" aria-expanded="false" onclick="toggleWhy()">Why am I seeing this</button>' +
        '<div class="why-panel" id="nudge-why-panel">Based on <b>14 days</b> of task timing: reading tasks completed before 9am finished 3x more often than the same task scheduled later. This nudge will stop appearing if you dismiss it twice in a row.</div>'
      );
      case "trend": return (
        '<div class="card-label"><span class="lbl"><span class="glyph sage">~</span>This week\'s pattern</span></div>' +
        '<div class="trend-head"><div class="big" id="trend-big">82<small>%</small></div><div class="delta" id="trend-delta">↑ steadier than last week</div></div>' +
        '<div id="trend-week-view">' +
          '<div class="bars"><div class="bar" style="height:40%"></div><div class="bar" style="height:65%"></div><div class="bar" style="height:50%"></div><div class="bar" style="height:80%"></div><div class="bar" style="height:70%"></div><div class="bar" style="height:90%"></div><div class="bar today" style="height:67%"></div></div>' +
          '<div class="bar-labels"><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span></div>' +
        '</div>' +
        '<div id="trend-month-view" style="display:none;">' +
          '<div class="bars"><div class="bar" style="height:52%"></div><div class="bar" style="height:61%"></div><div class="bar" style="height:74%"></div><div class="bar today" style="height:82%"></div></div>' +
          '<div class="bar-labels"><span>Wk 1</span><span>Wk 2</span><span>Wk 3</span><span>Wk 4</span></div>' +
        '</div>' +
        '<div class="trend-note" id="trend-note">Tuesday\'s dip lines up with the team offsite, not a slip.</div>' +
        '<button class="trend-toggle" id="trend-toggle-btn" onclick="toggleTrend()">See full month →</button>'
      );
      case "missExpense": return (
        '<div class="card-label"><span class="lbl"><span class="glyph muted">·</span>What got missed</span><span class="cap-note">1 of 2</span></div>' +
        '<div class="miss-name">Submit expense report</div>' +
        '<div class="miss-why">Pushed 3 times — usually means it\'s not actually urgent</div>' +
        '<div class="miss-tag">2D AGO</div>'
      );
      case "missDentist": return (
        '<div class="card-label"><span class="lbl"><span class="glyph muted">·</span>What got missed</span><span class="cap-note">2 of 2</span></div>' +
        '<div class="miss-name">Call dentist</div>' +
        '<div class="miss-why">Created during a busy stretch, no time block set</div>' +
        '<div class="miss-tag">TODAY</div>'
      );
      case "kudos": return (
        '<div class="card-label"><span class="lbl"><span class="glyph sage">♥</span>Worth celebrating</span></div>' +
        '<div class="kudos-row"><div class="avatar">J</div><div class="kudos-text"><b>Jordan</b> completed Morning Run every day this week.</div></div>'
      );
      default: return "";
    }
  }
  function peekTemplate(id){
    var d = cardDefs[id];
    var toneClass = d.glyphTone ? ("glyph " + d.glyphTone) : "glyph";
    return (
      '<div class="lbl" style="padding-top:2px;">' +
        '<span class="' + toneClass + '">' + d.glyph + '</span>' +
        '<span style="font-family:\'JetBrains Mono\',monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--text-faint);">' + d.label + '</span>' +
      '</div>'
    );
  }
  function stampText(id, dir){
    var d = cardDefs[id];
    if(d.kind === "decision") return dir === "right" ? d.rightLabel : d.leftLabel;
    return "Next";
  }

  // ---------------- stack rendering ----------------
  var SLOT_STYLE = {
    top:   { transform:"translate(0,0) scale(1)",          opacity:"1",   z:5, pe:"auto" },
    mid:   { transform:"translateY(14px) scale(0.95)",     opacity:"0.9", z:4, pe:"none" },
    back:  { transform:"translateY(26px) scale(0.90)",     opacity:"0.6", z:3, pe:"none" },
    hidden:{ transform:"translateY(36px) scale(0.86)",     opacity:"0",   z:2, pe:"none" }
  };
  function applySlot(el, role){
    var s = SLOT_STYLE[role];
    el.style.transform = s.transform;
    el.style.opacity = s.opacity;
    el.style.zIndex = s.z;
    el.style.pointerEvents = s.pe;
  }
  function buildCardEl(id, role){
    var el = document.createElement("div");
    el.className = "stack-card";
    var inner = document.createElement("div");
    inner.className = "card-inner";
    inner.innerHTML = role === "top" ? contentTemplate(id) : peekTemplate(id);
    el.appendChild(inner);
    if(role === "top"){
      var rs = document.createElement("div");
      rs.className = "stamp right" + (cardDefs[id].rightTone === "sage" ? " sage" : "");
      rs.id = "stamp-right"; rs.textContent = stampText(id, "right");
      var ls = document.createElement("div");
      ls.className = "stamp left"; ls.id = "stamp-left"; ls.textContent = stampText(id, "left");
      el.appendChild(rs); el.appendChild(ls);
    }
    return el;
  }

  function renderStack(){
    var stackArea = document.getElementById("stack-area");
    var stale = stackArea.querySelectorAll(".stack-card:not([data-exit])");
    stale.forEach(function(e){ e.remove(); });

    var roles = ["top","mid","back"];
    queue.slice(0,3).forEach(function(id, i){
      var role = roles[i];
      var el = buildCardEl(id, role);
      el.dataset.cardId = id;
      el.dataset.role = role;
      var fromRole = roles[i+1] || "hidden";
      applySlot(el, fromRole);
      stackArea.appendChild(el);
      if(role === "top") attachDrag(el, id);
      requestAnimationFrame(function(){
        requestAnimationFrame(function(){ applySlot(el, role); });
      });
    });

    if(queue.length === 0 && mode === "active") showEndCard();
    updateProgress();
    updateActionRow();
  }

  function showEndCard(){
    var stackArea = document.getElementById("stack-area");
    var el = document.createElement("div");
    el.className = "stack-card";
    el.style.transform = "translate(0,0) scale(1)";
    el.style.opacity = "1"; el.style.zIndex = 5; el.style.pointerEvents = "auto";
    var revisitNote = skipped.length
      ? (" " + skipped.length + (skipped.length > 1 ? " items are" : " item is") + " still waiting in your review list.")
      : "";
    el.innerHTML =
      '<div class="card-inner"><div class="end-card">' +
        '<div class="end-icon">✓</div>' +
        '<div class="briefing-title">You\'re all caught up</div>' +
        '<div class="empty-text">Nothing left in today\'s deck. New cards land tomorrow evening.' + revisitNote + '</div>' +
      '</div></div>';
    stackArea.appendChild(el);
  }

  function renderColdStart(){
    var stackArea = document.getElementById("stack-area");
    stackArea.querySelectorAll(".stack-card:not([data-exit])").forEach(function(e){ e.remove(); });
    var el = document.createElement("div");
    el.className = "stack-card";
    el.style.transform = "translate(0,0) scale(1)";
    el.style.opacity = "1"; el.style.zIndex = 5;
    el.innerHTML =
      '<div class="card-inner"><div class="cold-card">' +
        '<div class="cold-icon">✦</div>' +
        '<div class="briefing-title">Nothing to show yet</div>' +
        '<div class="empty-text">We build your first card from a few days of tasks and rings — check back tomorrow evening. In the meantime, add friends so kudos has somewhere to go.</div>' +
      '</div></div>';
    stackArea.appendChild(el);
    updateProgress();
    updateActionRow();
  }

  // ---------------- progress + actions ----------------
  function updateProgress(){
    var row = document.getElementById("progress-row");
    if(mode === "new"){ row.style.visibility = "hidden"; return; }
    row.style.visibility = "visible";
    var dotsWrap = document.getElementById("progress-dots");
    dotsWrap.innerHTML = "";
    ORDER_ACTIVE.forEach(function(id){
      var dot = document.createElement("div");
      var cls = "pdot";
      if(resolvedIds.has(id)) cls += " done";
      else if(queue[0] === id) cls += " current";
      dot.className = cls;
      dotsWrap.appendChild(dot);
    });
    var done = resolvedIds.size;
    document.getElementById("progress-count").textContent = queue.length ? (Math.min(done+1,TOTAL) + " of " + TOTAL + " today") : (TOTAL + " of " + TOTAL + " today");
    var sp = document.getElementById("skipped-pill");
    if(skipped.length){ sp.classList.add("show"); document.getElementById("skipped-count").textContent = skipped.length; }
    else sp.classList.remove("show");
  }

  function updateActionRow(){
    var row = document.getElementById("action-row");
    if(mode === "new"){
      row.innerHTML = '<button class="action-btn primary" style="flex:1" onclick="openNavModal(\'🤝\',\'This would open Friends\',\'Deep-links to the Friends tab so you can find people to follow. Nothing about your tasks or rings is shared until you choose to send kudos.\')">Add friends</button>';
      return;
    }
    if(queue.length === 0){
      row.innerHTML =
        '<button class="action-btn ghost" onclick="openNavModal(\'✅\',\'This would open Tasks\',\'Deep-links to your Tasks list — this mockup shows the destination rather than a full Tasks screen.\')">Back to Tasks</button>' +
        '<button class="action-btn primary" onclick="openNavModal(\'🔗\',\'This would open Rings\',\'Deep-links to your Rings tab — this mockup shows the destination rather than a full Rings screen.\')">Back to Rings</button>';
      return;
    }
    var id = queue[0], d = cardDefs[id];
    if(d.kind === "info"){
      row.innerHTML = '<button class="action-btn primary" style="flex:1" onclick="resolveTop(\'right\')">Continue →</button>';
    } else {
      var toneClass = d.rightTone === "sage" ? "primary sage" : "primary";
      row.innerHTML =
        '<button class="action-btn ghost" onclick="resolveTop(\'left\')">' + d.leftLabel + '</button>' +
        '<button class="action-btn ' + toneClass + '" onclick="resolveTop(\'right\')">' + d.rightLabel + '</button>';
    }
  }

  // ---------------- resolution + undo ----------------
  function saveProgress(){
    MockState.save('deck:progress', {
      mode: mode,
      queue: queue,
      resolvedIds: Array.from(resolvedIds),
      skipped: skipped
    });
  }
  function applyResolution(id, dir){
    var d = cardDefs[id];
    queue.shift();
    resolvedIds.add(id);
    lastAction = { id: id, dir: dir };
    if(d.kind === "decision"){
      if(dir === "left"){ skipped.push({ id:id, reason:d.skipReason }); showToast(d.toastLeft, true); announce(d.toastLeft); }
      else { showToast(d.toastRight, true); announce(d.toastRight); }
      MockSync.broadcast("card-resolved", { id: id, dir: dir });
    } else {
      hideToast();
    }
    saveProgress();
    renderStack();
  }
  function undoLast(){
    if(!lastAction) return;
    var id = lastAction.id, dir = lastAction.dir;
    queue.unshift(id);
    resolvedIds.delete(id);
    if(dir === "left"){ skipped = skipped.filter(function(s){ return s.id !== id; }); }
    lastAction = null;
    hideToast();
    announce("Undone.");
    saveProgress();
    renderStack();
  }
  function showToast(text, withUndo){
    var t = document.getElementById("toast");
    t.innerHTML = withUndo
      ? ('<span>' + text + '</span><button class="undo" onclick="undoLast()">Undo</button>')
      : ('<span>' + text + '</span>');
    t.classList.add("show");
  }
  function hideToast(){
    var t = document.getElementById("toast");
    t.classList.remove("show"); t.innerHTML = "";
  }

  function resolveTop(dir){
    if(mode !== "active" || !queue.length) return;
    var id = queue[0];
    var el = document.querySelector('.stack-card[data-role="top"]');
    if(el) commitSwipe(el, id, dir, 0);
    else applyResolution(id, dir);
  }
  function commitSwipe(el, id, dir, yOffset){
    yOffset = yOffset || 0;
    el.classList.add("dragging");
    el.dataset.exit = "true";
    el.removeAttribute("data-role");
    el.style.zIndex = "6";
    el.style.pointerEvents = "none";
    var stampEl = document.getElementById(dir === "right" ? "stamp-right" : "stamp-left");
    if(stampEl) stampEl.style.opacity = "1";
    var outX = dir === "right" ? 560 : -560;
    requestAnimationFrame(function(){
      el.style.transition = "transform .36s ease, opacity .36s ease";
      el.style.transform = "translate(" + outX + "px, " + yOffset + "px) rotate(" + (dir === "right" ? 26 : -26) + "deg)";
      el.style.opacity = "0";
    });
    setTimeout(function(){ if(el.parentNode) el.remove(); }, 380);
    applyResolution(id, dir);
  }

  // ---------------- drag handling ----------------
  var dragEl = null, dragId = null, startX = 0, startY = 0, dragMoved = false, activePointerId = null;
  function attachDrag(el, id){
    el.addEventListener("pointerdown", function(e){
      if(e.pointerType === "mouse" && e.button !== 0) return;
      dragEl = el; dragId = id; startX = e.clientX; startY = e.clientY; dragMoved = false; activePointerId = e.pointerId;
      // Pointer capture is intentionally NOT taken here. Capturing on every pointerdown
      // (even a plain tap) makes the browser retarget the resulting click event to this
      // card instead of whatever was actually tapped -- breaking the why-link, the trend
      // toggle, and the ring chip. Capture is only taken once we've confirmed a real drag,
      // in onPointerMove below.
      el.addEventListener("pointermove", onPointerMove);
      el.addEventListener("pointerup", onPointerUp);
      el.addEventListener("pointercancel", onPointerUp);
      var clickGuard = function(ce){
        if(dragMoved){ ce.stopPropagation(); ce.preventDefault(); }
        el.removeEventListener("click", clickGuard, true);
      };
      el.addEventListener("click", clickGuard, true);
    });
  }
  function onPointerMove(e){
    if(!dragEl) return;
    var dx = e.clientX - startX, dy = e.clientY - startY;
    if(!dragMoved && Math.hypot(dx,dy) > 6){
      dragMoved = true;
      dragEl.classList.add("dragging");
      try{ dragEl.setPointerCapture(activePointerId); }catch(err){}
    }
    if(!dragMoved) return;
    dragEl.style.transform = "translate(" + dx + "px, " + (dy*0.35) + "px) rotate(" + (dx/16) + "deg)";
    var threshold = 110;
    var rightOp = Math.max(0, Math.min(1, dx/threshold));
    var leftOp = Math.max(0, Math.min(1, -dx/threshold));
    var sr = document.getElementById("stamp-right"), sl = document.getElementById("stamp-left");
    if(sr) sr.style.opacity = rightOp;
    if(sl) sl.style.opacity = leftOp;
    dragEl.dataset.dx = dx; dragEl.dataset.dy = dy;
  }
  function onPointerUp(e){
    if(!dragEl) return;
    var el = dragEl, id = dragId;
    try{ el.releasePointerCapture(activePointerId); }catch(err){}
    el.removeEventListener("pointermove", onPointerMove);
    el.removeEventListener("pointerup", onPointerUp);
    el.removeEventListener("pointercancel", onPointerUp);
    var dx = parseFloat(el.dataset.dx || 0), dy = parseFloat(el.dataset.dy || 0);
    var threshold = 110;
    if(dragMoved && Math.abs(dx) > threshold){
      commitSwipe(el, id, dx > 0 ? "right" : "left", dy*0.35);
    } else if(dragMoved){
      el.classList.remove("dragging");
      el.style.transform = "translate(0,0) rotate(0deg)";
      var sr = document.getElementById("stamp-right"), sl = document.getElementById("stamp-left");
      if(sr) sr.style.opacity = 0; if(sl) sl.style.opacity = 0;
    }
    dragEl = null; dragId = null; dragMoved = false; activePointerId = null;
  }

  // keyboard equivalent of a swipe
  document.getElementById("stack-area").addEventListener("keydown", function(e){
    if(mode !== "active" || !queue.length) return;
    if(e.key === "ArrowRight"){ e.preventDefault(); resolveTop("right"); }
    else if(e.key === "ArrowLeft"){ e.preventDefault(); resolveTop("left"); }
  });

  // ---------------- inline card interactions ----------------
  function toggleWhy(){
    var panel = document.getElementById("nudge-why-panel");
    var btn = document.getElementById("nudge-why-btn");
    if(!panel) return;
    var open = panel.classList.toggle("open");
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  }
  var trendMonthOpen = false;
  function toggleTrend(){
    trendMonthOpen = !trendMonthOpen;
    document.getElementById("trend-week-view").style.display = trendMonthOpen ? "none" : "block";
    document.getElementById("trend-month-view").style.display = trendMonthOpen ? "block" : "none";
    document.getElementById("trend-big").innerHTML = trendMonthOpen ? "69<small>%</small>" : "82<small>%</small>";
    document.getElementById("trend-delta").textContent = trendMonthOpen ? "trending up over 4 weeks" : "↑ steadier than last week";
    document.getElementById("trend-note").textContent = trendMonthOpen
      ? "Each bar averages a full week. The climb tracks with your focus-time nudges landing more consistently."
      : "Tuesday's dip lines up with the team offsite, not a slip.";
    document.getElementById("trend-toggle-btn").textContent = trendMonthOpen ? "← Back to this week" : "See full month →";
  }

  // ---------------- modals ----------------
  function openNavModal(icon, title, body){
    document.getElementById("nav-modal-icon").textContent = icon;
    document.getElementById("nav-modal-title").textContent = title;
    document.getElementById("nav-modal-body").textContent = body;
    document.getElementById("nav-modal-overlay").classList.add("open");
  }
  function closeModal(id){ document.getElementById(id).classList.remove("open"); }
  function openRingModal(){
    openNavModal("🔗", "This would open Rings", "In the real app, this deep-links to the Rings tab scoped to Gym — it doesn't close the ring from here. Closing a ring likely involves more than one tap (duration, reps, streak), so this mockup shows the intended destination instead of faking that interaction.");
  }

  // ---------------- skipped / revisit sheet ----------------
  function openSheet(){
    var list = document.getElementById("sheet-list");
    if(!skipped.length){
      list.innerHTML = "";
      document.getElementById("sheet-title").textContent = "Nothing to revisit";
    } else {
      document.getElementById("sheet-title").textContent = "To revisit";
      list.innerHTML = skipped.map(function(s){
        return (
          '<div class="sheet-item">' +
            '<div class="sheet-item-text"><div class="t">' + s.reason + '</div><div class="r">' + cardDefs[s.id].label + '</div></div>' +
            '<button class="sheet-reconsider" onclick="reconsider(\'' + s.id + '\')">Reconsider</button>' +
          '</div>'
        );
      }).join("");
    }
    document.getElementById("sheet-overlay").classList.add("open");
  }
  function closeSheet(){ document.getElementById("sheet-overlay").classList.remove("open"); }
  function reconsider(id){
    skipped = skipped.filter(function(s){ return s.id !== id; });
    resolvedIds.delete(id);
    queue = queue.filter(function(q){ return q !== id; });
    queue.unshift(id);
    closeSheet();
    saveProgress();
    renderStack();
  }

  // ---------------- state switch ----------------
  // Resets progress on purpose — this is the demo control for "start over
  // as new/active", not a resume. Page-load restoration is handled by
  // initDeck() below, which reads persisted progress instead of resetting.
  function setState(s){
    mode = s;
    document.getElementById("pill-active").classList.toggle("active", s === "active");
    document.getElementById("pill-new").classList.toggle("active", s === "new");
    document.getElementById("greet-name").textContent = s === "new" ? "Welcome, Maya." : "Evening, Maya.";
    hideToast();
    closeSheet();
    queue = s === "new" ? [] : ORDER_ACTIVE.slice();
    resolvedIds = new Set();
    skipped = [];
    lastAction = null;
    saveProgress();
    if(s === "new") renderColdStart(); else renderStack();
  }

  (function initDeck(){
    var saved = MockState.load('deck:progress', null);
    if(saved){
      mode = saved.mode;
      queue = saved.queue.slice();
      resolvedIds = new Set(saved.resolvedIds);
      skipped = saved.skipped.slice();
      lastAction = null;
      document.getElementById("pill-active").classList.toggle("active", mode === "active");
      document.getElementById("pill-new").classList.toggle("active", mode === "new");
      document.getElementById("greet-name").textContent = mode === "new" ? "Welcome, Maya." : "Evening, Maya.";
      if(mode === "new") renderColdStart(); else renderStack();
    } else {
      setState(MockState.load('onboarding-complete', false) ? 'active' : 'new');
    }
  })();

  MockSync.listen('onboarding-finished', function(){
    setState('active');
  });