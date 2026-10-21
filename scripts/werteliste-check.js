// Prüft die öffentliche Werteliste: Gibt es jedes Kürzel? Passt die ISIN laut Suche zum Kürzel?
// Aufruf: npm run werteliste-check
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const { werte } = JSON.parse(await readFile(join(WURZEL, 'config', 'werteliste.json'), 'utf8'));
const KOPF = { headers: { 'User-Agent': 'Mozilla/5.0 (KI-Finanz-Radar Werteliste-Check)' } };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

const isinFormat = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
const isins = new Set();
let probleme = 0;
for (const w of werte) {
  const hinweise = [];
  if (!isinFormat.test(w.isin)) hinweise.push('ISIN-Format falsch');
  if (isins.has(w.isin)) hinweise.push('ISIN doppelt');
  isins.add(w.isin);
  try {
    const chart = await (await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(w.symbol)}?range=5d&interval=1d`, KOPF)).json();
    const meta = chart?.chart?.result?.[0]?.meta;
    if (!meta) hinweise.push('Kürzel unbekannt');
    const suche = await (await fetch(`https://query2.finance.yahoo.com/v1/finance/search?q=${w.isin}&quotesCount=10&newsCount=0`, KOPF)).json();
    const treffer = (suche?.quotes || []).map((q) => q.symbol);
    const basis = (s) => s.split('.')[0];
    if (!treffer.length) hinweise.push('ISIN bei der Suche nicht gefunden');
    else if (!treffer.includes(w.symbol) && !treffer.some((t) => basis(t) === basis(w.symbol))) hinweise.push(`Suche findet die ISIN an anderer Börse (${treffer.join(', ')}) – bitte prüfen, ob der Name passt: „${meta?.longName || meta?.shortName || '?'}“`);
  } catch (fehler) {
    hinweise.push(`Abfrage fehlgeschlagen: ${fehler.message}`);
  }
  if (hinweise.length) { probleme++; console.log(`? ${w.name} (${w.isin}, ${w.symbol}): ${hinweise.join('; ')}`); }
  await pause(300);
}
console.log(`\n${werte.length} Werte geprüft, ${probleme} mit Hinweisen.`);
