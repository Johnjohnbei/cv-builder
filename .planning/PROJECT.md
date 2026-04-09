# Calibre — CV Builder avec IA

## What This Is

Application web de création et d'optimisation de CV propulsée par l'IA (NVIDIA NIM / Gemini). Calibre permet d'importer un CV LinkedIn ou PDF, de l'éditer avec 6 templates professionnels, et de l'optimiser pour des offres d'emploi spécifiques. Le projet entre dans une phase de conformité ATS complète pour maximiser les chances des candidats face aux systèmes de tri automatisés.

## Core Value

Les CV générés par Calibre doivent passer les filtres ATS avec le meilleur score possible tout en restant visuellement professionnels — un CV non lu par un ATS est un CV perdu.

## Requirements

### Validated

- ✓ 6 templates CV professionnels (Classic, Modern, Minimal, Creative, Elegant, Sidebar) — existing
- ✓ Import LinkedIn PDF déterministe (<100ms, 0 API) — existing
- ✓ Import CV non-LinkedIn via IA — existing
- ✓ Import offre d'emploi depuis URL (Jina Reader) ou PDF — existing
- ✓ Optimisation du contenu par IA (reformulation, mots-clés, priorisation) — existing
- ✓ Auto-fit intelligent (ajustement automatique 1-4 pages) — existing
- ✓ Scoring de pertinence par expérience — existing
- ✓ Export PDF via window.print — existing
- ✓ Lettre de motivation générée par IA — existing
- ✓ Auth Clerk (Google OAuth + mode invité) — existing
- ✓ Système de codes d'accès avec panneau admin — existing
- ✓ Déploiement Vercel + Convex Cloud — existing

### Active

- [ ] Score ATS global (0-100) avec 3 sous-scores : Format, Contenu, Pertinence
- [ ] Panneau latéral ATS dans l'éditeur (auto-ouvert si offre importée)
- [ ] Score partiel sans offre + incitation à importer une offre
- [ ] Score basique temps réel (formatage/sections) + analyse complète à la demande
- [ ] Toggle "mode ATS" sur les templates (single-column, sans icônes, polices standards, design simplifié)
- [ ] Switch automatique vers template compatible quand mode ATS activé sur template non-adaptable
- [ ] Warning à la désactivation du mode ATS ("le CV ne sera plus ATS-compatible")
- [ ] Réécriture IA des bullet points ciblée par offre (globale + par bullet)
- [ ] Détection IA de bullet points faibles (verbes faibles, absence de métriques)
- [ ] Mots-clés manquants avec réécriture IA intégrée
- [ ] Auto-catégorisation des compétences à l'import (techniques, transversales, outils, méthodo)
- [ ] Sections forcées aux standards ATS bilingues FR/EN
- [ ] Détection automatique de la langue du CV (FR vs EN) pour adapter règles et suggestions
- [ ] Adaptation ATS des 6 templates existants (évaluer chacun, classifier adaptable vs design-only)
- [ ] Simplification et refactoring des fichiers existants là où possible (fusion, réduction de complexité)

### Out of Scope

- Export DOCX — repoussé à un futur milestone, focus PDF
- Détection de la plateforme ATS de l'entreprise cible — trop complexe pour ce milestone
- Simulation de parsing ATS — nécessite un moteur de parsing séparé
- Taxonomies ESCO/O*NET — intégration lourde, évaluer dans un futur milestone
- Matching sémantique via embeddings (Resume2Vec) — R&D future
- Nouveau template ATS dédié — on adapte les existants plutôt qu'en ajouter

## Context

**Marché cible :** Bilingue FR/EN — utilisateurs francophones et anglophones
**Provider IA :** NVIDIA NIM llama-3.1-70b (primary), Gemini (fallback) — garder NIM pour ce milestone
**Architecture :** React 18 + Vite + Tailwind v4 + Convex (backend) + Clerk (auth)
**Scoring existant :** `scoring.ts` contient extractKeywords, computeKeywordMatch, computeExperienceScore — base à étendre
**Export PDF :** window.print() actuel fonctionne mais pas idéal — explorer des alternatives pendant la recherche
**Templates :** 6 templates (A-F) dont certains multi-colonnes (Sidebar) — chacun devra être évalué pour compatibilité ATS

**Approche de ce milestone :**
- Simplifier et fusionner les fichiers existants plutôt qu'ajouter de la complexité
- Préserver l'architecture par couches mais chercher les opportunités de refactoring
- Pas d'over-engineering : le bon niveau de complexité pour le besoin réel

**Recherche ATS réalisée (sources 2025-2026) :**
- 75% des CV rejetés par ATS avant lecture humaine
- 40% des rejets causés par le formatage, pas le contenu
- Les ATS modernes (Workday, Greenhouse, Lever) parsent bien les PDF avec texte sélectionnable
- Les templates multi-colonnes, icônes SVG, polices fantaisie, headers/footers cassent le parsing
- Mots-clés : correspondance exacte > sémantique dans la plupart des ATS
- Les métriques dans les bullet points augmentent la rétention recruteur de 40%

## Constraints

- **Tech stack**: React 18 + Vite + Convex + Clerk — stack existante, pas de migration
- **IA Provider**: NVIDIA NIM — conserver le provider actuel, améliorer les prompts
- **Performance**: Le score basique doit être calculé en temps réel sans lag perceptible
- **Simplicité**: Ne pas ajouter de complexité — fusionner et simplifier les fichiers existants
- **PDF Export**: window.print() pour l'instant — explorer des alternatives si possible

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Adapter les 6 templates existants plutôt qu'ajouter un 7ème | Moins de code à maintenir, améliore l'existant | — Pending |
| Toggle ATS plutôt que templates séparés | Un toggle est plus simple qu'un template dédié, l'utilisateur garde le choix | — Pending |
| 3 sous-scores (Format/Contenu/Pertinence) plutôt que 6 | Plus lisible, moins de surcharge cognitive pour l'utilisateur | — Pending |
| Étendre scoring.ts plutôt que nouveau module | Réutiliser extractKeywords/computeKeywordMatch, éviter la duplication | — Pending |
| Sections forcées aux standards ATS | Les noms créatifs cassent le parsing ATS, pas de choix utilisateur ici | — Pending |
| Détection langue automatique plutôt que manuelle | Meilleure UX, pas de friction supplémentaire | — Pending |
| Réécriture IA complète plutôt que suggestions | Plus de valeur ajoutée, l'utilisateur n'a pas à reformuler lui-même | — Pending |
| Score partiel sans offre + incitation | Ne pas bloquer l'utilisateur, mais l'encourager à importer une offre | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-09 after initialization*
