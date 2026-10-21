// Ein Abruf-Durchlauf: alle aktiven Quellen holen, zusammenführen, Dateien für die App schreiben.
// Aufruf: npm run abruf

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { feedLesen } from './feed-parser.js';
import { vorfilterErstellen } from './vorfilter.js';
import { eintraegeAufnehmen, alteLoeschen, oeffentlicheMeldungen } from './sammeln.js';
import { sichererLink } from './bereinigen.js';
import { ketteErstellen } from './ki/kette.js';
import { kiDurchlauf } from './ki/analyse.js';
import { kurseHolen } from './kurse.js';
import { werteHolen } from './werte.js';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');

// Lokal: Schlüssel aus .env (steht in .gitignore). Online kommen sie aus GitHub Secrets.
try { process.loadEnvFile(join(WURZEL, '.env')); } catch { /* keine .env – ok */ }
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

// Wetter für die Kopfzeile (Open-Meteo, ohne Schlüssel). Fehler → kein Wetter, die App blendet es aus.
async function wetterHolen(wetter, einstellungen) {
  if (!wetter?.adresse) return null;
  try {
    const url = new URL(wetter.adresse);
    url.search = new URLSearchParams({
      latitude: wetter.breite, longitude: wetter.laenge, timezone: 'Europe/Berlin', forecast_days: '1',
      current: 'temperature_2m,weather_code,is_day', daily: 'temperature_2m_max,temperature_2m_min',
    });
    const antwort = await fetch(url, { headers: { 'User-Agent': einstellungen.userAgent }, signal: AbortSignal.timeout(10000) });
    if (!antwort.ok) return null;
    const d = await antwort.json();
    const zahl = (w) => (Number.isFinite(w) ? Math.round(w) : null);
    const ergebnis = {
      ort: wetter.ort,
      temperatur: zahl(d.current?.temperature_2m),
      code: Number.isInteger(d.current?.weather_code) ? d.current.weather_code : null,
      tag: d.current?.is_day === 1,
      hoch: zahl(d.daily?.temperature_2m_max?.[0]),
      tief: zahl(d.daily?.temperature_2m_min?.[0]),
    };
    return ergebnis.temperatur === null ? null : ergebnis;
  } catch {
    return null;
  }
}

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

  const kiEinstellungen = await jsonLesen(join(WURZEL, 'config', 'ki.json'), null);
  const kette = ketteErstellen(kiEinstellungen);
  let ki = { verfuegbar: kette.verfuegbar, hinweis: 'Kein KI-Schlüssel hinterlegt' };
  if (kette.verfuegbar.length) {
    try {
      const ergebnis = await kiDurchlauf(zustand.meldungen, kette, { kiEinstellungen, relevanzSchwelle: einstellungen.relevanzSchwelle, jetzt });
      ki = { verfuegbar: kette.verfuegbar, ...ergebnis, protokoll: kette.protokoll };
    } catch (fehler) {
      // KI-Probleme dürfen den Abruf nie stoppen – Meldungen erscheinen dann ohne Analyse.
      ki = { verfuegbar: kette.verfuegbar, fehler: fehler.message, protokoll: kette.protokoll };
    }
  }

  const wetter = await wetterHolen(einstellungen.wetter, einstellungen);

  // Kurse: letzter Stand liegt (wie der Zustand) im Cache-Ordner data/ und dient als Rückfall.
  const kursEinstellungen = await jsonLesen(join(WURZEL, 'config', 'kurse.json'), null);
  if (kursEinstellungen) {
    const letzteKurse = await jsonLesen(join(WURZEL, 'data', 'kurse.json'), null);
    const kurse = await kurseHolen(kursEinstellungen, letzteKurse, { userAgent: einstellungen.userAgent, jetzt });
    await jsonSchreiben(join(WURZEL, 'data', 'kurse.json'), kurse);
    await jsonSchreiben(join(AUSGABE, 'kurse.json'), { ...kurse, zeitraeume: kursEinstellungen.zeitraeume.map(({ schluessel, name }) => ({ schluessel, name })) });

    // Öffentliche Werteliste (Variante B): die App sucht sich die Watchlist-Werte nur auf dem Gerät heraus.
    const { werte: liste } = await jsonLesen(join(WURZEL, 'config', 'werteliste.json'), { werte: [] });
    if (liste.length) {
      const letzteWerte = await jsonLesen(join(WURZEL, 'data', 'werte.json'), null);
      const werte = await werteHolen(liste, letzteWerte, {
        adresse: kursEinstellungen.quelle.adresse.replace('/chart/', '/spark'), userAgent: einstellungen.userAgent, jetzt,
      });
      await jsonSchreiben(join(WURZEL, 'data', 'werte.json'), werte);
      await jsonSchreiben(join(AUSGABE, 'werte.json'), werte);
    }
  }
  const { boersen } = await jsonLesen(join(WURZEL, 'config', 'boersen.json'), { boersen: [] });
  const { termine } = await jsonLesen(join(WURZEL, 'config', 'termine.json'), { termine: [] });
  await jsonSchreiben(join(AUSGABE, 'kalender.json'), {
    boersen,
    termine: termine.filter((t) => Date.parse(t.zeit) > jetzt.getTime() - 3600 * 1000).sort((a, b) => Date.parse(a.zeit) - Date.parse(b.zeit)),
  });

  await jsonSchreiben(ZUSTAND, zustand);
  await jsonSchreiben(join(AUSGABE, 'meldungen.json'), { erstellt: jetzt.toISOString(), meldungen: oeffentlicheMeldungen(zustand.meldungen) });
  await jsonSchreiben(join(AUSGABE, 'status.json'), {
    version,
    letzterAbruf: jetzt.toISOString(),
    relevanzSchwelle: einstellungen.relevanzSchwelle,
    quellen: bericht,
    ki,
    wetter,
  });
  return { bericht, ki };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { bericht, ki } = await abrufStarten();
  const ok = bericht.filter((b) => b.ok).length;
  for (const b of bericht) console.log(`${b.ok ? '✓' : '✗'} ${b.name.padEnd(24)} ${b.ok ? `${b.neu} neu${b.hinweis ? ` (${b.hinweis})` : ''}` : b.fehler}`);
  console.log(`\n${ok} von ${bericht.length} Quellen ok.`);
  if (!ki.verfuegbar.length) console.log('KI: kein Schlüssel hinterlegt – Meldungen ohne Analyse.');
  else {
    console.log(`KI: ${ki.bewertet ?? 0} bewertet, ${ki.analysiert ?? 0} analysiert, ${ki.anfragen ?? 0} Anfragen, ${ki.offen ?? '?'} noch offen${ki.abgebrochen ? ' (alle Dienste am Limit/gestört – wird nachgeholt)' : ''}`);
    for (const p of ki.protokoll || []) console.log(`   ${p.ok ? '✓' : '✗'} ${p.dienst} / ${p.modell}${p.grund ? ` – ${p.grund}` : ''}`);
  }
}
