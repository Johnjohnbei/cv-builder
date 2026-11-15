# KNOWLEDGE — Calibre CV Builder

Append-only register of project-specific rules, patterns, and lessons learned.

---

### K001 — LinkedIn PDF font sizes are stable (2025 format)
All 4 tested profiles share identical font-size hierarchy: 26/15.75/13/12/11.5/11/10.5/9. Parser relies on this. If LinkedIn changes their PDF export, these values need updating in `linkedin-parser.ts` `FONT_ROLES`.

### K002 — LinkedIn URLs can span 2+ lines
The LinkedIn URL in sidebar (fs=11) may split across lines ending with `-` or `/`. The parser concatenates consecutive same-role lines. Don't assume single-line URLs.

### K003 — react-dropzone file inputs are hidden
`browser_upload_file` on the visible `input[type=file]` may not trigger react-dropzone's `onDrop`. The dropzone creates its own hidden input. For testing, dispatch a synthetic `change` event or use the app's own UI flow.

### K004 — Claude on large CVs: streaming is mandatory
Claude (claude-sonnet-4-5) is the only provider since 2026-08-16; Gemini was removed after its free tier kept failing with 429/503. With `max_tokens: 30000` Anthropic requires streaming — use `client.messages.stream().finalMessage()`, not `client.messages.create()`, otherwise the SDK throws "Streaming is required for operations that may take longer than 10 minutes". Estimated duration displayed in Dashboard CTA: ~30s (<3k chars) to ~240s (>15k chars).

### K007 — chatJSON/chatText take a speed level, not a model name
`chatJSONThen`, `chatJSONSchema` and `chatText` accept a speed `"default" | "fast"`. The provider resolves its own model via `getModel(speed, provider)`. Never pass a model name as the speed argument.

### K008 — Cover letter prompt must forbid markdown and section title mirroring
The model tends to mirror the job description's section titles as bold headers in the letter. The prompt must explicitly forbid `**`, `*`, `#`, bullet lists, and reuse of job ad section titles. Require 3–4 paragraphs of plain prose. See `convex/_ai/prompts/coverLetter.ts`.

### K009 — Cover letter tailored CV detection
`isTailored` is computed in EditorPage by comparing `userData.lastJobDescription` (saved on Convex after `tailorCV`) with the current `jobDescription`. If they don't match, the CoverLetterDrawer shows an amber warning. Correct workflow: Dashboard → Optimize → Editor → Cover Letter.

### K005 — AI actions: a signed-in account OR a valid access code (2026-09-15)
`verifyAccessCode()` (`convex/_ai/auth.ts`) lets any signed-in Clerk identity through and requires a valid code from guests, checked and counted in one mutation (`accessCodes.consumeInternal`). The former `REQUIRE_ACCESS_CODE` switch was never set in production, which left every paid action open to anonymous callers. The dashboard modal (`requireAccessCode`) mirrors the rule and forgets a code the server refuses.

### K006 — No server-side ATS analysis
`getATSAnalysis` was deleted on 2026-09-15: a public, billable action with no caller. The ATS score is computed client-side (`scoring.ts`, `useATSAnalysis`).

### K010 — SDK internal retries were the hidden slowness; withRetry owns all retry logic (2026-07-21)
The SDKs default to 2 internal retries with exponential backoff: a 429 burned ~30-60s inside the SDK before our loop even saw the error, the main "spinner infini" cause. Fix: `maxRetries: 0` + a per-call timeout (Claude 270s, so timeout + capped retry-after + timeout stays under the 10-minute Convex action limit). Policy in `convex/_ai/chat.ts`: non-last provider = zero retry, immediate fall-through; last provider = 1 retry, retry-after aware (capped 20s). Never re-add SDK-level retries.

### K011 — Zod validation lives INSIDE the retry loop via chatJSONSchema
`chatJSONSchema(prompt, schema, speed)` validates the schema inside `withRetry`: a schema-invalid response counts as a provider failure and falls through to the next provider instead of surfacing "format invalide, réessayez". All 9 schema-validated actions in `convex/ai.ts` use it. Don't reintroduce the old `chatJSON` + `safeParse` + throw pattern at call-sites.

