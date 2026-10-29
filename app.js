(() => {
  const $ = (id) => document.getElementById(id);
  const messagesEl = $('messages');
  const form = $('form');
  const input = $('input');
  const statusEl = $('status');
  const onlineEl = $('onlineCount');
  const nameModal = $('nameModal');
  const nameForm = $('nameForm');
  const nameInput = $('nameInput');
  const myAvatar = $('myAvatar');

  // Identity (saved in this browser only)
  let clientId = localStorage.getItem('clientId');
  if (!clientId) {
    clientId = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('clientId', clientId);
  }
  let myName = localStorage.getItem('chatName') || '';

  const seen = new Set();   // message ids already shown
  let lastSender = null;    // for grouping consecutive messages

  function setName(name) {
    myName = name.trim().slice(0, 30);
    localStorage.setItem('chatName', myName);
    myAvatar.textContent = myName.charAt(0).toUpperCase() || '?';
  }

  function askName() {
    nameInput.value = myName;
    nameModal.classList.remove('hidden');
    nameInput.focus();
  }

  nameForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!nameInput.value.trim()) return;
    setName(nameInput.value);
    nameModal.classList.add('hidden');
    input.focus();
  });
  $('changeName').addEventListener('click', askName);

  if (myName) setName(myName); else askName();

  // Rendering
  function fmtTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function addMessage(msg) {
    if (seen.has(msg.id)) return;
    seen.add(msg.id);

    const empty = messagesEl.querySelector('.empty');
    if (empty) empty.remove();

    const mine = msg.clientId === clientId;
    const first = lastSender !== msg.clientId;
    lastSender = msg.clientId;

    const row = document.createElement('div');
    row.className = 'row ' + (mine ? 'me' : 'other') + (first ? ' first' : '');

    if (!mine) {
      if (first) {
        const av = document.createElement('div');
        av.className = 'avatar small';
        av.textContent = msg.name.charAt(0).toUpperCase();
        row.appendChild(av);
      } else {
        const sp = document.createElement('div');
        sp.className = 'spacer';
        row.appendChild(sp);
      }
    }

    const wrap = document.createElement('div');
    wrap.className = 'bubble-wrap';

    if (!mine && first) {
      const s = document.createElement('div');
      s.className = 'sender';
      s.textContent = msg.name;       // textContent => safe from HTML injection
      wrap.appendChild(s);
    }

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = msg.text;
    bubble.title = fmtTime(msg.time);
    wrap.appendChild(bubble);

    row.appendChild(wrap);

    const nearBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 120;
    messagesEl.appendChild(row);
    if (mine || nearBottom) messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function showEmpty() {
    if (!messagesEl.children.length) {
      const d = document.createElement('div');
      d.className = 'empty';
      d.textContent = 'No messages yet. Say hi! 👋';
      messagesEl.appendChild(d);
    }
  }

  // Connection (Server-Sent Events; auto-reconnects)
  function connect() {
    const es = new EventSource('/events');

    es.onopen = () => {
      statusEl.textContent = 'Connected';
      statusEl.className = 'status online';
    };
    es.onerror = () => {
      statusEl.textContent = 'Reconnecting…';
      statusEl.className = 'status offline';
    };
    es.addEventListener('history', (e) => {
      JSON.parse(e.data).forEach(addMessage);
      showEmpty();
    });
    es.addEventListener('message', (e) => addMessage(JSON.parse(e.data)));
    es.addEventListener('online', (e) => {
      onlineEl.textContent = JSON.parse(e.data).count;
    });
  }
  connect();

  // Sending
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    if (!myName) return askName();

    input.value = '';
    try {
      const res = await fetch('/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, name: myName, text }),
      });
      if (!res.ok) throw new Error('send failed');
    } catch (err) {
      input.value = text; // give the text back so nothing is lost
      alert('Could not send. Check that the server is still running.');
    }
    input.focus();
  });
})();