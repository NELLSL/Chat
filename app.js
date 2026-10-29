(() => {
  const $ = (id) => document.getElementById(id);
  const messagesEl = $('messages');
  const form = $('form');
  const input = $('input');
  const statusEl = $('status');
  const peopleEl = $('people');
  const typingEl = $('typing');
  const typingText = $('typingText');
  const nameModal = $('nameModal');
  const nameForm = $('nameForm');
  const nameInput = $('nameInput');
  const myAvatar = $('myAvatar');
  const emojiPop = $('emojiPop');
  const searchEl = $('search');

  /* ---------- Identity ---------- */
  let clientId = localStorage.getItem('clientId');
  if (!clientId) {
    clientId = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('clientId', clientId);
  }
  let myName = localStorage.getItem('chatName') || '';

  /* ---------- Theme ---------- */
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    const icon = t === 'dark' ? '☀️' : '🌙';
    $('themeBtn').textContent = icon;
    $('themeBtn2').textContent = icon;
  }
  let theme = localStorage.getItem('theme') ||
    (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(theme);
  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', theme);
    applyTheme(theme);
  }
  $('themeBtn').addEventListener('click', toggleTheme);
  $('themeBtn2').addEventListener('click', toggleTheme);

  /* ---------- Helpers ---------- */
  const COLORS = [
    ['#ff5ca8', '#ff8a5c'], ['#0aa0ff', '#44bec7'], ['#a033ff', '#ff5ca8'],
    ['#31a24c', '#a3e635'], ['#f7b928', '#ff7a00'], ['#6a5af9', '#00c6ff'],
  ];
  function makeAvatar(name, cls, online) {
    let h = 0;
    for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const [a, b] = COLORS[h % COLORS.length];
    const el = document.createElement('div');
    el.className = 'avatar ' + (cls || '');
    el.style.background = `linear-gradient(135deg, ${a}, ${b})`;
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
    myAvatar.replaceWith(fresh);
  }
  const GAP = 15 * 60 * 1000;
  const fmtTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  function fmtDivider(ts) {
    const d = new Date(ts), now = new Date();
    const time = fmtTime(ts);
    if (d.toDateString() === now.toDateString()) return time;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + time;
  }
  const EMOJI_ONLY = /^[\p{Extended_Pictographic}️‍\s]+$/u;
  const isBigEmoji = (t) => EMOJI_ONLY.test(t) && [...t.trim()].length <= 6;

  /* ---------- State ---------- */
  const messages = [];
  const seen = new Set();
  let people = [];
  const typers = new Map(); // clientId -> { name, timer }

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

  /* ---------- Rendering ---------- */
  function render(forceBottom) {
    const nearBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 140;
    const q = searchEl.value.trim().toLowerCase();
    const list = q ? messages.filter((m) => m.text.toLowerCase().includes(q)) : messages;

    messagesEl.innerHTML = '';

    if (!list.length) {
      const d = document.createElement('div');
      d.className = 'intro';
      d.appendChild(makeAvatar('💬', 'lg'));
      d.innerHTML += q ? '<b>No results</b><span>Try a different word.</span>'
                       : '<b>LAN Chat</b><span>No messages yet. Say hi! 👋</span>';
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
      const sameAsPrev = prev && !newBlock && prev.clientId === m.clientId;
      const sameAsNext = next && next.time - m.time <= GAP && next.clientId === m.clientId;
      const first = !sameAsPrev;
      const last = !sameAsNext;

      const row = document.createElement('div');
      row.className = 'msg ' + (mine ? 'me' : 'other') + (first ? ' first' : '') + (last ? ' last' : '');

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
      b.className = 'bubble' + (isBigEmoji(m.text) ? ' big' : '');
      b.textContent = m.text;           // textContent => safe from HTML injection
      b.title = fmtTime(m.time);
      col.appendChild(b);
      row.appendChild(col);
      messagesEl.appendChild(row);
    });

    if (forceBottom || nearBottom) messagesEl.scrollTop = messagesEl.scrollHeight;
    updatePreview();
  }

  function updatePreview() {
    const last = messages[messages.length - 1];
    $('convPreview').textContent = last
      ? (last.clientId === clientId ? 'You: ' : last.name + ': ') + last.text
      : 'No messages yet';
    $('convWhen').textContent = last ? '· ' + fmtTime(last.time) : '';
  }

  function renderPeople() {
    peopleEl.innerHTML = '';
    if (!people.length) {
      peopleEl.innerHTML = '<li class="no-people">Nobody is online</li>';
    }
    people.forEach((p) => {
      const li = document.createElement('li');
      li.className = 'person';
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
    const others = people.filter((p) => p.clientId !== clientId).length;
    statusEl.textContent = es && es.readyState === 1
      ? (others ? `${others} active now` : 'Only you are online')
      : 'Reconnecting…';
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
  let es = null;
  function connect() {
    if (!myName) return;
    if (es) es.close();
    es = new EventSource(`/events?cid=${encodeURIComponent(clientId)}&name=${encodeURIComponent(myName)}`);

    es.onopen = () => {
      statusEl.className = 'status ok';
      renderPeople();
    };
    es.onerror = () => {
      statusEl.className = 'status bad';
      statusEl.textContent = 'Reconnecting…';
    };
    es.addEventListener('history', (e) => {
      JSON.parse(e.data).forEach(addMessage);
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
      typers.set(t.clientId, {
        name: t.name,
        timer: setTimeout(() => clearTyper(t.clientId), 3500),
      });
      renderTyping();
    });
  }

  /* ---------- Sending ---------- */
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
      alert('Could not send. Check that the server is still running.');
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

  // Send/like toggle + typing indicator
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