### K012 — Language mixing had 4 root causes; fixed 2026-07-21
The app produced FR/EN mixed CVs. Causes: (1) adapt/rewrite/distribute prompts were French-instructed with French few-shot examples while asking for English output → the model leaked French. Fix: KPI_RULES_EN + LANGUAGE_LOCK(isEn) at prompt end, thread language through bullet/distribute actions+hooks. (2) backend normalizeProficiency froze to French ("Courant (C1)") — a value the render map couldn't re-localize. Fix: backend stores RAW proficiency, render owner (formatting.ts) localizes both ways + migration aliases; translateCV leaves proficiency raw. (3) toggle used franc on mixed content and flipped the flag without translating. Fix: cache-hit=instant swap, else translate; never franc-flip. (4) no eager bilingual. Fix: attachBilingualCache() translates the other language right after generation. There are TWO normalizeProficiency functions: backend (convex/_ai/normalizers.ts, now passthrough) and render (src/features/editor/lib/formatting.ts, the bilingual owner). Don't re-add French freezing in the backend one.

### K013 : audit ATS, évolutivité et panneau après génération (2026-11-15)

Audit demandé par l'utilisateur, sur le code à `9d98bbe`. Aucun changement de comportement. Le présent registre existant accueille les constats pour garder leur trace sans créer un second propriétaire documentaire.

**Conclusion.** Calibre mesure une couverture pondérée des exigences extraites de l'offre. Ce pourcentage ne garantit ni le résultat d'un parseur commercial, ni le classement chez un recruteur, ni l'absence de critère éliminatoire dans le formulaire. La cible vérifiable est : document lisible, exigences explicitement couvertes, faits contrôlés et limites visibles. « 100 % ATS parfait » ne constitue pas une garantie démontrable pour tous les ATS et toutes les configurations de recrutement.

#### Fonctionnement réellement branché

- `convex/_ai/prompts/jobDescription.ts` extrait jusqu'à 25 exigences avec citations et variantes FR/EN. `normalizers.ts` contrôle les citations, filtre des parasites et déduplique. Le plafond peut laisser hors du score des critères d'une offre dense ; aucun indicateur de complétude ne prouve que la liste est exhaustive.
- `tailor.ts` génère, applique `truthGuard.ts`, mesure avec `computeATSReport`, puis tente au plus deux réparations. La mesure serveur utilise tout le contenu ; l'éditeur mesure le contenu visible après masquage, pagination et sections Design. Cette distinction est intentionnelle et doit être expliquée quand le score final baisse.
- `keyword-analysis.ts` est le propriétaire commun client/serveur du score. Poids : 3 pour une exigence requise ou un titre, 1 pour une qualité humaine ou un souhait. Ces poids sont une convention Calibre, pas des coefficients récupérés chez les éditeurs ATS.
- Le tri (`fit-to-pages.ts`) essaie de préserver la dernière mention d'une exigence requise, mais accepte de la perdre si toutes les options restantes la perdent. Le budget de pages peut donc dégrader la couverture.
- Le fournisseur réellement appelé est Anthropic Claude : `providers.ts` utilise `ANTHROPIC_API_KEY`, `claude-sonnet-4-5` et `claude-haiku-4-5-20251001`. Le nom Codex donné au fournisseur dans AGENTS.md ne correspond pas à ce code.
- `chat.ts` transmet des prompts au modèle, sans outil de recherche web ni récupération d'un corpus ATS. Il journalise modèle, usage et durée ; `tailor.ts` journalise couverture et réparations. Ce sont des traces d'exécution utiles, pas un historique de qualité reproductible par génération.

#### Limites du score et de la génération, par priorité

