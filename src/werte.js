// Tageskurse und Monatsverlauf für die öffentliche Werteliste (Variante B).
// Abfrage gebündelt (20 Werte pro Anfrage). Fällt etwas aus, bleibt der letzte Stand je Wert erhalten.

const WAEHRUNG = { DE: 'EUR', PA: 'EUR', AS: 'EUR', MI: 'EUR', SW: 'CHF', L: 'GBp', CO: 'DKK', HK: 'HKD' };

export function waehrungAusSymbol(symbol) {
  const endung = symbol.includes('.') ? symbol.split('.').pop() : '';
  return WAEHRUNG[endung] || 'USD';
}

// Ein Eintrag der Sammelabfrage → Kurs, Vortag, Veränderung, Monatsverlauf.
export function wertLesen(eintrag) {
  const kurse = (eintrag?.close || []).filter((k) => Number.isFinite(k) && k > 0);
  if (kurse.length < 2) return null;
  const kurs = kurse[kurse.length - 1];
  const vortag = kurse[kurse.length - 2];
  return {
    kurs: Math.round(kurs * 1000) / 1000,
    vortag: Math.round(vortag * 1000) / 1000,
    pct: Math.round(((kurs - vortag) / vortag) * 10000) / 100,
    verlauf: kurse.map((k) => Math.round(k * 1000) / 1000),
  };
}

// Dateiname für die Verlaufsdatei eines Kürzels (nur sichere Zeichen).
export const verlaufDatei = (symbol) => `${symbol.replace(/[^A-Za-z0-9.-]/g, '_')}.json`;

function punkteAusSpark(eintrag, maxPunkte) {
  const zeiten = eintrag?.timestamp || [];
  const kurse = eintrag?.close || [];
  const punkte = [];
  for (let i = 0; i < zeiten.length; i++) {
    if (Number.isFinite(kurse[i]) && kurse[i] > 0) punkte.push([zeiten[i] * 1000, Math.round(kurse[i] * 1000) / 1000]);
  }
  if (punkte.length <= maxPunkte) return punkte;
  const schritt = punkte.length / maxPunkte;
  const ausgeduennt = Array.from({ length: maxPunkte - 1 }, (_, i) => punkte[Math.floor(i * schritt)]);
  ausgeduennt.push(punkte[punkte.length - 1]);
  return ausgeduennt;
}

// Kursverläufe aller Werte für den Reiter „Kurse“. Lange Zeiträume werden seltener geholt (siehe 'minuten').
// alt: { [symbol]: { verlauf, stand, vortag } }, zeitstempel: { [zeitraum]: ISO } – Ergebnis gleiche Form.
export async function verlaeufeHolen(liste, zeitraeume, alt, zeitstempel, { adresse, userAgent, holen = fetch, jetzt = new Date(), paketGroesse = 20, maxPunkte = 260 }) {
  const ergebnis = structuredClone(alt || {});
  const stempel = { ...(zeitstempel || {}) };
  const fehler = [];
  for (const z of zeitraeume) {
    const zuletzt = Date.parse(stempel[z.schluessel] || 0);
    if (z.minuten && jetzt.getTime() - zuletzt < z.minuten * 60000) continue;
    let erfolgreich = 0;
    for (let i = 0; i < liste.length; i += paketGroesse) {
      const paket = liste.slice(i, i + paketGroesse);
      try {
        const url = `${adresse}?symbols=${paket.map((w) => encodeURIComponent(w.symbol)).join(',')}&range=${z.range}&interval=${z.interval}`;
        const r = await holen(url, { headers: { 'User-Agent': userAgent }, signal: AbortSignal.timeout(20000) });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const antwort = await r.json();
        for (const w of paket) {
          const punkte = punkteAusSpark(antwort[w.symbol], maxPunkte);
          if (punkte.length < 2) continue;
          const e = (ergebnis[w.symbol] ||= { verlauf: {}, stand: {} });
          e.verlauf[z.schluessel] = punkte;
          e.stand[z.schluessel] = jetzt.toISOString();
          if (z.schluessel === '1T' && Number.isFinite(antwort[w.symbol]?.chartPreviousClose)) e.vortag = antwort[w.symbol].chartPreviousClose;
          erfolgreich++;
        }
      } catch (f) {
        fehler.push(`${z.schluessel}: ${f.name === 'TimeoutError' ? 'Zeitüberschreitung' : f.message}`);
      }
    }
    if (erfolgreich) stempel[z.schluessel] = jetzt.toISOString();
  }
  return { verlaeufe: ergebnis, zeitstempel: stempel, fehler };
}

export async function werteHolen(liste, letzte, { adresse, userAgent, holen = fetch, jetzt = new Date(), paketGroesse = 20 }) {
  const alt = new Map((letzte?.werte || []).map((w) => [w.symbol, w]));
  const ergebnis = [];
  const fehler = [];
  for (let i = 0; i < liste.length; i += paketGroesse) {
    const paket = liste.slice(i, i + paketGroesse);
    let antwort = {};
    try {
      const url = `${adresse}?symbols=${paket.map((w) => encodeURIComponent(w.symbol)).join(',')}&range=1mo&interval=1d`;
      const r = await holen(url, { headers: { 'User-Agent': userAgent }, signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      antwort = await r.json();
    } catch (f) {
      fehler.push(`Paket ${i / paketGroesse + 1}: ${f.name === 'TimeoutError' ? 'Zeitüberschreitung' : f.message}`);
    }
    for (const w of paket) {
      const neu = wertLesen(antwort[w.symbol]);
      const basis = { name: w.name, isin: w.isin, symbol: w.symbol, art: w.art, waehrung: waehrungAusSymbol(w.symbol) };
      if (neu) ergebnis.push({ ...basis, ...neu, stand: jetzt.toISOString() });
      else if (alt.has(w.symbol)) ergebnis.push({ ...alt.get(w.symbol), ...basis });
      else ergebnis.push({ ...basis, kurs: null });
    }
  }
  return { stand: jetzt.toISOString(), werte: ergebnis, fehler };
}
