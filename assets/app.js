/* Bill Keith Banjo Workshop replay.
 * Plays media/workshop.mp3 and, from the timed events in data/session.js
 * (decoded from the original 2006 iVocalize recording), keeps the slide,
 * whiteboard drawings, current speaker and chat room in sync with the audio.
 */
(function () {
  'use strict';

  var S = window.SESSION;
  var $ = function (id) { return document.getElementById(id); };

  // Natural pixel sizes of the slides; whiteboard coordinates are in these units.
  var SLIDES = {
    'img/s1.jpg': [800, 151, 'G major scale'],
    'img/s2.jpg': [1024, 193, 'G major scale'],
    'img/s3.jpg': [800, 277, 'Foggy Mountain roll'],
    'img/s4.jpg': [800, 374, 'Thumb lead'],
    'img/s5.jpg': [800, 307, 'Middle lead'],
    'img/s6.jpg': [800, 295, 'Index lead'],
    'img/s7.jpg': [800, 625, 'D7 tritone'],
    'img/s8.jpg': [800, 574, 'G scale: modes and chords'],
    'img/s9.jpg': [400, 401, 'Circle of fifths'],
    'img/s10.jpg': [300, 301, 'Circle of fifths'],
    'img/s11.jpg': [400, 266, 'Intermission'],
    'img/s12.jpg': [800, 334, 'G and C pentatonic scales'],
    'img/s13.jpg': [373, 268, 'Thank you'],
    'img/s14.jpg': [350, 226, 'Thank you']
  };
  var slidePath = function (src) { return 'slides/' + src.replace(/^img\//, ''); };

  var HANDOUTS = [
    ['Lead patterns', 'Thumb, middle and index leads'],
    ['Roll patterns', 'Forward, backward and reverse rolls; Foggy Mountain roll'],
    ['Four major scales', 'D, G, C and F'],
    ['Four pentatonic scales', 'G, C, F and B♭'],
    ['G scale: modes and chords', 'Ionian through Locrian, with chords'],
    ['Pentatonic loops', 'In G, C, F and B♭'],
    ['Loop down #1', 'In five keys'],
    ['Loops and steps', 'Down and up'],
    ['D7 tritone', 'C and F♯'],
    ['Circle of fifths', '']
  ];
  var TABS = [
    ['forward-roll', 'Forward roll'], ['backward-roll', 'Backward roll'],
    ['reverse-roll', 'Reverse roll'], ['foggy-mountain-roll', 'Foggy Mountain roll'],
    ['thumb-lead', 'Thumb lead'], ['middle-lead', 'Middle lead'], ['index-lead', 'Index lead'],
    ['g-major', 'G major scale'], ['c-major', 'C major scale'], ['d-major', 'D major scale'],
    ['f-major', 'F major scale'], ['g-c-pentatonic', 'G and C pentatonic scales'],
    ['f-bb-pentatonic', 'F and B♭ pentatonic scales'], ['circle-of-fifths', 'Circle of fifths'],
    ['bills-thumb', 'Bill’s picking thumb (photo)']
  ];

  // ---------- helpers ----------
  function fmt(t) {
    t = Math.max(0, Math.floor(t));
    var h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = t % 60;
    return h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  // Index of the last item with item.t <= t, or -1.
  function lastAtOrBefore(arr, t) {
    var lo = 0, hi = arr.length - 1, ans = -1;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      if (arr[mid].t <= t + 1e-6) { ans = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return ans;
  }
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } }
  };

  // ---------- precompute timelines ----------
  // Whiteboard: a snapshot after every slide/draw event. Changing the slide image
  // starts a fresh board (empty src = board cleared).
  var boards = [{ t: 0, src: undefined, objs: [] }];
  var speakers = [], chats = [], chapters = [{ t: 0, title: 'Welcome & sound check' }];
  (function () {
    var src, objs = {};
    S.events.forEach(function (e) {
      if (e.type === 'slide') {
        src = e.src; objs = {};
        if (e.src && SLIDES[e.src]) {
          var title = SLIDES[e.src][2];
          if (chapters[chapters.length - 1].title !== title) chapters.push({ t: e.t, title: title });
        }
      } else if (e.type === 'draw') {
        if (e.op === 'delete') delete objs[e.id];
        else if (e.op === 'line' || e.op === 'path' || e.op === 'text') objs[e.id] = e;
      } else if (e.type === 'speaker') {
        speakers.push(e); return;
      } else if (e.type === 'chat' || e.type === 'web') {
        chats.push(e); return;
      } else return;
      boards.push({ t: e.t, src: src, objs: Object.keys(objs).map(function (k) { return objs[k]; }) });
    });
  })();

  // ---------- DOM refs ----------
  var audio = $('audio'), scrub = $('scrub'), body = document.body;
  var board = $('board'), boardImg = $('boardImg'), boardBg = $('boardBg'), ink = $('ink');
  var titleCard = $('titleCard'), boardBlank = $('boardBlank');
  var chatLog = $('chatLog'), followBtn = $('followBtn');
  var duration = S.duration;
  scrub.max = duration;
  $('dur').textContent = fmt(duration);

  // ---------- chapters ----------
  var chapterItems = chapters.map(function (c) {
    var li = el('li'), b = el('button');
    b.type = 'button';
    b.appendChild(el('span', 'ct', fmt(c.t)));
    b.appendChild(el('span', null, c.title));
    b.addEventListener('click', function () { seek(c.t, true); play(); });
    li.appendChild(b);
    $('chapterList').appendChild(li);
    if (c.t > 0) {
      var mark = el('span');
      mark.style.left = (c.t / duration * 100) + '%';
      mark.title = c.title;
      $('scrubMarks').appendChild(mark);
    }
    return li;
  });

  // ---------- chat ----------
  var palette = ['#2f6f8f', '#7b4fa0', '#3d7a3a', '#a0512f', '#2d6b6b', '#8a5a00', '#9a3b62', '#4a5aa8'];
  function nameColor(n) {
    var h = 0;
    for (var i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0;
    return palette[h % palette.length];
  }
  var chatEls = chats.map(function (c) {
    var li = el('li', 'future');
    li.appendChild(el('span', 'ts', fmt(c.t)));
    var line = el('span');
    if (c.type === 'web') {
      li.classList.add('sys');
      line.appendChild(document.createTextNode('The host opened the '));
      var a = el('a', null, 'workshop handouts');
      a.href = '#handouts';
      a.addEventListener('click', function (ev) { ev.stopPropagation(); });
      line.appendChild(a);
      line.appendChild(document.createTextNode(' page for everyone.'));
    } else {
      if (c.name === 'Bill Keith') li.classList.add('bill');
      var who = el('span', 'who', c.name);
      if (c.name !== 'Bill Keith') who.style.color = nameColor(c.name);
      line.appendChild(who);
      line.appendChild(el('span', 'msg', c.text));
    }
    li.appendChild(line);
    li.addEventListener('click', function () { seek(c.t, true); });
    chatLog.appendChild(li);
    return li;
  });
  var emptyNote = el('li', 'chat-empty', 'Chat messages appear here as the replay plays.');
  chatLog.insertBefore(emptyNote, chatLog.firstChild);

  var shown = 0;          // number of chat items at or before the current time
  var autoFollow = true;  // keep the newest message in view
  var programmaticScroll = false;

  function scrollChat() {
    var target = chatEls[shown - 1];
    programmaticScroll = true;
    if (!target) chatLog.scrollTop = 0;
    else if (body.classList.contains('show-ahead')) {
      chatLog.scrollTop = target.offsetTop - chatLog.clientHeight / 2;
    } else {
      chatLog.scrollTop = chatLog.scrollHeight;
    }
    requestAnimationFrame(function () { programmaticScroll = false; });
  }
  chatLog.addEventListener('scroll', function () {
    if (programmaticScroll) return;
    var target = chatEls[shown - 1];
    var nearBottom = chatLog.scrollHeight - chatLog.scrollTop - chatLog.clientHeight < 40;
    if (body.classList.contains('show-ahead') && target) {
      var r = target.offsetTop - chatLog.scrollTop;
      nearBottom = r > 0 && r < chatLog.clientHeight;
    }
    autoFollow = nearBottom;
    followBtn.hidden = autoFollow || shown === 0;
  });
  followBtn.addEventListener('click', function () { autoFollow = true; followBtn.hidden = true; scrollChat(); });
  $('spoilers').addEventListener('change', function () {
    body.classList.toggle('show-ahead', this.checked);
    autoFollow = true; followBtn.hidden = true; scrollChat();
  });

  function renderChat(t) {
    var n = lastAtOrBefore(chats, t) + 1;
    if (n === shown) return;
    var lo = Math.min(n, shown), hi = Math.max(n, shown);
    if (shown > 0) chatEls[shown - 1].classList.remove('latest');
    for (var i = lo; i < hi; i++) chatEls[i].classList.toggle('future', i >= n);
    if (n > 0) chatEls[n - 1].classList.add('latest');
    shown = n;
    emptyNote.hidden = n > 0 || body.classList.contains('show-ahead');
    if (autoFollow) scrollChat();
  }

  // ---------- whiteboard ----------
  var SVGNS = 'http://www.w3.org/2000/svg';
  var currentBoard = null;

  function renderBoard(t) {
    var snap = boards[lastAtOrBefore(boards, t)];
    if (snap === currentBoard) return;
    currentBoard = snap;
    titleCard.hidden = snap.src !== undefined;
    boardBlank.hidden = snap.src !== null;
    board.toggleAttribute('hidden', !snap.src);
    if (!snap.src) return;
    var dims = SLIDES[snap.src];
    var w = dims[0], h = dims[1];
    var href = slidePath(snap.src);
    if (boardImg.getAttribute('href') !== href) {
      boardImg.setAttribute('href', href);
      boardImg.setAttribute('width', w);
      boardImg.setAttribute('height', h);
    }
    board.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    board.setAttribute('aria-label', 'Slide: ' + dims[2]);
    boardBg.setAttribute('width', w);
    boardBg.setAttribute('height', h);
    while (ink.firstChild) ink.removeChild(ink.firstChild);
    snap.objs.forEach(function (o) {
      var node;
      if (o.op === 'text') {
        node = document.createElementNS(SVGNS, 'text');
        node.setAttribute('x', o.x);
        node.setAttribute('y', o.y + o.size);
        node.setAttribute('font-size', o.size);
        node.setAttribute('font-family', o.font + ', sans-serif');
        if (o.bold) node.setAttribute('font-weight', 'bold');
        node.setAttribute('fill', '#c8261d');
        node.setAttribute('stroke', 'none');
        node.textContent = o.text;
      } else {
        node = document.createElementNS(SVGNS, 'polyline');
        node.setAttribute('points', o.pts.map(function (p) { return p.join(','); }).join(' '));
      }
      ink.appendChild(node);
    });
  }

  // ---------- speaker / chapter ----------
  var currentChapter = -1;
  function renderMeta(t) {
    var s = speakers[lastAtOrBefore(speakers, t)];
    $('micName').textContent = s ? s.name : 'Bill Keith';
    var c = lastAtOrBefore(chapters, t);
    if (c !== currentChapter) {
      if (currentChapter >= 0) chapterItems[currentChapter].classList.remove('current');
      chapterItems[c].classList.add('current');
      $('chapterNow').textContent = chapters[c].title;
      currentChapter = c;
    }
  }

  // ---------- transport ----------
  var scrubbing = false;
  function render(t) {
    renderBoard(t);
    renderChat(t);
    renderMeta(t);
    $('cur').textContent = fmt(t);
    $('scrubFill').style.width = (t / duration * 100) + '%';
    if (!scrubbing) scrub.value = t;
  }

  function seek(t, updateUrl) {
    t = Math.min(Math.max(0, t), duration);
    audio.currentTime = t;
    render(t);
    if (updateUrl) {
      try { history.replaceState(null, '', '?t=' + Math.floor(t) + location.hash); } catch (e) { /* file:// */ }
    }
  }
  function play() { var p = audio.play(); if (p && p.catch) p.catch(function () {}); }
  function toggle() { if (audio.paused) play(); else audio.pause(); }

  $('playBtn').addEventListener('click', toggle);
  $('backBtn').addEventListener('click', function () { seek(audio.currentTime - 15); });
  $('fwdBtn').addEventListener('click', function () { seek(audio.currentTime + 15); });
  $('speed').addEventListener('change', function () { audio.playbackRate = +this.value; });

  scrub.addEventListener('input', function () { scrubbing = true; render(+scrub.value); });
  scrub.addEventListener('change', function () { scrubbing = false; seek(+scrub.value); });

  audio.addEventListener('play', function () { body.classList.add('playing'); $('playBtn').setAttribute('aria-label', 'Pause'); });
  audio.addEventListener('pause', function () { body.classList.remove('playing'); $('playBtn').setAttribute('aria-label', 'Play'); });
  audio.addEventListener('timeupdate', function () {
    if (!scrubbing) render(audio.currentTime);
    if (!audio.paused && Math.floor(audio.currentTime) % 5 === 0) store.set('bkw-pos', String(Math.floor(audio.currentTime)));
  });

  document.addEventListener('keydown', function (e) {
    if (e.target.closest('input, select, textarea, button, dialog') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === ' ' || e.key === 'k') { e.preventDefault(); toggle(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); seek(audio.currentTime - 15); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); seek(audio.currentTime + 15); }
  });

  // Start position: ?t=seconds, else where this browser left off.
  var start = 0;
  var m = /[?&]t=(\d+(?:\.\d+)?)/.exec(location.search);
  if (m) start = +m[1];
  else if (store.get('bkw-pos')) start = +store.get('bkw-pos') || 0;
  if (start > 0) {
    var apply = function () { audio.currentTime = start; };
    if (audio.readyState >= 1) apply(); else audio.addEventListener('loadedmetadata', apply, { once: true });
  }
  render(start);

  // ---------- galleries ----------
  var lightbox = $('lightbox');
  function openLightbox(src, cap) {
    $('lightboxImg').src = src;
    $('lightboxImg').alt = cap;
    $('lightboxCap').textContent = cap;
    if (lightbox.showModal) lightbox.showModal(); else window.open(src);
  }
  lightbox.addEventListener('click', function (e) { if (e.target === lightbox) lightbox.close(); });

  function galleryItem(list, src, title, sub) {
    var li = el('li'), b = el('button'), img = el('img'), cap = el('span', 'cap', title);
    b.type = 'button';
    img.src = src; img.alt = title; img.loading = 'lazy';
    if (sub) cap.appendChild(el('small', null, sub));
    b.appendChild(img); b.appendChild(cap);
    b.addEventListener('click', function () { openLightbox(src, sub ? title + ': ' + sub : title); });
    li.appendChild(b);
    list.appendChild(li);
  }
  HANDOUTS.forEach(function (h, i) {
    var n = (i < 9 ? '0' : '') + (i + 1);
    galleryItem($('handoutGallery'), 'handouts/page-' + n + '.jpg', (i + 1) + '. ' + h[0], h[1]);
  });
  TABS.forEach(function (tb) { galleryItem($('tabGallery'), 'tabs/' + tb[0] + '.jpg', tb[1]); });
})();
