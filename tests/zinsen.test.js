import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leitzinsenHolen } from '../src/zinsen.js';

const einst = { ezbAdresse: 'https://ezb.test/{reihe}', fedAdresse: 'https://fed.test/' };
const ezbAntwort = (wert) => ({
  dataSets: [{ series: { '0:0:0:0:0:0:0': { observations: { 0: [wert] } } } }],
  structure: { dimensions: { observation: [{ values: [{ id: '2026-10-21' }] }] } },
});

test('Leitzinsen von EZB und Fed werden gelesen', async () => {
  const holen = async (url) => ({
    ok: true,
    json: async () => (url.includes('fed') ? { refRates: [{ effectiveDate: '2026-10-20', percentRate: 3.88, targetRateFrom: 3.75, targetRateTo: 4 }] }
      : ezbAntwort(url.endsWith('DFR') ? 2.5 : url.endsWith('MRR_FR') ? 2.65 : 2.9)),
  });
  const z = await leitzinsenHolen(einst, null, { userAgent: 'x', holen });
  assert.deepEqual(z.ezb, { einlagen: 2.5, hauptrefi: 2.65, spitzen: 2.9, stand: '2026-10-21' });
  assert.equal(z.fed.von, 3.75);
  assert.equal(z.fed.bis, 4);
  assert.equal(z.fehler.length, 0);
});

test('Ausfall: letzter bekannter Wert bleibt erhalten', async () => {
  const letzte = { ezb: { einlagen: 2.25, stand: '2026-09-01' }, fed: { von: 3.5, bis: 3.75, stand: '2026-09-01' } };
  const z = await leitzinsenHolen(einst, letzte, { userAgent: 'x', holen: async () => ({ ok: false, status: 503 }) });
  assert.equal(z.ezb.einlagen, 2.25);
  assert.equal(z.fed.bis, 3.75);
  assert.equal(z.fehler.length, 4);
});
