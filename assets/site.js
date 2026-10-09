(function () {
  var KEY = 'gis:';
  var root = document.documentElement;
  root.setAttribute('data-theme', localStorage.getItem(KEY + 'theme') || 'dark');

  document.addEventListener('DOMContentLoaded', function () {
    var units = [].slice.call(document.querySelectorAll('.unit'));
    var tabs = document.querySelector('.tabs');
    var side = document.querySelector('nav.side');
    var search = document.getElementById('search');
    var narrow = function () { return window.matchMedia('(max-width:1000px)').matches; };

    // sidebar open/closed (remembered on desktop; starts closed on small screens)
    var saved = localStorage.getItem(KEY + 'side');
    if (saved === 'closed' || narrow()) document.body.classList.add('side-closed');
    function toggleSide() {
      document.body.classList.toggle('side-closed');
      if (!narrow()) localStorage.setItem(KEY + 'side', document.body.classList.contains('side-closed') ? 'closed' : 'open');
    }
    document.getElementById('sidetoggle').onclick = toggleSide;
    var scrim = document.createElement('div'); scrim.className = 'scrim'; document.body.appendChild(scrim);
    scrim.onclick = function () { document.body.classList.add('side-closed'); };
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); toggleSide(); }
      if (e.key === 'Escape') document.getElementById('zoom').classList.remove('on');
    });

    // ids + Done buttons (not on the course plan tab)
    units.forEach(function (u) {
      [].slice.call(u.querySelectorAll('.slide')).forEach(function (s, i) {
        if (!s.id) s.id = u.id + '-' + (i + 1);
        if (u.id === 'plan') return;
        var b = document.createElement('button');
        b.className = 'donebtn'; b.type = 'button'; b.textContent = 'Done';
        if (localStorage.getItem(KEY + s.id)) s.classList.add('isdone');
        b.onclick = function () {
          s.classList.toggle('isdone');
          if (s.classList.contains('isdone')) localStorage.setItem(KEY + s.id, '1');
          else localStorage.removeItem(KEY + s.id);
          buildSide(); updateProgress();
        };
        s.appendChild(b);
      });
    });

    // tabs
    units.forEach(function (u) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = u.getAttribute('data-tab');
      if (u.id === 'plan') b.className = 'plan';
      b.onclick = function () { show(u.id); window.scrollTo(0, 0); history.replaceState(null, '', '#' + u.id); };
      b.dataset.unit = u.id;
      tabs.appendChild(b);
    });

    function current() { return document.querySelector('.unit.on'); }

    function show(id) {
      units.forEach(function (u) { u.classList.toggle('on', u.id === id); });
      [].slice.call(tabs.children).forEach(function (b) { b.classList.toggle('on', b.dataset.unit === id); });
      localStorage.setItem(KEY + 'unit', id);
      if (search.value) runSearch(); else buildSide();
      updateProgress();
    }

    function titleOf(s) {
      var h = s.querySelector('h3');
      return h ? h.textContent : s.id;
    }

    function buildSide() {
      var u = current(); if (!u) return;
      var html = '<h4>' + (u.id === 'plan' ? 'Course plan check' : 'From the slides') + '</h4>';
      var inNotes = false;
      [].slice.call(u.querySelectorAll('.slide, .notes-banner, .partdiv')).forEach(function (s) {
        if (s.classList.contains('hide')) return;
        if (s.classList.contains('notes-banner')) { html += '<h4>From the class notes</h4>'; inNotes = true; return; }
        if (s.classList.contains('partdiv')) { html += '<h4>' + s.textContent.replace(/^Part [AB]/, '') + '</h4>'; return; }
        html += '<a href="#' + s.id + '" data-id="' + s.id + '" class="' + (s.classList.contains('isdone') ? 'done ' : '') + (inNotes ? 'notes' : '') + '">' + titleOf(s) + '</a>';
      });
      side.innerHTML = html;
      [].slice.call(side.querySelectorAll('a')).forEach(function (a) {
        a.onclick = function () { if (narrow()) document.body.classList.add('side-closed'); };
      });
      watchActive();
    }

    // highlight the section currently on screen
    var observer;
    function watchActive() {
      if (observer) observer.disconnect();
      if (!('IntersectionObserver' in window)) return;
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          [].slice.call(side.querySelectorAll('a.active')).forEach(function (a) { a.classList.remove('active'); });
          var a = side.querySelector('a[data-id="' + e.target.id + '"]');
          if (a) {
            a.classList.add('active');
            var r = a.getBoundingClientRect(), sr = side.getBoundingClientRect();
            if (r.top < sr.top + 40 || r.bottom > sr.bottom - 40) side.scrollTop += r.top - sr.top - sr.height / 3;
          }
        });
      }, { rootMargin: '-70px 0px -70% 0px' });
      [].slice.call(current().querySelectorAll('.slide')).forEach(function (s) { observer.observe(s); });
    }

    function updateProgress() {
      units.forEach(function (u) {
        var all = u.querySelectorAll('.slide').length;
        var d = u.querySelectorAll('.slide.isdone').length;
        var bar = u.querySelector('.progress span');
        var lab = u.querySelector('.progress-label');
        if (bar) bar.style.width = (all ? (100 * d / all) : 0) + '%';
        if (lab) lab.textContent = d + ' of ' + all + ' sections done';
      });
    }

    // search within the current tab
    function clearMarks(el) {
      [].slice.call(el.querySelectorAll('mark')).forEach(function (m) { m.replaceWith(document.createTextNode(m.textContent)); });
      el.normalize();
    }
    function markText(el, q) {
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
      var nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
      var lq = q.toLowerCase();
      nodes.forEach(function (t) {
        if (t.parentNode.closest('button')) return;
        var i = t.nodeValue.toLowerCase().indexOf(lq);
        if (i < 0) return;
        var r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + q.length);
        r.surroundContents(document.createElement('mark'));
      });
    }
    function runSearch() {
      var u = current(); var q = search.value.trim();
      clearMarks(u);
      var any = false;
      [].slice.call(u.querySelectorAll('.slide')).forEach(function (s) {
        var hit = !q || s.textContent.toLowerCase().indexOf(q.toLowerCase()) >= 0;
        s.classList.toggle('hide', !hit);
        if (hit) any = true;
        if (hit && q) {
          markText(s, q);
          [].slice.call(s.querySelectorAll('details')).forEach(function (d) { if (d.querySelector('mark')) d.open = true; });
        }
      });
      [].slice.call(u.querySelectorAll('.notes-banner, .partdiv')).forEach(function (b) { b.classList.toggle('hide', !!q); });
      var e = u.querySelector('.empty');
      if (!any && !e) { e = document.createElement('div'); e.className = 'empty'; u.appendChild(e); }
      if (e) { e.textContent = any ? '' : 'Nothing in this tab matches "' + q + '".'; e.classList.toggle('hide', any); }
      buildSide();
    }
    search.addEventListener('input', runSearch);

    document.getElementById('theme').onclick = function () {
      var t = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', t); localStorage.setItem(KEY + 'theme', t);
    };

    // image zoom
    var zoom = document.getElementById('zoom');
    document.addEventListener('click', function (e) {
      if (e.target.matches('.slide img')) { zoom.querySelector('img').src = e.target.src; zoom.classList.add('on'); }
      else if (e.target.closest('#zoom')) zoom.classList.remove('on');
    });

    // open the tab from the hash (a tab id or a section inside it)
    var h = location.hash.slice(1);
    var target = h && document.getElementById(h);
    var start = target ? (target.classList.contains('unit') ? target : target.closest('.unit')) : null;
    show(start ? start.id : (localStorage.getItem(KEY + 'unit') || units[0].id));
    if (target && !target.classList.contains('unit')) {
      var d = target.querySelector('details'); if (d) d.open = true;
      target.scrollIntoView();
    } else window.scrollTo(0, 0);
  });
})();
