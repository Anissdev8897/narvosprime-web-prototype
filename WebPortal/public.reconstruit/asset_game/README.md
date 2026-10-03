# `asset_game/` — réserve d'assets bruts Unreal

**155 Go, 60 packs.** Mis en place le 2026-09-06 depuis
`C:\Users\aniss\Downloads\Telegram Desktop` ; retrié le 2026-09-09, puis le
2026-09-10 après les achats et audits de la nuit.

## Ce que ce dossier n'est PAS

Ce n'est **pas** `public/models/`. La distinction porte tout :

| | `public/models/` | `public/asset_game/` |
|---|---|---|
| contenu | **GLB + PNG** — lisibles par le navigateur | **sources Unreal / DCC brutes** — illisibles par le web |
| rangement | par **type** (armes, personnages, nature…) + tags | par **nature**, puis par **époque** |
| consommateur | le jeu web React/Three.js | l'ADK Unreal, pour cuire vers nanos |
| contrainte | ⚠ **87 chemins codés en dur dans `src/`** — aucun dossier de 1ᵉʳ niveau ne se renomme | aucune : **rien ne pointe ici** (grep vérifié le 09/09) |
| catalogue | `CATALOG.md`, généré par `scripts/asset-catalog.mjs` | ce fichier, tenu à la main |

⚠ `public/asset_game/` est dans `.gitignore` — 155 Go ne se versionnent pas.
Vite ne le copie pas non plus (`copyPublicDir: false` dans `vite.config.ts`).

## Rangement — la NATURE d'abord, l'époque ensuite

Tous les motifs sont au même niveau. Un pack ne se range par époque que s'il
peut être cuit tel quel ; sinon c'est sa **nature** qui décide, et aucune époque
ne le rendra cuisible.

```
                            poids   packs
mixte_epoques/            79,88 Go     6    un seul pack couvre plusieurs époques
asset_futuriste/          19,66 Go     9
systemes_sans_epoque/     12,16 Go    12    gameplay Blueprint/C++, sans décor ni costume
asset_epoque_moderne/     11,68 Go    10
sources_dcc/              11,42 Go     5    .blend .fbx .dsf .stl .max — pas encore de la géométrie de jeu
nature_et_tech/           10,28 Go     3    eau et paysage, valables à toutes les époques
asset_medieval/            5,29 Go     5
moteur_unity/              3,18 Go     5    .unitypackage — autre moteur, hors chaîne
animations_neutres/        0,61 Go     3    animations sur mannequin nu
a_trier/                   0,88 Go     2    boîte d'entrée : ce qui n'a pas encore été mesuré
```

**La nature se lit dans le format dominant, jamais dans le nom du dossier.**
Trois exemples payés :

- `Brendonrise 89 - Sci-Fi Props` : rangé en `asset_futuriste` sur son nom le
  09/09, c'est **un seul `.blend`** plus un dossier de liens `Desirefx.me`.
- `Asset Store – QA Police Station` : un `.unitypackage` de 1,16 Go — Unity.
- `Security Camera Vol 01` : 10 FBX + 90 PNG, **zéro `.uasset`**.

## `a_trier/` — boîte d'entrée, pas fourre-tout

Ce qui y reste porte le motif de son attente :

- **`glb_a_degraisser/`** — 3 GLB (walkie-talkie, keypad CC0, smartphone). Le
  GLB est le domaine de `models/`, pas d'ici — mais les poser tels quels dans
  l'arbre runtime y mettrait 84 Mo de PNG en 8192² et 4096², le piège VRAM
  documenté dans `CLAUDE.md`. Passer `scripts/narvos-degraisser-glb.mjs` d'abord.
- **`Drivable Cars - Basic Vehicle System`** — doublon exact, voir plus bas.

⚠ **Un second niveau « à trier » s'était créé DANS le premier le 07/09** et y
avait accumulé 68 Go en douze entrées, dont `animation_craf` qui n'était pas un
pack mais un groupe de neuf. Dissous le 09/09. Un dossier dont le nom répète
celui de son parent n'est pas un rangement, c'est un report.

