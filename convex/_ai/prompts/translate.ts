// Pure 1:1 translation of CV content while preserving EXACT JSON structure.
// Distinct from optimize/tailor which rewrite content — translate only swaps
// languages. Same number of bullets, same KPIs, same skills order, same intros.

export interface TranslateContext {
  cvData: unknown;
  targetLanguage: 'fr' | 'en';
}

export function buildTranslatePrompt(ctx: TranslateContext): string {
  const targetLang = ctx.targetLanguage === 'en' ? 'English' : 'French (français)';
  const cvJson = JSON.stringify(ctx.cvData);

  return `You are a professional CV translator.

MISSION: Translate every string value of the CV JSON below to ${targetLang}. This is a PURE TRANSLATION — preserve everything else exactly.

CRITICAL RULES — break any of these and the output is unusable:
1. SAME JSON STRUCTURE. Same keys, same number of elements in every array, same nesting. Add nothing, remove nothing.
2. SAME NUMBER OF BULLETS per experience. If an experience has 4 description bullets in input, the output MUST have exactly 4 bullets.
3. SAME ORDER of experiences, education, skills, languages. Do not reorder.
4. NEVER rewrite, restructure, condense, or expand. Just translate.
5. Keep proper nouns AS-IS: company names (Google, Renault), product names, technologies (React, Figma, SAP), people names.
6. Translate technical terms when a standard equivalent exists:
   - "Conception" ↔ "Design"
   - "Pilotage" ↔ "Leadership"
   - "Compétences" ↔ "Skills"
   - "Formation" ↔ "Education"
   - "Équipe" ↔ "Team"
7. Keep dates AS-IS (e.g. "Jan. 2024", "May 2026"). Translate "current"/"actuel" semantically only if the field requires it.
8. Empty strings stay empty. null stays null. Booleans stay unchanged.
9. KPI strings, display modes, IDs, and any technical field stay byte-identical unless they are clearly human-readable prose.
10. Style: maintain the original tone (formal/casual) and register. Concise stays concise, detailed stays detailed.

CV (input language: ${ctx.targetLanguage === 'en' ? 'French' : 'English'}):
${cvJson}

Return the SAME JSON, every string translated to ${targetLang}, every structural element identical. No markdown, no commentary. JSON only.`;
}
