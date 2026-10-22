// Prüft KI-Antworten streng, bevor irgendetwas gespeichert oder angezeigt wird.
// Ungültige Einträge werden verworfen (die Meldung wird beim nächsten Lauf erneut bewertet).

import { reinerText } from '../bereinigen.js';
import { KATEGORIEN, STIMMUNGEN, ZEITHORIZONTE, SICHERHEITEN, ARTEN } from './anweisungen.js';

// Holt das JSON-Objekt aus der Antwort, auch wenn ein Modell Text oder ```json drumherum schreibt.
export function jsonAusText(text) {
  if (typeof text !== 'string') return null;
  const start = text.indexOf('{');
  const ende = text.lastIndexOf('}');
  if (start < 0 || ende <= start) return null;
  try { return JSON.parse(text.slice(start, ende + 1)); } catch { return null; }
}

const text = (wert, max) => reinerText(typeof wert === 'string' ? wert : '', max);
const liste = (wert, maxAnzahl, maxLaenge) =>
  (Array.isArray(wert) ? wert : []).map((w) => text(w, maxLaenge)).filter(Boolean).slice(0, maxAnzahl);
const aus = (wert, erlaubt) => (erlaubt.includes(wert) ? wert : null);

export function bewertungenPruefen(antwort, erlaubteIds) {
  const ergebnis = new Map();
  for (const b of Array.isArray(antwort?.bewertungen) ? antwort.bewertungen : []) {
    if (!b || !erlaubteIds.has(b.id) || ergebnis.has(b.id)) continue;
    const relevanz = Number(b.relevanz);
    const kategorie = aus(b.kategorie, KATEGORIEN);
    const stimmung = aus(b.stimmung, STIMMUNGEN);
    if (!Number.isInteger(relevanz) || relevanz < 1 || relevanz > 10 || !kategorie || !stimmung) continue;
    const clickbait = b.clickbait === true;
    const geruecht = b.geruecht === true;
    const art = aus(b.art, ARTEN) || 'nachricht';
    const passt = b.passt !== false;
    const ohneSubstanz = clickbait || !passt || art === 'ratgeber' || art === 'unterhaltung';
    ergebnis.set(b.id, {
      // Clickbait, Ratgeber/Unterhaltung und Themen ohne Marktbezug: aus Live und „Wichtig“ raus (max. 2).
      // Gerüchte bleiben im Live-Ticker sichtbar, kommen aber nie in „Wichtig“ (max. 4).
      relevanz: ohneSubstanz ? Math.min(relevanz, 2) : geruecht ? Math.min(relevanz, 4) : relevanz,
      art,
      passt,
      kategorie,
      schlagwoerter: liste(b.schlagwoerter, 5, 40),
      stimmung,
      clickbait,
      geruecht,
      // Bis zu 5 Stichpunkte für die aufklappbare Meldung; zu wenig Stoff in der Quelle wird ehrlich markiert.
      kurz: liste(b.kurz, 5, 240),
      wenigInfo: b.wenigInfo === true || liste(b.kurz, 5, 240).length < 3,
      titelDe: text(b.titelDe, 300) || null,
      ereignis: typeof b.ereignis === 'string' ? b.ereignis.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').slice(0, 60) || null : null,
    });
  }
  return ergebnis;
}

export function uebersetzungenPruefen(antwort, erlaubteIds) {
  const ergebnis = new Map();
  for (const t of Array.isArray(antwort?.titel) ? antwort.titel : []) {
    if (!t || !erlaubteIds.has(t.id) || ergebnis.has(t.id)) continue;
    const de = text(t.de, 300);
    if (de) ergebnis.set(t.id, de);
  }
  return ergebnis;
}

export function analysenPruefen(antwort, erlaubteIds) {
  const ergebnis = new Map();
  for (const a of Array.isArray(antwort?.analysen) ? antwort.analysen : []) {
    if (!a || !erlaubteIds.has(a.id) || ergebnis.has(a.id)) continue;
    const zusammenfassung = liste(a.zusammenfassung, 5, 300);
    const e = a.einschaetzung || {};
    const einschaetzung = {
      text: text(e.text, 900),
      zeithorizont: aus(e.zeithorizont, ZEITHORIZONTE),
      sicherheit: aus(e.sicherheit, SICHERHEITEN),
    };
    if (zusammenfassung.length < 2 || !einschaetzung.text || !einschaetzung.zeithorizont || !einschaetzung.sicherheit) continue;
    const betroffen = a.betroffen || {};
    ergebnis.set(a.id, {
      titel: text(a.titel, 300),
      zusammenfassung,
      betroffen: {
        aktien: liste(betroffen.aktien, 8, 60),
        etfs: liste(betroffen.etfs, 6, 60),
        branchen: liste(betroffen.branchen, 6, 60),
      },
      einschaetzung,
      vergleich: typeof a.vergleich === 'string' ? text(a.vergleich, 500) || null : null,
    });
  }
  return ergebnis;
}