## Deux doublons réels, 2,49 Go

Identiques fichier par fichier — seul l'emballage diffère :

| pack | copies | poids |
|---|---|---|
| `Inventory System Pro by Moonville` (2 223 fichiers) | `asset_epoque_moderne/InventorySystemProbyMoonvilleUE54` · `systemes_sans_epoque/Inventory_System_Pro_by_Moonville` | 1,69 Go |
| `Drivable Cars - Basic Vehicle System` (519 fichiers) | `asset_epoque_moderne/…` · `a_trier/…` | 0,80 Go |

Rien supprimé : la décision revient au propriétaire des licences.

`node scripts/asset-game-doublons.mjs` — signature d'un pack = le multiensemble
`{taille, nom}` de tous ses fichiers. Insensible au nombre de niveaux
d'emballage, qui varie d'un repack à l'autre : c'est ce qui a permis de voir que
les deux Moonville étaient le même pack malgré un niveau de plus chez l'un.

## Ce qui est déjà exploité ailleurs

Huit packs ont déjà une **seconde vie** dans le dépôt, sous une autre forme. Ce
ne sont pas des doublons à supprimer : ce sont des conversions.

| pack ici | déjà présent | forme |
|---|---|---|
| **`Metaverse Futuristic Sci-Fi City`** | `Server/Assets/narvos/` | **= `CITY_PACK`, 1 575 clés cuites — c'est la capitale Akarlys** |
| `4kFullFantasyGUI_UI_UE5` | `models/interface/fantasy_gui_4` | 524 PNG extraits |
| » | `Server/nanos_world/…/Client/UI/img/gui` | 523 PNG, pour le WebUI nanos |
| `AIBehaviorToolkitUE56` | `models/systemes/AIBehaviorToolkit` | 145 GLB |
| `AdvancedGASSystemUE56` | `models/systemes/AdvancedGASSystem` | 2 PNG (reliquat) |
| `Multiplayer Shooter System` | `models/systemes/MultiplayerShooterSystem` | GLB |
| `Procedural Weapon Anim System` | `models/animations/ProceduralWeaponAnimationSystem` | GLB |
| `Space Scenes` | `models/environnements/SpaceScenes` | 48 GLB + 192 PNG |
| 4 packs | `Server/adk/Content/Narvos/…` | cuits pour nanos (2 265 assets) |

⚠ **`Metaverse Futuristic Sci-Fi City` n'est pas un « joker à convertir ».** Le
chemin source `Content/CITY_PACK/BIG_CITY/MESHES/SM_Atm_Cube.uasset` est
exactement la clé cuite `Narvos/CITY_PACK/BIG_CITY/MESHES/SM_Atm_Cube`. Un
rapport du 09/09 l'avait compté comme un manque ; il est déjà en jeu.

## Deux risques ouverts

1. **Provenance `desirefx.me`** — repacks dont la licence est invérifiable
   depuis le disque : Drivable Cars Basic, QA Police Station, Brendonrise,
   MEGASTRUCTURE, et 8 raccourcis dans `20x Vehicles`. À trancher avant toute
   distribution.
2. **`Modern Tanks and Vehicles - 3D Print`** porte une licence **CC BY-SA-NC**
   écrite dans ses fichiers — **NC = non commercial**. Incompatible avec un
   client shipping. Échelle 1/100, STL non texturés : rien à en tirer même comme
   décor.

Audits détaillés : `docs/AUDIT_SOURCES_DCC_VEHICULES.md`,
`docs/AUDIT_PACK_DRIVABLE_CARS_BASIC.md`, `docs/AUDIT_A_TRIER_LOT1.md`,
`docs/AUDIT_A_TRIER_LOT2.md`, `docs/AUDIT_PACKS_FAB_20260909.md`.

⚠ Packs Fab/Marketplace payants obtenus hors boutique. Même nature de risque que
la géométrie Halo et les assets Ankama déjà signalés dans le dépôt.