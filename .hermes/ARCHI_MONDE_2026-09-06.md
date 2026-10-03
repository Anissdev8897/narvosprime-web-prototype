# Architecture du monde NARVOS — 2026-09-06

Ce qui a été mesuré, ce qui a été construit, ce qui reste ouvert.

---

## 1. Le point de départ

Quatre mondes voulus (Forge, Tour, île alien, Orbital) et une contrainte dure :
**nanos ne charge qu'un seul niveau**, et changer de map (`map <nom>` en console)
« reloads all packages and reconnect all players (like restarting the server) »
— doc nanos, `blog/2021-11-03-alpha-released.mdx:213`.

L'architecture précédente contournait ça avec des **dimensions** : chaque monde
était un paquet de `StaticMesh` posé par `MapLoader` à l'origine, dans sa propre
dimension. Elle ne s'applique plus, pour une raison mesurable : les trois maps de
terrain portent chacune un **Landscape**, et un Landscape ne se spawne pas depuis
le Lua.

---

## 2. Ce qui a été vérifié avant de choisir

| Question | Réponse | Source |
|---|---|---|
| nanos expose-t-il le level streaming ? | **Oui** — `LoadStreamLevel`, `UnloadStreamLevel`, `SetStreamLevelVisibility`, `GetStreamLevels`, événements `StreamLevelLoad/Show/Hide/Unload` | chaînes relevées dans `NanosWorld-Win64-Shipping.exe` + `StaticClasses/Level.json` de `nanos-world/api` |
| Avec quelle autorité ? | **Client** — chaque joueur pilote son propre streaming | `Level.json`, toutes les fonctions marquées `client` |
| nanos supporte-t-il World Partition ? | **Annoncé** : « full support to Level Streaming and World Partition … integrated with Level Entities making the Level StaticMeshes to load/unload as entities on demand » | `docs-master/blog/2023-02-01-january.mdx:157` — **annoncé, pas mesuré ici** |
| Un Landscape se copie-t-il entre niveaux ? | Non — LandscapeInfo, proxies, GUID | comportement moteur, confirmé par les warnings `LogLandscape` à l'assemblage |
| La classe `Gizmo` existe-t-elle ? | **Oui** — `SGizmo`, `ClientGizmo`, `AWorldGizmo`, `BP_TransformGizmoBridge` | chaînes du binaire + `Classes/Gizmo.json` |

---

## 3. Ce qui a été construit

### 3.1 Un niveau persistant, quatre sous-niveaux décalés

```
/Game/Narvos/Maps/Map_Narvos          persistant — ciel unique, tagué "Sun"
  ├── Map_Orbital   offset (0, 0, 0)
  ├── Map_Forge     offset (-8 000 000, 0, 0)              = -80 km
  ├── Map_Tower     offset (-8 000 000, 2 000 000, 0)
  └── Map_Alien     offset (-8 000 000, 4 000 000, 0)
```

Tous en `LevelStreamingDynamic`, chargés et visibles au démarrage — ce qui donne
les deux comportements : ça marche sans Lua, et `Level.*` peut les piloter plus
tard, par client.

