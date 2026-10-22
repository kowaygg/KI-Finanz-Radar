// Was „Lies mir vor“ zu einer Meldung sagt – gemeinsam für die Audio-Erzeugung und die Gerätestimme.

export function vorleseTitel(m) {
  return m.ki?.analyse?.titel || m.titelDe || m.titel;
}

export function vorlesePunkte(m) {
  const analyse = m.ki?.analyse?.zusammenfassung;
  if (Array.isArray(analyse) && analyse.length) return { punkte: analyse, wenigInfo: analyse.length < 3 };
  if (Array.isArray(m.ki?.kurz) && m.ki.kurz.length) return { punkte: m.ki.kurz, wenigInfo: Boolean(m.ki.wenigInfo) };
  return { punkte: [], wenigInfo: false };
}

// Satzende sichern, damit die Stimme zwischen Überschrift und Stichpunkten Pausen macht.
const satz = (text) => (/[.!?:]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`);

export function vorleseSaetze(m) {
  const { punkte, wenigInfo } = vorlesePunkte(m);
  const saetze = [satz(vorleseTitel(m)), ...(punkte.length ? punkte : ['Dazu gibt es noch keine Zusammenfassung.']).map(satz)];
  if (wenigInfo) saetze.push('Kurzmeldung, die Quelle enthält nur wenige Infos.');
  return saetze;
}

export function wichtigeMeldungen(meldungen, schwelle) {
  return meldungen.filter((m) => Number(m.ki?.relevanz) >= schwelle && !m.ki.dublette);
}
