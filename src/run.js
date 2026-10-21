// Ein Abruf-Durchlauf: alle aktiven Quellen holen, zusammenführen, Dateien für die App schreiben.
// Aufruf: npm run abruf

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { feedLesen } from './feed-parser.js';
import { vorfilterErstellen } from './vorfilter.js';
import { eintraegeAufnehmen, alteLoeschen, oeffentlicheMeldungen } from './sammeln.js';
import { sichererLink } from './bereinigen.js';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const ZUSTAND = join(WURZEL, 'data', 'zustand.json');
const AUSGABE = join(WURZEL, 'public', 'data');

async function jsonLesen(pfad, ersatz) {
  try { return JSON.parse(await readFile(pfad, 'utf8')); } catch { return ersatz; }
}

async function jsonSchreiben(pfad, inhalt) {
  await mkdir(dirname(pfad), { recursive: true });
  await writeFile(pfad, JSON.stringify(inhalt, null, 1) + '\n', 'utf8');
}

async function quelleHolen(quelle, einstellungen, cache) {
  const kopf = { 'User-Agent': einstellungen.userAgent, Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8' };
  if (cache?.etag) kopf['If-None-Match'] = cache.etag;
  if (cache?.lastModified) kopf['If-Modified-Since'] = cache.lastModified;
  const antwort = await fetch(quelle.url, { headers: kopf, signal: AbortSignal.timeout(einstellungen.abrufTimeoutSekunden * 1000) });
  if (antwort.status === 304) return { unveraendert: true };
  if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);
  const text = await antwort.text();
  return {
    eintraege: feedLesen(text),
    cache: { etag: antwort.headers.get('etag'), lastModified: antwort.headers.get('last-modified') },
  };
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

export async function abrufStarten() {
  const jetzt = new Date();
  const einstellungen = await jsonLesen(join(WURZEL, 'config', 'einstellungen.json'), null);
  const { quellen } = await jsonLesen(join(WURZEL, 'quellen.json'), { quellen: [] });
  const einstufen = vorfilterErstellen(await jsonLesen(join(WURZEL, 'config', 'vorfilter.json'), {}));
  const zustand = await jsonLesen(ZUSTAND, { meldungen: [], cache: {} });
  const version = (await jsonLesen(join(WURZEL, 'package.json'), {})).version;

  const bericht = [];
  for (const quelle of quellen.filter((q) => q.aktiv !== false)) {
    if (!sichererLink(quelle.url)) {
      bericht.push({ name: quelle.name, ok: false, fehler: 'Adresse ist kein https-Link' });
      continue;
    }
    try {
      const ergebnis = await quelleHolen(quelle, einstellungen, zustand.cache[quelle.url]);
      if (ergebnis.unveraendert) {
        bericht.push({ name: quelle.name, ok: true, neu: 0, hinweis: 'unverändert' });
      } else {
        zustand.cache[quelle.url] = ergebnis.cache;
        const neu = eintraegeAufnehmen(zustand.meldungen, ergebnis.eintraege, quelle, { einstellungen, einstufen, jetzt });
        bericht.push({ name: quelle.name, ok: ergebnis.eintraege.length > 0, neu, fehler: ergebnis.eintraege.length ? undefined : 'keine Meldungen erkannt' });
      }
    } catch (fehler) {
      // Fehler einer Quelle stoppt nie den ganzen Abruf.
      bericht.push({ name: quelle.name, ok: false, fehler: fehler.name === 'TimeoutError' ? 'Zeitüberschreitung' : fehler.message });
    }
    await pause(einstellungen.pauseZwischenQuellenMs);
  }

  zustand.meldungen = alteLoeschen(zustand.meldungen, einstellungen.aufbewahrungTage, jetzt);
  await jsonSchreiben(ZUSTAND, zustand);
  await jsonSchreiben(join(AUSGABE, 'meldungen.json'), { erstellt: jetzt.toISOString(), meldungen: oeffentlicheMeldungen(zustand.meldungen) });
  await jsonSchreiben(join(AUSGABE, 'status.json'), {
    version,
    letzterAbruf: jetzt.toISOString(),
    relevanzSchwelle: einstellungen.relevanzSchwelle,
    quellen: bericht,
  });
  return bericht;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const bericht = await abrufStarten();
  const ok = bericht.filter((b) => b.ok).length;
  for (const b of bericht) console.log(`${b.ok ? '✓' : '✗'} ${b.name.padEnd(24)} ${b.ok ? `${b.neu} neu${b.hinweis ? ` (${b.hinweis})` : ''}` : b.fehler}`);
  console.log(`\n${ok} von ${bericht.length} Quellen ok.`);
}
