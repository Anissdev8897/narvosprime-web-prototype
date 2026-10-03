# Triage des 24 packs de `Downloads/Telegram Desktop` — 2026-09-06

Question posée : **qu'est-ce qui est récupérable pour l'ADK / nanos ?**
Mesuré sur disque (pas supposé) : classes de fichiers, présence de `Source/`,
chemin de montage `/Game/…` lu dans les `.uasset`, et os des squelettes.

⚠ Ces packs sont des produits **Fab/Marketplace payants** obtenus hors boutique.
Même nature de risque que la géométrie Halo et les assets Ankama déjà signalés.
C'est une décision du projet, pas une objection technique — mais elle est notée.

---

## Le filtre qui décide de tout

nanos est un **client shipping** : aucun C++ tiers ne s'exécute. Trois familles :

| Ce qu'on récupère | Verdict |
|---|---|
| StaticMesh, SkeletalMesh, **animations**, textures, matériaux, particules, sons | ✅ se cuisent tels quels |
| **Animation Blueprints** | ✅ `CharacterSimple(mesh, **ABP**)` + `SetAnimationBlueprintPropertyValue` / `CallAnimationBlueprintEvent` |
| Blueprints d'acteur simples | ⚠ tournent (classe `Blueprint`), mais **`Character` ne traverse pas le pont Lua↔BP** — rien qui touche au joueur |
| **Behavior Tree / Blackboard / EQS** | ❌ exigent un `AIController` + `BrainComponent`, non exposés. L'IA nanos s'écrit en Lua |
| Widgets UMG | ❌ l'UI nanos est WebUI (HTML/JS) — mais **les textures** se réemploient |
| Plugins C++ | ❌ hors whitelist = ne se charge pas |

**Fait mesuré, et c'est la bonne nouvelle du lot** : sur **Defender, ARPG,
Freeflow et SmartLocomotion**, `spine_04` / `spine_05` / `neck_02` sont
**absents** des squelettes. Ce sont des **Mannequin UE4, 68 os** — exactement
`SKEL_Mannequin` de nanos. Leurs animations et leurs pièces d'armure sont donc
directement exploitables, sans retargeting.

⚠ **Correction, mesurée après coup** : **Meta Customization est l'exception**.
Le premier relevé n'avait échantillonné que ses `SK_Mannequin_Skeleton` et
`Warrior_Skeleton` (UE4) ; ses vrais squelettes de garde-robe,
`metahuman_base_skel` et `Skel_Dummy`, portent bien `spine_04`, `spine_05`,
`neck_02`, `clavicle_out_l` et `index_metacarpal_l`. Détail en fin de document.
Échantillonner par nom de fichier ne dit rien : c'est la pièce qu'il faut
interroger, pas le premier squelette trouvé.

---

## Copié dans l'ADK — 14 packs, 12 595 `.uasset`, ≈ 23,5 Go

Placés à leur **chemin de montage d'origine** (`Content/<Mount>/`), jamais
directement sous `Narvos/` : un `.uasset` porte son chemin de package en dur, le
copier ailleurs casse toutes ses références. Le passage sous `Narvos/` se fait
ensuite **par l'éditeur**, asset par asset (`rename_asset`), qui réécrit les
références — **pas** `rename_directory`, qui ment : voir la fin du document.

| Dossier ADK | Go | Ce qu'on en tire |
|---|---|---|
| `Defender` | 2,20 | **237 animations**, 100 SK. Ennemis prêts : Gruntling (×3), Greater_Spider, Minibot. Têtes/jambes modulaires `SK_Head1..5`, `SK_Legs1..5`. Héros Paragon (Murdock — déjà dans le jeu web) |
| `AdvancedARPGCombat` | 3,11 | 53 anims + **19 ABP** de mêlée, 116 SM, 546 textures, armure `SK_ExampleSteel*` sur Mannequin |
| `FreeflowCombatSystem` | 0,59 | **64 animations de combos** de mêlée, squelette `UE4_Mannequin_Skeleton` confirmé |
| `DMD` (Multiplayer Shooter) | 0,97 | 105 anims FPS, **22 ABP**, 90 SK d'armes |
| `SmartLocomotion` | 0,43 | **124 animations** + blend spaces → alimentent `SetAnimationIdleWalkRunStanding` |
| `ProceduralWeaponAnimationSystem` | 0,16 | poses d'arme, aim offsets |
| `Mars_Sanctuary` | 0,70 | **144 StaticMesh sci-fi modulaires** — le meilleur ajustement thématique du lot |
| `SpaceScenes` | 3,06 | astéroïdes, étoile mourante, godrays → hub orbital |
| `Sewer` | 3,13 | 113 SM de tunnels/intérieurs |
| `FPSShotguns_VOL1/2/3` | 1,03 | 170 SM d'armes → classe `Weapon` |
| `City_Traffic_Pro` | 0,28 | 181 SM de props urbains |
| `Metahuman_Customization_System` | 7,83 | ⚠ **rien d'attachable** : les 52 pièces sont sur squelette MetaHuman, pas sur les 68 os. Le seul apport est une **technique** (masquage de la peau) — voir la section dédiée. Ne pas promouvoir |

