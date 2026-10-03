# Ressources et matières : ce qui a un visuel, ce qui n'a rien — 2026-09-07

**Méthode :** chaque ligne est mesurée (sorties collées en fin). Seaux : CUIT
(`Assets.toml`) / ADK (`Server/adk/Content/Narvos/`) / DISQUE (`public/…`).
Ton : **médiéval-fantasy** vs **sci-fi** vs **industriel moderne**.

## 1. Les 16 meshes GLB de matières (CraftingSystem) — DISQUE seulement

`public/models/systemes/RPGEngineUltimateMultip/RPG_Engine/CraftingSystem/Meshes/`

**Mesuré : 16 GLB (212 Ko → 826 Ko), 0/16 dans le pack cuit** (`grep … Assets.toml → 0`).

| nom | ton | utilisable tel quel ? |
|---|---|---|
| `SM_OreMetal` | médiéval-industriel | ✓ ressource brute ; **pas** un minerai futuriste |
| `SM_Metal` / `SM_Cooper` / `SM_Glass` / `SM_Gunpowder` | industriel simple | ✓ matières de base |
| `SM_Screw` / `SM_Nylon` / `SM_Rubber` / `SM_Leather` / `SM_Textile` / `SM_Leaf` / `SM_Stick` | médiéval-industriel | ✓ composants génériques |
| `SM_Lamp` | industriel | ✓ objet |
| **`SM_Microchip`** | **sci-fi** | ✓ — la seule vraie matière futuriste de la série |
| **`SM_Transistor`** | **sci-fi** | ✓ |
| **`SM_CompLens`** | **sci-fi** | ✓ (lentille/optique) |

⚠ **Aucun n'est dans l'ADK** (import requis, puis cook) ; registre : rien dans
`Items.lua`, rien dans `professionCatalog.ts`. Tous sont **sans catalogue**.

## 2. Icônes WebP : 432 fichiers, 18 familles × 24 (2D seulement)

`public/textures/icons/craft/` — **à plat, pas de sous-dossiers** ; 24 fichiers
par famille (`tex_<famille>_NN.webp` + `_NN_b.webp`) :

`bone · cloth · container · feather · gemstone · herbs · ingots · leather ·
meat · mushrooms · reagent · recipes · seeds · spare_parts · stone · strings ·
tools · wood`

- **Ton** : `gemstone/ingots/stone/wood/bone/leather/cloth/meat/herbs` = médiéval-fantasy ✓ ;
  `spare_parts/tools/container/recipes` = industriel/moderne (acceptable) ;
  **aucune famille sci-fi** (pas de plasma, pas de circuit, pas d'ADN).
- **Registre** : aucune de ces 432 ne correspond à un item du catalogue 26 — ce
  sont des icônes pour la future UI de craft, pas des visuels d'items.

## 3. Rochers : 86 GLB (mesuré, pas « ~50 »)

`find public/models -iname '*.glb' | grep -iE 'rock|roch'` → **86** (les « 207 »
naïfs comptaient `claymore`/`core` — piège `ore` encore). Exemples :
`batiments/DwarvenDungeons_ThroneRoom/Meshes/{Props/SM_SmallRock1..5, Rocks/SM_Rock1..}`
— **ton médiéval** (donjon nain). Peuvent servir de gisement visuel, mais
**aucun n'est cuit** et aucun n'est catalogué.

## 4. Le gabarit bûcheron (déjà câblé) — `src/rpg/professions/harvestModelCatalog.ts`

- **8 arbres** (`trees/tree01..08.glb` + `treeNN_summer.png`) et **8 buissons**
  (`bushes/bush01..08.glb` + `bushN_summer.png`) via `public/models/nature/retro_nature_pack` ;
  variété **déterministe** (hash de l'id du nœud), hauteur cible normalisée
  (5 m / 1,1 m), préchargement. Le commentaire d'origine (l.14) confirme :
  « les *24 Free Ores and Minerals* sont des PNG (icônes 2D)… le métier MINEUR
  conserve donc son **rocher procédural** ».

## 5. Les 18 ressources gather (professionCatalog.ts) — sans visuel 3D, ton médiéval

`bucheron` : bois_use, chene_solide, bois_ancien, bois_spectral, bois_lunaire, bois_legendaire
`mineur` : pierre_fragile, fer, acier, cristal_magique, minerai_lunaire, adamantite
`recolteur` : herbe_commune, racine_robuste, fleur_de_givre, lichen_arcanique, essence_lunaire, fleur_eternelle
+ forgeron/alchimiste/joaillier (`tiers: []`, recettes `RECIPES` : dague_fer, epee_acier, …)

- **0 sur 18 dans les 26 items** (confirmé : même constat que le lot 4).
- **Ton : médiéval-fantasy** (acier, adamantite, cristal_magique, lichen arcanique).
  `cristal_magique`/`essence_lunaire` peuvent passer en « cristal énergétique »
  avec un shader, `adamantite/minerai_lunaire` en métal exotique — mais
  **aucune matière n'a de mesh ni d'icône**.

## 6. ⚠ LE TROU (ce qui déclenche un achat)

Les **matières futuristes du catalogue 26** ont un visuel dans `Items.lua` :
**un emoji uniquement** (`fragment_vie 💚`, `cristal_energie`…). Mesure :
`find public -iname '*powernax*'` etc. → **0** ; `*cristal_energie*` → **0** ;
`*noyau_plasma*` → **0** ; `*adn_alien*` → **0**. Les seuls « plasma » trouvés
sont des **armes** (PlasmaRifle dans asset_futuriste/Defender) — pas des matières.

| item (26) | visuel 3D | visuel 2D | verdict |
|---|---|---|---|
| `metal_rare` | 0 | 0 | `SM_Metal`/`SM_OreMetal` à importer (pas sci-fi) ou à acheter |
| `cristal_energie` | 0 | 0 | **achat** (cristal énergétique) |
| `noyau_plasma` | 0 | 0 | **achat** (cœur/orbe plasma) |
| `adn_alien` | 0 | 0 | **achat** (échantillon biologique) |
| `powernax` | 0 | 0 | **achat** (module amplificateur) |
| `fragment_vie` | 0 | 0 (`herbs`/`gemstone` ne portent pas l'idée) | **achat** ou réemploi d'un hologramme |

**Conclusion : aucune ressource futuriste n'a de forme visible.** Le mineur
utilise un rocher procédural générique, et le joueur ne verra jamais la
différence entre `metal_rare` et `noyau_plasma` avant d'ouvrir l'info-bulle.
C'est le trou d'achat n°1. Les 3 seuls meshes sci-fi du dépôt (Microchip,
Transistor, CompLens) sont des **composants**, pas des minerais/matières.

## Commandes exécutées (extraits)

```
find WebPortal/public -iname '*powernax*' -o -iname '*noyau_plasma*' … | head → (aucun des 4 noms)
grep -cE 'SM_(OreMetal|Metal|Cooper|Glass|Gunpowder|CompLens|Microchip|Transistor|Screw|Nylon|Rubber|Leather|Textile|Leaf|Stick|Lamp)' Assets.toml → 0
find WebPortal/public/textures/icons/craft -iname '*.webp' | wc -l → 432 ; familles : 18 × 24
find WebPortal/public/models -iname '*.glb' | grep -iE 'rock|roch' | wc -l → 86
```