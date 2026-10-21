// KI-Finanz-Radar – Oberfläche. Feed-Inhalte werden ausschließlich per textContent eingefügt (kein innerHTML).
import { kalenderwoche, boersenStatus, countdown, kurzerTag, terminText, wetterSymbol } from './zeit.js';

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

function originalZeile(m) {
  if (m.sprache !== 'en' || anzeigeTitel(m) === m.titel) return null;
  const zeile = element('div', 'original', `Original: ${m.titel} · `);
  const link = sichererLink(m.link);
  if (link) {
    const a = element('a', null, 'Originalseite (Englisch)');
    a.href = link;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    zeile.append(a);
  }
  return zeile;
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

function meldungElement(m, zuletztGesehen) {
  const li = element('li', 'meldung');
  if (zuletztGesehen && Date.parse(m.gefunden) > zuletztGesehen) li.classList.add('neu');

  const meta = element('div', 'meta');
  const zeit = element('time', 'zeit', zeitText(m.datum));
  zeit.dateTime = m.datum;
  meta.append(zeit, element('span', null, m.quelle), element('span', 'badge', m.kategorie));
  li.append(meta);
  li.append(titelLink(m, anzeigeTitel(m)));

  const weitere = (m.quellen || []).filter((q) => q.name !== m.quelle && sichererLink(q.link));
  if (weitere.length) {
    const zeile = element('div', 'weitere', 'Auch bei: ');
    weitere.forEach((q, i) => {
      const a = element('a', null, q.name);
      a.href = sichererLink(q.link);
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      zeile.append(a);
      if (i < weitere.length - 1) zeile.append(', ');
    });
    li.append(zeile);
  }
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

// Ausführliche Darstellung im Reiter „Wichtig“.
function wichtigElement(m) {
  const ki = m.ki;
  const analyse = ki.analyse;
  const li = element('li', 'meldung karte');

  const meta = element('div', 'meta');
  const zeit = element('time', 'zeit', zeitText(m.datum));
  zeit.dateTime = m.datum;
  meta.append(
    zeit,
    element('span', null, m.quelle),
    element('span', 'badge', m.kategorie),
    element('span', 'badge relevanz', `Relevanz ${ki.relevanz}/10`),
    element('span', `stimmung stimmung-${ki.stimmung}`, STIMMUNG[ki.stimmung] || ''),
  );
  li.append(meta);
  li.append(titelLink(m, anzeigeTitel(m)));
  const original = originalZeile(m);
  if (original) li.append(original);

  const schlag = chips('Themen', ki.schlagwoerter);
  if (schlag) li.append(schlag);

  if (!analyse) {
    li.append(element('p', 'hinweis', 'Ausführliche Analyse folgt beim nächsten Abruf.'));
    return li;
  }

  const punkte = element('ul', 'punkte');
  for (const p of analyse.zusammenfassung) punkte.append(element('li', null, p));
  li.append(punkte);

  for (const [name, werte] of [['Aktien', analyse.betroffen?.aktien], ['ETFs', analyse.betroffen?.etfs], ['Branchen', analyse.betroffen?.branchen]]) {
    const z = chips(name, werte);
    if (z) li.append(z);
  }

  const box = element('div', 'einschaetzung');
  const horizont = { kurzfristig: 'kurzfristig', langfristig: 'langfristig', beides: 'kurz- und langfristig' }[analyse.einschaetzung.zeithorizont] || '';
  box.append(element('div', 'einschaetzung-titel', `KI-Einschätzung · Zeithorizont: ${horizont} · Sicherheit: ${analyse.einschaetzung.sicherheit}`));
  box.append(element('p', null, analyse.einschaetzung.text));
  if (analyse.vergleich) box.append(element('p', 'vergleich', `Historischer Vergleich: ${analyse.vergleich}`));
  box.append(element('div', 'modell', `Analysiert von ${analyse.dienst} (${analyse.modell}) · keine Anlageberatung`));
  li.append(box);

  const weitere = (m.quellen || []).filter((q) => q.name !== m.quelle && sichererLink(q.link));
  if (weitere.length) li.append(element('div', 'weitere', `Auch bei: ${weitere.map((q) => q.name).join(', ')}`));
  return li;
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
  const alt = alterMs > ALARM_NACH_MS;
  stand.classList.toggle('alt', alt);
  warnung.hidden = !alt;
  if (alt) warnung.textContent = '⚠ Der automatische Abruf lief seit über 3 Stunden nicht. Die Meldungen sind nicht aktuell.';
  const gestoert = (status.quellen || []).filter((q) => !q.ok);
  if (gestoert.length) stand.title = `Gestörte Quellen: ${gestoert.map((q) => q.name).join(', ')}`;
}

// ---------- Kopfzeile ----------
const fmtUhrSek = new Intl.DateTimeFormat('de-DE', { timeZone: ZEITZONE, hour: '2-digit', minute: '2-digit', second: '2-digit' });
let kalender = { boersen: [], termine: [] };
let letzterStatus = null;

function boersenText(boerse, jetzt) {
  const s = boersenStatus(boerse, jetzt);
  const zeile = element('span', `boerse ${s.offen ? 'boerse-offen' : 'boerse-zu'}`);
  zeile.append(element('strong', null, boerse.name), ' ');
  zeile.append(element('span', 'punkt', s.offen ? '● offen' : '○ geschlossen'));
  if (s.offen) {
    zeile.append(` · schließt in ${countdown(s.schliesst - jetzt)}${s.fruehschluss ? ' (Frühschluss)' : ''}`);
  } else if (s.oeffnet) {
    const rest = s.oeffnet - jetzt;
    const uhr = new Intl.DateTimeFormat('de-DE', { timeZone: ZEITZONE, hour: '2-digit', minute: '2-digit' }).format(s.oeffnet);
    zeile.append(rest < 24 * 3600 * 1000 ? ` · öffnet in ${countdown(rest)}` : ` · öffnet ${kurzerTag(s.oeffnet)} ${uhr}`);
    if (s.feiertag) zeile.append(' (Feiertag)');
  }
  return zeile;
}

function kopfTicken() {
  const jetzt = new Date();
  $('datum').textContent = fmtLang.format(jetzt);
  $('kw').textContent = `KW ${kalenderwoche(jetzt, ZEITZONE)}`;
  $('uhr').textContent = fmtUhrSek.format(jetzt);
  // Nach Land gruppiert: „Deutschland: Xetra … · Börse Frankfurt …“, „USA: NYSE … · Nasdaq …“
  const laender = [...new Set(kalender.boersen.map((b) => b.land || ''))];
  $('boersen').replaceChildren(...laender.map((land) => {
    const zeile = element('div', 'boersen-land');
    zeile.append(element('span', 'land', land ? `${land}:` : ''));
    const liste = element('span', 'boersen-liste');
    liste.append(...kalender.boersen.filter((b) => (b.land || '') === land).map((b) => boersenText(b, jetzt)));
    zeile.append(liste);
    return zeile;
  }));
  if (letzterStatus && jetzt.getSeconds() === 0) standAnzeigen(letzterStatus);
  // Termine, die vorbei sind, fallen von selbst weg.
  const naechster = kalender.termine.find((t) => Date.parse(t.zeit) > jetzt.getTime());
  $('zeile-termin').hidden = !naechster;
  if (naechster) $('termin').textContent = `${terminText(new Date(naechster.zeit), jetzt)} ${naechster.titel}`;
}

function wetterAnzeigen(wetter) {
  $('zeile-wetter').hidden = !wetter;
  if (!wetter) return;
  const [symbol, text] = wetterSymbol(wetter.code, wetter.tag);
  const hochTief = wetter.hoch !== null && wetter.tief !== null ? ` (↑ ${wetter.hoch}° / ↓ ${wetter.tief}°)` : '';
  $('wetter').textContent = `${symbol} ${wetter.temperatur} °C ${text}${hochTief} · ${wetter.ort}`;
}

// Auf dem PC alles offen, auf dem Handy nur das Wichtigste (Rest per Antippen).
function kopfAufklappen() {
  $('kopf-mehr').open = window.matchMedia('(min-width: 700px)').matches;
}

// Die 3 wichtigsten Meldungen der letzten 24 Stunden (höchste KI-Relevanz, bei Gleichstand die neueste).
function topNewsAnzeigen(meldungen) {
  const grenze = Date.now() - 24 * 3600 * 1000;
  const top = meldungen
    .filter((m) => Number.isInteger(m.ki?.relevanz) && !m.ki.dublette && Date.parse(m.datum) >= grenze)
    .sort((a, b) => b.ki.relevanz - a.ki.relevanz || Date.parse(b.datum) - Date.parse(a.datum))
    .slice(0, 3);
  $('top-news').hidden = top.length === 0;
  $('top-liste').replaceChildren(...top.map((m) => {
    const li = element('li', 'top-eintrag');
    li.append(titelLink(m, anzeigeTitel(m)));
    const meta = element('div', 'top-meta');
    meta.append(element('span', 'top-relevanz', `Relevanz ${m.ki.relevanz}/10`), ` · ${zeitText(m.datum)} · ${m.quelle}`);
    if (STIMMUNG[m.ki.stimmung]) meta.append(' · ', element('span', `stimmung stimmung-${m.ki.stimmung}`, STIMMUNG[m.ki.stimmung]));
    li.append(meta);
    return li;
  }));
}

function reiterWechseln(ziel) {
  for (const name of ['ticker', 'wichtig']) {
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

  if (status?.version) $('version').textContent = `Version ${status.version}`;
  letzterStatus = status;
  standAnzeigen(status);
  wetterAnzeigen(status?.wetter || null);
  kopfTicken();

  const meldungen = Array.isArray(daten.meldungen) ? daten.meldungen : [];
  topNewsAnzeigen(meldungen);
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
  $('wichtig-leer').hidden = wichtig.length > 0;
  const wichtigNeu = zuletztGesehen ? wichtig.filter((m) => Date.parse(m.ki.bewertetAm) > zuletztGesehen).length : wichtig.length;
  $('zaehler-wichtig').hidden = wichtigNeu === 0;
  $('zaehler-wichtig').textContent = String(wichtigNeu);
  $('kopf-wichtig').hidden = wichtigNeu === 0;
  $('kopf-wichtig').textContent = wichtigNeu === 1 ? '★ 1 neue wichtige Meldung' : `★ ${wichtigNeu} neue wichtige Meldungen`;

  speicherSchreiben(SPEICHER_GESEHEN, String(Date.now()));
}

$('tab-ticker').addEventListener('click', () => reiterWechseln('ticker'));
$('tab-wichtig').addEventListener('click', () => reiterWechseln('wichtig'));

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* ohne Offline-Modus weiter */ });
}

kopfAufklappen();
kopfTicken();
setInterval(kopfTicken, 1000);
laden();
// Solange die App offen ist: alle 5 Minuten neue Daten holen, und sofort beim Zurückkehren zur App.
setInterval(laden, NEU_LADEN_MS);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') laden(); });