## Copié dans le WebUI — 523 PNG

`packages/narvos-map-proto/Client/UI/img/gui/` : bordures, boutons, curseurs,
icônes, barres de progression, cadres de qualité, décor. **L'interface actuelle
n'a aucune image** (tout en CSS) — c'est le premier habillage disponible.
Police à récupérer soi-même : Arbutus Slab (Google Fonts).

---

## Écarté, et pourquoi

| Pack | Raison |
|---|---|
| `AdvancedGASSystemUE56` | 467 fichiers C++, plugin. Et ce n'est **pas** le Gameplay Abilities natif whitelisté — homonymie, piège déjà noté |
| `Enhanced_AI_Movement` | 42 fichiers C++, 20 assets. Rien à extraire |
| `FluidFluxUE53` | 438 matériaux qui dépendent du plugin FluidFlux. `Water` / `Advanced Water` natifs ≠ FluidFlux |
| `Spring Landscape` | matériaux de Landscape ; nanos ne charge pas de Landscape actor |
| `AI Behavior System`, `AIBehaviorToolkit`, `Open World AI Spawn System` | **le code est du Behavior Tree** → ne tourne pas. Voir ci-dessous |
| `4kFullFantasyGUI` (uasset) | widgets UMG. Seuls les 523 PNG partent, déjà copiés |
| `InventorySystemPro`, `Dynamic RPG Toolkit`, `SlotBased_inventory`, `Hyper Skill Level Manager` | logique BP + UMG. À miner pour leurs **icônes d'objets** si besoin, pas à importer |

### Les packs d'IA valent quand même quelque chose : leur découpage

`AIBehaviorToolkit` liste précisément le comportement qui manque à
`Spawner.lua`. À porter **en Lua**, pas à importer :

```
BT_GenericAI · BT_ShooterAI · BT_ZombieAI · BT_FlyingAI
BTT_ : MoveToBlackboard, NextPatrolLocation, PatrolSpline, RandomLocation,
       SetSeekTarget, DoInvestigate, CircleStrafe, TakeCover,
       AttackTarget(+Ranged), PlayHitReact, Stunned, RotateToTarget,
       DoWork / FinishWork / DoTalking (PNJ non combattants)
BTS_ : CheckDistance, MatchSpeed, AttackTarget
BTD_ : CheckDistance, CheckFront
```

Lu comme une spécification, ça donne la machine à états d'un monstre :
`patrouille → détection → approche → strafe/couverture → attaque → hit react →
étourdi → retour`. C'est ce qui va dans `Shared/Logic/` (pur, testable) avec le
tick serveur dans `Server/`.

---

## Suite immédiate

1. **Ouvrir l'éditeur une fois** : les 14 dossiers apparaissent sous `/Game/`.
   Vérifier qu'un pack s'affiche (matériaux résolus) — les références sont
   intactes puisque le chemin de montage est respecté.
2. **Promouvoir sous `Narvos/`** ce qu'on garde, dossier par dossier, avec
   `scripts/adk-promouvoir-packs.py`. ⚠ Ne PAS tout promouvoir : `Assets.toml`
   déclare `unreal_folders = ["Narvos"]`, donc tout ce qui passe sous `Narvos/`
   **part au cook**. Le pack fait déjà 31 Go.
3. Ordre conseillé, du plus utile au moins : `Defender` (animations + ennemis) →
   `SmartLocomotion` → `Mars_Sanctuary` → `FreeflowCombatSystem` →
   garde-robe de `Metahuman_Customization_System`.
4. Le chantier monstres a maintenant sa matière : `Spawner.lua:115` passe un ABP
   **vide** ; `Defender` et `AdvancedARPGCombat` en apportent 41.

---

# Meta Customization System — aide-t-il Mutable / le modulaire ?

