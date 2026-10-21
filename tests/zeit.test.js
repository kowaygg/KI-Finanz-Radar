import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kalenderwoche, zeitpunktInZone, boersenStatus, countdown, terminText, wetterSymbol } from '../public/zeit.js';

const xetra = { zeitzone: 'Europe/Berlin', oeffnung: '09:00', schluss: '17:30', feiertage: ['2026-12-24', '2026-12-25', '2026-12-31', '2027-01-01'], fruehschluss: {} };
const nyse = { zeitzone: 'America/New_York', oeffnung: '09:30', schluss: '16:00', feiertage: ['2026-11-26', '2026-12-25'], fruehschluss: { '2026-11-27': '13:00' } };

test('Kalenderwoche nach ISO', () => {
  assert.equal(kalenderwoche(new Date('2026-10-21T12:00:00Z')), 43);
  assert.equal(kalenderwoche(new Date('2026-01-01T12:00:00Z')), 1);
  assert.equal(kalenderwoche(new Date('2027-01-01T12:00:00Z')), 53);
  // Kurz nach Mitternacht deutscher Zeit zählt schon der neue Tag.
  assert.equal(kalenderwoche(new Date('2026-10-25T23:30:00Z')), 44);
});

test('Zeitpunkt in Zone beachtet Sommer- und Winterzeit', () => {
  assert.equal(zeitpunktInZone('2026-10-21', '09:00', 'Europe/Berlin').toISOString(), '2026-10-21T07:00:00.000Z');
  assert.equal(zeitpunktInZone('2026-10-27', '09:00', 'Europe/Berlin').toISOString(), '2026-10-27T08:00:00.000Z');
  // Zwischen 25.10. und 1.11. ist New York noch in Sommerzeit, Deutschland schon in Winterzeit.
  assert.equal(zeitpunktInZone('2026-10-28', '09:30', 'America/New_York').toISOString(), '2026-10-28T13:30:00.000Z');
});

test('Xetra: offen am Mittwochnachmittag, geschlossen am Abend und Wochenende', () => {
  const offen = boersenStatus(xetra, new Date('2026-10-21T13:00:00Z'));
  assert.equal(offen.offen, true);
  assert.equal(offen.schliesst.toISOString(), '2026-10-21T15:30:00.000Z');
  const abends = boersenStatus(xetra, new Date('2026-10-21T18:00:00Z'));
  assert.equal(abends.offen, false);
  assert.equal(abends.oeffnet.toISOString(), '2026-10-22T07:00:00.000Z');
  const samstag = boersenStatus(xetra, new Date('2026-10-24T10:00:00Z'));
  assert.equal(samstag.oeffnet.toISOString(), '2026-10-26T08:00:00.000Z');
});

test('Feiertage und Frühschluss werden beachtet', () => {
  const weihnachten = boersenStatus(xetra, new Date('2026-12-24T10:00:00Z'));
  assert.equal(weihnachten.offen, false);
  assert.equal(weihnachten.oeffnet.toISOString(), '2026-12-28T08:00:00.000Z');
  const thanksgiving = boersenStatus(nyse, new Date('2026-11-26T16:00:00Z'));
  assert.equal(thanksgiving.offen, false);
  const freitag = boersenStatus(nyse, new Date('2026-11-27T16:00:00Z'));
  assert.equal(freitag.offen, true);
  assert.equal(freitag.fruehschluss, true);
  assert.equal(freitag.schliesst.toISOString(), '2026-11-27T18:00:00.000Z');
});

test('Countdown, Termintext und Wettersymbol', () => {
  assert.equal(countdown(3723000), '1:02:03');
  assert.equal(countdown(-5), '0:00:00');
  const jetzt = new Date('2026-10-28T10:00:00Z');
  assert.equal(terminText(new Date('2026-10-28T18:00:00Z'), jetzt), 'Heute 19:00');
  assert.equal(terminText(new Date('2026-10-29T13:15:00Z'), jetzt), 'Morgen 14:15');
  assert.equal(terminText(new Date('2026-12-17T13:15:00Z'), jetzt), 'Do 17.12. 14:15');
  assert.equal(wetterSymbol(0, true)[1], 'klar');
  assert.equal(wetterSymbol(63)[1], 'Regen');
});

test('Mittagspause (Tokio) und Frühschluss vor der Pause (Hongkong)', () => {
  const tokio = { zeitzone: 'Asia/Tokyo', oeffnung: '09:00', schluss: '15:30', pause: { von: '11:30', bis: '12:30' }, feiertage: [], fruehschluss: {} };
  // 22.10.2026: 10:00 Tokio = 01:00 UTC
  const vormittag = boersenStatus(tokio, new Date('2026-10-22T01:00:00Z'));
  assert.equal(vormittag.offen, true);
  assert.equal(vormittag.mittagspause, true);
  assert.equal(vormittag.schliesst.toISOString(), '2026-10-22T02:30:00.000Z');
  const pause = boersenStatus(tokio, new Date('2026-10-22T03:00:00Z'));
  assert.equal(pause.offen, false);
  assert.equal(pause.mittagspause, true);
  assert.equal(pause.oeffnet.toISOString(), '2026-10-22T03:30:00.000Z');
  const nachmittag = boersenStatus(tokio, new Date('2026-10-22T05:00:00Z'));
  assert.equal(nachmittag.schliesst.toISOString(), '2026-10-22T06:30:00.000Z');
  const hk = { zeitzone: 'Asia/Hong_Kong', oeffnung: '09:30', schluss: '16:00', pause: { von: '12:00', bis: '13:00' }, feiertage: [], fruehschluss: { '2026-12-31': '12:00' } };
  const silvester = boersenStatus(hk, new Date('2026-12-31T03:00:00Z'));
  assert.equal(silvester.offen, true);
  assert.equal(silvester.schliesst.toISOString(), '2026-12-31T04:00:00.000Z');
  const danach = boersenStatus(hk, new Date('2026-12-31T05:30:00Z'));
  assert.equal(danach.offen, false);
  assert.equal(danach.oeffnet.toISOString(), '2027-01-01T01:30:00.000Z');
});
