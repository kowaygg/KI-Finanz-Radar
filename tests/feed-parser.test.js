import { test } from 'node:test';
import assert from 'node:assert/strict';
import { feedLesen } from '../src/feed-parser.js';

const RSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>Test</title>
<item><title><![CDATA[DAX steigt &amp; Anleger jubeln]]></title><link>https://example.com/a?x=1&amp;y=2</link>
<pubDate>Wed, 21 Oct 2026 10:00:00 GMT</pubDate><description><![CDATA[<p>Der <b>DAX</b> legt zu.</p><script>alert(1)</script>]]></description></item>
<item><title>Ohne https</title><link>http://example.com/b</link></item>
<item><title>Gefährlicher Link</title><link>javascript:alert(1)</link></item>
<item><title>Nur GUID</title><guid>https://example.com/c</guid></item>
</channel></rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom">
<entry><title type="html">Nvidia &lt;b&gt;stellt&lt;/b&gt; Chip vor</title>
<link rel="self" href="https://example.com/self"/><link rel="alternate" href="https://example.com/nvidia"/>
<updated>2026-10-21T08:00:00Z</updated><summary>Kurz &#8211; neu</summary></entry></feed>`;

test('RSS: Titel, Link, Datum und Teaser werden sauber gelesen', () => {
  const [a] = feedLesen(RSS);
  assert.equal(a.titel, 'DAX steigt & Anleger jubeln');
  assert.equal(a.link, 'https://example.com/a?x=1&y=2');
  assert.equal(a.datum, '2026-10-21T10:00:00.000Z');
  assert.equal(a.teaser, 'Der DAX legt zu.');
});

test('RSS: nur https-Links, gefährliche Links fliegen raus, GUID als Ersatz', () => {
  const titel = feedLesen(RSS).map((e) => e.titel);
  assert.deepEqual(titel, ['DAX steigt & Anleger jubeln', 'Nur GUID']);
});

test('Atom: alternate-Link, kodiertes HTML wird zu Text', () => {
  const [e] = feedLesen(ATOM);
  assert.equal(e.titel, 'Nvidia stellt Chip vor');
  assert.equal(e.link, 'https://example.com/nvidia');
  assert.equal(e.datum, '2026-10-21T08:00:00.000Z');
  assert.equal(e.teaser, 'Kurz – neu');
});

test('Kaputte Eingaben führen nicht zum Absturz', () => {
  assert.deepEqual(feedLesen('<html>kein Feed</html>'), []);
  assert.deepEqual(feedLesen(undefined), []);
  assert.deepEqual(feedLesen('<rss><item><title>x'), []);
});

test('Teaser: der längere Feed-Text (z. B. content:encoded) gewinnt, höchstens 1000 Zeichen', () => {
  const lang = 'Wort '.repeat(400);
  const xml = `<rss><channel><item><title>T</title><link>https://example.com/l</link>
<description>Kurz.</description><content:encoded><![CDATA[<p>${lang}</p>]]></content:encoded></item></channel></rss>`;
  const [e] = feedLesen(xml);
  assert.ok(e.teaser.length > 900 && e.teaser.length <= 1000);
});
