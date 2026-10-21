// KI-Finanz-Radar – Oberfläche. Feed-Inhalte werden ausschließlich per textContent eingefügt (kein innerHTML).
'use strict';

const ZEITZONE = 'Europe/Berlin';
const ALARM_NACH_MS = 3 * 60 * 60 * 1000;
const SPEICHER_GESEHEN = 'radar.zuletztGesehen';

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

  const link = sichererLink(m.link);
  const titel = element(link ? 'a' : 'span', 'titel', m.titel);
  if (link) {
    titel.href = link;
    titel.target = '_blank';
    titel.rel = 'noopener noreferrer';
  }
  li.append(titel);

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

  const link = sichererLink(m.link);
  const titel = element(link ? 'a' : 'span', 'titel', analyse?.titel || m.titel);
  if (link) {
    titel.href = link;
    titel.target = '_blank';
    titel.rel = 'noopener noreferrer';
  }
  li.append(titel);
  if (analyse?.titel && analyse.titel !== m.titel) li.append(element('div', 'original', `Original: ${m.titel}`));

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
  box.append(element('div', 'einschaetzung-titel', `KI-Einschätzung · ${analyse.einschaetzung.zeithorizont} · Sicherheit: ${analyse.einschaetzung.sicherheit}`));
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

async function laden() {
  $('datum').textContent = fmtLang.format(new Date());
  const zuletztGesehen = Number(speicherLesen(SPEICHER_GESEHEN)) || 0;

  let status = null;
  let daten = { meldungen: [] };
  try { status = await jsonHolen('data/status.json'); } catch { /* offline */ }
  try { daten = await jsonHolen('data/meldungen.json'); } catch { /* offline */ }

  if (status?.version) $('version').textContent = `Version ${status.version}`;
  standAnzeigen(status);

  const meldungen = Array.isArray(daten.meldungen) ? daten.meldungen : [];
  const ticker = $('liste-ticker');
  ticker.replaceChildren(...meldungen.map((m) => meldungElement(m, zuletztGesehen)));
  if (!meldungen.length) ticker.append(element('li', 'leer', 'Noch keine Meldungen geladen.'));

  const neu = zuletztGesehen ? meldungen.filter((m) => Date.parse(m.gefunden) > zuletztGesehen).length : 0;
  $('neu-hinweis').hidden = neu === 0;
  $('neu-hinweis').textContent = neu === 1 ? '1 neue Meldung seit deinem letzten Besuch' : `${neu} neue Meldungen seit deinem letzten Besuch`;
  $('zaehler-ticker').hidden = neu === 0;
  $('zaehler-ticker').textContent = String(neu);

  const schwelle = Number(status?.relevanzSchwelle) || 7;
  const wichtig = meldungen.filter((m) => Number(m.ki?.relevanz) >= schwelle);
  $('liste-wichtig').replaceChildren(...wichtig.map((m) => wichtigElement(m)));
  $('wichtig-leer').hidden = wichtig.length > 0;
  const wichtigNeu = zuletztGesehen ? wichtig.filter((m) => Date.parse(m.ki.bewertetAm) > zuletztGesehen).length : wichtig.length;
  $('zaehler-wichtig').hidden = wichtigNeu === 0;
  $('zaehler-wichtig').textContent = String(wichtigNeu);

  speicherSchreiben(SPEICHER_GESEHEN, String(Date.now()));
}

$('tab-ticker').addEventListener('click', () => reiterWechseln('ticker'));
$('tab-wichtig').addEventListener('click', () => reiterWechseln('wichtig'));

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* ohne Offline-Modus weiter */ });
}

laden();
