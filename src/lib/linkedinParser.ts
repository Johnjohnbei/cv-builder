/**
 * Deterministic LinkedIn PDF parser — zero API calls, instant extraction.
 *
 * LinkedIn PDFs use a fixed font-size hierarchy that makes parsing reliable:
 *
 *   Font size  │ Semantic role
 *   ───────────┼──────────────────────────────────────────
 *   ~26        │ Full name
 *   ~15.75     │ Section headers (Expérience, Formation…)
 *   ~13        │ Sidebar headers (Coordonnées, Languages…)
 *   ~12        │ Company / school name
 *   ~11.5      │ Position title
 *   ~11        │ Sidebar links
 *   ~10.5      │ Body text (dates, locations, descriptions)
 *   ~9         │ Page markers ("Page X of Y")
 *
 * The parser classifies each PDF text item by its font size, groups them
 * into lines, segments by section header, then extracts structured data.
 *
 * Returns null for non-LinkedIn PDFs so the caller can fall back to AI.
 * Pure: the PDF is read into tokens by pdfTextExtract.ts.
 */

import type { CVData, Experience, Education } from '../shared/types';
import { categorizeSkills } from '@/src/features/editor/lib/skillDictionary';

// ─── Font-size classification ───────────────────────────────────────
//
// Thresholds are midpoints between adjacent LinkedIn font sizes.
// e.g. COMPANY (12) vs POSITION (11.5) → boundary at 11.8

const enum FontRole {
  NAME           = 'name',
  SECTION_HEADER = 'section',
  SIDEBAR_HEADER = 'sidebar',
  COMPANY        = 'company',
  POSITION       = 'position',
  SIDEBAR_LINK   = 'link',
  BODY           = 'body',
  PAGE_MARKER    = 'page',
  UNKNOWN        = 'unknown',
}

function classifyFontSize(fs: number): FontRole {
  if (fs >= 24)   return FontRole.NAME;           // 26
  if (fs >= 15)   return FontRole.SECTION_HEADER;  // 15.75
  if (fs >= 12.5) return FontRole.SIDEBAR_HEADER;  // 13
  if (fs >= 11.8) return FontRole.COMPANY;         // 12
  if (fs >= 11.2) return FontRole.POSITION;        // 11.5
  if (fs >= 10.8) return FontRole.SIDEBAR_LINK;    // 11
  if (fs >= 10)   return FontRole.BODY;            // 10.5
  if (fs >= 8)    return FontRole.PAGE_MARKER;     // 9
  return FontRole.UNKNOWN;
}

// ─── Lookup tables ──────────────────────────────────────────────────

/** Maps LinkedIn section header text → normalized key (FR + EN). */
const SECTION_KEY: Record<string, string> = {
  'résumé': 'summary',        'summary': 'summary',
  'expérience': 'experience',  'experience': 'experience',
  'formation': 'education',    'education': 'education',
  'bénévolat': 'volunteering', 'volunteer experience': 'volunteering',
  'certifications': 'certifications',
  'licenses & certifications': 'certifications',
  'licences et certifications': 'certifications',
  'compétences': 'skills',     'skills': 'skills',
  'honors & awards': 'honors', 'distinctions': 'honors',
  'publications': 'publications',
  'projets': 'projects',       'projects': 'projects',
  'cours': 'courses',          'courses': 'courses',
  'recommandations': 'recommendations', 'recommendations': 'recommendations',
};

/** LinkedIn proficiency labels → readable French equivalents. */
const PROFICIENCY: Record<string, string> = {
  'native or bilingual':             'Natif / Bilingue',
  'native or bilingual proficiency': 'Natif / Bilingue',
  'full professional':               'Courant (C1)',
  'full professional proficiency':   'Courant (C1)',
  'professional working':            'Professionnel (B2)',
  'professional working proficiency':'Professionnel (B2)',
  'limited working':                 'Intermédiaire (B1)',
  'limited working proficiency':     'Intermédiaire (B1)',
  'elementary':                      'Élémentaire (A2)',
  'elementary proficiency':          'Élémentaire (A2)',
};

