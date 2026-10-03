# AUDIT FORGE ÉDITION — Éditeur de personnage & Éditeur de map

**Date :** 2026-08-02 · **Méthode :** revue statique ligne par ligne (aucun test runtime) · **Périmètre :** `src/rpg/forge/`, `src/rpg/characters/`, `src/rpg/forge/edit/*`

> Objectif initial rappelé par le commanditaire : récupérer tous les modèles de personnages existants, **découper automatiquement chaque partie du corps** (tête, torse, bras, jambes, mains, pieds) et bâtir un **système de personnalisation modulaire universel**, compatible animations, squelette, équipements et contenu futur.

---

## RÉSUMÉ EXÉCUTIF

| Sous-système | Verdict | Sévérité max |
|---|---|---|
| Éditeur de personnage | Le **vrai pipeline modulaire existe mais n'est branché nulle part** ; l'objectif initial (découper les héros existants) a été **abandonné silencieusement** au profit d'un pack externe unique | 🔴 |
| Éditeur de map | Fonctionnel en surface, mais **cassé dès que la map n'est pas au niveau y=0**, undo partiel, météo non WYSIWYG, sync live incomplète | 🔴 |
| `ForgeBuiltMap` (rendu in-game des maps éditées) | Le morceau **le plus sain** : dédup de templates, streaming par cellules, dispose étagé | ✅ |

**Total : 17 constats** (6 personnage, 11 map) dont 5 critiques.

---

# PARTIE 1 — ÉDITEUR DE PERSONNAGE

## 1.1 Ce qui existe réellement (4 implémentations concurrentes)

| # | Fichier | Rôle | État |
|---|---|---|---|
| A | `src/rpg/characters/modular/` (5 fichiers, ~580 lignes) | **Le vrai système modulaire** : catalogue de pièces, slots corporels, rebind squelette, remap d'os, assemblage | 🔴 **100 % code mort** — aucun import hors de ses propres tests |
| B | `src/rpg/characters/ModularCharacter.tsx` (167 l.) | Assembleur Quaternius (corps + tête + arme) | 🟠 Vivant mais **sans aucune animation** et arme flottante hardcodée |
| C | `src/rpg/characters/AnimatedModularCharacter.tsx` | Variante animée in-game | 🟡 Vivant, chemin séparé de B |
| D | `src/rpg/forge/ForgePersonnages.tsx` + `bodyParts.ts` | Forge actuelle : Sorcier + attachements rigides / teinte par bandes Y | 🟠 Vivant, admet lui-même être un placeholder |

Le pipeline le plus difficile — **re-binder un mesh de pièce sur le squelette du perso** (`rebindSkinnedMesh.ts`, 131 lignes, avec garde-fou `bindPoseDelta` ligne 112) — est **écrit, testé, et jamais appelé en production**.

## 1.2 Constats détaillés

| ID | Sévérité | Constat | Preuve |
|---|---|---|---|
| P1 | 🔴 | **Système modulaire non branché** : pas d'UI, pas de champ `equipped` dans `customCharacterStore`, aucun rendu in-game. Le travail le plus précieux est invisible pour le joueur | grep : zéro import de `characters/modular/` hors du dossier |
| P2 | 🔴 | **Objectif initial abandonné sans le dire** : `partCatalog.ts:9-12` déclare que Wraith/Murdock/Rampage « ne peuvent NI être découpés en jeu, NI recevoir les pièces » et ne catalogue **qu'un seul pack externe** (BikerBundle, 108 GLB, uniquement squelette `UE5_Mannequin_meta`). Pourtant une voie de découpe existe (cf. §1.3) | `partCatalog.ts:9-12` |
| P3 | 🟠 | **3+1 systèmes concurrents** se concurrencent au lieu de converger : chaque nouveau besoin a produit un nouveau composant au lieu d'étendre le pipeline `modular/` | tableau §1.1 |
| P4 | 🟠 | **Catalogue féminin incomplet** : `defaultOutfit` femme sans `head`/`arms`/`hands` (`partCatalog.ts:108-112`) ; `REQUIRED_SLOTS=["body"]` seul → personnage **sans tête** autorisé | `partCatalog.ts:108-112`, `bodySlots.ts` |
| P5 | 🟠 | **`SLOT_HIDES` incomplet** : seul `gloves→hands` est déclaré (`bodySlots.ts:36-40`) alors que le commentaire promet « un casque intégral remplace les cheveux » → casque + cheveux se chevauchent visuellement | `bodySlots.ts:36-40` |
| P6 | 🟡 | **ForgePersonnages (attachements)** : `CharacterConfig` fictive hardcodée (`gender:"male"`, `classId:"warrior_bruiser"`, lignes 60-63) ; ids `att_${Date.now()}` collisionnables ; offsets saisis **à l'aveugle par inputs numériques** (aucun gizmo dans l'aperçu) | `ForgePersonnages.tsx:60-63` |

