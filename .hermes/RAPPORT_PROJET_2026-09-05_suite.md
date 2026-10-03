# Rapport de session — 2026-09-05 (suite)

Fait suite à `RAPPORT_PROJET_2026-09-05.md`, écrit à 10 h 01 et qui s'arrête au
bloqueur Forge. Ce document couvre le reste de la journée.

---

## Métriques à la clôture

```
Entités de décor de la Forge        1 461  ->    623
Homonymes WorldGridMaterial           166  ->      0   (projet + sources GLB)
MaterialInstance sans parent          166  ->      0   (sur 13 738)
Textures vides de l'auto-material      12  ->      0   (x 3 instances de biome)
Assertions du harnais « ciel »                      34
```

Le recomptage final des matériaux a été fait dans un **processus neuf** — voir
§6, c'est le seul contrôle qui prouve quoi que ce soit ici.

---

## 1. Forge — le bloqueur est clos, sans transcodeur ni `.blend`

Le monolithe cuit était la **mauvaise version** de la bonne carte. Le user n'a
pas le `.blend`. La sortie n'était pas de reconstruire : un **second
`halo_map.glb`**, du 28/07, en PNG et sans `extensionsRequired`, dormait sous
`public/models/export/bullet/content/d/`. 3,06 Go, 7 965 nœuds, 7 202 meshes,
2 557 PNG.

Re-chunké en `chunks_unreal_v3` (8 morceaux, 4,8 Go, 630 nœuds / 959 primitives),
importé, cuit.

**Leçon retenue** : un bloqueur entier reposait sur « ce fichier n'existe plus ».
Dater les candidats avant de conclure à la rareté.

### Optimisation de tick, appliquée

La règle du projet : le coût du tick est le **nombre d'entités**, pas le volume
de géométrie. Mesuré précédemment : 12 987 entités → 113 ms, pour un budget de
33 ms. Le regroupement fait tomber la Forge de 1 461 à **623** entités.

---

## 2. Ciel et portails

`Sky` est la classe native nanos (Ultra Dynamic Sky intégré), **autorité
client** : zéro coût de tick serveur.

```
Shared/Logic/Ciel.lua           pur, testable
Client/Ciel.lua                 applique
scripts/lua-harness/ciel.mjs    34 assertions
```

Orbital reçoit `SkyMode.Space` — « ce n'est pas vraiment un ciel : c'est
l'espace ». La Tour reçoit `WeatherType.Foggy`.

**Portails posés sur les planètes**, coordonnées **mesurées** dans l'ADK par
`scripts/adk-bornes-meshes.py` (bornes des StaticMesh), jamais estimées :

```lua
{ de = "orbital", vers = "forge",  position = Vector(4885.3*M, -3646.6*M,  368.2*M), rayon = 348.0*M }
{ de = "orbital", vers = "tower",  position = Vector(-4789.0*M, -1035.7*M, 470.4*M), rayon = 341.0*M }
```

Conversion glTF → Unreal : `(x, -z, y)`, ×100.

---

## 3. `WorldGridMaterial` — 166 homonymes

Un GLB qui contient un matériau nommé `WorldGridMaterial` crée, à l'import, un
**homonyme du matériau par défaut du moteur**. Le terrain sort gris.

Renommés côté projet **et** côté sources GLB, avec
`WebPortal/scripts/glb-renommer-materiau.mjs` — réécriture en place du chunk
JSON, récursive, mode `AUTO`. Le nouveau nom doit tenir dans la longueur de
l'ancien (le remplissage compense), donc **ni re-chunkage ni réimport**.

⚠ **Exception à ne pas casser** : `src/rpg/materials/autoMaterialStore.ts:53`
définit `UNREAL_DEFAULT_MATERIAL = "WorldGridMaterial"` et s'en sert comme
sentinelle dans `isLandscapeFallback()`, appelée depuis
`StreamingPuzzleMap.tsx:489`. Ça couvre 26 % des triangles de la Forge **du jeu
web**. Ne jamais renommer celui-là.

**Erreur commise en route** : j'ai d'abord jugé les matériaux **par leur nom** →
7 faux positifs, dont des matériaux de PROJET légitimement nommés ainsi.
Correction : juger par le **chemin** (`/Engine/`), avec une colonne « homonyme »
séparée.

---

## 4. Auto-material de terrain — 12 textures vides

