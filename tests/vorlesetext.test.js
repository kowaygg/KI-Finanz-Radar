import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vorleseSaetze, wichtigeMeldungen } from '../public/vorlesetext.js';

test('Vorlesetext: Überschrift, dann Stichpunkte, jeweils mit Satzende', () => {
  const m = { titel: 'Original', titelDe: 'DAX steigt', ki: { relevanz: 8, kurz: ['Plus zwei Prozent', 'Autowerte vorn.'] } };
  assert.deepEqual(vorleseSaetze(m), ['DAX steigt.', 'Plus zwei Prozent.', 'Autowerte vorn.']);
});

test('Vorlesetext: Kurzmeldung wird angesagt, Wichtig ohne Dubletten', () => {
  const m = { titel: 'Kurz', ki: { relevanz: 9, kurz: ['Nur das'], wenigInfo: true } };
  assert.equal(vorleseSaetze(m).at(-1), 'Kurzmeldung, die Quelle enthält nur wenige Infos.');
  const liste = [m, { titel: 'x', ki: { relevanz: 9, dublette: 'a' } }, { titel: 'y', ki: { relevanz: 5 } }];
  assert.deepEqual(wichtigeMeldungen(liste, 7), [m]);
});
