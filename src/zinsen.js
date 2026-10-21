// Leitzinsen automatisch aus offiziellen, kostenlosen Schnittstellen (EZB, New York Fed).
// Fällt eine Quelle aus, bleibt der letzte bekannte Wert mit Datum stehen.

function ezbWertLesen(antwort) {
  const reihe = Object.values(antwort?.dataSets?.[0]?.series || {})[0];
  const wert = reihe ? Object.values(reihe.observations || {}).at(-1)?.[0] : null;
  const datum = antwort?.structure?.dimensions?.observation?.[0]?.values?.at(-1)?.id || null;
  return Number.isFinite(wert) ? { wert, datum } : null;
}

export async function leitzinsenHolen(einstellungen, letzte, { userAgent, holen = fetch }) {
  const kopf = { headers: { 'User-Agent': userAgent, Accept: 'application/json' }, signal: AbortSignal.timeout(15000) };
  const ergebnis = { ezb: { ...(letzte?.ezb || {}) }, fed: { ...(letzte?.fed || {}) }, fehler: [] };
  for (const [schluessel, reihe] of [['einlagen', 'DFR'], ['hauptrefi', 'MRR_FR'], ['spitzen', 'MLFR']]) {
    try {
      const r = await holen(einstellungen.ezbAdresse.replace('{reihe}', reihe), kopf);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const w = ezbWertLesen(await r.json());
      if (!w) throw new Error('kein Wert');
      ergebnis.ezb[schluessel] = w.wert;
      ergebnis.ezb.stand = w.datum;
    } catch (f) {
      ergebnis.fehler.push(`EZB ${reihe}: ${f.message}`);
    }
  }
  try {
    const r = await holen(einstellungen.fedAdresse, kopf);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const e = (await r.json())?.refRates?.[0];
    if (!e || !Number.isFinite(e.targetRateFrom) || !Number.isFinite(e.targetRateTo)) throw new Error('kein Wert');
    ergebnis.fed = { von: e.targetRateFrom, bis: e.targetRateTo, effektiv: e.percentRate, stand: e.effectiveDate };
  } catch (f) {
    ergebnis.fehler.push(`Fed: ${f.message}`);
  }
  return ergebnis;
}
