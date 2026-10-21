// Bereinigt Texte und Links aus Feeds. Feed-Inhalte sind nicht vertrauenswürdig:
// Es wird nie HTML übernommen, nur reiner Text, und nur https-Links.

const BENANNTE_ZEICHEN = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß',
  eacute: 'é', egrave: 'è', aacute: 'á', agrave: 'à', ccedil: 'ç',
  euro: '€', ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»',
  lsquo: '‘', rsquo: '’', sbquo: '‚', ldquo: '“', rdquo: '”', bdquo: '„',
  copy: '©', reg: '®', trade: '™', middot: '·', bull: '•', deg: '°',
};

export function zeichenDecodieren(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (ganz, code) => {
    if (code[0] === '#') {
      const zahl = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      if (!Number.isFinite(zahl) || zahl <= 0 || zahl > 0x10ffff) return '';
      try { return String.fromCodePoint(zahl); } catch { return ''; }
    }
    return BENANNTE_ZEICHEN[code] ?? ganz;
  });
}

// Macht aus beliebigem Feed-Text einfachen, sicheren Text.
export function reinerText(roh, maxLaenge = 500) {
  if (typeof roh !== 'string') return '';
  let text = roh.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  // Mehrfach, weil manche Feeds HTML doppelt kodieren (&amp;lt;b&amp;gt;).
  for (let runde = 0; runde < 3; runde++) {
    text = text
      .replace(/<(script|style|iframe|object|svg)\b[\s\S]*?<\/\1\s*>/gi, ' ')
      .replace(/<[^>]*>/g, ' ');
    text = zeichenDecodieren(text);
  }
  text = text
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f​-‏‪-‮⁦-⁩]/g, '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length > maxLaenge) text = text.slice(0, maxLaenge - 1).trimEnd() + '…';
  return text;
}

// Gibt den Link nur zurück, wenn er eine gültige https-Adresse ohne Zugangsdaten ist.
export function sichererLink(roh) {
  if (typeof roh !== 'string') return null;
  try {
    const url = new URL(zeichenDecodieren(roh.trim()));
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}
