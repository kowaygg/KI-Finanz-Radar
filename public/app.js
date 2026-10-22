// KI-Finanz-Radar – Oberfläche. Feed-Inhalte werden ausschließlich per textContent eingefügt (kein innerHTML).
import { kalenderwoche, boersenStatus, countdown, kurzerTag, terminText, wandzeit } from './zeit.js';
import { veraenderung, kurveZeichnen, kursText, zeitBeschriftung, spanneText } from './diagramm.js';
import { watchlistLesen, suchbegriffe, meldungTrifft } from './watchlist.js';

const ZEITZONE = 'Europe/Berlin';
const ALARM_NACH_MS = 3 * 60 * 60 * 1000;
const SPEICHER_GESEHEN = 'radar.zuletztGesehen';
const NEU_LADEN_MS = 5 * 60 * 1000;

const $ = (id) => document.getElementById(id);

const fmtUhrzeit = new Intl.DateTimeFormat('de-DE', { timeZone: ZEITZONE, hour: '2-digit', minute: '2-digit' });
const fmtTag = new Intl.DateTimeFormat('de-DE', { timeZone: ZEITZONE, day: '2-digit', month: '2-digit' });
const fmtLang = new Intl.DateTimeFormat('de-DE', { timeZone: ZEITZONE, weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
const tagSchluessel = (d) => new Intl.DateTimeFormat('de-DE', { timeZone: ZEITZONE, dateStyle: 'short' }).format(d);

function speicherLesen(schluessel) {
  try { return localStorage.getItem(schluessel); } catch { return null; }
}
function speicherSchreiben(schluessel, wert) {
  try { localStorage.setItem(schluessel, wert); } catch { /* privat-Modus: egal */ }
}

function sichererLink(roh) {
  try {
    const url = new URL(roh);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

// Englische Artikel öffnen über Google Übersetzer direkt auf Deutsch; deutsche Artikel unverändert.
function leseLink(m, link = m.link) {
  const sicher = sichererLink(link);
  if (!sicher || m.sprache !== 'en') return sicher;
  return `https://translate.google.com/translate?sl=auto&tl=de&hl=de&u=${encodeURIComponent(sicher)}`;
}

function anzeigeTitel(m) {
  return m.ki?.analyse?.titel || m.titelDe || m.titel;
}

function titelLink(m, text) {
  const link = leseLink(m);
  const el = element(link ? 'a' : 'span', 'titel', text);
  if (link) {
    el.href = link;
    el.target = '_blank';
    el.rel = 'noopener noreferrer';
    if (m.sprache === 'en') el.title = 'Öffnet den Artikel auf Deutsch übersetzt';
  }
  return el;
}

function zeitText(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return tagSchluessel(d) === tagSchluessel(new Date()) ? fmtUhrzeit.format(d) : `${fmtTag.format(d)} ${fmtUhrzeit.format(d)}`;
}

function element(tag, klasse, text) {
  const el = document.createElement(tag);
  if (klasse) el.className = klasse;
  if (text !== undefined) el.textContent = text;
  return el;
}

// ---------- Aufklappbare Meldungen (Live und Wichtig) ----------
// Ein Klick auf die Meldung öffnet zuerst die KI-Zusammenfassung; erst der Link darunter führt zur Quelle.

// Stichpunkte einer Meldung: ausführliche Analyse (Wichtig) vor Kurz-Zusammenfassung aus der Bewertung.
function stichpunkte(m) {
  const analyse = m.ki?.analyse?.zusammenfassung;
  if (Array.isArray(analyse) && analyse.length) return { punkte: analyse, wenigInfo: analyse.length < 3 };
  if (Array.isArray(m.ki?.kurz) && m.ki.kurz.length) return { punkte: m.ki.kurz, wenigInfo: Boolean(m.ki.wenigInfo) };
  return { punkte: [], wenigInfo: false };
}

function linkElement(href, text) {
  const a = element('a', null, text);
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  return a;
}

function zusammenfassungElement(m) {
  const { punkte, wenigInfo } = stichpunkte(m);
  if (!punkte.length) {
    return [element('p', 'hinweis', m.ki
      ? 'Für diese Meldung gibt es keine Zusammenfassung (ältere Meldung oder zu wenig Text in der Quelle).'
      : 'Zusammenfassung folgt beim nächsten Abruf – die KI hat diese Meldung noch nicht gelesen.')];
  }
  const ul = element('ul', 'punkte');
  for (const p of punkte) ul.append(element('li', null, p));
  return wenigInfo ? [ul, element('p', 'kurzmeldung', 'Kurzmeldung – nur wenige Infos in der Quelle. Mehr steht im Originalartikel.')] : [ul];
}

function quellenElement(m) {
  const box = element('div', 'quelle-zeile');
  box.append(element('span', 'leise', `Quelle: ${m.quelle} · `));
  const link = leseLink(m);
  if (link) box.append(linkElement(link, m.sprache === 'en' ? 'Artikel auf Deutsch öffnen ↗' : 'Artikel öffnen ↗'));
  const original = sichererLink(m.link);
  if (m.sprache === 'en' && original) box.append(' · ', linkElement(original, 'Originalseite (Englisch)'));
  const weitere = (m.quellen || []).filter((q) => q.name !== m.quelle && sichererLink(q.link));
  if (weitere.length) {
    const zeile = element('div', 'weitere', 'Auch bei: ');
    weitere.forEach((q, i) => {
      zeile.append(linkElement(sichererLink(q.link), q.name));
      if (i < weitere.length - 1) zeile.append(', ');
    });
    box.append(zeile);
  }
  return box;
}

function zeitElement(m) {
  const zeit = element('time', 'zeit', zeitText(m.datum));
  zeit.dateTime = m.datum;
  return zeit;
}

function aufklappMeldung(m, klasse, metaTeile, inhalt) {
  const li = element('li', klasse);
  li.id = `meldung-${m.id}`;
  const details = element('details', 'aufklapp');
  const summary = element('summary');
  const meta = element('div', 'meta');
  meta.append(...metaTeile);
  watchlistBadge(meta, m);
  const kopf = element('div', 'aufklapp-kopf');
  kopf.append(element('span', 'titel', anzeigeTitel(m)), element('span', 'pfeil', '▸'));
  summary.append(meta, kopf);
  if (m.sprache === 'en' && anzeigeTitel(m) !== m.titel) summary.append(element('div', 'original', `Original: ${m.titel}`));
  const koerper = element('div', 'aufklapp-inhalt');
  koerper.append(...inhalt, quellenElement(m));
  details.append(summary, koerper);
  li.append(details);
  return li;
}

function meldungElement(m, zuletztGesehen) {
  const li = aufklappMeldung(m, 'meldung', [zeitElement(m), element('span', null, m.quelle), element('span', 'badge', m.kategorie)], zusammenfassungElement(m));
  if (zuletztGesehen && Date.parse(m.gefunden) > zuletztGesehen) li.classList.add('neu');
  return li;
}

const STIMMUNG = { positiv: '▲ positiv', neutral: '● neutral', negativ: '▼ negativ' };

function chips(titel, werte) {
  if (!Array.isArray(werte) || !werte.length) return null;
  const zeile = element('div', 'chip-zeile');
  zeile.append(element('span', 'chip-titel', `${titel}:`));
  for (const w of werte) zeile.append(element('span', 'chip', w));
  return zeile;
}

// Ausführliche Darstellung im Reiter „Wichtig“ – ebenfalls aufklappbar.
function wichtigElement(m) {
  const ki = m.ki;
  const analyse = ki.analyse;
  const inhalt = zusammenfassungElement(m);
  const schlag = chips('Themen', ki.schlagwoerter);
  if (schlag) inhalt.push(schlag);
  if (analyse) {
    for (const [name, werte] of [['Aktien', analyse.betroffen?.aktien], ['ETFs', analyse.betroffen?.etfs], ['Branchen', analyse.betroffen?.branchen]]) {
      const z = chips(name, werte);
      if (z) inhalt.push(z);
    }
    const box = element('div', 'einschaetzung');
    const horizont = { kurzfristig: 'kurzfristig', langfristig: 'langfristig', beides: 'kurz- und langfristig' }[analyse.einschaetzung.zeithorizont] || '';
    box.append(element('div', 'einschaetzung-titel', `KI-Einschätzung · Zeithorizont: ${horizont} · Sicherheit: ${analyse.einschaetzung.sicherheit}`));
    box.append(element('p', null, analyse.einschaetzung.text));
    if (analyse.vergleich) box.append(element('p', 'vergleich', `Historischer Vergleich: ${analyse.vergleich}`));
    box.append(element('div', 'modell', `Analysiert von ${analyse.dienst} (${analyse.modell}) · keine Anlageberatung`));
    inhalt.push(box);
  } else {
    inhalt.push(element('p', 'hinweis', 'Ausführliche KI-Einschätzung folgt beim nächsten Abruf.'));
  }
  return aufklappMeldung(m, 'meldung karte', [
    zeitElement(m),
    element('span', null, m.quelle),
    element('span', 'badge', m.kategorie),
    element('span', 'badge relevanz', `Relevanz ${ki.relevanz}/10`),
    element('span', `stimmung stimmung-${ki.stimmung}`, STIMMUNG[ki.stimmung] || ''),
  ], inhalt);
}

// Springt zur Meldung in der Liste und klappt sie auf.
function meldungOeffnen(id) {
  const li = document.getElementById(`meldung-${id}`);
  if (!li) return;
  const details = li.querySelector('details');
  if (details) details.open = true;
  li.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function standAnzeigen(status) {
  const stand = $('stand');
  const warnung = $('warnung');
  if (!status?.letzterAbruf) {
    stand.textContent = 'Stand: unbekannt';
    return;
  }
  const alterMs = Date.now() - Date.parse(status.letzterAbruf);
  const minuten = Math.max(0, Math.round(alterMs / 60000));
  stand.textContent = minuten < 60 ? `Stand: vor ${minuten} Min.` : `Stand: vor ${Math.floor(minuten / 60)} Std. ${minuten % 60} Min.`;
  // Hinweis zum Rhythmus: geplant alle 15 Min., GitHub startet kostenlose Abrufe oft verzögert.
  stand.append(element('span', 'stand-info', ' · neue Daten automatisch etwa alle 15–45 Min.'));
  const alt = alterMs > ALARM_NACH_MS;
  stand.classList.toggle('alt', alt);
  warnung.hidden = !alt;
  if (alt) warnung.textContent = '⚠ Der automatische Abruf lief seit über 3 Stunden nicht. Die Meldungen sind nicht aktuell.';
  // Lokale Testkopie (npm start) aktualisiert sich nicht von selbst – deutlich kennzeichnen, damit es nicht verwechselt wird.
  if (['localhost', '127.0.0.1'].includes(location.hostname)) {
    warnung.hidden = false;
    warnung.textContent = `🛠 Lokale Testversion auf diesem PC – aktualisiert sich nicht automatisch. Die echte App: kowaygg.github.io/KI-Finanz-Radar${alt ? ' · Daten älter als 3 Stunden' : ''}`;
  }
  const gestoert = (status.quellen || []).filter((q) => !q.ok);
  if (gestoert.length) stand.title = `Gestörte Quellen: ${gestoert.map((q) => q.name).join(', ')}`;
}

// ---------- Kopfzeile ----------
const fmtUhrSek = new Intl.DateTimeFormat('de-DE', { timeZone: ZEITZONE, hour: '2-digit', minute: '2-digit', second: '2-digit' });
let kalender = { boersen: [], termine: [] };
let letzterStatus = null;

const fmtHhMm = (zeitzone) => new Intl.DateTimeFormat('de-DE', { timeZone: zeitzone, hour: '2-digit', minute: '2-digit' });

// Eine Zeile im Reiter „Börsen“: Name, Status, Countdown, Handelszeit in deutscher Zeit, Ortszeit.
function boersenZeile(boerse, jetzt) {
  const s = boersenStatus(boerse, jetzt);
  const zeile = element('div', `boerse-zeile ${s.offen ? 'boerse-offen' : 'boerse-zu'}`);
  zeile.append(element('strong', 'boerse-name', boerse.name));
  const status = s.offen ? '● offen' : s.mittagspause ? '◐ Mittagspause' : '○ geschlossen';
  zeile.append(element('span', 'punkt', status));
  let rest = '';
  if (s.offen) {
    rest = `${s.mittagspause ? 'Pause' : 'schließt'} in ${countdown(s.schliesst - jetzt)}${s.fruehschluss ? ' (Frühschluss)' : ''}`;
  } else if (s.oeffnet) {
    const bis = s.oeffnet - jetzt;
    rest = bis < 24 * 3600 * 1000 ? `öffnet in ${countdown(bis)}` : `öffnet ${kurzerTag(s.oeffnet)} ${fmtHhMm(ZEITZONE).format(s.oeffnet)}`;
    if (s.feiertag) rest += ' (Feiertag)';
  }
  zeile.append(element('span', 'boerse-countdown', rest));
  const ort = fmtHhMm(boerse.zeitzone).format(jetzt);
  zeile.append(element('span', 'boerse-ort', `Ortszeit ${ort}`));
  return { zeile, offen: s.offen };
}

function boersenAnzeigen(jetzt) {
  const laender = [...new Set(kalender.boersen.map((b) => b.land || ''))];
  let offen = 0;
  $('boersen').replaceChildren(...laender.map((land) => {
    const gruppe = element('section', 'boersen-gruppe');
    gruppe.append(element('h3', 'land', land));
    for (const b of kalender.boersen.filter((x) => (x.land || '') === land)) {
      const z = boersenZeile(b, jetzt);
      if (z.offen) offen++;
      gruppe.append(z.zeile);
    }
    return gruppe;
  }));
  $('boersen-hinweis').textContent = kalender.boersenHinweis
    ? `Zeiten in deutscher Zeit, Countdown live. ${kalender.boersenHinweis}` : 'Zeiten in deutscher Zeit, Countdown live.';
}

function kopfTicken() {
  const jetzt = new Date();
  $('datum').textContent = fmtLang.format(jetzt);
  $('kw').textContent = `KW ${kalenderwoche(jetzt, ZEITZONE)}`;
  $('uhr').textContent = fmtUhrSek.format(jetzt);
  boersenAnzeigen(jetzt);
  if (jetzt.getSeconds() === 0) {
    if (letzterStatus) standAnzeigen(letzterStatus);
    termineAnzeigen(jetzt);
  }
}


// ---------- Reiter „Zinsen“ ----------
const SPEICHER_BEREICH = 'radar.zinsenBereich';
let zinsDaten = null;
let zinsBereich = speicherLesen(SPEICHER_BEREICH) || 'tagesgeld';
const prozentFormat = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const prozent = (wert) => (Number.isFinite(wert) ? `${prozentFormat.format(wert)} %` : '–');
const datumKurz = (iso) => (iso ? new Intl.DateTimeFormat('de-DE', { timeZone: ZEITZONE, day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso)) : '');

function naechsterEntscheid(muster) {
  const t = (kalender.termine || []).find((x) => x.art === 'Zinsentscheid' && muster.test(x.titel) && Date.parse(x.zeit) > Date.now());
  return t ? `Nächster Entscheid: ${fmtTerminTag.format(new Date(t.zeit))}` : '';
}

function leitzinsKarte(titel, wert, unter) {
  const karte = element('div', 'leitzins');
  karte.append(element('div', 'leitzins-titel', titel), element('div', 'leitzins-wert', wert));
  if (unter) karte.append(element('div', 'leitzins-unter', unter));
  return karte;
}

function tabelle(kopf, zeilen) {
  const t = element('table', 'tabelle');
  const thead = element('thead');
  const tr = element('tr');
  for (const k of kopf) tr.append(element('th', k.klasse || null, k.text));
  thead.append(tr);
  const tbody = element('tbody');
  for (const zeile of zeilen) {
    const z = element('tr');
    zeile.forEach((zelle, i) => z.append(element('td', kopf[i].klasse || null, zelle)));
    tbody.append(z);
  }
  t.append(thead, tbody);
  const huelle = element('div', 'tabelle-huelle');
  huelle.append(t);
  return huelle;
}

function zinsenAnzeigen() {
  const d = zinsDaten;
  if (!d) return;
  const l = d.leitzinsen || {};
  $('leitzinsen').replaceChildren(
    leitzinsKarte('EZB-Einlagensatz', prozent(l.ezb?.einlagen), naechsterEntscheid(/EZB/)),
    leitzinsKarte('EZB-Hauptrefinanzierung', prozent(l.ezb?.hauptrefi), l.ezb?.stand ? `Stand ${datumKurz(l.ezb.stand)}` : ''),
    leitzinsKarte('Fed-Zielspanne (USA)', Number.isFinite(l.fed?.von) ? `${prozentFormat.format(l.fed.von)}–${prozent(l.fed.bis)}` : '–', naechsterEntscheid(/Fed/)),
  );
  for (const k of document.querySelectorAll('.unterreiter .zeitraum')) k.setAttribute('aria-pressed', String(k.dataset.bereich === zinsBereich));

  const inhalt = [];
  if (zinsBereich === 'tagesgeld') {
    inhalt.push(element('h2', 'abschnitt', 'Tagesgeld – Neukunden'));
    inhalt.push(tabelle(
      [{ text: 'Bank' }, { text: 'Zins', klasse: 'zahl' }, { text: 'gilt' }, { text: 'danach', klasse: 'zahl' }, { text: 'Einlagen­sicherung', klasse: 'nur-gross' }],
      (d.tagesgeldNeukunden || []).map((b) => [b.bank, prozent(b.zins), b.dauer, Number.isFinite(b.danach) ? prozent(b.danach) : '–', b.sicherung]),
    ));
    inhalt.push(element('h2', 'abschnitt', 'Tagesgeld – Bestandskunden (Dauerzins)'));
    inhalt.push(tabelle(
      [{ text: 'Bank' }, { text: 'Zins', klasse: 'zahl' }, { text: 'Einlagen­sicherung' }],
      (d.tagesgeldBestandskunden || []).map((b) => [b.bank, prozent(b.zins), b.sicherung]),
    ));
    if (d.angekuendigt?.length) {
      inhalt.push(element('h2', 'abschnitt', 'Angekündigt'));
      const ul = element('ul', 'zinsen-liste');
      for (const a of d.angekuendigt) ul.append(element('li', null, a.text));
      inhalt.push(ul);
    }
  } else if (zinsBereich === 'kredite') {
    for (const k of d.kredite || []) {
      const karte = element('section', 'kurs-karte zins-karte');
      karte.append(element('h3', 'zins-karte-titel', k.art));
      const dl = element('dl', 'zins-werte');
      for (const w of k.werte) {
        const zeile = element('div');
        zeile.append(element('dt', null, w.label), element('dd', null, w.wert), element('dd', 'leise klein-quelle', w.quelle));
        dl.append(zeile);
      }
      karte.append(dl);
      if (k.hinweis) karte.append(element('p', 'klein-hinweis', k.hinweis));
      inhalt.push(karte);
    }
  } else {
    const muster = /(?<![\p{L}])(bank|banken|sparkasse|zins|zinsen|leitzins|ezb|fed|tagesgeld|kredit|hypothek|bafin|einlagen)/iu;
    const news = letzteMeldungen.filter((m) => m.kategorie === 'Finanzen & Vorsorge' || muster.test(`${m.titel} ${m.titelDe || ''}`)).slice(0, 15);
    const liste = element('ol', 'liste');
    liste.append(...news.map((m) => meldungElement(m, zuletztGesehen)));
    inhalt.push(news.length ? liste : element('p', 'leer', 'Gerade keine Banken- und Zins-News.'));
  }
  $('zinsen-inhalt').replaceChildren(...inhalt);
  $('zinsen-hinweis').textContent = zinsBereich === 'news' ? 'Aus den laufenden Meldungen: Banken, Zinsen, Notenbanken, Finanzen & Vorsorge.'
    : `Stand Konditionen: ${datumKurz(d.stand)} · Leitzinsen täglich automatisch (EZB, New York Fed). ${d.hinweis || ''} Keine Anlageberatung.`;
  $('zinsen-quellen').replaceChildren(...(d.quellen || []).map((q) => {
    const li = element('li');
    const link = sichererLink(q.url);
    if (link) { const a = element('a', null, q.name); a.href = link; a.target = '_blank'; a.rel = 'noopener noreferrer'; li.append(a); } else li.append(q.name);
    return li;
  }));
}

function zinsenEinrichten() {
  for (const k of document.querySelectorAll('.unterreiter .zeitraum')) {
    k.addEventListener('click', () => {
      zinsBereich = k.dataset.bereich;
      speicherSchreiben(SPEICHER_BEREICH, zinsBereich);
      zinsenAnzeigen();
    });
  }
}

// ---------- Reiter „Termine“ ----------
const fmtTerminTag = new Intl.DateTimeFormat('de-DE', { timeZone: ZEITZONE, weekday: 'short', day: '2-digit', month: '2-digit' });
const fmtMonat = new Intl.DateTimeFormat('de-DE', { timeZone: ZEITZONE, month: 'long', year: 'numeric' });

function abstandText(zeitpunkt, jetzt) {
  const tage = Math.round((Date.UTC(...datumTeile(zeitpunkt)) - Date.UTC(...datumTeile(jetzt))) / 86400000);
  if (tage <= 0) return 'heute';
  if (tage === 1) return 'morgen';
  return `in ${tage} Tagen`;
}
function datumTeile(d) {
  const w = wandzeit(d, ZEITZONE);
  return [w.jahr, w.monat - 1, w.tag];
}

function termineAnzeigen(jetzt) {
  const kommend = (kalender.termine || []).filter((t) => Date.parse(t.zeit) > jetzt.getTime() - 3600 * 1000);
  $('termine-leer').hidden = kommend.length > 0;
  const gruppen = new Map();
  for (const t of kommend) {
    const monat = fmtMonat.format(new Date(t.zeit));
    if (!gruppen.has(monat)) gruppen.set(monat, []);
    gruppen.get(monat).push(t);
  }
  let ersterKommender = true;
  $('termine-liste').replaceChildren(...[...gruppen].map(([monat, termine]) => {
    const gruppe = element('section', 'boersen-gruppe termin-gruppe');
    gruppe.append(element('h3', 'land', monat));
    for (const t of termine) {
      const zeitpunkt = new Date(t.zeit);
      const zeile = element('div', 'termin-zeile');
      if (ersterKommender && zeitpunkt > jetzt) { zeile.classList.add('termin-naechster'); ersterKommender = false; }
      zeile.append(
        element('span', 'termin-datum', `${fmtTerminTag.format(zeitpunkt)} ${fmtHhMm(ZEITZONE).format(zeitpunkt)}`),
        element('span', 'termin-titel', t.titel),
      );
      const info = element('span', 'termin-info');
      if (t.art) info.append(element('span', 'badge', t.art));
      if (t.land) info.append(element('span', 'badge', t.land));
      if (t.status === 'erwartet') info.append(element('span', 'badge termin-erwartet', 'erwartet'));
      zeile.append(info, element('span', 'termin-abstand', abstandText(zeitpunkt, jetzt)));
      if (t.info) zeile.append(element('span', 'termin-text', t.info));
      gruppe.append(zeile);
    }
    return gruppe;
  }));
}

// ---------- Kursdiagramme (DAX, S&P 500) ----------
const SPEICHER_ZEITRAUM = 'radar.zeitraum';

function diagrammKarte(index, zeitraeume, quelle) {
  const karte = element('article', 'kurs-karte');
  const kopf = element('div', 'kurs-kopf');
  const titel = element('div', 'kurs-titel');
  titel.append(element('span', 'kurs-land', index.land), element('strong', null, index.name));
  const wert = element('div', 'kurs-wert');
  kopf.append(titel, wert);
  const knoepfe = element('div', 'zeitraum-knoepfe');
  knoepfe.setAttribute('role', 'group');
  knoepfe.setAttribute('aria-label', `Zeitraum ${index.name}`);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('kurs-svg');
  svg.setAttribute('role', 'img');
  const achse = element('div', 'kurs-achse');
  const fuss = element('div', 'kurs-fuss');
  karte.append(kopf, knoepfe, svg, achse, fuss);

  let zeitraum = speicherLesen(`${SPEICHER_ZEITRAUM}.${index.symbol}`) || '1T';
  if (!index.verlauf?.[zeitraum]) zeitraum = zeitraeume.find((z) => index.verlauf?.[z.schluessel])?.schluessel || '1T';
  let finde = null;

  function zeichnen() {
    const punkte = index.verlauf?.[zeitraum] || [];
    const v = veraenderung(punkte, index.vortag, zeitraum);
    wert.replaceChildren();
    if (v) {
      wert.append(element('span', 'kurs-zahl', kursText(v.letzter)), element('span', `kurs-pct stimmung-${v.richtung}`, v.text));
    } else {
      wert.append(element('span', 'leise', 'keine Kurse'));
    }
    finde = kurveZeichnen(svg, punkte, v?.richtung || 'neutral', index.vortag, zeitraum);
    svg.setAttribute('aria-label', v ? `${index.name} ${zeitraeume.find((z) => z.schluessel === zeitraum)?.name}: ${v.text}` : `${index.name}: keine Daten`);
    achse.replaceChildren();
    if (punkte.length > 1) {
      const { min, max } = spanneText(punkte);
      achse.append(
        element('span', null, zeitBeschriftung(punkte[0][0], zeitraum)),
        element('span', 'leise', `Tief ${kursText(min)} · Hoch ${kursText(max)}`),
        element('span', null, zeitBeschriftung(punkte[punkte.length - 1][0], zeitraum)),
      );
    }
    const stand = index.stand?.[zeitraum];
    fuss.textContent = stand ? `Stand ${new Intl.DateTimeFormat('de-DE', { timeZone: ZEITZONE, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(stand))} · ${quelle}` : quelle;
    for (const k of knoepfe.children) k.setAttribute('aria-pressed', String(k.dataset.zeitraum === zeitraum));
  }

  for (const z of zeitraeume) {
    const knopf = element('button', 'zeitraum', z.schluessel);
    knopf.type = 'button';
    knopf.title = z.name;
    knopf.dataset.zeitraum = z.schluessel;
    knopf.disabled = !index.verlauf?.[z.schluessel];
    knopf.addEventListener('click', () => {
      zeitraum = z.schluessel;
      speicherSchreiben(`${SPEICHER_ZEITRAUM}.${index.symbol}`, zeitraum);
      zeichnen();
    });
    knoepfe.append(knopf);
  }

  // Finger oder Maus über der Kurve: Kurs zu diesem Zeitpunkt anzeigen.
  const zeigen = (e) => {
    if (!finde) return;
    const r = svg.getBoundingClientRect();
    const p = finde((e.clientX - r.left) / r.width);
    if (p) fuss.textContent = `${zeitBeschriftung(p[0], zeitraum === 'Max' || zeitraum === '1J' ? '1J' : '1W')} · ${kursText(p[1])}`;
  };
  svg.addEventListener('pointermove', zeigen);
  svg.addEventListener('pointerdown', zeigen);
  svg.addEventListener('pointerleave', () => { if (finde) finde(null); zeichnen(); });

  zeichnen();
  return karte;
}

let kursZeitraeume = [];
let kursQuelle = '';

function maerkteAnzeigen(kurse) {
  kursZeitraeume = kurse?.zeitraeume || [];
  kursQuelle = kurse?.quelle || '';
  const indizes = (kurse?.indizes || []).filter((i) => Object.keys(i.verlauf || {}).length);
  $('maerkte').replaceChildren(...indizes.map((i) => diagrammKarte(i, kurse.zeitraeume || [], kurse.quelle || '')));

}

// Die 3 wichtigsten Meldungen der letzten 24 Stunden aus „Wichtig“ (höchste KI-Relevanz, bei Gleichstand die neueste). Klick springt zur Meldung.
function topNewsAnzeigen(meldungen) {
  const grenze = Date.now() - 24 * 3600 * 1000;
  const top = meldungen
    .filter((m) => Number.isInteger(m.ki?.relevanz) && !m.ki.dublette && Date.parse(m.datum) >= grenze)
    .sort((a, b) => b.ki.relevanz - a.ki.relevanz || Date.parse(b.datum) - Date.parse(a.datum))
    .slice(0, 3);
  $('top-news').hidden = top.length === 0;
  $('top-liste').replaceChildren(...top.map((m) => {
    const li = element('li', 'top-eintrag');
    const knopf = element('button', 'titel top-knopf', anzeigeTitel(m));
    knopf.type = 'button';
    knopf.addEventListener('click', () => meldungOeffnen(m.id));
    li.append(knopf);
    const meta = element('div', 'top-meta');
    meta.append(element('span', 'top-relevanz', `Relevanz ${m.ki.relevanz}/10`), ` · ${zeitText(m.datum)} · ${m.quelle}`);
    if (STIMMUNG[m.ki.stimmung]) meta.append(' · ', element('span', `stimmung stimmung-${m.ki.stimmung}`, STIMMUNG[m.ki.stimmung]));
    li.append(meta);
    return li;
  }));
}

// ---------- Reiter „Kurse“: Kurven der Watchlist-Werte (Daten aus der öffentlichen Werteliste) ----------
const verlaufDatei = (symbol) => `${symbol.replace(/[^A-Za-z0-9.-]/g, '_')}.json`;

async function kurseWatchlistAnzeigen() {
  const mitWert = watchlist.map((e) => ({ e, w: wertZu(e) })).filter((x) => x.w);
  const ohne = watchlist.filter((e) => !wertZu(e));
  $('kurse-watchlist-leer').hidden = watchlist.length > 0;
  $('kurse-ohne-daten').hidden = ohne.length === 0;
  $('kurse-ohne-daten').textContent = ohne.length ? `Ohne Kursdaten (nicht in der öffentlichen Werteliste): ${ohne.map((e) => e.name).join(', ')}` : '';
  const karten = await Promise.all(mitWert.map(async ({ e, w }) => {
    try {
      const v = await jsonHolen(`data/verlauf/${verlaufDatei(w.symbol)}`);
      return diagrammKarte({ name: e.name, land: `${w.art} · ${w.symbol}`, symbol: w.symbol, verlauf: v.verlauf || {}, stand: v.stand || {}, vortag: v.vortag }, kursZeitraeume, kursQuelle);
    } catch {
      return null;
    }
  }));
  $('kurse-watchlist').replaceChildren(...karten.filter(Boolean));
}

// ---------- Watchlist (nur auf diesem Gerät) ----------
const SPEICHER_WATCHLIST = 'radar.watchlist';
const STARKE_BEWEGUNG = 3;
let watchlist = (() => { try { return watchlistLesen(speicherLesen(SPEICHER_WATCHLIST) || '[]').eintraege; } catch { return []; } })();
let werteDaten = null;
let letzteMeldungen = [];
let watchlistBegriffe = [];
const pctFormat = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero' });

function wertZu(eintrag) {
  return werteDaten?.werte?.find((w) => w.isin === eintrag.isin) || null;
}

function watchlistBegriffeBerechnen() {
  watchlistBegriffe = watchlist.map((e) => ({ eintrag: e, begriffe: suchbegriffe(e, wertZu(e)) }));
}

function watchlistBadge(meta, m) {
  const treffer = watchlistBegriffe.filter((w) => meldungTrifft(m, w.begriffe)).map((w) => w.eintrag.name);
  if (treffer.length) meta.append(element('span', 'badge watchlist-badge', `★ ${treffer.slice(0, 2).join(', ')}`));
}

function watchlistEintrag(e) {
  const w = wertZu(e);
  const li = element('li', 'meldung wl-eintrag');
  const kopf = element('div', 'wl-kopf');
  const name = element('div', 'wl-name');
  name.append(element('strong', null, e.name), element('span', 'wl-isin', e.isin));
  kopf.append(name);
  li.append(kopf);
  if (w && Number.isFinite(w.kurs)) {
    const richtung = w.pct > 0 ? 'positiv' : w.pct < 0 ? 'negativ' : 'neutral';
    const wert = element('div', 'wl-wert');
    wert.append(
      element('span', 'kurs-zahl', `${kursText(w.kurs)} ${w.waehrung}`),
      element('span', `kurs-pct stimmung-${richtung}`, `${w.pct > 0 ? '▲' : w.pct < 0 ? '▼' : '●'} ${pctFormat.format(w.pct)} %`),
    );
    if (Math.abs(w.pct) > STARKE_BEWEGUNG) wert.append(element('span', 'wl-warnung', `⚠ starke Bewegung (über ${STARKE_BEWEGUNG} %)`));
    kopf.append(wert);
    if (w.verlauf?.length > 1) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.classList.add('wl-svg');
      svg.setAttribute('aria-label', `${e.name}: Kursverlauf 1 Monat`);
      const punkte = w.verlauf.map((k, i) => [i, k]);
      const gesamt = punkte[punkte.length - 1][1] - punkte[0][1];
      kurveZeichnen(svg, punkte, gesamt > 0 ? 'positiv' : gesamt < 0 ? 'negativ' : 'neutral', null, '1M');
      const stand = new Intl.DateTimeFormat('de-DE', { timeZone: ZEITZONE, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(w.stand));
      li.append(svg, element('div', 'kurs-fuss', `Verlauf 1 Monat · Stand ${stand} · verzögert`));
    }
  } else {
    li.append(element('p', 'hinweis', 'Kein Kurs verfügbar: Dieser Wert steht nicht in der öffentlichen Werteliste. Passende News werden trotzdem angezeigt.'));
  }
  const begriffe = watchlistBegriffe.find((b) => b.eintrag.isin === e.isin)?.begriffe || [];
  const news = letzteMeldungen.filter((m) => meldungTrifft(m, begriffe)).slice(0, 3);
  if (news.length) {
    const ul = element('ul', 'wl-news');
    for (const m of news) {
      const item = element('li');
      item.append(element('span', 'zeit', zeitText(m.datum)), ' ', titelLink(m, anzeigeTitel(m)));
      ul.append(item);
    }
    li.append(element('div', 'wl-news-titel', 'Passende News:'), ul);
  }
  return li;
}

function watchlistAnzeigen() {
  $('watchlist-leer').hidden = watchlist.length > 0;
  $('liste-watchlist').replaceChildren(...watchlist.map(watchlistEintrag));

  const mitKurs = watchlist.map((e) => ({ e, w: wertZu(e) })).filter((x) => Number.isFinite(x.w?.pct));
  const stark = mitKurs.filter((x) => Math.abs(x.w.pct) > STARKE_BEWEGUNG);
  $('zaehler-watchlist').hidden = stark.length === 0;
  $('zaehler-watchlist').textContent = `⚠ ${stark.length}`;
}

function watchlistAlsText() {
  return watchlist.map((e) => `${e.name};${e.isin}`).join('\n');
}

function watchlistSpeichern(text) {
  const { eintraege, fehler } = watchlistLesen(text);
  watchlist = eintraege;
  speicherSchreiben(SPEICHER_WATCHLIST, JSON.stringify(watchlist));
  $('watchlist-text').value = watchlistAlsText();
  $('watchlist-meldung').textContent = `${eintraege.length} Werte gespeichert (nur auf diesem Gerät).${fehler.length ? ` Nicht übernommen: ${fehler.join('; ')}` : ''}`;
  watchlistBegriffeBerechnen();
  laden();
}

function watchlistBearbeitenEinrichten() {
  $('watchlist-text').value = watchlistAlsText();
  $('watchlist-speichern').addEventListener('click', () => watchlistSpeichern($('watchlist-text').value));
  $('watchlist-datei').addEventListener('change', async (ereignis) => {
    const datei = ereignis.target.files?.[0];
    if (!datei) return;
    if (datei.size > 200000) { $('watchlist-meldung').textContent = 'Die Datei ist zu groß.'; return; }
    watchlistSpeichern(await datei.text());
    ereignis.target.value = '';
  });
  $('watchlist-loeschen').addEventListener('click', () => {
    if (window.confirm('Die ganze Watchlist auf diesem Gerät löschen?')) watchlistSpeichern('');
  });
  $('watchlist-bearbeiten').open = watchlist.length === 0;
}

function reiterWechseln(ziel) {
  for (const name of ['ticker', 'wichtig', 'watchlist', 'kurse', 'zinsen', 'boersen', 'termine']) {
    const aktiv = name === ziel;
    $(`tab-${name}`).setAttribute('aria-selected', String(aktiv));
    $(`ansicht-${name}`).hidden = !aktiv;
  }
}

async function jsonHolen(pfad) {
  const antwort = await fetch(pfad, { cache: 'no-cache' });
  if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);
  return antwort.json();
}

// Stand des letzten Besuchs – bleibt während der Sitzung gleich, damit „neu“-Markierungen beim Nachladen nicht verschwinden.
const zuletztGesehen = Number(speicherLesen(SPEICHER_GESEHEN)) || 0;

async function laden() {

  let status = null;
  let daten = { meldungen: [] };
  try { status = await jsonHolen('data/status.json'); } catch { /* offline */ }
  try { daten = await jsonHolen('data/meldungen.json'); } catch { /* offline */ }
  try { kalender = await jsonHolen('data/kalender.json'); } catch { /* ohne Börsen/Termine weiter */ }
  try { maerkteAnzeigen(await jsonHolen('data/kurse.json')); } catch { /* ohne Diagramme weiter */ }
  try { zinsDaten = await jsonHolen('data/zinsen.json'); } catch { /* ohne Zinsen weiter */ }
  try { werteDaten = await jsonHolen('data/werte.json'); } catch { /* ohne Kurse für die Watchlist weiter */ }
  watchlistBegriffeBerechnen();

  if (status?.version) $('version').textContent = `Version ${status.version}`;
  letzterStatus = status;
  standAnzeigen(status);
  termineAnzeigen(new Date());
  kopfTicken();

  const meldungen = Array.isArray(daten.meldungen) ? daten.meldungen : [];
  letzteMeldungen = meldungen;
  watchlistAnzeigen();
  kurseWatchlistAnzeigen();
  zinsenAnzeigen();
  const ticker = $('liste-ticker');
  ticker.replaceChildren(...meldungen.map((m) => meldungElement(m, zuletztGesehen)));
  if (!meldungen.length) ticker.append(element('li', 'leer', 'Noch keine Meldungen geladen.'));

  const neu = zuletztGesehen ? meldungen.filter((m) => Date.parse(m.gefunden) > zuletztGesehen).length : 0;
  $('neu-hinweis').hidden = neu === 0;
  $('neu-hinweis').textContent = neu === 1 ? '1 neue Meldung seit deinem letzten Besuch' : `${neu} neue Meldungen seit deinem letzten Besuch`;
  $('zaehler-ticker').hidden = neu === 0;
  $('zaehler-ticker').textContent = String(neu);

  const schwelle = Number(status?.relevanzSchwelle) || 7;
  const wichtig = meldungen.filter((m) => Number(m.ki?.relevanz) >= schwelle && !m.ki.dublette);
  $('liste-wichtig').replaceChildren(...wichtig.map((m) => wichtigElement(m)));
  topNewsAnzeigen(wichtig);
  $('wichtig-leer').hidden = wichtig.length > 0;
  $('vorlesen-leiste').hidden = wichtig.length === 0;
  vorlesenListe = wichtig;
  vorlesenMarkieren();
  const wichtigNeu = zuletztGesehen ? wichtig.filter((m) => Date.parse(m.ki.bewertetAm) > zuletztGesehen).length : wichtig.length;
  $('zaehler-wichtig').hidden = wichtigNeu === 0;
  $('zaehler-wichtig').textContent = String(wichtigNeu);
  $('kopf-wichtig').hidden = wichtigNeu === 0;
  $('kopf-wichtig').textContent = wichtigNeu === 1 ? '★ 1 neue wichtige Meldung' : `★ ${wichtigNeu} neue wichtige Meldungen`;

  speicherSchreiben(SPEICHER_GESEHEN, String(Date.now()));
}

$('tab-ticker').addEventListener('click', () => reiterWechseln('ticker'));
$('tab-wichtig').addEventListener('click', () => reiterWechseln('wichtig'));
$('tab-watchlist').addEventListener('click', () => reiterWechseln('watchlist'));
$('tab-kurse').addEventListener('click', () => reiterWechseln('kurse'));
$('tab-boersen').addEventListener('click', () => reiterWechseln('boersen'));
$('tab-termine').addEventListener('click', () => reiterWechseln('termine'));
$('tab-zinsen').addEventListener('click', () => reiterWechseln('zinsen'));
zinsenEinrichten();
watchlistBearbeitenEinrichten();

// ---------- „Lies mir vor“ (Reiter Wichtig) ----------
// Kostenlos über die Sprachausgabe des Geräts (Web Speech API). Liest jede Meldung von oben nach unten:
// Überschrift, dann die Stichpunkte, dann die nächste. Jeder Satz ist eine eigene kurze Ansage –
// so bricht Chrome am PC lange Texte nicht ab, und Pause/Weiter klappt auch auf Android zuverlässig.
let vorlesenListe = [];
const vorlesen = { aktiv: false, pausiert: false, meldung: 0, satz: 0, lauf: 0, sperre: null };
const sprachausgabe = 'speechSynthesis' in window ? window.speechSynthesis : null;

function deutscheStimme() {
  const deutsch = (sprachausgabe?.getVoices() || []).filter((s) => /^de([-_]|$)/i.test(s.lang));
  return deutsch.find((s) => /^de[-_]DE$/i.test(s.lang) && /google|natural|online/i.test(s.name))
    || deutsch.find((s) => /^de[-_]DE$/i.test(s.lang))
    || deutsch[0] || null;
}

function saetzeVon(m, nummer, anzahl) {
  const { punkte, wenigInfo } = stichpunkte(m);
  const saetze = [`Meldung ${nummer} von ${anzahl}. ${anzeigeTitel(m)}.`];
  saetze.push(...(punkte.length ? punkte : ['Dazu gibt es noch keine Zusammenfassung.']));
  if (wenigInfo) saetze.push('Kurzmeldung, die Quelle enthält nur wenige Infos.');
  return saetze;
}

function vorlesenMarkieren() {
  for (const el of document.querySelectorAll('.vorlesen-aktiv')) el.classList.remove('vorlesen-aktiv');
  const m = vorlesen.aktiv && vorlesenListe[vorlesen.meldung];
  if (m) document.getElementById(`meldung-${m.id}`)?.classList.add('vorlesen-aktiv');
}

function vorlesenAnzeigen(text) {
  $('vorlesen-start').hidden = vorlesen.aktiv;
  $('vorlesen-pause').hidden = !vorlesen.aktiv;
  $('vorlesen-stopp').hidden = !vorlesen.aktiv;
  $('vorlesen-pause').textContent = vorlesen.pausiert ? 'Weiter' : 'Pause';
  $('vorlesen-status').textContent = vorlesen.aktiv
    ? `${vorlesen.pausiert ? 'Pausiert' : 'Liest vor'}: Meldung ${vorlesen.meldung + 1} von ${vorlesenListe.length}`
    : text || '';
}

// Hält den Bildschirm beim Vorlesen an (sonst stoppt Android die Sprachausgabe beim Sperren).
async function bildschirmWachHalten(an) {
  try {
    if (an && !vorlesen.sperre && navigator.wakeLock) vorlesen.sperre = await navigator.wakeLock.request('screen');
    if (!an && vorlesen.sperre) { await vorlesen.sperre.release(); vorlesen.sperre = null; }
  } catch { /* nicht unterstützt – Vorlesen klappt trotzdem */ }
}

function naechsterSatz() {
  if (!vorlesen.aktiv || vorlesen.pausiert) return;
  const m = vorlesenListe[vorlesen.meldung];
  if (!m) { vorlesenStoppen('Fertig – alle wichtigen Meldungen vorgelesen.'); return; }
  const saetze = saetzeVon(m, vorlesen.meldung + 1, vorlesenListe.length);
  if (vorlesen.satz >= saetze.length) {
    vorlesen.meldung++;
    vorlesen.satz = 0;
    naechsterSatz();
    return;
  }
  if (vorlesen.satz === 0) {
    vorlesenMarkieren();
    meldungOeffnen(m.id);
    vorlesenAnzeigen();
  }
  const ansage = new SpeechSynthesisUtterance(saetze[vorlesen.satz]);
  ansage.lang = 'de-DE';
  const stimme = deutscheStimme();
  if (stimme) ansage.voice = stimme;
  const lauf = vorlesen.lauf;
  // Abgebrochene Ansagen (Pause/Stopp) melden sich auch mit „end“/„error“ – die alte Runde wird ignoriert.
  ansage.onend = () => { if (lauf === vorlesen.lauf) { vorlesen.satz++; naechsterSatz(); } };
  ansage.onerror = (e) => {
    if (lauf !== vorlesen.lauf || e.error === 'interrupted' || e.error === 'canceled') return;
    vorlesenStoppen('Vorlesen nicht möglich – bitte Lautstärke und Sprachausgabe des Geräts prüfen.');
  };
  sprachausgabe.speak(ansage);
}

function vorlesenStarten() {
  if (!sprachausgabe || !vorlesenListe.length) return;
  sprachausgabe.cancel();
  Object.assign(vorlesen, { aktiv: true, pausiert: false, meldung: 0, satz: 0, lauf: vorlesen.lauf + 1 });
  bildschirmWachHalten(true);
  if (!deutscheStimme()) kurzerHinweis('Keine deutsche Stimme gefunden – es liest die Standardstimme. Windows 10: Einstellungen → Zeit und Sprache → Sprache → Deutsch → Optionen → Sprachausgabe.');
  naechsterSatz();
}

// Pause bricht die aktuelle Ansage ab; „Weiter“ wiederholt den angefangenen Stichpunkt.
function vorlesenPause() {
  if (!vorlesen.aktiv) return;
  vorlesen.pausiert = !vorlesen.pausiert;
  vorlesen.lauf++;
  sprachausgabe.cancel();
  vorlesenAnzeigen();
  naechsterSatz();
}

function vorlesenStoppen(text = '') {
  Object.assign(vorlesen, { aktiv: false, pausiert: false, lauf: vorlesen.lauf + 1 });
  sprachausgabe?.cancel();
  bildschirmWachHalten(false);
  vorlesenMarkieren();
  vorlesenAnzeigen(text);
}

function vorlesenEinrichten() {
  if (!sprachausgabe) {
    $('vorlesen-start').disabled = true;
    $('vorlesen-status').textContent = 'Dieser Browser kann nicht vorlesen.';
    return;
  }
  sprachausgabe.getVoices(); // Chrome lädt die Stimmen erst beim ersten Abruf
  $('vorlesen-start').addEventListener('click', vorlesenStarten);
  $('vorlesen-pause').addEventListener('click', vorlesenPause);
  $('vorlesen-stopp').addEventListener('click', () => vorlesenStoppen('Gestoppt.'));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && vorlesen.aktiv) bildschirmWachHalten(true);
  });
}


vorlesenEinrichten();

// ---------- Knopf „App-Link“ – nur auf dem Gerät des Besitzers ----------
// Einmal öffnen mit …/KI-Finanz-Radar/#besitzer=CODE schaltet den Knopf auf diesem Gerät frei.
// Im Code steht nur der SHA-256-Fingerabdruck des Codes, nie der Code selbst.
const BESITZER_FINGERABDRUCK = 'b16cdb91d6b15be91de8fbff6688ab716b346eda19956e0bdefcdd0fee792fd7';
const SPEICHER_BESITZER = 'radar.besitzer';

function kurzerHinweis(text) {
  const el = $('hinweis-kurz');
  el.textContent = text;
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 4000);
}

