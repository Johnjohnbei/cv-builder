import type { CVData, JobRequirement } from "../../src/shared/types";
import { getSkillCategoryTitle } from "../../src/features/editor/lib/atsRules";
import type { SkillCategoryKey } from "../../src/features/editor/lib/skillDictionary";
import { matchPhrase, normalizeForMatch, prepareText, stripInlineMarkdown, type PreparedText } from "../../src/shared/lib/text";
import { getLocalizedStage } from "../../src/shared/constants/companyMeta";
import { hasUnbackedNumber } from "./numbers";

// ─── Truth guard of the tailoring (plan § 4.1, step 3) ──────────────
// Extracted from tailor.ts, over its size limit. Code, never AI: what the
// tailored CV writes must be backed by the source CV.

/** A proof quote shorter than this ("Designer") proves anything */
const MIN_QUOTE_WORDS = 3;

const termsOf = (r: JobRequirement) => [r.label, ...r.variants];

/** Whether `text`, as the templates print it (markdown rendered), writes one of `requirements` */
function mentions(text: string | undefined, requirements: JobRequirement[]): boolean {
  if (!text?.trim()) return false;
  const prepared = prepareText(stripInlineMarkdown(text));
  return requirements.some(r => termsOf(r).some(term => matchPhrase(term, prepared)));
}

/** Words that say nothing of a skill, a degree or a language ("pour", "with", "degree") */
const STOP_WORDS = new Set([
  "de","du", "des", "le", "la", "les", "en", "et", "au", "aux", "un", "une", "pour", "avec", "dans", "sans", "chez", "sur",
  "par", "plus", "tout", "tous", "toute", "toutes", "entre", "vers", "sous", "comme", "afin", "leur", "leurs", "cette",
  "ces", "notre", "nos", "votre", "vos", "aupres", "depuis", "pendant", "selon",
  "of", "in", "on", "at", "to", "the", "and", "for", "with", "from", "into", "that", "this", "these", "those", "your",
  "our", "their", "over", "about", "across", "within", "using", "more", "than", "through", "between", "while",
]);

/**
 * The stems of the words of `text` that carry meaning: a digit or a letter
 * alone ("Bac+5", "M.A.", "Bac S") is one; an elision ("d'", "l'") or the "'s"
 * of "Master's" is not, recognized by its apostrophe, never by its letter.
 */
const stemsOf = (text: string | undefined) => normalizeForMatch(text ?? "")
  .replace(/(?<![\p{L}\p{N}])(?:qu|[cdjlmnst])'|'s(?![\p{L}\p{N}])/gu, " ")
  .split(/[^\p{L}\p{N}]+/u)
  .filter(word => word.length > 0 && !STOP_WORDS.has(word))
  .map(word => prepareText(word).stemmed);

/** Whether two texts share a word stem of 4 letters or more ("recherche utilisateur" and "entretiens utilisateurs") */
function shareStem(a: string, b: string): boolean {
  const stems = new Set(stemsOf(a).filter(stem => stem.length >= 4));
  return stemsOf(b).some(stem => stems.has(stem));
}

/** Every meaningful word of `entry` is a word of `source`, or one of `alike` ("Master's degree in design" of "Master design") */
function namesOnly(entry: string, source: string, alike: (stem: string) => string[] = () => []): boolean {
  const allowed = new Set(stemsOf(source).flatMap(stem => [stem, ...alike(stem)]));
  const words = stemsOf(entry);
  // An emptied entry names nothing: the source's comes back
  return words.length > 0 && words.every(stem => allowed.has(stem) || DEGREE_WORDS.has(stem));
}

const DEGREE_WORDS = new Set(stemsOf("degree diploma diplome"));

/**
 * The requirements the source CV proves: one of its fields writes them, or the
 * model's quote for them is words of a field and shares a word with them
 * ("Mené 30 entretiens utilisateurs" for "recherche utilisateur"). Any words of
 * the source used to prove any requirement.
 */
export function provenIds(requirements: JobRequirement[], fields: PreparedText[], evidence: Map<string, string>): Set<string> {
  const quoted = (r: JobRequirement) => {
    const quote = evidence.get(r.id);
    if (!quote || normalizeForMatch(quote).split(" ").length < MIN_QUOTE_WORDS) return false;
    return termsOf(r).some(term => shareStem(term, quote)) && fields.some(field => matchPhrase(quote, field));
  };
  return new Set(requirements
    .filter(r => termsOf(r).some(term => fields.some(field => matchPhrase(term, field))) || quoted(r))
    .map(r => r.id));
}

