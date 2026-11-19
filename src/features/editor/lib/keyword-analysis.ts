// ─── ATS score: the offer's requirements against what the CV prints ───
// Pure, and imported by the Convex functions too: relative imports only (the
// Convex bundler does not resolve the "@/" alias), types imported as types.

import type {
  ATSReport, CVData, CVSection, DesignSettings, Experience, JobRequirement, ReadabilityCheck, RequirementCoverage, ScopedYearEvidence,
} from '../../../shared/types';
import { matchPhrase, normalizeForMatch, prepareText, stripInlineMarkdown, type PreparedText } from '../../../shared/lib/text';
import { getLocalizedStage } from '../../../shared/constants/company-meta';
import { getCVLanguage, type SupportedLanguage } from '../../../lib/language-detection';
import { getActionBullets, getIntro, getVisibleSkills, isHidden, isSkillHidden, shouldShowKPI } from './display-modes';
import { getSkillCategoryTitle } from './ats-rules';
import type { SkillCategoryKey } from './skill-dictionary';
import { CEFR_LEVELS, declaresRequestedFluency, LANGUAGE_NAMES, localizeLanguageName, normalizeProficiency, proficiencyLevel } from './formatting';
import { experienceYearsIn, hasHomogeneousDates, hasReadableDates, statesExperienceYears, yearsOfExperience } from './experience-years';
import { fitsParserSizeLimit } from '../../../shared/lib/image-resize';
import { appendSkill } from './skill-dictionary';

// ─── What an ATS reads ───

/**
 * 'rendered': what the templates print, display modes applied, so what the PDF
 * carries. 'content': every experience, bullet, KPI and skill, for a CV no one
 * has fitted to its pages yet (the output of an AI generation).
 */
export type CVTextView = 'rendered' | 'content';

/** The Design toggle (includedSections) each part of the CV belongs to; the header is always printed */
const SECTION_TOGGLE: Record<Exclude<CVSection, 'title' | 'location'>, string> = {
  summary: 'summary', experience: 'experience', skills: 'skills', education: 'education', languages: 'languages',
};

type IncludedSections = Pick<DesignSettings, 'includedSections' | 'showPhoto'>;

// The header carries the title and the city, and is always printed
const isShown = (section: CVSection, design?: IncludedSections) =>
  section === 'title' || section === 'location'
  || !design?.includedSections || design.includedSections.includes(SECTION_TOGGLE[section]);

/**
 * Text of one experience as the templates print it: position, company, its
 * company tags (CompanyTags), intro, bullets and KPI, with the markdown the
 * templates render in the last three. The ATS score and the per-experience
 * relevance badge read the same text.
 */
export function experienceText(exp: Experience, view: CVTextView, language: SupportedLanguage = 'fr'): string[] {
  const tags = [getLocalizedStage(exp.companyStage, language), exp.companyBusinessModel];
  const md = (text: string | null | undefined) => stripInlineMarkdown(text);
  const parts = view === 'content'
    ? [exp.position, exp.company, ...tags, md(exp.intro), ...exp.description.map(md), md(exp.kpi)]
    : isHidden(exp)
      ? []
      : [exp.position, exp.company, ...tags, md(getIntro(exp)), ...getActionBullets(exp).map(md), shouldShowKPI(exp) ? md(exp.kpi) : undefined];
  return parts.filter((text): text is string => Boolean(text?.trim()));
}

/** The experiences whose dates and positions the CV prints */
function experiencesInView(cv: CVData, view: CVTextView, design?: IncludedSections): Experience[] {
  if (!isShown('experience', design)) return [];
  return view === 'content' ? cv.experience : cv.experience.filter(exp => !isHidden(exp));
}

/**
 * The text of each part of the CV. Single owner of "what the CV says": the
 * score reads it, and so does the PDF text check (pdfValidation).
 */
export function cvSections(cv: CVData, view: CVTextView, design?: IncludedSections): Record<CVSection, string[]> {
  const language = getCVLanguage(cv);
  const categoryTitle = (category: string) => getSkillCategoryTitle(category as SkillCategoryKey, language);
  const raw: Record<CVSection, (string | undefined)[]> = {
    title: [cv.personal_info.title],
    location: [cv.personal_info.location],
    // The templates render markdown in the summary, and print the other sections as typed
    summary: [stripInlineMarkdown(cv.personal_info.summary)],
    experience: cv.experience.flatMap(exp => experienceText(exp, view, language)),
    skills: cv.skills.flatMap(cat => {
      const items = view === 'content' ? cat.items : isSkillHidden(cat) ? [] : getVisibleSkills(cat);
      // A category with no item is not printed, its title neither
      return items.length > 0 ? [categoryTitle(cat.category), ...items] : [];
    }),
    education: cv.education.flatMap(edu => [edu.degree, edu.field, edu.school]),
    // Printed in the CV's language, as the templates print them
    languages: cv.languages.flatMap(lang => [localizeLanguageName(lang.name, language), normalizeProficiency(lang.proficiency, language)]),
  };
  const sections = {} as Record<CVSection, string[]>;
  for (const section of Object.keys(raw) as CVSection[]) {
    sections[section] = isShown(section, design)
      ? raw[section].filter((text): text is string => Boolean(text?.trim()))
      : [];
  }
  return sections;
}

