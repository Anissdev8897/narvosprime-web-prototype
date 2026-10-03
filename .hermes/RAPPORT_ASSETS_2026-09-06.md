# Rapport d'assets — exploration complète du 2026-09-06

Trois dossiers explorés, tout mesuré sur disque. `Telegram Desktop` est
maintenant **vide** : ses 24 packs sont rangés.

---

## 1. L'état, en trois chiffres qui ne se recoupent pas

```
public/models/        265,6 Go   243 packs   11 431 fichiers de géométrie   ← la réserve web
   dont chargé par le jeu web       6,2 Go   377 GLB                        ← ce qui SERT
public/asset_game/       36 Go    24 packs   .uasset Unreal bruts           ← rangé aujourd'hui
Server/adk/…/Narvos/    ~33 Go               cuit ou cuisible pour nanos
```

**2,3 % de `models/` est réellement chargé par le jeu web.** Ce n'est pas un
défaut en soi — une réserve sert à piocher — mais ça dit où chercher quand on
optimise, et ça explique pourquoi un inventaire par dossier ne répond jamais à
la question « qu'est-ce qui est importé ».

### `public/models/` — 31 dossiers, mesurés

| dossier | poids | glb | fbx | uasset | images | fichiers |
|---|--:|--:|--:|--:|--:|--:|
| `personnages` | 83 Go | 1 594 | 13 | 0 | 1 105 | 3 359 |
| `systemes` | 28 Go | 1 406 | 0 | 0 | 3 377 | 6 472 |
| `creatures` | 27 Go | 561 | 703 | 0 | 225 | 1 616 |
| `environnements` | 25 Go | 883 | 0 | 0 | 1 771 | 2 658 |
| `Maps` | 21 Go | 153 | 0 | 0 | 497 | 664 |
| `armes` | 13 Go | 957 | 89 | 0 | 461 | 1 672 |
| `nature` | 13 Go | 695 | 90 | 0 | 843 | 1 788 |
| `batiments` | 11 Go | 693 | 0 | 55 | 899 | 1 655 |
| `divers` | 8,0 Go | 1 112 | 229 | 0 | 431 | 1 987 |
| `assets_character` | 7,4 Go | 201 | 0 | **1 315** | 186 | 1 821 |
| `animations` | 6,9 Go | 729 | 18 | 0 | 164 | 911 |
| `vehicules` | 5,0 Go | 636 | 0 | 0 | 1 239 | 2 204 |
| `export` | 4,5 Go | 28 | 26 | 21 | 48 | 164 |
| `vfx` | 2,4 Go | 195 | 1 | 0 | 554 | 898 |
| `materials` | 1,6 Go | 19 | 0 | 0 | 49 | 68 |
| `pnj` | 1,2 Go | 48 | 6 | 0 | 141 | 297 |
| `audio` | 994 Mo | 0 | 1 | 0 | 0 | 1 311 |
| `interface` | 808 Mo | 127 | 0 | 0 | 1 083 | 1 222 |
| `launcher` | 564 Mo | 0 | 0 | 0 | 334 | 563 |
| `textures` | 227 Mo | 0 | 0 | 0 | 13 | 13 |
| `plugins_cpp` | 185 Mo | 0 | 0 | 0 | 1 | 47 |
| `vehicule` | 113 Mo | 32 | 14 | 0 | 21 | 115 |
| `spells` | 53 Mo | 0 | 0 | 0 | 1 311 | 2 203 |
| `pet` | 33 Mo | 13 | 4 | 0 | 30 | 55 |
| `pnj_monstre` | 13 Mo | 20 | 0 | 0 | 0 | 20 |
| `HUD_` | 1,4 Mo | 0 | 0 | 0 | 17 | 17 |
| `voice_characters` | 1,6 Mo | 0 | 0 | 0 | 0 | 21 |

---

## 2. Déjà importé / reste à importer

### Importé et **chargé** par le jeu web — 377 GLB, 6,2 Go

| dossier | poids chargé |
|---|--:|
| `Maps` | 2 985 Mo (dont `forge_map/halo_map.glb` à lui seul : 2 984 Mo) |
| `armes` | 1 440 Mo |
| `personnages` | 913 Mo |
| `animations` | 534 Mo |
| `assets_character` | 168 Mo |
| `divers` · `vehicule` · `creatures` · `pet` · `pnj` · `pnj_monstre` · `nature` | 103 Mo cumulés |

Mesure : `node scripts/audit-runtime-assets.mjs` (part du **code**, pas du
disque).

### Importé et **cuisible** pour nanos — 2 265 assets, ~2,4 Go

