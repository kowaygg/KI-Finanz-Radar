// Wächter (stündlich per GitHub Actions): Schickt eine Push-Warnung, wenn der Abruf seit mehr als 3 Stunden nicht lief.
// Liest nur den öffentlichen Status der App. Aufruf: node scripts/waechter.js

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pushSenden, abrufWarnung } from '../src/push.js';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
try { process.loadEnvFile(join(WURZEL, '.env')); } catch { /* keine .env */ }
const einstellungen = JSON.parse(await readFile(join(WURZEL, 'config', 'push.json'), 'utf8'));
const kanal = process.env[einstellungen.kanalVariable];

let letzterAbruf = null;
try {
  const antwort = await fetch(`${einstellungen.statusAdresse}?t=${Date.now()}`, { signal: AbortSignal.timeout(20000) });
  if (antwort.ok) letzterAbruf = (await antwort.json()).letzterAbruf;
} catch { /* App nicht erreichbar – zählt wie ein ausgefallener Abruf */ }

const jetzt = new Date();
// Ist die App gar nicht erreichbar, wird wie bei einem sehr alten Abruf gewarnt (einmal pro Tag zur vollen Stunde 8 Uhr UTC).
const warnung = letzterAbruf
  ? abrufWarnung(letzterAbruf, einstellungen, jetzt)
  : jetzt.getUTCHours() === 8 ? { title: '⚠ KI-Finanz-Radar: App nicht erreichbar', message: 'Der Status der App konnte nicht geladen werden. Bitte die App öffnen oder Claude Code fragen.', priority: 4, tags: ['warning'], click: einstellungen.appAdresse } : null;

console.log(`Letzter Abruf: ${letzterAbruf ?? 'unbekannt'}`);
if (!warnung) console.log('Alles in Ordnung – keine Warnung nötig.');
else console.log(await pushSenden(warnung, { server: einstellungen.server, kanal }) ? 'Warnung gesendet.' : 'Warnung nicht gesendet.');
