// ─── LinkedIn export: text items read into lines ────────────────────
// Extracted from linkedinParser.ts, over its size limit: the font roles, the
// line model and the text rules the header and the experiences share.

/**
 * LinkedIn PDFs use a fixed font-size hierarchy that makes parsing reliable.
 * Thresholds are midpoints between adjacent sizes: COMPANY (12) vs POSITION
 * (11.5) splits at 11.8.
 */
export const FontRole = {
  NAME: 'name',               // ~26
  SECTION_HEADER: 'section',  // ~15.75 (Expérience, Formation…)
  SIDEBAR_HEADER: 'sidebar',  // ~13 (Coordonnées, Languages…)
  COMPANY: 'company',         // ~12, also the headline and a school
  POSITION: 'position',       // ~11.5
  SIDEBAR_LINK: 'link',       // ~11
  BODY: 'body',               // ~10.5 (dates, places, descriptions)
  PAGE_MARKER: 'page',        // ~9 ("Page X of Y")
  UNKNOWN: 'unknown',
} as const;
export type FontRole = (typeof FontRole)[keyof typeof FontRole];

function classifyFontSize(fs: number): FontRole {
  if (fs >= 24)   return FontRole.NAME;
  if (fs >= 15)   return FontRole.SECTION_HEADER;
  if (fs >= 12.5) return FontRole.SIDEBAR_HEADER;
  if (fs >= 11.8) return FontRole.COMPANY;
  if (fs >= 11.2) return FontRole.POSITION;
  if (fs >= 10.8) return FontRole.SIDEBAR_LINK;
  if (fs >= 10)   return FontRole.BODY;
  if (fs >= 8)    return FontRole.PAGE_MARKER;
  return FontRole.UNKNOWN;
}

export interface Token { text: string; fontSize: number; x: number; y: number; page: number }
export interface Line { text: string; role: FontRole; fontSize: number; x: number; y: number; page: number }

// ─── Shared patterns ────────────────────────────────────────────────

/** A bullet mark opens the line; a minus needs a space after it, or "-40%" would be one */
export const BULLET_START = /^(?:[•✓⚛]|-(?=\s))\s*/;
export const isBulletLine = (text: string) => BULLET_START.test(text);

export const EMOJI_RE = /[⚛✓★☆✦]+/g;

/** "City, Region, Country" */
export const PLACE = /^[\wÀ-ÿ\s'-]+,\s*[\wÀ-ÿ\s'-]+,\s*[\wÀ-ÿ\s'-]+$/;

/** X-coordinate separating left sidebar from main content */
const SIDEBAR_BOUNDARY = 150;

/**
 * Line steps, in font sizes. Body text runs at 1.7 (18 pt at 10.5 pt) and a
 * paragraph break adds a blank line (36 pt): a wider gap starts a paragraph.
 * A sidebar item wraps at 1.25 (13 pt) and the next item starts at 1.6 (17 pt).
 */
export const PARAGRAPH_GAP = 2.4;
export const SIDEBAR_WRAP_GAP = 1.45;
/** A line this close to the page foot (46 pt at 10.5 pt) is the last one its page holds */
export const PAGE_FOOT = 6;

/** Two lines of one text: a word cut at "user-" or "Tech/" goes on without a space */
export const joinLines = (a: string, b: string) => (/\p{L}[-/]$/u.test(a) ? `${a}${b}` : `${a} ${b}`);

/** LinkedIn drops the line break between paragraphs of the About text: "côté.J'ai", never "Node.JS" */
export const spaceSentences = (text: string) => text.replace(/([\p{Ll}\d)][.!?])(\p{Lu}(?=[\p{Ll}'’]))/gu, '$1 $2');

/** Lines of one text joined as written */
export const joinAll = (lines: Line[]) => lines.map(l => l.text).reduce((text, line) => (text ? joinLines(text, line) : line), '');

// ─── Tokens → Lines (merge same-Y, same-role tokens) ────────────────

export function tokensToLines(tokens: Token[]): Line[] {
  const lines: Line[] = [];
  let cur: Line | null = null;

  for (const t of tokens) {
    const role = classifyFontSize(t.fontSize);
    if (role === FontRole.PAGE_MARKER) continue;

    if (cur && cur.page === t.page && Math.abs(cur.y - t.y) <= 3 && cur.role === role) {
      cur.text += ' ' + t.text;
    } else {
      if (cur) lines.push(cur);
      cur = { text: t.text, role, fontSize: t.fontSize, x: t.x, y: t.y, page: t.page };
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Page 1 header: the left sidebar and the main column */
export function splitColumns(headerLines: Line[]) {
  return {
    left:  headerLines.filter(l => l.x < SIDEBAR_BOUNDARY),
    right: headerLines.filter(l => l.x >= SIDEBAR_BOUNDARY),
  };
}
