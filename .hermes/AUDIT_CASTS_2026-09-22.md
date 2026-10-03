# AUDIT CASTS & MONTAGES — NARVOS PRIME — 2026-09-22

**Objet** : inventaire disque des animations de lancement de sort (cast) et des montages, côté pack source et côté Unreal (playtest), en vue des tâches `anim-cast-montages` et `retarget-cast`.
**Méthode** : `find`/`ls` + `grep -a` sur les .uasset binaires (noms de fichiers, manifeste `Assets.toml` exhaustif, chaînes `SKEL_*`, `AnimMontage`, `DefaultSlot`, imports `/Game/...`). Pas d'éditeur Unreal (ne tourne pas).

---

## 1. Résumé chiffré

| Métrique | Valeur | Preuve |
|---|---|---|
| .uasset dans le pack source | 87 197 | `find Narvos -name "*.uasset" \| wc -l` |
| .uasset dans le Content Unreal (playtest) | 10 811 | `find Content -name "*.uasset" \| wc -l` |
| Anims cast dédiées (RMB_Cast / FireMagicProjectile / *Cast* / *Spell* / *Magic*) | **0** (pack) — **0** (Content) | find -iname + grep Assets.toml : 0 occurrence |
| Anims utilisées comme gestes de sort (GESTES + GESTES_ARME) | **74** (4 sans arme + 70 HandSignal) | Sorts.lua:244-278 |
| … dont squelette **SKEL_Mannequin** | **74 / 74** | grep -a `SKEL_Mannequin` dans chaque .uasset |
| … dont squelette **SK_CombatMannequin** | **0** | absent des noms de fichiers ET d'Assets.toml |
| Pack « MagicCombatSystem » | **ABSENT** (0 dossier, 0 fichier, 0 référence) | find -iname "*magic*" / "*combatmannequin*" : vide |
| Montages de cast (RMB_Cast, dossier Montages de sorts) | **0** (pack) — **0** (Content) | find -iname "*montage*" |
| Montages existants (non cast) | pack : 53 `AM_*` FreeflowCombatSystem + 5 Farming_And_Mining ; Content : 18 ALS | listes ci-dessous |
| Champ anim/montage dans `spells_unreal.json` (12 sorts) | **aucun** | grep -i anim\|montage\|cast : vide |

---

## 2. Inventaire des anims de gestes de sort (déjà cuites, vérifiées sur disque)

Source de vérité Lua : `Server/nanos_world/packages/narvos/Shared/Logic/Sorts.lua:244-278`.

### 2.1 Sans arme — `Sorts.GESTES` (4 anims, toutes AnimSequence sur SKEL_Mannequin)

| Archétype | Asset `narvos::` | Chemin dans le pack | Type | Squelette (grep -a) |
|---|---|---|---|---|
| projectile | AS_HeavyObjectThrow | `Narvos/FreeflowCombatSystem/Animations/Anims/WeaponPickup/AS_HeavyObjectThrow.uasset` | AnimSequence | `SKEL_Mannequin` |
| aoe | AS_GroundTakedownPunch | `Narvos/FreeflowCombatSystem/Animations/Anims/GroundTakedown/AS_GroundTakedownPunch.uasset` | AnimSequence | `SKEL_Mannequin` |
| buff / shield | ACB_Taunt_01_IP_Anim | `Narvos/Animations/Other_Misc/Taunts/ACB_Taunt_01_IP_Anim.uasset` (+ doublon `Narvos/Action_Crossbow/Animations/Other_Misc/Taunts/`) | AnimSequence | `SKEL_Mannequin` |
| basic | MM_ChargedAttack_Anim | `Narvos/ThirdPerson/Characters/Mannequins/Anims/Unarmed/Attack/MM_ChargedAttack_Anim.uasset` | AnimSequence | `SKEL_Mannequin` |

