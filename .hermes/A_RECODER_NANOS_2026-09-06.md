# Ce qui reste à écrire en Lua — 2026-09-06

Les assets sont sous `Narvos/`, donc cuisibles. **Aucun ne fait rien tant qu'il
n'est pas nommé dans un catalogue et pris par du code.** Cette liste dit, pour
chaque lot importé, ce qu'il manque et où ça s'écrit.

## État des lieux

```
Narvos/Defender               1 516 assets   1,5 Go    292 anims · 17 SK · 10 ABP/BS · 15 pièces modulaires
Narvos/SmartLocomotion          355 assets   428 Mo    2 ABP · blend spaces (Stand/Crouch/Swimming/Aim)
Narvos/Mars_Sanctuary           214 assets   147 Mo    144 StaticMesh sci-fi
Narvos/FreeflowCombatSystem     180 assets   283 Mo    119 montages de mêlée · 5 armes · props
                             ------------------------
                              2 265 assets   ~2,4 Go
```

Non promus, donc non cuits, et c'est voulu : `Defender/Blueprints` (gameplay +
widgets UMG), `Defender/Demo/Levels`, `Mars_Sanctuary/Maps` (541 Mo),
`FreeflowCombatSystem/Demo` et `/Thumbnails`.

---

## 0. Le passage obligé, avant tout le reste

Rien n'est atteignable depuis Lua tant que `Assets.toml` ne le déclare pas.

```bash
# 1. inventaire typé, depuis Unreal (classe de registre, jamais le préfixe de nom)
UnrealEditor-Cmd.exe <ADK>.uproject -run=pythonscript -script="scripts/adk-dump-assets.py"
# 2. cook
# 3. pack — ⚠ SANS --apply il SIMULE, sort en code 0, et Assets.toml reste périmé
node scripts/nanos-build-asset-pack.mjs --apply
# 4. contrôle
node scripts/narvos-verifier-catalogues.mjs
```

---

## 1. Système modulaire — la vraie nouveauté

**Defender livre 15 pièces + 3 bases sur le squelette de nanos.** Mesuré :
`root`, `pelvis`, `spine_01..03`, `clavicle_l`, `neck_01`, `head`,
`lowerarm_twist_01_l`, `ik_hand_gun` présents ; **`spine_04`, `spine_05`,
`neck_02` absents**. C'est le Mannequin UE4 68 os — `AddSkeletalMeshAttached`
les accepte tels quels.

```
Narvos/Defender/Demo/Meshes/ModularMeshes/
    SK_Head1..5        ->  slot visage
    SK_Torso1..5       ->  slot torse
    SK_Legs1..5        ->  slot jambes
    BaseMeshes/SK_HeadBase, SK_TorsoBase, SK_LegsBase
    Materials/
```

C'est la seule garde-robe **sci-fi** du lot qui soit attachable — celle de
`Metahuman_Customization_System` est sur squelette MetaHuman, écartée.

### À écrire

**a. Quatrième source dans `scripts/narvos-modular-to-lua.mjs`.**
Le générateur lit aujourd'hui des dossiers de **GLB** (`_export/stylized_modular`
et les packs sources). Ces pièces-ci n'ont **pas de GLB** : elles sont arrivées
en `.uasset`. Il lui faut donc une source qui liste
`Content/Narvos/Defender/Demo/Meshes/ModularMeshes/*.uasset`.

Famille `"defender"`, à ajouter à `Modular.FAMILLES`. Genre `"*"` (un seul jeu
de pièces sert aux deux). Slots couverts : `visage`, `torse`, `jambes`
seulement — **pas** de `mains`, `pieds`, `tete`, `barbe`, `epaules`, `bras`.

⚠ **La famille est une contrainte, pas une étiquette.** `ValiderTenue` refuse
déjà le mélange entre familles ; le respecter ici évite exactement le défaut
déjà documenté : des volumes qui ne concordent pas, une interpénétration que le
joueur voit sans comprendre.

