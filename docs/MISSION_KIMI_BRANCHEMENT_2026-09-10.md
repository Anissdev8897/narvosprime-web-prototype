# MISSION KIMI — brancher les lots triés

Rédigée le 2026-09-10, en réponse à `HANDOFF_CLAUDE_2026-09-10.md`.
Décision du patron : **tu branches, je cuis derrière.** Le cook attend que le
branchement soit fini.

Tes audits sont bons — mesurés, avec les incertitudes nommées. Trois choses à
corriger avant de reprendre, parce qu'elles changent ton périmètre.

---

## 0. Trois corrections

### 0.1 Il y a un éditeur UE 5.7 sur cette machine

Tu écris cinq fois « pas d'éditeur UE sur cette machine » (LOT1 §1, §incertitudes ;
LOT2 §2, §incertitudes ; HANDOFF §5.2), et tu en déduis que les migrations sont
non testables. Mesuré :

```
D:\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor.exe
WebPortal\Server\adk\NanosWorldADK.uproject
```

Et le cook a tourné ici le 09/09 à 17:04 (`Packages Remain 0`, 82 950 packages).
C'était vrai de TON accès, pas de la machine. **Les migrations 4.19→5.7 ne sont
donc pas bloquées — elles sont à moi.** N'écarte plus rien pour ce motif.

### 0.2 Tes chemins sont périmés

`asset_game/` a été retrié les 09 et 10/09. Un second niveau « à trier » s'était
créé dans le premier et portait 68 Go ; il est dissous. La structure est
maintenant **plate** — la nature d'abord, l'époque ensuite :

```
mixte_epoques/         79,9 Go   Hyper Inventory V2 · Meta Customization · MetaWardrobe
                                 Farming And Mining · Crystals and Crafting · Retro Police Station
asset_futuriste/       19,7 Go   Metaverse(=CITY_PACK) · POLYGON Sci-Fi Worlds (2)
                                 Sci Fi Orion Mars Med Lab · MEGASTRUCTURE · Spaceship_Pack_1
                                 Sci-Fi_Props_Vol01 · Mars Sanctuary · Space Scenes · Defender
systemes_sans_epoque/  12,2 Go   Soulslike · 4 inventaires · Survival Crafting · 5 IA/GAS
asset_epoque_moderne/  11,7 Go   CityTrafficPro · Ridable MotorBikes · Quarantine Medical Tent
                                 MultiplayerHandcuffs · Drivable Cars Basic · ModularSewers · …
sources_dcc/           11,4 Go   Security Camera Vol 01 · ScifiPlantationLab · Brendonrise
                                 20x Vehicles · Modern Tanks (3D Print)
nature_et_tech/        10,3 Go   FluidFlux · Spring Landscape · Open Worlds
asset_medieval/         5,3 Go   ARPG Combat V3 · Dynamic RPG Toolkit · 4kFantasyGUI · 2 anims
moteur_unity/           3,2 Go   QA Police Station · 3 packs Unity + UGUI MiniMap
animations_neutres/     0,6 Go   ProceduralWeaponAnim · SmartLocomotion · Crafting_Animations
a_trier/                0,9 Go   BOÎTE D'ENTRÉE : glb_a_degraisser/ + 1 doublon
```

`node scripts/asset-game-doublons.mjs` liste les doublons (2 aujourd'hui,
2,49 Go). Le README du dossier est à jour.

### 0.3 `narvos-degraisser-glb.mjs` ne touchera PAS tes 3 GLB

Tu le recommandes (HANDOFF §5.4) pour le walkie, le keypad et le smartphone. Lis
la règle 1 de son en-tête :

> « Ne touche QU'AUX fichiers d'ANIMATION (`gltf.animations` non vide). »

Tes trois GLB sont des props statiques. Le script ne lèvera pas : **il les
ignorera, en silence** — exactement le mode d'échec que tes propres audits
traquent. Il faut un autre outil (§3.C).

---

## 1. Le partage du travail

| | quoi |
|---|---|
| **toi** | Lua, générateurs, downsizing GLB, manifeste d'import. Rien qui demande l'éditeur. |
| **moi** | import + migration 4.19/4.22/4.25/4.26 → 5.7 dans l'ADK, cook, `Assets.toml`, puis générateurs + vérificateur + batterie + serveur. |

## 2. Le piège d'ordre — lis-le avant d'écrire une ligne

