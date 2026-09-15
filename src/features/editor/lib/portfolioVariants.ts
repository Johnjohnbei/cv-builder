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
//       "keywords": ["design system", "tokens", "figma", "composants"]
//     }
//   ]
// `anonUrl` is optional and used when the anonymize toggle is on.

import type { PersonalInfo } from '@/src/shared/types';
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
}

function isVariant(value: unknown): value is PortfolioVariant {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' && v.id.length > 0
    && typeof v.label === 'string' && v.label.length > 0
    && typeof v.url === 'string' && /^https?:\/\//.test(v.url)
    && (v.anonUrl === undefined || (typeof v.anonUrl === 'string' && /^https?:\/\//.test(v.anonUrl)))
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
    cached = Array.isArray(parsed) ? parsed.filter(isVariant) : [];
  } catch {
    console.warn('[portfolio] VITE_PORTFOLIO_VARIANTS is not valid JSON — feature disabled');
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
