(() => {
  const $ = (id) => document.getElementById(id);
  const appEl = $('app');
  const chatEl = document.querySelector('.chat');
  const messagesEl = $('messages');
  const form = $('form');
  const input = $('input');
  const statusEl = $('status');
  const progressEl = $('progress');
  const peopleEl = $('people');
  const typingEl = $('typing');
  const typingText = $('typingText');
  const nameModal = $('nameModal');
  const nameForm = $('nameForm');
  const nameInput = $('nameInput');
  const emojiPop = $('emojiPop');
  const searchEl = $('search');
  const snackEl = $('snack');
  const fileInput = $('fileInput');
  const dropEl = $('drop');

  const svg = (d) => `<svg class="ic" viewBox="0 0 24 24"><path d="${d}"/></svg>`;
  const ICON_MOON = 'M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z';
  const ICON_SUN = 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM2 13h2a1 1 0 1 0 0-2H2a1 1 0 1 0 0 2zm18 0h2a1 1 0 1 0 0-2h-2a1 1 0 1 0 0 2zM11 2v2a1 1 0 1 0 2 0V2a1 1 0 1 0-2 0zm0 18v2a1 1 0 1 0 2 0v-2a1 1 0 1 0-2 0zM5.99 4.58a1 1 0 0 0-1.41 1.41l1.06 1.06a1 1 0 0 0 1.41-1.41L5.99 4.58zm12.37 12.37a1 1 0 0 0-1.41 1.41l1.06 1.06a1 1 0 0 0 1.41-1.41l-1.06-1.06zm1.06-10.96a1 1 0 0 0-1.41-1.41l-1.06 1.06a1 1 0 0 0 1.41 1.41l1.06-1.06zM7.05 18.36a1 1 0 0 0-1.41-1.41l-1.06 1.06a1 1 0 0 0 1.41 1.41l1.06-1.06z';
  const ICON_DOWNLOAD = 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z';
  const ICON_CLOSE = 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z';
  const ICON_CHAT = 'M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z';

  /* ---------- Identity ---------- */
  let clientId = localStorage.getItem('clientId');
  if (!clientId) {
    clientId = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('clientId', clientId);
  }
  let myName = localStorage.getItem('chatName') || '';

  /* ---------- Ripple effect ---------- */
  document.addEventListener('pointerdown', (e) => {
    const t = e.target.closest('.ripple');
    if (!t) return;
    const r = t.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2;
    const s = document.createElement('span');
    s.className = 'rip';
    s.style.width = s.style.height = size + 'px';
    s.style.left = (e.clientX - r.left - size / 2) + 'px';
    s.style.top = (e.clientY - r.top - size / 2) + 'px';
    t.appendChild(s);
    s.addEventListener('animationend', () => s.remove());
  });

  /* ---------- Snackbar ---------- */
  let snackTimer;
  function snack(text, ms) {
    snackEl.textContent = text;
    snackEl.classList.add('show');
    clearTimeout(snackTimer);
    if (ms) snackTimer = setTimeout(() => snackEl.classList.remove('show'), ms);
  }

  /* ---------- Theme ---------- */
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    $('themeBtn').innerHTML = svg(t === 'dark' ? ICON_SUN : ICON_MOON);
  }
  let theme = localStorage.getItem('theme') ||
    (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(theme);
  $('themeBtn').addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', theme);
    applyTheme(theme);
  });

  /* ---------- Side navigation ---------- */
  const mq = window.matchMedia('(max-width: 820px)');
  const setNav = (open) => appEl.classList.toggle('nav-open', open);
  setNav(!mq.matches);
  $('navBtn').addEventListener('click', () => setNav(!appEl.classList.contains('nav-open')));
  $('scrim').addEventListener('click', () => setNav(false));
  mq.addEventListener('change', (e) => setNav(!e.matches));

  /* ---------- Helpers ---------- */
  const COLORS = ['#1a73e8', '#d93025', '#e37400', '#188038', '#a142f4', '#e52592', '#129eaf'];
  function makeAvatar(name, cls, online) {
    let h = 0;
    for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const el = document.createElement('div');
    el.className = 'avatar ' + (cls || '');
    el.style.background = COLORS[h % COLORS.length];
    el.textContent = (name.trim().charAt(0) || '?').toUpperCase();
    if (online) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      el.appendChild(badge);
    }
    return el;
  }
  function paintMyAvatar() {
    const fresh = makeAvatar(myName || '?', 'sm');
    fresh.id = 'myAvatar';
    $('myAvatar').replaceWith(fresh);
  }
  const GAP = 15 * 60 * 1000;
  const fmtTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  function fmtDivider(ts) {
    const d = new Date(ts), now = new Date();
    if (d.toDateString() === now.toDateString()) return 'Today, ' + fmtTime(ts);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + fmtTime(ts);
  }
  const EMOJI_ONLY = /^[\p{Extended_Pictographic}️‍\s]+$/u;
  const isBigEmoji = (t) => EMOJI_ONLY.test(t) && [...t.trim()].length <= 6;

  function fmtSize(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB';
    if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB';
    return (n / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  }
  const extOf = (name) => (name.includes('.') ? name.split('.').pop().toLowerCase() : '');
  const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'];
  const EXT_COLORS = {
    pdf: '#d93025', doc: '#1a73e8', docx: '#1a73e8', txt: '#5f6368', rtf: '#5f6368',
    xls: '#188038', xlsx: '#188038', csv: '#188038',
    ppt: '#e37400', pptx: '#e37400',
    zip: '#795548', rar: '#795548', '7z': '#795548',
    mp3: '#a142f4', wav: '#a142f4', mp4: '#e52592', mov: '#e52592', mkv: '#e52592',
    js: '#f9ab00', html: '#e37400', json: '#129eaf', exe: '#5f6368',
  };
  const previewText = (m) => (m.file ? (m.file.image ? '📷 ' : '📎 ') + m.file.name : m.text);

  /* ---------- State ---------- */
  const messages = [];
  const seen = new Set();
  const rendered = new Set();   // ids already drawn (so only new ones animate)
  const imgCache = new Map();   // file id -> <img> (reused so pictures don't reload)
  const pending = [];           // uploads in progress
  let maxBytes = 100 * 1024 * 1024;
  let people = [];
  const typers = new Map();     // clientId -> { name, timer }
  let es = null;
  let stick = true;             // is the chat scrolled to the bottom?

  messagesEl.addEventListener('scroll', () => {
    stick = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 140;
  });
  const scrollBottom = () => { messagesEl.scrollTop = messagesEl.scrollHeight; };

  /* ---------- Name dialog ---------- */
  function askName() {
    nameInput.value = myName;
    nameModal.classList.remove('hidden');
    nameInput.focus();
    nameInput.select();
  }
  nameForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = nameInput.value.trim().slice(0, 30);
    if (!v) return;
    const changed = v !== myName;
    myName = v;
    localStorage.setItem('chatName', myName);
    paintMyAvatar();
    nameModal.classList.add('hidden');
    if (changed) connect();   // reconnect so others see the new name
    render(true);
    input.focus();
  });
  $('meBtn').addEventListener('click', askName);

  /* ---------- File cards ---------- */
  function fileBadge(name) {
    const ext = extOf(name);
    const b = document.createElement('div');
    b.className = 'file-ext';
    b.style.background = EXT_COLORS[ext] || '#5f6368';
    b.textContent = (ext || 'file').slice(0, 4).toUpperCase();
    return b;
  }

  function fileCard(file) {
    const card = document.createElement('div');
    card.className = 'file-card';
    card.appendChild(fileBadge(file.name));
    const meta = document.createElement('div');
    meta.className = 'file-meta';
    const n = document.createElement('div');
    n.className = 'file-name';
    n.textContent = file.name;
    n.title = file.name;
    const s = document.createElement('div');
    s.className = 'file-size';
    s.textContent = fmtSize(file.size);
    meta.append(n, s);
    card.appendChild(meta);
    const a = document.createElement('a');
    a.className = 'dl ripple';
    a.href = '/files/' + file.id + '?dl=1';
    a.download = file.name;
    a.title = 'Download';
    a.innerHTML = svg(ICON_DOWNLOAD);
    card.appendChild(a);
    return card;
  }

  function imageEl(file) {
    let img = imgCache.get(file.id);
    if (!img) {
      img = new Image();
      img.src = '/files/' + file.id;
      img.alt = file.name;
      img.title = file.name;
      img.addEventListener('load', () => { if (stick) scrollBottom(); });
      img.addEventListener('click', () => openLightbox(file));
      imgCache.set(file.id, img);
    }
    return img;
  }

  function pendingRow(up) {
    const row = document.createElement('div');
    row.className = 'msg me first last pop';
    row.dataset.up = up.id;
    const col = document.createElement('div');
    col.className = 'col';
    const b = document.createElement('div');
    b.className = 'bubble file';
    const card = document.createElement('div');
    card.className = 'file-card';
    card.appendChild(fileBadge(up.name));
    const meta = document.createElement('div');
    meta.className = 'file-meta';
    const n = document.createElement('div');
    n.className = 'file-name';
    n.textContent = up.name;
    const s = document.createElement('div');
    s.className = 'file-size';
    s.textContent = 'Uploading… ' + Math.round(up.pct * 100) + '%';
    const bar = document.createElement('div');
    bar.className = 'bar';
    const fill = document.createElement('i');
    fill.style.width = Math.round(up.pct * 100) + '%';
    bar.appendChild(fill);
    meta.append(n, s, bar);
    card.appendChild(meta);
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'cancel ripple';
    x.title = 'Cancel upload';
    x.innerHTML = svg(ICON_CLOSE);
    x.addEventListener('click', () => up.xhr.abort());
    card.appendChild(x);
    b.appendChild(card);
    col.appendChild(b);
    row.appendChild(col);
    return row;
  }

  /* ---------- Rendering ---------- */
  function render(forceBottom) {
    const nearBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 140;
    const q = searchEl.value.trim().toLowerCase();
    const list = q
      ? messages.filter((m) => (m.file ? m.file.name : m.text).toLowerCase().includes(q))
      : messages;

    messagesEl.innerHTML = '';

    if (!list.length && !(pending.length && !q)) {
      const d = document.createElement('div');
      d.className = 'intro';
      const av = document.createElement('div');
      av.className = 'avatar group lg';
      av.innerHTML = svg(ICON_CHAT);
      d.appendChild(av);
      const t = document.createElement('div');
      t.innerHTML = q ? '<b>No results</b><br><span>Try a different word.</span>'
                      : '<b>LAN Chat</b><br><span>No messages yet. Say hi! 👋</span>';
      d.appendChild(t);
      messagesEl.appendChild(d);
    }

    list.forEach((m, i) => {
      const prev = list[i - 1];
      const next = list[i + 1];
      const mine = m.clientId === clientId;

      const newBlock = !prev || m.time - prev.time > GAP;
      if (newBlock) {
        const dv = document.createElement('div');
        dv.className = 'divider';
        dv.textContent = fmtDivider(m.time);
        messagesEl.appendChild(dv);
      }
      const first = !(prev && !newBlock && prev.clientId === m.clientId);
      const last = !(next && next.time - m.time <= GAP && next.clientId === m.clientId);

      const isNew = !rendered.has(m.id);
      rendered.add(m.id);

      const row = document.createElement('div');
      row.className = 'msg ' + (mine ? 'me' : 'other') + (first ? ' first' : '') + (last ? ' last' : '') + (isNew ? ' pop' : '');

      if (!mine) {
        if (last) row.appendChild(makeAvatar(m.name, 'sm'));
        else { const sp = document.createElement('div'); sp.className = 'spacer'; row.appendChild(sp); }
      }

      const col = document.createElement('div');
      col.className = 'col';
      if (!mine && first) {
        const s = document.createElement('div');
        s.className = 'sender';
        s.textContent = m.name;
        col.appendChild(s);
      }

      const b = document.createElement('div');
      if (m.file && m.file.image) {
        b.className = 'bubble img';
        b.appendChild(imageEl(m.file));
      } else if (m.file) {
        b.className = 'bubble file';
        b.appendChild(fileCard(m.file));
      } else {
        b.className = 'bubble' + (isBigEmoji(m.text) ? ' big' : '');
        b.textContent = m.text;           // textContent => safe from HTML injection
      }
      col.appendChild(b);

      if (last) {
        const tm = document.createElement('div');
        tm.className = 'time';
        tm.textContent = fmtTime(m.time);
        col.appendChild(tm);
      }
      row.appendChild(col);
      messagesEl.appendChild(row);
    });

    if (!q) pending.forEach((up) => messagesEl.appendChild(pendingRow(up)));

    if (forceBottom || nearBottom) { scrollBottom(); stick = true; }
    updatePreview();
  }

  function updatePreview() {
    const last = messages[messages.length - 1];
    $('convPreview').textContent = last
      ? (last.clientId === clientId ? 'You: ' : last.name + ': ') + previewText(last)
      : 'No messages yet';
    $('convWhen').textContent = last ? '· ' + fmtTime(last.time) : '';
  }

  function updateStatus() {
    const online = es && es.readyState === 1;
    statusEl.classList.toggle('bad', !online);
    progressEl.classList.toggle('on', !online);
    if (!online) { statusEl.textContent = 'Connecting…'; return; }
    const others = people.filter((p) => p.clientId !== clientId).length;
    statusEl.textContent = others ? `${others} active now` : 'Only you are online';
  }

  function renderPeople() {
    peopleEl.innerHTML = '';
    if (!people.length) peopleEl.innerHTML = '<li class="no-people">Nobody is online</li>';
    people.forEach((p) => {
      const li = document.createElement('li');
      li.className = 'person ripple';
      li.appendChild(makeAvatar(p.name, '', true));
      const n = document.createElement('span');
      n.className = 'pname';
      n.textContent = p.name;
      if (p.clientId === clientId) {
        const y = document.createElement('span');
        y.className = 'you';
        y.textContent = ' (You)';
        n.appendChild(y);
      }
      li.appendChild(n);
      peopleEl.appendChild(li);
    });
    updateStatus();
  }

  function renderTyping() {
    const names = [...typers.values()].map((t) => t.name);
    if (!names.length) { typingEl.classList.add('hidden'); return; }
    typingText.textContent = names.length === 1 ? names[0] + ' is typing…' : names.join(', ') + ' are typing…';
    typingEl.classList.remove('hidden');
  }
  function clearTyper(cid) {
    const t = typers.get(cid);
    if (t) { clearTimeout(t.timer); typers.delete(cid); renderTyping(); }
  }

  function addMessage(m) {
    if (seen.has(m.id)) return;
    seen.add(m.id);
    messages.push(m);
    clearTyper(m.clientId);
  }

  searchEl.addEventListener('input', () => render(false));

  /* ---------- Connection (Server-Sent Events, auto-reconnect) ---------- */
  let wasOnline = false;
  function connect() {
    if (!myName) return;
    if (es) es.close();
    es = new EventSource(`/events?cid=${encodeURIComponent(clientId)}&name=${encodeURIComponent(myName)}`);

    es.onopen = () => {
      updateStatus();
      snack(wasOnline ? 'Back online' : 'Connected', 2500);
      wasOnline = true;
    };
    es.onerror = () => {
      updateStatus();
      snack('Connection lost. Reconnecting…');
    };
    es.addEventListener('config', (e) => {
      const c = JSON.parse(e.data);
      if (c.maxBytes) maxBytes = c.maxBytes;
    });
    es.addEventListener('history', (e) => {
      JSON.parse(e.data).forEach(addMessage);
      messages.forEach((m) => rendered.add(m.id));   // no animation for old messages
      render(true);
    });
    es.addEventListener('message', (e) => {
      addMessage(JSON.parse(e.data));
      render(false);
    });
    es.addEventListener('presence', (e) => {
      people = JSON.parse(e.data);
      renderPeople();
    });
    es.addEventListener('typing', (e) => {
      const t = JSON.parse(e.data);
      if (t.clientId === clientId) return;
      const old = typers.get(t.clientId);
      if (old) clearTimeout(old.timer);
      typers.set(t.clientId, { name: t.name, timer: setTimeout(() => clearTyper(t.clientId), 3500) });
      renderTyping();
    });
  }

  /* ---------- Sending text ---------- */
  let lastTypingPing = 0;
  async function send(text) {
    text = text.trim();
    if (!text) return;
    if (!myName) return askName();
    try {
      const res = await fetch('/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, name: myName, text }),
      });
      if (!res.ok) throw new Error('send failed');
      return true;
    } catch (err) {
      snack('Could not send. Is the server still running?', 4000);
      return false;
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value;
    if (!text.trim()) return;
    input.value = '';
    form.classList.remove('has-text');
    lastTypingPing = 0;   // so the next keystroke shows "typing…" right away
    const ok = await send(text);
    if (ok === false) { input.value = text; form.classList.add('has-text'); }
    input.focus();
  });

  $('likeBtn').addEventListener('click', () => { send('👍'); input.focus(); });

  input.addEventListener('input', () => {
    form.classList.toggle('has-text', input.value.trim().length > 0);
    const now = Date.now();
    if (input.value.trim() && now - lastTypingPing > 2000 && myName) {
      lastTypingPing = now;
      fetch('/typing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, name: myName }),
      }).catch(() => {});
    }
  });

  /* ---------- Sending files ---------- */
  function updateUploadUI(up) {
    const row = messagesEl.querySelector(`[data-up="${up.id}"]`);
    if (!row) return;
    const pct = Math.round(up.pct * 100);
    row.querySelector('.bar i').style.width = pct + '%';
    row.querySelector('.file-size').textContent = pct >= 100 ? 'Finishing…' : 'Uploading… ' + pct + '%';
  }

  function uploadFile(file) {
    if (!myName) { askName(); return; }
    if (file.size === 0) { snack(`"${file.name}" is empty or is a folder, so it was skipped.`, 4000); return; }
    if (file.size > maxBytes) {
      snack(`"${file.name}" is too large (${fmtSize(file.size)}). Limit is ${fmtSize(maxBytes)}.`, 5000);
      return;
    }

    const xhr = new XMLHttpRequest();
    const up = { id: Math.random().toString(36).slice(2), name: file.name || 'file', pct: 0, xhr };
    pending.push(up);
    render(true);

    const done = () => {
      const i = pending.indexOf(up);
      if (i >= 0) pending.splice(i, 1);
      render(false);
    };

    xhr.open('POST', '/upload');
    xhr.setRequestHeader('X-Client-Id', clientId);
    xhr.setRequestHeader('X-Name', encodeURIComponent(myName));
    xhr.setRequestHeader('X-Filename', encodeURIComponent(up.name));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) { up.pct = e.loaded / e.total; updateUploadUI(up); }
    };
    xhr.onload = () => {
      done();
      if (xhr.status !== 200) {
        let msg = 'Could not send "' + up.name + '".';
        try { msg = JSON.parse(xhr.responseText).error || msg; } catch (e) {}
        snack(msg, 5000);
      }
    };
    xhr.onerror = () => { done(); snack('Could not send "' + up.name + '". Is the server still running?', 5000); };
    xhr.onabort = () => { done(); snack('Upload cancelled.', 2500); };
    xhr.send(file);
  }

  const uploadAll = (fileList) => [...fileList].forEach(uploadFile);

  $('attachBtn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => { uploadAll(fileInput.files); fileInput.value = ''; });

  // Paste an image / file (Ctrl+V)
  input.addEventListener('paste', (e) => {
    const files = e.clipboardData && e.clipboardData.files;
    if (files && files.length) { e.preventDefault(); uploadAll(files); }
  });

  // Drag & drop onto the chat
  const hasFiles = (e) => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
  let dragDepth = 0;
  chatEl.addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth++;
    dropEl.classList.add('on');
  });
  chatEl.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
  chatEl.addEventListener('dragleave', (e) => {
    if (!hasFiles(e)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) dropEl.classList.remove('on');
  });
  chatEl.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth = 0;
    dropEl.classList.remove('on');
    uploadAll(e.dataTransfer.files);
  });
  // Don't let the browser open a file that is dropped outside the chat
  window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener('drop', (e) => { if (hasFiles(e)) e.preventDefault(); });

  /* ---------- Image viewer ---------- */
  const lb = $('lightbox');
  function openLightbox(file) {
    $('lbImg').src = '/files/' + file.id;
    $('lbName').textContent = file.name + ' · ' + fmtSize(file.size);
    $('lbDl').href = '/files/' + file.id + '?dl=1';
    $('lbDl').download = file.name;
    lb.classList.remove('hidden');
  }
  const closeLightbox = () => { lb.classList.add('hidden'); $('lbImg').removeAttribute('src'); };
  $('lbClose').addEventListener('click', closeLightbox);
  lb.addEventListener('click', (e) => { if (e.target === lb) closeLightbox(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !lb.classList.contains('hidden')) closeLightbox(); });

  /* ---------- Emoji picker ---------- */
  const EMOJIS = ['😀', '😂', '🤣', '😊', '😍', '😘', '😎', '🥹', '😭', '😅', '😉', '🤔', '😴', '🥳',
                  '👍', '👏', '🙏', '💪', '👋', '🔥', '❤️', '💙', '💯', '🎉', '✨', '😡', '😱', '🤝'];
  EMOJIS.forEach((em) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = em;
    b.addEventListener('click', () => {
      input.value += em;
      input.dispatchEvent(new Event('input'));
      input.focus();
    });
    emojiPop.appendChild(b);
  });
  $('emojiBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    emojiPop.classList.toggle('hidden');
  });
  document.addEventListener('click', (e) => {
    if (!emojiPop.contains(e.target)) emojiPop.classList.add('hidden');
  });

  /* ---------- Start ---------- */
  if (myName) { paintMyAvatar(); connect(); } else { askName(); }
  render(true);
})();