Un catalogue Lua qui nomme un asset absent d'`Assets.toml` est une **référence
morte**, et le jeu l'ignore **en silence**. `node scripts/narvos-verifier-catalogues.mjs`
est la barrière ; il sera **rouge** sur le contenu neuf jusqu'à ce que j'aie
cuit. **C'est attendu, ce n'est pas un échec** — ne le contourne pas, ne
commente pas une entrée pour le faire passer.

Ce qui se branche **avant** le cook sans mentir :

1. **La SOURCE des générateurs** — pour qu'ils voient le contenu neuf tout seuls
   le jour où il est cuit.
2. **La LOGIQUE** — du Lua pur, testable sous wasmoon, qui ne nomme aucun asset.

⚠ **Aucun catalogue ne s'édite à la main.** Ils sont générés ; le prochain
`--apply` écrase. Le travail est toujours dans le générateur.

---

## 3. Ce que je te demande, dans cet ordre

### A. Les générateurs — c'est le vrai travail, il conditionne le reste

**A.1 `narvos-modular-to-lua.mjs`.** Tu avais raison de ne pas le brancher tel
quel : le rebind `Skel_Dummy` → `SKEL_Mannequin` est un travail d'éditeur, donc
le mien. Mais élargis quand même la source, **avec la garde** : une pièce dont le
squelette n'est pas prouvé compatible **ne sort pas du générateur**. Comme ça le
jour où j'ai rebindé et recuit, les pièces apparaissent sans qu'on retouche le
code.

⚠ **Cette garde n'est pas théorique — mesuré le 2026-09-10, et c'est bien pire
que 37 pièces.** Le patron a ajouté la garde-robe **MetaWardrobe** (pack payant
distinct, 989 fichiers, 15 Go) dans `Meta Customization System`. Squelettes
relevés dans les binaires (1 Mo lu à chaque bout de chaque `.uasset`, table de
noms) :

| ensemble | `.uasset` | squelettes visés | UE |
|---|---|---|---|
| base `Skeletal_Meshes/` | 46 | `Skel_Dummy` ×88, `metahuman_base_skel` ×4 | 5.4 |
| `Metawadrobe/` | 988 | `CombinedSkelMesh_Skeleton` ×100, `Dress_Skeleton` ×44, `Outfit_Skeleton` ×40, `metahuman_base_skel` ×36, `Sweats_Skeleton` ×26, `Shorts_Skeleton` ×20 | 5.6 ×495, 5.4 ×493 |

**`SKEL_Mannequin` : zéro occurrence. `UE4_Mannequin_Skeleton` : zéro.** Sur les
deux ensembles. `AddSkeletalMeshAttached` exige le même squelette que le corps :
aucune de ces pièces ne s'attache aujourd'hui, et le pack payant est éclaté sur
**au moins cinq squelettes par vêtement** — le rebind n'est pas une opération,
c'en est plusieurs. Reproduire la mesure sur n'importe quel dossier :

```bash
node scripts/narvos-squelettes-uasset.mjs "<dossier contenant des .uasset>"
```

⚠ Il lit **1 Mo à chaque bout** de chaque fichier, pas le fichier entier : la
table de noms d'un `.uasset` vit près du début et de la fin, et l'un de ces
fichiers dépasse 512 Mo — au-delà, V8 refuse de fabriquer la chaîne
(`ERR_STRING_TOO_LONG`). Lire tout aurait planté sans rien mesurer.

Conséquence pour toi : écris la garde de façon à ce qu'elle **exclue tout**
aujourd'hui sans que ce soit un échec. Le générateur doit rendre un catalogue
vide de MetaCustom et le DIRE, pas planter ni se taire.

### ⚠ MISE À JOUR DU 2026-09-10, APRÈS EXPORT glTF : l'exclusion est DÉFINITIVE

Les trois inconnues sont tranchées, sur les assets réels
(`docs/VERDICT_GARDE_ROBE_2026-09-10.md`). **N'attends pas un rebind : il
n'arrivera pas.**

| pièce exportée | poids reposant sur des os ABSENTS du Mannequin |
|---|---:|
| `SK_Dress` | **67,1 %** |
| `SK_Fantasy_outfit_1` | **55,4 %** |
| `SK_Belt` | **40,4 %** |

Et la hiérarchie **INTERCALE** : `clavicle_l/r` passent par `spine_05`, les
doigts par leurs métacarpiens. `CompatibleSkeletons` ne change rien — il règle
une identité d'asset, pas une topologie.

