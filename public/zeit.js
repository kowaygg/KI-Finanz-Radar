// Zeit-Hilfen für die Kopfzeile: Kalenderwoche, Börsenstatus mit Feiertagen, Countdown, Wettersymbol.
// Reine Funktionen ohne Seiteneffekte (werden auch automatisch getestet).

const WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

// Uhrzeit und Datum, wie sie in einer Zeitzone gerade an der Wand stehen.
export function wandzeit(datum, zeitzone) {
  const teile = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: zeitzone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short',
    }).formatToParts(datum).map((t) => [t.type, t.value]),
  );
  return {
    jahr: Number(teile.year), monat: Number(teile.month), tag: Number(teile.day),
    stunde: Number(teile.hour), minute: Number(teile.minute), sekunde: Number(teile.second),
    wochentag: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(teile.weekday),
    datum: `${teile.year}-${teile.month}-${teile.day}`,
  };
}

// ISO-Kalenderwoche (Woche mit Montag als erstem Tag, KW 1 enthält den ersten Donnerstag).
export function kalenderwoche(datum, zeitzone = 'Europe/Berlin') {
  const w = wandzeit(datum, zeitzone);
  const tag = new Date(Date.UTC(w.jahr, w.monat - 1, w.tag));
  const wochentag = tag.getUTCDay() || 7;
  tag.setUTCDate(tag.getUTCDate() + 4 - wochentag);
  const jahresanfang = new Date(Date.UTC(tag.getUTCFullYear(), 0, 1));
  return Math.ceil(((tag - jahresanfang) / 86400000 + 1) / 7);
}

// Wandelt „Datum + Uhrzeit in Zeitzone X“ in einen echten Zeitpunkt um (Sommer-/Winterzeit inklusive).
export function zeitpunktInZone(datumText, uhrzeit, zeitzone) {
  const [j, m, t] = datumText.split('-').map(Number);
  const [h, min] = uhrzeit.split(':').map(Number);
  const geschaetzt = Date.UTC(j, m - 1, t, h, min);
  let ergebnis = geschaetzt;
  for (let i = 0; i < 2; i++) {
    const w = wandzeit(new Date(ergebnis), zeitzone);
    const abweichung = Date.UTC(w.jahr, w.monat - 1, w.tag, w.stunde, w.minute) - geschaetzt;
    ergebnis -= abweichung;
  }
  return new Date(ergebnis);
}

function tagPlus(datumText, tage) {
  const [j, m, t] = datumText.split('-').map(Number);
  const d = new Date(Date.UTC(j, m - 1, t + tage));
  return d.toISOString().slice(0, 10);
}

function handelstag(boerse, datumText) {
  const [j, m, t] = datumText.split('-').map(Number);
  const wochentag = new Date(Date.UTC(j, m - 1, t)).getUTCDay();
  return wochentag !== 0 && wochentag !== 6 && !(boerse.feiertage || []).includes(datumText);
}

// Ergebnis: { offen: true, schliesst: Date, mittagspause? } oder { offen: false, oeffnet: Date, mittagspause?, feiertag? }
// Börsen mit Mittagspause (z. B. Tokio, Shanghai, Hongkong) haben 'pause': { "von": "11:30", "bis": "12:30" }.
export function boersenStatus(boerse, jetzt = new Date()) {
  const heute = wandzeit(jetzt, boerse.zeitzone).datum;
  if (handelstag(boerse, heute)) {
    const z = (uhr) => zeitpunktInZone(heute, uhr, boerse.zeitzone);
    const auf = z(boerse.oeffnung);
    const zu = z(boerse.fruehschluss?.[heute] || boerse.schluss);
    const fruehschluss = Boolean(boerse.fruehschluss?.[heute]);
    const pauseVon = boerse.pause ? z(boerse.pause.von) : null;
    const pauseBis = boerse.pause ? z(boerse.pause.bis) : null;
    const mitPause = pauseVon && pauseBis && zu > pauseVon;
    if (jetzt < auf) return { offen: false, oeffnet: auf };
    if (mitPause && jetzt < pauseVon) return { offen: true, schliesst: pauseVon, mittagspause: true };
    if (mitPause && jetzt < pauseBis && zu > pauseBis) return { offen: false, oeffnet: pauseBis, mittagspause: true };
    if (jetzt < zu) return { offen: true, schliesst: zu, fruehschluss };
  }
  for (let i = 1; i <= 10; i++) {
    const tag = tagPlus(heute, i);
    if (handelstag(boerse, tag)) {
      return { offen: false, oeffnet: zeitpunktInZone(tag, boerse.oeffnung, boerse.zeitzone), feiertag: (boerse.feiertage || []).includes(heute) };
    }
  }
  return { offen: false, oeffnet: null };
}

export function countdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const zwei = (n) => String(n).padStart(2, '0');
  return `${h}:${zwei(Math.floor((s % 3600) / 60))}:${zwei(s % 60)}`;
}

export function kurzerTag(datum, zeitzone = 'Europe/Berlin') {
  return WOCHENTAGE[wandzeit(datum, zeitzone).wochentag];
}

// Text wie „Morgen 14:15“, „Heute 20:00“ oder „Do 29.10. 14:15“ (deutsche Zeit).
export function terminText(zeitpunkt, jetzt = new Date(), zeitzone = 'Europe/Berlin') {
  const z = wandzeit(zeitpunkt, zeitzone);
  const h = wandzeit(jetzt, zeitzone);
  const uhr = `${String(z.stunde).padStart(2, '0')}:${String(z.minute).padStart(2, '0')}`;
  if (z.datum === h.datum) return `Heute ${uhr}`;
  if (z.datum === tagPlus(h.datum, 1)) return `Morgen ${uhr}`;
  return `${WOCHENTAGE[z.wochentag]} ${String(z.tag).padStart(2, '0')}.${String(z.monat).padStart(2, '0')}. ${uhr}`;
}

// WMO-Wettercodes (Open-Meteo) → Symbol und Text.
export function wetterSymbol(code, tag = true) {
  if (code === 0) return [tag ? '☀️' : '🌙', 'klar'];
  if (code <= 2) return [tag ? '🌤️' : '☁️', 'leicht bewölkt'];
  if (code === 3) return ['☁️', 'bedeckt'];
  if (code <= 48) return ['🌫️', 'Nebel'];
  if (code <= 57) return ['🌦️', 'Nieselregen'];
  if (code <= 67) return ['🌧️', 'Regen'];
  if (code <= 77) return ['🌨️', 'Schnee'];
  if (code <= 82) return ['🌧️', 'Regenschauer'];
  if (code <= 86) return ['🌨️', 'Schneeschauer'];
  if (code <= 99) return ['⛈️', 'Gewitter'];
  return ['🌡️', ''];
}
