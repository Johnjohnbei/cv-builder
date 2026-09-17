import type { CVData } from '../shared/types';
import { categorizeSkills } from '@/src/features/editor/lib/skillDictionary';
import {
  EMOJI_RE, FontRole, joinAll, joinLines, PLACE, SIDEBAR_WRAP_GAP, spaceSentences, splitColumns, type Line,
} from './linkedinLines';

// ─── LinkedIn export: the page 1 header and the left sidebar ────────
// Extracted from linkedinParser.ts, over its size limit.

type PersonalInfo = CVData['personal_info'];

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

/**
 * Title: COMPANY-sized lines in the main column, then the location line. The
 * location is the last line, short and with no separator: "City, Region,
 * Country", or a LinkedIn area ("Paris et périphérie") no comma pattern
 * recognizes. It sits one line step below the headline like a wrapped title
 * would: its place decides, and every LinkedIn profile has a location. Alone,
 * only the comma pattern says the line is a place.
 */
function readHeadline(right: Line[], info: PersonalInfo): void {
  const headline = right.filter(l => l.role === FontRole.COMPANY);
  const last = headline[headline.length - 1];
  const isPlace = last && last.text.length < 60 && !/[|·@]/.test(last.text)
    && (headline.length > 1 || PLACE.test(last.text));
  if (isPlace) {
    info.location = last.text;
    headline.pop();
  }
  info.title = headline.map(l => l.text).join(' ').replace(EMOJI_RE, '').trim();
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
}

/** Left sidebar: email, phone, LinkedIn */
function readContacts(left: Line[], info: PersonalInfo): void {
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
  const linkedinIdx = left.findIndex(l => l.text.includes('linkedin.com/in/'));
  if (linkedinIdx < 0) return;
  // This line + the next same-role lines until "(LinkedIn)" or another role
  let url = left[linkedinIdx].text;
  for (let j = linkedinIdx + 1; j < left.length; j++) {
    const next = left[j];
    if (next.text.startsWith('(') || next.role !== left[linkedinIdx].role) break;
    url += next.text;
  }
  const m = url.match(/(linkedin\.com\/in\/[\w-]+)/);
  if (m) info.linkedin = `https://www.${m[1]}`;
}

export function parsePersonalInfo(headerLines: Line[]): PersonalInfo {
  const info: PersonalInfo = { name: '', email: '' };
  const { left, right } = splitColumns(headerLines);

  // Name: the largest font on the page
  const nameLine = headerLines.find(l => l.role === FontRole.NAME);
  if (nameLine) info.name = nameLine.text.replace(EMOJI_RE, '').trim();

  readHeadline(right, info);
  readContacts(left, info);

  // Summary: BODY lines in right column, not contact info nor the place
  const summaryText = joinAll(right.filter(l =>
    l.role === FontRole.BODY && !/@/.test(l.text) && l.text !== info.location && !PLACE.test(l.text)));
  if (summaryText) info.summary = spaceSentences(summaryText);

  return info;
}

/** The sidebar lines under the header `title` matches, up to the next header */
function sidebarBlock(left: Line[], title: RegExp): Line[] {
  const idx = left.findIndex(l => l.role === FontRole.SIDEBAR_HEADER && title.test(l.text.trim()));
  if (idx === -1) return [];
  const next = left.findIndex((l, i) => i > idx && l.role === FontRole.SIDEBAR_HEADER);
  return left.slice(idx + 1, next === -1 ? undefined : next).filter(l => l.role === FontRole.BODY);
}

export function parseSkills(left: Line[]): CVData['skills'] {
  // A skill too long for the sidebar wraps one short step below: it is one skill
  const items: string[] = [];
  let prev: Line | null = null;
  for (const line of sidebarBlock(left, /principales compétences|top skills?/i)) {
    const text = line.text.trim();
    if (text.length <= 1) continue;
    const wraps = prev && prev.page === line.page && prev.y - line.y <= line.fontSize * SIDEBAR_WRAP_GAP;
    if (wraps) items[items.length - 1] = joinLines(items[items.length - 1], text);
    else items.push(text);
    prev = line;
  }
  return items.length > 0 ? categorizeSkills(items) : [];
}

export function parseLanguages(left: Line[]): CVData['languages'] {
  // LinkedIn splits tokens unpredictably ("(Limited" on one Y, "Working)" on the
  // next), so everything is joined into a blob and parsed in one regex pass.
  const parts = sidebarBlock(left, /^languages?$|^langues$/i).map(l => l.text.trim());
  const blob = parts.join(' ');

  // Proficiency markers: "(Native or Bilingual)", "(Full Professional)", etc.
  const profRe = /\(([^)]*(?:Proficiency|Bilingual|Working|Professional|Elementary|Native)[^)]*)\)/gi;
  const matches = [...blob.matchAll(profRe)];
  // No proficiency markers: just names listed ("Allemand Anglais Francais")
  if (matches.length === 0) {
    return parts.filter(name => name.length > 1 && name.length < 30).map(name => ({ name, proficiency: '' }));
  }

  // "Chinois (mandarin) (Limited Working) Français (Native or Bilingual)"
  const langs: CVData['languages'] = [];
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
  return langs;
}
