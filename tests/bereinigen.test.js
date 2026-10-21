import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reinerText, sichererLink } from '../src/bereinigen.js';

test('reinerText entfernt HTML, Skripte und Steuerzeichen', () => {
  assert.equal(reinerText('<img src=x onerror=alert(1)>Hallo <b>Welt</b>'), 'Hallo Welt');
  assert.equal(reinerText('&lt;script&gt;alert(1)&lt;/script&gt;Text'), 'Text');
  assert.equal(reinerText('A‮B\u0000C'), 'ABC');
  assert.equal(reinerText('&amp;lt;b&amp;gt;fett&amp;lt;/b&amp;gt;'), 'fett');
});

test('reinerText kürzt lange Texte', () => {
  const text = reinerText('x'.repeat(50), 10);
  assert.equal(text.length, 10);
  assert.ok(text.endsWith('…'));
});

test('sichererLink lässt nur https ohne Zugangsdaten zu', () => {
  assert.equal(sichererLink('https://example.com/a'), 'https://example.com/a');
  assert.equal(sichererLink('http://example.com/a'), null);
  assert.equal(sichererLink('javascript:alert(1)'), null);
  assert.equal(sichererLink('data:text/html,hi'), null);
  assert.equal(sichererLink('https://user:pw@example.com/'), null);
  assert.equal(sichererLink('kein link'), null);
});
