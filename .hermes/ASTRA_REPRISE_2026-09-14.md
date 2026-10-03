# Reprise Astra après la passation finale de Claude

## État établi

Passation lue : RECAP_ASTRA_2026-09-14.md et RAPPORT_2026-09-14_anomalies.md.
Les sept corrections sont décrites par Claude comme écrites, avec démarrage serveur réussi, mais sans validation dans le client de jeu.

Astra a relancé `node scripts/lua-harness/tout.mjs` depuis `E:/narvosprime-web-prototype` : **92 harnais, 10 622 assertions réussies, 0 échec déclaré, 0 harnais rouge**, code de sortie 0. Sortie complète : `ASTRA_baseline_2026-09-14.log`.
Ce résultat ne prouve ni le rendu réel, ni la position de caméra, ni l'animation des vêtements. Aucun nouveau cook ou démarrage serveur n'a été exécuté pendant cette migration.

## Installation des Skills

Les 12 Skills proviennent de `ASTRA_skills_NARVOS_2026-09-14.zip`. Chaque fichier SKILL.md de l'archive a été comparé octet par octet à sa source Claude locale : les douze concordent.

Destination projet : `WebPortal/.agents/skills/<nom>/`.
Chaque dossier contient :
- `SKILL.md` : entrée adaptée à Codex, avec YAML name/description et périmètre précis ;
- `agents/openai.yaml` : métadonnées et sélection automatique autorisée ;
- `references/claude-original.md` : source Claude conservée sans modification.

Les deux CLAUDE.md et le récapitulatif sont également conservés dans `narvos-project-map/references/passation/`. Les fichiers `.claude` d'origine et l'archive n'ont pas été modifiés. Les sommes SHA-256 et chemins sont dans `ASTRA_skills_migration_2026-09-14.json`. Le script de migration refuse une destination existante.

La présence du Skill ne signifie pas que ses outils externes sont installés : Graphify, les intégrations Unreal/MCP et les mémoires Hermes doivent être vérifiés lorsqu'ils sont nécessaires. Aucun modèle, plugin ou service externe n'a été téléchargé ou configuré.

## Adaptations et garde-fous

| Source | Limitation constatée | Adaptation |
|---|---|---|
| Six anciens SKILL.md | Absence de YAML de découverte | name et description ajoutés dans les nouvelles entrées |
| nanos-world | Long historique et états contradictoires sur l'ADK | Entrée courte ; archive consultable selon le sujet ; documentation officielle prioritaire |
| narvos-lua | « Logic n'appelle jamais nanos » contredit par Comptes | Préserver la logique pure où elle existe et inspecter les adaptateurs réels |
| narvos-preflight | « AVANT chaque conclusion écrite » + npm test systématique | Preuves proportionnées aux affirmations ; contrôles du runtime concerné |
| narvos-iteration-guard | Vérification globale après chaque modification et compteurs anciens | Gardes pertinents conservés ; batterie globale pour reprise, intégration transversale ou bilan global |
| narvos-project-map | Carte/compteurs anciens présentés comme état courant | Points d'entrée et provenance ; état récent dans la passation |
| narvos-measure-first | Aire nulle présentée comme équivalente à deux sommets confondus | Inclure les sommets distincts colinéaires ; produit vectoriel et tolérance adaptée |
| narvos-level-design | Constantes web facilement transposées au moteur nanos | Confirmer runtime, axes, unités et dimensions actuelles |
| narvos-mesh-pipeline | Risque de mélanger pipeline web et cook Unreal | Séparer les deux chaînes et conserver les sources originales |
| narvos-error-log | Accumulation de toutes les erreurs dans l'entrée | Archive intacte ; nouvelles leçons durables dans les références |
| train-hermes | Déclenchement après tout correctif, même trivial | Stockage seulement des leçons réutilisables prouvées, sans prétendre entraîner un modèle |
| wasm-engine | Règles d'architecture formulées comme immuables | Préserver contrats et invariants ; évolution seulement justifiée et vérifiée |
| graphify | Déclenchement sur toute question projet, outils Claude présumés | Graphe quand utile ; vérifier les outils disponibles ; aucune délégation ou transmission automatique |

Garde-fous maintenus : autorité serveur, validation des entrées, protection des secrets, intégrité de la persistance, preuves datées, lecture des contrats d'API, sauvegardes et contrôle des destinations pour mutations destructrices, distinction écrit/branché/testé/observé.

## Prochaine reprise gameplay

1. Dans le client nanos : F4, hauteur des yeux et arme tenue ; vérifier le retarget du MetaHuman sur son nouveau porteur.
2. Inventaire I, onglet APPARENCE ou F8 : haut, pantalon et coiffure ; vérifier animation et matériaux, sauvegarde et rechargement. Ne pas réintroduire les menus MetaHuman supprimés.
3. Sorts des classes : visibilité des particules 3D, échelles et extinction des auras ; vérifier caméra de création et molette.
4. Si un vêtement reste gris ou en T-pose : examiner NarvosMaillage et les assets avant toute correction Unreal/cook. Un symptôme non observé reste à confirmer.
5. Après validation des corrections, poursuivre la maquette HUD System existante (hotbar, roue TAB, arme/munitions, viseurs), sans dupliquer les systèmes déjà présents.

Les anciennes sauvegardes peuvent conserver les anciens vêtements par défaut. Ne pas effacer ou migrer toutes les apparences sans une décision explicite sur les données à préserver.

## Sources de référence

- https://docs.nanos-world.com/fr/docs
- https://github.com/nanos-world/api
- https://learn.chatgpt.com/docs/build-skills
- https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra

## Validation de l'installation

Le résultat détaillé de la validation structurelle et de l'intégrité des références est enregistré dans `ASTRA_skills_validation_2026-09-14.json`. Cette validation ne constitue pas un test comportemental de chaque workflow spécialisé.