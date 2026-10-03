# Rapport de passation — problème « trous » Forge Map

> **MISE À JOUR FINALE 27/07 nuit — CAUSE DES « TROUS » LOCALISÉE : L'EXPORT UNREAL.**
> Enquête menée EN PILOTANT LE JEU dans le navigateur (compte claudetest, sonde
> raycast sur la scène vivante) + raycast 3D exact (Möller–Trumbore) sur les
> fichiers. Boucle fermée : jeu = fichiers = source, aux mêmes points, MISS
> partout pareil. Pipeline : 0 cellule perdue. Runtime : 0 perte réelle (le
> « R=491 » d'une passe intermédiaire était un artefact de projection XZ sur
> parois verticales/triangles géants). CONCLUSION : les zones vides en jeu sont
> vides DANS halo_map.glb. L'éditeur Unreal, lui, affiche un terrain continu →
> le maillon fautif est l'EXPORT. Hypothèse principale : WORLD PARTITION (seules
> les cellules chargées s'exportent, le reste disparaît en silence — motif
> mesuré : centre complet, périphérie trouée). Le plugin NarvosExporter détecte
> désormais WP et affiche la procédure (charger toutes les cellules avant
> export). ACTION UTILISATEUR : recompiler le plugin, charger toutes les
> cellules, réexporter, puis re-chunker (puzzle-chunks --spatial + ktx2
> --no-uastc-normals + clean-chunk-slivers + bump CACHE_VERSION).
>
> Note : le correctif DoubleSide (ci-dessous) reste valable — il traite les faces
> de terrain cullées, un défaut réel mais distinct des zones totalement vides.

> **MISE À JOUR 27/07 soir — DoubleSide (défaut réel, distinct).**
> Les matériaux MWAM (terrain/rochers) sont les SEULS simple-face de toute la
> map : 242 matériaux / 110 520 triangles dans les chunks (source : 244 sur
> 12 965). Le backface culling supprimait chaque face de terrain vue « du
> mauvais côté » — d'où des trous DÉPENDANT DE L'ANGLE DE CAMÉRA (le symptôme
> décrit dès le premier signalement) et l'envers du terrain visible à travers
> la neige en vue aérienne. Unreal affichait ce master material en double-face ;
> l'export l'a marqué simple-face.
> Correctif : `side = DoubleSide` sur les matériaux MWAM au chargement du chunk
> (StreamingPuzzleMap) ET sur le clone triplanaire (makeAutoMaterial), plus
> flip `faceDirection` dans FRAG_NORMAL pour l'éclairage des faces arrière.
> Vérification attendue : les trous ne bougent plus avec la caméra.

Session du 27/07/2026. Destinataire : prochaine session (Opus 5).
Règle de travail imposée par l'utilisateur : **ne rien déclarer validé sans confirmation en jeu**.

---

## 1. Le problème ouvert

Des « trous » / artefacts visuels sur la Forge map (facettes pâles sur les rochers,
morceaux qui semblent manquer). **Cause non identifiée.** Quatre hypothèses ont été
proposées durant la session ; trois réfutées, la quatrième jamais testée.

## 2. LE TEST DISCRIMINANT N'A JAMAIS EU LIEU — commencer par là

Deux boutons dans le HUD **F3** (panneau STREAMING DIAGNOSTICS) :

```
[ Culling : actif ]   [ Auto-material : actif ]
```

Sur TOUTES les captures fournies, les deux affichent « actif » : personne n'a
cliqué. (Les touches F6/F7 fournies initialement étaient MORTES — collision avec
le générateur de carte et le stress-test, handlers déjà pris plus haut dans
RpgGameWorld. Les handlers morts ont été supprimés ; seuls les boutons comptent.)

Arbre de décision, deux clics :

| action | si le défaut disparaît | correctif |
|---|---|---|
| Auto-material → COUPÉ | c'est le shader triplanaire | cf. §4 hypothèse normales plates |
| Culling → COUPÉ | c'est le frustum culling | resserrer marge / revoir sphères |
| aucun effet | géométrie source | ARRÊTER le diagnostic par captures ; piloter le jeu (preview browser) ou exporter la scène chargée |

## 3. Corrigé et vérifié durant la session (tout est mesuré, rien n'est supposé)

