// Simple LAN messenger server - uses only built-in Node.js modules (no npm install).
// Run on PC1:  node server.js
// Then open  http://<PC1-IP>:3000  on both PC1 and PC2.

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3000;
const HISTORY_LIMIT = 100;

const history = [];      // messages kept in memory only (no database)
const clients = new Set(); // open SSE connections

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(payload);
}

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  // Live stream of messages (Server-Sent Events)
  if (req.method === 'GET' && url === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('retry: 2000\n\n');
    res.write(`event: history\ndata: ${JSON.stringify(history)}\n\n`);
    clients.add(res);
    broadcast('online', { count: clients.size });
    req.on('close', () => {
      clients.delete(res);
      broadcast('online', { count: clients.size });
    });
    return;
  }

  // Receive a new message
  if (req.method === 'POST' && url === '/send') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 10000) req.destroy();
    });
    req.on('end', () => {
      try {
        const { clientId, name, text } = JSON.parse(body);
        const clean = String(text || '').trim().slice(0, 2000);
        if (!clean) throw new Error('empty');
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
      } catch (e) {
        res.writeHead(400);
        res.end('{"ok":false}');
      }
    });
    return;
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