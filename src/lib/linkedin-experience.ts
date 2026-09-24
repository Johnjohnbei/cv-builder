import type { Experience } from '../shared/types';
import { BULLET_START, EMOJI_RE, FontRole, isBulletLine, joinLines, PAGE_FOOT, PARAGRAPH_GAP, type Line } from './linkedin-lines';

// ─── LinkedIn export: the experiences ───────────────────────────────
// Extracted from linkedin-parser.ts, over its size limit.

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

/** Matches "juin 2025 - Present" or "décembre 2024 - avril 2025" (+ optional duration). */
const DATE_RANGE_RE = /^([\wÀ-ÿ]+)\s+(\d{4})\s*-\s*(present|[\wÀ-ÿ]+\s+\d{4})/i;

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

/**
 * One body line read into the role: its dates, its place, or its text.
 * Returns whether the line is text, the one the next line may continue.
 */
function readBodyLine(cur: ExpBuilder, line: Line, prevText: Line | null): boolean {
  const text = line.text.trim();
  if (!cur.start_date && DATE_RANGE_RE.test(text)) {
    const d = parseDate(text);
    cur.start_date = d.start;
    cur.end_date = d.end;
    return false;
  }
  // Duration marker "(11 mois)"
  if (/^\(\d+\s+\w+\)$/.test(text)) return false;
  // Location: first non-bullet line after date, before any text
  const beforeText = !cur.location && cur.start_date && cur.paragraphs.length === 0;
  if (beforeText && !isBulletLine(text) && text.length < 60 && !text.includes(':') && /[A-ZÀ-Ú]/.test(text[0])) {
    cur.location = text;
    return false;
  }
  const last = cur.paragraphs[cur.paragraphs.length - 1];
  if (last && continuesParagraph(prevText, line)) last.text = joinLines(last.text, text);
  else cur.paragraphs.push({ text, bullet: isBulletLine(text) });
  return true;
}

export function parseExperiences(lines: Line[]): Experience[] {
  const result: Experience[] = [];
  let company = '';
  let cur: ExpBuilder | null = null;
  let sawBody = false;
  let companyChanged = false;
  /** The last line of text read into the current role, null after its dates and place */
  let prevText: Line | null = null;

  for (const line of lines) {
    if (line.role === FontRole.COMPANY) {
      company = line.text.replace(EMOJI_RE, '').trim();
      companyChanged = true;
    } else if (line.role === FontRole.POSITION) {
      const title = line.text.replace(EMOJI_RE, '').trim();
      // Multi-line title continuation: same company, no body/date seen yet
      if (cur && !cur.start_date && !sawBody && !companyChanged) {
        cur.position += ' ' + title;
        continue;
      }
      if (cur) result.push(buildExperience(cur));
      cur = { company: company || 'Non spécifié', position: title, start_date: '', end_date: '', location: '', paragraphs: [] };
      sawBody = false;
      companyChanged = false;
      prevText = null;
    } else if (line.role === FontRole.BODY && cur) {
      sawBody = true;
      if (readBodyLine(cur, line, prevText)) prevText = line;
    }
  }

  if (cur) result.push(buildExperience(cur));
  return result;
}