/** Month name → capitalized display form (FR + EN + abbreviations). */
const MONTH: Record<string, string> = {
  'janvier': 'Janvier', 'février': 'Février', 'mars': 'Mars', 'avril': 'Avril',
  'mai': 'Mai', 'juin': 'Juin', 'juillet': 'Juillet', 'août': 'Août',
  'septembre': 'Septembre', 'octobre': 'Octobre', 'novembre': 'Novembre', 'décembre': 'Décembre',
  'january': 'January', 'february': 'February', 'march': 'March', 'april': 'April',
  'may': 'May', 'june': 'June', 'july': 'July', 'august': 'August',
  'september': 'September', 'october': 'October', 'november': 'November', 'december': 'December',
  'jan': 'Jan', 'feb': 'Feb', 'mar': 'Mar', 'apr': 'Apr',
  'jun': 'Jun', 'jul': 'Jul', 'aug': 'Aug', 'sep': 'Sep',
  'oct': 'Oct', 'nov': 'Nov', 'dec': 'Dec',
  'janv': 'Jan', 'févr': 'Fév', 'avr': 'Avr', 'juil': 'Jul', 'sept': 'Sep', 'déc': 'Déc',
};

// ─── Shared patterns ────────────────────────────────────────────────

/** Matches "juin 2025 - Present" or "décembre 2024 - avril 2025" (+ optional duration). */
const DATE_RANGE_RE = /^([\wÀ-ÿ]+)\s+(\d{4})\s*-\s*(present|[\wÀ-ÿ]+\s+\d{4})/i;

/** A bullet mark opens the line; a minus needs a space after it, or "-40%" would be one */
const BULLET_START = /^(?:[•✓⚛]|-(?=\s))\s*/;
const isBulletLine = (text: string) => BULLET_START.test(text);

const EMOJI_RE = /[⚛✓★☆✦]+/g;

const SIDEBAR_BOUNDARY = 150; // X-coordinate separating left sidebar from main content

/**
 * Line steps, in font sizes. Body text runs at 1.7 (18 pt at 10.5 pt) and a
 * paragraph break adds a blank line (36 pt): a wider gap starts a paragraph.
 * A sidebar item wraps at 1.25 (13 pt) and the next item starts at 1.6 (17 pt).
 */
const PARAGRAPH_GAP = 2.4;
const SIDEBAR_WRAP_GAP = 1.45;
/** A line this close to the page foot (46 pt at 10.5 pt) is the last one its page holds */
const PAGE_FOOT = 6;

/** Two lines of one text: a word cut at "user-" or "Tech/" goes on without a space */
const joinLines = (a: string, b: string) => (/\p{L}[-/]$/u.test(a) ? `${a}${b}` : `${a} ${b}`);

