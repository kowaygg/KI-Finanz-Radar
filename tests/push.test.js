import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pushKandidaten, meldungsPush, wichtigesPushen, abrufWarnung, pushSenden } from '../src/push.js';
import { gesamtAmpel, quellenAmpel, abrufAmpel, kontingentAmpel } from '../src/ampel.js';

const jetzt = new Date('2026-10-22T12:00:00Z');
const meldung = (id, relevanz, stundenAlt, extra = {}) => ({
  id, titel: `Titel ${id}`, link: `https://a.de/${id}`, quelle: 'Q', vorfilter: 'ok',
  datum: new Date(jetzt.getTime() - stundenAlt * 3600000).toISOString(),
  ki: { relevanz, art: 'nachricht', passt: true, kurz: ['Punkt 1', 'Punkt 2'] }, ...extra,
});
const einstellungen = { server: 'https://ntfy.sh', minRelevanz: 9, maxAlterStunden: 6, maxProLauf: 3 };

test('Push: nur Relevanz 9–10, nicht zu alt, nicht doppelt, keine Dubletten', () => {
  const liste = [
    meldung('a', 9, 1), meldung('b', 8, 1), meldung('c', 10, 10), meldung('d', 10, 1, { gepusht: 'x' }),
    meldung('e', 9, 1, { ki: { relevanz: 9, dublette: 'a', passt: true } }),
  ];
  assert.deepEqual(pushKandidaten(liste, { ...einstellungen, jetzt }).map((m) => m.id), ['a']);
});

test('Push-Text: Überschrift, Stichpunkte, Quelle, nur https-Link', () => {
  const n = meldungsPush(meldung('a', 10, 1, { titelDe: 'Deutscher Titel' }));
  assert.equal(n.title, '★ 10/10 · Deutscher Titel');
  assert.equal(n.message, '• Punkt 1\n• Punkt 2\nQuelle: Q');
  assert.equal(n.priority, 5);
  assert.equal(n.click, 'https://a.de/a');
  assert.equal(meldungsPush(meldung('b', 9, 1, { link: 'javascript:alert(1)' })).click, undefined);
});

test('Push: gesendete Meldungen werden gemerkt, ohne Kanal wird nichts gesendet', async () => {
  const gesendet = [];
  const holen = async (url, opt) => { gesendet.push(JSON.parse(opt.body)); return { ok: true }; };
  const liste = [meldung('a', 9, 1)];
  const ergebnis = await wichtigesPushen(liste, einstellungen, { kanal: 'geheim', jetzt, holen });
  assert.equal(ergebnis.gesendet, 1);
  assert.equal(gesendet[0].topic, 'geheim');
  assert.ok(liste[0].gepusht);
  assert.equal((await wichtigesPushen(liste, einstellungen, { kanal: 'geheim', jetzt, holen })).gesendet, 0);
  assert.equal(await pushSenden({ title: 't', message: 'm' }, { server: 's', kanal: '', protokoll: () => {} }), false);
});

test('Wächter: warnt ab 3 Std. Ausfall, danach einmal pro Tag', () => {
  const opt = { abrufWarnungStunden: 3, appAdresse: 'https://x' };
  const vor = (stunden) => new Date(jetzt.getTime() - stunden * 3600000).toISOString();
  assert.equal(abrufWarnung(vor(1), opt, jetzt), null);
  assert.ok(abrufWarnung(vor(3.4), opt, jetzt));
  assert.equal(abrufWarnung(vor(5), opt, jetzt), null);
  assert.ok(abrufWarnung(vor(27.5), opt, jetzt));
});

test('Ampel: schlimmster Bereich bestimmt die Gesamtampel, grau zählt nicht', () => {
  assert.equal(gesamtAmpel([{ ampel: 'gruen' }, { ampel: 'grau' }]), 'gruen');
  assert.equal(gesamtAmpel([{ ampel: 'gelb' }, { ampel: 'rot' }]), 'rot');
  assert.equal(quellenAmpel([{ name: 'A', ok: true }, { name: 'B', ok: false, fehler: '503' }, { name: 'C', ok: true }, { name: 'D', ok: true }, { name: 'E', ok: true }]).ampel, 'gelb');
  assert.equal(quellenAmpel([{ name: 'A', ok: false, fehler: 'x' }, { name: 'B', ok: true }]).ampel, 'rot');
  assert.equal(kontingentAmpel({ offen: 0, protokoll: [] }).ampel, 'gruen');
  assert.equal(kontingentAmpel({ offen: 300 }).ampel, 'rot');
});

test('Ampel Abruf: rot ohne Abruf seit über 3 Std., gelb bei großen Lücken', () => {
  const lauf = (stunden, conclusion = 'success') => ({ status: 'completed', conclusion, created_at: new Date(jetzt.getTime() - stunden * 3600000).toISOString() });
  const laeufe = [lauf(0.5), lauf(1), lauf(1.5)];
  assert.equal(abrufAmpel(laeufe, new Date(jetzt.getTime() - 1800000).toISOString(), jetzt).ampel, 'gruen');
  assert.equal(abrufAmpel(laeufe, new Date(jetzt.getTime() - 4 * 3600000).toISOString(), jetzt).ampel, 'rot');
  assert.equal(abrufAmpel([lauf(0.5), lauf(5)], new Date(jetzt.getTime() - 1800000).toISOString(), jetzt).ampel, 'gelb');
});