1. **Crash React récurrent — la découverte majeure.** Hooks appelés après `||`
   dans `BodyTintAdmin`, `MapGenPanel` (= le panneau F6 !) et
   `ArrowMutationAdmin` : `if (!open || !useEditMode()) return null;`. Le nombre
   de hooks changeait entre rendus → « Rendered more hooks… » →
   `GameErrorBoundary` **détruisait tout le monde de jeu**. Conséquences
   mesurées : map rechargée entièrement, colliders 91 → 990 (jamais libérés),
   textures GPU 1748 → 1927. Le symptôme ressemblait à « morceaux manquants ».
   Corrigé (hook remonté avant le retour anticipé) + garde anti-régression :
   `src/rpg/runtime/conditionalHooks.test.ts` (le projet n'a pas d'ESLint, tsc
   ne voit pas ce défaut).
2. **Sphères de culling** recalculées sur la géométrie réelle
   (`Box3.setFromObject`) — les métadonnées les sous-estimaient jusqu'à ×2,56.
   Log : `rayon de culling corrigé`.
3. **Nettoyage géométrie** (`scripts/clean-chunk-slivers.mjs`) : 292 020
   triangles d'aire nulle retirés (fabriqués par le pipeline prune/dedup/join —
   PAS par Draco, prouvé : ré-encoder une entrée propre à 14→22 bits en produit
   zéro) + 585 « lames » (AUTHORÉES dans la source Unreal, jusqu'à 1 320 u,
   0 dans les chunks après nettoyage). `CACHE_VERSION = 6`.
4. **Repli mémoire automatique** : `degradeVariant()` (high→med→low) sur
   `RangeError` dans le chargeur de chunks. Plus d'échec définitif.
5. **Auto-material triplanaire runtime** (`src/rpg/materials/`) : remplace les
   bakes Unreal délavés (0,45 texel/u sur les grandes surfaces vs 450 sur les
   petites). 4 défauts corrigés après revue adversariale (décorrélation
   couleur/relief, cartes ORM résiduelles, pré-upload GPU, échec partiel
   irrécupérable). **Fonctionne en jeu** : 242 meshes repeints, log confirmé.
6. **Variantes de qualité map opérationnelles** : chunks résolus dans le cache
   qualité (`variantes 8/12` au boot), ETC1S seul pour les maps (UASTC =
   RangeError dans le transcodeur Basis), workers KTX2 plafonnés à 4, migration
   one-shot `high → medium` des réglages persistés.

## 4. Hypothèse principale restante (non testée)

Les « taches » sont des **facettes triangulaires nettes** aux arêtes dures — pas
des trous (un trou laisserait voir l'arrière-plan). Signature de **normales
plates** : si les rochers du GLB ont des normales par face (export hard-surface
Unreal), `vAutoWorldNormal` interpolée reste constante par triangle → pente
constante → chaque facette reçoit 100 % neige OU 100 % roche, frontière suivant
exactement les arêtes. Correctifs candidats si le bouton Auto-material confirme :
recalculer des normales lissées au chargement (weld + computeVertexNormals sur
les meshes MWAM), ou élargir la bande de transition + bruit pour casser l'effet.

## 5. État build / fichiers clés

- tsc : 1 erreur PRÉEXISTANTE tolérée (`CollisionWorld.ts:20`). Tests : **558 verts**.
- `src/rpg/runtime/StreamingPuzzleMap.tsx` — chargement, culling, repli OOM, bascules
- `src/rpg/runtime/StreamingDebugHud.tsx` — boutons diagnostic (HUD F3)
- `src/rpg/materials/AutoMaterial.ts`, `autoMaterialStore.ts`, `autoMaterialConfig.ts`
- `scripts/clean-chunk-slivers.mjs`, `scripts/lib/clean-slivers.mjs`, `scripts/textures-to-ktx2.mjs`
- Skills : `.claude/skills/narvos-mesh-pipeline/`, `.claude/skills/narvos-measure-first/`
  (erreurs de méthode de la session documentées — les lire AVANT tout nouveau diagnostic)

## 6. Priorités utilisateur (ordre imposé)

- **P1** Forge Map stable — EN COURS, bloqué sur le test des deux boutons
- **P2** rendu chunks (s'inspirer des plugins C++ dans
  `C:\Users\aniss\Documents\TPSModelUE57_01 5.8\Plugins\`) — non entamé
- **P3** éditeur Forge : auto-texture manuelle (herbe/roche/sable/neige/terre) —
  l'infra existe (`autoMaterialConfig.ts`), manque l'UI — non entamé
- **P4** vue FPS avec arme (`FpsWeaponViewmodel` existe, jamais monté) — non entamé