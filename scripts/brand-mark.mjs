// Shared PRISM brand mark — faceted tetrahedron ("prism") in the brand palette.
// Single source of truth for every asset generator (linkedin-assets.mjs,
// brand-assets.mjs) and the favicon data-URI baked into the HTML pages.
//
// Geometry: apex (400,150), base (118,646)/(682,646) in a 0..800 viewBox; the
// three facets are each shrunk 7% toward their own centroid to carve the
// navy groove gaps. Regenerate points with branding/make-logo.mjs if changed.

export const NAVY = '#1c2e4a'; // --ink / brand navy from src/styles.css

const FACETS = [
  { id: 'pmL', points: '393.42,169.29 131.16,630.57 393.42,476.81', from: '#17AFBE', to: '#0E8D9A', x1: 0, y1: 0, x2: 1, y2: 1 },
  { id: 'pmR', points: '406.58,169.29 668.84,630.57 406.58,476.81', from: '#1FB58D', to: '#148A6B', x1: 1, y1: 0, x2: 0, y2: 1 },
  { id: 'pmB', points: '137.74,642.14 662.26,642.14 400.00,488.38', from: '#2693B6', to: '#1A7596', x1: 0, y1: 1, x2: 0, y2: 0 },
];

/**
 * Faceted mark as an SVG string.
 * @param {number} size  rendered width/height in px
 * @param {object} opts  bg: fill behind the mark (null = transparent);
 *                       scale: shrink the mark inside the canvas (maskable icons)
 */
export function facetedMark(size, { bg = null, scale = 1 } = {}) {
  const defs = FACETS.map(f =>
    `<linearGradient id="${f.id}" x1="${f.x1}" y1="${f.y1}" x2="${f.x2}" y2="${f.y2}">` +
    `<stop offset="0" stop-color="${f.from}"/><stop offset="1" stop-color="${f.to}"/></linearGradient>`).join('');
  const polys = FACETS.map(f => `<polygon fill="url(#${f.id})" points="${f.points}"/>`).join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 800 800" xmlns="http://www.w3.org/2000/svg">` +
    `<defs>${defs}</defs>` +
    (bg ? `<rect width="800" height="800" fill="${bg}"/>` : '') +
    `<g transform="translate(400 400) scale(${scale}) translate(-400 -400)">${polys}</g></svg>`;
}

// Compact flat-color variant for <link rel="icon"> data URIs (transparent bg,
// integer points, no gradients — keeps the URI short and tab-legible).
export const FAVICON_URI =
  "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 800'>" +
  "<polygon fill='%23129DAC' points='393,169 131,631 393,477'/>" +
  "<polygon fill='%231AA17C' points='407,169 669,631 407,477'/>" +
  "<polygon fill='%232084A6' points='138,642 662,642 400,488'/></svg>";
