# Calibre — CV Builder avec IA

Application web de création et d'optimisation de CV, propulsée par l'IA (Google Gemini).

## 🚀 Stack technique

- **Frontend** : React 18 + Vite + Tailwind CSS v4
- **Backend** : Convex (serverless, temps réel)
- **Auth** : Clerk (Google OAuth + mode invité)
- **IA** : Google Gemini (Pro + Flash)
- **PDF** : Export natif navigateur (window.print)
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
- Import CV depuis PDF (extraction IA structurée)
- Import offre d'emploi depuis URL ou PDF
- Optimisation du contenu par IA (reformulation, priorisation)
- Analyse ATS (score de compatibilité)
- Amélioration de bullet points par IA
- Lettre de motivation générée par IA

### Export
- Export PDF via impression navigateur (rendu CSS fidèle)
- Support 1 à 4 pages A4
- Page breaks automatiques (évite de couper les blocs)

### Administration
- Système de codes d'accès avec expiration
- Panneau admin pour générer des codes et voir les demandes
- Protection des appels API Gemini

## 🏗️ Architecture

```
src/
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
  ai.ts                   ← Fonctions IA (Gemini)
  accessCodes.ts          ← Gestion des codes d'accès
  schema.ts               ← Schéma de la base de données
```

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
GEMINI_API_KEY=...
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
L'IA ne touche que le contenu textuel (extraction, reformulation, optimisation).
Tout le reste (modes d'affichage, auto-fit, scoring, dates, export) est déterministe.
