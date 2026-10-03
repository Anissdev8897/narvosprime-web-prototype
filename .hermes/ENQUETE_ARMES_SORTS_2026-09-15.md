<!-- Rapport d agent (lecture seule), 2026-09-15 16:33 -->

# Rapport : armes en main en 1ʳᵉ personne, gestes de sort, recharges

Enquête en lecture seule, aucun fichier modifié. La base `narvos_comptes.db` a été lue en mode `immutable=1`, qui ne crée aucun fichier. Une recherche `find` en lecture seule (tâche `bob0ee1ao`) peut encore tourner en arrière-plan. `Client/Index.lua` a été modifié par quelqu'un d'autre à 16:21 pendant l'enquête, ses numéros de ligne peuvent bouger.

## 0. Chronologie

- **Un seul personnage en base** : Guerrier DPS, femme, corps `mh_femme`, créé à 14:30:56 (heure de Paris). Tous les diagnostics après 14:32 montrent `BP_NarvosMH_F`. Les deux captures montrent donc très probablement le même corps MetaHuman féminin.
- **Capture du pompe** : vue 1ʳᵉ personne de 14:37:42 à 14:41:10, tir à 14:39:16 (`C:\Users\aniss\AppData\Local\NanosWorld\Saved\Logs\NanosWorldCore_2026.09.15_15.39.20.log`).
- **Capture du Lewis Gun** : vue 1ʳᵉ personne de 16:05:37 à 16:06:32 (`...\Logs\NanosWorldCore.log`).
- **Aucun sort en jeu** : aucune ligne `[SORTS]` dans les journaux serveur `D:\steam\steamapps\common\nanos-world-playtest\Server\.logs\` (dernier lu jusqu'à 16:03:50). Aucun lancement ni refus de sort n'a été journalisé. Le résultat « 98 harnais verts » (`.hermes\ASTRA_armes_sorts_sac_tests_20260915.log`) ne teste que la logique, pas le rendu.

## 1. Quelle est la main visible ?

**Faits vérifiés**
- **Porteur** : `nanos-world::SK_Mannequin` pour les deux genres (`...\narvos\Shared\Catalogs\Modular.lua:139-140`).
- **Masquage du porteur** : `MasquerPorteur` rend le mesh visible puis pose `SetMaterial("narvos::Mat_Invisible", -1)` (`...\narvos\Shared\Logic\Character.lua:575-593`, appelé ligne 630). La constante est dans `...\Catalogs\MetaHumain.lua:30`.
  - Le journal serveur l'a confirmé à chaque pose : `masque=materiau` (`...\Server\.logs\NanosWorldCore_2026.09.15_15.12.41.log:94`, puis 215 pour F).
  - `Mat_Invisible` est déclaré (`E:\narvosprime-web-prototype\WebPortal\Server\Assets\narvos\Assets.toml:56397`).
  - Il est cuit pour mesh skinné : `BLEND_Masked` et `bUsedWithSkeletalMesh` dans le `.uasset`, shaders `GPUSkinVertexFactory` dans le `.uexp`.
- **Vue 1ʳᵉ personne côté NARVOS** : le serveur autorise la vue (`CameraMode.FPSTPS`, `...\narvos-map-proto\Server\Index.lua:278`). Le client bascule (`SetViewMode(ViewMode.FPS)`, `Client\Index.lua:131`) puis `Client\MetaCustom.lua:135-156` ne vide que `Face` et 6 grooms. Le commentaire lignes 39-47 le dit : « le corps, les bras et les mains restent ».
- **API nanos disponible, non utilisée pour la vue** :
  - `HideBone` (autorité both, `...\api-main\Classes\BasePawn.json:481-547`) : jamais appelé.
  - L'événement `ViewModeChange` (`Character.json`) n'est écouté nulle part.
  - D'après le blog nanos (`blog\2021-10-06-weapons-improvements.mdx:37`), la vue est une vraie 1ʳᵉ personne sur le corps entier.
- **`SK_Mannequin_Arms` existe mais rien ne l'utilise** : le fichier est dans `D:\steam\steamapps\common\nanos-world-playtest\NanosWorld\Content\NanosWorld\Characters\Mannequin\SK_Mannequin_Arms.uasset`. Aucun asset nanos (`Blueprints`, `Core`, `Characters`, `GASP`, `Weapons`) n'y fait référence, et le binaire `NanosWorld-Win64-Shipping.exe` ne contient pas ce nom (0 occurrence, ASCII et UTF-16).
- **Matériau du mannequin nanos** : `M_Mannequin_Body` = couches `ML_Plastic_Shiny_Beige_LOGO` + `ML_SoftMetal_UE4`, paramètre `Tint`. Donc plastique beige et articulations métal, pas violet.
- **Apparence en base** :
  - `teinte.actif=1`, `h=172`, `s=0.47` : donne un multiplicateur de peau d'environ (0,53 ; 1 ; 0,94), cyan pâle (`Logic\MetaCustom.lua:475-482`).
  - Réglages de corps : `corps.height=0.38`, `handsize=1.33`, `armsize=1.3`.

**Hypothèses classées**

| Rang | Hypothèse | Preuves |
|---|---|---|
| 1 | **Main du MetaHuman** (corps de `BP_NarvosMH_F`) | Établie pour 16:06 : ton observation (main couleur peau) plus le code (seule la tête est retirée en 1ʳᵉ personne). Très probable pour la capture violette, même corps. |
| 2 | Porteur SK_Mannequin visible | Faible. Seul point en sa faveur : une « manchette » sombre ressemble aux articulations métal du mannequin. Contre : `masque=materiau` à chaque pose, matériau cuit correctement, et une main du porteur tiendrait l'arme. |
| 3 | Bras 1ʳᵉ personne nanos (`SK_Mannequin_Arms`) | Écartée : aucune référence dans le contenu ni dans le binaire. |

- **Couleur violette et manchette noire : NON EXPLIQUÉES.** Pistes : éclairage de nuit (le diagnostic de 16:04 indique `heure=0:0:0`) ou teinte modifiée entre 14:39 et la dernière sauvegarde.
- **Test pour trancher (console client)** :
  - `bp:SetVisibility(false)` sur le Blueprint local : si la main disparaît, c'est l'hypothèse 1.
  - `character:ResetMaterial(-1)` en local : le mannequin beige doit apparaître avec l'arme en main.

## 2. Pourquoi l'arme « flotte » (pompe comme Lewis Gun)

**Attache**
- `Weapons.Donner` fait `character:PickUp(arme)` sur le porteur (`...\narvos\Shared\Logic\Weapons.lua:243-266`), appelé par l'équipement depuis le sac (`Server\Index.lua:2264-2278`).
- Aucun `SetAttachmentSettings` dans les packages. L'arme prend donc la socket par défaut `hand_r_socket` (`...\Classes\BasePickable.json:253-276`, doc `weapons-meshes.mdx:20`).
- En 1ʳᵉ personne, nanos place l'arme par rapport à la caméra : `SetRightHandOffset` « to position relative to the camera » (`Weapon.json:402-414`).
- **L'arme est donc tenue par les bras invisibles du porteur.**

**Réglages comparés à default-weapons**
- **Pistolet** = Glock officiel pour les mains et la visée.
- **Fusil** = AK47 officiel pour les mains et la visée ; seuls `SetBulletSettings(1,20000,20000)` (officiel 30000/30000) et `SetWallbang(50, …)` (officiel 200) diffèrent.
- **Lewis Gun** (`ArmesBase.lua:186-215`) = officiel (`default-weapons-master\Shared\Index.lua:277-309`). Il « flotte » quand même : les valeurs ne sont pas la cause principale.
- **Pompe : réglages différents de l'officiel.** Le commentaire d'en-tête (`Weapons.lua:20-25`) dit « recopiés du package officiel », c'est faux :

| Réglage | `pompe` (`Weapons.lua:130-161`) | Moss500 officiel (`Index.lua:362-395`, identique à `ArmesBase.lua:249-279`) |
|---|---|---|
| `SetSightTransform` | (0,0,-0.5) R(0,0,0) | (0,0,3.6) R(-2,0,0) |
| `SetLeftHandTransform` | (30,0,6) R(0,60,90) | (36.8,0,3.8) R(-5,10,190) |
| `SetRightHandOffset` | (-10,0,0) | (0,0,3) |
| `SetSightFOVMultiplier` | absent | 0.75 |
| `SetSoundFire` | `A_Moss500_Shot` (n'existe pas) | `A_Shotgun_Shot` |
| Son à vide / chargement / douilles | `A_Rifle_Dry` / aucun / aucune | `A_Shotgun_Dry` / `A_Shotgun_Load_Bullet` / `P_Weapon_Shells_12Gauge` |

Le son absent est prouvé : 3 erreurs « Asset 'A_Moss500_Shot' … not found » à 14:39:16, 14:59:28 et 15:07:52 (`.logs\NanosWorldCore_2026.09.15_15.12.41.log:516, 919, 957`).

**Décalage mains MetaHuman / porteur**

| Mesure | Tête | Bassin | Mains |
|---|---|---|---|
| En jeu, F, 16:04:14 (`...\narvos-map-proto\.data\diag_client.txt`) | -19 cm | -11 cm | ≈ 8 cm (-3 / +3 / -7) |
| Aperçu création F, 16:03:50 | -14 cm | — | ≈ 4 cm |
| Aperçu création M, 16:01:54 | -3 cm | — | 2-3 cm |

- **L'écart grandit avec les réglages de corps MCS.**
- Ces mesures sont en pose d'attente. La pose arme en main en 1ʳᵉ personne n'a jamais été mesurée (NON VÉRIFIÉ).
- Travail d'Astra : FBIK mains ajouté (`.hermes\ASTRA_ik_mains_20260915.json`), avec position des bras reprise du porteur et 8 métacarpiens non mappés. Ses propres notes : « PAS encore preuve … après proportions corps » et « Mains avec IK livré restent décalées de quelques cm, pose armée à mesurer » (`.hermes\REPRISE_ASTRA_2026-09-15.md:56, 85`).
- La caméra reste à la hauteur du porteur, environ 19 cm au-dessus de la tête du MetaHuman (déduit du diagnostic et de `MetaCustom.lua:40`).

**« Très gros »**
- Aucune mise à l'échelle NARVOS : pour un corps Blueprint, `Habiller` sort avant `AppliquerApparence` (`Character.lua:718-720`), qui contient le seul `SetScale` (476-480).
- C'est le cadrage 1ʳᵉ personne natif nanos, sans bras visibles pour donner l'échelle.
- Une échelle « première personne » propre à nanos : NON VÉRIFIÉ (les chaînes `FirstPersonScale` du binaire sont génériques d'UE 5.7).

## 3. Gestes de lancement de sort

**`Sorts.GESTES`** (`...\narvos\Shared\Logic\Sorts.lua:239-245`) :
- `projectile = "narvos::AS_HeavyObjectThrow"`
- `aoe = "narvos::AM_GroundTakedownPunch"`
- `buff` et `shield = "narvos::ACB_Taunt_01_IP_Anim"`
- `basic = "narvos::MM_ChargedAttack_Anim"`

**Lecture par le serveur** (`...\narvos-map-proto\Server\Sorts.lua:324-338`)
- Si une arme à feu est tenue, le geste est remplacé par `arme:GetAnimationCharacterFire()` **pour tous les archétypes**, bouclier et buff compris. Concrètement :
  - Lewis et fusil : `AM_Mannequin_Sight_Fire`
  - pompe : `AM_Mannequin_Sight_Fire_Heavy`
  - pistolet : `A_Mannequin_Sight_Fire_Pistol`
- Appel : `PlayAnimation(geste, AnimationSlotType.UpperBody, false)`, avec le fondu par défaut de 0,25 s (`Character.json:170-221`).

**Compatibilité**
- **Squelette** : les 4 gestes importent `/Game/NanosWorld/Characters/Common/SKEL_Mannequin` dans le pack cuit. Aucun nom cast/spell/magic/ability/buff/summon/channel n'existe dans `Catalogs\Animations.lua`.
- **`AM_GroundTakedownPunch` pose problème** : c'est un AnimMontage dont la table de noms contient `DefaultSlot`. Il importe 4 assets `/Game/FreeflowCombatSystem/...` (`ANS_HitDetectionWindow`, `F_AttackInfo`, `F_DamageInfo`, `E_DamageResponse`) absents du pack, qui ne contient que `Narvos/`. Que le slot UpperBody soit ignoré pour un montage : NON VÉRIFIÉ.
  - Remplacement : `narvos::AS_GroundTakedownPunch` (AnimSequence, seul import SKEL_Mannequin, `Assets.toml:48442`).
- **Arme tenue** : UpperBody remplace tout le haut du corps. D'après le commentaire d'Astra (`Server\Sorts.lua:328-329`), les anciens lancers à deux mains faisaient lâcher le fusil ; je ne l'ai pas vérifié. Un tir nanos interrompant le geste : NON VÉRIFIÉ.

**Candidats utilisables arme en main** (AnimSequence sur SKEL_Mannequin, * = import vérifié dans le fichier cuit ; durées et images d'impact NON VÉRIFIÉES) :

| Usage | Clés exactes |
|---|---|
| Fusil tenu, main gauche libre | `narvos::Rifle_HandSignal_Forward_Anim`* (projectile), `narvos::Rifle_HandSignal_GetDown_Anim` (aoe), `narvos::Rifle_HandSignal_PointUp_Anim` (buff), `narvos::Rifle_HandSignal_Halt_Anim` / `narvos::Rifle_HandSignal_Stop_Anim` (shield), `narvos::Rifle_HandSignal_PointLeft_Anim` / `narvos::Rifle_HandSignal_PointRight_Anim` |
| Pistolet tenu | `narvos::Pistol_HandSignal_Forward_Anim`*, `narvos::Pistol_HandSignal_Halt_Anim`, `narvos::Pistol_HandSignal_PointUp_Anim` |
| Tir | les 3 montages nanos ci-dessus, `narvos::MM_Rifle_Fire_Anim`*, `narvos::MM_Pistol_Fire_Anim`*, `narvos::Fire_Rifle_Hip`*, `narvos::Anim_Mann_PAS_HipFire_Anim`, `narvos::ACB_Aim_Fire_Anim`* |
| Lancer avec un fusil à pompe (pack FPS_Arms, rendu 3ᵉ personne NON VÉRIFIÉ) | `narvos::Anim_Mann_PAS_StunGrenade_Throw_Anim`*, `narvos::Anim_Mann_Grenade_Throw_Anim` |

## 4. Origine du projectile et synchronisation

**Point de départ** (`Server\Sorts.lua:345-350`)
- Sans arme : capsule + 70 cm devant + 40 cm de haut.
- Avec arme : `arme:GetLocation()`, c'est-à-dire la racine de l'arme (la poignée), **pas le canon**.
- Les effets « lanceur » sans arme naissent au centre de la capsule, dans le corps (ligne 358).
- La valeur serveur de la position d'une arme attachée : NON VÉRIFIÉ. Le serveur n'a pas de squelette et nanos réduit la synchro des entités attachées (blog 2025-10-08:115).

**Direction** : `GetRotation():GetForwardVector()` (ligne 310), lacet seul, sans tangage. La cible est choisie dans un cône 2D (115-137). `homing` n'est jamais lu dans `Server\Sorts.lua`.

**Partir du canon**
- `GetSocketTransform` est client uniquement (`BaseActor.json:217-243`).
- Mais `AttachTo(other, rule, bone_name, …)` accepte une socket et est d'autorité serveur (`BaseActor.json:72-114`).
- Les armes nanos ont une socket `muzzle` (doc `weapons-meshes.mdx`, chaîne présente dans le binaire).
- Le serveur peut donc attacher l'effet de départ à `arme` sur la socket `"muzzle"`. Aujourd'hui `PoserEffet` attache toujours avec `""` (ligne 171).

**Synchronisation**
- Projectile : impact et dégâts arrivent à la fin du vol (`TranslateTo` puis `SetTimeout(temps)`, 396-409), mais l'impact se pose sur la position actuelle de la cible, pas là où la boule arrive.
- AOE, buff et basic : dégâts **instantanés** au moment du geste (361-423), aucun délai pour attendre l'impact de l'animation.

## 5. Recharges

**Valeurs**
- 5 / 4 / 60 s selon la touche, imposées par la boucle ajoutée par Astra (`WebPortal\src\rpg\spells\spellCatalog.ts:75-83` ; la sauvegarde de `.hermes\sauvegardes\armes-sorts-sac-20260915\` ne l'a pas).
- Regénéré dans `...\Catalogs\Spells.lua` : lignes 17/35/54, 72/90/109, 127/145/164, 181/200/219.
- Contrat testé par `scripts\lua-harness\sorts-tests.lua:390-399`.

**Logique**
- `Restant` (`Logic\Sorts.lua:176-184`), `PeutLancer` qui vérifie aussi le mana (192-215), `Lancer` qui arme la recharge (468-469).
- `VueBarre` (498-522) envoie `recharge` (durée totale), `restant` et `pret = PeutLancer`. `pret` mélange donc manque de mana et recharge.

**Horloge**
- Pas fixe de +0,5 s par minuterie (`Server\Sorts.lua:515-518`), sans lien avec le temps réel.
- Or le serveur a journalisé des ticks de 475 à 685 ms. Une recharge peut donc durer plus longtemps en réel.
- `Server.GetTime()` (millisecondes Unix) existe (`StaticClasses\Server.json:809-819`).

**Affichage** (`...\Client\UI\ateliers.js:495-559`)
- Toute la barre est reconstruite à chaque message, toutes les 500 ms (`replaceChildren`, ligne 507).
- Voile plein et chiffre `restant.toFixed(1)` (543-548), icône grisée si `pret=false` (`ateliers.css:392`).
- Le commentaire `ateliers.css:420-422` promet « un voile qui se retire par le bas », mais le CSS (423-432) est un voile fixe `inset:0`.

**Ce qui manque pour un indicateur clair** :
- une proportion `restant / recharge` affichée (balayage circulaire ou hauteur) ;
- une interpolation côté page entre deux messages ;
- une distinction mana insuffisant / recharge ;
- un signal visuel quand le sort redevient prêt ;
- une horloge serveur réelle.

## 6. Causes prouvées et plan

**Causes prouvées**
1. **Arme tenue par une main invisible** : l'arme est tenue par le porteur, invisible sous `Mat_Invisible`, et placée par nanos par rapport à la caméra.
2. **Mains visibles décalées** : ce sont celles du MetaHuman retargeté, décalées de 8 cm aux mains et 19 cm à la tête en jeu. L'IK mains ne compense pas.
3. **Pompe mal réglé** : il ne reprend pas le Moss500 officiel, et son son `A_Moss500_Shot` n'existe pas.
4. **Gestes inadaptés** : arme en main, bouclier et buff jouent le recul de tir. Le geste AOE est un montage aux imports manquants.
5. **Départ au mauvais endroit** : le projectile part de la poignée, dans la direction de la capsule sans tangage.
6. **Désynchronisation** : dégâts AOE/basic instantanés ; horloge de recharge à pas fixe.
7. **HUD peu lisible** : voile statique reconstruit toutes les 500 ms, sans proportion, mana et recharge confondus.

**Plan de correction**
1. **Mesurer d'abord (sans cook).**
   - Arme en main en 1ʳᵉ personne, relever côté client : `arme:GetLocation()`, `arme:GetSocketTransform("muzzle")`, `hand_r`/`hand_l` du MetaHuman et du porteur.
   - Côté serveur, journaliser `arme:GetLocation()` au lancement (`Server\Sorts.lua:350`).
   - Faire le test de visibilité du §1.
2. **Vue 1ʳᵉ personne lisible (sans cook).** Dans `Client\MetaCustom.lua` (135-156), pour le joueur local :
   - `bp:SetVisibility(false)`, `character:ResetMaterial(-1)`, `character:SetMaterialColorParameter("Tint", teinte_peau, -1)`, `character:HideBone("neck_01")` ;
   - à la sortie, l'inverse (`SetMaterial("narvos::Mat_Invisible", -1)`, `UnHideBone`, `SetVisibility(true)`) ;
   - écouter aussi `Character.Subscribe("ViewModeChange")`.
   - Toutes ces méthodes sont d'autorité both. Risque NON VÉRIFIÉ : un rhabillage serveur qui repose le matériau.
3. **Pompe** : dans `Weapons.lua:144-158`, reprendre les valeurs officielles du tableau du §2 (Sight (0,0,3.6) R(-2,0,0), LeftHand (36.8,0,3.8) R(-5,10,190), RightHandOffset (0,0,3), FOV 0.75, `nanos-world::A_Shotgun_Shot`, `A_Shotgun_Dry`, `A_Shotgun_Load_Bullet`, `P_Weapon_Shells_12Gauge`). Autre option : appeler le `configurer` de `moss500` puis surcharger les dégâts. Corriger l'en-tête 20-25.
4. **Gestes.**
   - `Logic\Sorts.lua:241` : `aoe = "narvos::AS_GroundTakedownPunch"`.
   - Ajouter une table `GESTES_ARME` choisie par `arme:GetHandlingMode()` (autorité both) : Rifle_HandSignal_* (Forward / GetDown / PointUp / Halt), Pistol_HandSignal_* pour une arme à une main.
   - Dans `Server\Sorts.lua:327-332`, ne plus imposer le recul de tir à buff et shield.
   - Étendre `sorts-tests.lua:213-231`.
5. **Origine.**
   - Direction : `lanceur:GetControlRotation():GetForwardVector()` (ligne 310 et `CibleDevant`).
   - Ajouter un paramètre socket à `PoserEffet` (171) pour attacher l'effet de départ à `arme` sur `"muzzle"`.
   - Projectile : soit une approximation serveur (poignée + avant × longueur de canon à mesurer), soit la position du canon envoyée par le client avec `Narvos:LancerSort` (`Client\Index.lua:1843-1845`), bornée à 200 cm de la capsule côté serveur.
6. **Synchronisation.** Table `IMPACT_MS` par geste (0 pour un montage de tir, durées à mesurer dans l'ADK), puis `Timer.SetTimeout` avant dégâts et effets (361-423). Horloge : `horloge = (Server.GetTime() - T0) / 1000` (515-518).
7. **HUD.**
   - `VueBarre` : ajouter `raison = "recharge" | "mana"`.
   - `ateliers.js:495-559` : garder les nœuds, mémoriser l'échéance à `performance.now() + restant × 1000`, animer `--p = restant / recharge` à chaque image, entier au-dessus de 3 s et une décimale en dessous, signal visuel quand le sort redevient prêt.
   - `ateliers.css:420-434` : voile en `conic-gradient` piloté par `--p`, style distinct pour le manque de mana.
8. **Moyen terme (avec cook).** Déplacer l'IK des mains après le post-traitement du corps MCS dans l'ABP du pont. Évaluer un porteur `nanos-world::SK_Mannequin_Female` avec un rig source dédié pour réduire l'écart de 19 cm à la tête (gain NON VÉRIFIÉ). Revalider les diagnostics arme en main en 3ᵉ et 1ʳᵉ personne.