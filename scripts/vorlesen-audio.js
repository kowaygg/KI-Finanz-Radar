// Erzeugt für jede Meldung im Reiter „Wichtig“ eine Ansage mit der freien Stimme „Thorsten“ (Piper).
// Läuft im Abruf-Ablauf nach `npm run abruf`. Fertige Ansagen liegen im Cache (data/audio) und werden nie doppelt erzeugt.
// Ohne Piper (z. B. lokal) passiert nichts – die App liest dann mit der Gerätestimme vor.
// Aufruf: PIPER_BIN=… PIPER_MODELL=… node scripts/vorlesen-audio.js

import { readFile, writeFile, mkdir, readdir, stat, unlink, copyFile, access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { vorleseSaetze, wichtigeMeldungen } from '../public/vorlesetext.js';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(WURZEL, 'data', 'audio');
const AUSGABE = join(WURZEL, 'public', 'data', 'audio');
const stimme = JSON.parse(await readFile(join(WURZEL, 'config', 'stimme.json'), 'utf8'));
const { PIPER_BIN, PIPER_MODELL } = process.env;

// Jeder Aufruf hat eine Zeitgrenze – ein hängendes Programm darf den Abruf nie aufhalten.
function ausfuehren(programm, argumente, eingabe, zeitgrenzeMs = 60000) {
  return new Promise((fertig, fehler) => {
    const p = spawn(programm, argumente, { stdio: ['pipe', 'ignore', 'pipe'], timeout: zeitgrenzeMs, killSignal: 'SIGKILL' });
    let meldung = '';
    p.stderr.on('data', (d) => { meldung += d; });
    p.on('error', fehler);
    p.on('close', (code) => (code === 0 ? fertig() : fehler(new Error(`${programm} beendet mit ${code}: ${meldung.slice(-300)}`))));
    p.stdin.end(eingabe ?? '');
  });
}

const vorhanden = (pfad) => access(pfad).then(() => true, () => false);

async function ffmpegDa() {
  try { await ausfuehren('ffmpeg', ['-version']); return true; } catch { return false; }
}

// Dunkler machen ohne Qualitätsverlust: Piper spricht etwas schneller, die Wiedergabe läuft langsamer –
// dadurch sinkt die Tonhöhe, das Tempo bleibt gleich.
async function ansageErzeugen(text, ziel, mitFfmpeg) {
  const wav = join(tmpdir(), `ansage-${process.pid}.wav`);
  await ausfuehren(PIPER_BIN, ['--model', PIPER_MODELL, '--length_scale', String(stimme.tiefe * stimme.tempo), '--sentence_silence', '0.35', '--output_file', wav], text);
  const daten = await readFile(wav);
  const rate = Math.round(daten.readUInt32LE(24) * stimme.tiefe);
  daten.writeUInt32LE(rate, 24);
  daten.writeUInt32LE(rate * daten.readUInt16LE(32), 28);
  await writeFile(wav, daten);
  if (mitFfmpeg) await ausfuehren('ffmpeg', ['-loglevel', 'error', '-y', '-i', wav, '-ac', '1', '-ar', '22050', '-b:a', stimme.bitrate, ziel]);
  else await copyFile(wav, ziel);
  await unlink(wav);
}

if (!PIPER_BIN || !PIPER_MODELL || !(await vorhanden(PIPER_BIN))) {
  console.log('Vorlese-Stimme: Piper nicht eingerichtet – übersprungen (App nutzt die Gerätestimme).');
  process.exit(0);
}

const { meldungen = [] } = JSON.parse(await readFile(join(WURZEL, 'public', 'data', 'meldungen.json'), 'utf8'));
const { relevanzSchwelle = 7 } = JSON.parse(await readFile(join(WURZEL, 'public', 'data', 'status.json'), 'utf8'));
const mitFfmpeg = await ffmpegDa();
console.log(`Vorlese-Stimme: ${mitFfmpeg ? 'ffmpeg vorhanden (MP3)' : 'ohne ffmpeg (WAV)'}`);
const endung = mitFfmpeg ? 'mp3' : 'wav';
await mkdir(CACHE, { recursive: true });
await mkdir(AUSGABE, { recursive: true });

const dateien = {};
let neu = 0;
let fehler = 0;
for (const m of wichtigeMeldungen(meldungen, relevanzSchwelle)) {
  const text = vorleseSaetze(m).join(' ');
  const name = `${createHash('sha256').update(`${stimme.version}|${stimme.tiefe}|${stimme.tempo}|${text}`).digest('hex').slice(0, 20)}.${endung}`;
  const imCache = join(CACHE, name);
  if (!(await vorhanden(imCache))) {
    if (neu >= stimme.maxNeuProLauf) continue; // Rest beim nächsten Abruf
    try {
      const start = Date.now();
      await ansageErzeugen(text, imCache, mitFfmpeg);
      neu++;
      console.log(`  Ansage ${neu} erzeugt (${m.id}, ${((Date.now() - start) / 1000).toFixed(1)} s)`);
    } catch (e) {
      fehler++;
      console.log(`Vorlese-Stimme: Fehler bei ${m.id}: ${e.message}`);
      continue;
    }
  }
  await copyFile(imCache, join(AUSGABE, name));
  dateien[m.id] = `data/audio/${name}`;
}

// Alte Ansagen aus dem Cache löschen (nicht mehr gebraucht und älter als ein paar Tage).
const grenze = Date.now() - stimme.aufbewahrungTage * 24 * 3600 * 1000;
const gebraucht = new Set(Object.values(dateien).map((p) => p.split('/').pop()));
for (const datei of await readdir(CACHE)) {
  const pfad = join(CACHE, datei);
  if (!gebraucht.has(datei) && (await stat(pfad)).mtimeMs < grenze) await unlink(pfad);
}

await writeFile(join(WURZEL, 'public', 'data', 'audio.json'), `${JSON.stringify({ stimme: stimme.name, dateien }, null, 1)}\n`);
console.log(`Vorlese-Stimme ${stimme.name}: ${Object.keys(dateien).length} Ansagen bereit, ${neu} neu erzeugt${fehler ? `, ${fehler} Fehler` : ''} (${endung}).`);
