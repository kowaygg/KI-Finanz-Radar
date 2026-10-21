// KI-Durchlauf: nur NEUE Meldungen, gebündelt. Erst Kurzbewertung (Relevanz usw.),
// dann ausführliche Analyse nur ab der Relevanzschwelle. Was nicht klappt, wird später nachgeholt.

import { BEWERTEN, ANALYSIEREN, UEBERSETZEN, datenNachricht } from './anweisungen.js';
import { bewertungenPruefen, analysenPruefen, uebersetzungenPruefen } from './pruefen.js';

function paeckchen(liste, groesse) {
  const ergebnis = [];
  for (let i = 0; i < liste.length; i += groesse) ergebnis.push(liste.slice(i, i + groesse));
  return ergebnis;
}

const neuesteZuerst = (a, b) => Date.parse(b.datum) - Date.parse(a.datum);
const EREIGNIS_FENSTER_MS = 48 * 3600 * 1000;

function wichtigeEreignisse(meldungen, relevanzSchwelle, jetzt) {
  const kuerzel = meldungen
    .filter((m) => m.ki?.ereignis && m.ki.relevanz >= relevanzSchwelle && jetzt - Date.parse(m.datum) < EREIGNIS_FENSTER_MS)
    .sort(neuesteZuerst)
    .map((m) => m.ki.ereignis);
  return [...new Set(kuerzel)].slice(0, 40);
}

// Gleiches Ereignis aus mehreren Quellen: nur eine Meldung bleibt in „Wichtig“, die anderen werden ihr als Quellen angehängt.
function ereignisseZusammenfassen(meldungen, relevanzSchwelle) {
  const haupt = new Map();
  const reihenfolge = [...meldungen]
    .filter((m) => m.ki?.ereignis && m.ki.relevanz >= relevanzSchwelle && !m.ki.dublette)
    .sort((a, b) => Number(Boolean(b.ki.analyse)) - Number(Boolean(a.ki.analyse)) || Date.parse(a.datum) - Date.parse(b.datum));
  for (const m of reihenfolge) {
    const vorhanden = haupt.get(m.ki.ereignis);
    if (!vorhanden || Math.abs(Date.parse(vorhanden.datum) - Date.parse(m.datum)) > EREIGNIS_FENSTER_MS) {
      haupt.set(m.ki.ereignis, m);
      continue;
    }
    m.ki.dublette = vorhanden.id;
    m.teaser = '';
    for (const q of m.quellen) if (!vorhanden.quellen.some((v) => v.link === q.link)) vorhanden.quellen.push(q);
    vorhanden.ki.relevanz = Math.max(vorhanden.ki.relevanz, m.ki.relevanz);
  }
}

export async function kiDurchlauf(meldungen, kette, { kiEinstellungen, relevanzSchwelle, jetzt }) {
  const bericht = { bewertet: 0, analysiert: 0, anfragen: 0, abgebrochen: false };

  const offenBewertung = meldungen.filter((m) => m.vorfilter === 'ok' && !m.ki).sort(neuesteZuerst);
  for (const gruppe of paeckchen(offenBewertung, kiEinstellungen.meldungenProBewertung).slice(0, kiEinstellungen.maxBewertungsAnfragenProLauf)) {
    bericht.anfragen++;
    const antwort = await kette.fragen(BEWERTEN, datenNachricht(gruppe, wichtigeEreignisse(meldungen, relevanzSchwelle, jetzt.getTime())));
    if (!antwort) { bericht.abgebrochen = true; break; }
    const geprueft = bewertungenPruefen(antwort.json, new Set(gruppe.map((m) => m.id)));
    for (const m of gruppe) {
      const b = geprueft.get(m.id);
      if (!b) continue;
      const { titelDe, ...bewertung } = b;
      m.ki = { ...bewertung, dienst: antwort.dienst, modell: antwort.modell, bewertetAm: jetzt.toISOString(), analyse: null };
      m.kategorie = b.kategorie;
      if (m.sprache === 'en' && titelDe) m.titelDe = titelDe;
      if (b.relevanz < relevanzSchwelle) m.teaser = '';
      bericht.bewertet++;
    }
    ereignisseZusammenfassen(meldungen, relevanzSchwelle);
  }

  if (!bericht.abgebrochen) {
    const offenAnalyse = meldungen.filter((m) => m.ki && m.ki.relevanz >= relevanzSchwelle && !m.ki.analyse && !m.ki.dublette).sort(neuesteZuerst);
    for (const gruppe of paeckchen(offenAnalyse, kiEinstellungen.meldungenProAnalyse).slice(0, kiEinstellungen.maxAnalyseAnfragenProLauf)) {
      bericht.anfragen++;
      const antwort = await kette.fragen(ANALYSIEREN, datenNachricht(gruppe));
      if (!antwort) { bericht.abgebrochen = true; break; }
      const geprueft = analysenPruefen(antwort.json, new Set(gruppe.map((m) => m.id)));
      for (const m of gruppe) {
        const a = geprueft.get(m.id);
        if (!a) continue;
        m.ki.analyse = { ...a, dienst: antwort.dienst, modell: antwort.modell, analysiertAm: jetzt.toISOString() };
        m.teaser = '';
        bericht.analysiert++;
      }
    }
  }

  // Englische Überschriften ohne Übersetzung (ältere oder nicht an die KI gegangene Meldungen): eine Anfrage pro Lauf.
  if (!bericht.abgebrochen) {
    const offenUebersetzung = meldungen
      .filter((m) => m.sprache === 'en' && !m.titelDe && m.vorfilter !== 'werbung' && (m.ki || m.vorfilter === 'ohneKi'))
      .sort(neuesteZuerst)
      .slice(0, kiEinstellungen.titelProUebersetzung ?? 50);
    if (offenUebersetzung.length) {
      bericht.anfragen++;
      const antwort = await kette.fragen(UEBERSETZEN, datenNachricht(offenUebersetzung.map((m) => ({ ...m, teaser: '' }))));
      if (antwort) {
        const geprueft = uebersetzungenPruefen(antwort.json, new Set(offenUebersetzung.map((m) => m.id)));
        for (const m of offenUebersetzung) if (geprueft.has(m.id)) m.titelDe = geprueft.get(m.id);
        bericht.uebersetzt = geprueft.size;
      }
    }
  }

  bericht.offen = meldungen.filter((m) => (m.vorfilter === 'ok' && !m.ki) || (m.ki && m.ki.relevanz >= relevanzSchwelle && !m.ki.analyse && !m.ki.dublette)).length;
  return bericht;
}
