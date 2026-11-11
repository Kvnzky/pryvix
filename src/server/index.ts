import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { handleGhlApiRequest } from './apiMiddleware';

const PORT = Number(process.env.PORT || 5188);
const DIST_DIR = path.resolve(process.cwd(), 'dist');

const MIME_MAP: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
};

const server = http.createServer(async (req, res) => {
  const handled = await handleGhlApiRequest(req, res);
  if (handled) return;

  const urlPath = (req.url || '/').split('?')[0];
  const safeRelPath = path.normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, '');
  let targetFile = path.join(DIST_DIR, safeRelPath === '/' || safeRelPath === '\\' ? 'index.html' : safeRelPath);

  if (!fs.existsSync(targetFile) || fs.statSync(targetFile).isDirectory()) {
    targetFile = path.join(DIST_DIR, 'index.html');
  }

  if (fs.existsSync(targetFile)) {
    const ext = path.extname(targetFile).toLowerCase();
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME_MAP[ext] || 'application/octet-stream');
    fs.createReadStream(targetFile).pipe(res);
  } else {
    res.statusCode = 404;
    res.end('Not found. Run "npm run build" first.');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Pryvix Web & GHL Media Storage Backend listening at http://localhost:${PORT}`);
});