⚠ **`PorteurCachable` exige une pièce de TÊTE.** Cette famille n'en a pas
(`SK_Head*` est un visage, pas un crâne complet — à vérifier à l'œil avant de
trancher). Sans certitude, laisser le porteur **visible** : la règle §27 dit
qu'une famille jugée cachable à tort rend le personnage **décapité**.

**b. `Vestiaire.Identites`** — les 15 pièces relèvent-elles de la création
(registre `base`) ou de la boutique ? La règle du projet : la création donne un
corps, le marchand l'habille. Des torses et des jambes sont de l'habillement →
registre `civil` ou `uniforme`, **pas** `base`. Les trois tests de
`scripts/lua-harness/vestiaire-tests.lua` le verrouillent dans les deux sens.

**c. Écran de création (`Client/UI/creation/`)** — rien à changer côté page : le
catalogue voyage déjà par `Session.Options()`. Vérifier seulement que la
nouvelle famille apparaît et que `etapesVisibles()` ne propose pas l'étape
« Visage » (elle est réservée à `mpfb`, seule famille à morphs).

**d. Contrôle** : `scripts/lua-harness/parcours.mjs` suit une composition de bout
en bout. C'est le seul test qui attrape un nom de pièce perdu entre deux modules
— et un nom d'asset faux n'échoue pas, il est **ignoré**.

---

## 2. Animations — 411 nouvelles, aucune branchée

| lot | contenu | destination |
|---|---|---|
| `SmartLocomotion` | `BS_Stand`, `BS_Crouch`, `BS_Swimming`, `BS_AimLocomotion`, `BS_Sword_Idle_Run` | `Character:SetAnimationIdleWalkRunStanding(bs)` / `…Crouching` — API **server** |
| `Defender/Demo/Animations` | 292 séquences | `Animations.lua`, via `scripts/narvos-anims-to-lua.mjs` |
| `FreeflowCombatSystem/Animations` | 119 `AM_*` (montages) / `AS_*` (séquences) — Counter Front/Back/Left/Right ×2 | montages joués par `PlayAnimation(path, slot, …)` |

**À écrire** : étendre `narvos-anims-to-lua.mjs` pour lire aussi ces trois
dossiers, puis `Shared/Logic/Locomotion.lua` qui associe une famille de corps à
son jeu de blend spaces. Les blend spaces se posent **une fois au spawn**, pas
par tick.

⚠ Les slots de `PlayAnimation` : `0 FullBody`, `1 UpperBody`, `2 Head`. Un
montage de contre joué en FullBody coupe la course.

---

## 3. Monstres — la matière est là, le code manque

`Server/Spawner.lua:113-118` passe aujourd'hui **`""`** comme Animation
Blueprint à `CharacterSimple`, avec ce commentaire :

> « Pas d'Animation Blueprint : lui en passer un fabriqué pour un autre
> squelette déformerait le modèle sans erreur. »

Le raisonnement était juste **tant qu'on n'avait pas d'ABP pour le bon
squelette**. Defender en apporte 10, et ses 17 SkeletalMesh :

```
ennemis      SK_Exodus_Gruntling · SK_Gruntling_Guardian · SK_Gruntling_Avalanche
             SK_Greater_Spider · SK_Minibot
humanoïdes   SK_Trooper · SK_ShadowOps · SK_WraithLunarOps · SK_Murdock(+2 variantes)
             SK_S/M/L_Male (3 gabarits)
```

**À écrire** :
- un champ `abp` dans le catalogue de spawn, et `Spawner.lua` qui le passe au
  4ᵉ argument de `CharacterSimple` — **par archétype**, pas par mesh ;
- `SetAnimationBlueprintPropertyValue("Speed", v)` à chaque changement d'état,
  `CallAnimationBlueprintEvent("…")` pour les coups ;
- ⚠ garder le garde-fou : un ABP ne vaut que pour SON squelette. Le catalogue
  doit refuser d'associer un ABP à un mesh d'un autre squelette — la déformation
  ne lève aucune erreur.

