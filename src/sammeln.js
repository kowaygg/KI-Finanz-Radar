// Führt neue Feed-Einträge mit den vorhandenen Meldungen zusammen:
// Dubletten zusammenfassen, Vorfilter anwenden, alte Meldungen löschen.

import { duplikatFinden, meldungsId } from './dubletten.js';

export function eintraegeAufnehmen(meldungen, eintraege, quelle, { einstellungen, einstufen, jetzt }) {
  const jetztMs = jetzt.getTime();
  const maxAlterMs = einstellungen.maxAlterStunden * 3600 * 1000;
  let neu = 0;

  const neueste = [...eintraege]
    .sort((a, b) => (Date.parse(b.datum) || 0) - (Date.parse(a.datum) || 0))
    .slice(0, einstellungen.maxMeldungenProQuelle);

  for (const e of neueste) {
    const datum = e.datum && Date.parse(e.datum) <= jetztMs ? e.datum : jetzt.toISOString();
    // Nur aktuelle Meldungen: ältere Einträge aus langen Feed-Archiven werden übersprungen.
    if (jetztMs - Date.parse(datum) > maxAlterMs) continue;

    const vorhanden = duplikatFinden(meldungen, { ...e, datum }, {
      schwelle: einstellungen.dublettenAehnlichkeit,
      zeitfensterStunden: einstellungen.dublettenZeitfensterStunden,
    });
    if (vorhanden) {
      if (!vorhanden.quellen.some((q) => q.link === e.link || q.name === quelle.name)) {
        vorhanden.quellen.push({ name: quelle.name, link: e.link });
      }
      continue;
    }

    const vorfilter = einstufen(e.titel, e.teaser);
    meldungen.push({
      id: meldungsId(e.link),
      titel: e.titel,
      link: e.link,
      quelle: quelle.name,
      kategorie: quelle.kategorie,
      sprache: quelle.sprache,
      datum,
      gefunden: jetzt.toISOString(),
      quellen: [{ name: quelle.name, link: e.link }],
      vorfilter,
      // Kurzer Teaser nur als Eingabe für die KI; wird nach der Analyse gelöscht und nie angezeigt.
      teaser: vorfilter === 'ok' ? e.teaser : '',
      ki: null,
    });
    neu++;
  }
  return neu;
}

export function alteLoeschen(meldungen, aufbewahrungTage, jetzt) {
  const grenze = jetzt.getTime() - aufbewahrungTage * 24 * 3600 * 1000;
  return meldungen.filter((m) => Date.parse(m.datum) >= grenze);
}

// Nur diese Felder werden veröffentlicht – kein Teaser, keine Werbung.
export function oeffentlicheMeldungen(meldungen) {
  return meldungen
    .filter((m) => m.vorfilter !== 'werbung')
    .sort((a, b) => Date.parse(b.datum) - Date.parse(a.datum))
    .map(({ id, titel, titelDe, link, quelle, kategorie, sprache, datum, gefunden, quellen, ki }) => ({
      id, titel, titelDe: titelDe || null, link, quelle, kategorie, sprache, datum, gefunden, quellen, ki,
    }));
}
