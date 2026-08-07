// Company metadata options + stage localization.
// Lives in shared/ (zod-free) so UI imports don't drag convex/_ai/schemas.ts
// and its zod dependency into the editor bundle. convex/_ai/schemas.ts
// re-exports these for server-side use.

/** Curated suggestions surfaced in the UI dropdowns. The LLM is asked to pick one when confident.
 *  Stored value (canonical) is in French. Render-time translation via getLocalizedStage. */
export const COMPANY_STAGE_OPTIONS = [
  'Startup',
  'Scaleup',
  'PME',
  'Grande entreprise',
  'Multinationale',
  'Cabinet',
  'Secteur public',
  'Association',
] as const;

/** FR-canonical → EN label. Reverse-mapped for inputs that come in EN already. */
const STAGE_TRANSLATIONS_FR_TO_EN: Record<string, string> = {
  'Startup': 'Startup',
  'Scaleup': 'Scaleup',
  'PME': 'SME',
  'Grande entreprise': 'Large enterprise',
  'Multinationale': 'Multinational',
  'Cabinet': 'Consultancy',
  'Secteur public': 'Public sector',
  'Association': 'Non-profit',
};

const STAGE_EN_TO_FR: Record<string, string> = Object.fromEntries(
  Object.entries(STAGE_TRANSLATIONS_FR_TO_EN).map(([fr, en]) => [en.toLowerCase(), fr]),
);

/** Returns the stage label in the target language. Accepts either FR or EN input. */
export function getLocalizedStage(stored: string | null | undefined, language: 'fr' | 'en'): string {
  if (!stored) return '';
  const trimmed = stored.trim();
  if (!trimmed) return '';
  // Try FR canonical lookup first
  if (STAGE_TRANSLATIONS_FR_TO_EN[trimmed]) {
    return language === 'en' ? STAGE_TRANSLATIONS_FR_TO_EN[trimmed] : trimmed;
  }
  // Stored value may already be in EN — reverse-lookup
  const frCanonical = STAGE_EN_TO_FR[trimmed.toLowerCase()];
  if (frCanonical) {
    return language === 'en' ? STAGE_TRANSLATIONS_FR_TO_EN[frCanonical] : frCanonical;
  }
  // Unknown value — pass through as-is
  return trimmed;
}

/** Business models are international shorthand (B2C, SaaS…). No translation needed. */
export const COMPANY_BUSINESS_MODEL_OPTIONS = [
  'B2C',
  'B2B',
  'B2B2C',
  'B2G',
  'D2C',
  'Marketplace',
  'SaaS',
] as const;
