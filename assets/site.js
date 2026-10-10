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
      var hasSlides = u.id === 'plan' || u.querySelector('.slide:not(.note)');
      var html = hasSlides ? '<h4>' + (u.id === 'plan' ? 'Course plan check' : 'From the slides') + '</h4>' : '';
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
        u.classList.toggle('complete', all > 0 && d === all);
      });
    }

    // search within the current tab
    function unwrap(m) {
      while (m.firstChild) m.parentNode.insertBefore(m.firstChild, m);
      m.remove();
    }
    function clearMarks(el) {
      [].slice.call(el.querySelectorAll('mark:not(.hl)')).forEach(unwrap);
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

    // hide done sections / show all
    var df = document.getElementById('donefilter');
    function setFilter(on) {
      document.body.classList.toggle('hidedone', on);
      df.setAttribute('aria-pressed', on ? 'true' : 'false');
      df.querySelector('span').textContent = on ? 'Show all' : 'Hide done';
      df.title = on ? 'Show every section again' : "Show only the sections you haven't marked done";
      localStorage.setItem(KEY + 'hidedone', on ? '1' : '');
    }
    df.onclick = function () { setFilter(!document.body.classList.contains('hidedone')); };
    setFilter(!!localStorage.getItem(KEY + 'hidedone'));
    units.forEach(function (u) {
      if (u.id === 'plan') return;
      var m = document.createElement('div'); m.className = 'alldone';
      m.innerHTML = '<b>Everything here is marked done.</b>Click "Show all" to see it again.';
      u.appendChild(m);
    });

    // clear the Done marks in the open tab only
    document.getElementById('undoneall').onclick = function () {
      var u = current(), name = u.getAttribute('data-tab');
      var done = u.querySelectorAll('.slide.isdone');
      if (!done.length) { alert('Nothing in ' + name + ' is marked done yet.'); return; }
      if (!confirm('Clear the Done mark on ' + done.length + (done.length === 1 ? ' section' : ' sections') + ' in ' + name + '? Other units stay as they are.')) return;
      [].slice.call(done).forEach(function (s) { s.classList.remove('isdone'); localStorage.removeItem(KEY + s.id); });
      buildSide(); updateProgress();
    };

    // highlighter: stays on until the button is clicked again; highlights are saved per section
    var hlBtn = document.getElementById('hltoggle');
    function setHl(on) {
      document.body.classList.toggle('hl-on', on);
      hlBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    hlBtn.onclick = function () { setHl(!document.body.classList.contains('hl-on')); };

    // text nodes of a section with their offsets (button text is skipped)
    function textMap(s) {
      var walker = document.createTreeWalker(s, NodeFilter.SHOW_TEXT, null);
      var list = [], pos = 0, str = '';
      while (walker.nextNode()) {
        var t = walker.currentNode;
        if (t.parentNode.closest('button')) continue;
        list.push({ node: t, start: pos });
        pos += t.length; str += t.nodeValue;
      }
      return { list: list, text: str };
    }
    // highlighted ranges currently in the DOM, merged
    function readHl(s) {
      var out = [];
      textMap(s).list.forEach(function (x) {
        if (!x.node.parentNode.closest('mark.hl')) return;
        var a = x.start, b = x.start + x.node.length, last = out[out.length - 1];
        if (last && last[1] >= a) last[1] = Math.max(last[1], b); else out.push([a, b]);
      });
      return out;
    }
    function merge(r) {
      r = r.filter(function (x) { return x[1] > x[0]; }).sort(function (a, b) { return a[0] - b[0]; });
      var out = [];
      r.forEach(function (x) {
        var last = out[out.length - 1];
        if (last && last[1] >= x[0]) last[1] = Math.max(last[1], x[1]); else out.push([x[0], x[1]]);
      });
      return out;
    }
    function paintHl(s, ranges) {
      [].slice.call(s.querySelectorAll('mark.hl')).forEach(unwrap);
      s.normalize();
      if (!ranges.length) return;
      textMap(s).list.forEach(function (x) {
        var t = x.node, o = x.start, L = t.length;
        if (!t.nodeValue.trim()) return; // whitespace between table cells etc.
        ranges.filter(function (r) { return r[0] < o + L && r[1] > o; }).reverse().forEach(function (r) {
          var a = Math.max(r[0], o) - o, b = Math.min(r[1], o + L) - o;
          var mid = a > 0 ? t.splitText(a) : t;
          if (b - a < mid.length) mid.splitText(b - a);
          var m = document.createElement('mark'); m.className = 'hl';
          mid.parentNode.insertBefore(m, mid); m.appendChild(mid);
        });
      });
    }
    function saveHl(s) {
      var r = readHl(s), text = textMap(s).text;
      if (r.length) localStorage.setItem(KEY + 'hl:' + s.id, JSON.stringify(r.map(function (x) { return [x[0], x[1], text.slice(x[0], x[1])]; })));
      else localStorage.removeItem(KEY + 'hl:' + s.id);
    }
    // restore saved highlights; if the section text has changed, find the same words again
    [].slice.call(document.querySelectorAll('.slide')).forEach(function (s) {
      var saved; try { saved = JSON.parse(localStorage.getItem(KEY + 'hl:' + s.id) || '[]'); } catch (e) { saved = []; }
      if (!saved.length) return;
      var text = textMap(s).text;
      var ranges = saved.map(function (x) {
        if (text.slice(x[0], x[1]) === x[2]) return [x[0], x[1]];
        var best = -1, i = text.indexOf(x[2]);
        while (i >= 0) { if (best < 0 || Math.abs(i - x[0]) < Math.abs(best - x[0])) best = i; i = text.indexOf(x[2], i + 1); }
        return best < 0 ? null : [best, best + x[2].length];
      }).filter(Boolean);
      paintHl(s, merge(ranges));
    });

    function onPick(e) {
      if (!document.body.classList.contains('hl-on')) return;
      var sel = window.getSelection();
      var range = sel.rangeCount ? sel.getRangeAt(0) : null;
      if (!range || range.collapsed) {
        // a plain click on a highlight removes it
        var m = e.target.closest && e.target.closest('mark.hl');
        var ms = m && m.closest('.slide');
        if (!ms) return;
        var tm = textMap(ms), off = -1;
        tm.list.forEach(function (x) { if (off < 0 && m.contains(x.node)) off = x.start; });
        paintHl(ms, readHl(ms).filter(function (r) { return !(r[0] <= off && off < r[1]); }));
        saveHl(ms);
        return;
      }
      var touched = [];
      [].slice.call(document.querySelectorAll('.unit.on .slide')).forEach(function (s) {
        if (!range.intersectsNode(s)) return;
        var add = [];
        textMap(s).list.forEach(function (x) {
          if (!range.intersectsNode(x.node)) return;
          var a = x.node === range.startContainer ? range.startOffset : 0;
          var b = x.node === range.endContainer ? range.endOffset : x.node.length;
          if (b > a) add.push([x.start + a, x.start + b]);
        });
        if (!add.length) return;
        paintHl(s, merge(readHl(s).concat(add)));
        touched.push(s);
      });
      sel.removeAllRanges();
      touched.forEach(saveHl);
    }
    document.addEventListener('mouseup', function (e) { if (e.button === 0 && !e.target.closest('button, input')) onPick(e); });
    document.addEventListener('touchend', function (e) { setTimeout(function () { onPick(e); }, 350); });

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
