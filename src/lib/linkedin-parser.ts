/**
 * Deterministic LinkedIn PDF parser — zero API calls, instant extraction.
 *
 * The parser classifies each PDF text item by its font size (linkedin-lines.ts),
 * groups them into lines, segments by section header, then extracts structured
 * data: the header and sidebar (linkedin-header.ts), the experiences
 * (linkedin-experience.ts) and the education (here).
 *
 * Returns null for non-LinkedIn PDFs so the caller can fall back to AI.
 * Pure: the PDF is read into tokens by pdf-text-extract.ts.
 */

import type { CVData, Education } from '../shared/types';
import { FontRole, joinAll, spaceSentences, splitColumns, tokensToLines, type Line, type Token } from './linkedin-lines';
import { parseLanguages, parsePersonalInfo, parseSkills } from './linkedin-header';
import { parseExperiences } from './linkedin-experience';

export type { Token } from './linkedin-lines';

interface Section { name: string; lines: Line[] }

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

/** The header (page 1 before any section) and the named sections */
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

/** "Degree, Field · (2010 - 2011)", "Degree, Field, 2010 - 2014", "Degree, Field, 2014" */
const DEGREE_LINES: { re: RegExp; dates: (m: RegExpMatchArray) => [string, string] }[] = [
  { re: /^(.+?)\s*·\s*\((\d{4})\s*-\s*(\d{4})\)$/, dates: m => [m[2], m[3]] },
  { re: /^(.+?),\s*(\d{4})\s*-\s*(\d{4})$/, dates: m => [m[2], m[3]] },
  { re: /^(.+?),\s*(\d{4})$/, dates: m => ['', m[2]] },
];

function parseEducation(lines: Line[]): Education[] {
  const result: Education[] = [];
  let school = '';

  for (const line of lines) {
    if (line.role === FontRole.COMPANY) { school = line.text.trim(); continue; }
    if (line.role !== FontRole.BODY || !school) continue;

    const text = line.text.trim();
    for (const { re, dates } of DEGREE_LINES) {
      const m = text.match(re);
      if (!m) continue;
      const [deg, ...field] = m[1].split(',');
      const [start_date, end_date] = dates(m);
      result.push({ school, degree: deg.trim(), field: field.join(',').trim(), start_date, end_date });
      school = '';
      break;
    }
  }

  return result;
}

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