Question posée le 2026-09-06. Réponse mesurée sur les 2 193 `.uasset` copiés.

## Pour Mutable : non, et sans ambiguïté

**Zéro `CustomizableObject` dans le pack.** Aucun asset Mutable, aucune
`CustomizableObjectInstance`, aucun `UCustomizableSkeletalComponent`. Ce système
ne fait pas ce que fait Mutable : il n'y a pas de fusion de mesh ni de
composition de texture. C'est de l'attachement de SkeletalMesh + paramètres de
matériau + morph targets — la même famille que ce que fait déjà
`Builder.Habiller`.

Le blocage de [[project-mutable-bp-test]] reste entier : `Character` ne traverse
pas le pont Lua ↔ Blueprint. Rien ici ne l'adresse.

## Pour le modulaire : les pièces sont inutilisables telles quelles

Les **52 pièces** se répartissent sur deux squelettes, et **aucun n'est celui de
nanos** :

| squelette | pièces | `spine_04` | `spine_05` | `neck_02` | `clavicle_out_l` | `index_metacarpal_l` |
|---|---|---|---|---|---|---|
| `metahuman_base_skel` | 18 | ✔ | ✔ | ✔ | ✔ | ✔ |
| `Skel_Dummy` | 34 | ✔ | ✔ | ✔ | ✔ | ✔ |
| **`SKEL_Mannequin` (nanos)** | — | ✘ | ✘ | ✘ | ✘ | ✘ |

`AddSkeletalMeshAttached` exige « the same skeleton used by this Actor's mesh ».
Ces pièces sont donc **refusées** sur un `Character` nanos. Les employer
demanderait de les relier aux 68 os — pas un retargeting d'animation, un
**rebind des poids de peau**, mesh par mesh.

Et le contenu est médiéval-fantasy (robes, ceintures, bretelles, heaumes) :
13 pièces seulement dans `Metawadrobe`. Deux tenues sci-fi (`SK_Sci_Fi_Armor`,
`SK_Sci_Fi_Jumpsuit`), sur `Skel_Dummy`. Le rapport travail / rendement est
mauvais face aux packs Stylized et Trooper déjà reliés aux 68 os.

## Ce qui vaut vraiment le détour : `Underwear_Remover`

Un seul asset, et il répond à un problème ouvert du projet.

```
Underwear_Remover/Material/Copy_This_To_M_Bodyskin.uasset
   MaterialFunction — OpacityMask · Masked · TextureSampleParameter
                      OneMinus · LinearInterpolate · ScalarParameter
```

C'est le **masquage de la peau par le vêtement** : le matériau du corps passe en
blend mode `Masked`, une texture de masque en espace UV du corps découpe ce que
le vêtement recouvre.

⚠ C'est exactement ce que le skill note comme **impossible** avec
`AddSkeletalMeshAttached`, et qui justifiait Mutable :

> « C'est précisément ce que `AddSkeletalMeshAttached` ne sait pas faire :
> masquer les sections du corps sous un vêtement. D'où l'interpénétration
> visible en jeu. »

Or le masquage par matériau **passe par le pont Lua** :

```lua
-- BasePaintable, autorite both, avec attachable_id
c:SetMaterialTextureParameter("MasqueVetement", "narvos::T_Masque_Torse", -1, "")
c:SetMaterialScalarParameter("SeuilMasque", 0.5, -1, "")
```

### Ce que ça change par rapport à §18 (`SetMeshSettings` invisible)

| | porteur caché (§18) | masque par matériau |
|---|---|---|
| granularité | **tout ou rien** — le corps entier disparaît | par zone d'UV |
| condition | la famille DOIT livrer une peau découpée par slot, tête comprise ([[project-vestiaire-nanos]], §27 « sinon décapité ») | aucune |
| corps `mpfb` | garde son porteur visible, donc interpénètre | marcherait |
| coût | nul | une texture de masque **par vêtement**, peinte dans l'UV du corps |

Le coût est réel : une pièce = un masque. Le pack n'en livre d'ailleurs qu'un
seul et générique (`Remove_T`), pas un par vêtement — c'est un « enlève les
sous-vêtements », pas un système par pièce.

### La suite si on prend cette voie

1. Ajouter au `M_NarvosPeau` (déjà à nous, `adk-creer-materiau-peau.py`) :
   `TextureSampleParameter` → `OneMinus` → `OpacityMask`, blend mode `Masked`.
   Neutre = masque blanc, donc rien ne change tant qu'aucun vêtement n'en pose.
