// LAN messenger server - uses only built-in Node.js modules (no npm install).
// Run on PC1:  node server.js
// Then open  http://<PC1-IP>:3000  on both PC1 and PC2.

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3000;
const HISTORY_LIMIT = 200;

const history = [];          // messages kept in memory only (no database)
const clients = new Map();   // open SSE response -> { clientId, name }

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients.keys()) res.write(payload);
}

function broadcastPresence() {
  const seen = new Map();
  for (const c of clients.values()) seen.set(c.clientId, { clientId: c.clientId, name: c.name });
  broadcast('presence', [...seen.values()]);
}

function readJson(req, res, cb) {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > 10000) req.destroy();
  });
  req.on('end', () => {
    try {
      cb(JSON.parse(body));
    } catch (e) {
      res.writeHead(400);
      res.end('{"ok":false}');
    }
  });
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  const url = u.pathname;

  // Live stream (Server-Sent Events)
  if (req.method === 'GET' && url === '/events') {
    const info = {
      clientId: (u.searchParams.get('cid') || '').slice(0, 64),
      name: (u.searchParams.get('name') || 'Anonymous').trim().slice(0, 30) || 'Anonymous',
    };
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('retry: 2000\n\n');
    res.write(`event: history\ndata: ${JSON.stringify(history)}\n\n`);
    clients.set(res, info);
    broadcastPresence();
    req.on('close', () => {
      clients.delete(res);
      broadcastPresence();
    });
    return;
  }

  // New message
  if (req.method === 'POST' && url === '/send') {
    return readJson(req, res, ({ clientId, name, text }) => {
      const clean = String(text || '').trim().slice(0, 2000);
      if (!clean) {
        res.writeHead(400);
        return res.end('{"ok":false}');
      }
      const msg = {
        id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        clientId: String(clientId || ''),
        name: String(name || 'Anonymous').trim().slice(0, 30) || 'Anonymous',
        text: clean,
        time: Date.now(),
      };
      history.push(msg);
      if (history.length > HISTORY_LIMIT) history.shift();
      broadcast('message', msg);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    });
  }

  // Typing indicator
  if (req.method === 'POST' && url === '/typing') {
    return readJson(req, res, ({ clientId, name }) => {
      broadcast('typing', {
        clientId: String(clientId || ''),
        name: String(name || 'Someone').trim().slice(0, 30),
      });
      res.writeHead(200);
      res.end('{"ok":true}');
    });
  }

  // Static files
  const file = url === '/' ? '/index.html' : url;
  const filePath = path.join(__dirname, path.normalize(file).replace(/^(\.\.[/\\])+/, ''));
  const ext = path.extname(filePath);
  if (!MIME[ext]) { res.writeHead(404); return res.end('Not found'); }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[ext] });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('\nMessenger server running!\n');
  console.log(`  This PC:      http://localhost:${PORT}`);
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list) {
      if (i.family === 'IPv4' && !i.internal) {
        console.log(`  Other PC:     http://${i.address}:${PORT}   <-- open this on the other computer`);
      }
    }
  }
  console.log('\nPress Ctrl+C to stop.\n');
});
