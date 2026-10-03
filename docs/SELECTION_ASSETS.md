# SELECTION_ASSETS — Tâche 0 : choisir ce qui marche

Date : 2026-09-08 · Auteur : Kimi (sous-agent, tâche 0 uniquement).
Toutes les mesures ci-dessous ont été **refaites le 2026-09-08** depuis la racine
`E:\narvosprime-web-prototype`, avec les deux outils imposés :

```bash
node scripts/narvos-skeleton-compat.mjs <dossier>   # squelette vs SKEL_Mannequin (68 os)
node scripts/narvos-origine-glb.mjs <dossier>       # générateur, KTX2/WebP, WorldGridMaterial
```

La VRAM est estimée par décompression PNG : `largeur × hauteur × 4 octets × 1,33`
(mipmaps), lue dans l'en-tête IHDR des PNG — qu'ils soient sur disque ou
embarqués dans le chunk BIN des GLB. Node v24.15.0.

Sources d'index lues avant toute mesure : `WebPortal/public/models/CATALOG.md`
(243 packs) et `WebPortal/src/data/asset-catalog.json` (**existence vérifiée**,
chemin exact). Les chiffres cités « mesure du 2026-09-08 » sans sortie brute
ci-dessous viennent de la mission (64/221 pièces `_parts` importables, 82 %
d'allers-retours, 2 598 WorldGridMaterial sur le parc) — les miens sont
refaits pack par pack et collés en brut.

---

## 1. VÉHICULES — à roues uniquement

Rappel de la mission (vérifié par le propriétaire, non revérifié ici) : nanos
n'a que `VehicleWheeled` et `VehicleWater` ; aucun aéronef ni mech n'est
pilotable. Les roues s'attachent par **socket** (`VisWheel_FL`…) — critère
retenu dans l'analyse des nœuds.

### Candidat 1 — `vehicule/vehicule_terrestre.glb` ★ RECOMMANDÉ

```
$ node scripts/narvos-origine-glb.mjs WebPortal/public/models/vehicule
32 GLB sous WebPortal/public/models/vehicule
      25  Khronos glTF Blender I/O vN
       7  glTF-Transform vN
       7  KHR_texture_basisu   (Interchange n'importe AUCUNE image)
       0  EXT_texture_webp
       0  WorldGridMaterial
```

Lecture directe du GLB (chunk JSON) :

```
generateur : glTF-Transform v4.3.0        (transcodage d'un export Blender)
noeuds     : Mesh_0 | roue_d_ar | roue_g_ar | roue_d_av | roud_g_av
materiaux  : Material_0
extensions : ["KHR_draco_mesh_compression","KHR_texture_basisu"]
```

- **Squelette** : sans objet (static mesh terrestre). Mais les **4 nœuds de
  roues existent et sont nommés** (`roue_d_ar`, `roue_g_ar`, `roue_d_av`,
  `roud_g_av`) — le point d'accroche des roues est identifiable. Travail
  restant : convertir en SkeletalMesh ou créer les sockets `VisWheel_*` dans
  l'ADK (le patron `default-vehicles-main` attache par socket).
- **Textures/générateur** : d'origine **Blender** (pas un aller-retour Unreal).
  ⚠ Le GLB embarque ses textures en **KTX2** → import Unreal sans image. Mais
  les **3 JPG source 2048² sont sur disque à côté**
  (`vehicule_terrestre_Image_0/1/2.jpg`) : rebranchement possible, même recette
  que le piège 3 du skill.
- **Matériau** : `Material_0` — nom générique mais **pas** `WorldGridMaterial`,
  donc pas résolu vers le gris moteur ; à renommer à l'import.
- **VRAM** : 3 × 2048×2048 JPG → **63,8 Mo** (mesuré). Fichier : 1,8 Mo.

### Candidat 2 — `asset_epoque_moderne/CityTrafficProUE56` (voitures de ville)

Mesuré par listing (0 GLB → les deux scripts GLB ne s'y appliquent pas) :

```
587 .uasset, 0 .glb, 290 Mo
Cars/Meshes/Skeletal_Meshes/ : SK_Compact_Crossover, SK_Compact_Panel_Van,
  SK_Executive_Sedan, SK_Family_Hatchback, SK_Full-size_SUV, SK_Hatchback1,
  SK_Luxury_Car, SK_Minivan, SK_Pickup, SK_Sporty_Compact_Hatchback,
  SK_Sport_Wagon, SK_Station_Wagon  (+ Car_Skeleton, PhysicsAssets par voiture,
  SM_ correspondants et plaques d'immatriculation)
```

- **Squelette** : 13 voitures squelettiques sur **un `Car_Skeleton` partagé**,
  avec PhysicsAsset chacune — exactement la forme qu'attend `VehicleWheeled`.
  Les noms de sockets roues ne sont **pas lisibles sans ouvrir les .uasset**
  (voir incertitudes).
- **Textures/générateur** : pas de GLB, donc pas de KTX2. Route = **copie
  `.uasset` dans l'ADK** (skill §22) : 24/24 assets chargés dans le cas mesuré
  comparable, mais **24/24 gris** après copie — rebranchement des matériaux par
  nom de mesh à prévoir.
- **Matériau** : inconnu sans ouverture (incertitude).
- **VRAM** : textures cuites dans les .uasset, non mesurables par PNG ; le pack
  fait 290 Mo au total, ce qui borne le poids.
- ⚠ C'est aussi un **système de trafic** (code UE 5.6) : seuls les meshes et
  squelettes nous servent ; la logique ne tournera pas dans nanos.

### Candidat 3 — `vehicules/Voyager/.../MET_Taxi_01/SM__MET_Vehicles_Taxi01.glb`

```
3 GLB sous .../Voyager/Demo/Levels/CityLevel/Vehicles
       3  Unreal Engine N        ← aller-retour (signal négatif : doublon)
       0  KHR_texture_basisu
       0  WorldGridMaterial
```

Lecture directe : matériau **`M_MET_Taxicab_01`** (nommé), 3 images embarquées,
VRAM mesurée **23,9 Mo**, fichier 1,1 Mo. **Aucun nœud de roue** : c'est un
static de décor — utilisable en véhicule posé, pas en pilotable sans travail
de squelette. Et il faut l'extraire d'une démo de 4,6 Go.

### Écartés, avec chiffres

| pack | pourquoi |
|---|---|
| `vehicules/trailhunterpro` | **23/23 générateur Unreal** (aller-retour) ET **23/23 WorldGridMaterial** → gris garanti. 620 Mo. |
| `vehicules/FGear` (fgSedan.glb) | **2/2 WorldGridMaterial** (mesuré, matériau unique `WorldGridMaterial`) + FGear est un plugin C++ hors whitelist — ne tournera jamais côté nanos. |
| `asset_trier/Modern Tanks and Vehicles` | fichiers **STL / x_t d'impression 3D**, 7,6 Go, **aucune texture, aucun UV exploitable**. |
| `vehicule/wraith` | **832 Mo VRAM** (mesure du 2026-09-08, mission) — injouable. |
| `vehicule/chasseur_avion`, `phamtom`, `longswod`, `vehicules/StarSparrow`, `Voyager` (vaisseaux), `vehicule/packship` | aéronefs/spatial : **jamais pilotables** dans nanos (pas de classe). |
| `vehicule/robot_niko` (`hight_poly_robot…`, `robot_niko.glb`) | mech : pas de classe pilotable. |
| `vehicule/Ship` | `VehicleWater` existe — hors périmètre « à roues » de cette tâche. |

**Recommandation véhicules : `vehicule_terrestre.glb`** — seul véhicule à roues
d'origine Blender, 0 WorldGridMaterial, 4 nœuds de roues nommés, 63,8 Mo VRAM,
avec ses textures source sur disque pour corriger le KTX2. Second choix :
CityTrafficPro si on accepte la route .uasset + rebranchement (13 voitures
squelettiques d'un coup).

---

## 2. INVENTAIRE — l'UI (6 systèmes, il en faut UN)

Les six packs sont des packs **UMG/.uasset** : les critères squelette/KTX2/GLB ne
s'y appliquent pas (0 GLB dans chacun — mesuré). Les critères deviennent :
écrans UMG exploitables, modèle de données, poids. Re-mesure du 2026-09-08
(même méthode que `docs/INVENTAIRES_SIX.md` §2, étendue aux compteurs WBP/DT) :

```
Hyper V2             fichiers=5497 uasset=5478 WBP=0  DT=11 total=29.56Go
SystemPro(moderne)   fichiers=2223 uasset=2220 WBP=81 DT=13 total=1.69Go
SystemPro(a_trier)   fichiers=2223 uasset=2220 WBP=81 DT=13 total=1.69Go
SlotBased5.5+        fichiers=1095 uasset=1043 WBP=0  DT=11 total=1.89Go
HyperSlotV3          fichiers=1098 uasset=1043 WBP=0  DT=11 total=1.89Go
InvAndStat           fichiers=586  uasset=578  WBP=62 DT=4  total=0.47Go
Survival             fichiers=372  uasset=364  WBP=27 DT=4  total=0.50Go
```

Les chiffres de `INVENTAIRES_SIX.md` (2026-09-07) se **reproduisent à
l'identique**. Deux faits nouveaux mesurés aujourd'hui :

1. **`Inventory System Pro by Moonville` existe DEUX FOIS sur disque** :
   `asset_epoque_moderne/InventorySystemProbyMoonvilleUE54` et
   `a_trier/asset_trier/animation_craf/Inventory_System_Pro_by_Moonville` —
   mêmes 2 223 fichiers, 2 220 uasset, 81 WBP, 13 DT, 1,69 Go chacun.
   **Doublon : −1,69 Go à récupérer.**
2. `Hyper V2`, `SlotBased`, `HyperSlotV3` : WBP=0 confirmé — leurs widgets
   s'appellent `UI_*`/`BP_*`, pas `WBP_*` (déjà noté comme incertitude dans
   INVENTAIRES_SIX.md, levée seulement pour le préfixe : le compte réel d'écrans
   reste à faire, voir incertitudes).

### Classement

1. **`Inventory System Pro by Moonville` ★ RECOMMANDÉ** — 81 écrans UMG, 13
   DataTables (tags, input actions, descriptions, slots), 1,69 Go. C'est le
   modèle de données le plus propre et la maquette à copier. Reprend la
   recommandation d'INVENTAIRES_SIX.md, confirmée par re-mesure. Rappel du doc :
   aucun ne remplace `Logic/Inventory.lua` (1 021 lignes, persisté, testé) —
   on copie la **présentation**, pas la logique.
2. `Survival Crafting System` — 27 WBP, 0,50 Go, crafting par listes
   (Action/Category/Crafting/Item). Plus compact, beaucoup moins complet.
3. `Inventory and Stat System` — 62 WBP, 0,47 Go, mais stats élémentales
   (Fire/Kinetic/Shock) hors de notre modèle.

### Écartés, avec chiffres

| pack | pourquoi |
|---|---|
| Hyper Inventory V2 | **29,56 Go** pour un tout-en-un dont nous n'utiliserions que la maquette ; WBP=0 (écrans sous d'autres noms, non dénombrés). |
| SlotBased 5.5+ ≡ Hyper Slot V3 | **même produit deux fois** (1 043 + 1 043 uasset, 1,89 + 1,89 Go, mêmes DT) — doublon avéré, et redondant face aux 81 écrans de Moonville. |
| SystemPro(a_trier) | **doublon exact** de SystemPro(moderne) : −1,69 Go. |

---

## 3. CRAFT — établis, forges, enclumes (aujourd'hui : des `SM_Cube`)

### Candidat 1 — `nature/forge_outils` ★ RECOMMANDÉ (avec régime VRAM)

```
$ node scripts/narvos-origine-glb.mjs WebPortal/public/models/nature/forge_outils
6 GLB sous WebPortal/public/models/nature/forge_outils
       6  Khronos glTF Blender I/O vN
       0  KHR_texture_basisu
       0  EXT_texture_webp
       0  WorldGridMaterial
```

Détail par GLB (VRAM mesurée sur les PNG embarqués) :

| GLB | fichier | matériaux | VRAM |
|---|--:|---|--:|
| `hammer.glb` | 66,3 Mo | 2 (`Material.030/027`) | 128 Mo |
| `iron_hand.glb` | 30,4 Mo | 3 | 64 Mo |
| `blacksmith_metarials.glb` | 805,5 Mo | 40 dont `anvil`, `chain`, `hook` nommés | **1 532 Mo** |
| `blacksmith_metarialsv2.glb` | 805,5 Mo | idem | **1 532 Mo** |
| `uploads_files_6593390_blacksmith_metarials.glb` | 806,0 Mo | idem | **1 532 Mo** |
| `uploads_files_6593390_cgtrader_optimized_blacksmith_metarials.glb` | 800,5 Mo | idem | **1 532 Mo** |

- **Squelette** : sans objet (props statiques).
- **Textures/générateur** : 6/6 Blender, PNG dans le GLB, aucun KTX2.
- **Matériaux** : nommés pour les pièces-clés (`anvil`, `chain`, `hook`), le
  reste en `Material.NNN` (nommage Blender par défaut) — lisible, pas gris.
- **VRAM** : ⚠ les 4 gros GLB sont **le MÊME set de forge en 4 copies
  quasi identiques**, chacune à 1 532 Mo VRAM dont **3 textures 8K de la table
  en bois** (`Wood035_8K`, 340 Mo chacune, localisées : `Metarials/table/`).
  N'en garder qu'une et passer la table en 2K : le set tombe à ~576 Mo
  (1 532 − 3×340 + 3×21) ;
  `hammer` + `iron_hand` seuls : 192 Mo. Le set contient l'enclume (`anvil`),
  la chaîne, le soufflet — les stations cherchées.

### Candidat 2 — `environnements/Post_Apocalyptic/Meshes/` (établis modernes)

```
87 GLB — 87 Unreal Engine (aller-retour, 5.8.0 lu dans le JSON)
         0 KTX2 · 0 WorldGridMaterial
SM_workbench.glb        16,0 Mo | materiau MI_workbench | 4 images 2048² | 85 Mo VRAM
SM_cloth_workbench.glb  18,1 Mo | materiau MI_tarp      | 3 images 2048² | 64 Mo VRAM
```

Matériaux nommés proprement, VRAM raisonnable. Signal négatif : aller-retour
Unreal (doublon si la source .uasset entre un jour dans l'ADK).

### Candidat 3 — `batiments/ModularMedievalVillage` (set forgeron complet)

`SM_Anvil`, `SM_Furnace`, `SM_Bellows`, `SM_Hammer`, `SM_Sledge_Hammer`,
`SM_Trough`, `SM_Cauldron`, `SM_WeaponStand`… **ÉCARTÉ** :

```
219 GLB — 219 Unreal Engine · 0 KTX2 · 219 WorldGridMaterial
0 .uasset dans le pack (mesuré : find → 0)
```

**219/219 WorldGridMaterial** : le critère 3 est un critère d'exclusion, et il
n'y a pas de route .uasset de secours (le pack n'en contient pas).

### Écartés en plus

| pack | pourquoi |
|---|---|
| `divers/FPSTP_BlackEdition` (`SM_Workbench`) | **103/104 WorldGridMaterial** (mesuré) → gris. |
| `divers/SciFI_Lite_Assets` (`SM_WorkStation_01`) | non mesuré en détail ; même famille d'export que FPSTP, à mesurer si le besoin scifi survient (incertitude assumée). |

**Recommandation craft : `forge_outils`** — la seule forge complète d'origine
Blender avec matériaux propres ; à condition de ne garder qu'**une** des quatre
copies et de réduire la table 8K. Complément moderne : les deux établis
Post_Apocalyptic (85 + 64 Mo VRAM).

---

## 4. MINERAIS — filons, cristaux, veines (6 gisements sans mesh)

`Gisements.lua` (lu, 154 lignes) : 6 gisements (`filon_metal_rare`,
`grotte_cristaux`, `veine_vie`, `organisme_alien`, `ceur_plasma`,
`puissance_amelioree`), champ `mesh` absent **volontairement** — les 16 meshes
de matières du RPG Engine sont des GLB jamais importés, zéro sur seize dans
`Assets.toml` (vérifié par le rédacteur le 2026-09-07).

### Candidat 1 — `environnements/TropicalAlienWorld` ★ RECOMMANDÉ

```
$ node scripts/narvos-origine-glb.mjs WebPortal/public/models/environnements/TropicalAlienWorld
43 GLB — 43 Unreal Engine (aller-retour) · 0 KTX2 · 0 WorldGridMaterial
```

Meshes utiles aux 6 gisements (listing réel) : **`SM_cave_cristals`** (grotte à
cristaux), **`SM_lifeform1`** (organisme alien), `SM_rockFormation1..5` +
`SM_rock1` (filons/veines), plantes `SM_plant1..9` (veine de vie).

VRAM mesurée par mesh (PNG embarqués) :

```
SM_cave_cristals.glb   0,0 Mo | mat MI_emissive_Inst            | 0 image embarquee (textures du pack)
SM_lifeform1.glb       0,2 Mo | MI_emissive_Inst_2, MI_glow…    | 43 Mo
SM_rockFormation1.glb  15,5 Mo| MI_ground1_inst_2_…             | 64 Mo
SM_rock1.glb           15,3 Mo| MI_ground1_Inst5_…              | 64 Mo
```

Pack entier : 52 PNG sur disque = **1,49 Go VRAM** si tout est chargé ; les 5-6
meshes utiles aux gisements tournent autour de **~250 Mo** au total.
Matériaux tous nommés (instances `MI_*`). Seul signal négatif : aller-retour
Unreal. C'est le seul pack qui couvre **quatre gisements sur six** avec des
matériaux propres.

### Candidat 2 — `nature/24 Free Ores and Minerals KDRN` (`Rocks_Ores_Stick.glb`)

```
1 GLB — Khronos glTF Blender I/O · 0 KTX2 · 0 WorldGridMaterial
Rocks_Ores_Stick.glb  0,2 Mo | materiaux Bark, Wood, Stone, Ore, String, OreMat | 0 image | ~0 Mo VRAM
```

- **Matériaux nommés** (`Ore`, `OreMat`, `Stone`) et VRAM nulle : rochers à
  minerai low-poly non texturés (couleurs matériau). Parfait en **marqueur de
  filon** léger, pas en héros visuel.
- Les **230 PNG** du pack sont des **rendus 2D** des 24 minerais (256² et
  taille réelle) + des piles de rochers pixel-art en 6 couleurs : réserve
  d'**icônes**, pas de meshes.

### Candidat 3 — `systemes/RPGEngineUltimateMultip/RPG_Engine/CraftingSystem/Meshes/`

Les 16 GLB que `Gisements.lua` attendait (`SM_OreMetal`, `SM_Metal`,
`SM_Glass`, `SM_Transistor`…). **ÉCARTÉ** :

```
16 GLB — 16 Unreal Engine · 0 KTX2 · 16 WorldGridMaterial
```

**16/16 WorldGridMaterial** : même importés, ils sortiraient gris. Le commentaire
de `Gisements.lua` reste vrai, et la cause est maintenant mesurée.

### Écartés en plus

| pack | pourquoi |
|---|---|
| `nature/gems2doGerson` | **0 mesh** : GIF + spritesheets PNG de gemmes (2D) — icônes seulement. |
| `nature/Realistic_MossyRock` | **0 mesh**, 12 textures (673 Mo) : matière première, pas un filon. |

**Recommandation minerais : TropicalAlienWorld** — `SM_cave_cristals`,
`SM_lifeform1`, `SM_rockFormation1..5` couvrent 4 des 6 gisements, matériaux
nommés, ~250 Mo VRAM pour le sous-ensemble utile. Complément : KDRN pour les
filons légers et les icônes.

---

## 5. MODULAIRE — pièces au squelette IDENTIQUE, textures lisibles

Mesures refaites le 2026-09-08 sur les quatre packs candidats.

### Candidat 1 — `personnages/ZombieSoldierPack` (+ `_original`) ★ RECOMMANDÉ

```
$ node scripts/narvos-skeleton-compat.mjs WebPortal/public/models/personnages/ZombieSoldierPack
425 GLB comparés — reference SK_Mannequin.glb, 68 os
     358  IDENTIQUE
       4  IK SEULS
      58  INTERCALE
       5  ETRANGER
  362 GLB importables SANS retargeting.

$ node scripts/narvos-origine-glb.mjs …/ZombieSoldierPack
425 GLB — 419 Unreal Engine, 6 glTF-Transform
     360  KHR_texture_basisu
       1  WorldGridMaterial
```

- **Squelette** : **362/425 importables** (85 %) — le meilleur ratio du parc
  mesuré aujourd'hui.
- **Textures** : 360 KTX2 dans le pack runtime, **mais la paire
  `ZombieSoldierPack_original` existe** (44,8 Go, 246 PNG) — c'est la source
  d'import pour Unreal, comme établi au piège 3 du skill.
- **Matériau** : **1 seul WorldGridMaterial sur 425** — quasi irréprochable.
- **VRAM** : ⚠ `_original` = **15,20 Go VRAM** si tout est chargé
  (177 textures 4096² sur 246). L'import doit être **sélectif par tenue**
  (une tenue ≈ 2-4 textures 4K ≈ 180-360 Mo) — jouable par sous-ensembles,
  injouable en bloc. Tagué `modulaire` dans CATALOG.md : 425 meshes de pièces
  soldat/zombie post-apo.

### Candidat 2 — `personnages/_parts` / `_parts_png` (MetaCustom)

```
$ node scripts/narvos-skeleton-compat.mjs …/personnages/_parts
221 GLB — 58 IDENTIQUE, 6 SUR-ENSEMBLE, 112 INTERCALE, 24 REPARENTE,
          6 PARTIEL, 15 ETRANGER
  64 GLB importables SANS retargeting.
  (familles importables : samurai ×7, murdock ×6 SUR-ENSEMBLE, tr_f_body/form,
   tr_m_form, tr_pf_body/form ×6 chacune, ue4_mannequin ×6, cs_* ×9, tr_pf_* ×5…)

$ node scripts/narvos-origine-glb.mjs …/personnages/_parts_png   (version transcodée du jour)
221 GLB — 221 glTF-Transform · 0 KTX2 · 76 WorldGridMaterial
```

- **Squelette** : 64/221 importables — **reproduit exactement** le 64/221 de la
  mesure du matin. 112 INTERCALE, idem.
- **Textures** : la version `_parts_png` a **résolu le KTX2** (0 restant,
  contre 208 dans `_parts`).
- **Matériau** : **76/221 WorldGridMaterial** restants (la mission citait
  « 42 sur 70 » — mesuré sur un sous-ensemble ; sur les 221 je compte 76).
- À retenir **filtré** : les 64 pièces importables MOINS celles en
  WorldGridMaterial — le vestiaire homme/femme (`tr_*`, `cs_*`) y figure.

### Candidat 3 — `assets_character/SciFi_Trooper_Set`

```
squelette : 170 GLB — 56 IDENTIQUE, 38 REPARENTE, 71 ETRANGER, 5 SANS OS
origine   : 170 Unreal Engine · 0 KTX2 · 168 WorldGridMaterial
```

**56 pièces au squelette IDENTIQUE** mais **168/170 WorldGridMaterial (99 %)** :
le critère 3 est rédhibitoire en l'état. Le skill (§22/§26) a déjà payé la
réparation de ce défaut exact (rebranchement par nom de mesh + matériau propre
par pièce) — réparable, donc, mais **pas retenu** : un pack à réparer n'est pas
un pack qui marche.

### Écartés en plus

| pack | pourquoi |
|---|---|
| `personnages/BikerBundle` | **0/106 importable** : 84 INTERCALE + 16 ETRANGER ; et 58 KTX2. |
| `assets_character/wraith`, `murdock` | VRAM déjà mesurée : 832 Mo (Wraith.glb), 1 024 Mo (Murdock_Executioner.glb) — injouables. |

**Recommandation modulaire : ZombieSoldierPack via `_original`** — 362/425
IDENTIQUE/IK SEULS, 1 WorldGridMaterial, textures PNG source ; import sélectif
obligatoire (15,2 Go VRAM en bloc). `_parts_png` en second, filtré aux 64
pièces importables non grises.

---

## 6. VILLE — props d'intérieur et de rue

### Candidat 1 — `batiments/RootCellar` ★ RECOMMANDÉ (intérieur)

```
$ node scripts/narvos-origine-glb.mjs WebPortal/public/models/batiments/RootCellar
56 GLB — 56 Unreal Engine (aller-retour) · 0 KTX2 · 0 WorldGridMaterial
VRAM textures sur disque : 86 PNG = 1,47 Go (62 × 2048², 1 × 4096²)
```

Intérieur habillé (cave/cellier, noté dans CATALOG.md), matériaux tous nommés,
VRAM dominée par du 2K — un intérieur se charge par pièce, pas en bloc.

### Candidat 2 — `environnements/Post_Apocalyptic` (rue)

```
87 GLB — 87 Unreal Engine 5.8.0 · 0 KTX2 · 0 WorldGridMaterial
VRAM : 191 PNG = 3,92 Go, dont 186 × 2048² (une seule anomalie 5800×1800)
```

Props de rue post-apo, établis inclus (§3). Matériaux nommés (`MI_*`).
3,92 Go en bloc : à poser par quartiers.

### Candidat 3 — `environnements/ParkingGarage` (intérieur moderne)

```
157 GLB — 157 Unreal Engine · 0 KTX2 · 0 WorldGridMaterial
VRAM : 188 PNG = 7,07 Go, dont 48 × 4096² et 1 × 8192×4096
```

Propre côté matériaux, mais **7,07 Go VRAM** en bloc — un parking se visite
entier : retenu sous condition d'un régime 4K→2K, sinon écarté en pratique.

### Écartés, avec chiffres

| pack | pourquoi |
|---|---|
| `batiments/ModularMedievalVillage` | **219/219 WorldGridMaterial** (mesuré), 0 .uasset de secours. Dommage : 40 props de rue et le set forgeron. |
| `batiments/StylizedFantasyTown` | **170/170 WorldGridMaterial** (mesuré). |
| `asset_trier/Metaverse Futuristic Sci-Fi City` | 3 281 .uasset, **0 GLB**, 11 Go — route §22 seulement, non mesuré aux critères GLB. |
| `asset_epoque_moderne/ModularSewers&TunnelsUE53` | 549 .uasset, **0 GLB** — idem. |
| `asset_futuriste/Mars Sanctuary` | 244 .uasset, **0 GLB** — idem. |

**Recommandation ville : RootCellar** (intérieur) + **Post_Apocalyptic** (rue).
Les trois « villes » d'époque (Metaverse, Sewers, Mars) demandent la route
.uasset avec rebranchement de matériaux — chantier séparé, à mesurer quand il
sera ouvert.

---

## Synthèse des recommandations

| système | recommandé | une ligne, chiffrée |
|---|---|---|
| véhicules | `vehicule/vehicule_terrestre.glb` | Blender, 0 WorldGridMaterial, 4 nœuds roues nommés, 63,8 Mo VRAM, JPG source sur disque |
| inventaire | `Inventory System Pro by Moonville` (copie `asset_epoque_moderne`) | 81 WBP + 13 DT, 1,69 Go ; son double dans `a_trier` = −1,69 Go |
| craft | `nature/forge_outils` (1 copie sur 4, table 8K→2K) | 6/6 Blender, 0 WGM, `anvil`+`chain`+`hook` nommés ; 192 Mo VRAM pour hammer+iron_hand, ~576 Mo le set après régime |
| minerais | `environnements/TropicalAlienWorld` | 0 WGM, matériaux `MI_*` nommés, couvre 4 gisements/6, ~250 Mo VRAM le sous-ensemble utile |
| modulaire | `personnages/ZombieSoldierPack_original` | 362/425 IDENTIQUE/IK SEULS, 1 WGM/425, 246 PNG source ; import sélectif (15,2 Go VRAM en bloc) |
| ville | `batiments/RootCellar` + `environnements/Post_Apocalyptic` | 0 WGM chacun, matériaux nommés, 1,47 Go / 3,92 Go VRAM par blocs |

## Ce dont je ne suis pas sûr

- **Sockets roues de CityTrafficPro** : les 13 voitures ont un `Car_Skeleton`
  partagé et des PhysicsAssets, mais je n'ai pas ouvert les .uasset — les noms
  de bones/sockets (`VisWheel_*` ou autre convention) sont **non vérifiés**. Si
  la convention diffère, le gabarit `default-vehicles-main` demandera un
  renommage dans l'ADK.
- **`vehicule_terrestre.glb` reste un static mesh** : les 4 nœuds de roues sont
  des nœuds de scène glTF, pas des sockets Unreal. La conversion en
  SkeletalMesh (ou l'ajout de sockets) n'est pas mesurée, seulement supposée
  faisable — c'est le risque principal de ma recommandation véhicules.
- **Compte réel d'écrans UMG des packs Hyper/SlotBased** : WBP=0 parce que
  leurs widgets s'appellent `UI_*`/`BP_*` ; je n'ai pas recompté sous ces
  préfixes. L'écart avec Moonville (81 WBP) pourrait être moins large qu'il ne
  paraît — le poids (29,56 Go) reste rédhibitoire pour Hyper V2.
- **WorldGridMaterial sur `_parts`** : je mesure 76/221 là où la mission cite
  « 42 sur 70 ». Je n'ai pas rejoué la mesure sur le sous-ensemble de 70 ; les
  deux chiffres peuvent être vrais chacun sur son périmètre. À trancher avant
  de filtrer les 64 pièces retenues.
- **Le squelette de `ZombieSoldierPack_original` n'a pas été mesuré** — j'ai
  mesuré le pack runtime (425 GLB KTX2) et supposé que `_original` porte les
  mêmes squelettes. La paire existe pour les textures ; rien ne garantit que
  les 362 IDENTIQUE s'y retrouvent un pour un.
- **« Aller-retour = doublon » est un signal, pas une preuve d'existence dans
  l'ADK** : je n'ai pas vérifié pack par pack si les sources .uasset de
  Post_Apocalyptic, RootCellar ou TropicalAlienWorld sont déjà dans l'ADK. Si
  elles n'y sont pas, réimporter le GLB n'est pas un doublon, juste un export
  propre.
- **VRAM des packs .uasset** (CityTrafficPro, inventaires, villes d'époque) :
  non mesurable par ma méthode PNG (textures cuites). Les poids disque sont
  donnés à la place — ce n'est pas la même métrique.
- **`divers/SciFI_Lite_Assets`** (SM_WorkStation_01) non mesuré : si un poste
  de craft scifi est un jour requis, la mesure reste à faire.
