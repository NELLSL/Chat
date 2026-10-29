// LAN chat server - uses only built-in Node.js modules (no npm install).
// Run on PC1:  node server.js
// Then open  http://<PC1-IP>:3000  on both PC1 and PC2.
//
// Optional settings:
//   PORT=4000     change the port
//   MAX_MB=500    change the max size of one shared file (default 100 MB)

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const MAX_MB = Number(process.env.MAX_MB) > 0 ? Number(process.env.MAX_MB) : 100;
const MAX_BYTES = MAX_MB * 1024 * 1024;
const HISTORY_LIMIT = 200;

// Shared files are stored in a fresh temporary folder each time the server starts.
const UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-chat-'));

const history = [];          // messages kept in memory only (no database)
const clients = new Map();   // open SSE response -> { clientId, name }
const files = new Map();     // file id -> { path, name, size, mime, image }

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};
const STATIC_FILES = new Set(['/index.html', '/app.js']);
// Only these are shown inline as pictures; everything else is a download.
const IMAGE_MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
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

function pushHistory(msg) {
  history.push(msg);
  if (history.length > HISTORY_LIMIT) {
    const old = history.shift();
    if (old.file && files.has(old.file.id)) {       // free disk space of old files
      fs.unlink(files.get(old.file.id).path, () => {});
      files.delete(old.file.id);
    }
  }
}

function safeDecode(s, fallback) {
  try { return decodeURIComponent(s); } catch (e) { return fallback; }
}

function cleanFileName(n) {
  return String(n).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().slice(0, 200) || 'file';
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', Connection: code === 200 ? 'keep-alive' : 'close' });
  res.end(JSON.stringify(obj));
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
    res.write(`event: config\ndata: ${JSON.stringify({ maxBytes: MAX_BYTES })}\n\n`);
    res.write(`event: history\ndata: ${JSON.stringify(history)}\n\n`);
    clients.set(res, info);
    broadcastPresence();
    req.on('close', () => {
      clients.delete(res);
      broadcastPresence();
    });
    return;
  }

  // New text message
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
      pushHistory(msg);
      broadcast('message', msg);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    });
  }

  // File / document upload: the raw file is the request body.
  // Sender info + file name travel in headers (so no multipart parsing is needed).
  if (req.method === 'POST' && url === '/upload') {
    const clientId = String(req.headers['x-client-id'] || '').slice(0, 64);
    const name = safeDecode(req.headers['x-name'] || '', 'Anonymous').trim().slice(0, 30) || 'Anonymous';
    const fileName = cleanFileName(safeDecode(req.headers['x-filename'] || '', 'file'));
    const declared = Number(req.headers['content-length'] || 0);

    if (declared > MAX_BYTES) {
      res.on('finish', () => req.destroy());
      return json(res, 413, { ok: false, error: `File is too large (max ${MAX_MB} MB)` });
    }

    const id = crypto.randomBytes(8).toString('hex');
    const filePath = path.join(UPLOAD_DIR, id);
    const out = fs.createWriteStream(filePath);
    let size = 0;
    let failed = false;

    const fail = (code, error) => {
      if (failed) return;
      failed = true;
      out.destroy();
      fs.unlink(filePath, () => {});
      if (!res.writableEnded) {
        res.on('finish', () => req.destroy());
        json(res, code, { ok: false, error });
      }
    };

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BYTES) fail(413, `File is too large (max ${MAX_MB} MB)`);
    });
    req.on('aborted', () => fail(499, 'aborted'));
    req.on('error', () => fail(400, 'upload error'));
    out.on('error', () => fail(500, 'could not save file'));
    req.pipe(out);

    out.on('finish', () => {
      if (failed) return;
      if (size === 0) { fs.unlink(filePath, () => {}); return json(res, 400, { ok: false, error: 'Empty file' }); }
      const ext = path.extname(fileName).toLowerCase();
      const image = Object.prototype.hasOwnProperty.call(IMAGE_MIME, ext);
      files.set(id, { path: filePath, name: fileName, size, mime: image ? IMAGE_MIME[ext] : 'application/octet-stream', image });
      const msg = {
        id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        clientId,
        name,
        text: '',
        file: { id, name: fileName, size, image },
        time: Date.now(),
      };
      pushHistory(msg);
      broadcast('message', msg);
      json(res, 200, { ok: true });
    });
    return;
  }

  // Download / preview a shared file
  const fm = url.match(/^\/files\/([a-f0-9]{16})$/);
  if (req.method === 'GET' && fm) {
    const f = files.get(fm[1]);
    if (!f) { res.writeHead(404); return res.end('File not found'); }
    const inline = f.image && u.searchParams.get('dl') !== '1';
    res.writeHead(200, {
      'Content-Type': f.mime,
      'Content-Length': f.size,
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(f.name)}`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "sandbox; default-src 'none'; img-src 'self'",
      'Cache-Control': 'private, max-age=3600',
    });
    fs.createReadStream(f.path).on('error', () => res.destroy()).pipe(res);
    return;
  }

  if (url === '/favicon.ico') { res.writeHead(204); return res.end(); }

  // Static files (only the chat page itself; nothing else in the folder is exposed)
  const file = url === '/' ? '/index.html' : url;
  if (!STATIC_FILES.has(file)) { res.writeHead(404); return res.end('Not found'); }
  const filePath = path.join(__dirname, file);
  const ext = path.extname(filePath);
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
  console.log(`\n  Shared files are stored in: ${UPLOAD_DIR}`);
  console.log(`  Max file size: ${MAX_MB} MB (change with MAX_MB=...)`);
  console.log('\nPress Ctrl+C to stop.\n');
});
