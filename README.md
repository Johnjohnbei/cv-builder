# Calibre : CV Builder avec IA

Application web de création et d'optimisation de CV, propulsée par l'IA (Claude).

## Stack technique

- **Frontend** : React 19 + Vite + Tailwind CSS v4
- **Backend** : Convex (serverless, temps réel)
- **Auth** : Clerk (Google OAuth + mode invité)
- **IA** : Anthropic Claude, unique fournisseur (claude-sonnet-4-5, claude-haiku-4-5 pour les appels rapides)
- **PDF parsing** : pdfjs-dist (client-side, zero API)
- **PDF export** : fonction serverless Puppeteer (`api/generate-pdf.ts`), impression navigateur en secours
- **Deploy** : Vercel + Convex Cloud

## Fonctionnalités

### Éditeur de CV
- Un template une colonne : Elegant
- Blocs modulables : chaque expérience a un mode (masqué/compact/normal/étendu)
- Tri automatique : fait tenir le CV dans le nombre de pages visé (1 à 3)
- Scoring de pertinence par rapport à une offre d'emploi
- Dates automatiquement raccourcies (Septembre → Sept.)
- KPI chiffrés en mode étendu
- Réordonnement des expériences
- Lien portfolio adapté à l'offre (variantes dans `VITE_PORTFOLIO_VARIANTS`)

### Import & IA
- **Import LinkedIn PDF** : parsing déterministe instantané (<100ms, 0 appel API)
  - Détection automatique du format LinkedIn via font sizes fixes
  - Extraction : nom, titre, email, téléphone, localisation, LinkedIn URL, résumé, expériences, éducation, langues, compétences
  - Gère les URLs multi-lignes, langues sans proficiency, titres longs avec virgules
  - Testé sur 4 profils différents (2-18 pages)
- **Import CV non-LinkedIn** : extraction IA structurée (fallback)
- Import offre d'emploi depuis URL (Jina Reader) ou PDF
- Optimisation du contenu par IA (reformulation, mots-clés ATS, priorisation)
- Lettre de motivation générée par IA

### Export
- Export PDF (Puppeteer) et Word (.docx), même contenu et mêmes sections visibles
- Pages A4 pré-paginées : aucun bloc coupé en bas de page

### Administration
- Fonctions IA réservées aux comptes connectés, ou aux invités munis d'un code d'accès
- Codes d'accès avec expiration et nombre d'utilisations, vérifiés côté serveur
- Panneau admin pour générer des codes et voir les demandes

## Architecture

```
src/
  lib/
    linkedin-parser.ts       ← Parser LinkedIn déterministe (zero API)
    pdf-text-extract.ts       ← Extraction texte brut PDF (pdfjs-dist)
  features/editor/
    lib/                    ← Logique pure (pas de React)
      display-modes.ts         Modes d'affichage, bullets, skills
      scoring.ts              Pertinence, score ATS
      fit-to-pages.ts           Tri automatique sur N pages
      pagination/             Construction des blocs et répartition sur les pages
      pdf-export.ts            Export PDF (endpoint serverless, impression en secours)
    templates/              ← Composants de rendu
      TemplateParts.tsx              Helpers partagés (contact, formation…)
      blockRenderers/         Rendu par bloc du template Elegant
  pages/
    EditorPage.tsx          ← Orchestration UI
    DashboardPage.tsx       ← Import, optimisation, admin
  shared/types/             ← Types TypeScript
convex/
  ai.ts                   ← Fonctions IA (Claude)
  accessCodes.ts          ← Gestion des codes d'accès
  schema.ts               ← Schéma de la base de données
```

### LinkedIn Parser : pipeline

```
PDF → pdfjs-dist tokens → tokensToLines (merge par Y-position)
  → splitColumns (X < 210 = left/sidebar, X >= 210 = right/main)
  → assignFontRoles (font-size → semantic role)
  → extractPersonalInfo / extractExperiences / extractEducation / extractLanguages / extractSkills
  → CVData (même structure que l'extraction IA)
```

Font sizes LinkedIn 2025 (stables sur tous les profils testés) :
| Font size | Rôle sémantique |
|-----------|----------------|
| ~26 | Nom complet |
| ~15.75 | Headers de section (Expérience, Formation…) |
| ~13 | Headers sidebar (Coordonnées, Langues…) |
| ~12 | Nom d'entreprise / titre court |
| ~11.5 | Intitulé de poste |
| ~11 | Liens (LinkedIn URL) |
| ~10.5 | Corps de texte |
| ~9 | Numéros de page |

## Développement

```bash
# Installation
npm install

# Développement (frontend + backend)
npx convex dev & npm run dev

# Build production
npx vite build

# Déploiement
git push origin master  # Vercel redéploie automatiquement
npx convex deploy       # Déployer les fonctions Convex en prod
```

### Variables d'environnement

