// Ampel-Logik für den wöchentlichen Selbstcheck (reine Funktionen, getestet).
// grün = alles ok · gelb = beobachten / bei der Monatswartung erledigen · rot = Handlung nötig · grau = nicht prüfbar (zählt nicht)

const RANG = { gruen: 0, grau: 0, gelb: 1, rot: 2 };
export const SYMBOL = { gruen: '🟢', gelb: '🟡', rot: '🔴', grau: '⚪' };

export function gesamtAmpel(bereiche) {
  return bereiche.reduce((schlimmste, b) => (RANG[b.ampel] > RANG[schlimmste] ? b.ampel : schlimmste), 'gruen');
}

export function quellenAmpel(ergebnisse) {
  const kaputt = ergebnisse.filter((e) => !e.ok);
  const ampel = kaputt.length === 0 ? 'gruen' : kaputt.length * 4 > ergebnisse.length ? 'rot' : 'gelb';
  return {
    bereich: 'Quellen',
    ampel,
    text: `${ergebnisse.length - kaputt.length} von ${ergebnisse.length} Quellen liefern Meldungen${kaputt.length ? ` – gestört: ${kaputt.map((e) => `${e.name} (${e.fehler})`).join(', ')}` : ''}`,
    anleitung: kaputt.length ? 'Liefert eine Quelle länger nicht: bei der Monatswartung in quellen.json ersetzen oder auf "aktiv": false setzen (Claude Code macht das).' : '',
  };
}

// Regelmäßigkeit aus der Liste der Abruf-Läufe (neueste zuerst) und dem Alter des letzten erfolgreichen Abrufs.
export function abrufAmpel(laeufe, letzterAbruf, jetzt) {
  const alterStunden = (jetzt.getTime() - Date.parse(letzterAbruf)) / 3600000;
  const fertig = laeufe.filter((l) => l.status === 'completed');
  const erfolgreich = fertig.filter((l) => l.conclusion === 'success').length;
  const quote = fertig.length ? erfolgreich / fertig.length : 0;
  const zeiten = laeufe.map((l) => Date.parse(l.created_at)).sort((a, b) => b - a);
  let groessteLuecke = 0;
  for (let i = 1; i < zeiten.length; i++) groessteLuecke = Math.max(groessteLuecke, zeiten[i - 1] - zeiten[i]);
  const lueckeStunden = groessteLuecke / 3600000;
  let ampel = 'gruen';
  if (!Number.isFinite(alterStunden) || alterStunden > 3 || quote < 0.5) ampel = 'rot';
  else if (quote < 0.9 || lueckeStunden > 3) ampel = 'gelb';
  return {
    bereich: 'Abruf',
    ampel,
    text: `${fertig.length} Läufe in 7 Tagen, ${Math.round(quote * 100)} % erfolgreich, größte Lücke ${lueckeStunden.toFixed(1)} Std., letzter Abruf vor ${Number.isFinite(alterStunden) ? `${Math.round(alterStunden * 60)} Min.` : '?'}`,
    anleitung: ampel === 'gruen' ? '' : 'Im Repo unter „Actions“ → „Abruf“ den letzten roten Lauf öffnen; Claude Code den Fehler zeigen.',
  };
}

export function repoAmpel(groesseKb, cacheBytes) {
  const mb = groesseKb / 1024;
  const ampel = mb < 100 ? 'gruen' : mb < 500 ? 'gelb' : 'rot';
  const cache = Number.isFinite(cacheBytes) ? `, Actions-Cache ${(cacheBytes / 1024 / 1024).toFixed(0)} MB von 10 GB` : '';
  return {
    bereich: 'Repo-Größe',
    ampel,
    text: `Repo ${mb.toFixed(1)} MB${cache}`,
    anleitung: ampel === 'gruen' ? '' : 'Repo wird groß: bei der Monatswartung prüfen lassen, was wächst.',
  };
}

// Kontingent: Gemini/Groq zeigen das Rest-Kontingent nicht an – gemessen wird der Rückstand und wie oft Limits griffen.
export function kontingentAmpel(ki) {
  const protokoll = Array.isArray(ki?.protokoll) ? ki.protokoll : [];
  const limits = protokoll.filter((p) => /429/.test(p.grund || '')).length;
  const offen = Number(ki?.offen) || 0;
  const ampel = ki?.abgebrochen || offen > 200 ? 'rot' : offen > 60 || limits > 3 ? 'gelb' : 'gruen';
  return {
    bereich: 'KI-Kontingent',
    ampel,
    text: `Letzter Abruf: ${ki?.bewertet ?? 0} bewertet, ${offen} noch offen, ${limits}× Limit (HTTP 429)${ki?.abgebrochen ? ', alle Dienste am Limit' : ''}`,
    anleitung: ampel === 'gruen' ? '' : 'Kontingent knapp: weitere Ausweich-Dienste (Mistral, OpenRouter) einrichten oder Abruf seltener stellen.',
  };
}