1. **Une exigence présente n'est pas une compétence démontrée.** `isWrittenFreely` et `tailor.ts:243` autorisent explicitement les compétences, outils, méthodes, domaines et qualités absents du CV source. C'est l'arbitrage du 2026-10-07, pas une régression fortuite. Les nombres et certains faits restent gardés. Le score ne distingue pas une mention sourcée d'un ajout libre. Amélioration proposée : conserver la provenance par ajout et montrer les éléments à confirmer ; un éventuel retour à une génération strictement prouvée demande un arbitrage produit, il ne doit pas être fait silencieusement.
2. **Niveau de langue non mesuré.** `JobRequirement` n'a pas de niveau minimal ; le score ne lit que le nom de langue. Sonde exécutée avec le CV de test et Anglais A1 : l'exigence structurée « Anglais » reçoit 100. Une demande C2 qui se retrouve sous ce libellé ne peut pas être différenciée. Ajouter le niveau attendu, son extraction et sa comparaison, avec statut inconnu quand il manque.
3. **Années non rattachées au métier demandé.** `experience_years` compare `minYears` au cumul de toutes les expériences visibles, sans périmètre de métier ni de compétence. Sonde : rôles du mock remplacés par Comptable, textes UX retirés ; « 5 ans en UX » reste couvert avec 8,75 années. Ajouter un périmètre explicite et mesurer les périodes pertinentes, sans double compter les chevauchements.
4. **Tous les filtres ne tiennent pas dans la liste actuelle.** Diplôme et certification sont principalement lus par termes, sans niveau/équivalence/validité structurés. Le modèle ne représente pas explicitement droit au travail, habilitation, disponibilité ou mobilité. Prévoir des critères à vérifier quand l'offre les demande, sans prétendre les déduire du CV ni prédire le formulaire du recruteur.
5. **La conformité PDF en production est partiellement estimée.** `pdf-export.ts:125` contrôle le DOM avant export, pas le texte du fichier PDF produit. `pdf-validation.ts` accepte 60 % des mots uniques attendus ; la sonde avec six mots présents sur dix retourne `valid: true`. L'ordre et les associations employeur/puces ne sont pas mesurés par ce contrôle. `fitsParserSizeLimit` estime 500 Kio plus la photo, sans lire `blob.size`. Étendre l'export existant pour vérifier le fichier réel : taille, champs critiques, mots et ordre ; conserver les gardes E2E sur les géométries.
6. **La couverture lexicale ne simule pas tous les moteurs de matching.** `writesRequirement` utilise libellé et variantes, normalisation et règles textuelles. Les synonymes proposés par l'IA améliorent la couverture, mais ne constituent pas une validation sémantique indépendante. Ajouter un corpus annoté de cas positifs et négatifs avant d'introduire un modèle supplémentaire ; conserver la mesure lexicale explicable et distinguer une proximité sémantique incertaine.

#### Veille et sources : historique présent, mise à jour dynamique absente

Sources retrouvées dans Atelier :

- `projets/calibre/raw/2026-09-15-recherche-fonctionnement-ats.md` : recherche ponctuelle mêlant documentations éditeurs et études/articles secondaires, avec niveaux de preuve. Sources primaires citées : Greenhouse, Oracle/Taleo, Workday, Textkernel, Teamtailor, LinkedIn et Apec. Sources secondaires : Jobscan, Enhancv et autres guides.
- `projets/calibre/raw/2026-11-06-chantier-optimisation/rapport-2-ats.md` : audit ponctuel du matching, des exigences et du PDF. Plusieurs problèmes de cet ancien audit sont déjà corrigés dans le code actuel ; ne pas recopier ses constats comme des défauts actuels.
- Les décisions de septembre, octobre et novembre expliquent l'évolution des règles. Le code contient des références ponctuelles à Greenhouse. `ats-rules.ts` porte principalement les libellés de sections, pas un moteur de veille.

Aucun collecteur ATS, cron Convex, ingestion de sources ou branchement corpus-vers-prompt trouvé dans le dépôt. Les définitions locales Codex et Claude de tâches planifiées consultées ne contiennent pas de veille ATS dédiée ; aucune tâche Windows nommée ATS/Calibre/cv-builder n'a été trouvée. Cette observation ne prouve pas l'absence d'un service externe non accessible dans la session.

Il faut distinguer : **dynamique par offre**, oui (extraction IA, recalcul en direct), et **dynamique par évolution des ATS**, non dans les chemins examinés (changements humains des prompts, constantes et fonctions).

Sources primaires reconsultées le 2026-11-15 :