## 1.3 Pourquoi P2 est la vraie erreur de conception — et la voie que Claude n'a pas explorée

Claude a conclu « les héros sont monolithiques, donc indécoupables » et a contourné le problème avec un pack externe. C'est factuellement faux à l'exécution :

1. **Les héros sont skinnés** : chaque sommet porte déjà `skinIndex`/`skinWeight`. La **région corporelle d'un sommet se déduit de son os dominant** — aucune intervention artistique n'est requise.
2. **Le projet fait déjà de la segmentation par sommets** : `bodyParts.ts` découpe le corps en bandes Y pour la teinte. La version par os dominant est strictement plus précise.
3. **Le remap inter-conventions existe déjà** : `boneRemap.ts` (145 lignes) possède les alias UE4↔Mixamo↔Meshy, et `rebindSkinnedMesh.ts:112` possède le garde-fou `bindPoseDelta` pour détecter une pose de bind incompatible — **jamais appelé**.

### Architecture cible proposée

```
┌─ OFFLINE (une fois, script node dans scripts/ comme les pipelines GLB existants)
│   extract-body-parts.mjs
│   Pour chaque GLB héros (Wraith, Murdock, Rampage, …) :
│     1. Charger SkinnedMesh + squelette
│     2. Os dominant par sommet (skinWeight max)
│     3. Classer chaque os dans une région via boneRemap (alias déjà écrits) :
│        head / torso / arm_L / arm_R / hand_L / hand_R / leg_L / leg_R / foot_L / foot_R
│     4. Découper la géométrie : triangle → région majoritaire de ses 3 sommets ;
│        triangles frontières DUPLIQUÉS dans les 2 régions (évite les coutures visibles)
│     5. Exporter 1 GLB par région, squelette COMPLET conservé (skinning intact)
│     6. Écrire parts-manifest.json : pièces, bounds, couverture, convention d'os
│
├─ CATALOGUE UNIFIÉ (runtime, extension de l'existant — il est bien conçu)
│   PartCatalog devient multi-packs : [BikerBundle] + [pièces extraites des héros]
│   bodySlots : REQUIRED_SLOTS = [body, head]
│   SLOT_HIDES complété : headwear→hair+beard, helmet→head(partiel), etc.
│
├─ ASSEMBLAGE RUNTIME (brancher l'existant, ne pas réécrire)
│   modular/ModularCharacter.tsx devient LE renderer des persos custom :
│     - rebindSkinnedMesh + bindPoseDelta (garde-fou) avant tout mix inter-packs
│     - animations : squelette complet par pièce → le retarget existant marche tel quel
│     - branchement dans RpgGameWorld.tsx cascade isCustomCharacter (~l.3019-3073)
│     - preview forge = le MÊME composant (fin des 3 systèmes B/C/D)
│
└─ PERSISTANCE
    CustomCharacter v1→v2 : ajout de equipped: Partial<Record<BodySlot, string>>
    Migration douce : absent → tenue par défaut du catalogue
```