Le piège était que les NOMS d'os disaient l'inverse : **61/61 os déformants
présents (100 %)**, seuls 7 `ik_*` manquants. Un SkeletalMesh NOMME tout son
squelette, y compris ce qu'il ne déforme pas. **Seul le poids tranche.**

Donc : la garde n'est pas un provisoire, c'est la règle. Écris-la comme telle, et
que le générateur DISE pourquoi il exclut — sinon quelqu'un la retirera dans six
mois en croyant débloquer quelque chose.

Ce qui reste ouvert et qui, lui, vaut du travail : **`CharacterSimple` accepte
n'importe quel mesh, sans contrainte de squelette.** Ces 988 pièces peuvent
habiller des PNJ comme corps autonomes, aujourd'hui, sans rien rebinder. Si tu
touches au peuplement, c'est là qu'elles servent.

⚠ **Et corrige le gabarit pendant que tu y es.** Tu as trouvé le défaut, il faut
le refermer. L'en-tête généré dit :

```
-- 2 corps, 40 pièces, 1 familles.          <- interpolé, vivant
-- Deux familles cohabitent. Les DEUX passent AddSkeletalMeshAttached :
-- leurs noms d'os concordent avec SKEL_Mannequin, vérifié.   <- littéral, mort
```

Le compteur dit UNE famille, la prose en décrit DEUX et affirme une
vérification. Elle a survécu à `METAHUMAN_ACTIF = false`. **Une prose qui décrit
un cas piloté par un drapeau doit être SOUS ce drapeau**, pas à côté. J'ai cité
cette prose comme preuve dans mon handoff du 09/09 et j'ai conclu faux : c'est
elle qui m'a fait dire « volume » là où c'était « squelette ».

**A.2 Les autres générateurs.** Dis-moi lesquels doivent voir le contenu neuf
(props, spawnables, végétation, anims…) et élargis-les. Liste dans
`scripts/narvos-*-to-lua.mjs`.

### B. La logique Lua — testable sans le cook

Un module par sujet, dans `Shared/Logic/`, câblé dans `Shared/Index.lua`, avec
son harnais dans `scripts/lua-harness/`. **Puis relance
`node scripts/lua-harness/cablage-check.mjs`** : le 08/09, 35 modules étaient
écrits et aucun câblé, et une seule ligne tuait six systèmes.

- **Menottes / arrestation (P7)** — `AS_Handcuffed` cible `UE4_Mannequin_Skeleton`,
  le bon squelette nanos : l'animation est réutilisable telle quelle. Le BP 4.26
  ne sert que de **spécification** (`BP_Handcuff`, `BP_PC`, `UI_Arrest`) — la
  logique se réécrit en Lua.
- **Caméras (P5)** — `BP_Video_Camera1` d'Orion est ta spécification, tu l'as
  déjà lue : `Camera Max Yaw`, `Camera Pitch`, SceneCapture,
  `BPI_Security_Alarm_Interface`. En Lua : base + tête en deux meshes, rotation
  bornée, alarme par événement. Le mesh seul suffit même si le BP 4.19 casse.
- **Agriculture (P6)** — tu l'as établi : **aucun stade de croissance dans aucun
  pack**. La source est `Hyper Inventory V2` (`BP_Farming_Master`,
  `BP_BigFarmingPlot`, 8 graines), déjà chez nous. Écris le cycle en Lua ;
  les meshes Synty l'habillent.
  ⚠ Ta question ouverte « `SM_Prop_Hydroponic_Plant_01/02/03` : 3 espèces ou
  3 tailles ? » — si tu ne peux pas la trancher sans rendu, **laisse-la ouverte
  et prévois les deux** : je la tranche à l'import, c'est une bbox à lire.
- **Véhicules (P1)** — attention, **deux conventions d'os différentes** :
  `Wheel_FL/FR/RL/RR` (City_Traffic_Pro) et `Front_Left_Wheel…` (motos Digital
  Dive), et le squelette moto porte en plus `Front_Visible_Wheel` et trois os de
  suspension pour **deux** roues. Le mapping va dans une **table de données**,
  jamais en dur — sinon le troisième pack de véhicules rouvre le chantier.

### C. Les 3 GLB — un script à écrire

`narvos-degraisser-glb.mjs` les ignore (§0.3). Ce qu'il faut est un
redimensionnement de textures embarquées. Les dépendances sont déjà là, dans
`WebPortal/` : `sharp`, `@gltf-transform/core`, `@gltf-transform/functions`.
Le motif exact est dans `WebPortal/scripts/puzzle-chunks.mjs:203-213` :