⚠ `Spawnables.lua` a ses points d'apparition calibrés sur l'**ancienne**
géométrie de la Forge. À refaire avant de juger un spawn « cassé ».

---

## 4. IA — rien n'existe, et rien n'est importable

Les Behavior Tree ne tournent pas dans nanos (pas d'`AIController` exposé). Le
découpage de `AIBehaviorToolkit` sert de **spécification**, à écrire en Lua :

```
Shared/Logic/IA.lua      pur, testable — machine à états
Server/IA.lua            le tick, les perceptions, les appels moteur
```

États : `patrouille → détection → approche → strafe|couverture → attaque →
hit react → étourdi → retour`. Décisions : `CheckDistance`, `CheckFront`.
Actions : `MoveTo`, `NextPatrolLocation`, `RotateToTarget`, `CircleStrafe`,
`TakeCover`, `AttackTarget(+Ranged)`, `PlayHitReact`, `Stunned`.

⚠ **Le budget est de 33 ms par tick** à 30 Hz, et c'est le NOMBRE d'entités qui
coûte. Une IA qui raisonne chaque monstre à chaque tick ne passera pas à 400
joueurs : découper en tranches (un sous-ensemble par tick) dès l'écriture, pas
après. Voir [[project-optimisation-400-joueurs]].

---

## 5. Combat de mêlée

119 montages Freeflow + 5 armes (`SM_Weapon_Crowbar`, `Pipe`, `Sledgehammer`,
`Baseball_01/02`), toutes StaticMesh → classe `Melee` de nanos.

**À écrire** : `Shared/Logic/Combat.lua` — enchaînement, fenêtre de contre
(les montages sont nommés par direction : Front / Back / Left / Right), dégâts.
Le tirage et la validation sont des **décisions d'état de jeu : le serveur
décide, le client reçoit** (chaque VM a son propre `math.randomseed`).

Les armes s'ajoutent à `Items.lua` / `Merchants.lua`, générés par
`narvos-catalogs-to-lua.mjs` depuis les catalogues TS — donc c'est le **TS**
qu'on édite, pas le Lua.

---

## 6. Décor — 144 meshes Mars Sanctuary

`Props.lua` est généré par `narvos-nanos-base-to-lua.mjs`, qui lit le pack de
BASE de nanos. Nos propres StaticMesh n'y sont pas.

**À écrire** : une source « pack NARVOS » dans ce générateur (ou un générateur
frère), alimentée par l'inventaire de `adk-dump-assets.py`. Sans ça, les 144
meshes sont cuits et invisibles pour le Lua.

Emploi : décor posé par `MapLoader`, ou props ramassables. ⚠ Poser la dimension
**à la création** du mesh, jamais après.

---

## 7. Interface — 523 PNG jamais référencés

`Client/UI/img/gui/` : bordures, boutons, curseurs, icônes, barres, cadres de
qualité. L'UI actuelle est **entièrement en CSS**, sans une seule image.

**À écrire** : du CSS. Aucun Lua. Police à récupérer : Arbutus Slab
(Google Fonts), le pack ne la livre pas.

---

## 8. Masquage de la peau — la piste ouverte, pas la voie décidée

Voir [[reference-masquage-peau-vetement]]. Coût : un masque peint par vêtement,
et `M_NarvosPeau` doit **naître** en blend mode `Masked` (non modifiable au
runtime). À trancher avant d'y engager du contenu.

---

## Ordre proposé

1. Cuire + `nanos-build-asset-pack.mjs --apply` — sans ça, rien n'existe.
2. Modulaire Defender (§1) : c'est la demande, et c'est du générateur, pas du
   moteur.
3. Locomotion (§2) : deux appels, effet immédiat sur tout ce qui bouge.
4. Monstres (§3) : ABP par archétype dans `Spawner.lua`.
5. IA (§4) puis combat (§5) — les deux gros morceaux.
6. Props (§6), interface (§7).