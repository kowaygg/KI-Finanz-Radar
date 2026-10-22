// Kleiner Leser für RSS 2.0, RSS 1.0 (RDF) und Atom – ohne Zusatzpakete.
// Liefert pro Eintrag: titel, link, datum (ISO oder null), teaser (reiner Text).

import { reinerText, sichererLink } from './bereinigen.js';

// So viel Feed-Text bekommt die KI höchstens pro Meldung (Grundlage für die 5 Stichpunkte).
const TEASER_MAX = 1000;

function feld(block, ...namen) {
  for (const name of namen) {
    const treffer = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
    if (treffer && treffer[1].trim()) return treffer[1];
  }
  return '';
}

function atomLink(block) {
  const links = [...block.matchAll(/<link\b([^>]*?)\/?>/gi)].map((m) => m[1]);
  const attr = (attribute, name) => (attribute.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i')) || [])[1];
  const passend = links.find((a) => !attr(a, 'rel') || attr(a, 'rel') === 'alternate');
  return passend ? attr(passend, 'href') || '' : '';
}

function datumLesen(roh) {
  const text = reinerText(roh, 100);
  if (!text) return null;
  const zeit = Date.parse(text);
  return Number.isNaN(zeit) ? null : new Date(zeit).toISOString();
}

export function feedLesen(xml) {
  if (typeof xml !== 'string') return [];
  const istAtom = /<feed\b[^>]*xmlns=["']http:\/\/www\.w3\.org\/2005\/Atom["']/i.test(xml) || (/<entry[\s>]/i.test(xml) && !/<item[\s>]/i.test(xml));
  const bloecke = [...xml.matchAll(istAtom ? /<entry[\s>][\s\S]*?<\/entry>/gi : /<item[\s>][\s\S]*?<\/item>/gi)].map((m) => m[0]);

  const eintraege = [];
  for (const block of bloecke) {
    const titel = reinerText(feld(block, 'title'), 300);
    let linkRoh = istAtom ? atomLink(block) : reinerText(feld(block, 'link'), 2000);
    if (!linkRoh && !istAtom) {
      const guid = block.match(/<guid(?![^>]*isPermaLink=["']false["'])[^>]*>([\s\S]*?)<\/guid>/i);
      linkRoh = guid ? reinerText(guid[1], 2000) : '';
    }
    const link = sichererLink(linkRoh);
    if (!titel || !link) continue;
    eintraege.push({
      titel,
      link,
      datum: datumLesen(feld(block, 'pubDate', 'published', 'updated', 'dc:date')),
      // Längster vorhandener Text (Beschreibung oder Feed-Volltext), gekürzt – nur interne KI-Eingabe, nie angezeigt.
      teaser: ['description', 'summary', 'content:encoded', 'content']
        .map((name) => reinerText(feld(block, name), TEASER_MAX))
        .reduce((a, b) => (b.length > a.length ? b : a), ''),
    });
  }
  return eintraege;
}
