// Tiny local receiver for the in-browser film capture: POST /<name> with a PNG body -> assets/video/game_frames/<name>.png
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'game_frames'); fs.mkdirSync(dir, { recursive: true });
http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS'); res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const name = decodeURIComponent(req.url.slice(1)).replace(/[^a-zA-Z0-9_.-]/g, '');
  if (!name) { res.writeHead(400); return res.end(); }
  const chunks = []; req.on('data', (c) => chunks.push(c));
  req.on('end', () => { fs.writeFileSync(path.join(dir, name + '.png'), Buffer.concat(chunks)); res.writeHead(200); res.end('ok'); });
}).listen(5190, () => console.log('frame server on 5190 ->', dir));
