// Watchlist: nur Name + ISIN, nur auf diesem Gerät gespeichert. Nichts davon wird gesendet.

// ISIN-Prüfziffer (Buchstaben → Zahlen, dann Luhn-Verfahren).
export function isinGueltig(isin) {
  if (typeof isin !== 'string' || !/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) return false;
  const ziffern = isin.slice(0, 11).split('').map((z) => (/[A-Z]/.test(z) ? String(z.charCodeAt(0) - 55) : z)).join('');
  let summe = 0;
  let doppeln = true;
  for (let i = ziffern.length - 1; i >= 0; i--) {
    let n = Number(ziffern[i]);
    if (doppeln) { n *= 2; if (n > 9) n -= 9; }
    summe += n;
    doppeln = !doppeln;
  }
  return (10 - (summe % 10)) % 10 === Number(isin[11]);
}

// Liest Text (Zeilen „Name;ISIN“, „ISIN;Name“ oder nur ISIN) oder JSON ([{name, isin}]).
// Übernimmt strikt NUR Name und ISIN – alle anderen Angaben (Beträge, Stückzahlen …) werden verworfen.
export function watchlistLesen(text) {
  const ergebnis = [];
  const fehler = [];
  let eintraege = null;
  try {
    const json = JSON.parse(text);
    const liste = Array.isArray(json) ? json : json?.watchlist;
    if (Array.isArray(liste)) eintraege = liste.map((e) => [String(e?.name ?? ''), String(e?.isin ?? '')]);
  } catch { /* kein JSON → Text */ }
  if (!eintraege) {
    eintraege = String(text).split(/\r?\n/).map((z) => z.trim()).filter(Boolean).map((zeile) => {
      const teile = zeile.split(/[;,\t|]/).map((t) => t.trim());
      const isinTeil = teile.find((t) => /^[A-Za-z]{2}[A-Za-z0-9]{9}[0-9]$/.test(t)) || '';
      const name = teile.filter((t) => t && t !== isinTeil)[0] || '';
      return [name, isinTeil];
    });
  }
  const gesehen = new Set();
  for (const [nameRoh, isinRoh] of eintraege) {
    const isin = isinRoh.toUpperCase().replace(/\s/g, '');
    const name = nameRoh.replace(/[<>]/g, '').trim().slice(0, 80);
    if (!isinGueltig(isin)) { fehler.push(`${name || '(ohne Name)'}: ${isinRoh ? `ISIN „${isinRoh}“ ist ungültig` : 'keine gültige ISIN gefunden'}`); continue; }
    if (gesehen.has(isin)) continue;
    gesehen.add(isin);
    ergebnis.push({ name: name || isin, isin });
  }
  return { eintraege: ergebnis.slice(0, 50), fehler };
}

const INDEX_BEGRIFFE = ['MSCI World', 'All-World', 'ACWI', 'S&P 500', 'Nasdaq', 'DAX', 'Emerging Markets', 'Euro Stoxx', 'Gold',
  'Semiconductor', 'Halbleiter', 'Clean Energy', 'Robotics', 'Artificial Intelligence', 'Information Technology'];
const ZUSAETZE = /\b(ag|se|inc\.?|corp\.?|co\.?|plc|n\.?v\.?|kgaa|holding|group|vz\.?|class [abc]|\(adr\)|ucits|etf|acc|dist)\b/gi;

// Suchbegriffe, mit denen News einem Watchlist-Wert zugeordnet werden.
export function suchbegriffe(eintrag, wert) {
  const begriffe = new Set();
  for (const quelle of [eintrag.name, wert?.name]) {
    if (!quelle) continue;
    const kurz = quelle.replace(ZUSAETZE, ' ').replace(/\s+/g, ' ').trim();
    if (kurz.length >= 3 && !/^(ishares|vanguard|xtrackers|spdr|vaneck|amundi|invesco|core)$/i.test(kurz)) begriffe.add(kurz);
    for (const index of INDEX_BEGRIFFE) if (quelle.toLowerCase().includes(index.toLowerCase())) begriffe.add(index);
  }
  // Bei Fonds/ETFs zählt nur der Index, nicht der lange Produktname.
  if (wert && wert.art !== 'Aktie') for (const b of [...begriffe]) if (!INDEX_BEGRIFFE.includes(b)) begriffe.delete(b);
  return [...begriffe];
}

function enthaelt(text, begriff) {
  const muster = begriff.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}])${muster}(?![\\p{L}\\p{N}])`, 'iu').test(text);
}

export function meldungTrifft(meldung, begriffe) {
  if (!begriffe.length) return false;
  const a = meldung.ki?.analyse;
  const text = [meldung.titel, meldung.titelDe, a?.titel, ...(meldung.ki?.schlagwoerter || []), ...(a?.betroffen?.aktien || []), ...(a?.betroffen?.etfs || [])]
    .filter(Boolean).join(' · ');
  return begriffe.some((b) => enthaelt(text, b));
}