`Narvos/Defender` 1 516 · `Narvos/SmartLocomotion` 355 ·
`Narvos/Mars_Sanctuary` 214 · `Narvos/FreeflowCombatSystem` 180.
Plus le pack existant (31 Go, 12 442 assets, 3 216 animations).

### Stagé dans l'ADK mais **pas encore promu** — 10 packs, ~21 Go

`AdvancedARPGCombat` · `DMD` · `SpaceScenes` · `Sewer` · `FPSShotguns_VOL1/2/3` ·
`City_Traffic_Pro` · `ProceduralWeaponAnimationSystem` ·
`Metahuman_Customization_System`. Ils existent sous `Content/<Pack>/`, hors de
`Narvos/`, donc **jamais cuits**.

### Jamais importé — 259 Go

Tout le reste de `models/` (97,7 %) et les 36 Go d'`asset_game/`. C'est une
réserve, pas une dette : rien ne se charge tant que rien ne le nomme.

---

## 3. Rangement fait — `public/asset_game/`, 36 Go

`Telegram Desktop` est vide. Rien n'a été supprimé : robocopy `/MOVE` déplace.

| dossier | packs | contenu |
|---|--:|---|
| `asset_futuriste/` | 3 | Mars Sanctuary · Space Scenes · Defender |
| `asset_medieval/` | 3 | Advanced ARPG Combat V3 · 4kFullFantasyGUI · Dynamic RPG Toolkit |
| `asset_epoque_moderne/` | 6 | Modern Shotguns · Freeflow Combat · CityTrafficPro · ModularSewers · Multiplayer Shooter · InventorySystemPro |
| `a_trier/systemes_sans_epoque/` | 7 | AI Behavior System · AIBehaviorToolkit · AdvancedGAS · Enhanced AI Movement · Open World AI Spawn · Hyper Skill Level Manager · SlotBased inventory |
| `a_trier/animations_neutres/` | 2 | Procedural Weapon Anim System · SmartLocomotion |
| `a_trier/nature_et_tech/` | 2 | FluidFlux · Spring Landscape |
| `a_trier/mixte_epoques/` | 1 | Meta Customization System |

**Pourquoi `asset_game/` et pas `models/`** : `models/` contient des **GLB et
PNG** lisibles par le navigateur, rangés par **type**, avec 87 chemins codés en
dur dans `src/`. Ces packs-ci sont des `.uasset` Unreal bruts : déposés dans
`models/`, ils seraient comptés par le catalogue comme de la géométrie et ne
serviraient jamais au runtime. `asset_game/` était vide — c'est la réserve.

**Pourquoi 12 packs en `a_trier/`** : aucune époque ne s'y applique. Un pack d'IA
n'a ni décor ni costume ; une animation de marche non plus. Le nom du
sous-dossier dit le motif du doute plutôt que de le cacher.

Deux effets de bord traités : `public/asset_game/` ajouté au `.gitignore`
(36 Go ne se versionnent pas), et Vite ne le copie pas
(`copyPublicDir: false`, déjà en place).

---

## 4. Fonctionnalités — présent / manquant

Deux runtimes, deux réponses. **nanos est la cible vivante.**

| système | jeu web (React) | nanos (Lua) |
|---|---|---|
| Inventaire | ✅ `rpg/loot/Inventory.ts` + sacs, coffres, slots | ✅ `Shared/Logic/Inventory.lua` (39 Ko) |
| **Mini-map** | ✅ `rpg/ui/hud/Minimap.tsx` + `MinimapHud.tsx` | ❌ **absente** |
| Butin | ✅ `LootRegistry`, loot procédural | ✅ `Logic/Loot.lua` |
| Marchands / boutique | ✅ `SHOP_CATALOG` | ✅ `Merchants` + `Vestiaire` |
| Équipement modulaire | ✅ `modularItems.ts` | ✅ `Vestiaire` + `Modular` (1 famille) |
| Props / décor | ✅ `PuzzleMap`, `StreamingPuzzleMap` | ✅ `Server/Props.lua`, `MapLoader` |
| Armes | ✅ | ✅ `Logic/Weapons.lua` |
| Véhicules | ✅ `runtime/vehicles/` | ✅ `Vehicule` (⚠ pas de vol dans nanos) |
| Sorts | ✅ `spellCatalog.ts` | ✅ `Logic/Sorts.lua` |
| Voyage entre mondes | ✅ | ✅ `Voyage.lua` (dimensions) |
| Émotes | — | ✅ `Emotes` + WebUI |
| Chat | ✅ | ✅ |
| Quêtes | ✅ 79 fichiers | ⚠ **3 fichiers — embryonnaire** |
| **Artisanat / craft** | ✅ 15 fichiers | ❌ **absent** |
| **Banque** | ⚠ 1 fichier | ❌ **absent** |
| **IA d'agression** | ⚠ partielle (`factions-ai`) | ❌ **rien** — `Spawner.lua` ne fait qu'invoquer |
| **Combat de mêlée** | ⚠ | ❌ **rien** |
| Locomotion animée | ✅ | ❌ blend spaces importés, **non branchés** |