Sortie brute (grep -a, 1 ligne par fichier) :
```
AS_HeavyObjectThrow.uasset       -> SKEL_Mannequin
AS_GroundTakedownPunch.uasset    -> SKEL_Mannequin
ACB_Taunt_01_IP_Anim.uasset      -> SKEL_Mannequin
MM_ChargedAttack_Anim.uasset     -> SKEL_Mannequin
```

Variante montage du projectile (non utilisée dans GESTES) : `Narvos/FreeflowCombatSystem/Animations/Anims/WeaponPickup/AM_HeavyObjectThrow.uasset` (AnimMontage, listé dans `Catalogs/Animations.lua:275`).

### 2.2 Arme en main — `Sorts.GESTES_ARME` (70 anims HandSignal, toutes sur SKEL_Mannequin)

Dossier : `Narvos/Tactical_HandSignals/Animations/{Rifle,Pistol}/...`

- `Rifle_HandSignal_*_Anim.uasset` : **35 anims** (CeaseFire, Choppa, CloseIn, Dangerous, DoubleTime, EnemyContact, File, Forward, Freeze, GetDown, GetUp, GoDown, GoUp, Halt, HeadCount, HearTalking, Hostage, IED, LightsOn, Line, Listen, Me, PointLeft, PointRight, PointUp, Quiet, Radio, RallyPoint, SniperLocation, SpreadOut, Stop, TurnCorner, Understood, Wedge, You)
- `Pistol_HandSignal_*_Anim.uasset` : **35 anims** (mêmes noms)
- + 2 idles (`Rifle_Idle_Relaxed_Anim`, `Pistol_Idle_Relaxed_Anim`) = **72 `*_Anim.uasset`** au total dans Tactical_HandSignals.
- Vérification squelette exhaustive : boucle `grep -aoE "SKEL_[A-Za-z0-9_]*"` sur les 72 `*_Anim.uasset` → **`bad=0 / total=72`**, 100 % `SKEL_Mannequin`.

Wiring actuel (Sorts.lua:265-278) — fusil : Forward (projectile/basic), GetDown (aoe), PointUp (buff), Halt (shield) ; pistolet : Forward, GetDown, PointUp, Halt.

### 2.3 Les 12 sorts (spells_unreal.json)

`E:/narvosprime-web-prototype/WebPortal/Server/spells_unreal.json` (généré 2026-09-20, miroir de `Spells.lua`) :

```
warrior_bruiser  (electric): bruiser_slam (basic), bruiser_shockwave (aoe), bruiser_rage (buff)
warrior_dps      (fire)    : dps_fire_shot (projectile), dps_plasma_barrage (aoe), dps_evasion (shield)
warrior_tank     (earth)   : tank_bash (basic), tank_fortress (aoe), tank_iron_wall (shield)
warrior_heal     (light)   : heal_nano (buff), heal_drone (aoe), heal_barrier (shield)
```

**Aucun champ animation/montage/cast** : `grep -inE "anim|montage|cast" spells_unreal.json` → aucune ligne. Le JSON ne porte que vfxNiagara/vfxImpactSkeletal.

---

## 3. Squelettes

### 3.1 SKEL_Mannequin (cible nanos)

- Pack : référencé par **toutes** les anims de gestes ci-dessus (import `/Game/NanosWorld/Characters/Common/SKEL_Mannequin`, visible en clair dans `AM_GroundTakedownPunch.uasset`).
- Content Unreal : `NanosWorld/Characters/Common/SKEL_Mannequin.uasset` (squelette natif des Characters nanos).
- Autres squelette de type Mannequin dans le pack (meshes de démo, pas des anims) : `SK_Mannequin.uasset` (Action_Crossbow/Demo, BaconCombatGraphU/Demo, Demo/), `SK_MannequinMain.uasset` / `SK_MannequinMainUE5M.uasset` (Defender/Demo).

### 3.2 SK_CombatMannequin (supposé source du retarget)

- **Introuvable** : `find -iname "*combatmannequin*"` → vide ; `grep -c "CombatMannequin" Assets.toml` → `0` ; aucun dossier ARPG « MagicCombatSystem ».
- Conclusion : le retarget « ARPG → SKEL_Mannequin » n'a **aucune source sur disque** aujourd'hui. Le pack ARPG (~86 anims annoncées) n'a jamais été ajouté au dépôt d'assets.

