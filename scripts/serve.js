// Kleiner Test-Server nur für diesen PC (http://localhost:8080). Aufruf: npm start
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, normalize, extname, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORDNER = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const PORT = Number(process.env.PORT) || 8080;
const TYPEN = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8',
};

createServer(async (anfrage, antwort) => {
  const pfad = decodeURIComponent(new URL(anfrage.url, 'http://localhost').pathname);
  const datei = normalize(join(ORDNER, pfad.endsWith('/') ? `${pfad}index.html` : pfad));
  if (!datei.startsWith(ORDNER + sep) && datei !== ORDNER) {
    antwort.writeHead(403).end();
    return;
  }
  try {
    const inhalt = await readFile(datei);
    antwort.writeHead(200, { 'Content-Type': TYPEN[extname(datei)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    antwort.end(inhalt);
  } catch {
    antwort.writeHead(404).end('Nicht gefunden');
  }
}).listen(PORT, '127.0.0.1', () => console.log(`KI-Finanz-Radar läuft auf http://localhost:${PORT}`));
