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
