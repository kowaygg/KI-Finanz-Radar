// Erzeugt die App-Symbole (PNG) ohne Zusatzpakete: Radar-Kreise mit Strahl auf dunklem Grund.
// Aufruf: npm run icons

import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ZIEL = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
const HINTERGRUND = [0x16, 0x18, 0x1d];
const AKZENT = [0xf0, 0xb4, 0x4c];
const RING = [0x5a, 0x5f, 0x6a];

const crcTabelle = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTabelle[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function block(typ, daten) {
  const laenge = Buffer.alloc(4);
  laenge.writeUInt32BE(daten.length);
  const inhalt = Buffer.concat([Buffer.from(typ, 'ascii'), daten]);
  const pruef = Buffer.alloc(4);
  pruef.writeUInt32BE(crc32(inhalt));
  return Buffer.concat([laenge, inhalt, pruef]);
}

function mischen(a, b, anteil) {
  return a.map((v, i) => Math.round(v + (b[i] - v) * anteil));
}

function symbol(groesse, randAnteil) {
  const zeilen = [];
  const mitte = groesse / 2;
  const radius = (groesse / 2) * (1 - randAnteil);
  const strahl = (-35 * Math.PI) / 180;
  for (let y = 0; y < groesse; y++) {
    const zeile = Buffer.alloc(1 + groesse * 3);
    for (let x = 0; x < groesse; x++) {
      const dx = x + 0.5 - mitte;
      const dy = y + 0.5 - mitte;
      const r = Math.hypot(dx, dy) / radius;
      let farbe = HINTERGRUND;
      const kante = 1.2 / radius;
      for (const ring of [0.35, 0.65, 0.95]) {
        const abstand = Math.abs(r - ring);
        if (abstand < 0.02 + kante) farbe = mischen(farbe, RING, Math.min(1, (0.02 + kante - abstand) / kante));
      }
      if (r < 0.95) {
        const winkel = Math.atan2(dy, dx);
        let diff = strahl - winkel;
        while (diff < 0) diff += 2 * Math.PI;
        if (diff < 0.9) farbe = mischen(farbe, AKZENT, 0.55 * (1 - diff / 0.9));
      }
      const punkt = Math.hypot(dx - radius * 0.5 * Math.cos(strahl), dy - radius * 0.5 * Math.sin(strahl)) / radius;
      if (punkt < 0.09) farbe = mischen(farbe, AKZENT, Math.min(1, (0.09 - punkt) / kante));
      if (r < 0.06) farbe = AKZENT;
      zeile.set(farbe, 1 + x * 3);
    }
    zeilen.push(zeile);
  }
  const kopf = Buffer.alloc(13);
  kopf.writeUInt32BE(groesse, 0);
  kopf.writeUInt32BE(groesse, 4);
  kopf[8] = 8; kopf[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    block('IHDR', kopf),
    block('IDAT', deflateSync(Buffer.concat(zeilen), { level: 9 })),
    block('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(ZIEL, { recursive: true });
writeFileSync(join(ZIEL, 'icon-192.png'), symbol(192, 0.08));
writeFileSync(join(ZIEL, 'icon-512.png'), symbol(512, 0.08));
writeFileSync(join(ZIEL, 'icon-maskable-512.png'), symbol(512, 0.24));
console.log('Symbole erzeugt in public/icons/');