/** LinkedIn drops the line break between paragraphs of the About text: "côté.J'ai", never "Node.JS" */
const spaceSentences = (text: string) => text.replace(/([\p{Ll}\d)][.!?])(\p{Lu}(?=[\p{Ll}'’]))/gu, '$1 $2');

/** Lines of one text joined as written */
const joinAll = (lines: Line[]) => lines.map(l => l.text).reduce((text, line) => (text ? joinLines(text, line) : line), '');

const PLACE = /^[\wÀ-ÿ\s'-]+,\s*[\wÀ-ÿ\s'-]+,\s*[\wÀ-ÿ\s'-]+$/;

// ─── Internal types ─────────────────────────────────────────────────

export interface Token { text: string; fontSize: number; x: number; y: number; page: number }
interface Line  { text: string; role: FontRole; fontSize: number; x: number; y: number; page: number }
interface Section { name: string; lines: Line[] }

/** Mutable experience accumulator used during parsing, then finalized into Experience. */
interface ExpBuilder {
  company: string;
  position: string;
  start_date: string;
  end_date: string;
  location: string;
  /** Text in reading order, a paragraph or a bullet per entry */
  paragraphs: { text: string; bullet: boolean }[];
}

// ─── Step 1: Tokens → Lines (merge same-Y, same-role tokens) ───────

function tokensToLines(tokens: Token[]): Line[] {
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

// ─── Step 2: Detect LinkedIn format ─────────────────────────────────

function isLinkedInPDF(lines: Line[]): boolean {
  const hasName = lines.some(l => l.role === FontRole.NAME);
  const hasKnownSection = lines.some(l =>
    l.role === FontRole.SECTION_HEADER && SECTION_KEY[l.text.toLowerCase().trim()] != null,
  );
  // Font sizes alone are not a signature: a Word CV with a 26 pt name and a
  // 16 pt "Formation" matched, its 11 pt body was read as sidebar links and
  // dropped, and the near-empty result was accepted. Every LinkedIn export
  // prints the profile URL in its contact block.
  const hasProfileUrl = lines.some(l => l.text.includes('linkedin.com/in/'));
  return hasName && hasKnownSection && hasProfileUrl;
}

// ─── Step 3: Segment into header + named sections ───────────────────

function segmentSections(lines: Line[]): { header: Line[]; sections: Section[] } {
  const header: Line[] = [];
  const sections: Section[] = [];
  let current: Section | null = null;

  for (const line of lines) {
    if (line.role === FontRole.SECTION_HEADER) {
      const key = SECTION_KEY[line.text.toLowerCase().trim()];
      if (key) { current = { name: key, lines: [] }; sections.push(current); continue; }
    }
    (current ? current.lines : header).push(line);
  }

  return { header, sections };
}

// ─── Header helpers (page 1 left/right columns) ────────────────────

function splitColumns(headerLines: Line[]) {
  return {
    left:  headerLines.filter(l => l.x < SIDEBAR_BOUNDARY),
    right: headerLines.filter(l => l.x >= SIDEBAR_BOUNDARY),
  };
}

// ─── Parse personal info ────────────────────────────────────────────

function parsePersonalInfo(headerLines: Line[]): CVData['personal_info'] {
  const info: CVData['personal_info'] = { name: '', email: '' };
  const { left, right } = splitColumns(headerLines);

  // Name: the largest font on the page
  const nameLine = headerLines.find(l => l.role === FontRole.NAME);
  if (nameLine) info.name = nameLine.text.replace(EMOJI_RE, '').trim();

  // Title: COMPANY-sized lines in right column, then the location line. The
  // location is the last line, short and with no separator: "City, Region,
  // Country", or a LinkedIn area ("Paris et périphérie") no comma pattern
  // recognizes. It sits one line step below the headline like a wrapped title
  // would: its place decides, and every LinkedIn profile has a location.
  // Alone, only the comma pattern says the line is a place.
  const headline = right.filter(l => l.role === FontRole.COMPANY);
  const last = headline[headline.length - 1];
  const isPlace = last && last.text.length < 60 && !/[|·@]/.test(last.text)
    && (headline.length > 1 || PLACE.test(last.text));
  if (isPlace) {
    info.location = last.text;
    headline.pop();
  }
  const titleParts = headline.map(l => l.text);
  info.title = titleParts.join(' ').replace(EMOJI_RE, '').trim();
  if ((info.title?.length ?? 0) > 100) {
    info.title = info.title!.split('|').slice(0, 3).join('|').trim();
  }

  // Location fallback: first plausible BODY line in right column
  if (!info.location) {
    const loc = right.find(l =>
      l.role === FontRole.BODY && /^[\wÀ-ÿ\s-]+,\s*[\wÀ-ÿ\s-]+/.test(l.text)
      && !l.text.includes('•') && !l.text.includes('✓'),
    );
    if (loc) info.location = loc.text;
  }

  // Left sidebar: email, phone, LinkedIn
  for (const l of left) {
    if (l.role !== FontRole.BODY) continue;
    if (/@/.test(l.text) && !info.email) { info.email = l.text.trim(); continue; }
    if (!info.phone) {
      const cleaned = l.text.replace(/\((?:Mobile|Work|Home|Travail|Domicile)\)/gi, '').trim();
      const digits = cleaned.replace(/\D/g, '');
      if (digits.length >= 8 && digits.length <= 15 && /^[\d\s+()-]+$/.test(cleaned)) {
        info.phone = cleaned;
      }
    }
  }
  // LinkedIn URL: may span 2+ lines (SIDEBAR_LINK role, fs=11)
  // e.g. "www.linkedin.com/in/isabelle-" + "bouilloux-b2388240"
  // or   "www.linkedin.com/in/"          + "maximeblondel"
  const linkedinIdx = left.findIndex(l => l.text.includes('linkedin.com/in/'));
  if (linkedinIdx >= 0) {
    // Concatenate this line + subsequent same-role lines until we hit "(LinkedIn)" or a different role
    let url = left[linkedinIdx].text;
    for (let j = linkedinIdx + 1; j < left.length; j++) {
      const next = left[j];
      if (next.text.startsWith('(') || next.role !== left[linkedinIdx].role) break;
      url += next.text;
    }
    const m = url.match(/(linkedin\.com\/in\/[\w-]+)/);
    if (m) info.linkedin = `https://www.${m[1]}`;
  }

  // Summary: BODY lines in right column, not contact info nor the place
  const summaryText = joinAll(right.filter(l =>
    l.role === FontRole.BODY && !/@/.test(l.text) && l.text !== info.location && !PLACE.test(l.text)));
  if (summaryText) info.summary = spaceSentences(summaryText);

  return info;
}

// ─── Parse date range ───────────────────────────────────────────────

function parseDate(raw: string): { start: string; end: string } {
  const m = raw.match(DATE_RANGE_RE);
  if (!m) return { start: '', end: '' };

  const startMonth = MONTH[m[1].toLowerCase()] || m[1];
  const start = `${startMonth} ${m[2]}`;

  if (/present/i.test(m[3])) return { start, end: '' };

  const [endMonthRaw, endYear] = m[3].split(/\s+/);
  const endMonth = MONTH[endMonthRaw.toLowerCase()] || endMonthRaw;
  return { start, end: `${endMonth} ${endYear}` };
}

// ─── Parse experiences ──────────────────────────────────────────────

const stripBullet = (text: string) => text.replace(BULLET_START, '').trim();
const SENTENCES = /[\s\S]*?[.!?](?=\s|$)|[\s\S]+/g;

/**
 * The first paragraph is the intro when it is prose; every other paragraph and
 * bullet is a description entry, so no sentence of the export is lost (its
 * numbers are what the tailoring later backs a KPI with). A lead-in ending with
 * a colon only introduces the list below it, so it is neither. A role written
 * as one paragraph keeps two sentences as its intro and the rest as bullets.
 */
function buildExperience(b: ExpBuilder): Experience {
  const [first, ...rest] = b.paragraphs;
  let intro = first && !first.bullet && !first.text.endsWith(':') ? first.text : undefined;
  const entries = (intro === undefined ? b.paragraphs : rest).map(p => stripBullet(p.text));
  if (intro && entries.length === 0) {
    const sentences = (intro.match(SENTENCES) ?? []).map(s => s.trim()).filter(Boolean);
    intro = sentences.slice(0, 2).join(' ');
    entries.push(...sentences.slice(2));
  }
  return {
    company:    b.company,
    position:   b.position,
    start_date: b.start_date,
    end_date:   b.end_date,
    // An end date that could not be read is no proof the role goes on
    current:    Boolean(b.start_date) && !b.end_date,
    location:   b.location,
    intro,
    description: entries.filter(text => text && !text.endsWith(':')),
  };
}

/**
 * Whether a body line goes on with the paragraph above: one line step below it
 * on the same page, or at the top of the next page after the last line of its
 * page that did not end a sentence. A bullet always starts its own entry.
 */
function continuesParagraph(prev: Line | null, line: Line): boolean {
  if (!prev || isBulletLine(line.text)) return false;
  if (prev.page !== line.page) return prev.y <= line.fontSize * PAGE_FOOT && !/[.!?:]$/.test(prev.text);
  const gap = prev.y - line.y;
  return gap > 0 && gap <= line.fontSize * PARAGRAPH_GAP;
}

function parseExperiences(lines: Line[]): Experience[] {
  const result: Experience[] = [];
  let company = '';
  let cur: ExpBuilder | null = null;
  let sawBody = false;
  let companyChanged = false;
  /** The last line of text read into the current role, null after its dates and place */
  let prevText: Line | null = null;

  function flush() { if (cur) result.push(buildExperience(cur)); }

  for (const line of lines) {
    // ── Company name (fs 12) ──
    if (line.role === FontRole.COMPANY) {
      company = line.text.replace(EMOJI_RE, '').trim();
      companyChanged = true;
      continue;
    }

    // ── Position title (fs 11.5) ──
    if (line.role === FontRole.POSITION) {
      const title = line.text.replace(EMOJI_RE, '').trim();

      // Multi-line title continuation: same company, no body/date seen yet
      if (cur && !cur.start_date && !sawBody && !companyChanged) {
        cur.position += ' ' + title;
        continue;
      }

      flush();
      cur = {
        company: company || 'Non spécifié',
        position: title,
        start_date: '', end_date: '', location: '',
        paragraphs: [],
      };
      sawBody = false;
      companyChanged = false;
      prevText = null;
      continue;
    }

    // ── Body text (fs 10.5) ──
    if (line.role === FontRole.BODY && cur) {
      sawBody = true;
      const text = line.text.trim();

      // Date
      if (!cur.start_date && DATE_RANGE_RE.test(text)) {
        const d = parseDate(text);
        cur.start_date = d.start;
        cur.end_date = d.end;
        continue;
      }

      // Duration marker "(11 mois)" — skip
      if (/^\(\d+\s+\w+\)$/.test(text)) continue;

      // Location: first non-bullet line after date, before any text
      if (!cur.location && cur.start_date && cur.paragraphs.length === 0) {
        if (!isBulletLine(text) && text.length < 60 && !text.includes(':') && /[A-ZÀ-Ú]/.test(text[0])) {
          cur.location = text;
          continue;
        }
      }

      const last = cur.paragraphs[cur.paragraphs.length - 1];
      if (last && continuesParagraph(prevText, line)) {
        last.text = joinLines(last.text, text);
      } else {
        cur.paragraphs.push({ text, bullet: isBulletLine(text) });
      }
      prevText = line;
    }
  }

  flush();
  return result;
}

// ─── Parse education ────────────────────────────────────────────────

function parseEducation(lines: Line[]): Education[] {
  const result: Education[] = [];
  let school = '';

  for (const line of lines) {
    if (line.role === FontRole.COMPANY) { school = line.text.trim(); continue; }
    if (line.role !== FontRole.BODY || !school) continue;

    const text = line.text.trim();

    // "Degree, Field · (2010 - 2011)"
    const dot = text.match(/^(.+?)\s*·\s*\((\d{4})\s*-\s*(\d{4})\)$/);
    if (dot) {
      const [deg, ...field] = dot[1].split(',');
      result.push({ school, degree: deg.trim(), field: field.join(',').trim(), start_date: dot[2], end_date: dot[3] });
      school = '';
      continue;
    }

    // "Degree, Field, 2010 - 2014"
    const comma = text.match(/^(.+?),\s*(\d{4})\s*-\s*(\d{4})$/);
    if (comma) {
      const [deg, ...field] = comma[1].split(',');
      result.push({ school, degree: deg.trim(), field: field.join(',').trim(), start_date: comma[2], end_date: comma[3] });
      school = '';
      continue;
    }

    // "Degree, Field, 2014"
    const single = text.match(/^(.+?),\s*(\d{4})$/);
    if (single) {
      const [deg, ...field] = single[1].split(',');
      result.push({ school, degree: deg.trim(), field: field.join(',').trim(), start_date: '', end_date: single[2] });
      school = '';
    }
  }

  return result;
}

// ─── Parse skills (left sidebar) ────────────────────────────────────

function parseSkills(left: Line[]): CVData['skills'] {
  const idx = left.findIndex(l =>
    l.role === FontRole.SIDEBAR_HEADER && /principales compétences|top skills?/i.test(l.text),
  );
  if (idx === -1) return [];

  // A skill too long for the sidebar wraps one short step below: it is one skill
  const items: string[] = [];
  let prev: Line | null = null;
  for (let i = idx + 1; i < left.length; i++) {
    const line = left[i];
    if (line.role === FontRole.SIDEBAR_HEADER) break;
    const text = line.text.trim();
    if (line.role !== FontRole.BODY || text.length <= 1) continue;
    const wraps = prev && prev.page === line.page && prev.y - line.y <= line.fontSize * SIDEBAR_WRAP_GAP;
    if (wraps) items[items.length - 1] = joinLines(items[items.length - 1], text);
    else items.push(text);
    prev = line;
  }
  return items.length > 0 ? categorizeSkills(items) : [];
}

// ─── Parse languages (left sidebar) ─────────────────────────────────

function parseLanguages(left: Line[]): CVData['languages'] {
  const idx = left.findIndex(l =>
    l.role === FontRole.SIDEBAR_HEADER && /^languages?$|^langues$/i.test(l.text.trim()),
  );
  if (idx === -1) return [];

  // Collect all body text between Languages header and next sidebar header.
  // LinkedIn splits tokens unpredictably ("(Limited" on one Y, "Working)" on the next),
  // so we join everything into a blob and parse with a single regex pass.
  const parts: string[] = [];
  for (let i = idx + 1; i < left.length; i++) {
    if (left[i].role === FontRole.SIDEBAR_HEADER) break;
    if (left[i].role === FontRole.BODY) parts.push(left[i].text.trim());
  }
  const blob = parts.join(' ');

  // Match proficiency markers: "(Native or Bilingual)", "(Full Professional)", etc.
  const profRe = /\(([^)]*(?:Proficiency|Bilingual|Working|Professional|Elementary|Native)[^)]*)\)/gi;
  const langs: CVData['languages'] = [];
  const matches = [...blob.matchAll(profRe)];

  if (matches.length > 0) {
    // Format with proficiency levels: "Chinois (mandarin) (Limited Working) Français (Native or Bilingual)"
    let remaining = blob;
    for (const match of matches) {
      const i = remaining.indexOf(match[0]);
      const before = remaining.slice(0, i).replace(/\([^)]*\)/g, '').trim();
      remaining = remaining.slice(i + match[0].length);

      const name = before.split(/\s{2,}/).pop()?.trim();
      if (name && name.length > 1 && name.length < 30) {
        const key = match[1].toLowerCase().replace(/\s+/g, ' ').trim();
        langs.push({ name, proficiency: PROFICIENCY[key] || match[1].trim() });
      }
    }
  } else {
    // No proficiency markers — just language names listed (e.g. "Allemand Anglais Francais")
    for (const part of parts) {
      const name = part.trim();
      if (name.length > 1 && name.length < 30) {
        langs.push({ name, proficiency: '' });
      }
    }
  }

  return langs;
}

// ─── Main entry point ───────────────────────────────────────────────

/** The CV a LinkedIn export carries, read from its text items; null for any other PDF */
export function profileFromTokens(tokens: Token[]): CVData | null {
  const lines = tokensToLines(tokens);
  if (!isLinkedInPDF(lines)) return null;

  const { header, sections } = segmentSections(lines);
  const { left } = splitColumns(header);
  const personalInfo = parsePersonalInfo(header);

  // Some profiles have Summary as a standalone section rather than inline.
  // Whole: cut at 300 characters, it lost most of an About text.
  const summarySection = sections.find(s => s.name === 'summary');
  if (summarySection && !personalInfo.summary) {
    personalInfo.summary = spaceSentences(joinAll(summarySection.lines
      .filter(l => l.role === FontRole.BODY || l.role === FontRole.COMPANY)));
  }

  const expSection = sections.find(s => s.name === 'experience');
  const eduSection = sections.find(s => s.name === 'education');

  return {
    personal_info: personalInfo,
    experience:    expSection ? parseExperiences(expSection.lines) : [],
    education:     eduSection ? parseEducation(eduSection.lines)   : [],
    skills:        parseSkills(left),
    languages:     parseLanguages(left),
  };
}
