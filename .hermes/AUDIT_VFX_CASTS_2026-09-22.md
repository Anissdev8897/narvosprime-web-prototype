# AUDIT VFX / CASTS — NARVOS PRIME — 2026-09-22

**Mode** : audit fichiers uniquement (Unreal ne tourne pas). Les `.uasset` sont binaires :
noms de fichiers + `grep -a` sur les chaînes internes + manifeste `Assets.toml`.
Aucune écriture dans les `.uasset`.

**Arborescences auditées**
- Pack source : `E:/narvosprime-web-prototype/WebPortal/Server/Assets/narvos/` (manifeste `Assets.toml`, racine Unreal montée : `Narvos/`, UE 5.7.4)
- Projet Unreal playtest : `D:/steam/steamapps/common/nanos-world-playtest/NanosWorld/Content/`
- Cache runtime client : `C:\Users\aniss\AppData\Local\NanosWorld\Saved\Packages\` (que du Lua, pas d'assets)

**Convention de comptage** : « effet » = `.uasset` dont le nom commence par `NS_`, `FXS_` ou `P_`
(préfixes de la mission). Les systèmes Niagara à préfixe `N*` de M5VFXVOL2 sont comptés à part.

---

## 1. Inventaire Niagara — projet Unreal playtest (`Content/`)

### NS_ : 40 fichiers (0 en rapport avec les sorts)
- `NanosWorld/Effects/GrenadePack/Niagara/` — 22 : `NS_GrenadeEXP_{Air,Concrete,Default,Dirt,Grass,Ice,Metal,Sand,Snow,Water,Wood}` et `NS_LTGrenadeEXP_{...}` (mêmes 11) — grenades du jeu de base.
- `NanosWorldAssets/Particles/RocketThrusterExhaustFX/FX/` — 18 : `NS_RocketExhaust_{Afterburn,Afterburn_Jet,Blue,BlueRed,Crackling,Energy,Green,Maniac,Pixie,Plume_1,Plume_2,Plume_3,Realistic,Red,SciFi,Violet,White,Yellow}` — réacteurs.

### FXS_ : 0 fichier dans tout le Content
Preuve : `find Content -iname "FXS_*.uasset" | wc -l` → `0`.
Les FXS_ (Strike, Counter, Ground_Impact…) **ne sont pas dans le projet Unreal**, ils sont dans le pack narvos (section 2).

### P_ : 122 fichiers
| Dossier | Nb |
|---|---|
| `NanosWorldAssets/Particles/Explosions/Particles/` | 67 (P_Burst_*, P_Explosion_Fire_*, P_Explosive_*, P_ShockWave_*, P_Smoke_*, P_ImpactExplosion_*…) |
| `NanosWorldAssets/Particles/FXVarietyPack/Particles/` | 21 (P_ky_* : fireBall, fireStorm, lightning1-3, waterBall, healAura…) |
| `NanosWorld/Effects/Particles/` | 16 |
| `NanosWorld/Weapons/Common/` | 12 |
| `NanosWorld/Vehicles/Common/` | 3 |
| `NanosWorld/Effects/GrenadePack/` | 1 |
| `NanosWorld/UI/SettingsMenu/` | 1 |
| `NanosWorldMaps/Effects/Particles/` | 1 |

### M5VFXVOL2/Niagara : 70 systèmes Niagara supplémentaires (préfixe N*, hors convention)
- `Explosion/` 3 (`NFire_Exp_00/01/03`) · `Fire/` 19 (`NFire_00`→`NFire_15`, `NFire_Grd_00-02`) · `Reference/` 48 (Candlefire, distortion, Fire, etc.)
- `M5VFXVOL2/Particles/` : dossiers Explosion, Fire, Fire_for_BP, Fire_for_Dir, Reference.

**Total convention (NS_+FXS_+P_) : 162 — dont 0 utilisé par les 12 sorts.**
**Rien dans le Content Unreal ne correspond aux effets de sorts NARVOS (aucun NS_FlameThrower, aucun FXS_*, aucun P_PP, etc.).**

---

## 2. Inventaire du pack source narvos (`WebPortal/Server/Assets/narvos/`)

`Assets.toml` = 10,7 Mo, 87 197 `.uasset` dans `Narvos/`. Clés = noms d'assets, valeurs = chemins
(ex. ligne 51804 : `FXS_Strike = "Narvos/FreeflowCombatSystem/FX/FXS_Strike"`).

### NS_ : 4
- `Narvos/Defender/Demo/Particles/Niagara/NS_CharBurn.uasset`
- `Narvos/Defender/Demo/Particles/Niagara/NS_FlameThrower.uasset` ← utilisé par dps_plasma_barrage
- `Narvos/Defender/Demo/Particles/Niagara/NS_FlameThrower2.uasset`
- `Narvos/City_Traffic_Pro/Cars/Particles/NS_CrashDebris.uasset`

### FXS_ : 8
- `Narvos/FreeflowCombatSystem/FX/` : `FXS_Animtrails`, `FXS_BulletTracer`, **`FXS_Counter`**, **`FXS_Ground_Impact`**, **`FXS_Strike`**
- `Narvos/Mars_Sanctuary/Particles/` : `FXS_Dust_N`, `FXS_Sparks`, `FXS_Steam_N`

### P_ : 62
Essentiellement `Narvos/Defender/Demo/Particles/` (dont Effects/FX_Particle, FX_Skill_Leap, FX_Skill_RockBurst, FX_Potions, FX_Ability), `Narvos/SpaceScenes/Effects/ParticleSystems/`, plus divers.
Les 16 utilisés par les sorts sont listés dans le tableau de croisement (section 3).

**Total convention (NS_+FXS_+P_) : 74.**

---

## 3. Croisement — les 12 sorts

Règle de statut : effet présent si (a) fichier `.uasset` dans le pack **et** clé exacte dans `Assets.toml`, ou (b) fourni par le jeu de base via le namespace `nanos-world::`.

| Sort | Effets | Statut |
|---|---|---|
| bruiser_slam | FXS_Strike, P_Sparks | **OK** |
| bruiser_shockwave | P_Sparks, P_Attack_ComboFX, P_Skill_Leap_Base_Velocity_Impact | **OK** |
| bruiser_rage | P_RBurst_Lightning_Pull_01, P_electricity_arc | **OK** |
| dps_fire_shot | P_PP, nanos-world::P_FXVariety_FireBall, P_Embers, P_Explosion | **OK** |
| dps_plasma_barrage | NS_FlameThrower, P_Env_Fire_PP_01, P_Fire_TrapBossEnd_mobile | **OK** |
| dps_evasion | FXS_Counter, P_Embers | **OK** |
| tank_bash | FXS_Ground_Impact, P_Impact01 | **OK** |
| tank_fortress | P_RBurst_Lightning_Pull_01, P_Skill_Leap_Base_Velocity_Impact, FXS_Ground_Impact | **OK** |
| tank_iron_wall | P_Skill_001, P_powershield_constant | **OK** |
| heal_nano | P_HealingProbe, P_Health_Potion | **OK** |
| heal_drone | P_HealingProbe, P_Summon_Parent_Startup, P_Dissolve | **OK** |
| heal_barrier | P_Dissolve, P_powershield_constant_02 | **OK** |

**12/12 sorts : tous les effets présents. 0 effet manquant.**

### Détail des 23 effets distincts (23 = 22 pack + 1 nanos-world::)

Vérification double : clé exacte `^\s+NAME =` présente une et une seule fois dans `Assets.toml` ET `.uasset` trouvé sur disque.

| Effet | Fichier dans le pack | TOML |
|---|---|---|
| FXS_Strike | Narvos/FreeflowCombatSystem/FX/FXS_Strike.uasset | ✓ l.51804 |
| P_Sparks | Narvos/Defender/Demo/Particles/P_Sparks.uasset | ✓ |
| P_Attack_ComboFX | Narvos/Defender/Demo/Particles/Effects/FX_Skill_Leap/P_Attack_ComboFX.uasset | ✓ |
| P_Skill_Leap_Base_Velocity_Impact | Narvos/Defender/Demo/Particles/Effects/FX_Skill_Leap/P_Skill_Leap_Base_Velocity_Impact.uasset | ✓ |
| P_RBurst_Lightning_Pull_01 | Narvos/Defender/Demo/Particles/Effects/FX_Skill_RockBurst/P_RBurst_Lightning_Pull_01.uasset | ✓ |
| P_electricity_arc | Narvos/Defender/Demo/Particles/P_electricity_arc.uasset | ✓ (2 occurrences : clé + possible dépendance) |
| P_PP | Narvos/Defender/Demo/Particles/Effects/FX_Particle/P_PP.uasset | ✓ |
| P_Embers | Narvos/Defender/Demo/Particles/Effects/FX_Particle/P_Embers.uasset | ✓ |
| P_Explosion | Narvos/Defender/Demo/Particles/P_Explosion.uasset | ✓ |
| NS_FlameThrower | Narvos/Defender/Demo/Particles/Niagara/NS_FlameThrower.uasset | ✓ l.51807 |
| P_Env_Fire_PP_01 | Narvos/Defender/Demo/Particles/Effects/FX_Particle/P_Env_Fire_PP_01.uasset | ✓ |
| P_Fire_TrapBossEnd_mobile | Narvos/Defender/Demo/Particles/Effects/FX_Ambient/Fire/P_Fire_TrapBossEnd_mobile.uasset | ✓ |
| FXS_Counter | Narvos/FreeflowCombatSystem/FX/FXS_Counter.uasset | ✓ |
| FXS_Ground_Impact | Narvos/FreeflowCombatSystem/FX/FXS_Ground_Impact.uasset | ✓ |
| P_Impact01 | Narvos/Defender/Demo/Particles/Effects/FX_Particle/P_Impact01.uasset | ✓ |
| P_Skill_001 | Narvos/Defender/Demo/Particles/Effects/FX_Particle/P_Skill_001.uasset | ✓ |
| P_powershield_constant | Narvos/SpaceScenes/Effects/ParticleSystems/P_powershield_constant.uasset | ✓ (2 occurrences) |
| P_HealingProbe | Narvos/Defender/Demo/Particles/Effects/FX_Skill_Leap/P_HealingProbe.uasset | ✓ |
| P_Health_Potion | Narvos/Defender/Demo/Particles/Effects/FX_Potions/Heal/P_Health_Potion.uasset | ✓ |
| P_Summon_Parent_Startup | Narvos/Defender/Demo/Particles/Effects/FX_Ability/Summon/P_Summon_Parent_Startup.uasset | ✓ |
| P_Dissolve | Narvos/Defender/Demo/Particles/Effects/FX_Potions/Heal/P_Dissolve.uasset | ✓ |
| P_powershield_constant_02 | Narvos/SpaceScenes/Effects/ParticleSystems/P_powershield_constant_02.uasset | ✓ (2 occurrences) |
| **P_FXVariety_FireBall** | **hors pack → jeu de base `nanos-world::`** | absent du TOML (normal) |

### Preuve de résolution de `nanos-world::P_FXVariety_FireBall`
- Nom présent **en toutes lettres dans le binaire serveur** : `NanosWorldServer.exe` contient les 21 chaînes `P_FXVariety_*` (FireBall, FireStorm, Lightning_01…03, WaterBall, HealAura…).
- Chemin cuit correspondant présent dans le même binaire : `FXVarietyPack/Particles/P_ky_fireBall`.
- Asset cuit **présent dans le Content client** : `Content/NanosWorldAssets/Particles/FXVarietyPack/Particles/P_ky_fireBall.uasset` (+ `.uexp`), dont l'interne référence `FXVarietyPack/Materials/MI_ky_flare_flash_trs`, `M_ky_smoke01`… → c'est bien l'asset du pack FXVariety.
- Correspondance 21 ↔ 21 entre les noms `P_FXVariety_*` (exe) et les 21 fichiers `P_ky_*` (Content) : AquaStorm↔aquaStorm, FireBall↔fireBall, …, WaterBallHit↔waterBallHit.
- **Conclusion : l'effet résout via le jeu de base. Rien à recréer.**

---

## 4. VFX « FlameExplosion » — ABSENT PARTOUT

Le VFX Blender « FlameExplosion » annoncé importé sous `/Game/NARVOS/VFX/FlameExplosion/` **n'existe nulle part sur disque** :

- `find Content -iname "*FlameExplosion*"` → **RIEN** ; `find Content -ipath "*NARVOS*"` → **RIEN** (aucun dossier `/Game/NARVOS` dans le projet Unreal playtest).
- `find narvos/ -iname "*FlameExplosion*"` → **RIEN** ; `find narvos/ -iname "*Flame*"` → uniquement `T_FLAME` (texture minimap Ako) et `A_Flame` (sons forge) — sans rapport.
- `grep "Flame" Assets.toml` → 8 lignes : `SK_GrimFlameThrower`, `A_Flame`, `A_Flame_2`, `NS_FlameThrower`, `NS_FlameThrower2`, matériaux Niagara — **aucune clé FlameExplosion**.
- `find D:/steam/.../nanos-world-playtest -iname "*FlameExplosion*"` → **RIEN** ; grep dans `.hermes/` → **RIEN**.
- `Assets.toml` → `unreal_folders = ["Narvos"]` uniquement : pas de racine NARVOS/VFX montée.

→ **Le VFX FlameExplosion n'est ni dans le pack source, ni dans le projet playtest.** S'il doit servir à un sort, il faut retrouver le fichier Blender source et le réimporter, ou considérer qu'il a été abandonné (aucun des 12 sorts n'y fait référence dans la liste auditéée).

---

## 5. Montages liés aux sorts

**Projet Unreal (Content)** :
- `find Content -iname "*Montage*.uasset"` → uniquement des montages de locomotion du jeu de base : `NanosWorld/Characters/Common/Animations/TEMP/VaultClimbing/ALS_CLF_*` et `ALS_N_LandRoll_*` (TEMP). **Aucun montage de sort.**
- `find Content -iname "*RMB_Cast*" -o -iname "*FireMagicProjectile*"` → **RIEN**.

**Pack narvos** :
- 7 montages seulement, aucun de sort : `Farming_And_Mining/Animations/{Hoeing, Hoeing_Stepback, Pick, Shovel, Shovel_Alternate}Montage` + 2 Blueprints (`BP_NotifyState_MontageBlendOut`, `STT_PlayAnimMontage`).
- `grep Assets.toml` : `RMB_Cast` → 0, `FireMagicProjectile` → 0, `Montage` → 9 (handcuffs, farming, notify BP).
- `find narvos -iname "*cast*"` (hors chunks de map) → RIEN.

→ **Aucun montage d'incantation (RMB_Cast, FireMagicProjectile…) n'existe dans les deux arborescences.** Les animations de sort servies en jeu viennent donc soit d'animations non nommées « montage », soit du jeu de base (`nanos-world::`), soit restent à créer — point à confirmer côté Lua (hors périmètre de cet audit fichiers).

---

## 6. Synthèse

- **162** effets (NS_/FXS_/P_) dans le Content Unreal playtest + 70 systèmes Niagara `N*` (M5VFXVOL2) : tous issus du jeu de base, **aucun effet de sort NARVOS**.
- **74** effets (NS_/FXS_/P_) dans le pack narvos, dont **22 des 23 effets de sorts** (clé exacte dans `Assets.toml` + `.uasset` sur disque).
- **12/12 sorts complets** : le 23ᵉ effet (`P_FXVariety_FireBall`) est résolu par `nanos-world::` (binaire serveur + asset cuit `P_ky_fireBall` dans le Content).
- **FlameExplosion : introuvable** (pack, projet Unreal, binaires, `.hermes`).
- **Aucun montage de sort** (RMB_Cast / FireMagicProjectile / *Montage* de cast) dans le Content Unreal ni dans le pack.