2. Un masque par pièce couvrante, dans l'UV du corps, cuit comme texture.
3. `Builder.Habiller` compose : union des masques des pièces portées, posée
   après l'attachement (même contrainte d'ordre que les teintes — pièces →
   morphs → apparence, l'`attachable_id` n'existe qu'une fois la pièce là).

⚠ **À vérifier avant de s'y engager** : nanos permet-il de changer le *blend
mode* d'un matériau cuit ? Non — il est cuit dans l'asset. Donc `M_NarvosPeau`
doit naître `Masked`, ce qui coûte un peu de remplissage (`Masked` désactive
quelques optimisations d'opaque). À mesurer, pas à supposer.

## Verdict

| | |
|---|---|
| Mutable | **aucun apport** — le pack n'en contient pas |
| pièces de garde-robe | **inutilisables** sans rebind sur 68 os ; thème médiéval |
| morphs | 7 sur le corps de démo, contre 522 sur `base_morphable` — rien à gagner |
| **technique de masquage** | **le seul vrai apport**, et il contredit une limite qu'on croyait fermée |

Ne pas promouvoir ce pack sous `Narvos/`. Garder `Copy_This_To_M_Bodyskin`
comme référence de graphe, à reproduire dans notre propre matériau.

---

# Promotion sous `Narvos/` — faite le 2026-09-06

```
Narvos/SmartLocomotion      355 uasset    428 Mo
Narvos/Defender           1 516 uasset    1,5 Go
                        --------------------------
                          1 907 arrives / 1 912 vises,  5 rates
```

Sous-dossiers pris de Defender : `Demo/Animations`, `Demo/Characters`,
`Demo/Meshes`, `Demo/Materials`, `Demo/Textures`, `Demo/Particles`,
`Demo/PhysicAssets`. **Laissés dehors, donc non cuits** : `Blueprints/`
(104 Mo, gameplay + widgets), `Demo/Levels` (409 Mo), `Demo/Audio`,
`Demo/HDRI`, `Demo/Input`, `Demo/Fonts`, `Datatables`, `Inputs`.

Arrivés et vérifiés : `BP_Anim_Character_UE4` / `_UE5` (les ABP de locomotion),
`BS_Stand`, `BS_Crouch`, `BS_Swimming`, `BS_AimLocomotion`, `BS_Sword_Idle_Run`
— ce sont les blend spaces qu'attend `SetAnimationIdleWalkRunStanding`.

**51 redirecteurs** restent aux anciens chemins. Contrôlé par
`scripts/adk-verifier-refs-promues.py` : **0 asset promu ne pointe encore
dessus**, et ils sont hors de `Narvos/` donc jamais cuits. Sans effet.

## Deux pièges d'API payés ici, et ils se ressemblent

**`EditorAssetLibrary.rename_directory` ment.**

| dossier | retour | réalité |
|---|---|---|
| `/Game/Defender` | `False` | rien déplacé — **un seul** asset illisible (widgets qui référencent `/Script/CommonUI`, plugin non activé) fait échouer le dossier ENTIER |
| `/Game/SmartLocomotion` | **`True`** | **dossier vide créé**, les 357 fichiers toujours à l'ancienne place |

Le second est le plus dangereux : un succès annoncé qui n'a rien écrit. Même
forme que `save_asset(only_if_is_dirty=True)` la veille — voir
[[feedback-ecriture-muette-unreal]].

**`AssetTools.rename_assets([AssetRenameData…])` tue le commandlet.**

```
Assertion failed: !"Enclosing block should never be called"
  CoreUObject/Private/Misc/PackagePath.cpp:751
```

Un `FAssetRenameData` construit positionnellement depuis Python ne remplit pas
le champ attendu. Le processus tombe **avant** le moindre déplacement : 1 912
assets annoncés, zéro écrit.

**Ce qui marche** : `EditorAssetLibrary.rename_asset(source, cible)`, un asset
par appel — la voie déjà éprouvée sur les 166 matériaux du 05/09. Environ
8 minutes pour 1 912 assets ; un asset illisible échoue **seul** et se compte.

⚠ Et le compte des échecs ment aussi, dans l'autre sens : 41 appels ont rendu
`False` mais le recomptage en a trouvé 1 907 arrivés sur 1 912. Déplacer un
asset entraîne ses dépendances. **Seul le recomptage dit la vérité** — ni le
retour de l'appel, ni l'absence d'erreur.