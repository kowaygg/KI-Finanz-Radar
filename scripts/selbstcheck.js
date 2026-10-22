// Wöchentlicher Selbstcheck (sonntags per GitHub Actions, auch lokal: node scripts/selbstcheck.js).
// Prüft und berichtet NUR – ändert nie Code oder Einstellungen. Einzige Aktion: geplante Abläufe aktiv halten
// (GitHub schaltet sie in öffentlichen Repos nach 60 Tagen ohne Aktivität ab).
// Ergebnis: Ampel-Bericht in einfachem Deutsch (Actions-Zusammenfassung) + Push über ntfy.

import { readFile, appendFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { feedLesen } from '../src/feed-parser.js';
import { ketteErstellen } from '../src/ki/kette.js';
import { pushSenden } from '../src/push.js';
import { SYMBOL, gesamtAmpel, quellenAmpel, abrufAmpel, repoAmpel, kontingentAmpel } from '../src/ampel.js';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
try { process.loadEnvFile(join(WURZEL, '.env')); } catch { /* keine .env */ }
const json = async (pfad) => JSON.parse(await readFile(join(WURZEL, pfad), 'utf8'));

const einstellungen = await json('config/einstellungen.json');
const ki = await json('config/ki.json');
const push = await json('config/push.json');
const kursEinstellungen = await json('config/kurse.json');
const { quellen } = await json('quellen.json');
const REPO = process.env.GITHUB_REPOSITORY || 'kowaygg/KI-Finanz-Radar';
const TOKEN = process.env.GITHUB_TOKEN; // nur online vorhanden
const jetzt = new Date();

async function holen(url, optionen = {}) {
  return fetch(url, { ...optionen, headers: { 'User-Agent': einstellungen.userAgent, ...optionen.headers }, signal: AbortSignal.timeout(25000) });
}

async function github(pfad, optionen = {}) {
  const kopf = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (TOKEN) kopf.Authorization = `Bearer ${TOKEN}`;
  return holen(`https://api.github.com/repos/${REPO}${pfad}`, { ...optionen, headers: kopf });
}

async function quellenPruefen() {
  const ergebnisse = [];
  for (const q of quellen.filter((x) => x.aktiv !== false)) {
    try {
      const antwort = await holen(q.url);
      const anzahl = antwort.ok ? feedLesen(await antwort.text()).length : 0;
      ergebnisse.push({ name: q.name, ok: anzahl > 0, fehler: antwort.ok ? 'keine Meldungen erkannt' : `HTTP ${antwort.status}` });
    } catch (fehler) {
      ergebnisse.push({ name: q.name, ok: false, fehler: fehler.name === 'TimeoutError' ? 'Zeitüberschreitung' : fehler.message });
    }
  }
  return quellenAmpel(ergebnisse);
}

async function kursePruefen(status) {
  let haupt = false;
  try {
    const antwort = await holen(`${kursEinstellungen.quelle.adresse}${encodeURIComponent(kursEinstellungen.indizes[0].symbol)}?range=1d&interval=1h`);
    haupt = antwort.ok && Number.isFinite((await antwort.json())?.chart?.result?.[0]?.meta?.regularMarketPrice);
  } catch { /* Hauptquelle gestört */ }
  let werteText = '';
  try {
    const werte = await (await holen(`${push.appAdresse}data/werte.json?t=${Date.now()}`)).json();
    const liste = Object.values(werte.werte || {});
    werteText = `, Werteliste online: ${liste.filter((w) => Number.isFinite(w.kurs)).length} von ${liste.length} mit Kurs`;
  } catch { /* ohne Zusatzinfo */ }
  const ausweich = kursEinstellungen.ausweichQuelle;
  return {
    bereich: 'Kurse',
    ampel: !haupt ? 'rot' : ausweich ? 'gruen' : 'gelb',
    text: `Hauptquelle (Yahoo) ${haupt ? 'liefert Kurse' : 'GESTÖRT – App zeigt letzte bekannte Kurse'}${werteText}${ausweich ? '' : '; noch keine Ausweich-Kursquelle eingerichtet'}`,
    anleitung: !haupt ? 'Kursquelle gestört: Claude Code fragen (Ausweichquelle einbauen bzw. Adresse prüfen).' : ausweich ? '' : 'Ausweich-Kursquelle ist noch offen (Meilenstein 4).',
  };
}

async function kiPruefen() {
  const zeilen = [];
  let antworten = 0;
  let eingerichtet = 0;
  let probleme = 0;
  for (const dienst of ki.kette) {
    const schluessel = process.env[dienst.schluesselVariable];
    if (!schluessel) { zeilen.push(`${dienst.name}: nicht eingerichtet`); continue; }
    eingerichtet++;
    const kette = ketteErstellen({ ...ki, kette: [dienst] });
    const test = await kette.fragen('Antworte nur mit JSON.', 'Gib {"ok":true} zurück.');
    const fehlend = [...new Set(kette.protokoll.filter((p) => /404/.test(p.grund || '')).map((p) => p.modell))];
    if (test) antworten++;
    if (!test || fehlend.length) probleme++;
    const grund = test ? '' : ` – ${kette.protokoll.map((p) => p.grund).filter(Boolean).slice(0, 2).join('; ') || 'keine Antwort'}`;
    zeilen.push(`${dienst.name}: ${test ? `antwortet (${test.modell})` : 'antwortet NICHT'}${fehlend.length ? `, abgeschaltet: ${fehlend.join(', ')}` : ''}${grund}`);
  }
  const ampel = antworten === 0 ? 'rot' : probleme ? 'gelb' : 'gruen';
  return {
    bereich: 'KI-Dienste',
    ampel,
    text: zeilen.join(' · '),
    anleitung: ampel === 'gruen' ? '' : 'Modell abgeschaltet oder Schlüssel ungültig: Claude Code fragen (config/ki.json anpassen bzw. Schlüssel in GitHub Secrets erneuern).',
  };
}

async function sicherheitPruefen() {
  const teile = [];
  let ampel = 'gruen';
  let pruefbar = false;
  for (const [name, pfad] of [['Dependabot-Warnungen', '/dependabot/alerts?state=open&per_page=100'], ['Geheimnis-Warnungen', '/secret-scanning/alerts?state=open&per_page=100']]) {
    try {
      const antwort = await github(pfad);
      if (!antwort.ok) { teile.push(`${name}: nicht abrufbar (HTTP ${antwort.status})`); continue; }
      pruefbar = true;
      const anzahl = (await antwort.json()).length;
      teile.push(`${name}: ${anzahl}`);
      if (anzahl) ampel = 'rot';
    } catch { teile.push(`${name}: nicht abrufbar`); }
  }
  try {
    const prs = await (await github('/pulls?state=open&per_page=100')).json();
    const updates = prs.filter((p) => p.user?.login === 'dependabot[bot]').length;
    teile.push(`offene Update-Vorschläge: ${updates}`);
    pruefbar = true;
    if (updates && ampel === 'gruen') ampel = 'gelb';
  } catch { teile.push('Update-Vorschläge: nicht abrufbar'); }
  return {
    bereich: 'Sicherheit',
    ampel: pruefbar ? ampel : 'grau',
    text: teile.join(', '),
    anleitung: ampel === 'rot' ? `Sicherheitswarnung offen: https://github.com/${REPO}/security – Claude Code bei der Wartung zeigen.`
      : ampel === 'gelb' ? 'Update-Vorschläge bei der Monatswartung prüfen und übernehmen lassen.' : '',
  };
}

async function abrufPruefen(status) {
  const seit = new Date(jetzt.getTime() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const laeufe = [];
  for (let seite = 1; seite <= 7; seite++) {
    const antwort = await github(`/actions/workflows/abruf.yml/runs?per_page=100&page=${seite}&created=%3E%3D${seit}`);
    if (!antwort.ok) break;
    const daten = await antwort.json();
    laeufe.push(...(daten.workflow_runs || []));
    if ((daten.workflow_runs || []).length < 100) break;
  }
  return abrufAmpel(laeufe, status?.letzterAbruf, jetzt);
}

async function repoPruefen() {
  const repo = await (await github('')).json();
  let cache;
  try {
    const antwort = await github('/actions/cache/usage');
    if (antwort.ok) cache = (await antwort.json()).active_caches_size_in_bytes;
  } catch { /* nur mit Token */ }
  return repoAmpel(Number(repo.size) || 0, cache);
}

// Gegen die 60-Tage-Abschaltung: alle geplanten Abläufe ausdrücklich (wieder) einschalten.
async function aktivHalten() {
  if (!TOKEN) return { bereich: 'Geplante Abläufe', ampel: 'grau', text: 'nur online prüfbar (lokaler Test)', anleitung: '' };
  const ergebnisse = [];
  for (const datei of ['abruf.yml', 'waechter.yml', 'selbstcheck.yml']) {
    const antwort = await github(`/actions/workflows/${datei}/enable`, { method: 'PUT' });
    ergebnisse.push(`${datei.replace('.yml', '')} ${antwort.ok ? '✓' : `✗ (HTTP ${antwort.status})`}`);
  }
  const fehler = ergebnisse.some((e) => e.includes('✗'));
  return {
    bereich: 'Geplante Abläufe',
    ampel: fehler ? 'gelb' : 'gruen',
    text: `aktiv gehalten: ${ergebnisse.join(', ')}`,
    anleitung: fehler ? 'Im Repo unter „Actions“ prüfen, ob „Abruf“ eingeschaltet ist (sonst „Enable workflow“ klicken).' : '',
  };
}

async function sicher(name, pruefung) {
  try { return await pruefung(); } catch (fehler) { return { bereich: name, ampel: 'gelb', text: `Prüfung fehlgeschlagen: ${fehler.message}`, anleitung: '' }; }
}

let status = null;
try { status = await (await holen(`${push.statusAdresse}?t=${Date.now()}`)).json(); } catch { /* App nicht erreichbar */ }

const bereiche = [
  await sicher('Abruf', () => abrufPruefen(status)),
  await sicher('Quellen', quellenPruefen),
  await sicher('Kurse', () => kursePruefen(status)),
  await sicher('KI-Dienste', kiPruefen),
  kontingentAmpel(status?.ki),
  await sicher('Sicherheit', sicherheitPruefen),
  await sicher('Repo-Größe', repoPruefen),
  await sicher('Geplante Abläufe', aktivHalten),
];
const gesamt = gesamtAmpel(bereiche);
const datum = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'full', timeStyle: 'short' }).format(jetzt);
const kopf = gesamt === 'gruen' ? 'Wartung durchgeführt – alles okay' : gesamt === 'gelb' ? 'Wartung durchgeführt – kleine Punkte für die Monatswartung' : 'Handlung nötig';