// ─── The score ───

/** A title filters candidates first; a soft skill is never what decides */
function weightOf(r: JobRequirement): number {
  if (r.kind === 'screening') return 0;
  if (r.kind === 'soft_skill') return 1;
  return r.kind === 'title' || r.importance === 'required' ? 3 : 1;
}

/**
 * Whether rewriting the CV can cover this requirement: a degree, a language or
 * a number of years is a fact of the candidate's past, never a wording.
 */
export function isWritable(r: Pick<JobRequirement, 'kind'>): boolean {
  return !['education', 'language', 'experience_years', 'location', 'screening'].includes(r.kind);
}

/**
 * Whether a proof from the user can put this requirement in the CV: a rewrite
 * writes a skill or a bullet, and neither is a job title. The title of the CV
 * and the positions held are the user's own words, edited in the Contenu tab.
 */
export function isProvable(r: Pick<JobRequirement, 'kind'>): boolean {
  return isWritable(r) && r.kind !== 'title';
}

/** The kinds a rewrite writes without a proof: a skill, a tool, a method, a domain, a soft skill */
const WRITTEN_FREELY: readonly string[] = ['hard_skill', 'tool', 'method', 'domain', 'soft_skill'] satisfies JobRequirement['kind'][];

/**
 * Whether the tailoring writes this requirement even when the CV does not
 * prove it (arbitrage of 2026-10-07). A certification is checked like a
 * degree, so it stays a fact of the source. A list of what is allowed: a kind
 * read from storage that no longer exists takes nothing out of a CV.
 */
export function isWrittenFreely(r: Pick<JobRequirement, 'kind'>): boolean {
  return WRITTEN_FREELY.includes(r.kind);
}

/** Whether these fields, as the CV prints them, write the requirement */
export const writesRequirement = (fields: PreparedText[], r: Pick<JobRequirement, 'label' | 'variants'>): boolean =>
  [r.label, ...r.variants].some(term => fields.some(field => matchPhrase(term, field)));

/** A previous transfer objective never becomes evidence of acquired expertise. */
export function withoutTransferObjectives(summary?: string): string {
  return (summary ?? '').split('\n').filter(line => !/^(Objectifs de transfert vers ce poste|Transfer objectives for this role)\s*:/i.test(line.trim())).join('\n').trim();
}

/** Finalize authorized named skills; on translation, preserve only what the current source still writes. */
export function completeSkillCoverage(cv: CVData, requirements: JobRequirement[], options: {
  language: SupportedLanguage; offerLanguage?: SupportedLanguage; source?: CVData;
  objectiveIds?: readonly string[];
}): CVData {
  const fields = (data: CVData) => Object.values(cvSections(data, 'content')).flat().map(prepareText);
  const sourceFields = options.source && fields(options.source);
  const goals: string[] = [];
  let completed = requirements.filter(isWrittenFreely).reduce((next, r) => {
    if (sourceFields && !writesRequirement(sourceFields, r)) return next;
    const text = options.offerLanguage && options.offerLanguage !== options.language && r.variants.length ? r.variants[0] : r.label;
    if (options.objectiveIds?.includes(r.id)) { goals.push(text); return next; }
    if (writesRequirement(fields(next), r)) return next;
    return { ...next, skills: appendSkill(next.skills, text) };
  }, cv);
  if (goals.length) {
    const summary = withoutTransferObjectives(completed.personal_info.summary);
    const label = options.language === 'en' ? 'Transfer objectives for this role' : 'Objectifs de transfert vers ce poste';
    completed = { ...completed, personal_info: { ...completed.personal_info, summary: [summary, `${label}: ${[...new Set(goals)].join(', ')}.`].filter(Boolean).join('\n\n') } };
  }
  // The years the CV's dates add up to, written where an ATS parses words and
  // not dates. Only in front of a summary that exists: a lone sentence prints
  // worse than no summary at all, and the header line carries the mention anyway.
  const years = experienceYearsIn(completed, options.language);
  const summary = completed.personal_info.summary?.trim();
  if (years && summary && !statesExperienceYears(summary)) {
    completed = { ...completed, personal_info: { ...completed.personal_info, summary: `${years}. ${summary}` } };
  }
  return !options.source || options.source.skills.every(cat => !cat.displayMode || cat.displayMode === 'normal')
    ? { ...completed, skills: completed.skills.map(cat => ({ ...cat, displayMode: 'normal' })) } : completed;
}

