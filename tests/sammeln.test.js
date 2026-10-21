import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eintraegeAufnehmen, alteLoeschen, oeffentlicheMeldungen } from '../src/sammeln.js';
import { vorfilterErstellen } from '../src/vorfilter.js';

const einstellungen = {
  maxMeldungenProQuelle: 30,
  maxAlterStunden: 48,
  dublettenAehnlichkeit: 0.6,
  dublettenZeitfensterStunden: 36,
};
const einstufen = vorfilterErstellen({ werbung: ['anzeige'], ohneKi: ['fußball'] });
const jetzt = new Date('2026-10-21T12:00:00Z');
const optionen = { einstellungen, einstufen, jetzt };
const quelleA = { name: 'Quelle A', kategorie: 'Wirtschaft', sprache: 'de' };
const quelleB = { name: 'Quelle B', kategorie: 'Börse', sprache: 'de' };

test('Ähnliche Überschriften werden zu einer Meldung mit allen Quellen', () => {
  const meldungen = [];
  eintraegeAufnehmen(meldungen, [{ titel: 'EZB senkt Leitzins um 0,25 Prozentpunkte', link: 'https://a.de/1', datum: '2026-10-21T10:00:00Z', teaser: '' }], quelleA, optionen);
  const neu = eintraegeAufnehmen(meldungen, [{ titel: 'EZB senkt den Leitzins um 0,25 Prozentpunkte', link: 'https://b.de/9', datum: '2026-10-21T10:30:00Z', teaser: '' }], quelleB, optionen);
  assert.equal(neu, 0);
  assert.equal(meldungen.length, 1);
  assert.deepEqual(meldungen[0].quellen.map((q) => q.name), ['Quelle A', 'Quelle B']);
});

test('Gleicher Link mit Tracking-Parametern zählt als Dublette', () => {
  const meldungen = [];
  eintraegeAufnehmen(meldungen, [{ titel: 'Nvidia Quartalszahlen', link: 'https://a.de/n', datum: '2026-10-21T10:00:00Z', teaser: '' }], quelleA, optionen);
  eintraegeAufnehmen(meldungen, [{ titel: 'Ganz andere Überschrift hier', link: 'https://www.a.de/n?utm_source=rss', datum: '2026-10-21T10:00:00Z', teaser: '' }], quelleA, optionen);
  assert.equal(meldungen.length, 1);
});

test('Verschiedene Themen bleiben getrennt', () => {
  const meldungen = [];
  eintraegeAufnehmen(meldungen, [
    { titel: 'EZB senkt Leitzins', link: 'https://a.de/1', datum: '2026-10-21T10:00:00Z', teaser: '' },
    { titel: 'Nvidia stellt neuen KI-Chip vor', link: 'https://a.de/2', datum: '2026-10-21T10:00:00Z', teaser: '' },
  ], quelleA, optionen);
  assert.equal(meldungen.length, 2);
});

test('Vorfilter: Werbung wird nie veröffentlicht, ohneKi bekommt keinen Teaser', () => {
  const meldungen = [];
  eintraegeAufnehmen(meldungen, [
    { titel: 'Anzeige: Super Depot', link: 'https://a.de/w', datum: '2026-10-21T10:00:00Z', teaser: 'x' },
    { titel: 'Fußball: Bayern gewinnt', link: 'https://a.de/f', datum: '2026-10-21T10:00:00Z', teaser: 'x' },
    { titel: 'Inflation sinkt', link: 'https://a.de/i', datum: '2026-10-21T10:00:00Z', teaser: 'Teaser' },
  ], quelleA, optionen);
  const nachTitel = Object.fromEntries(meldungen.map((m) => [m.titel, m]));
  assert.equal(nachTitel['Anzeige: Super Depot'].vorfilter, 'werbung');
  assert.equal(nachTitel['Fußball: Bayern gewinnt'].vorfilter, 'ohneKi');
  assert.equal(nachTitel['Fußball: Bayern gewinnt'].teaser, '');
  assert.equal(nachTitel['Inflation sinkt'].teaser, 'Teaser');
  const oeffentlich = oeffentlicheMeldungen(meldungen);
  assert.equal(oeffentlich.length, 2);
  assert.ok(oeffentlich.every((m) => !('teaser' in m) && !('vorfilter' in m)));
});

test('Datum in der Zukunft wird auf jetzt gesetzt, zu alte Einträge werden übersprungen', () => {
  const meldungen = [];
  eintraegeAufnehmen(meldungen, [
    { titel: 'Zukunft', link: 'https://a.de/z', datum: '2027-01-01T00:00:00Z', teaser: '' },
    { titel: 'Uralt', link: 'https://a.de/u', datum: '2026-09-01T00:00:00Z', teaser: '' },
  ], quelleA, optionen);
  assert.deepEqual(meldungen.map((m) => m.titel), ['Zukunft']);
  assert.equal(meldungen[0].datum, jetzt.toISOString());
});

test('Meldungen älter als die Aufbewahrungszeit werden gelöscht', () => {
  const meldungen = [
    { datum: '2026-10-20T00:00:00Z' },
    { datum: '2026-09-01T00:00:00Z' },
  ];
  assert.equal(alteLoeschen(meldungen, 30, jetzt).length, 1);
});

test('Vorfilter sucht ganze Wörter (keine Teilwort-Treffer)', () => {
  const einstufenTest = vorfilterErstellen({ werbung: ['deal'], ohneKi: [] });
  assert.equal(einstufenTest('Neuer Deal mit Rabatt'), 'werbung');
  assert.equal(einstufenTest('Dealer-Netzwerk wächst'), 'ok');
});
