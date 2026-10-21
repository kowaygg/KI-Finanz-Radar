// KI-Finanz-Radar – Oberfläche. Feed-Inhalte werden ausschließlich per textContent eingefügt (kein innerHTML).
import { kalenderwoche, boersenStatus, countdown, kurzerTag, terminText, wetterSymbol } from './zeit.js';
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
  watchlistBadge(meta, m);
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
  watchlistBadge(meta, m);
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

  // Marktstimmung für die Kopfzeile aus der Tagesveränderung.
  const tag = indizes.map((i) => ({ name: i.name, v: veraenderung(i.verlauf['1T'], i.vortag, '1T') })).filter((t) => t.v);
  $('zeile-stimmung').hidden = tag.length === 0;
  if (tag.length) {
    const hoch = tag.filter((t) => t.v.pct > 0).length;
    const gesamt = hoch === tag.length ? '▲ freundlich' : hoch === 0 ? '▼ schwach' : '◆ gemischt';
    const klasse = hoch === tag.length ? 'positiv' : hoch === 0 ? 'negativ' : 'neutral';
    const dd = $('stimmung');
    dd.replaceChildren(element('strong', `stimmung-${klasse}`, gesamt), ` · ${tag.map((t) => `${t.name} ${t.v.text}`).join(' · ')}`);
  }
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

  // Kopfzeile „Watchlist heute“
  const dd = $('watchlist-heute');
  if (!watchlist.length) {
    dd.className = 'leise';
    dd.textContent = 'noch leer – im Reiter „Watchlist“ anlegen';
    return;
  }
  dd.className = '';
  const hoch = mitKurs.filter((x) => x.w.pct > 0).length;
  const runter = mitKurs.filter((x) => x.w.pct < 0).length;
  dd.replaceChildren(`${watchlist.length} Werte · `, element('span', 'stimmung-positiv', `▲ ${hoch}`), ' · ', element('span', 'stimmung-negativ', `▼ ${runter}`));
  for (const x of stark) dd.append(' · ', element('strong', 'wl-warnung', `⚠ ${x.e.name} ${pctFormat.format(x.w.pct)} %`));
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
  for (const name of ['ticker', 'wichtig', 'watchlist', 'kurse', 'boersen']) {
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
  try { werteDaten = await jsonHolen('data/werte.json'); } catch { /* ohne Kurse für die Watchlist weiter */ }
  watchlistBegriffeBerechnen();

  if (status?.version) $('version').textContent = `Version ${status.version}`;
  letzterStatus = status;
  standAnzeigen(status);
  wetterAnzeigen(status?.wetter || null);
  kopfTicken();

  const meldungen = Array.isArray(daten.meldungen) ? daten.meldungen : [];
  letzteMeldungen = meldungen;
  topNewsAnzeigen(meldungen);
  watchlistAnzeigen();
  kurseWatchlistAnzeigen();
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
$('tab-watchlist').addEventListener('click', () => reiterWechseln('watchlist'));
$('tab-kurse').addEventListener('click', () => reiterWechseln('kurse'));
$('tab-boersen').addEventListener('click', () => reiterWechseln('boersen'));
watchlistBearbeitenEinrichten();

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
