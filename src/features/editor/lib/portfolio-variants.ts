// ─── Portfolio variants ───
//
// Some candidates keep several versions of the same portfolio, one per role
// they apply for, and want the CV to link the version that matches the offer.
// The list of versions is personal data, so it lives entirely in the
// VITE_PORTFOLIO_VARIANTS environment variable: this repository ships no URL,
// no identity and no default. When the variable is absent — which is the case
// for anyone cloning the project — getPortfolioVariants() returns an empty
// list and the whole feature stays invisible in the UI.
//
// Expected value: a JSON array, for example
//   [
//     {
//       "id": "design-system",
//       "label": "Portfolio : Design System",
//       "url": "https://example.com/portfolio/design-system",
//       "anonUrl": "https://example.com/cv/8f2a",
//       "keywords": ["design system", "tokens", "figma", "composants"],
//       "en": {
//         "url": "https://example.com/portfolio/design-system?lang=EN",
//         "anonUrl": "https://example.com/cv/8f2a-en"
//       }
//     }
//   ]
// `anonUrl` is optional and used when the anonymize toggle is on. `en` is
// optional: the English version, linked whenever the CV prints in English.
// Its `label` replaces a French default label, its `anonUrl` the default
// anonymous link; each one left out falls back to the default.

import type { PersonalInfo } from '@/src/shared/types';
import type { SupportedLanguage } from '@/src/lib/language-detection';
import { matchPhrase, prepareText } from '@/src/shared/lib/text';

export interface PortfolioVariant {
  id: string;
  /** Shown in the CV header, e.g. "Portfolio : Design System" */
  label: string;
  url: string;
  /** Identity-free URL, used when the CV is anonymized */
  anonUrl?: string;
  /** Terms that make this variant the right answer to an offer */
  keywords: string[];
  /** The English version of the portfolio, linked on a CV printed in English */
  en?: { url: string; anonUrl?: string; label?: string };
}

const isHttp = (value: unknown) => typeof value === 'string' && /^https?:\/\//.test(value);

function isEnglishVersion(value: unknown): boolean {
  if (value === undefined) return true;
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return isHttp(v.url) && (v.anonUrl === undefined || isHttp(v.anonUrl)) && (v.label === undefined || typeof v.label === 'string');
}

function withValidEnglish(variant: PortfolioVariant): PortfolioVariant {
  if (isEnglishVersion(variant.en)) return variant;
  console.warn(`[portfolio] variant "${variant.id}": its "en" block needs an http(s) url, English version ignored`);
  const { en: _ignored, ...rest } = variant;
  void _ignored;
  return rest;
}

function isVariant(value: unknown): value is PortfolioVariant {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' && v.id.length > 0
    && typeof v.label === 'string' && v.label.length > 0
    && isHttp(v.url)
    && (v.anonUrl === undefined || isHttp(v.anonUrl))
    && Array.isArray(v.keywords) && v.keywords.every(k => typeof k === 'string')
  );
}

let cached: PortfolioVariant[] | null = null;

/**
 * Parse the configured variants. Malformed entries are dropped rather than
 * thrown: a typo in an env var must not take the editor down, and an empty
 * list simply means the feature is off.
 */
export function getPortfolioVariants(): PortfolioVariant[] {
  if (cached) return cached;

  const raw = import.meta.env.VITE_PORTFOLIO_VARIANTS;
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    cached = [];
    return cached;
  }

  try {
    const parsed = JSON.parse(raw);
    // A malformed English version is dropped alone: the variant and its default link stay
    cached = Array.isArray(parsed) ? parsed.filter(isVariant).map(withValidEnglish) : [];
  } catch {
    console.warn('[portfolio] VITE_PORTFOLIO_VARIANTS is not valid JSON, feature disabled');
    cached = [];
  }
  return cached;
}

/** Write a variant onto a CV's personal info. Returns a new object. */
export function applyVariantToPersonalInfo(personalInfo: PersonalInfo, variant: PortfolioVariant): PersonalInfo {
  return {
    ...personalInfo,
    portfolio_url: variant.url,
    portfolio_label: variant.label,
    portfolio_anon_url: variant.anonUrl,
  };
}

export interface VariantMatch {
  variant: PortfolioVariant;
  /** How many of the variant's keywords the offer mentions */
  hits: number;
}

/**
 * Every variant, ordered by how strongly the offer calls for it: most keywords
 * mentioned first. Ties keep declaration order, so the list order doubles as
 * priority.
 *
 * Matching ignores accents and plurals: a real offer writes "système de
 * design" or "accessibilité" where the config says "systeme de design", and an
 * exact regex used to miss them, so no suggestion ever showed up.
 *
 * The first entry is only a suggestion when its hits are above zero —
 * proposing an unrelated portfolio is worse than proposing none.
 */
export function rankPortfolioVariants(
  variants: PortfolioVariant[],
  jobDescription: string,
): VariantMatch[] {
  const hasOffer = jobDescription.trim().length > 0;
  const text = prepareText(jobDescription);
  return variants
    .map(variant => ({
      variant,
      hits: hasOffer ? variant.keywords.filter(k => matchPhrase(k, text)).length : 0,
    }))
    .sort((a, b) => b.hits - a.hits);
}

/**
 * Link the best-matching variant on a CV the AI just proposed for an offer.
 *
 * A link the user typed by hand is never replaced: only an empty slot, or a
 * link that already is one of the variants, gets (re)assigned. Returns the CV
 * untouched when no variant matches the offer.
 */
export function withSuggestedPortfolio<T extends { personal_info: PersonalInfo }>(
  cv: T,
  jobDescription: string,
  variants: PortfolioVariant[] = getPortfolioVariants(),
): T {
  const [top] = rankPortfolioVariants(variants, jobDescription);
  if (!top || top.hits === 0) return cv;
  const current = cv.personal_info.portfolio_url?.trim();
  if (current && !variants.some(v => v.url === current)) return cv;
  return { ...cv, personal_info: applyVariantToPersonalInfo(cv.personal_info, top.variant) };
}

/**
 * The portfolio link a CV prints, in the CV's language. The CV stores the
 * variant's default (French) link, in both languages, since the link is the
 * user's field; a variant with an English version swaps it here, its anonymous
 * link as well. A link typed by hand, matching no variant, prints as typed.
 */
export function portfolioIn(
  link: { url: string; label: string },
  language: SupportedLanguage,
  variants: PortfolioVariant[] = getPortfolioVariants(),
): { url: string; label: string } {
  for (const v of variants) {
    const anonymous = link.url === v.anonUrl || link.url === v.en?.anonUrl;
    if (!anonymous && link.url !== v.url && link.url !== v.en?.url) continue;
    const english = language === 'en' && v.en;
    const url = anonymous
      ? (english ? v.en!.anonUrl : v.anonUrl) ?? link.url
      : english ? v.en!.url : v.url;
    const label = english && v.en!.label && link.label === v.label ? v.en!.label : link.label;
    return { url, label };
  }
  return link;
}
