export interface ExtractContext {
  pdfText: string;
}

export function buildExtractPrompt(ctx: ExtractContext): string {
  return `
Tu es un expert en recrutement et en structuration de données CV.
Extrais les informations professionnelles du texte de CV suivant et retourne-les au format JSON strict.

TEXTE DU CV :
${ctx.pdfText}

RÈGLES IMPORTANTES :

1. DATES : Utilise TOUJOURS le format "Mois YYYY" (ex: "Septembre 2016", "Janvier 2024").
   Si seule l'année est disponible, utilise juste "YYYY".
   Pour un poste actuel, met end_date à "" et current à true.

2. EXPÉRIENCES : Chaque expérience a trois parties distinctes :
   - "intro" : UNE phrase de description du rôle/contexte (1-2 lignes). Toujours présent.
   - "description" : Liste de bullet points d'ACTIONS concrètes et résultats.
     Chaque bullet commence par un verbe d'action. Maximum 4 bullets par expérience.
     L'intro décrit LE QUOI, les bullets décrivent LE COMMENT et LES RÉSULTATS.
   - "kpi" : UN résultat chiffré ou indicateur d'envergure marquant (OBLIGATOIRE, jamais vide).
     Extrais-le du texte source si présent. Sinon, synthétise-le à partir du contexte de l'expérience
     en restant réaliste et crédible. Règles de calibrage :
     * CALIBRAGE SUR LA DURÉE : un stage de 3 mois ne peut pas avoir "+50% de CA sur 3 ans".
       Adapte l'ampleur au temps réellement passé sur la mission (start_date → end_date).
     * PRÉFÈRE L'ENVERGURE AUX POURCENTAGES INVENTÉS : taille d'équipe, nombre de projets gérés,
       périmètre (marques, marchés, utilisateurs), stack technique déployée.
     * EXEMPLES CRÉDIBLES :
       - "Équipe de 8 designers encadrée" (périmètre managérial)
       - "Refonte couvrant 5 marques et 30M+ utilisateurs" (envergure projet)
       - "12 projets simultanés livrés" (volumétrie)
       - "Stack Notion / Figma / GTM déployée" (scope technique)
     * NE PAS INVENTER de pourcentages précis si le texte source ne les mentionne pas.
     * NE JAMAIS laisser kpi vide — toujours produire au moins un indicateur d'envergure déduit.

3. TITRE PROFESSIONNEL : Utilise un titre court et percutant (max 5 mots).
   Pas de liste de postes, pas de "Ex-xxx".

4. SUMMARY : Maximum 3 phrases. Résume le profil, les spécialités et la valeur ajoutée.

5. COMPÉTENCES : Regroupe en 2-4 catégories max. Chaque catégorie a 3-6 items.
   Catégories typiques : "Métier/Product", "Technique", "Outils", "Soft Skills".
   Chaque item est un mot ou expression courte (1-3 mots).

6. LANGUES : Utilise les proficiencies standards : "Natif", "Bilingue", "Courant (C1)", "Intermédiaire (B1/B2)", "Débutant (A1/A2)".

Structure JSON attendue :
{
  "personal_info": { "name": "", "email": "", "phone": "", "location": "", "title": "", "summary": "" },
  "experience": [ { "company": "", "position": "", "location": "", "start_date": "", "end_date": "", "current": false, "intro": "Description courte du rôle (1-2 lignes)", "description": ["action bullet 1", "action bullet 2"], "kpi": "indicateur chiffré ou envergure" } ],
  "education": [ { "school": "", "degree": "", "field": "", "start_date": "", "end_date": "" } ],
  "skills": [ { "category": "", "items": ["item1", "item2"] } ],
  "languages": [ { "name": "", "proficiency": "" } ]
}

IMPORTANT : Retourne TOUTES les expériences du CV, même les anciennes. L'utilisateur choisira lesquelles afficher.
Retourne UNIQUEMENT le JSON, rien d'autre.
`;
}