/** A confirmation never carries over to a different minimum or condition with the same label. */
export const requirementConfirmationKey = (r: JobRequirement): string =>
  JSON.stringify([r.id, r.kind, normalizeForMatch(r.quote), r.minLevel ?? '', r.minYears ?? null, r.experienceScope ?? []]);

/** A freely added domain cannot turn an unrelated source career into specialized years. */
export function scopeEvidenceFor(source: CVData): ScopedYearEvidence[] {
  return source.experience.map(exp => ({
    company: exp.company, start_date: exp.start_date, ...(exp.end_date && { end_date: exp.end_date }), current: exp.current,
    sourceText: experienceText(exp, 'content', getCVLanguage(source)).join(' | '),
  }));
}

/** Shared by the score and page fitting, with source-only evidence for specialized years. */
export function yearsForRequirement(experiences: Experience[], requirement: JobRequirement, options: {
  view?: CVTextView; language?: SupportedLanguage; scopedYears?: ScopedYearEvidence[]; now?: Date;
} = {}): number {
  const scope = requirement.experienceScope;
  const relevant = !scope?.length ? experiences : experiences.filter(exp => {
    const evidence = options.scopedYears?.filter(item => item.company === exp.company && item.start_date === exp.start_date && item.end_date === exp.end_date && item.current === exp.current);
    const fields = evidence?.length ? evidence.map(item => prepareText(item.sourceText)) : experienceText(exp, options.view ?? 'rendered', options.language).map(prepareText);
    return writesRequirement(fields, { label: scope[0], variants: scope.slice(1) });
  });
  return yearsOfExperience(relevant, options.now);
}

/** The requirements of the offer the CV does not write */
export const gapsOf = (report: ATSReport): RequirementCoverage[] => report.requirements.filter(c => !c.found);

/** "Sr.", "Mgr", "Dév.", "Resp.": a parser matching job titles misses them (read normalized, accents gone) */
const ABBREVIATED_TITLE = /\b(sr|jr|mgr|dir|asst|resp)\b\.?|\bdev\./;

export interface ATSReportOptions {
  view?: CVTextView;
  design?: IncludedSections;
  now?: Date;
  scopedYears?: ScopedYearEvidence[];
}

/**
 * Weighted share of the offer's requirements present in the CV, as an ATS
 * searches them, plus the checks a parser needs. No correction factor: the
 * score is recounted by hand from the weights and points it returns.
 */
