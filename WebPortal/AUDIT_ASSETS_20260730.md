# AUDIT ASSETS NARVOS PRIME — 2026-07-30

> Audit complet : imports GLB/KTX2, manifest d'assets, animations, textures.
> Projet : `E:\narvosprime-web-prototype\WebPortal`

---

## 🔴 CRITIQUE — 7 animations GLB absentes (404 HTML)

Les 7 fichiers ci-dessous sont référencés dans `src/rpg/characters/avatarAssets.ts:145-153` (tableau `P2_TRAVERSAL`) mais **n'existent PAS** dans `public/models/animations/uta_locomotion/` :

| # | Fichier référencé | Action | Statut |
|---|---|---|---|
| 1 | `AnimSeq_Traversal_Movement_Slide.glb` | `slide` | ❌ ABSENT |
| 2 | `AnimSeq_Traversal_Movement_Dash.glb` | `dash_anim` | ❌ ABSENT |
| 3 | `Anim_WallRun_Left.glb` | `wallrun` | ❌ ABSENT |
| 4 | `Anim_WallRun_Right.glb` | `wallrun_alt` | ❌ ABSENT |
| 5 | `Anim_LedgeGrab_Hang_Idle.glb` | `ledgegrab` | ❌ ABSENT |
| 6 | `Anim_LedgeGrab_ClimbUp.glb` | `ledgegrab_up` | ❌ ABSENT |
| 7 | `Anim_StepUp_Medium.glb` | `step_up` | ❌ ABSENT |

**Tous dans** : `UTA = "/models/animations/uta_locomotion"` — dossier qui contient 41 fichiers mais **aucun de ces 7**.

**Conséquence** : le serveur renvoie du HTML (404) → `useGLTF` crash avec `"Unexpected token '<'"`.

### 🔧 Substituts possibles (existants sur disque)

| Fichier manquant | Substitut le plus proche | Chemin |
|---|---|---|
| `Slide` | Wall slide / Knee slide | `divers/UTA/AnimSeq/Traversal_Movement/AnimSeq_Traversal_Movement_Run_n_Slide_Loop.glb` |
| `Dash` | (aucun équivalent UTA) | `armes/Action_Crossbow/Animations/Movement/RM/ACB_Dash_Forward_RM.glb` (rig différent) |
| `WallRun_Left` | WallRun Left Loop | `divers/UTA/AnimSeq/Traversal_Movement/AnimSeq_Traversal_Movement_WallRun_Left_Loop.glb` |
| `WallRun_Right` | WallRun Right Loop | `divers/UTA/AnimSeq/Traversal_Movement/AnimSeq_Traversal_Movement_WallRun_Right_Loop.glb` |
| `LedgeGrab_Hang_Idle` | Climb squat idle | `uta_locomotion/AnimSeq_Traversal_Climb_Squat_Idle.glb` |
| `LedgeGrab_ClimbUp` | Wall Climb Up | `uta_locomotion/AnimSeq_Traversal_Wall_Climb_Up_LeftHand.glb` |
| `StepUp_Medium` | Platform StepAcross | `divers/UTA/AnimSeq/Traversal_Platform/AnimSeq_Traversal_Platform_StepAcross.glb` |

**Note** : ces substituts sont dans des dossiers différents et n'ont pas été vérifiés pour la compatibilité de rig (il faut lancer `node scripts/check-clip-rig.mjs <rig> <clip>` pour chaque).

---

## 🟠 MAJEUR — Textures : 0% KTX2 (13 514 PNG, 0 KTX2)

### Constat
- **textures_index.json** : 13 709 entrées → **0 KTX2**, 13 514 PNG, 191 JPG, 4 JPEG
- **Sur disque** : seulement **15 fichiers `.ktx2`** trouvés dans tout le projet, tous dans `public/models/materials/mwam/`
- **Dossier `public/textures/`** : COMPLÈTEMENT VIDE (0 fichiers)

### Impact
- Les textures PNG/JPG occupent 4-8× plus de VRAM que leurs équivalents KTX2/Basis
- Risque de **context loss WebGL** sur les maps lourdes (Forge 112 Mo, Orbital 163 Mo)
- Le code de transcodage KTX2 est bien en place (`installKtx2Everywhere.ts`, `ktx2.ts`) mais inutilisé

### Recommandation
Exécuter `scripts/lib/ktx2-encode.mjs` sur l'ensemble du parc de textures, en commençant par les maps.

---

## 🟡 MODÉRÉ — 36 fichiers GLB référencés dans le code mais absents du disque

Total : 219 références GLB/glTF uniques dans `src/`, 183 trouvées, **36 absentes** (dont ~6 dummy/test).

### Armes (10 absents)
```
❌ allweaponrpg/uploads_files_5605095_battle_axe.glb
❌ allweaponrpg/uploads_files_5605095_claymore.glb
❌ allweaponrpg/uploads_files_5605095_crudgel.glb
❌ allweaponrpg/uploads_files_5605095_giant_mace.glb
❌ allweaponrpg/uploads_files_5605095_keen_axe.glb
❌ allweaponrpg/uploads_files_5605095_mining_axe.glb
❌ allweaponrpg/uploads_files_5605095_recurve_bow.glb
❌ allweaponrpg/uploads_files_5605095_short_sword.glb
❌ allweaponrpg/uploads_files_5605095_spear.glb
❌ baton_magique/uploads_files_2214281_Magic+wand.glb
❌ fantasy_weapon/Meshes/Knife00_mesh.glb
❌ fantasy_weapon/Meshes/Shield00_mesh.glb
❌ fantasy_weapon/Meshes/Axe00_mesh.glb
❌ fantasy_weapon/Meshes/Bow00_mesh.glb
```
**Source** : `weaponCatalog.ts:18-41`

