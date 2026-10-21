import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wertLesen, werteHolen, waehrungAusSymbol } from '../src/werte.js';

test('Tagesveränderung aus den letzten zwei Schlusskursen, Lücken fallen weg', () => {
  const w = wertLesen({ close: [100, null, 104, 99.84] });
  assert.equal(w.kurs, 99.84);
  assert.equal(w.vortag, 104);
  assert.equal(w.pct, -4);
  assert.deepEqual(w.verlauf, [100, 104, 99.84]);
  assert.equal(wertLesen({ close: [5] }), null);
});

test('Währung aus dem Börsenkürzel', () => {
  assert.equal(waehrungAusSymbol('SAP.DE'), 'EUR');
  assert.equal(waehrungAusSymbol('NVDA'), 'USD');
  assert.equal(waehrungAusSymbol('NOVO-B.CO'), 'DKK');
});

test('Gebündelte Abfrage; bei Ausfall bleibt der letzte Stand je Wert', async () => {
  const liste = [
    { name: 'SAP', isin: 'DE0007164600', symbol: 'SAP.DE', art: 'Aktie' },
    { name: 'Nvidia', isin: 'US67066G1040', symbol: 'NVDA', art: 'Aktie' },
    { name: 'Neu', isin: 'DE000A0S9GB0', symbol: '4GLD.DE', art: 'ETC' },
  ];
  const urls = [];
  const holen = async (url) => {
    urls.push(url);
    if (url.includes('4GLD')) return { ok: false, status: 429 };
    return { ok: true, json: async () => ({ 'SAP.DE': { close: [200, 210] } }) };
  };
  const letzte = { werte: [{ symbol: 'NVDA', kurs: 180, pct: 1, stand: 'alt' }] };
  const r = await werteHolen(liste, letzte, { adresse: 'https://k.test/spark', userAgent: 'x', holen, paketGroesse: 2, jetzt: new Date('2026-10-21T12:00:00Z') });
  assert.equal(urls.length, 2);
  const nach = Object.fromEntries(r.werte.map((w) => [w.symbol, w]));
  assert.equal(nach['SAP.DE'].pct, 5);
  assert.equal(nach['SAP.DE'].waehrung, 'EUR');
  assert.equal(nach.NVDA.kurs, 180);
  assert.equal(nach.NVDA.stand, 'alt');
  assert.equal(nach['4GLD.DE'].kurs, null);
  assert.equal(r.fehler.length, 1);
});

import { verlaeufeHolen, verlaufDatei } from '../src/werte.js';

test('Verläufe: fällige Zeiträume holen, seltene Zeiträume überspringen, Dateiname sicher', async () => {
  const liste = [{ symbol: 'SAP.DE' }, { symbol: 'BRK-B' }];
  const zeitraeume = [{ schluessel: '1T', range: '1d', interval: '5m', minuten: 0 }, { schluessel: 'Max', range: 'max', interval: '1mo', minuten: 1440 }];
  const urls = [];
  const holen = async (url) => {
    urls.push(url);
    return { ok: true, json: async () => ({ 'SAP.DE': { timestamp: [1, 2, 3], close: [10, null, 12], chartPreviousClose: 9 } }) };
  };
  const jetzt = new Date('2026-10-21T12:00:00Z');
  const r = await verlaeufeHolen(liste, zeitraeume, {}, { Max: '2026-10-21T08:00:00Z' }, { adresse: 'https://k.test/spark', userAgent: 'x', holen, jetzt });
  assert.equal(urls.length, 1);
  assert.ok(urls[0].includes('range=1d'));
  assert.deepEqual(r.verlaeufe['SAP.DE'].verlauf['1T'], [[1000, 10], [3000, 12]]);
  assert.equal(r.verlaeufe['SAP.DE'].vortag, 9);
  assert.equal(r.zeitstempel['1T'], jetzt.toISOString());
  assert.equal(r.zeitstempel.Max, '2026-10-21T08:00:00Z');
  assert.equal(verlaufDatei('^GDAXI'), '_GDAXI.json');
});
