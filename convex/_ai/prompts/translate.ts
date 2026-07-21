// Pure 1:1 translation of CV content while preserving EXACT JSON structure.
// Distinct from optimize/tailor which rewrite content — translate only swaps
// languages. Same number of bullets, same KPIs, same skills order, same intros.

export interface TranslateContext {
  cvData: unknown;
  targetLanguage: 'fr' | 'en';
}

export function buildTranslatePrompt(ctx: TranslateContext): string {
  const targetLang = ctx.targetLanguage === 'en' ? 'English' : 'French (français)';
  const sourceLang = ctx.targetLanguage === 'en' ? 'French' : 'English';
  const cvJson = JSON.stringify(ctx.cvData);

  return `You are a professional CV translator. The CV below is in ${sourceLang}. Produce the SAME CV in ${targetLang}.

═══ TWO DIFFERENT THINGS — DO NOT CONFUSE THEM ═══

A) STRUCTURE (JSON keys, array lengths, ordering) → PRESERVE EXACTLY. Same keys, same number of elements, same order. Add nothing, remove nothing.

B) CONTENT (every human-readable text value) → TRANSLATE EVERY ONE to ${targetLang}. This is the whole point of the task. A "preserved structure" with untranslated content is a FAILURE.

═══ FIELDS THAT MUST BE TRANSLATED (non-exhaustive checklist) ═══

You MUST translate the following text values to ${targetLang}. If you leave any of these in ${sourceLang}, the output is broken:

- personal_info.title (e.g. "Designer produit" → "Product designer")
- personal_info.summary (the full paragraph at the top)
- For EACH experience in experience[]:
  • position (e.g. "Chef de produit" → "Product Manager")
  • intro (the 1-2 line role description)
  • EACH bullet in description[] (these are the most important — translate ALL of them, every single one)
  • kpi (e.g. "Équipe de 8" → "Team of 8")
  • location if present
- For EACH education in education[]:
  • school is often a proper noun (HEC, MIT) — keep
  • degree (e.g. "Master en design" → "Master in Design")
  • field
- For EACH skill category in skills[]:
  • category label (e.g. "Compétences techniques" → "Technical Skills")
  • items are usually tech names (React, Figma) — keep as-is
- For EACH language in languages[]: translate the language NAME only (e.g. "Anglais" → "English")

═══ DO NOT TRANSLATE ═══

- Proper nouns: company names (Renault, Google), people names, product names (Renault Easy Link, Cœurdar)
- Technologies / tools (React, Figma, SAP, GA4, Python)
- Email addresses, URLs, phone numbers
- Dates ("Mai 2026", "May 2024", "2021-09") — these are localized at render time, leave the input format
- IDs, displayMode values, booleans, null values
- companyStage / companyBusinessModel — these are enum values from a fixed list, leave as-is
- languages[].proficiency — leave the RAW value untouched (e.g. "Full professional", "Native or bilingual"). It is localized at render time by the app, exactly like dates. Translating it breaks that localization.

═══ STYLE ═══

- Match the source's register (formal/casual)
- Match the source's brevity (concise stays concise)
- Use idiomatic ${targetLang} (not literal word-for-word). "Pilote une équipe" → "Leads a team", not "Pilots a team"
- Action verbs in bullets should use strong ${targetLang} equivalents: Pilote→Leads, Conçoit→Designs, Orchestre→Orchestrates, Déploie→Deploys, Optimise→Optimizes, Structure→Structures, Dirige→Directs

═══ VERIFICATION BEFORE OUTPUT ═══

Before returning, mentally check:
1. Does experience[0].description have the same number of items as the input? Same for [1], [2], etc.
2. Did I actually translate experience[0].description[0]? Or did I copy it verbatim? If verbatim and it's clearly ${sourceLang} prose, RE-DO IT.
3. Did I translate every intro field for every experience?
4. Did I translate the summary?

═══ INPUT CV (${sourceLang}) ═══

${cvJson}

Return the same JSON shape, every prose string translated to ${targetLang}. No markdown, no commentary. JSON only.`;
}
