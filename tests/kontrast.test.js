// Prüft die Farben aus public/styles.css auf ausreichenden Kontrast (WCAG: Text mind. 4,5 : 1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');
const wurzel = css.match(/:root\s*{([\s\S]*?)}/)[1];
const farben = Object.fromEntries([...wurzel.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));

function helligkeit(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function kontrast(a, b) {
  const [hell, dunkel] = [helligkeit(a), helligkeit(b)].sort((x, y) => y - x);
  return (hell + 0.05) / (dunkel + 0.05);
}

const paare = [
  ['text', 'hintergrund'], ['text', 'flaeche'], ['text', 'flaeche-hoch'],
  ['text-leise', 'hintergrund'], ['text-leise', 'flaeche'], ['text-leise', 'flaeche-hoch'],
  ['akzent', 'hintergrund'], ['akzent', 'flaeche'], ['akzent-text', 'akzent'],
  ['positiv', 'flaeche'], ['negativ', 'flaeche'], ['positiv', 'flaeche-hoch'], ['negativ', 'flaeche-hoch'],
  ['warnung-text', 'warnung-hg'], ['top-akzent', 'top-hg'], ['text', 'top-hg'], ['text-leise', 'top-hg'],
];

test('Alle Text-/Hintergrund-Paare erreichen mindestens 4,5 : 1', () => {
  for (const [vorne, hinten] of paare) {
    assert.ok(farben[vorne] && farben[hinten], `Farbe fehlt: ${vorne}/${hinten}`);
    const k = kontrast(farben[vorne], farben[hinten]);
    assert.ok(k >= 4.5, `${vorne} auf ${hinten}: nur ${k.toFixed(2)} : 1`);
  }
});

test('Kein reines Schwarz oder Weiß (Überstrahlen im Dunkelmodus vermeiden)', () => {
  assert.notEqual(farben.hintergrund.toLowerCase(), '#000000');
  assert.notEqual(farben.text.toLowerCase(), '#ffffff');
});
