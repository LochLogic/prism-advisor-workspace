// Minimal dependency-free static file server for tests/preview.
// Usage: node scripts/serve.mjs <dir> <port>   (defaults: _site 3000)
// Serves files from <dir>; a directory request falls back to index.html.
import { createServer } from 'http';
import { readFile, stat } from 'fs/promises';
import { join, extname, normalize } from 'path';

const root = process.argv[2] || '_site';
const port = Number(process.argv[3] || 3000);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml',
};

createServer(async (req, res) => {
  try {
    // Strip query, normalize, and block path traversal out of root.
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    let rel = normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
    let filePath = join(root, rel);
    let s = await stat(filePath).catch(() => null);
    if (s && s.isDirectory()) { filePath = join(filePath, 'index.html'); s = await stat(filePath).catch(() => null); }
    if (!s) { res.writeHead(404); res.end('Not found'); return; }
    const body = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': TYPES[extname(filePath)] || 'application/octet-stream' });
    res.end(body);
  } catch (e) {
    res.writeHead(500); res.end('Server error');
  }
}).listen(port, () => console.log(`serving ${root} on http://localhost:${port}`));
