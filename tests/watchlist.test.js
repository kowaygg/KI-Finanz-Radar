import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isinGueltig, watchlistLesen, suchbegriffe, meldungTrifft } from '../public/watchlist.js';

test('ISIN-Prüfziffer', () => {
  for (const isin of ['DE0007164600', 'US0378331005', 'IE00B4L5Y983', 'US67066G1040', 'DE000A0S9GB0']) assert.equal(isinGueltig(isin), true, isin);
  assert.equal(isinGueltig('DE0007164601'), false);
  assert.equal(isinGueltig('XX'), false);
});

test('Import übernimmt NUR Name und ISIN – Beträge und Stückzahlen werden verworfen', () => {
  const json = JSON.stringify([{ name: 'SAP', isin: 'DE0007164600', stueck: 12, betrag: 5000, kaufkurs: 150 }]);
  const { eintraege } = watchlistLesen(json);
  assert.deepEqual(eintraege, [{ name: 'SAP', isin: 'DE0007164600' }]);
});

test('Import aus Text: verschiedene Trennzeichen, Reihenfolge egal, Fehler werden gemeldet', () => {
  const { eintraege, fehler } = watchlistLesen('SAP;DE0007164600\nus0378331005, Apple\nIE00B4L5Y983\nKaputt;DE0007164601\nSAP doppelt;DE0007164600');
  assert.deepEqual(eintraege.map((e) => e.isin), ['DE0007164600', 'US0378331005', 'IE00B4L5Y983']);
  assert.equal(eintraege[1].name, 'Apple');
  assert.equal(eintraege[2].name, 'IE00B4L5Y983');
  assert.equal(fehler.length, 1);
});

test('News-Zuordnung: Aktie über Namen, ETF über den Index', () => {
  const nvidia = suchbegriffe({ name: 'NVIDIA Corp.', isin: 'US67066G1040' }, { name: 'Nvidia', art: 'Aktie' });
  assert.ok(meldungTrifft({ titel: 'Nvidia stellt neuen Chip vor' }, nvidia));
  const world = suchbegriffe({ name: 'iShares Core MSCI World', isin: 'IE00B4L5Y983' }, { name: 'iShares Core MSCI World', art: 'ETF' });
  assert.deepEqual(world, ['MSCI World']);
  assert.ok(meldungTrifft({ titel: 'x', ki: { analyse: { betroffen: { etfs: ['MSCI World'] } } } }, world));
  assert.ok(!meldungTrifft({ titel: 'iShares senkt Gebühren' }, world));
});
