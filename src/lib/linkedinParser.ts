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
 */

import * as pdfjsLib from 'pdfjs-dist';
import type { CVData, Experience, Education } from '../shared/types';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).toString();

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

const BULLET_CHARS = new Set(['•', '-', '✓', '⚛']);

const EMOJI_RE = /[⚛✓★☆✦]+/g;

const SIDEBAR_BOUNDARY = 150; // X-coordinate separating left sidebar from main content

// ─── Internal types ─────────────────────────────────────────────────

interface Token { text: string; fontSize: number; x: number; y: number; page: number }
interface Line  { text: string; role: FontRole; fontSize: number; x: number; y: number; page: number }
interface Section { name: string; lines: Line[] }

/** Mutable experience accumulator used during parsing, then finalized into Experience. */
interface ExpBuilder {
  company: string;
  position: string;
  start_date: string;
  end_date: string;
  location: string;
  description: string[];
  proseBuf: string;   // collects non-bullet text → becomes intro
}

// ─── Step 1: PDF → Tokens ───────────────────────────────────────────

async function extractTokens(file: File): Promise<Token[]> {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const tokens: Token[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      tokens.push({
        text:     item.str.trim(),
        fontSize: Math.round(item.transform[0] * 100) / 100,
        x:        Math.round(item.transform[4]),
        y:        Math.round(item.transform[5]),
        page:     p,
      });
    }
  }

  return tokens;
}

// ─── Step 2: Tokens → Lines (merge same-Y, same-role tokens) ───────

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

// ─── Step 3: Detect LinkedIn format ─────────────────────────────────

function isLinkedInPDF(lines: Line[]): boolean {
  const hasName = lines.some(l => l.role === FontRole.NAME);
  const hasKnownSection = lines.some(l =>
    l.role === FontRole.SECTION_HEADER && SECTION_KEY[l.text.toLowerCase().trim()] != null,
  );
  return hasName && hasKnownSection;
}

// ─── Step 4: Segment into header + named sections ───────────────────

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

  // Title: COMPANY-sized lines in right column, up to the location line.
  // Location is "City, Region, Country" — short (< 60 chars), no pipes, no special chars.
  const titleParts: string[] = [];
  for (const tl of right.filter(l => l.role === FontRole.COMPANY)) {
    if (tl.text.length < 60 && !tl.text.includes('|') && !tl.text.includes('@') &&
        /^[\wÀ-ÿ\s'-]+,\s*[\wÀ-ÿ\s'-]+,\s*[\wÀ-ÿ\s'-]+$/.test(tl.text)) {
      info.location = tl.text;
      break;
    }
    titleParts.push(tl.text);
  }
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

  // Summary: longer BODY lines in right column (not contact info)
  const summaryText = right
    .filter(l => l.role === FontRole.BODY && l.text.length > 20 && !/@/.test(l.text))
    .map(l => l.text).join(' ');
  if (summaryText) info.summary = summaryText.length > 300 ? summaryText.slice(0, 297) + '...' : summaryText;

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

function buildExperience(b: ExpBuilder): Experience {
  const current = !b.end_date;
  const prose = b.proseBuf.trim();
  let intro: string | undefined;

  if (prose) {
    const sentences = prose.split(/(?<=[.!?])\s+/).filter(s => s.length > 10);
    intro = sentences.slice(0, 2).join(' ');
    if (intro.length > 200) intro = intro.slice(0, 197) + '...';

    // No bullets found — derive from prose
    if (b.description.length === 0 && prose.length > 50) {
      b.description = sentences.slice(0, 4).map(s => s.trim());
    }
  }

  return {
    company:    b.company,
    position:   b.position,
    start_date: b.start_date,
    end_date:   b.end_date,
    current,
    location:   b.location,
    intro,
    description: b.description,
  };
}

function parseExperiences(lines: Line[]): Experience[] {
  const result: Experience[] = [];
  let company = '';
  let cur: ExpBuilder | null = null;
  let sawBody = false;
  let companyChanged = false;

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
        description: [], proseBuf: '',
      };
      sawBody = false;
      companyChanged = false;
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

      // Location: first non-bullet line after date, before any description
      if (!cur.location && cur.start_date && cur.description.length === 0 && !cur.proseBuf) {
        const isBullet = BULLET_CHARS.has(text[0]);
        if (!isBullet && text.length < 60 && !text.includes(':') && /[A-ZÀ-Ú]/.test(text[0])) {
          cur.location = text;
          continue;
        }
      }

      // Bullets → description array
      if (BULLET_CHARS.has(text[0])) {
        cur.description.push(text.replace(/^[•\-✓⚛]\s*/, '').trim());
      } else {
        cur.proseBuf += (cur.proseBuf ? ' ' : '') + text;
      }
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

  const items: string[] = [];
  for (let i = idx + 1; i < left.length; i++) {
    if (left[i].role === FontRole.SIDEBAR_HEADER) break;
    if (left[i].role === FontRole.BODY && left[i].text.trim().length > 1) {
      items.push(left[i].text.trim());
    }
  }
  return items.length > 0 ? [{ category: 'Compétences clés', items }] : [];
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

export async function parseLinkedInPDF(file: File): Promise<CVData | null> {
  try {
    const tokens = await extractTokens(file);
    const lines = tokensToLines(tokens);
    if (!isLinkedInPDF(lines)) return null;

    const { header, sections } = segmentSections(lines);
    const { left } = splitColumns(header);

    const personalInfo = parsePersonalInfo(header);

    // Some profiles have Summary as a standalone section rather than inline
    const summarySection = sections.find(s => s.name === 'summary');
    if (summarySection && !personalInfo.summary) {
      personalInfo.summary = summarySection.lines
        .filter(l => l.role === FontRole.BODY || l.role === FontRole.COMPANY)
        .map(l => l.text).join(' ').slice(0, 300);
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
  } catch (err) {
    console.warn('[Calibre] LinkedIn parser failed, falling back to AI:', err);
    return null;
  }
}