### 3.3 Autres squelettes croisés dans les dossiers d'anims (hors scope cast)

- `ThirdPerson/Characters/Mannequins/Anims/Unarmed/Attack/` contient aussi `MI_Quinn_*_SKM_Quinn_Simple.uasset` (squelette SKM_Quinn_Simple) — anims d'un autre pack mêlées au même dossier ; sans `SKEL_` dans le binaire. Les anims `MM_*` du même arbre (132 .uasset) sont sur `SKEL_Mannequin` (ex. `MM_Rifle_Fire_Anim` → `SKEL_Mannequin`).
- Squelettes non-humains du pack (`SKEL_Bellows`, voitures `SK_*`, etc.) : hors sujet cast.

---

## 4. Montages

### 4.1 Pack source

| Emplacement | Fichiers | Type |
|---|---|---|
| `FreeflowCombatSystem/Animations/Anims/**` | **53 `AM_*.uasset`** (Counter ×8, Dodges ×5, EnemyAttack, Finishers, GroundTakedown, HitReactions ×5, Strikes…) | **AnimMontage** (vérifié : `grep -a AnimMontage` sur AM_CounterBack_A/B, AM_CounterFront_A/B, AM_CounterLeft_A/B → 100 % montages) |
| `Farming_And_Mining/Animations/` | 5 : `Hoeing_Montage`, `Hoeing_Stepback_Montage`, `Pick_Montage`, `Shovel_Montage`, `Shovel_AlternateMontage` | AnimMontage |
| `Multiplayer_Handcuff_System/Mannequin/Animations/Montage/` | `AS_Handcuffed.uasset`, `AS_Interaction.uasset` | **AnimSequence** (le dossier s'appelle Montage mais grep -a → `AnimSequence`) |
| `Blueprints/AnimNotifies/BP_NotifyState_MontageBlendOut.uasset`, `Blueprints/SmartObjects/TasksAndConditions/STT_PlayAnimMontage.uasset` | BP, pas des montages | — |

**Montages de cast (RMB_Cast, `*_Cast_Montage`, dossier Montages de sorts) : AUCUN.**
`find -iname "*rmb*"` → vide. `find -iname "*montage*.uasset"` → uniquement les 53+5 ci-dessus.

Détail `AM_GroundTakedownPunch.uasset` (montage Freeflow jadis câblé en aoe, abandonné le 2026-09-15 au profit d'`AS_GroundTakedownPunch`) :
```
AnimMontage (×2)  |  DefaultSlot (×1)  |  SKEL_Mannequin (×2)
imports : /Game/FreeflowCombatSystem/Blueprints/AnimNotifies/ANS_HitDetectionWindow
          /Game/FreeflowCombatSystem/Blueprints/Enumerations/E_DamageResponse
          /Game/FreeflowCombatSystem/Blueprints/Structs/F_AttackInfo
          /Game/FreeflowCombatSystem/Blueprints/Structs/F_DamageInfo
          /Game/NanosWorld/Characters/Common/SKEL_Mannequin
```
→ les 4 imports Blueprints Freeflow sont absents du pack (qui ne contient que `Narvos/`), d'où son retrait. Confirmé par `ENQUETE_ARMES_SORTS_2026-09-15.md:106-107`.

### 4.2 Content Unreal (playtest)

18 `*Montage*.uasset`, **tous** ALS vault/climb sous :
`NanosWorld/Characters/Common/Animations/TEMP/VaultClimbing/` —
`ALS_CLF_GetUp_Back/Front_Montage_{2H,Default,LH,RH}` (8), `ALS_N_LandRoll_F_Montage_{2H,Default,LH,RH}` (4), `ALS_N_Mantle_1m_Montage_{2H,Box,Default,LH,RH}` (5), `ALS_N_Mantle_2m_Montage_Default` (1).

Aucun montage de sort/cast. Aucun `Montages/` de sorts nulle part dans `Content/`.

---

## 5. Recherche par mots-clés (preuves brutes)

### 5.1 Pack source (`find` sur 87 197 .uasset + `grep` sur Assets.toml exhaustif)

| Motif | Résultat |
|---|---|
| `*cast*` (noms de fichiers) | uniquement `-facade_under_antenna005_rays_casting_companyies_*` (StaticMeshes Orbital, hors sujet) |
| `*magic*`, `*spell*`, `*firemagic*`, `*rmb*` | **0 fichier** |
| `*projectile*` | matériaux Defender (`M_AssaultRifleProjectile`…), aucune anim |
| `grep -c FireMagic \| RMB_Cast \| CombatMannequin \| MagicCombatSystem` sur Assets.toml | **0 0 0 0** |
| `grep -icE "magic"` Assets.toml | **0** |
| `cast/magic/spell` dans `Catalogs/Animations.lua` | aucune ligne |
| Préfixes comptés | `A_`:307, `AM_`:53, `AS_`:508, `ACB_`:618, `MM_`:156, `RMB_`:0, `Rifle_HandSignal_`:105, `Pistol_HandSignal_`:105 |

### 5.2 Content Unreal (playtest, 10 811 .uasset)

| Motif | Résultat |
|---|---|
| `*cast*` | `A_LocalForecast` (musique), `Overcast` ×4 (météo UDS) — aucune anim |
| `*magic*` | FX seulement : `M_ky_magicCircle020`, `P_ky_magicCircle1`, `T_ky_magicCircle020` (FXVarietyPack) |
| `*spell*`, `*handsignal*`, `*combatmannequin*`, `*magiccombat*`, `*narvos*` | **0 fichier** |
| `*projectile*` | 0 |
| `*montage*` | 18 (ALS uniquement, liste §4.2) |

---

## 6. Ce qui manque pour les 12 sorts

1. **Anims de cast dédiées** : aucune. Les gestes actuels sont des emprunts (lancer d'objet lourd, takedown au sol, taunt, attaque chargée, signaux tactiques). `RMB_Cast` et `FireMagicProjectile` n'existent nulle part (pack, Content, `spells_unreal.json`).
2. **Montages de cast** : aucun. Pour `anim-cast-montages`, il faudra soit monter des AnimMontage neufs (les 53 montages AM_ Freeflow et les 18 ALS ne sont pas des casts), soit retargeter d'un pack ARPG — qui n'est pas dans le dépôt.
3. **Pack ARPG MagicCombatSystem + squelette SK_CombatMannequin** : absents. La tâche `retarget-cast` exige d'abord d'ajouter le pack source (~86 anims attendues) au dépôt `Assets/narvos/`.
4. **Câblage Unreal** : `spells_unreal.json` (12 sorts) n'expose aucun champ animation/montage ; il faudra ajouter `animCast`/`montageCast` par sort et le lire côté ADK.
5. **Squelette cible** : OK — tout le gestuel existant (74 anims) est déjà sur `SKEL_Mannequin` (natif nanos, `NanosWorld/Characters/Common/SKEL_Mannequin.uasset`), donc tout retarget arrivera sur la bonne cible.

---

## 7. Fichiers consultés (contexte)

- `E:/narvosprime-web-prototype/.hermes/ENQUETE_ARMES_SORTS_2026-09-15.md` (§3 Gestes de lancement de sort, lignes 89-117)
- `E:/narvosprime-web-prototype/.hermes/ENQUETE_MELEE_2026-09-15.md`, `ENQUETE_LOCOMOTION_AVANCEE_2026-09-15.md` (montages ALS/ADK en diagonale)
- `Server/spells_unreal.json`, `Server/nanos_world/packages/narvos/Shared/Logic/Sorts.lua`, `Shared/Catalogs/Animations.lua`

*Audit fichiers uniquement — aucun .uasset modifié, Unreal non lancé.*