**Compatibilité garantie par construction :**
- *Animations* : chaque pièce garde le squelette entier → le pipeline d'animation existant (retarget Mixamo) s'applique sans modification.
- *Squelette* : le garde-fou `bindPoseDelta` refuse l'assemblage si deux packs n'ont pas la même pose de bind (au lieu d'un rendu explosé silencieux).
- *Équipements* : les slots d'armes existants (`weapons.ts`, socket main) restent orthogonaux aux slots corporels.
- *Contenu futur* : ajouter un perso = relancer `extract-body-parts.mjs` ; ajouter un pack = un dossier + une entrée catalogue. Aucun code à toucher.

---

# PARTIE 2 — ÉDITEUR DE MAP

## 2.1 Points sains (à conserver)

- `ForgeBuiltMap.tsx` : 1 GLB parsé par modèle distinct, streaming par cellules (>80 objets, CELL=40/RADIUS=75/TICK=350 ms), dispose étagé, `compileAsync`, collisions au montage.
- `forgeSync.ts` : présence throttlée (100 ms) et scène débouncée (180 ms) — les bons réflexes y sont.
- `customMapStore.ts` : enregistrement `editor://` propre, la map éditée devient une map native pour tout le moteur.

## 2.2 Constats détaillés

| ID | Sévérité | Constat | Preuve |
|---|---|---|---|
| M1 | 🔴 | **`baseMap` cassée hors y=0** : un plan cliquable 500×500 est posé à y=-0.01 (`ForgeBuilderScene.tsx:265`) et `commitTransform` clampe `y≥0` (l.234, aussi `addObject` ForgeEditor.tsx:107-108). Sur la map Forge (sol ≈ -51), **chaque objet posé flotte ~50 m au-dessus du terrain** ; les clics sont interceptés par le plan y=0 au lieu du backdrop | `ForgeBuilderScene.tsx:234,265` |
| M2 | 🔴 | **Undo incohérent** : `EditHistory` ne snapshotte que `{objects, waters}` (`forgeSceneStore.ts:130`) → routes, terrains, calques **jamais annulables** ; undo après `createPath` laisse la route en place. Pire : `updateObject` (gizmo/sliders, ForgeEditor.tsx:212-219) **ne pousse pas d'historique** → les déplacements ne sont pas annulables non plus. Et `HISTORY_MAX=500` snapshots JSON complets ≈ 50 MB sur grosse scène | `forgeSceneStore.ts:130`, `ForgeEditor.tsx:212-219` |
| M3 | 🟠 | **Calques et préfabs non persistés** : `layers`/`prefabs` vivent en `useState` (ForgeEditor.tsx:45-49) → perdus au reload, et les objets référencent ensuite des `layerId` fantômes. Les préfabs partent dans un `localStorage 'forge_prefabs'` séparé, pas en DB | `ForgeEditor.tsx:45-49` |
| M4 | 🟠 | **WYSIWYG météo cassé** : `sunAngle`, `weatherPreset`, `fogDensity` réglés dans l'éditeur ne sont **ni sauvegardés dans `ForgeScene`, ni publiés** — `ForgeBuiltMap` n'a aucun rig météo. Le joueur ne voit jamais l'ambiance conçue par l'auteur | absence de champ dans `ForgeScene` + `ForgeBuiltMap.tsx` |
| M5 | 🟠 | **SplineTool : drag sur la sphère** : `onPointerMove` assigne `e.point` = intersection **sur la surface de la sphère de contrôle** (ForgeBuilderScene.tsx:112) → le point glisse n'importe où au lieu de suivre le sol. Il faut raycaster un plan (ou le terrain) pendant le drag | `ForgeBuilderScene.tsx:112` |
| M11 | 🟠 | **Sync live incomplète** : `forgeSync` ne diffuse que `{objects, waters, terrain, baseMap}` (forgeSync.ts:41) → **routes, terrains multiples et calques jamais synchronisés** entre éditeurs. Le snapshot distant écrase en plus toute la scène locale (« dernier save gagne », assumé v1 mais destructeur en co-édition réelle) | `forgeSync.ts:23,41` |
| M7 | 🟠 | **Perf éditeur** : `MeshRenderer` **clone toute la scène GLB par objet** (ForgeBuilderScene.tsx:79), aucun instancing (`InstancedMeshSystem` existe dans `render/` mais n'est pas utilisé) ; le scatter végétation = 6 clones complets par clic. Une forêt de 200 arbres = 200 scènes clonées en mémoire | `ForgeBuilderScene.tsx:79` |
| M6 | 🟡 | **`showShadows` décoratif** : le toggle existe (ForgeEditor.tsx:65) mais `WeatherRig` reçoit `shadows` en dur (ForgeBuilderScene.tsx:245) — il ne pilote que le Canvas, pas le rig d'éclairage | `ForgeEditor.tsx:65`, `ForgeBuilderScene.tsx:245` |
| M8 | 🟡 | **Sauvegarde théâtrale** : `forgeSceneStore.save()` persiste **à chaque mutation** (réécrit toutes les scènes en JSON à chaque fois) ; le bouton « Sauvegarder » et l'autosave re-sauvent un état déjà identique — pas de dirty-checking, coût localStorage croissant avec la scène | `forgeSceneStore.ts` |
| M9 | 🟡 | **`duplicateObject` : id collisionnable** — `obj_${Date.now()}` sans suffixe aléatoire (ForgeEditor.tsx:241) → deux duplications dans la même milliseconde = même id | `ForgeEditor.tsx:241` |
| M10 | 🟡 | **`alignObjects` destructeur** : aplatit tout à `y=0` (ForgeEditor.tsx:259). Nom trompeur pour une action qui écrase l'altitude de tous les objets sélectionnés | `ForgeEditor.tsx:259` |

## 2.3 Architecture cible (éditeur de map)

1. **Sol de placement réel** : supprimer le plan y=-0.01 ; raycaster le `ForgeMapBackdrop` (ou le `TerrainMesh` sculpté) pour le point de pose ; retirer le clamp `y≥0` de `commitTransform`/`addObject` (le clamp doit être optionnel, par map).
2. **Historique par commandes** : remplacer les snapshots JSON par un pattern Commande `{do, undo}` couvrant **objects, waters, paths, terrains, layers** — y compris `updateObject` (capture transform avant/après au drop du gizmo). Mémoire bornée, undo exhaustif.
3. **Persistance complète de la scène** : `layers` et `prefabs` déménagent dans `ForgeScene` (donc en DB et dans la sync live). Fin des layerId fantômes.
4. **Météo WYSIWYG** : ajouter `weather: {sunAngle, preset, fogDensity, shadows}` à `ForgeScene` ; `ForgeBuiltMap` monte le même `WeatherRig` avec ces valeurs.
5. **Instancing éditeur** : regrouper les objets par `modelUrl` en `InstancedMesh` (le système existe déjà côté moteur) ; scatter = 1 instanced mesh, pas 6 clones.
6. **Spline drag sur plan** : pendant le drag d'un point de route, raycaster un plan mathématique passant par le point d'origine (normale caméra ou Y), jamais la sphère.
7. **Sync v2** : inclure `paths`/`terrains`/`layers` dans le snapshot ; à terme granularité par opération (déjà prévu dans les commentaires de forgeSync).

---

# PARTIE 3 — ERREURS DE CONCEPTION À NE PLUS REPRODUIRE

Règles numérotées, issues des constats ci-dessus. À relire avant toute nouvelle feature Forge/personnage.

| # | Règle | Violé par |
|---|---|---|
| R1 | **Un pipeline non branché n'existe pas.** Si un système est écrit, soit il est branché dans la session, soit le rapport dit explicitement « écrit mais NON branché » | P1 (modular/ mort), P2 |
| R2 | **Ne jamais abandonner l'objectif initial silencieusement.** Si une contrainte technique bloque (« héros monolithiques »), documenter le contournement envisagé (segmentation par os dominant) et demander arbitrage au lieu de changer le périmètre | P2 |
| R3 | **Un seul système par responsabilité.** 4 assembleurs de personnage concurrents = 4 vérités divergentes. Étendre l'existant, ne pas en créer un nouveau | P3 |
| R4 | **Les commentaires ne doivent pas promettre ce que le code ne fait pas** (« casque intégral remplace les cheveux » alors que SLOT_HIDES est vide) | P5, P6 |
| R5 | **Jamais de constante monde hardcodée** (`y=0`, plan à -0.01) dans un éditeur multi-maps : le sol vient du raycast du terrain réel | M1, M10 |
| R6 | **L'undo couvre tout ou rien.** Un historique partiel est pire que pas d'historique : il donne confiance puis trahit | M2 |
| R7 | **Tout état visible dans l'éditeur doit être persisté et publié** — sinon le joueur ne voit pas ce que l'auteur a conçu (météo, calques) | M3, M4 |
| R8 | **Un état transitoire (useState) ne doit jamais être référencé par un état persisté** (objets → layerId fantômes) | M3 |
| R9 | **Pas d'id `Date.now()` seul** dans un système où deux actions peuvent survenir dans la même milliseconde | M9, P6 |
| R10 | **Un toggle qui ne pilote rien est un bug**, pas un détail (`showShadows`, `renderDistance` dans les audits précédents) | M6 |
| R11 | **La sync collaborative doit couvrir le même schéma que le store local** — sinon la co-édition diverge silencieusement | M11 |

---

## ANNEXE — Fichiers inspectés

`src/rpg/characters/modular/` (partCatalog, bodySlots, rebindSkinnedMesh, boneRemap, ModularCharacter) · `src/rpg/characters/ModularCharacter.tsx` · `AnimatedModularCharacter.tsx` · `src/rpg/forge/ForgePersonnages.tsx` + `bodyParts.ts` · `src/rpg/forge/ForgeEditor.tsx` · `ForgeBuilderScene.tsx` · `forgeSceneStore.ts` · `forgeSync.ts` · `forgePresenceStore.ts` · `ForgeBuiltMap.tsx` · `edit/EditHistory.ts` · `src/rpg/world/customMapStore.ts` · disque : `public/models/personnages/BikerBundle/` (108 GLB vérifiés présents)