### Maps et chunks
```
❌ /models/Maps/donjon_furiste_v2.glb          → le fichier n'existe pas
❌ /models/Maps/forge_map/chunk_01.glb          → chemin obsolète (v3 dans chunks_v3/)
❌ /models/Maps/forge_map/forge_map.glb         → n'existe pas à la racine
❌ /models/Maps/medieval_castle/chunk_01.glb    → dossier medieval_castle VIDE
❌ /models/Maps/medieval_castle/chunk_01.med.glb
```

### Animations pack
```
❌ /models/animations/archer_pack.glb
❌ /models/animations/magic_pack.glb
❌ /models/animations/melee_pack.glb
```

### Autres assets manquants
```
❌ /models/npc/creature_mécanique.glb
❌ /models/npc/marchand.glb
❌ /models/npc/mercenaire.glb
❌ /models/npc/soldat_humain.glb
❌ /models/ships/ship_forge.glb
❌ /models/ships/ship_tower.glb
❌ /models/background/debris_field.glb
❌ /models/background/nebula.glb
❌ /models/Characters/anims_soldier.glb
❌ /models/Characters/spartan.glb
❌ /models/weapons/arch_bow.glb
❌ /models/weapons/arch_staff.glb
❌ /models/weapons/arch_sword.glb
```

### Dummy/test (intentionnellement absents, à nettoyer du code)
```
❌ /models/x.glb
❌ /models/wave.glb
❌ /models/sit.glb
❌ /models/dance.glb
❌ /models/armes/nexiste_pas.glb
❌ /models/armes/inexistant.glb
```

---

## 🟠 MAJEUR — 1 GLB corrompu

| Fichier | Taille | Attendu | Statut |
|---|---|---|---|
| `nature/retro_nature_pack/models/glTF/trees/tree02_winter.glb` | **132 octets** | ~36 Ko (cf tree02.glb) | 🔴 CORROMPU |

Le fichier contient uniquement l'en-tête glTF binaire + un chunk JSON vide (pas de mesh). Toute tentative de chargement échouera.

---

## 🟢 OK — Animations vérifiées

| Pack | Fichiers | Statut |
|---|---|---|
| `BULLET_LOCOMOTION` (Jog_Fwd, MM_*) | 6/6 | ✅ Tous présents |
| `UTA_LOCOMOTION` (walk/run 16 directions + sprint + idle) | 18/18 | ✅ Tous présents |
| `CROUCH_LOCOMOTION` (7 fichiers) | 7/7 | ✅ Tous présents |
| `UTA_TRAVERSAL` (jump/climb) | 10/10 | ✅ Tous présents |
| `FPP_combat_fists` (unarmed) | 55/55 | ✅ Tous présents |
| `WRAITH_ANIMS` (5 clips) | 5/5 | ✅ Tous présents |
| **`P2_TRAVERSAL`** (slide/dash/wallrun/ledge/stepup) | **0/7** | 🔴 **TOUS ABSENTS** |
| `MELEE/SWORD/ARCHER/MAGIE/CREATURE/SHOOTER` packs | — | 🟡 Commentés/vides (intentionnel) |

---

## 🟢 OK — Infrastructure KTX2

- `installKtx2Everywhere.ts` : Patch global de prototype GLTFLoader ✅
- `ktx2.ts` : KTX2Loader singleton + `detectSupport` paresseux ✅
- `scripts/lib/ktx2-encode.mjs` : Script de conversion présent ✅
- `public/basis/` : Transcodeur Basis livré localement ✅
- `tools/KTX-Software-main/` : Outils KTX présents ✅

---

## 📊 Statistiques globales

| Métrique | Valeur |
|---|---|
| **models_index.json** | 9 067 modèles indexés |
| **textures_index.json** | 13 709 textures indexées |
| **manifest.json** (Unreal) | 9 337 assets |
| **Fichiers GLB sur disque** | ~9 000+ |
| **Fichiers KTX2 sur disque** | **15** (0,1%) |
| **Fichiers PNG sur disque** | **13 334** (99,8%) |
| **GLB < 200 octets (corrompus)** | 1 |
| **Réfs GLB dans src/ (string literals)** | 219 uniques |
| **Réfs GLB absentes du disque** | 36 (dont ~6 dummy) |

---

## 🔢 Priorités d'action

1. **🔴 CRITIQUE** : Ajouter les 7 fichiers GLB manquants dans `uta_locomotion/` — ou rediriger `P2_TRAVERSAL` vers les substituts UTA existants
2. **🔴 CRITIQUE** : Réparer ou supprimer `tree02_winter.glb` (132 octets)
3. **🟠 MAJEUR** : Lancer la conversion KTX2 sur les textures (13 514 PNG → 0 KTX2)
4. **🟡 MODÉRÉ** : Ajouter les assets manquants (armes, NPCs, maps) ou nettoyer les références
5. **🟡 FAIBLE** : Nettoyer les 6 références dummy du code (`x.glb`, `inexistant.glb`, etc.)