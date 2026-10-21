// Vorfilter ohne KI: sortiert Werbung aus und markiert offensichtlich Irrelevantes,
// damit es nicht an die KI geht (spart Kontingent).

function wortMuster(woerter) {
  const teile = woerter
    .filter((w) => typeof w === 'string' && w.trim())
    .map((w) => w.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!teile.length) return null;
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${teile.join('|')})(?![\\p{L}\\p{N}])`, 'iu');
}

export function vorfilterErstellen(regeln) {
  const werbung = wortMuster(regeln.werbung || []);
  const ohneKi = wortMuster(regeln.ohneKi || []);
  // Ergebnis: 'werbung' (gar nicht anzeigen), 'ohneKi' (nur Live-Ticker) oder 'ok'.
  return function einstufen(titel, teaser = '') {
    const text = `${titel} ${teaser}`;
    if (werbung && werbung.test(text)) return 'werbung';
    if (ohneKi && ohneKi.test(titel)) return 'ohneKi';
    return 'ok';
  };
}
