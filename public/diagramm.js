// Kurven-Diagramme für die Indizes (DAX, S&P 500) – eigenes SVG, keine Zusatzpakete.
const SVG = 'http://www.w3.org/2000/svg';
const BREITE = 600;
const HOEHE = 180;
const ZEITZONE = 'Europe/Berlin';

const zahl = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const prozent = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero' });

export const kursText = (wert) => zahl.format(wert);

// Veränderung im Zeitraum: beim Tag gegenüber dem Vortagesschluss, sonst gegenüber dem ersten Kurs.
export function veraenderung(punkte, vortag, zeitraum) {
  if (!punkte?.length) return null;
  const letzter = punkte[punkte.length - 1][1];
  const basis = zeitraum === '1T' && Number.isFinite(vortag) ? vortag : punkte[0][1];
  if (!basis) return null;
  const pct = ((letzter - basis) / basis) * 100;
  return { letzter, pct, text: `${pct > 0 ? '▲' : pct < 0 ? '▼' : '●'} ${prozent.format(pct)} %`, richtung: pct > 0 ? 'positiv' : pct < 0 ? 'negativ' : 'neutral' };
}

export function zeitBeschriftung(ms, zeitraum) {
  const d = new Date(ms);
  const optionen = {
    '1T': { hour: '2-digit', minute: '2-digit' },
    '1W': { weekday: 'short', hour: '2-digit', minute: '2-digit' },
    '1M': { day: '2-digit', month: '2-digit' },
    '1J': { day: '2-digit', month: '2-digit', year: '2-digit' },
    Max: { month: '2-digit', year: 'numeric' },
  }[zeitraum] || { day: '2-digit', month: '2-digit' };
  return new Intl.DateTimeFormat('de-DE', { timeZone: ZEITZONE, ...optionen }).format(d);
}

function svgElement(name, attribute) {
  const el = document.createElementNS(SVG, name);
  for (const [k, v] of Object.entries(attribute)) el.setAttribute(k, v);
  return el;
}

// Zeichnet die Kurve; gibt eine Funktion zurück, die zu einer x-Position (0–1) den nächsten Punkt liefert.
export function kurveZeichnen(svg, punkte, richtung, vortag, zeitraum) {
  svg.replaceChildren();
  svg.setAttribute('viewBox', `0 0 ${BREITE} ${HOEHE}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  if (!punkte || punkte.length < 2) return null;

  const werte = punkte.map((p) => p[1]);
  const mitVortag = zeitraum === '1T' && Number.isFinite(vortag) ? [...werte, vortag] : werte;
  const min = Math.min(...mitVortag);
  const max = Math.max(...mitVortag);
  const spanne = max - min || 1;
  const x = (i) => (i / (punkte.length - 1)) * BREITE;
  const y = (w) => HOEHE - 8 - ((w - min) / spanne) * (HOEHE - 16);

  const linie = punkte.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[1]).toFixed(1)}`).join(' ');
  svg.append(svgElement('path', { d: `${linie} L${BREITE},${HOEHE} L0,${HOEHE} Z`, class: `flaeche flaeche-${richtung}` }));
  if (zeitraum === '1T' && Number.isFinite(vortag)) {
    svg.append(svgElement('line', { x1: 0, x2: BREITE, y1: y(vortag), y2: y(vortag), class: 'vortag-linie' }));
  }
  svg.append(svgElement('path', { d: linie, class: `kurve kurve-${richtung}`, 'vector-effect': 'non-scaling-stroke' }));
  const zeiger = svgElement('line', { x1: 0, x2: 0, y1: 0, y2: HOEHE, class: 'zeiger', 'vector-effect': 'non-scaling-stroke', visibility: 'hidden' });
  svg.append(zeiger);

  return (anteil) => {
    if (anteil === null) { zeiger.setAttribute('visibility', 'hidden'); return null; }
    const i = Math.round(Math.min(1, Math.max(0, anteil)) * (punkte.length - 1));
    zeiger.setAttribute('x1', x(i));
    zeiger.setAttribute('x2', x(i));
    zeiger.setAttribute('visibility', 'visible');
    return punkte[i];
  };
}

export function spanneText(punkte) {
  const werte = punkte.map((p) => p[1]);
  return { min: Math.min(...werte), max: Math.max(...werte) };
}