export function computeATSReport(cv: CVData, requirements: JobRequirement[], options: ATSReportOptions = {}): ATSReport {
  const { view = 'rendered', design, now } = options;
  const sections = cvSections(cv, view, design);
  const experiences = experiencesInView(cv, view, design);
  const prepared = Object.fromEntries(
    (Object.keys(sections) as CVSection[]).map(section => [section, prepareText(sections[section].join(' | '))]),
  ) as Record<CVSection, PreparedText>;
  const positions = prepareText(experiences.map(exp => exp.position).join(' | '));
  const coverage = requirements.map((requirement): RequirementCoverage => {
    const has = (text: PreparedText) => writesRequirement([text], requirement);
    const where = (candidates: CVSection[]) => candidates.filter(section => has(prepared[section]));
    let found: CVSection[];
    let unknown = false;
    let reason: string | undefined;
    let years: number | undefined;
    let directlyVerified = false;
    switch (requirement.kind) {
      case 'experience_years': {
        const scope = requirement.experienceScope;
        years = yearsForRequirement(experiences, requirement, { view, language: getCVLanguage(cv), scopedYears: options.scopedYears ?? cv.generation?.scopedYears, now });
        found = years >= (requirement.minYears ?? Infinity) ? ['experience'] : [];
        reason = scope?.length ? `Postes dont le CV source mentionne : ${scope[0]}. Durée d'utilisation à confirmer.` : undefined;
        break;
      }
      case 'title':
        found = [...where(['title']), ...(has(positions) ? ['experience' as const] : [])];
        break;
      case 'education':
        found = where(['education']);
        break;
      case 'certification': {
        // A skill named PMP or AWS is not a credential. Structured degree
        // records or an explicit certification claim in the same field are.
        found = isShown('education', design) && cv.education.some(edu => has(prepareText(edu.degree))) ? ['education'] : [];
        for (const section of ['summary', 'experience', 'skills'] as CVSection[]) {
          if (sections[section].some(text => {
            const statement = section === 'summary' ? withoutTransferObjectives(text) : text;
            const normalized = normalizeForMatch(statement);
            return has(prepareText(statement)) && /\b(certifi\p{L}*|accredit\p{L}*|credential\p{L}*)\b/u.test(normalized)
              && !/\b(non|not|sans|without)\s+(?:\w+\s+)?(?:certifi|accredit|credential)/u.test(normalized);
          })) found.push(section);
        }
        break;
      }
      case 'language': {
        const matching = isShown('languages', design) ? cv.languages.filter(lang => {
          const aliases = LANGUAGE_NAMES.find(names => names.some(name => normalizeForMatch(name) === normalizeForMatch(lang.name)));
          return (aliases ?? [lang.name]).some(name => has(prepareText(name)));
        }) : [];
        found = matching.length ? ['languages'] : [];
        directlyVerified = found.length > 0 && !requirement.minLevel && matching.some(lang => declaresRequestedFluency(lang.proficiency, requirement.quote));
        if (found.length && requirement.minLevel) {
          const levels = matching.map(lang => proficiencyLevel(lang.proficiency));
          const enough = levels.some(level => level && CEFR_LEVELS.indexOf(level) >= CEFR_LEVELS.indexOf(requirement.minLevel!));
          directlyVerified = enough && !/TOEIC|IELTS|TOEFL|certifi/i.test(requirement.quote);
          if (!enough) {
            found = [];
            unknown = levels.some(level => !level);
            reason = unknown ? `Niveau ${requirement.minLevel} demandé, niveau du CV à préciser.` : `Niveau ${requirement.minLevel} demandé, niveau déclaré insuffisant.`;
          }
        }
        break;
      }
      case 'screening':
        found = [];
        unknown = true;
        reason = 'Condition à vérifier dans le formulaire de candidature.';
        break;
      case 'location':
        found = where(['location']);
        break;
      default:
        found = where(['title', 'summary', 'experience', 'skills', 'education', 'languages']);
    }
    const confirmed = cv.confirmedRequirements?.includes(requirementConfirmationKey(requirement));
    if (requirement.needsVerification && !confirmed && !directlyVerified) {
      unknown = true;
      found = [];
      reason ??= 'Le libellé ne suffit pas : confirmez ce critère avec vos justificatifs.';
    } else if (requirement.needsVerification && confirmed) {
      unknown = false;
    }
    const isCovered = found.length > 0 || (requirement.kind === 'screening' && Boolean(confirmed));
    return {
      requirement, found: isCovered, sections: found, weight: weightOf(requirement),
      status: unknown ? 'unknown' : isCovered ? 'covered' : 'missing',
      ...(reason && { reason }),
      ...(requirement.kind === 'experience_years' && { years }),
    };
  });

  const total = coverage.reduce((sum, c) => sum + c.weight, 0);
  const covered = coverage.reduce((sum, c) => sum + (c.found ? c.weight : 0), 0);

  const { email = '', phone = '', location = '', title = '' } = cv.personal_info;
  // A check with nothing to read is not a check passed: `[].every` is true, so
  // a CV with no experience at all showed its dates and its titles conforming
  const titles = [title, ...experiences.map(exp => exp.position)].filter((t): t is string => Boolean(t?.trim()));
  const checks: ReadabilityCheck[] = [
    { id: 'email', passed: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) },
    { id: 'phone', passed: phone.replace(/\D/g, '').length >= 7 },
    { id: 'location', passed: location.trim().length > 0 },
    {
      id: 'titles',
      passed: titles.length > 0 && !titles.some(t => ABBREVIATED_TITLE.test(normalizeForMatch(t))),
    },
    { id: 'dates', passed: experiences.length > 0 && experiences.every(hasReadableDates) },
    // Both documented by Greenhouse among the resumes it cannot parse
    { id: 'dateFormat', passed: hasHomogeneousDates(experiences) },
    { id: 'size', passed: fitsParserSizeLimit(cv.personal_info.photo_url, design?.showPhoto), estimated: true },
  ];

  const required = coverage.filter(c => c.requirement.importance === 'required' && c.requirement.kind !== 'screening');

  return {
    score: total > 0 ? Math.round((100 * covered) / total) : null,
    requirements: coverage,
    points: { covered, total },
    required: { covered: required.filter(c => c.found).length, total: required.length },
    checks,
  };
}
