// Holt die Kursverläufe der Indizes (DAX, S&P 500) für die Diagramme.
// Fällt die Quelle aus, bleibt der letzte bekannte Stand mit Zeitstempel erhalten – nie ein Absturz.

// Antwort der Chart-Schnittstelle → [[zeit (ms), kurs], …] ohne Lücken, höchstens maxPunkte.
export function verlaufLesen(antwort, maxPunkte = 260) {
  const daten = antwort?.chart?.result?.[0];
  const zeiten = daten?.timestamp || [];
  const kurse = daten?.indicators?.quote?.[0]?.close || [];
  const punkte = [];
  for (let i = 0; i < zeiten.length; i++) {
    const kurs = kurse[i];
    if (Number.isFinite(kurs) && kurs > 0 && Number.isFinite(zeiten[i])) punkte.push([zeiten[i] * 1000, Math.round(kurs * 100) / 100]);
  }
  if (punkte.length > maxPunkte) {
    const schritt = punkte.length / maxPunkte;
    const ausgedünnt = [];
    for (let i = 0; i < maxPunkte - 1; i++) ausgedünnt.push(punkte[Math.floor(i * schritt)]);
    ausgedünnt.push(punkte[punkte.length - 1]);
    return { punkte: ausgedünnt, vortag: daten?.meta?.chartPreviousClose ?? null, waehrung: daten?.meta?.currency ?? null };
  }
  return { punkte, vortag: daten?.meta?.chartPreviousClose ?? null, waehrung: daten?.meta?.currency ?? null };
}

export async function kurseHolen(einstellungen, letzte, { userAgent, holen = fetch, jetzt = new Date() }) {
  const ergebnis = { quelle: einstellungen.quelle.name, indizes: [] };
  for (const index of einstellungen.indizes) {
    const alt = letzte?.indizes?.find((i) => i.symbol === index.symbol);
    const neu = { name: index.name, land: index.land, symbol: index.symbol, verlauf: {}, stand: {}, fehler: [] };
    for (const z of einstellungen.zeitraeume) {
      try {
        const url = `${einstellungen.quelle.adresse}${encodeURIComponent(index.symbol)}?range=${z.range}&interval=${z.interval}`;
        const antwort = await holen(url, { headers: { 'User-Agent': userAgent }, signal: AbortSignal.timeout(15000) });
        if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);
        const v = verlaufLesen(await antwort.json(), einstellungen.maxPunkte);
        if (v.punkte.length < 2) throw new Error('zu wenige Kurse');
        neu.verlauf[z.schluessel] = v.punkte;
        neu.stand[z.schluessel] = jetzt.toISOString();
        if (z.schluessel === '1T') { neu.vortag = v.vortag; neu.waehrung = v.waehrung; }
      } catch (fehler) {
        // Letzten bekannten Verlauf behalten.
        neu.fehler.push(`${z.schluessel}: ${fehler.name === 'TimeoutError' ? 'Zeitüberschreitung' : fehler.message}`);
        if (alt?.verlauf?.[z.schluessel]) {
          neu.verlauf[z.schluessel] = alt.verlauf[z.schluessel];
          neu.stand[z.schluessel] = alt.stand?.[z.schluessel] ?? null;
        }
        if (z.schluessel === '1T' && alt) { neu.vortag = alt.vortag; neu.waehrung = alt.waehrung; }
      }
    }
    if (!neu.waehrung && alt) neu.waehrung = alt.waehrung;
    ergebnis.indizes.push(neu);
  }
  return ergebnis;
}
