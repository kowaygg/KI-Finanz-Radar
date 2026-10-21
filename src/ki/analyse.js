// KI-Durchlauf: nur NEUE Meldungen, gebündelt. Erst Kurzbewertung (Relevanz usw.),
// dann ausführliche Analyse nur ab der Relevanzschwelle. Was nicht klappt, wird später nachgeholt.

import { BEWERTEN, ANALYSIEREN, datenNachricht } from './anweisungen.js';
import { bewertungenPruefen, analysenPruefen } from './pruefen.js';

function paeckchen(liste, groesse) {
  const ergebnis = [];
  for (let i = 0; i < liste.length; i += groesse) ergebnis.push(liste.slice(i, i + groesse));
  return ergebnis;
}

const neuesteZuerst = (a, b) => Date.parse(b.datum) - Date.parse(a.datum);

export async function kiDurchlauf(meldungen, kette, { kiEinstellungen, relevanzSchwelle, jetzt }) {
  const bericht = { bewertet: 0, analysiert: 0, anfragen: 0, abgebrochen: false };

  const offenBewertung = meldungen.filter((m) => m.vorfilter === 'ok' && !m.ki).sort(neuesteZuerst);
  for (const gruppe of paeckchen(offenBewertung, kiEinstellungen.meldungenProBewertung).slice(0, kiEinstellungen.maxBewertungsAnfragenProLauf)) {
    bericht.anfragen++;
    const antwort = await kette.fragen(BEWERTEN, datenNachricht(gruppe));
    if (!antwort) { bericht.abgebrochen = true; break; }
    const geprueft = bewertungenPruefen(antwort.json, new Set(gruppe.map((m) => m.id)));
    for (const m of gruppe) {
      const b = geprueft.get(m.id);
      if (!b) continue;
      m.ki = { ...b, dienst: antwort.dienst, modell: antwort.modell, bewertetAm: jetzt.toISOString(), analyse: null };
      m.kategorie = b.kategorie;
      if (b.relevanz < relevanzSchwelle) m.teaser = '';
      bericht.bewertet++;
    }
  }

  if (!bericht.abgebrochen) {
    const offenAnalyse = meldungen.filter((m) => m.ki && m.ki.relevanz >= relevanzSchwelle && !m.ki.analyse).sort(neuesteZuerst);
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

  bericht.offen = meldungen.filter((m) => (m.vorfilter === 'ok' && !m.ki) || (m.ki && m.ki.relevanz >= relevanzSchwelle && !m.ki.analyse)).length;
  return bericht;
}
