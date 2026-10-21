// Erkennt doppelte Meldungen: gleicher Link oder sehr ähnliche Überschrift
// im selben Zeitfenster. Doppelte werden zu einer Meldung mit allen Quellen zusammengefasst.

import { createHash } from 'node:crypto';

const FUELLWOERTER = new Set([
  'der', 'die', 'das', 'und', 'oder', 'mit', 'für', 'von', 'auf', 'aus', 'bei', 'nach', 'über', 'unter', 'vor',
  'ein', 'eine', 'einen', 'dem', 'den', 'des', 'ist', 'sind', 'wird', 'werden', 'hat', 'haben', 'auch', 'nicht', 'wie',
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'are', 'was', 'its', 'has', 'have', 'will', 'into', 'over', 'after', 'new',
]);

export function linkSchluessel(link) {
  try {
    const url = new URL(link);
    for (const p of [...url.searchParams.keys()]) {
      if (/^(utm_|at_|wt_|ref$|cmpid$|xtor$|ocid$|__twitter)/i.test(p)) url.searchParams.delete(p);
    }
    url.hash = '';
    return `${url.host.replace(/^www\./, '')}${url.pathname.replace(/\/$/, '')}${url.search}`.toLowerCase();
  } catch {
    return String(link).toLowerCase();
  }
}

export function meldungsId(link) {
  return createHash('sha1').update(linkSchluessel(link)).digest('hex').slice(0, 16);
}

export function titelWoerter(titel) {
  return new Set(
    titel
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 3 && !FUELLWOERTER.has(w)),
  );
}

export function aehnlichkeit(a, b) {
  if (!a.size || !b.size) return 0;
  let gemeinsam = 0;
  for (const w of a) if (b.has(w)) gemeinsam++;
  return gemeinsam / (a.size + b.size - gemeinsam);
}

// Sucht in den vorhandenen Meldungen ein Duplikat zur neuen Meldung.
export function duplikatFinden(vorhanden, neu, { schwelle, zeitfensterStunden }) {
  const id = meldungsId(neu.link);
  const woerter = titelWoerter(neu.titel);
  const zeitNeu = Date.parse(neu.datum);
  const fensterMs = zeitfensterStunden * 3600 * 1000;
  for (const m of vorhanden) {
    if (m.id === id || m.quellen.some((q) => meldungsId(q.link) === id)) return m;
    if (Math.abs(Date.parse(m.datum) - zeitNeu) > fensterMs) continue;
    if (aehnlichkeit(titelWoerter(m.titel), woerter) >= schwelle) return m;
  }
  return null;
}