/** A language's name in French and in English: a CV written for an English offer translates them */
const LANGUAGE_NAMES = [
  ["francais", "french"], ["anglais", "english"], ["espagnol", "spanish"], ["allemand", "german"],
  ["italien", "italian"], ["portugais", "portuguese"], ["neerlandais", "dutch"], ["chinois", "chinese", "mandarin"],
  ["japonais", "japanese"], ["arabe", "arabic"], ["russe", "russian"],
];

/** A language name's stem, and the stems of its translations */
const LANGUAGE_STEMS = LANGUAGE_NAMES.map(names => names.flatMap(stemsOf));
const translations = (stem: string) => LANGUAGE_STEMS.find(stems => stems.includes(stem)) ?? [];

export interface GuardContext {
  source: CVData;
  unproven: JobRequirement[];
  /**
   * Every reading of every number the source gives: its content, the years of
   * its dates and the years of experience they add up to.
   * ponytail: a set, not a position; a number of one role backs it in another.
   */
  sourceNumbers: Set<string>;
  /** The CV is written in the source's language: a source bullet can stand in for an invented one */
  sameLanguage: boolean;
}

/**
 * The CV without what nothing in the source backs: a requirement the source
 * does not prove, or a number it never gives (FABRICATION_GUARD, KPI of the
 * arbitrage Q2), wherever the model wrote it. A bullet takes back the source's
 * bullet at its place when the bullets still line up, a sentence of the summary
 * or an intro is removed, a KPI emptied, a skill removed, a title, position,
 * tag or category name goes back to the source's. Degrees and languages are
 * the source's, in the model's words only when those name the same entry.
 */
export function guard(cv: CVData, { source, unproven, sourceNumbers, sameLanguage }: GuardContext): CVData {
  const writes = (text?: string) => mentions(text, unproven);
  const invents = (text?: string) => writes(text) || hasUnbackedNumber(text, sourceNumbers);
  const sentencesKept = (text?: string) => text?.split(/(?<=[.!?])\s+/).filter(s => !invents(s)).join(" ");
  const localized = (write: (language: "fr" | "en") => string) => writes(write("fr")) || writes(write("en"));
  return {
    ...cv,
    personal_info: {
      ...cv.personal_info,
      title: invents(cv.personal_info.title) ? source.personal_info.title : cv.personal_info.title,
      summary: sentencesKept(cv.personal_info.summary),
    },
    experience: cv.experience.map((exp, i) => {
      const src = source.experience[i];
      const lineUp = sameLanguage && exp.description.length === src.description.length;
      const bullets = exp.description.map((bullet, b) => (!invents(bullet) ? bullet : lineUp ? src.description[b] : undefined));
      return {
        ...exp,
        position: invents(exp.position) ? src.position : exp.position,
        companyStage: localized(lang => getLocalizedStage(exp.companyStage, lang)) ? src.companyStage : exp.companyStage,
        companyBusinessModel: invents(exp.companyBusinessModel) ? src.companyBusinessModel : exp.companyBusinessModel,
        intro: sentencesKept(exp.intro),
        kpi: invents(exp.kpi) ? "" : exp.kpi,
        description: bullets.filter((b, at): b is string => b !== undefined && bullets.indexOf(b) === at),
      };
    }),
    // Entries are matched to the source's by what they name, never by their place
    // alone: the model's words are kept only when they add none (a translated
    // degree the words of which differ goes back to the source's wording)
    education: source.education.map((src, i) => {
      const edu = cv.education[i];
      const same = edu && namesOnly(`${edu.degree} ${edu.field ?? ""}`, `${src.degree} ${src.field ?? ""}`);
      return same ? { ...src, degree: edu.degree, field: edu.field } : src;
    }),
    languages: source.languages.map((src, i) => {
      const lang = cv.languages[i];
      return lang && namesOnly(lang.name, src.name, translations) ? { ...src, name: lang.name } : src;
    }),
    skills: cv.skills
      .map((cat, i) => ({
        ...cat,
        category: writes(cat.category) || localized(lang => getSkillCategoryTitle(cat.category as SkillCategoryKey, lang))
          ? source.skills[i]?.category ?? "Compétences"
          : cat.category,
        items: cat.items.filter(item => !invents(item)),
      }))
      // A category emptied here is dropped, one the user left empty is kept
      .filter((cat, i) => cat.items.length > 0 || cv.skills[i].items.length === 0),
  };
}
