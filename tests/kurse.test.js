import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verlaufLesen, kurseHolen } from '../src/kurse.js';

const antwort = (kurse, vortag = 100) => ({
  chart: { result: [{ meta: { chartPreviousClose: vortag, currency: 'EUR' }, timestamp: kurse.map((_, i) => 1792540800 + i * 300), indicators: { quote: [{ close: kurse }] } }] },
});

test('Verlauf: Lücken fallen weg, Werte werden gerundet', () => {
  const v = verlaufLesen(antwort([100.123, null, 101.456, -5, 102]));
  assert.deepEqual(v.punkte.map((p) => p[1]), [100.12, 101.46, 102]);
  assert.equal(v.vortag, 100);
  assert.equal(v.waehrung, 'EUR');
});

test('Verlauf: zu viele Punkte werden ausgedünnt, letzter Kurs bleibt', () => {
  const kurse = Array.from({ length: 1000 }, (_, i) => 100 + i);
  const v = verlaufLesen(antwort(kurse), 100);
  assert.equal(v.punkte.length, 100);
  assert.equal(v.punkte.at(-1)[1], 1099);
});

const einstellungen = {
  quelle: { name: 'Test', adresse: 'https://k.test/' },
  indizes: [{ name: 'DAX', land: 'Deutschland', symbol: '^GDAXI' }],
  zeitraeume: [{ schluessel: '1T', range: '1d', interval: '5m' }, { schluessel: '1J', range: '1y', interval: '1d' }],
  maxPunkte: 260,
};

test('Quelle fällt aus → letzter bekannter Verlauf mit altem Zeitstempel bleibt', async () => {
  const letzte = { indizes: [{ symbol: '^GDAXI', verlauf: { '1T': [[1, 5], [2, 6]], '1J': [[1, 1], [2, 2]] }, stand: { '1T': 'alt', '1J': 'alt' }, vortag: 4, waehrung: 'EUR' }] };
  const holen = async (url) => (url.includes('1y') ? { ok: false, status: 429 } : { ok: true, json: async () => antwort([10, 11]) });
  const k = await kurseHolen(einstellungen, letzte, { userAgent: 'x', holen, jetzt: new Date('2026-10-21T12:00:00Z') });
  const dax = k.indizes[0];
  assert.deepEqual(dax.verlauf['1T'].map((p) => p[1]), [10, 11]);
  assert.equal(dax.stand['1T'], '2026-10-21T12:00:00.000Z');
  assert.deepEqual(dax.verlauf['1J'], [[1, 1], [2, 2]]);
  assert.equal(dax.stand['1J'], 'alt');
  assert.equal(dax.fehler.length, 1);
});

test('Ohne alten Stand und ohne Quelle: leerer Verlauf statt Absturz', async () => {
  const k = await kurseHolen(einstellungen, null, { userAgent: 'x', holen: async () => { throw new Error('offline'); } });
  assert.deepEqual(k.indizes[0].verlauf, {});
});