async function besitzerPruefen() {
  const treffer = location.hash.match(/^#besitzer=([A-Za-z0-9]{8,40})$/);
  if (treffer && crypto?.subtle) {
    const daten = new TextEncoder().encode(treffer[1]);
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', daten))].map((b) => b.toString(16).padStart(2, '0')).join('');
    history.replaceState(null, '', location.pathname + location.search);
    if (hash === BESITZER_FINGERABDRUCK) {
      speicherSchreiben(SPEICHER_BESITZER, '1');
      kurzerHinweis('✓ Knopf „App-Link“ ist auf diesem Gerät freigeschaltet.');
    }
  }
  $('link-kopieren').hidden = speicherLesen(SPEICHER_BESITZER) !== '1';
}

$('link-kopieren').addEventListener('click', async () => {
  const link = `${location.origin}${location.pathname}`;
  try {
    await navigator.clipboard.writeText(link);
    kurzerHinweis(`App-Link kopiert: ${link}`);
  } catch {
    kurzerHinweis(`App-Link: ${link}`);
  }
});
besitzerPruefen();
window.addEventListener('hashchange', besitzerPruefen);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* ohne Offline-Modus weiter */ });
}

kopfTicken();
setInterval(kopfTicken, 1000);
laden();
// Solange die App offen ist: alle 5 Minuten neue Daten holen, und sofort beim Zurückkehren zur App.
setInterval(laden, NEU_LADEN_MS);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') laden(); });
