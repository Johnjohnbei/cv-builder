# Calibre — CV Builder avec IA

Application web de création et d'optimisation de CV, propulsée par l'IA (NVIDIA NIM / Gemini).

## 🚀 Stack technique

- **Frontend** : React 18 + Vite + Tailwind CSS v4
- **Backend** : Convex (serverless, temps réel)
- **Auth** : Clerk (Google OAuth + mode invité)
- **IA** : NVIDIA NIM llama-3.1-70b (primary) / Google Gemini (fallback)
- **PDF parsing** : pdfjs-dist (client-side, zero API)
- **PDF export** : Natif navigateur (window.print)
- **Deploy** : Vercel + Convex Cloud

## ✨ Fonctionnalités

### Éditeur de CV
- 6 templates professionnels (Classic, Modern, Minimal, Creative, Elegant, Sidebar)
- Blocs modulables : chaque expérience a un mode (masqué/compact/normal/étendu)
- Auto-fit intelligent : ajuste automatiquement les blocs pour tenir sur 1-4 pages
- Scoring de pertinence par rapport à une offre d'emploi
- Dates automatiquement raccourcies (Septembre → Sept.)
- KPI chiffrés en mode étendu
- Réordonnement par glisser-déplacer

### Import & IA
- **Import LinkedIn PDF** : parsing déterministe instantané (<100ms, 0 appel API)
  - Détection automatique du format LinkedIn via font sizes fixes
  - Extraction : nom, titre, email, téléphone, localisation, LinkedIn URL, résumé, expériences, éducation, langues, compétences
  - Gère les URLs multi-lignes, langues sans proficiency, titres longs avec virgules
  - Testé sur 4 profils différents (2-18 pages)
- **Import CV non-LinkedIn** : extraction IA structurée (fallback)
- Import offre d'emploi depuis URL (Jina Reader) ou PDF
- Optimisation du contenu par IA (reformulation, mots-clés ATS, priorisation)
- Amélioration de bullet points par IA
- Lettre de motivation générée par IA

### Export
- Export PDF via impression navigateur (rendu CSS fidèle)
- Support 1 à 4 pages A4
- Page breaks automatiques (évite de couper les blocs)

### Administration
- Système de codes d'accès avec expiration
- Panneau admin pour générer des codes et voir les demandes
- Protection des appels API

## 🏗️ Architecture

```
src/
  lib/
    linkedinParser.ts       ← Parser LinkedIn déterministe (zero API)
    pdfTextExtract.ts       ← Extraction texte brut PDF (pdfjs-dist)
  features/editor/
    lib/                    ← Logique pure (pas de React)
      displayModes.ts         Modes d'affichage, bullets, skills
      scoring.ts              Pertinence, dates, proficiency
      autoFit.ts              Boucle de condensation
      pdfExport.ts            Export PDF natif
    templates/              ← Composants de rendu
      shared.tsx              Helpers partagés
      CVRenderer.tsx          Routeur de templates
      TemplateA-F.tsx         6 templates individuels
  pages/
    EditorPage.tsx          ← Orchestration UI
    DashboardPage.tsx       ← Import, optimisation, admin
  shared/types/             ← Types TypeScript
convex/
  ai.ts                   ← Fonctions IA (NVIDIA NIM / Gemini)
  accessCodes.ts          ← Gestion des codes d'accès
  schema.ts               ← Schéma de la base de données
```

### LinkedIn Parser — Pipeline

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

## 🛠️ Développement

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
NVIDIA_API_KEY=...          # Primary AI provider
GEMINI_API_KEY=...          # Fallback AI provider
CLERK_JWT_ISSUER_DOMAIN=...
```

**Vercel** :
```
CONVEX_DEPLOY_KEY=...
VITE_CONVEX_URL=https://cautious-mule-560.eu-west-1.convex.cloud
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

## 📐 Règle d'or

**Le rendu/layout/pagination = logique pure, zéro IA.**
L'IA ne touche que le contenu textuel (extraction non-LinkedIn, reformulation, optimisation).
Tout le reste (modes d'affichage, auto-fit, scoring, dates, export, parsing LinkedIn) est déterministe.
