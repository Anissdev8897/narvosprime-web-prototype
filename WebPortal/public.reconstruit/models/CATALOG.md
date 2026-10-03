# Catalogue des assets — NARVOS PRIME

> Généré par `node scripts/asset-catalog.mjs`. **Ne pas éditer à la main.**
> À regénérer après tout ajout ou déplacement d'assets.

**247 packs · 27 catégories · 264.2 Go · 11 668 fichiers de géométrie**

## Comment lire ce catalogue

Chaque pack vit dans **un seul dossier**, choisi sur son type dominant, et porte
**plusieurs tags**. Les thèmes (sci-fi, médiéval…) recoupent les types (bâtiments,
props…) : les ranger tous les deux dans l'arborescence obligerait à dupliquer des
dizaines de Go. La navigation par thème se fait donc [par tag](#navigation-par-tag).

⚠️ **Les noms de dossiers ne se renomment pas.** 87 chemins sont codés en dur dans
`src/` (`/models/vehicule/` ×29, `/models/Maps/` ×15, `/models/nature/` ×14…). Ce sont
des chaînes de caractères : `tsc` ne verra jamais une rupture. Le libellé français
de ce catalogue est un affichage, pas le nom sur le disque.

## Catégories

| Catégorie | Dossier | Packs | Poids | Contenu |
|---|---|--:|--:|---|
| **Animations** | `animations/` | 12 | 7.4 Go | Clips, packs de locomotion, émotes |
| **Armes** | `armes/` | 27 | 13.2 Go | Armes de mêlée, à distance, boucliers |
| **Audio** | `audio/` | 5 | 1.0 Go | Sons, musiques, bruitages |
| **Bâtiments** 🆕 | `batiments/` | 7 | 11.7 Go | Architecture, donjons, villages, kits modulaires |
| **Cartes** | `Maps/` | 5 | 22.0 Go | Maps de jeu (forge, orbital…) et leurs chunks |
| **Créatures** | `creatures/` | 19 | 21.6 Go | Bestiaire, animaux, montures |
| **Effets** | `vfx/` | 10 | 2.5 Go | VFX, traînées, impacts, particules |
| **Environnements** | `environnements/` | 10 | 26.2 Go | Décors complets, scènes, niveaux |
| **Export brut** | `export/` | — | — | Sorties d'export Unreal — source, pas runtime |
| **Familiers** | `pet/` | 5 | 28 Mo | Compagnons |
| **HUD** | `HUD_/` | 0 | 0 ko | Éléments de HUD |
| **Interface** | `interface/` | 6 | 843 Mo | UI, HUD, icônes |
| **Launcher** | `launcher/` | 13 | 487 Mo | Écrans d'accueil, intro, sélection |
| **Matériaux** | `materials/` | 2 | 1.7 Go | Matériaux runtime (auto-material paysage…) |
| **Objets divers** | `divers/` | 15 | 8.5 Go | Props et objets non classés ailleurs |
| **Personnages** | `personnages/` | 14 | 89.8 Go | Avatars jouables, PNJ humanoïdes, skins |
| **Pièces de perso** | `assets_character/` | 5 | 7.9 Go | Éléments modulaires : têtes, tenues, accessoires |
| **Plugins C++** 🆕 | `plugins_cpp/` | 1 | 194 Mo | Sources C++ Unreal à étudier et porter dans NarvosEngine |
| **PNJ** | `pnj/` | 22 | 1.2 Go | Personnages non joueurs (marchands, quêtes) |
| **PNJ — Monstres** | `pnj_monstre/` | 20 | 13 Mo | PNJ hostiles |
| **Sorts** | `spells/` | 13 | 50 Mo | Effets de sorts |
| **Systèmes** | `systemes/` | 14 | 29.4 Go | Packs de gameplay UE (combat, IA, RPG) — à porter, pas à charger |
| **Textures & HDRI** 🆕 | `textures/` | 1 | 237 Mo | Textures autonomes, HDRI, ciels |
| **Végétation & Nature** | `nature/` | 14 | 13.0 Go | Arbres, plantes, roches, terrain |
| **Véhicules** | `vehicules/` | 4 | 5.4 Go | Vaisseaux, engins pilotables |
| **Véhicules (runtime)** | `vehicule/` | 3 | 22 Mo | Véhicules câblés au runtime — 29 chemins en dur, NE PAS RENOMMER |
| **Voix** | `voice_characters/` | 0 | 0 ko | Voix de personnages |

### Animations — `animations/`

Clips, packs de locomotion, émotes

| Pack | Poids | Meshes | Textures | Audio | Tags |
|---|--:|--:|--:|--:|---|
| `MoCapCombatAnimations_DualCharacter` | 1.8 Go | 72 | 37 | — | `code` |
| `WW100IdleAnimPack` | 1.1 Go | 111 | 10 | — | `modulaire` |
| `BlacksmithAnimations` | 1.1 Go | 44 | 29 | — | `medieval` |
| `Loot_Anim_Set` | 925 Mo | 124 | 8 | — | `modulaire` |
| `Tactical_HandSignals` | 784 Mo | 77 | 8 | — | `moderne` |
| `FPP_combat_fists` | 613 Mo | 111 | 9 | — | `code` |
| 🆕 `StealthLocomotion` | 562 Mo | 125 | 8 | — | `moderne` |
| `BaconCombatGraphU` | 318 Mo | 10 | 38 | — | `code` |
| `ProceduralWeaponAnimationSystem` | 164 Mo | 14 | 16 | — | `code` |
| `uta_locomotion` | 70 Mo | 41 | — | — | — |
| `animation_pooldive` | 17 Mo | 18 | — | — | — |
| `Variant_Combat` | 5 ko | — | 1 | — | `code` |

- **StealthLocomotion** — 125 GLB d'animation — candidat direct pour le blend de locomotion accroupie

### Armes — `armes/`

Armes de mêlée, à distance, boucliers

| Pack | Poids | Meshes | Textures | Audio | Tags |
|---|--:|--:|--:|--:|---|
| `CG_ShotgunPack` | 3.1 Go | 271 | 78 | 70 | `modulaire` |
| `FPS_Arms` | 1.8 Go | 215 | — | 20 | — |
| `Weapons` | 1.2 Go | 55 | 61 | 50 | — |
| `weapon` | 1.2 Go | 53 | 81 | — | — |
| `Action_Crossbow` | 1.1 Go | 106 | 11 | — | — |
| `HS_WeaponPack_03` | 1.1 Go | 30 | 36 | — | `modulaire` |
| `Animations` | 1.1 Go | 103 | — | — | — |
| `allweaponrpg` | 811 Mo | 18 | 50 | — | `fantasy` |
| `Materials` | 714 Mo | — | 27 | — | `texture` |
| `Meshes` | 281 Mo | 40 | — | — | — |
| `marteau_de_guerre` | 160 Mo | 2 | 5 | — | — |
| `epe_darks_fatastique` | 151 Mo | 2 | 5 | — | — |
| `Textures` | 121 Mo | — | 19 | — | `texture` |
| `Sci_fi` | 91 Mo | 74 | 37 | — | `scifi` |
| `Demo` | 89 Mo | 6 | 25 | — | — |
| `shoulderstock` | 67 Mo | 4 | — | — | — |
| `serpents-gem-scepter` | 28 Mo | 1 | 4 | — | — |
| `revolver` | 20 Mo | 3 | — | — | — |
| `source` | 16 Mo | 1 | — | — | — |
| `arme_aniss` | 11 Mo | 4 | — | — | — |
| `Weapons_Free` | 10 Mo | 12 | 1 | — | — |
| `fantasy_weapon` | 7 Mo | 16 | 16 | — | `fantasy` |
| `zMaps` | 4 Mo | — | 3 | — | — |
| `shotgun` | 4 Mo | 3 | 5 | — | — |
| `arc` | 3 Mo | 6 | 5 | — | — |
| `baton_magique` | 870 ko | 2 | — | — | — |
| `arrow` | 49 ko | 1 | — | — | — |

### Audio — `audio/`

Sons, musiques, bruitages

| Pack | Poids | Meshes | Textures | Audio | Tags |
|---|--:|--:|--:|--:|---|
| `sfx` | 588 Mo | — | — | 210 | `audio` |
| `music` | 404 Mo | — | — | 9 | `audio` |
| 🆕 `Footsteps_Sound_Effects_Pro` | 38 Mo | — | — | 980 | `audio` |
| `Environment_Assets` | 8 Mo | 1 | — | — | `audio` `modulaire` |
| `Niagara_FX` | 868 ko | — | 5 | — | `audio` |

- **Footsteps_Sound_Effects_Pro** — 490 wav de pas — à brancher sur le type de surface renvoyé par le raycast sol

### Bâtiments 🆕 — `batiments/`

Architecture, donjons, villages, kits modulaires

| Pack | Poids | Meshes | Textures | Audio | Tags |
|---|--:|--:|--:|--:|---|
| 🆕 `ModularMedievalVillage` | 3.1 Go | 219 | 185 | 3 | `medieval` `modulaire` `props` |
| 🆕 `RootCellar` | 2.8 Go | 56 | 86 | — | `medieval` `props` |
| 🆕 `MysticDungeonEnvironmen` | 1.6 Go | 54 | 101 | — | `fantasy` `medieval` |
| 🆕 `DwarvenDungeons_ThroneRoom` | 1.5 Go | 102 | 234 | — | `fantasy` `medieval` `modulaire` |
| 🆕 `ModularDungeonKit` | 1.4 Go | 92 | 96 | — | `fantasy` `medieval` `modulaire` |
| 🆕 `StylizedFantasyTown` | 1.2 Go | 170 | 197 | — | `fantasy` `medieval` `modulaire` |
| `Modular Sci-Fi Environment - Unreal Engine` | 75 Mo | — | — | — | `code` `modulaire` `scifi` |

- **RootCellar** — Cave/cellier : intérieur habillé, plus proche d'un bâtiment que d'un décor complet

### Cartes — `Maps/`

Maps de jeu (forge, orbital…) et leurs chunks

| Pack | Poids | Meshes | Textures | Audio | Tags |
|---|--:|--:|--:|--:|---|
| `forge_map` | 20.3 Go | 81 | — | — | `medieval` |
| `Orbital` | 925 Mo | 33 | 247 | — | `scifi` `spatial` |
| `tower_map` | 486 Mo | 9 | 250 | — | — |
| `_orig_chunks` | 344 Mo | 28 | — | — | — |
| `donjon` | 1 Mo | 4 | — | — | — |

### Créatures — `creatures/`

Bestiaire, animaux, montures

| Pack | Poids | Meshes | Textures | Audio | Tags |
|---|--:|--:|--:|--:|---|
| `Animations` | 13.3 Go | 227 | — | — | — |
| `Mesh` | 4.8 Go | 72 | — | — | — |
| `Materials` | 1.4 Go | — | 88 | — | `texture` |
| `Tiger_M` | 857 Mo | 143 | 5 | — | — |
| `Textures` | 174 Mo | — | 13 | — | `texture` |
| `Lion_M` | 161 Mo | 20 | 20 | — | — |
| `Bear` | 113 Mo | 109 | 9 | 16 | — |
| `_Bones` | 109 Mo | — | 6 | — | — |
| `Wolf` | 105 Mo | 98 | 8 | 23 | — |
| `Deer` | 98 Mo | 92 | 8 | 16 | — |
| `Buffalo` | 87 Mo | 96 | 10 | 16 | — |
| `Raccoon` | 68 Mo | 100 | 8 | 16 | — |
| `Rat` | 67 Mo | 97 | 9 | 18 | — |
| `Fox` | 62 Mo | 95 | 8 | 16 | — |
| `Spider` | 54 Mo | 90 | 8 | 6 | — |
| `Characters` | 42 Mo | 2 | — | — | — |
| `Demo` | 13 Mo | 3 | 8 | — | — |
| `Meshes` | 9 Mo | 20 | — | — | — |
| `_Shaders` | 2 Mo | — | 17 | — | — |

### Effets — `vfx/`

VFX, traînées, impacts, particules

| Pack | Poids | Meshes | Textures | Audio | Tags |
|---|--:|--:|--:|--:|---|
| 🆕 `SlashTrail_SoftTofu` | 476 Mo | 88 | 56 | 29 | `audio` |
| `UltraDynamicSky` | 475 Mo | 24 | 148 | 68 | `texture` |
| `NiagaraDeathEffects` | 418 Mo | 48 | 51 | — | — |
| `Chaotic_Skies` | 371 Mo | 1 | 27 | — | `texture` |
| `Shots_VFX` | 320 Mo | 24 | 128 | 23 | — |
| `sky_creator` | 266 Mo | 4 | 50 | 28 | `texture` |
| `Particles_Wind_Control_System` | 55 Mo | 2 | 71 | — | `code` |
| `DynamicVolumetricSky` | 53 Mo | 1 | 14 | — | `texture` |
| 🆕 `CartoonyImpactFX` | 50 Mo | 1 | 9 | — | — |
| `powderflastr` | 15 Mo | 3 | — | — | — |

- **SlashTrail_SoftTofu** — Traînées d'arme + 29 wav d'impact

### Environnements — `environnements/`

Décors complets, scènes, niveaux

| Pack | Poids | Meshes | Textures | Audio | Tags |
|---|--:|--:|--:|--:|---|
| `Sicka_EnvPack2` | 10.7 Go | 215 | 187 | — | `modulaire` |
| `ParkingGarage` | 3.1 Go | 157 | 188 | — | `moderne` |
| `Post_Apocalyptic` | 3.1 Go | 87 | 191 | — | `post_apo` |
| 🆕 `SpaceScenes` | 2.5 Go | 48 | 192 | — | `scifi` `spatial` |
| `High_Tech_Base` | 1.5 Go | 103 | 362 | — | `scifi` |
| 🆕 `TropicalAlienWorld` | 1.4 Go | 43 | 52 | — | `props` `scifi` |
| `SciFi_Space_Station` | 1.1 Go | 80 | 197 | — | `scifi` `spatial` |
| `Space_Template` | 1.0 Go | 11 | 31 | — | `code` `scifi` `spatial` |
| `SciFiWorld` | 1.0 Go | 89 | 182 | 2 | `scifi` |
| `ScifiHallway` | 733 Mo | 50 | 111 | — | `scifi` |

### Familiers — `pet/`

Compagnons

| Pack | Poids | Meshes | Textures | Audio | Tags |
|---|--:|--:|--:|--:|---|
| `lizard` | 10 Mo | 2 | 6 | — | — |
| `mobtribunindin` | 9 Mo | 6 | 11 | — | — |
| `Companion-bot` | 8 Mo | 2 | 1 | — | — |
| `tigre` | 1 Mo | — | 12 | 2 | — |
| `lion` | 313 ko | 1 | — | — | — |

### Interface — `interface/`

UI, HUD, icônes

| Pack | Poids | Meshes | Textures | Audio | Tags |
|---|--:|--:|--:|--:|---|
| `uAim` | 432 Mo | 108 | 61 | 8 | — |
| `flexicam` | 308 Mo | 4 | 29 | — | — |
| `UIWS` | 60 Mo | 14 | 31 | — | — |
| `Textures` | 27 Mo | — | 432 | — | `texture` |
| `fantasy_gui_4` | 12 Mo | — | 524 | 4 | `fantasy` |
| `FireChat` | 4 Mo | 1 | 6 | — | — |

### Launcher — `launcher/`

Écrans d'accueil, intro, sélection

| Pack | Poids | Meshes | Textures | Audio | Tags |
|---|--:|--:|--:|--:|---|
| `ui` | 334 Mo | — | 167 | — | — |
| `resource` | 116 Mo | — | 34 | — | — |
| `item` | 36 Mo | — | 90 | — | — |
| `lumiere` | 109 ko | — | 4 | — | — |
| `poison` | 109 ko | — | 4 | — | — |
| `air` | 108 ko | — | 4 | — | — |
| `elec` | 107 ko | — | 4 | — | — |
| `eau` | 106 ko | — | 4 | — | — |
| `feu` | 105 ko | — | 4 | — | — |
| `neutre` | 104 ko | — | 4 | — | — |
| `terre` | 104 ko | — | 4 | — | — |
| `ombre` | 102 ko | — | 4 | — | — |
| `glace` | 39 ko | — | 4 | — | — |

### Matériaux — `materials/`

Matériaux runtime (auto-material paysage…)

| Pack | Poids | Meshes | Textures | Audio | Tags |
|---|--:|--:|--:|--:|---|
| 🆕 `MWLandscapeAutoMaterial` | 1.7 Go | 19 | 34 | — | `texture` |
| `mwam` | 44 Mo | — | 15 | — | `texture` |

- **MWLandscapeAutoMaterial** — SOURCE de l'auto-material paysage déjà porté dans src/rpg/materials/ — à garder à côté de materials/mwam/

### Objets divers — `divers/`

Props et objets non classés ailleurs

| Pack | Poids | Meshes | Textures | Audio | Tags |
|---|--:|--:|--:|--:|---|
| `UTA` | 5.9 Go | 574 | 8 | — | — |
| `FPSTP_BlackEdition` | 1.7 Go | 104 | 295 | 25 | — |
| `SciFI_Lite_Assets` | 425 Mo | 18 | 32 | — | `modulaire` `scifi` |
| `Planet_Project` | 157 Mo | 3 | 11 | — | `scifi` `spatial` |
| `chest` | 108 Mo | 3 | — | — | — |
| `Textures` | 79 Mo | — | 36 | — | `texture` |
| `GWOPRO` | 62 Mo | 18 | 19 | — | — |
| `donjon2_contruire_sur_blender` | 41 Mo | 378 | 21 | — | — |
| `map_contruction2contruire_sur_blender` | 16 Mo | 16 | 8 | — | — |
| `FBX` | 12 Mo | 74 | — | — | — |
| `map_contruction1contruire_sur_blender` | 9 Mo | 310 | — | — | — |
| `walkie_talkie` | 3 Mo | 1 | — | — | — |
| `keypad_door_lock` | 3 Mo | 1 | — | — | — |
| `smartphone` | 677 ko | 1 | — | — | — |
| `ball` | 477 ko | 6 | — | — | — |

### Personnages — `personnages/`

Avatars jouables, PNJ humanoïdes, skins

| Pack | Poids | Meshes | Textures | Audio | Tags |
|---|--:|--:|--:|--:|---|
| `ZombieSoldierPack_original` | 44.8 Go | 425 | 246 | — | `modulaire` `post_apo` |
| `ParagonSteel` | 32.8 Go | 218 | — | 339 | — |
| `BikerBundle` | 2.4 Go | 106 | 193 | — | `moderne` `modulaire` |
| `GameAnimationSample` | 2.3 Go | 27 | 237 | 279 | — |
| 🆕 `CyberpunkSamurai` | 2.1 Go | 22 | 18 | — | `code` `scifi` |
| `ThirdPerson` | 1.6 Go | 112 | 15 | — | — |
| 🆕 `non_unreal_character` | 1.3 Go | 23 | 110 | — | — |
| `ZombieSoldierPack` | 767 Mo | 425 | 278 | — | `modulaire` `post_apo` |
| `_parts_png` | 741 Mo | 221 | — | — | — |
| `_parts` | 702 Mo | 221 | — | — | — |
| 🆕 `Valkiria` | 176 Mo | 19 | 8 | — | `fantasy` |
| `_body` | 175 Mo | 7 | — | — | — |
| `boris` | 19 Mo | 1 | — | — | — |
| `base` | 1 Mo | 1 | — | — | — |

- **non_unreal_character** — Seul pack avec des .fbx source (13) — conservés pour le retargeting

### Pièces de perso — `assets_character/`

Éléments modulaires : têtes, tenues, accessoires

| Pack | Poids | Meshes | Textures | Audio | Tags |
|---|--:|--:|--:|--:|---|
| `new_character` | 6.7 Go | — | 2 | — | — |
| 🆕 `SciFi_Trooper_Set` | 727 Mo | 170 | 184 | — | `modulaire` `scifi` |
| `wraith` | 166 Mo | 19 | — | — | — |
| `murdock` | 156 Mo | 8 | — | — | — |
| `rampange` | 62 Mo | 4 | — | — | — |

- **SciFi_Trooper_Set** — Set modulaire homme/femme → assets_character, pas personnages : ce sont des PIÈCES (tenues, casques), la brique du créateur de perso

### Plugins C++ 🆕 — `plugins_cpp/`

Sources C++ Unreal à étudier et porter dans NarvosEngine

| Pack | Poids | Meshes | Textures | Audio | Tags |
|---|--:|--:|--:|--:|---|
| 🆕 `AutoTextureMaterialSetup` | 194 Mo | — | 1 | — | `code` `modulaire` `texture` |

- **AutoTextureMaterialSetup** — Détection de rôle de texture par suffixe + channel packing. Le concept est déjà à moitié dans scripts/textures-to-ktx2.mjs — voir docs/PLUGINS_CPP.md

### PNJ — `pnj/`

Personnages non joueurs (marchands, quêtes)

| Pack | Poids | Meshes | Textures | Audio | Tags |
|---|--:|--:|--:|--:|---|
| `RobotGirl` | 259 Mo | 11 | 45 | — | `scifi` |
| `soldat_vert` | 115 Mo | 2 | 2 | — | — |
| `Grunt` | 112 Mo | 2 | 2 | — | — |
| `Tex` | 96 Mo | 3 | 41 | — | — |
| `soldat_mercenaire` | 52 Mo | 2 | 3 | — | — |
| `kgnitig` | 50 Mo | 2 | 3 | — | — |
| `gronomi_ardent` | 47 Mo | 2 | 3 | — | — |
| `grongnoni_majeur` | 45 Mo | 2 | 3 | — | — |
| `soldat_humain` | 44 Mo | 2 | 3 | — | — |
| `gronomi_mineur` | 44 Mo | 2 | 3 | — | — |
| `mercenaire_humain_tank` | 41 Mo | 2 | 3 | — | — |
| `gronomi_infaterie` | 40 Mo | 2 | 3 | — | — |
| `mercenaire_alien` | 37 Mo | 2 | 3 | — | `scifi` |
| `profhete` | 35 Mo | 2 | 3 | — | — |
| `gran_cheff` | 34 Mo | 2 | 3 | — | — |
| `soldat_femme` | 33 Mo | 2 | 3 | — | — |
| `sou_major` | 31 Mo | 2 | 3 | — | — |
| `general` | 27 Mo | 2 | 3 | — | — |
| `general_mission` | 27 Mo | 2 | 3 | — | — |
| `mercenaire_tank` | 26 Mo | 2 | 2 | — | — |
| `venom_stalker` | 24 Mo | 2 | 2 | — | — |
| `profhete_alien` | 21 Mo | 2 | 2 | — | `scifi` |

### PNJ — Monstres — `pnj_monstre/`

PNJ hostiles

| Pack | Poids | Meshes | Textures | Audio | Tags |
|---|--:|--:|--:|--:|---|
| `gatonomi` | 3 Mo | 1 | — | — | — |
| `gralynis_boss` | 2 Mo | 1 | — | — | — |
| `zombi` | 1 Mo | 1 | — | — | — |
| `blackorn` | 886 ko | 1 | — | — | — |
| `bandit` | 869 ko | 1 | — | — | — |
| `canopy_prophet_female` | 538 ko | 1 | — | — | `props` |
| `lizard` | 447 ko | 1 | — | — | — |
| `boss_mob` | 413 ko | 1 | — | — | — |
| `pressure_manipulator_female` | 340 ko | 1 | — | — | — |
| `canopy_prophet_male` | 337 ko | 1 | — | — | `props` |
| `parasite_sower_female` | 336 ko | 1 | — | — | — |
| `mycelium_host_male` | 335 ko | 1 | — | — | — |
| `mycelium_host_female` | 310 ko | 1 | — | — | — |
| `parasite_sower_male` | 306 ko | 1 | — | — | — |
| `aquarys_crab` | 294 ko | 1 | — | — | — |
| `pressure_manipulator_male` | 291 ko | 1 | — | — | — |
| `golem_glace` | 236 ko | 1 | — | — | — |
| `lion` | 137 ko | 1 | — | — | — |
| `dog` | 95 ko | 1 | — | — | — |
| `mob_boss` | 68 ko | 1 | — | — | — |

### Sorts — `spells/`

Effets de sorts

| Pack | Poids | Meshes | Textures | Audio | Tags |
|---|--:|--:|--:|--:|---|
| `Pixel Art VFX - Warlock - FULL Version` | 6 Mo | — | 103 | — | — |
| `Pixel Art VFX - Priest - FULL Version` | 5 Mo | — | 124 | — | — |
| `Pixel Art VFX - Frost Knight - FULL Version` | 5 Mo | — | 104 | — | `medieval` |
| `Pixel Art VFX - Paladin - FULL Version` | 4 Mo | — | 117 | — | — |
| `Pixel Art VFX - Fire Mage - FULL Version` | 4 Mo | — | 103 | — | — |
| `Pixel Art Skill Animations - Frost Mage (2)` | 4 Mo | — | 118 | — | — |
| `Pixel Art Skill Animations - Frost Mage (1)` | 4 Mo | — | 118 | — | — |
| `Pixel Art Skill Animations - Frost Mage` | 4 Mo | — | 118 | — | — |
| `Pixel Art Warrior Animations - Full Version` | 3 Mo | — | 121 | — | — |
| `Necromancer Spell Animations` | 3 Mo | — | 88 | — | — |
| `Starcaller Spell Animations` | 3 Mo | — | 84 | — | `scifi` |
| `Pixel Art VFX - Dark Mage` | 3 Mo | — | 59 | — | — |
| `Pixel Art Skill Animations - Slime` | 2 Mo | — | 54 | — | — |

### Systèmes — `systemes/`

Packs de gameplay UE (combat, IA, RPG) — à porter, pas à charger

| Pack | Poids | Meshes | Textures | Audio | Tags |
|---|--:|--:|--:|--:|---|
| `HugeARPG` | 11.0 Go | 302 | 146 | 146 | `code` `fantasy` |
| `AIBehaviorToolkit` | 4.4 Go | 145 | 42 | 13 | `code` `modulaire` |
| `ShadowsReckoning` | 4.3 Go | 213 | 42 | 23 | `code` |
| 🆕 `ACF_UltimateFullSampleUE57` | 3.5 Go | 132 | 1231 | 485 | `audio` `code` |
| `RPGEngineUltimateMultip` | 2.9 Go | 211 | 1368 | 627 | `code` `fantasy` |
| `FlexibleCombatSystem` | 975 Mo | 115 | 39 | — | `code` |
| `AdvancedTraversalSystem` | 703 Mo | 124 | 190 | 327 | `code` |
| `FastAI` | 687 Mo | 19 | 80 | 36 | `code` |
| `MultiplayerShooterSystem` | 589 Mo | 105 | 108 | 31 | `code` |
| `PhysicalAssemblySystem` | 247 Mo | 29 | 28 | — | `code` |
| 🆕 `Match3RPGTemplate` | 156 Mo | 9 | 72 | — | `code` `fantasy` |
| `NPCEyesSightPRO` | 2 Mo | 2 | — | 1 | `code` |
| `OverCrowd_MassiveCrowdSimulation` | 641 ko | — | 29 | — | `code` |
| `AdvancedGASSystem` | 118 ko | — | 2 | — | `code` |

- **ACF_UltimateFullSampleUE57** — Ascent Combat Framework : 132 GLB + 485 wav noyés dans du Blueprint. Valeur = l'architecture de combat, pas les meshes

### Textures & HDRI 🆕 — `textures/`

Textures autonomes, HDRI, ciels

| Pack | Poids | Meshes | Textures | Audio | Tags |
|---|--:|--:|--:|--:|---|
| 🆕 `HDRI_TropicalBeach_8k` | 237 Mo | — | 13 | — | `texture` |

### Végétation & Nature — `nature/`

Arbres, plantes, roches, terrain

| Pack | Poids | Meshes | Textures | Audio | Tags |
|---|--:|--:|--:|--:|---|
| `forge_outils` | 5.2 Go | 12 | 89 | — | `medieval` |
| `Pack03-LandscapePro` | 2.4 Go | 61 | 142 | — | `modulaire` |
| `Waterline` | 2.0 Go | 273 | 104 | — | — |
| `GV_FreeShrubsPack` | 1.7 Go | 88 | 40 | — | `modulaire` |
| `Realistic_MossyRock` | 673 Mo | — | 12 | — | — |
| 🆕 `StylizedSwampForest` | 494 Mo | 71 | 53 | — | `fantasy` |
| `VOL15_Corn` | 216 Mo | 23 | 12 | — | `modulaire` |
| `Farming Pack` | 151 Mo | 27 | — | — | `modulaire` |
| `24 Free Ores and Minerals KDRN` | 30 Mo | 2 | 230 | — | — |
| `fps_hache_bucheron` | 25 Mo | 3 | 2 | — | — |
| `nature_pack2` | 22 Mo | 80 | 52 | — | `modulaire` |
| `retro_nature_pack` | 9 Mo | 199 | 101 | — | `modulaire` |
| `gems2doGerson` | 2 Mo | — | 7 | — | — |
| `farm` | 386 ko | 4 | — | — | — |

### Véhicules — `vehicules/`

Vaisseaux, engins pilotables

| Pack | Poids | Meshes | Textures | Audio | Tags |
|---|--:|--:|--:|--:|---|
| `Voyager` | 4.6 Go | 583 | 1088 | 329 | `spatial` |
| `trailhunterpro` | 649 Mo | 23 | 136 | — | — |
| `StarSparrow` | 123 Mo | 28 | 15 | — | `scifi` `spatial` |
| `FGear` | 456 ko | 2 | — | — | — |

### Véhicules (runtime) — `vehicule/`

Véhicules câblés au runtime — 29 chemins en dur, NE PAS RENOMMER

| Pack | Poids | Meshes | Textures | Audio | Tags |
|---|--:|--:|--:|--:|---|
| `wraith` | 15 Mo | 4 | 6 | — | — |
| `packship` | 7 Mo | 43 | 1 | — | `modulaire` |
| `Ship` | 524 ko | 2 | 1 | — | — |

## Navigation par tag

### Sci-fi — `scifi` · 19 packs · 14.3 Go

- `/models/environnements/SpaceScenes` — Environnements · 2.5 Go · 48 meshes
- `/models/personnages/CyberpunkSamurai` — Personnages · 2.1 Go · 22 meshes
- `/models/environnements/High_Tech_Base` — Environnements · 1.5 Go · 103 meshes
- `/models/environnements/TropicalAlienWorld` — Environnements · 1.4 Go · 43 meshes
- `/models/environnements/SciFi_Space_Station` — Environnements · 1.1 Go · 80 meshes
- `/models/environnements/Space_Template` — Environnements · 1.0 Go · 11 meshes
- `/models/environnements/SciFiWorld` — Environnements · 1.0 Go · 89 meshes
- `/models/Maps/Orbital` — Cartes · 925 Mo · 33 meshes
- `/models/environnements/ScifiHallway` — Environnements · 733 Mo · 50 meshes
- `/models/assets_character/SciFi_Trooper_Set` — Pièces de perso · 727 Mo · 170 meshes
- `/models/divers/SciFI_Lite_Assets` — Objets divers · 425 Mo · 18 meshes
- `/models/pnj/RobotGirl` — PNJ · 259 Mo · 11 meshes
- `/models/divers/Planet_Project` — Objets divers · 157 Mo · 3 meshes
- `/models/vehicules/StarSparrow` — Véhicules · 123 Mo · 28 meshes
- `/models/armes/Sci_fi` — Armes · 91 Mo · 74 meshes
- `/models/batiments/Modular Sci-Fi Environment - Unreal Engine` — Bâtiments · 75 Mo
- `/models/pnj/mercenaire_alien` — PNJ · 37 Mo · 2 meshes
- `/models/pnj/profhete_alien` — PNJ · 21 Mo · 2 meshes
- `/models/spells/Starcaller Spell Animations` — Sorts · 3 Mo

### Médiéval — `medieval` · 10 packs · 38.1 Go

- `/models/Maps/forge_map` — Cartes · 20.3 Go · 81 meshes
- `/models/nature/forge_outils` — Végétation & Nature · 5.2 Go · 12 meshes
- `/models/batiments/ModularMedievalVillage` — Bâtiments · 3.1 Go · 219 meshes
- `/models/batiments/RootCellar` — Bâtiments · 2.8 Go · 56 meshes
- `/models/batiments/MysticDungeonEnvironmen` — Bâtiments · 1.6 Go · 54 meshes
- `/models/batiments/DwarvenDungeons_ThroneRoom` — Bâtiments · 1.5 Go · 102 meshes
- `/models/batiments/ModularDungeonKit` — Bâtiments · 1.4 Go · 92 meshes
- `/models/batiments/StylizedFantasyTown` — Bâtiments · 1.2 Go · 170 meshes
- `/models/animations/BlacksmithAnimations` — Animations · 1.1 Go · 44 meshes
- `/models/spells/Pixel Art VFX - Frost Knight - FULL Version` — Sorts · 5 Mo

### Fantasy — `fantasy` · 12 packs · 21.2 Go

- `/models/systemes/HugeARPG` — Systèmes · 11.0 Go · 302 meshes
- `/models/systemes/RPGEngineUltimateMultip` — Systèmes · 2.9 Go · 211 meshes
- `/models/batiments/MysticDungeonEnvironmen` — Bâtiments · 1.6 Go · 54 meshes
- `/models/batiments/DwarvenDungeons_ThroneRoom` — Bâtiments · 1.5 Go · 102 meshes
- `/models/batiments/ModularDungeonKit` — Bâtiments · 1.4 Go · 92 meshes
- `/models/batiments/StylizedFantasyTown` — Bâtiments · 1.2 Go · 170 meshes
- `/models/armes/allweaponrpg` — Armes · 811 Mo · 18 meshes
- `/models/nature/StylizedSwampForest` — Végétation & Nature · 494 Mo · 71 meshes
- `/models/personnages/Valkiria` — Personnages · 176 Mo · 19 meshes
- `/models/systemes/Match3RPGTemplate` — Systèmes · 156 Mo · 9 meshes
- `/models/interface/fantasy_gui_4` — Interface · 12 Mo
- `/models/armes/fantasy_weapon` — Armes · 7 Mo · 16 meshes

### Moderne / contemporain — `moderne` · 4 packs · 6.9 Go

- `/models/environnements/ParkingGarage` — Environnements · 3.1 Go · 157 meshes
- `/models/personnages/BikerBundle` — Personnages · 2.4 Go · 106 meshes
- `/models/animations/Tactical_HandSignals` — Animations · 784 Mo · 77 meshes
- `/models/animations/StealthLocomotion` — Animations · 562 Mo · 125 meshes

### Post-apocalyptique — `post_apo` · 3 packs · 48.6 Go

- `/models/personnages/ZombieSoldierPack_original` — Personnages · 44.8 Go · 425 meshes
- `/models/environnements/Post_Apocalyptic` — Environnements · 3.1 Go · 87 meshes
- `/models/personnages/ZombieSoldierPack` — Personnages · 767 Mo · 425 meshes

### Spatial / orbital — `spatial` · 7 packs · 10.4 Go

- `/models/vehicules/Voyager` — Véhicules · 4.6 Go · 583 meshes
- `/models/environnements/SpaceScenes` — Environnements · 2.5 Go · 48 meshes
- `/models/environnements/SciFi_Space_Station` — Environnements · 1.1 Go · 80 meshes
- `/models/environnements/Space_Template` — Environnements · 1.0 Go · 11 meshes
- `/models/Maps/Orbital` — Cartes · 925 Mo · 33 meshes
- `/models/divers/Planet_Project` — Objets divers · 157 Mo · 3 meshes
- `/models/vehicules/StarSparrow` — Véhicules · 123 Mo · 28 meshes

### Props — `props` · 5 packs · 7.3 Go

- `/models/batiments/ModularMedievalVillage` — Bâtiments · 3.1 Go · 219 meshes
- `/models/batiments/RootCellar` — Bâtiments · 2.8 Go · 56 meshes
- `/models/environnements/TropicalAlienWorld` — Environnements · 1.4 Go · 43 meshes
- `/models/pnj_monstre/canopy_prophet_female` — PNJ — Monstres · 538 ko · 1 meshes
- `/models/pnj_monstre/canopy_prophet_male` — PNJ — Monstres · 337 ko · 1 meshes

### Kit modulaire — `modulaire` · 25 packs · 82.3 Go

- `/models/personnages/ZombieSoldierPack_original` — Personnages · 44.8 Go · 425 meshes
- `/models/environnements/Sicka_EnvPack2` — Environnements · 10.7 Go · 215 meshes
- `/models/systemes/AIBehaviorToolkit` — Systèmes · 4.4 Go · 145 meshes
- `/models/batiments/ModularMedievalVillage` — Bâtiments · 3.1 Go · 219 meshes
- `/models/armes/CG_ShotgunPack` — Armes · 3.1 Go · 271 meshes
- `/models/nature/Pack03-LandscapePro` — Végétation & Nature · 2.4 Go · 61 meshes
- `/models/personnages/BikerBundle` — Personnages · 2.4 Go · 106 meshes
- `/models/nature/GV_FreeShrubsPack` — Végétation & Nature · 1.7 Go · 88 meshes
- `/models/batiments/DwarvenDungeons_ThroneRoom` — Bâtiments · 1.5 Go · 102 meshes
- `/models/batiments/ModularDungeonKit` — Bâtiments · 1.4 Go · 92 meshes
- `/models/batiments/StylizedFantasyTown` — Bâtiments · 1.2 Go · 170 meshes
- `/models/animations/WW100IdleAnimPack` — Animations · 1.1 Go · 111 meshes
- `/models/armes/HS_WeaponPack_03` — Armes · 1.1 Go · 30 meshes
- `/models/animations/Loot_Anim_Set` — Animations · 925 Mo · 124 meshes
- `/models/personnages/ZombieSoldierPack` — Personnages · 767 Mo · 425 meshes
- `/models/assets_character/SciFi_Trooper_Set` — Pièces de perso · 727 Mo · 170 meshes
- `/models/divers/SciFI_Lite_Assets` — Objets divers · 425 Mo · 18 meshes
- `/models/nature/VOL15_Corn` — Végétation & Nature · 216 Mo · 23 meshes
- `/models/plugins_cpp/AutoTextureMaterialSetup` — Plugins C++ · 194 Mo
- `/models/nature/Farming Pack` — Végétation & Nature · 151 Mo · 27 meshes
- `/models/batiments/Modular Sci-Fi Environment - Unreal Engine` — Bâtiments · 75 Mo
- `/models/nature/nature_pack2` — Végétation & Nature · 22 Mo · 80 meshes
- `/models/nature/retro_nature_pack` — Végétation & Nature · 9 Mo · 199 meshes
- `/models/audio/Environment_Assets` — Audio · 8 Mo · 1 meshes
- `/models/vehicule/packship` — Véhicules (runtime) · 7 Mo · 43 meshes

### Code / système (pas de mesh exploitable) — `code` · 24 packs · 35.8 Go

- `/models/systemes/HugeARPG` — Systèmes · 11.0 Go · 302 meshes
- `/models/systemes/AIBehaviorToolkit` — Systèmes · 4.4 Go · 145 meshes
- `/models/systemes/ShadowsReckoning` — Systèmes · 4.3 Go · 213 meshes
- `/models/systemes/ACF_UltimateFullSampleUE57` — Systèmes · 3.5 Go · 132 meshes
- `/models/systemes/RPGEngineUltimateMultip` — Systèmes · 2.9 Go · 211 meshes
- `/models/personnages/CyberpunkSamurai` — Personnages · 2.1 Go · 22 meshes
- `/models/animations/MoCapCombatAnimations_DualCharacter` — Animations · 1.8 Go · 72 meshes
- `/models/environnements/Space_Template` — Environnements · 1.0 Go · 11 meshes
- `/models/systemes/FlexibleCombatSystem` — Systèmes · 975 Mo · 115 meshes
- `/models/systemes/AdvancedTraversalSystem` — Systèmes · 703 Mo · 124 meshes
- `/models/systemes/FastAI` — Systèmes · 687 Mo · 19 meshes
- `/models/animations/FPP_combat_fists` — Animations · 613 Mo · 111 meshes
- `/models/systemes/MultiplayerShooterSystem` — Systèmes · 589 Mo · 105 meshes
- `/models/animations/BaconCombatGraphU` — Animations · 318 Mo · 10 meshes
- `/models/systemes/PhysicalAssemblySystem` — Systèmes · 247 Mo · 29 meshes
- `/models/plugins_cpp/AutoTextureMaterialSetup` — Plugins C++ · 194 Mo
- `/models/animations/ProceduralWeaponAnimationSystem` — Animations · 164 Mo · 14 meshes
- `/models/systemes/Match3RPGTemplate` — Systèmes · 156 Mo · 9 meshes
- `/models/batiments/Modular Sci-Fi Environment - Unreal Engine` — Bâtiments · 75 Mo
- `/models/vfx/VFX/Particles_Wind_Control_System` — Effets · 55 Mo · 2 meshes
- `/models/systemes/NPCEyesSightPRO` — Systèmes · 2 Mo · 2 meshes
- `/models/systemes/OverCrowd_MassiveCrowdSimulation` — Systèmes · 641 ko
- `/models/systemes/AdvancedGASSystem` — Systèmes · 118 ko
- `/models/animations/Variant_Combat` — Animations · 5 ko

### Audio — `audio` · 7 packs · 5.0 Go

- `/models/systemes/ACF_UltimateFullSampleUE57` — Systèmes · 3.5 Go · 132 meshes
- `/models/audio/sfx` — Audio · 588 Mo
- `/models/vfx/VFX/SlashTrail_SoftTofu` — Effets · 476 Mo · 88 meshes
- `/models/audio/music` — Audio · 404 Mo
- `/models/audio/Footsteps_Sound_Effects_Pro` — Audio · 38 Mo
- `/models/audio/Environment_Assets` — Audio · 8 Mo · 1 meshes
- `/models/audio/Niagara_FX` — Audio · 868 ko

### Texture / HDRI — `texture` · 14 packs · 5.8 Go

- `/models/materials/MWLandscapeAutoMaterial` — Matériaux · 1.7 Go · 19 meshes
- `/models/creatures/Materials` — Créatures · 1.4 Go
- `/models/armes/Materials` — Armes · 714 Mo
- `/models/vfx/VFX/UltraDynamicSky` — Effets · 475 Mo · 24 meshes
- `/models/vfx/VFX/Chaotic_Skies` — Effets · 371 Mo · 1 meshes
- `/models/vfx/VFX/sky_creator` — Effets · 266 Mo · 4 meshes
- `/models/textures/HDRI_TropicalBeach_8k` — Textures & HDRI · 237 Mo
- `/models/plugins_cpp/AutoTextureMaterialSetup` — Plugins C++ · 194 Mo
- `/models/creatures/Textures` — Créatures · 174 Mo
- `/models/armes/Textures` — Armes · 121 Mo
- `/models/divers/Textures` — Objets divers · 79 Mo
- `/models/vfx/VFX/DynamicVolumetricSky` — Effets · 53 Mo · 1 meshes
- `/models/materials/mwam` — Matériaux · 44 Mo
- `/models/interface/Textures` — Interface · 27 Mo