---

## 5. Problèmes détectés

### 5.1 — 27 références GLB mortes — ✅ RÉPARÉ (27 → 0)

État final vérifié : `380 présents, 0 introuvables`, `tsc --noEmit` à 0 erreur,
2 347 tests verts. Ce qui suit décrit le défaut tel qu'il était.

| ce qui était cassé | réparation |
|---|---|
| 15 chemins inventés dans `timeToPlay.bench.ts` | ce sont des FIXTURES (`makeMockUrls`), pas des références — l'audit exclut désormais `.bench.` comme il excluait `.test.` |
| 2 chemins dans un commentaire d'exemple (`UniversalCharacter.tsx`) | pointés sur Wraith, qui existe |
| `forge_map.glb` (le fichier s'appelle `halo_map.glb`) | corrigé dans `assetScanner.ts` |
| `donjon_furiste_v2.glb` (monolithe supprimé, 4 chunks restants) | `path` → `donjon/chunk_01.glb` ; les 3 variantes de qualité identiques retirées |
| 6 `useGLTF` sur `Sorceres_hi_poly/`, **pack entièrement supprimé** | `HUMAN_FALLBACK` dans `avatarAssets.ts` — mesh Wraith + clips déjà éprouvés (68 os, 0 absent). Pas de clip de mort sur ce rig : slot laissé vide |
| 3 armes de `assets_character/rpg/weapons/` (dossier disparu) | repointées sur `armes/` |

⚠ Le plus grave était `HumanCharacter` : monté par trois surfaces sous un
`<Suspense>` **sans ErrorBoundary**, il chargeait six GLB absents — donc un
échec de parse glTF qui casse la branche, pas une dégradation.

#### Le défaut d'origine

Le code demande, le disque n'a pas. ⚠ Le fallback SPA de Vite répond **200
`text/html`** sur un fichier absent : aucune erreur, juste un modèle qui
n'apparaît pas.

**Cinq dossiers de premier niveau n'existent pas du tout** — noms anglais,
alors que l'arborescence est passée au français :

| demandé par le code | existe ? | l'équivalent réel |
|---|---|---|
| `/models/Characters/` | ❌ | `personnages/` |
| `/models/npc/` | ❌ | `pnj/` |
| `/models/weapons/` | ❌ | `armes/` |
| `/models/ships/` | ❌ | `vehicules/` |
| `/models/background/` | ❌ | `environnements/` |

Liste complète : `node scripts/audit-runtime-assets.mjs` (le script imprime
désormais les 27, il ne faisait que les compter).

Les autres manquants sont des fichiers isolés :
`Maps/forge_map/forge_map.glb`, `Maps/donjon_furiste_v2.glb`,
`animations/{archer,magic,melee}_pack.glb`,
`assets_character/Sorceres_hi_poly/**` (6),
`assets_character/rpg/weapons/**` (3).

### 5.2 — `vehicule/` **et** `vehicules/`

113 Mo contre 5,0 Go, deux dossiers dont le nom ne diffère que d'un `s`.
`vehicule/` est le **runtime** (29 chemins en dur, à ne pas renommer),
`vehicules/` la réserve. Un `ls` ne le dit pas ; seul le catalogue le dit.
À laisser tel quel, mais à connaître.

### 5.3 — Fichiers en vrac à la racine de dossiers

- `environnements/` : ~90 PNG isolés + `Untitled.glft.bin` / `Untitled.glft.gltf`
  (extension mal orthographiée — ce n'est pas `.gltf`)
- `armes/` : ~30 fichiers isolés (`.glb`, `.fbx`, `.obj`, `.mtl`, `.T3D`,
  `README.txt`) mêlés aux dossiers de packs
- `models/` racine : `mesh.frag`, `mesh.vert`, `.spv`,
  `water_normal_map_1778004838414.png`

### 5.4 — Coquilles vides

- `systemes/AdvancedGASSystem` : **2 PNG**, rien d'autre — le pack n'a jamais
  été converti
- `HUD_/` : 17 images, **0 pack** au catalogue
- `voice_characters/` : 21 fichiers, 0 pack au catalogue

### 5.5 — Doublons : sept packs vivent en deux formes

Ce ne sont **pas** des doublons à supprimer — ce sont des conversions (brut
Unreal ↔ GLB/PNG web). Mais il faut savoir lequel on édite.

| pack | brut (`asset_game/`) | converti |
|---|--:|---|
| 4kFullFantasyGUI | 769 Mo | `models/interface/fantasy_gui_4` (524 PNG) **et** `…/Client/UI/img/gui` (523 PNG) |
| AIBehaviorToolkit | 214 Mo | `models/systemes/AIBehaviorToolkit` (145 GLB, 4,1 Go) |
| AdvancedGASSystem | 346 Mo | `models/systemes/AdvancedGASSystem` (2 PNG) |
| Multiplayer Shooter | 1 003 Mo | `models/systemes/MultiplayerShooterSystem` (563 Mo) |
| Procedural Weapon Anim | 168 Mo | `models/animations/ProceduralWeaponAnimationSystem` (157 Mo) |
| Space Scenes | 3,1 Go | `models/environnements/SpaceScenes` (2,4 Go) |
| 4 packs promus | — | `Server/adk/Content/Narvos/…` (2 265 assets) |

⚠ **Les 523 PNG copiés ce matin dans le WebUI existaient déjà** sous
`models/interface/fantasy_gui_4` (524 PNG). La copie n'est pas inutile — nanos
sert ses fichiers depuis le package, pas depuis `public/` — mais c'est une
troisième copie du même jeu d'images.

### 5.6 — `export/` (4,5 Go)

Sorties d'export Unreal, marquées « source, pas runtime » par le catalogue.
À ne pas confondre avec du contenu jouable.

### 5.7 — Risque de propriété intellectuelle

Les 24 packs d'`asset_game/` sont des produits Fab/Marketplace **payants**
obtenus hors boutique. S'ajoute à la géométrie Halo déjà dans le pack de jeu et
aux assets Ankama de `Refonte.Dofus/`. Signalé, pas tranché.

---

## 6. Chantiers

### Importation / rangement

| # | chantier | état |
|---|---|---|
| 1 | Ranger `asset_game/` par époque | ✅ **fait** |
| 2 | `.gitignore` pour les 36 Go | ✅ **fait** |
| 3 | `audit-runtime-assets.mjs` imprime les références mortes | ✅ **fait** |
| 4 | Réparer les 27 références mortes | ✅ **fait** — 27 → **0**, voir §5.1 |
| 5 | Régénérer le catalogue : `npm run assets:catalog` | ❌ |
| 6 | Vider `a_trier/` : 12 packs à classer une fois leur usage décidé | ❌ |
| 7 | Ranger les fichiers en vrac (`environnements/`, `armes/`, racine) | ❌ |
| 8 | Décider du sort des 10 packs stagés non promus (~21 Go) | ❌ |

### Code nanos — le détail est dans `A_RECODER_NANOS_2026-09-06.md`

| # | chantier | pourquoi maintenant |
|---|---|---|
| 9 | **Cuire** + `nanos-build-asset-pack.mjs --apply` | rien n'existe pour le Lua tant que `Assets.toml` est périmé |
| 10 | Famille modulaire `defender` (15 pièces sur les 68 os) | 4ᵉ source dans `narvos-modular-to-lua.mjs` |
| 11 | Locomotion : brancher les blend spaces | deux appels, effet sur tout ce qui bouge |
| 12 | Monstres : ABP par archétype dans `Spawner.lua:113` | 10 ABP disponibles, un `""` passé aujourd'hui |
| 13 | **IA d'agression** — `Shared/Logic/IA.lua` + `Server/IA.lua` | rien n'existe ; découper en tranches (33 ms/tick) |
| 14 | **Combat de mêlée** — `Shared/Logic/Combat.lua` | 119 montages Freeflow + 5 armes |
| 15 | Props : source « pack NARVOS » dans le générateur | 144 meshes Mars cuits et invisibles au Lua |
| 16 | **Mini-map nanos** | existe côté web, absente côté nanos |
| 17 | **Craft** et **banque** côté nanos | absents |
| 18 | Quêtes nanos | 3 fichiers contre 79 côté web |
| 19 | Habiller le WebUI avec les 523 PNG | l'UI est 100 % CSS, sans une image |
| 20 | Trancher le masquage de peau (`M_NarvosPeau` en `Masked`) | décide si Mutable reste nécessaire |