```
MTL_MWAM_AutoMaterial_MASTER   40 scalaires, 5 vectoriels, 12 textures
                               -> les 12 valaient ""
MTL_MWAM_Landscape_*Example    aucun paramètre surchargé
Texture2D sous MWLandscapeAutoMaterial : 0 à l'inventaire
```

Le graphe était intact. Les PNG 4096² étaient **sur le disque, jamais importés**.
`scripts/adk-brancher-automaterial.py` les pose sur les 3 instances de biome,
appariement par suffixe (`_col`, `_nrm`, `_msk`).

Deux choses à ne pas refaire :

- **Pas par UnrealMCP** : poser un paramètre déclenche la recompilation du
  shader, `set_material_texture_parameter` expire. Le commandlet, lui, attend.
- **Pas sur le master** : parcourir `expression_collection` a fait **crasher** le
  commandlet. `set_material_instance_texture_parameter_value` est l'API stable.

`get_material_parameters` de MCP ne lit que les paramètres du master — jamais les
surcharges d'instance. Un rapport vert de ce côté ne dit rien de l'écran.

---

## 5. Matériaux sans parent — 166 → 0

Une `MaterialInstanceConstant` dont le parent ne résout pas rend le **damier gris
du moteur** et n'expose **aucun paramètre**. Silencieux : ni erreur d'import, ni
avertissement au cook.

Cause : assets venus de `GameAnimationSample`, copiés de `/Game/<X>` vers
`/Game/Narvos/<X>`. Un `.uasset` porte son chemin de package **en dur**.