```js
textureCompress({ resize: [MAX, MAX], /* … */ })
```

⚠ **Sortie en PNG ou JPEG, jamais en WebP** : `EXT_texture_webp` dans
`extensionsRequired` fait refuser le document **entier** par Interchange
(`narvos-textures-vers-png.mjs` existe précisément pour réparer ça — ne
refabrique pas le défaut). Simulation par défaut, `--apply` pour écrire,
l'original jamais modifié.

| GLB | mesuré par toi | cible |
|---|---|---|
| `sci-fi_walkie-talkie.glb` | 60,1 Mo, 4 PNG **8192²** (~1,07 Go VRAM) | 1024² |
| `cc0_-_keypad_door_lock.glb` | 23,9 Mo, 4 PNG **4096²** (~268 Mo VRAM) | 1024² |
| `modern_generic_smartphone.glb` | 0,7 Mo, 3 PNG 2048² | tel quel |

Ils attendent dans `asset_game/a_trier/glb_a_degraisser/`. Une fois allégés, ils
quittent `asset_game` : le GLB est le domaine de `models/`. Dis-moi dans quelle
catégorie — tu as mesuré leurs triangles, pas moi.

### D. Le manifeste d'import

Ce que je dois importer et cuire, exactement — une ligne par asset, **chemin
ABSOLU**, et la clé `racine` en tête (sans elle le script s'arrête sur
`KeyError: 'racine'` et le cook enchaîne dix minutes pour rien).

**Nomme les exclusions**, tu les as déjà mesurées :

- `Maps/` + BuiltData : 196 Mo (Orion 4.19), 104 Mo (Quarantine 4.26), 1,3 Go
  (motos) — inutilisables en 5.7 ;
- `Movies/` : 5 `.mov`, 83 Mo (Orion) ;
- `Content/Developers/` et `Content/Collections/` (POLYGON) — brouillons ;
- tout ce qui vient du pack Unity (prefabs, `.mat`, `.cs`, shaders) ;
- la racine des motos : ` & ` dans « damage & animations » + triple imbrication
  → chemins > 260 caractères, `os.walk` échoue **en silence**. À renommer avant
  que je l'importe.

---

## 4. Non négociable — chacun a déjà coûté une session

- **Ne jamais masquer la sortie d'un `--apply`.** Trois échecs silencieux le
  04/09, chaque fois un backtick dans un template literal de générateur.
- `node scripts/lua-harness/syntaxe-check.mjs` avant de rendre (43 fichiers).
- `local function` déclarée **après** son appelant se résout en global `nil`,
  sans bruit — cinq fois en une session. Tables par joueur en tête de fichier ;
  `X = function()`, pas `local function X`.
- Client → serveur : `Events.CallRemote("X", Reliability.Reliable, …)`. L'omettre
  ne lève rien, la charge utile se perd.
- Recevoir d'un WebUI : **`ui:Subscribe`**, jamais `Events.Subscribe`. 25
  abonnements posés sur la mauvaise API — toutes les interfaces s'affichaient,
  aucune n'agissait.
- Un `+` dans une clé `Assets.toml` fait refuser le pack **entier**.
- **Ne recopie aucun nombre dans un test** — affirme la relation. Un `6` en dur a
  fait lire « deux passages en trop » là où c'était « deux mondes en plus ».
- **Un garde qui ne trouve rien à vérifier et se tait compte pour vert.** Exige
  qu'il trouve au moins une cible.
- Lance **TOUTE** la batterie avant de rendre : 50 harnais sous
  `scripts/lua-harness/`, pas un sous-ensemble.

## 5. Ce qui t'attend derrière

Quand tu rends, je fais dans cet ordre : import + migration dans l'ADK → cook →
`Assets.toml` → générateurs → `narvos-verifier-catalogues.mjs` → batterie →
serveur.

Le premier cook tranchera **la question que tu as laissée ouverte** : est-ce que
`VehicleWheeled` de nanos accepte `Car_Skeleton` ? Les 587 `.uasset` de
City_Traffic_Pro sont déjà stagés dans l'ADK (`adk/Content/City_Traffic_Pro/`,
12 voitures SK + PhysicsAssets) et **comptés 0 fois dans `Assets.toml`** —
vérifié à l'instant. C'est bien un cook, pas un achat, et ça ne se tranche qu'en
le faisant tourner.