**Renommages** (les noms d'exemple du pack ne disaient rien du jeu) :

| avant | après |
|---|---|
| `LandscapeAutoMaterial_MountainRange_Example` | `Map_Forge` |
| `LandscapeAutoMaterial_Desert_Example` | `Map_Tower` |
| `LandscapeAutoMaterial_Island_Example` | `Map_Alien` |
| `SpaceScenes/Maps/Map_Overview` | `Map_Orbital` |

Trois ont exigé le repli **dupliquer + supprimer** : `rename_asset` sur un World
récemment chargé rend `False` sans message.

### 3.2 `/Game/SpaceScenes` promu sous `Narvos/`

442 assets, un par un (`rename_directory` ment, `rename_assets` tue le
commandlet). 441 déplacés, `Map_Overview` par duplication. `[CoreRedirects]`
ajouté dans `DefaultEngine.ini` pour les 124 redirecteurs restants.

**Sans ce déplacement, la map espace n'aurait jamais été cuite** :
`Assets.toml` déclare `unreal_folders = ["Narvos"]`.

### 3.3 Un seul ciel

Quatre niveaux réunis, c'étaient quatre `SkyAtmosphere`, quatre soleils, quatre
brouillards — un ciel n'est pas local à un sous-niveau. Retirés : caméras ciné,
SkyLight, SkyAtmosphere, VolumetricCloud, ExponentialHeightFog, DirectionalLight,
PostProcessVolume, AtmosphericFog, TextRender, ColorChecker, Galaxy_Dome.

Remplacés par **un** jeu dans le persistant, tagué `Sun` — règle 2 de
`importing-maps.mdx` : le tag permet au script de surcharger le ciel. C'est
`Shared/Logic/Ciel.lua` (Ultra Dynamic Sky, **par joueur**) qui prend la suite.

### 3.4 Trois systèmes solaires

40 km entre le hub et chaque étoile, **69 km entre deux systèmes**.

| système | monde | étoile | planète | rayon planète |
|---|---|---|---|---|
| Verdant | forge | `SM_PlanetSphere27` | `(0, 4 400 000, 200 000)` | 415 m |
| Ocre | tower | `SM_PlanetSphere28` | `(-3 810 512, -2 200 000, -300 000)` | 415 m |
| Azur | alien | `SM_PlanetSphere29` | `(3 810 512, -2 200 000, 400 000)` | 415 m |

Rien n'a été créé : les 25 sphères de la map d'origine ont été **réemployées**.
Celles qui portent un matériau `MI_Planet*` sont des planètes ; les `MI_Galaxy_*`
sont des fonds et restent des fonds.

**Semis sur les routes** — un couloir vide de 40 km se traverse une fois :

| élément | nombre |
|---|---|
| astéroïdes (9 meshes, échelles 1,5 à 9) | 264 |
| piliers-repères | 9 |
| épaves de vaisseau | 3 |
| nappes de poussière / brume | 15 |
| météores en feu | 12 |

### 3.5 Points d'arrivée — mesurés au raycast, pas estimés

| monde | sol relevé | arrivée |
|---|---|---|
| forge | z = −2 484,8 | `(-8 000 000, 0, -2 385)` |
| tower | z = −85,5 | `(-8 000 000, 2 000 000, 15)` |
| alien | z = 1 485,7 | `(-8 000 000, 4 000 000, 1 586)` |
| orbital | — | `(0, 0, 7 000)` |

### 3.6 Six portails

Trois montées (une par monde, `exige_vol = true`, rayon 6 m sur le point
d'arrivée) et trois descentes (une par planète, rayon 478 m = rayon de la planète
+ 15 %, pour déclencher **en approchant** et non en touchant).

### 3.7 Vol et vitesse en orbite

nanos n'a **aucune** classe de véhicule volant. Ce qui existe :
`Character:SetFlyingMode(bool)` et `SetSpeedMultiplier(f)`. Le monde `orbital`
porte `vol = true, vitesse = 40` — 40 km en deux minutes au lieu de 70. Remis à
`false` / `1` en arrivant sur une planète, explicitement.

### 3.8 Gizmo X / Y / Z sur les props posés

`Gizmo` est **client**, `SetLocation` est **autorité** : le client manipule, le
serveur valide et applique.

- `Client/Gizmo.lua` — sélection, 3 modes, aimantation (10 cm / 15° / 0,25),
  cadence 120 ms + envoi forcé au relâchement.
- `Server/Props.lua` — `SienPar` (la propriété EST la liste `poses`),
  `Bouger` (portée 50 m depuis le **joueur**, échelle bornée 0,1–8),
  `EnvoyerListe`, `SupprimerProp`.
- Touches : `M` prendre/lâcher, `K`/`L` objet précédent/suivant, `J` mode.
  Ajoutées à la liste **fermée** de `Commandes.lua`, donc réassignables.

---

## 4. Défauts corrigés en passant

| défaut | cause | correctif |
|---|---|---|
| Cailloux gris du désert | `SM_Rock_01` est un mesh de **débris de particules** (`SpaceScenes/Effects`), matériau d'émetteur | 1 144 + 984 instances retirées |
| Cailloux invisibles en jeu | `Rock_SM` vit sous `/Game/Metahuman_Customization_System/` — **hors de `Narvos/`, jamais cuit** | 352 instances retirées |
| Montagnes de fond beiges | `MTL_MWAM_CoverRocks` a ses deux textures à `None` (le pack les laisse vides) | `TEX_MWAM_Rock_col` / `_nrm` branchées |
| 260 arbres mal placés sur `Map_Forge` | semis précédent, que tu m'avais dit de retirer | retirés |
| Nanite absent | 0 des 48 meshes de `SpaceScenes` | **44 activés** (`/Effects/` écarté : plans de FX translucides) |

---

## 5. Ce qui reste ouvert — et pourquoi

### 5.1 World Partition : la décision, et ce qu'elle coûte

Tu as raison sur le fond, et la conversion est faisable **exactement depuis
l'assemblage d'aujourd'hui** : `UWorldPartitionConvertCommandlet` ramasse le
niveau persistant **et ses sous-niveaux** (`GatherAndPrepareSubLevelsToConvert`,
`WorldPartitionConvertCommandlet.cpp:274`) et les fond en un monde partitionné.
Il écrit une map **nouvelle**, suffixée : l'actuelle n'est pas touchée.

Script prêt : `scripts/adk-convertir-world-partition.ps1`
(simulation par défaut, `-Appliquer` pour lancer).

**Il exige l'éditeur fermé** — c'est pour ça qu'il n'a pas été lancé.

Ce que la conversion change :

| aujourd'hui (sous-niveaux) | après (World Partition) |
|---|---|
| 4 niveaux chargés d'un bloc | cellules chargées autour du joueur |
| granularité = le niveau | granularité = la cellule |
| pas de HLOD | HLOD sur ce qui sort des cellules |
| pas de Data Layer | un Data Layer par monde |
| `Level.LoadStreamLevel(nom)` utilisable | inutile : le streaming devient spatial |

**Trois choses à recompter après, que le « Success » du log ne prouve pas :**
1. les 3 Landscape, découpés en `LandscapeStreamingProxy` ;
2. les 2 `InstancedFoliageActor` et leurs instances ;
3. les 303 acteurs semés dans l'espace.

Et deux inconnues qui ne se devinent pas :
- **le cook nanos accepte-t-il une map partitionnée ?** Le support est annoncé
  (blog janvier 2023), pas mesuré ici ;
- **le serveur streame-t-il ?** `WorldPartitionServerStreamingMode` existe dans
  le moteur, mais un serveur dédié charge TOUT par défaut. Si nanos laisse le
  défaut, seul le client y gagne.

### 5.2 Les autres systèmes natifs, et lequel manque

| système | état | remarque |
|---|---|---|
| **Nanite** | **fait** — 44 meshes | le levier le moins cher, indépendant du streaming |
| **HISM / ISM** | déjà en place | la végétation passe par `FoliageInstancedStaticMeshComponent` |
| **HLOD** | à faire | dépend de World Partition pour le HLOD moderne |
| **Data Layers** | à faire | API Python présente (`DataLayerEditorSubsystem`) ; un layer par monde |
| **PCG** | à faire | whitelisté par nanos ; remplacerait le semis manuel (3 698 instances) par une génération |
| **`WorldPartitionAutoInstancedActor`** | **piste non explorée** | présent dans l'API 5.7 : instancie automatiquement les acteurs identiques d'une cellule. C'est le système le plus adapté à « énormément d'objets » qui n'était dans aucune de nos listes |

### 5.3 Non fait, et annoncé comme tel

- **Animaux, insectes, bunker dans le menu des props.** Les packs existent
  (`creatures/` : Bear, Wolf, Deer, Buffalo, Raccoon, Rat, Fox, Spider, Lion,
  Tiger ; `environnements/High_Tech_Base` 1,5 Go et `SciFi_Space_Station` 1,1 Go)
  mais ils sont en **GLB, hors de l'ADK**. Il faut les importer (Interchange), les
  sauver un par un (les textures compilent en asynchrone), les promouvoir sous
  `Narvos/`, puis regénérer le catalogue. **Aucun insecte dans nos assets** —
  seule une araignée. **Aucun animal aquatique** non plus.
- **Le cook.** Rien de ce qui précède n'existe dans le pack tant qu'il n'est pas
  cuit. Exige l'éditeur fermé.
- **Le test en jeu.** Vient après le cook.
- **`SM_Patch_Sol` et les 4 `SM_MWAM_Grass*`** sont signalés morts par
  `narvos-verifier-catalogues.mjs` : ils existent dans l'éditeur, pas dans le
  dernier cook. Attendu, pas un défaut.
- **Le mobilier de la Forge ne suit pas le relief.** Pads de classe, coffres,
  zones de loot et armurier sont posés sur un cercle à une hauteur unique. Le
  terrain, lui, a du relief — et `Trace` est d'autorité **client**, donc le
  serveur ne peut pas sonder le sol. Il faudra mesurer les hauteurs dans
  l'éditeur et les générer en catalogue, comme `Patches.lua`.

---

## 6. Tests

`syntaxe-check` (46 générateurs + tout le Lua), `portee-check` (290 déclarations,
32 fichiers), et les 15 harnais : **1 000+ assertions, 0 échec.**

Trois harnais ont été **réécrits, pas contournés** :

- `voyage-tests.lua` exigeait une dimension unique par monde et un catalogue de
  meshes — les deux appartenaient à l'architecture précédente ;
- `ciel-tests.lua` exigeait `Foggy` sur la Tour, devenue désertique
  (`SandDustCalm`) ;
- `commandes-tests.lua` prenait `K` comme « touche libre » : elle est passée à
  `gizmo_precedent`.