Deviner par convention de nom a échoué (`M_Hair`, `M_PeachFuzz`,
`M_CoreC_Base_M_Body` n'existent nulle part). On est allé lire la réponse là où
elle est encore juste — le projet source.

```
adk-dumper-parents-source.py       sur GameAnimationSample, LECTURE SEULE
adk-appliquer-parents-source.py    traduit /Game/X -> /Game/Narvos/X, vérifie avant d'écrire
adk-migrer-depuis-source.py        migrate_packages pour ce qui manque
adk-ranger-migres.py               rename_asset vers Narvos/
adk-verifier-parents-materiaux.py  RECOMPTAGE, processus neuf
```

`166 → 4` par le relevé. `4 → 0` par la migration de `M_Master_Cloth_HS` : master
**+ 5 dépendances**, 54 Mo — une copie de fichier serait arrivée sans les
textures de veste.

**Rangement obligatoire sous `Narvos/`** : `Assets.toml` déclare
`unreal_folders = ["Narvos"]`. Un asset ailleurs existe dans l'éditeur et n'est
**jamais cuit dans le pack**. Fait par
`EditorAssetLibrary.rename_directory("/Game/Character", "/Game/Narvos/Character")`
— un vrai *Move*, qui réécrit les références.

### Ce que le déplacement a révélé

Les 4 dernières se sont rebranchées **seules**. Leur pointeur n'était donc pas
nul : il était **irrésolvable**, et Python le rendait `None` faute de pouvoir
charger la cible. Le mal n'était pas « des références effacées », c'était « des
références qui pointent un chemin où plus rien n'est ».

---

## 6. Trois pièges payés, tous de mon fait

**`save_asset` a `only_if_is_dirty=True` par défaut.** 162 réparations
rapportaient `OK` sans rien écrire — et ma relecture, faite dans le **même
processus**, lisait la mémoire et non le disque. Corrigé dans 4 scripts.
Règle : `False` quand on répare, `True` quand on importe (avec `False`, un import
réécrivait les 32 000 assets de `/Game/Narvos`, 13 Go, à chaque fois).
**Une écriture n'est prouvée que par un recomptage dans un processus neuf.**

**Git Bash réécrit tout argument commençant par `/`.** `/Game/Character/M_X`
devenait `C:/Program Files/Git/Game/Character/M_X`, avec pour seul symptôme un
« ABSENT de la source » trompeur. Arrivé deux fois. Les scripts normalisent
désormais eux-mêmes (`chemin_unreal()`), plutôt que de dépendre d'un
`MSYS_NO_PATHCONV=1` qu'on oublie.

**J'ai lancé un commandlet pendant que l'éditeur du user était ouvert.** Violation
de la règle « une seule instance ». Et j'ai édité un script pendant qu'un
processus allait le lire — il a tourné 25 minutes sans rien produire.

Une erreur de raisonnement aussi : j'ai écarté l'hypothèse « sans parent » en
m'appuyant sur `MTL_MW_Basic_Gray` comme contre-exemple — il était cassé lui
aussi. **Un test négatif sur un asset du même lot ne prouve rien.**

---

## 7. Système modulaire — apparence

- **`Corps morphable` supprimé** (`narvos_morphable_m/f` commentés dans
  `CORPS_RETENUS`) : pas de texture, mauvais offset.
- **Peau teintable** : `M_NarvosPeau`, neutre BLANC, cible `peau` ajoutée dans
  `Apparence.lua` sur 5 slots (torse, jambes, mains, visage, pieds). Le matériau
  est échangé avant la teinte, et **seulement si la teinte diffère du défaut**.
- **Slots de corps exposés** : le `if (#liste > 1)` de `Vestiaire.lua` masquait
  les slots à une seule pièce.
- La capsule suit l'échelle (`narvos_capsule_base`), 3 curseurs avec champ `axe`,
  `RATIO_MAX = 1.22`.

Trois bugs à moi sur le matériau de peau, qui le rendaient gris : sampler sans
texture par défaut, `SAMPLERTYPE_NORMAL` manquant, et un choix de texture qui
n'était juste que par chance alphabétique. Réécrit avec appariement par suffixe
(`_c` / `_n`) et `NARVOS_PEAU_REFAIRE=1`.

### Mutable — limite mesurée

`CustomizableObjectFactory` est exposé (l'asset est créable et compilable) et
l'instance est **entièrement pilotable** (22 setters de paramètres). Mais les
nœuds du graphe sont `UCLASS(MinimalAPI)` dans des en-têtes privés et
`UEdGraphPin` n'est pas réflexif : **le graphe n'est pas scriptable**. La voie
donnée est `UCustomizableObjectNodeTable`, qui lit une `UDataTable` — pilotage
par la donnée.

Autre limite : `SetMorphTarget` n'a pas d'`attachable_id`, et `PorteurCachable`
masque le mesh de base stylisé → les morphs sur corps stylisés sont
**inatteignables**.

---

## 8. Décalage de la map

`forge_decalage_x = 144780.0`, `_y = -156760.0`, `_z = -18243.0` dans
`narvos-map-proto/Package.toml`, pour poser la géométrie sous le sol de base.

⚠ **Jamais vérifié en jeu.** À faire : `/monde forge`, marcher, `/ou`.

---

## 9. Ce qui reste

1. **Cuire** — le user finissait d'ajuster ses textures dans l'éditeur. Chaîne :
   cook → `adk-dump-assets.py` → `nanos-build-asset-pack.mjs --apply` →
   catalogues → vérificateur. *(Une fois, j'ai construit le pack AVANT de cuire —
   sans dégât, mais refait dans le bon ordre.)*
2. Sort de `Content/NanosWorld/Maps/halo_map.umap` (9,7 Mo) — il est dans le
   dossier **réservé**, que la doc ADK interdit de modifier.
3. Ménage des GLB Forge : ~10,7 Go sûrs (`chunks_unreal`, `chunks_webp_backup`,
   `chunks_v2`, `chunks`), ~7,4 Go de plus après validation.
   ⚠ **`chunks_v3` est la map du jeu WEB — ne pas la supprimer.**
4. **Chantier monstres** : squelette commun pour les humanoïdes, un ABP par
   archétype (sorts / tir / mêlée), quadrupèdes à part. La cause des animations
   manquantes est connue : `Spawner.lua:115` passe un ABP **vide**. La cause des
   textures manquantes ne l'est pas — la piste non testée est la **capsule de
   collision blanche** d'un mesh non résolu, qui expliquerait les deux symptômes
   d'un coup.
5. `Spawnables.lua` : points d'apparition calibrés sur l'**ancienne** géométrie.
6. Modulaire, voie C : cuire des variantes de corps de même topologie comme
   pièces de slot.

---

## 10. Une correction que le user a dû faire lui-même

J'avais conclu « aucun problème de texture ». C'était faux. La mesure n'était pas
fausse — elle portait sur **l'ADK et non sur l'écran**, et mon vérificateur
comptait les textures **par défaut du moteur** (`T_White_srgb`, `T_Generic_N`)
comme des textures de projet. `adk-sonder-textures-mesh.py` les sépare désormais.

Nommer cet écart AVANT de conclure, pas après.