- Greenhouse, [Unsuccessful resume parse](https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse) : limite de parsing de 2,5 MB et causes de mauvaise extraction, dont colonnes, tableaux et lettres espacées. Confirme la pertinence des gardes documentaires existantes.
- Greenhouse, [Talent Matching, Data Processing FAQ](https://support.greenhouse.io/hc/en-us/articles/41131616864283-Talent-Matching-Data-Processing-FAQ) : critères calibrés par les recruteurs, rapprochement sémantique, catégories de correspondance et décision humaine. Le poids 3/1 et le pourcentage Calibre ne reproduisent pas un score commercial universel.
- Oracle, [Disqualification Question](https://docs.oracle.com/en/cloud/saas/talent-management/faush/disqualification-question.html) : des réponses au questionnaire peuvent disqualifier indépendamment du contenu du CV. Éviter l'affirmation générale de l'infobulle ATSPanel selon laquelle toute exigence manquante élimine chez Taleo ou baisse automatiquement d'un grade chez Workday.
- Lever, [Understanding Resume Parsing](https://help.lever.co/s/article/Understanding-Resume-Parsing) : page identifiée par la recherche mais ouverture limitée par une erreur CSS. Son contenu complet n'a pas été validé dans cette session ; aucune conclusion nouvelle ne s'appuie dessus.

#### Faire évoluer le système sans multiplier les couches

Proposition, pas une architecture déjà installée :

1. Tenir un registre versionné de règles : identifiant, éditeur/capacité, URL officielle, extrait court, date de vérification, confiance, règle Calibre concernée et cas de test. Réutiliser les owners actuels pour appliquer les règles ; la veille manque aujourd'hui de propriétaire exécutable.
2. Faire tourner la collecte hors du parcours utilisateur. Détecter les changements, produire une proposition, la confronter au corpus de tests puis promouvoir une version validée. Un changement de page web ne doit jamais modifier directement les générations en cours.
3. Associer chaque génération à la version des règles, des prompts, de l'extraction et au modèle, ainsi qu'au snapshot d'exigences et aux résultats avant/après tri. Garder une version active et un retour à la précédente. Compléter les logs existants plutôt que reconstruire l'observabilité.
4. Versionner le cache d'extraction par version effective, pas seulement par nom manuel `job_requirements_cache_v2`. Actuellement cinq offres sont conservées par navigateur, sans expiration, date d'analyse ni version de modèle/prompt ; le même texte peut continuer d'utiliser une analyse antérieure à une amélioration. Le serveur revérifie les exigences fournies, mais ne prouve pas leur complétude.
5. Si le volume le justifie, ajouter cache et déduplication serveur par empreinte d'offre, langue et version d'extraction. Aujourd'hui la déduplication en mémoire est limitée à l'onglet, donc deux navigateurs paient deux extractions. Isoler les offres privées et appliquer une rétention ; ne pas créer un cache mondial de textes utilisateurs par défaut.
6. Introduire file d'attente, reprise et limitation de concurrence lorsque les mesures de charge l'exigent. Les délais/retries actuels bornent les appels, mais aucun test de charge multi-utilisateur n'a été exécuté ici. Aucun dimensionnement chiffré n'est affirmé.

#### Interface après génération : constats mesurés

Application locale, mode invité, mock synthétique, viewport 1440 × 900, offre courte avec cinq exigences en cache. Aucun appel IA envoyé ou relayé. Variables portfolio locales actives : la capture peut donc différer d'une installation sans variantes.

- Panneau : 319 px utiles de large, zone défilante de 743 px de haut. Hauteur du contenu : ATS 1080 px, Contenu 1217 px, Design 1880 px. Mesures spécifiques à ce jeu de données, pas des statistiques d'usage.
- Contenu : Infos personnelles est ouvert par défaut. Le bouton Expériences est à y=1105 avant défilement, alors que le CV est déjà généré et que sa correction est souvent le travail restant. Offre, format, aide et coordonnées occupent le début du panneau.
- Design : le bouton Word est à y=1821 avant défilement ; il vient après thèmes, couleurs, typographies, photo et sections visibles. L'export est une tâche de sortie, pas un réglage visuel.
- PDF : action dans la barre supérieure, le bas fixe du panneau et le bloc Export de Design. Lettre : bouton dans la rangée d'onglets et à la fin de Design. Ces actions sont branchées ; leur répétition est un problème d'organisation, pas du code mort établi.
- ATS : `PortfolioSuggestion` est placé avant le score. Les exigences couvertes viennent avant les écarts, puis les contrôles de lisibilité. Les actions des écarts permettent surtout de retirer ou rejeter, sans accès direct au champ du CV qui corrigerait le manque.
- Les sections sont modifiables dans le panneau et directement dans l'aperçu. La double voie peut rester utile pour les métadonnées, suppressions, versions et masquages ; éviter de supprimer ces capacités au motif qu'elles sont répétées.
- Aucune télémétrie d'utilisation des commandes ne permet ici d'établir quelles fonctions sont réellement inutilisées. Ne pas supprimer une capacité sur cette hypothèse.

Réorganisation recommandée :

- Une barre persistante regroupe offre/langue, Annuler, sauvegarde et menu Exporter (PDF, Word, impression). Lettre reste une action explicite de cette zone. Supprimer les copies dispersées qui n'ajoutent aucune capacité.
- Un panneau « À corriger » ouvre sur les exigences requises manquantes, puis les problèmes de document, puis les suggestions de contenu. Chaque ligne pointe sur la section ou le texte concerné ; détails et exigences déjà couvertes sont dépliables. Le portfolio reste dans les informations/liens ou dans une suggestion contextuelle, sous les problèmes bloquants.
- Conserver « Contenu » pour structure, ajout/suppression, versions et informations non éditables directement. Ouvrir la section du texte sélectionné ; éviter de forcer les coordonnées ouvertes à chaque visite.
- Regrouper sous « Mise en page » budget de pages, ajustement, apparence et visibilité. Thèmes rapides en premier niveau, réglages fins à la demande. Un état persistant indique le nombre de pages et tout contenu coupé.
- Une éventuelle assistance IA locale doit reprendre le besoin précis de la ligne et montrer le changement avant application ; ne pas réintroduire une seconde génération complète par défaut, supprimée par l'arbitrage d'octobre.

#### Ordre de réalisation et critères d'acceptation proposés

1. Fiabilité : niveaux de langue, années contextualisées, statut de confirmation des ajouts, contrôle du PDF réel. Cas négatifs annotés ; aucun verdict positif silencieux lorsqu'un fait critique est inconnu.
2. Évolution : versionner extraction/prompts/règles, conserver la provenance et invalider proprement le cache. Rejouer un corpus indépendant d'offres/CV FR et EN et revenir à la version précédente sans réécrire les CV enregistrés.
3. Ergonomie : écarts actionnables en premier, export unique, sections contextuelles et réglages progressifs. Depuis un écart, atteindre le bon texte en une action ; Word accessible sans traverser les réglages ; parcours contrôlé sur ordinateur et mobile.
4. Passage à l'échelle : mesurer coût et latence par étape, doublons d'extraction, échecs et abandons, puis mettre en place la déduplication serveur et la gestion de charge proportionnées au volume réel.

Vérifications exécutées : 237 tests Vitest ciblés passent (score, cache, tri, validation, pipeline et normalisation) ; les deux tests Playwright `pdf-legibility.spec.ts` passent sur les exports Elegant standard et serif. Sondes additionnelles : langue A1, cumul d'années hors métier, seuil DOM de 60 %, mesures du panneau. Les tests passent sur le contrat actuel ; ils ne démontrent pas la précision métier des critères absents. Aucun appel payant, aucune soumission chez un éditeur ATS, aucun test de charge et aucune génération de production nouvelle.


### K014 : mise en œuvre de l'audit ATS et de l'éditeur guidé (2026-11-15)

Demande utilisateur : « oui fais tout ça bien sûr ». Le choix de génération libre d'octobre est conservé ; ses ajouts sont maintenant distingués et confirmables. La politique `2026-11-15.1` centralise les versions, les sources officielles et les limites. Le corpus couvre niveaux de langue, années contextualisées, équivalences à vérifier, conditions du formulaire hors points, perte de texte et ordre dans le fichier PDF réel. La liste d'exigences est portée à 60, avec avertissement à la limite, sans prétendre prouver son exhaustivité.

Le backend réutilise une extraction privée par empreinte et version, protégée par un bail atomique ; un ancien travailleur ne peut pas écraser le suivant. La collecte hebdomadaire des trois sources officielles conserve texte et empreinte, comparaison avec le texte approuvé et état d'erreur. Sa réponse ne rejoint jamais un prompt. Les owners et le parcours opérateur de promotion/retour sont documentés dans README.md.

L'éditeur propose Contenu, Mise en page et À corriger. Les écarts précèdent les mentions couvertes, désormais dépliables ; Corriger ouvre la section et cible le champ, une sélection dans l'aperçu ouvre sa section sans voler le focus. Le menu Exporter de l'en-tête est l'unique accès PDF/Word/impression, Lettre reste à côté. Les contrôles de pages et le dernier résultat de vérification PDF restent visibles en pied de panneau. Le portfolio appartient à Contenu.

État de vérification intermédiaire : 969 tests unitaires, lint complet et build passent ; les tests PDF standard/serif lisent les fichiers réellement exportés. Le nouveau parcours Word passe à 375/768/1440 px et le refus d'un PDF illisible est testé. Le ciblage de la bonne langue a été corrigé et son test passe. Le collecteur a lu les trois URL officielles en local sans écriture externe : 3541, 21479 et 1133 caractères utiles respectivement. Jalon final : 973 tests unitaires et les 85 parcours E2E de la suite active vérifiés, lint et build sans avertissement CSS. Le backend de développement a été déployé ; les trois sources ont été collectées depuis Convex et leurs empreintes, identiques aux textes relus localement, approuvées pour la politique active. Le build Vercel bloque désormais la publication si le corpus ATS échoue. La production reste non publiée à ce stade. La revue a aussi renforcé la garde : un résultat chiffré ne passe plus d’un employeur à un autre ; un domaine ajouté librement ne crée pas des années spécialisées, lues sur les expériences source conservées. Le tri tient compte des sections masquées dans les autres parties du CV. Aucun appel IA payant durant ces vérifications.


### K015 : lettre intégrée à la candidature (2026-11-15)

Autorisation utilisateur : « ok go pour tout ça ». Owners : useCoverLetter, CoverLetterDrawer, coverLetters, export-letter et prompts/coverLetter. Le tiroir empile configuration et résultat, conserve une offre indépendante, charge 50 lettres même fermé et extrait l'entreprise à l'ouverture. Remplacement prévu par un espace document, offre commune, brouillons par compte/CV/offre, sauvegarde temporisée, motivation personnelle et révisions annulables. Les anciens enregistrements seront relus sans suppression. Les contrôles de sortie portent sur longueur, nombres et noms détectables, sans prétendre prouver toute affirmation sémantique. Vérifications à venir : tests unitaires, e2e hermétiques, exports réels et responsive.


Jalon K015 : le tiroir a été remplacé par CoverLetterWorkspace, le hook réduit de plus de 400 lignes à moins de 200 lignes par extraction des helpers, et le prompt d’extraction d’entreprise devenu inutile supprimé. Ouverture sans IA, révisions ciblées appliquées côté serveur, historique de 20 textes persisté, copie du CV avec son design au sein de la candidature, liste connectée paginée et indexée par date. La compatibilité des anciens onglets est préservée aux deux anciens endpoints publics. Premier passage complet : 83 E2E réussis et un test transitoirement perturbé par le rechargement Vite pendant les éditions ; les 43 tests ATS et lettre rejoués passent tous. 950 tests unitaires et lint passent après les derniers contrôles. Vérification finale et revue visuelle en cours ; captures de données de test à 375/768/1440 px dans le dossier d’artefacts Codex du 2026-11-15.


Jalon final K015 : 950 tests unitaires, lint complet, build et 87 E2E passent (capture PDF manuelle volontairement inactive). Après les deux derniers détails de focus et d’annulation, les 22 parcours lettre/tableau de bord passent à nouveau. Les tests lisent les vrais PDF CV/lettre et les téléchargements Word/texte ; les actions IA des scénarios de rédaction, révision, échec et réponse tardive sont simulées et aucun appel non prévu n’est transmis. Les droits et la migration des lettres connectées sont testés au seam serveur, sans session Clerk réelle. Les captures finales à 375/768/1440 px ont été relues : contexte compact sur mobile, document et exports accessibles. Graphe AST rafraîchi sans LLM (232 fichiers). Backend de développement déployé ; aucun push ni publication de l’interface de production. La lettre contrôle chiffres, noms détectables et longueur, sans garantie de vérité sémantique totale.
