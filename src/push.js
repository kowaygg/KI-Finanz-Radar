// Push-Nachrichten über ntfy (ntfy.sh, kostenlos, ohne Konto).
// Nur öffentliche News-Inhalte – nie Watchlist, Schlüssel oder andere persönliche Daten.
// Ohne Kanalname (Secret NTFY_KANAL) wird nichts gesendet, sondern nur angezeigt, was gesendet würde.

import { sichtbar } from './sammeln.js';
import { sichererLink } from './bereinigen.js';

// Sendet eine Nachricht. Gibt true zurück, wenn ntfy sie angenommen hat. Fehler stoppen nie den Ablauf.
export async function pushSenden(nachricht, { server, kanal, holen = fetch, protokoll = console.log }) {
  if (!kanal) {
    protokoll(`(Probelauf, kein Kanal) Push: ${nachricht.title} – ${nachricht.message.replace(/\n/g, ' | ')}`);
    return false;
  }
  try {
    // JSON an die Wurzel-Adresse: Umlaute und Sonderzeichen kommen so sicher an.
    const antwort = await holen(server, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: kanal, ...nachricht }),
      signal: AbortSignal.timeout(15000),
    });
    return antwort.ok;
  } catch {
    return false;
  }
}

function titelVon(m) {
  return m.ki?.analyse?.titel || m.titelDe || m.titel;
}

function punkteVon(m) {
  const analyse = m.ki?.analyse?.zusammenfassung;
  if (Array.isArray(analyse) && analyse.length) return analyse;
  return Array.isArray(m.ki?.kurz) ? m.ki.kurz : [];
}

// Wichtige Meldungen (Relevanz 9–10), die noch nicht gesendet wurden und nicht zu alt sind.
export function pushKandidaten(meldungen, { minRelevanz, maxAlterStunden, maxProLauf, jetzt, filter }) {
  const grenze = jetzt.getTime() - maxAlterStunden * 3600 * 1000;
  return meldungen
    .filter((m) => m.ki && m.ki.relevanz >= minRelevanz && !m.ki.dublette && !m.gepusht
      && Date.parse(m.datum) >= grenze && sichtbar(m, filter))
    .sort((a, b) => b.ki.relevanz - a.ki.relevanz || Date.parse(b.datum) - Date.parse(a.datum))
    .slice(0, maxProLauf);
}

export function meldungsPush(m) {
  const punkte = punkteVon(m).slice(0, 5).map((p) => `• ${p}`);
  const nachricht = {
    title: `★ ${m.ki.relevanz}/10 · ${titelVon(m)}`.slice(0, 250),
    message: [...punkte, `Quelle: ${m.quelle}`].join('\n').slice(0, 3000),
    priority: m.ki.relevanz >= 10 ? 5 : 4,
    tags: ['chart_with_upwards_trend'],
  };
  const link = sichererLink(m.link);
  if (link) nachricht.click = link;
  return nachricht;
}

// Für den Abruf: sendet neue Top-Meldungen und merkt sich, was gesendet wurde (nie doppelt).
export async function wichtigesPushen(meldungen, einstellungen, { kanal, jetzt, filter, holen, protokoll }) {
  const kandidaten = pushKandidaten(meldungen, { ...einstellungen, jetzt, filter });
  let gesendet = 0;
  for (const m of kandidaten) {
    if (await pushSenden(meldungsPush(m), { server: einstellungen.server, kanal, holen, protokoll })) {
      m.gepusht = jetzt.toISOString();
      gesendet++;
    }
  }
  return { aktiv: Boolean(kanal), kandidaten: kandidaten.length, gesendet };
}

// Wächter: Warnung, wenn der Abruf seit mehr als X Stunden nicht lief.
// Läuft stündlich; gemeldet wird in der ersten Stunde nach der Grenze und danach einmal pro Tag.
export function abrufWarnung(letzterAbruf, { abrufWarnungStunden, appAdresse }, jetzt) {
  const alterStunden = (jetzt.getTime() - Date.parse(letzterAbruf)) / 3600000;
  if (!Number.isFinite(alterStunden) || alterStunden < abrufWarnungStunden) return null;
  if ((alterStunden - abrufWarnungStunden) % 24 >= 1) return null;
  return {
    title: `⚠ KI-Finanz-Radar: Abruf läuft seit ${Math.floor(alterStunden)} Std. nicht`,
    message: 'Die News werden gerade nicht aktualisiert. Meist ist GitHub nur verzögert. Hält es an: im Repo unter „Actions“ → „Abruf“ nachsehen oder Claude Code fragen.',
    priority: 4,
    tags: ['warning'],
    click: appAdresse,
  };
}
