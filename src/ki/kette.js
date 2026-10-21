// Ausweichkette: probiert die Dienste der Reihe nach. Ist einer am Limit (429) oder fällt aus,
// springt automatisch der nächste ein. Schlüssel kommen nur aus Umgebungsvariablen und werden nie ausgegeben.

import { jsonAusText } from './pruefen.js';

export class KiFehler extends Error {
  constructor(meldung, { status, limit = false, modellFehlt = false } = {}) {
    super(meldung);
    this.status = status;
    this.limit = limit;
    this.modellFehlt = modellFehlt;
  }
}

async function antwortPruefen(antwort) {
  if (antwort.ok) return antwort.json();
  const status = antwort.status;
  // Fehlertext nicht ungeprüft übernehmen (könnte Daten enthalten) – nur der Status zählt.
  await antwort.text().catch(() => '');
  throw new KiFehler(`HTTP ${status}`, { status, limit: status === 429, modellFehlt: status === 404 });
}

async function geminiFragen({ adresse, modell, schluessel, anweisung, nachricht, timeoutMs, holen }) {
  const antwort = await holen(`${adresse}/models/${encodeURIComponent(modell)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': schluessel },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: anweisung }] },
      contents: [{ role: 'user', parts: [{ text: nachricht }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 16384 },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const daten = await antwortPruefen(antwort);
  const kandidat = daten?.candidates?.[0];
  // Abgeschnittene oder blockierte Antworten klar benennen (hilft bei der Fehlersuche im Wartungsbericht).
  if (kandidat?.finishReason && kandidat.finishReason !== 'STOP') throw new KiFehler(`Antwort unvollständig (${kandidat.finishReason})`);
  const teile = kandidat?.content?.parts || [];
  return teile.filter((t) => !t.thought).map((t) => t.text || '').join('');
}

async function openaiFragen({ adresse, modell, schluessel, anweisung, nachricht, timeoutMs, holen, parameter = {} }) {
  const antwort = await holen(`${adresse}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${schluessel}` },
    body: JSON.stringify({
      // Dienst-eigene Zusatzwerte aus config/ki.json (z. B. Groq: wenig „Nachdenken“, damit 25 Meldungen ins Limit passen)
      ...parameter,
      model: modell,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: anweisung },
        { role: 'user', content: nachricht },
      ],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const daten = await antwortPruefen(antwort);
  const wahl = daten?.choices?.[0];
  if (wahl?.finish_reason && wahl.finish_reason !== 'stop') throw new KiFehler(`Antwort unvollständig (${wahl.finish_reason})`);
  return wahl?.message?.content || '';
}

const FRAGEN = { gemini: geminiFragen, openai: openaiFragen };

export function ketteErstellen(kiEinstellungen, { umgebung = process.env, holen = fetch } = {}) {
  const dienste = kiEinstellungen.kette
    .map((d) => ({ ...d, schluessel: umgebung[d.schluesselVariable] || '' }))
    .filter((d) => d.schluessel && FRAGEN[d.typ]);
  const erschoepft = new Set();
  const fehlendeModelle = new Set(); // abgeschaltet oder am Limit
  const protokoll = [];

  async function fragen(anweisung, nachricht) {
    for (const dienst of dienste) {
      if (erschoepft.has(dienst.name)) continue;
      for (const modell of dienst.modelle) {
        if (fehlendeModelle.has(`${dienst.name}/${modell}`)) continue;
        try {
          const text = await FRAGEN[dienst.typ]({
            adresse: dienst.adresse, modell, schluessel: dienst.schluessel, anweisung, nachricht, parameter: dienst.parameter,
            timeoutMs: kiEinstellungen.timeoutSekunden * 1000, holen,
          });
          const json = jsonAusText(text);
          if (!json) throw new KiFehler('keine gültige JSON-Antwort');
          protokoll.push({ dienst: dienst.name, modell, ok: true });
          return { json, dienst: dienst.name, modell };
        } catch (fehler) {
          const grund = fehler.name === 'TimeoutError' ? 'Zeitüberschreitung' : fehler.message;
          protokoll.push({ dienst: dienst.name, modell, ok: false, grund });
          // Schlüssel ungültig/gesperrt → ganzer Dienst fällt für diesen Lauf aus.
          if (fehler.status === 401 || fehler.status === 403) { erschoepft.add(dienst.name); break; }
          // Modell abgeschaltet oder am Limit (jedes Modell hat eigenes Kontingent) → für diesen Lauf überspringen.
          if (fehler.modellFehlt || fehler.limit) fehlendeModelle.add(`${dienst.name}/${modell}`);
          // Sonst (überlastet, Zeitüberschreitung, kaputtes JSON): nächstes Modell, danach nächster Dienst.
        }
      }
    }
    return null; // alle Dienste am Limit oder gestört → später nachholen
  }

  return { fragen, protokoll, verfuegbar: dienste.map((d) => d.name) };
}