**Local (.env.local)** :
```
CONVEX_DEPLOYMENT=dev:necessary-bobcat-348
VITE_CONVEX_URL=https://necessary-bobcat-348.eu-west-1.convex.cloud
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

**Convex (via dashboard)** :
```
ANTHROPIC_API_KEY=...       # Unique fournisseur IA
CLERK_JWT_ISSUER_DOMAIN=...
```

**Vercel** :
```
CONVEX_DEPLOY_KEY=...
VITE_CONVEX_URL=https://cautious-mule-560.eu-west-1.convex.cloud
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

## Règle d'or

**Le rendu/layout/pagination = logique pure, zéro IA.**
L'IA ne touche que le contenu textuel (extraction non-LinkedIn, reformulation, optimisation).
Tout le reste (modes d'affichage, auto-fit, scoring, dates, export, parsing LinkedIn) est déterministe.


## Fiabilité ATS et évolution des règles

Le pourcentage mesure la couverture des exigences extraites de l'offre, pas une probabilité d'entretien. Les conditions du formulaire sont à vérifier séparément et ne rapportent aucun point. Les niveaux CECR explicites sont comparés ; un niveau non quantifié reste inconnu. Les années spécialisées lisent les expériences du CV source, conservées à la génération, et ne comptent que celles dont le texte mentionne la discipline : cette présence ne prouve pas une utilisation continue pendant toute la période.

Les ajouts absents du CV source restent autorisés conformément au choix produit d'octobre. Le panneau « À corriger » les distingue et permet de les confirmer ou de les retirer. Chaque génération conserve son offre, ses exigences, le modèle demandé, les versions des règles/prompts, la durée et la couverture avant tri. Ces métadonnées restent hors des prompts et des documents exportés. Les CV plus anciens s'ouvrent sans métadonnées, avec provenance non vérifiée.

Le téléchargement PDF relit les octets produits avec pdf.js : taille réelle, couverture textuelle, champs essentiels, ordre des postes et réalisations. Un fichier refusé n'est pas téléchargé. L'impression navigateur reste disponible explicitement ; son fichier final ne peut pas être contrôlé automatiquement.

Schéma de fonctionnement, pas une capture :

```mermaid
flowchart LR
  A[Sources officielles surveillées] --> B[Règles et corpus testés]
  B --> C[Génération et export contrôlés]
  C --> B
```

### Owners et commandes de vérification

- `src/features/editor/lib/ats-rules.ts` : version active, limites et registre des sources officielles avec règle et test associés.
- `convex/_ai/prompts/` : contenu et extraction. Modifier les versions de politique correspondantes lors d'un changement effectif.
- `convex/ats.ts` : baux atomiques et cache privé par empreinte de compte/code + offre + version. Identités et texte complet de l’offre hors de cette table ; les exigences et leurs citations restent privées et expirent après 30 jours, avec purge quotidienne par lots.
- `convex/_ai/atsWatch.ts` et `convex/crons.ts` : collecte hebdomadaire des seules URL officielles enregistrées, le lundi à 07:00 UTC (08:00 Paris en hiver, 09:00 en été). Aucun appel IA et aucune donnée de candidat dans la collecte.

```powershell
npm run lint
npm run test:ats
npx playwright test e2e/ats-panel.spec.ts e2e/pdf-legibility.spec.ts
npm run build
```

### Surveillance et adoption d'une évolution ATS

Après déploiement Convex, la collecte tourne sans session locale ouverte. Le premier relevé constitue une proposition de référence à relire. Un changement ne modifie jamais les prompts : l'empreinte et le texte relus sont conservés à côté du dernier relevé. Une source inaccessible garde son dernier état et porte une erreur, jamais une fausse réussite.

Les commandes suivantes utilisent l'accès opérateur de la CLI Convex ; les fonctions de collecte et d'approbation sont internes, pas appelables par un candidat :

```powershell
npx convex run _ai/atsWatch:checkSources '{}'
npx convex run ats:sourceStatus '{}'
npx convex run ats:sourceReview '{"sourceId":"greenhouse-parsing"}'
```

Pour promouvoir une règle : lire le texte courant et la version relue (`text` / `reviewedText`), modifier l'owner existant et son cas annoté, incrémenter les versions concernées dans `ATS_POLICY`, puis passer les contrôles ci-dessus. Le build Vercel impose lint et corpus ATS avant de déployer backend et frontend de la même révision. Confirmer ensuite l'empreinte réellement lue avec la fonction interne `ats:acceptSource` (arguments `sourceId`, `hash`, `rulesVersion`) ; une empreinte qui a changé ou une version périmée est refusée.

Pour revenir à une règle précédente : restaurer la logique et les prompts concernés, conserver les champs optionnels et tables de compatibilité, attribuer une nouvelle version de politique et repasser le corpus. Ne pas effacer les CV ou réécrire leurs snapshots historiques. Une nouvelle version d'extraction invalide automatiquement les caches de navigateur et de serveur.

Le matching lexical reste explicable (libellé, variantes FR/EN, normalisation), distinct d'un moteur sémantique commercial. Avant d'ajouter un modèle ou une file de générations, mesurer les faux positifs/négatifs du corpus, les durées par génération et l'usage journalisé par appel. Aucune capacité multi-utilisateur chiffrée n'est promise sans test de charge.