const bericht = [
  `# ${SYMBOL[gesamt]} Selbstcheck KI-Finanz-Radar: ${kopf}`,
  `${datum} · Version ${status?.version ?? '?'}`,
  '',
  '| Bereich | Ampel | Ergebnis |',
  '|---|---|---|',
  ...bereiche.map((b) => `| ${b.bereich} | ${SYMBOL[b.ampel]} | ${b.text.replace(/\|/g, '/')} |`),
  '',
  ...bereiche.filter((b) => b.anleitung && b.ampel !== 'gruen').map((b) => `- **${b.bereich}:** ${b.anleitung}`),
].join('\n');
console.log(bericht);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${bericht}\n`);

const auffaellig = bereiche.filter((b) => b.ampel === 'rot' || b.ampel === 'gelb');
await pushSenden({
  title: `${SYMBOL[gesamt]} ${kopf}`,
  message: auffaellig.length
    ? auffaellig.map((b) => `${SYMBOL[b.ampel]} ${b.bereich}: ${b.anleitung || b.text}`).join('\n').slice(0, 3000)
    : 'Quellen, Kurse, KI-Dienste, Kontingent, Sicherheit, Abruf und Repo sind in Ordnung.',
  priority: gesamt === 'rot' ? 4 : 3,
  tags: ['wrench'],
  click: `https://github.com/${REPO}/actions/workflows/selbstcheck.yml`,
}, { server: push.server, kanal: process.env[push.kanalVariable] });
