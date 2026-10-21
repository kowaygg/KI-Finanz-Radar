// Prüft jeden KI-Dienst der Kette: Schlüssel vorhanden? Gibt es die eingestellten Modelle noch? Antwortet er?
// Aufruf: npm run ki-check   (gibt nie Schlüssel aus)

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ketteErstellen } from '../src/ki/kette.js';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
try { process.loadEnvFile(join(WURZEL, '.env')); } catch { /* keine .env */ }
const ki = JSON.parse(await readFile(join(WURZEL, 'config', 'ki.json'), 'utf8'));

async function modellListe(dienst, schluessel) {
  const gemini = dienst.typ === 'gemini';
  const antwort = await fetch(`${dienst.adresse}/models${gemini ? '?pageSize=1000' : ''}`, {
    headers: gemini ? { 'x-goog-api-key': schluessel } : { Authorization: `Bearer ${schluessel}` },
    signal: AbortSignal.timeout(20000),
  });
  if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);
  const daten = await antwort.json();
  return gemini ? (daten.models || []).map((m) => m.name.replace(/^models\//, '')) : (daten.data || []).map((m) => m.id);
}

for (const dienst of ki.kette) {
  const schluessel = process.env[dienst.schluesselVariable];
  if (!schluessel) {
    console.log(`○ ${dienst.name}: kein Schlüssel (${dienst.schluesselVariable}) – wird übersprungen`);
    continue;
  }
  try {
    const vorhanden = new Set(await modellListe(dienst, schluessel));
    for (const modell of dienst.modelle) console.log(`  ${vorhanden.has(modell) ? '✓' : '✗'} ${dienst.name} / ${modell}${vorhanden.has(modell) ? '' : ' – nicht (mehr) angeboten'}`);
    const kette = ketteErstellen({ ...ki, kette: [dienst] });
    const test = await kette.fragen('Antworte nur mit JSON.', 'Gib {"ok":true} zurück.');
    console.log(test ? `✓ ${dienst.name}: antwortet (Modell ${test.modell})` : `✗ ${dienst.name}: keine gültige Antwort – ${kette.protokoll.map((p) => `${p.modell}: ${p.grund}`).join('; ')}`);
  } catch (fehler) {
    console.log(`✗ ${dienst.name}: ${fehler.message}`);
  }
}
