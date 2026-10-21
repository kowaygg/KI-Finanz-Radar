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
