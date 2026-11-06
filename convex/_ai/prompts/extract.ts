import { KPI_RULES_FR } from "./fragments";

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

2. EXPÉRIENCES : Tu EXTRAIS, tu n'écris pas. Chaque expérience a trois parties :
   - "intro" : la phrase de description du rôle/contexte que le CV donne (1-2 lignes).
     Absente du texte source, elle reste vide ("") : ne la déduis pas de l'intitulé
     et de l'entreprise, qui sont déjà extraits à côté.
   - "description" : les puces d'ACTIONS et de résultats que le texte source donne.
     Maximum 4 bullets par expérience, reprises du texte, jamais inventées.
   - "kpi" : voir les règles ci-dessous.

3. TITRE PROFESSIONNEL : Utilise un titre court et percutant (max 5 mots).
   Pas de liste de postes, pas de "Ex-xxx".

4. SUMMARY : Maximum 3 phrases. Résume le profil, les spécialités et la valeur ajoutée.

5. COMPÉTENCES : Regroupe en 2-4 catégories max. Chaque catégorie a 3-6 items.
   Catégories typiques : "Métier/Product", "Technique", "Outils", "Soft Skills".
   Chaque item est un mot ou expression courte (1-3 mots).

6. LANGUES : Utilise les proficiencies standards : "Natif", "Bilingue", "Courant (C1)", "Intermédiaire (B1/B2)", "Débutant (A1/A2)".

${KPI_RULES_FR}

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
