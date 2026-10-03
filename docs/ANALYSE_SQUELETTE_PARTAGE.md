# Corps partagé pour PNJ, monstres et ennemis — ce que disent les mesures

Analyse du 2026-09-09. **Aucune modification n'a été faite.** Tout ce qui suit est
mesuré : GLB lus sur disque, API nanos lue dans `.hermes/API_NANOS_COMPLETE.md`,
appels comptés dans les paquets Lua.

Outil produit : `scripts/narvos-audit-squelettes-creatures.mjs`.

---

## 1. Le partage existe déjà — il est perdu à l'import

81 GLB de créatures (`models/pnj`, `pnj_monstre`, `pet`), 79 riggés.

| | |
|---|---|
| squelettes **distincts à la source** | **19** |
| squelettes **créés par Unreal à l'import** | **37** (mesuré par `adk-verify-skeletons.py`, cité dans `Server/Spawner.lua`) |

Et surtout :

> **50 GLB sur 81 partagent UN SEUL squelette** — 24 os, nomenclature Mixamo,
> biped, 130 animations cumulées. C'est le rig « Meshy AI biped », et c'est
> l'essentiel du casting du jeu.

Les 18 autres squelettes se répartissent ainsi :

| GLB | os | convention | morphologie | anims | exemple |
|---:|---:|---|---|---:|---|
| 50 | 24 | Mixamo | biped | 130 | `pnj/Grunt/Meshy_AI_biped_…` |
| 6 | 102 | inconnue | biped | 42 | `pnj/RobotGirl/…` |
| 3 | 46 | Rigify | **quadrupède** | 12 | `pet/Cow.glb` |
| 2 | 233 | inconnue | ? | 0 | `pnj/Tex/HumanMageRAW/SKM_HumanMage` |
| 2 | 38 | Mixamo | biped | 15 | `pnj_monstre/blackorn` |
| 2 | 17 | Blender brut | ? | 4 | `pnj_monstre/lion/PSX_lion` |
| 2 | 63 | Rigify | biped | 16 | `pnj_monstre/lizard` |
| 12 | — | — | — | — | un seul porteur chacun |

**Le gaspillage n'est donc pas dans les modèles : il est dans l'import.** Unreal
crée un `Skeleton` neuf par fichier importé sauf si on lui en impose un. 50
modèles qui partagent un rig ont reçu jusqu'à 50 squelettes.

---

## 2. Le Tick ne vient pas du mesh partagé

C'est la correction la plus importante de cette analyse, et elle change ce qu'il
faut faire.

**Partager un `SkeletalMesh` entre N acteurs économise la VRAM, pas le Tick.**
Unreal ne charge l'asset qu'une fois de toute façon ; ce qui coûte à chaque
image, c'est l'évaluation d'animation de chaque composant.

Mesuré dans le dépôt :

| fait | valeur |
|---|---|
| PNJ passés en `CharacterSimple` | **34 sur 56** |
| Animation Blueprint qu'on leur donne | `""` — **vide** (`Server/Spawner.lua:115`) |
| conséquence | ils n'évaluent **aucune** animation : ce sont des statues |

Autrement dit : **les 34 PNJ « non optimisés » sont déjà au coût de tick minimal.**
Les convertir en `Character` pour qu'ils partagent un corps leur **ajouterait** du
tick — puisqu'ils se mettraient enfin à bouger. Ce serait un gain de jeu, pas un
gain de performance, et il faut le dire dans ce sens.

### Le levier qui existe — et ce qu'il fait exactement

> **Correction de la première version de ce rapport.** J'y écrivais que
> `SetDistanceOptimizationMultiplier` était « le vrai levier sur le tick ».
> C'est faux, et la nuance change ce qu'on peut en attendre. Le guide nanos est
> explicite : la pertinence est *« le pourcentage de ticks où les snapshots de
> cet acteur sont réellement envoyés à ce joueur »*, et **seul le trafic
> `unreliable` est concerné** — mouvement et actions transitoires. Les
> événements distants, les spawns et les changements de valeur passent toujours
> en entier.
>
> C'est donc du **réseau**, pas du CPU. Ça reste le bon levier — à 400 joueurs
> c'est la contrainte annoncée du projet — mais il faut le dire dans ce sens.


Relevé dans l'API nanos (`Actor`) :

```
Actor:SetDistanceOptimizationMultiplier(float multiplier)   -- server
  « Sets this Actor's distance optimization multiplier »
Actor:SetRenderCullDistance(integer max_distance)           -- both
```

Comptage des appels dans **tous** les paquets Lua :

| appel | occurrences |
|---|---:|
| `SetDistanceOptimizationMultiplier` | **0** |
| `SetRenderCullDistance` | 3 |
| `SetCastShadow` | 3 |

nanos a donc son propre étranglement d'évaluation par distance, et il n'est
**jamais appelé**. C'est le levier direct sur le tick, et il coûte une ligne par
PNJ invoqué.

Un point déjà bon, à ne pas casser : les 12 appels à `AddSkeletalMeshAttached`
n'écrivent pas le paramètre `use_base_leader_pose_component`, qui vaut **`true`
par défaut**. Les pièces modulaires suivent donc la pose du corps sans faire
tourner leur propre graphe d'animation. C'est exactement le mécanisme « un seul
corps qui anime, le reste qui suit ».

---

## 3. UniGLB — trois faits, dont un qui corrige une note interne

| fait | mesure |
|---|---|
| état dans l'ADK | `Enabled=False` dans `NanosWorldADK.uproject` |
| pourquoi | son contenu d'exemple porte `A_face_VRoidSimple`, une `AnimSequence` **sans squelette** : le cook meurt en cours de route (`Assertion failed: !Hash.IsZero()`, mesuré à 2 579/3 755) |
| ses nœuds de retarget | `AnimNode_VrmRetargetFromMannequin` — du **C++ runtime**, absent du client nanos shipping : **inutilisable en jeu** |

**Correction d'une note interne** (`reference_uniglb.md` dit « cible Manny 89 os ») :
la table canonique d'UniGLB (`Source/UniGLB/Private/VrmUtil.cpp`) compte **73
paires**, dont **68 côtés gauches en nomenclature UE4 Mannequin**, et **zéro os
exclusif à UE5** (`spine_04`, `spine_05`, `neck_02`, `*_metacarpal_*` : tous
absents).

```
{"root",""}, {"pelvis","hips"}, {"spine_01","spine"}, {"spine_02","chest"},
{"clavicle_l","leftShoulder"}, {"upperarm_l","leftUpperArm"}, …
```

UniGLB vise donc **le squelette UE4 — celui que nanos exige.** C'est une bonne
nouvelle : sa table est directement la cible. Mais c'est une table **UE4 ↔ VRM**,
pas UE4 ↔ Mixamo — le côté droit est du vocabulaire VRoid (`leftUpperArm`), pas
Mixamo (`LeftForeArm`).

**Verdict praticable** : UniGLB est utilisable comme **outil d'éditeur** — on
l'allume pour une passe, on l'éteint avant de cuire, exactement comme le
documente le skill. Il ne peut pas être un système d'exécution.

---

## 4. Le vrai obstacle : la pose de liaison

Un renommage d'os ne suffit pas, et c'est mesuré, pas supposé. Direction
épaule → main, accumulée en espace monde depuis la racine :

| squelette | bras dans la pose de liaison |
|---|---|
| **groupe des 50** (Meshy) | **75°** sous l'horizontale — bras le long du corps |
| zombi | **3°** — T-pose |
| `SKEL_Mannequin` (nanos) | ~45° — A-pose |

Trois poses différentes. Lier un mesh Meshy à `SKEL_Mannequin` par simple
correspondance de noms donnerait un personnage **déformé de 30°** aux épaules dès
la première animation — sans erreur, sans log. C'est le défaut « ça marche et
c'est faux ».

Il faut donc un **IK Retargeter** UE5, qui reconstruit la pose. La chaîne existe
déjà dans le dépôt : `reference_retarget_batch_ue.md`
(`duplicate_and_retarget`, avec ses pièges : `SK_` ≠ `SKM_`, sortie dans `/Game`,
`CreateUniqueAssetName` qui renomme sans le dire).

---

## 5. Quadrupèdes — la consigne ne concerne presque personne

Consigne : garder leurs animations si elles existent ; ne fabriquer un corps
commun que pour ceux qui n'en ont aucune.

| | |
|---|---|
| GLB quadrupèdes | **6** |
| dont **sans aucune animation** | **1** — `pet/cat.glb` (283 os, rig Rigify complet) |

Les cinq autres (`Cow`, `aquarys_crab`, `gatonomi`, `girafe`…) ont leurs
animations embarquées : **on les garde**, rien à fabriquer. Le « corps spécial
commun » demandé ne concerne qu'un seul modèle — et pour un seul modèle, un
corps commun n'a pas de sens : soit on lui trouve des animations, soit on le
laisse statique.

---

## 6. Textures — les sources sont saines, le problème est à l'import

| | |
|---|---|
| GLB portant leurs textures embarquées | **76 / 81** |
| GLB sans aucune image | **5** |
| GLB pointant des images externes (fragile) | **0** |

Les cinq sans image, et où sont leurs originaux :

| GLB | matériaux | originaux trouvés sur disque |
|---|---:|---|
| `pnj/Tex/HumanMageRAW/SKM_HumanMage.glb` | 5 | **41 PNG** — BaseColor, Normal, ORM, Emissive, Opacity |
| `pnj/Tex/HumanMageRAW/Tex_HumanMage.glb` | 5 | idem (même dossier) |
| `pet/lizard/…/lizard.glb` | 2 | **6 PNG** dans `lizard 3d/textures/` |
| `pnj_monstre/lizard/lizard.glb` | 2 | même modèle que ci-dessus (squelette identique) |
| `pnj_monstre/mob_boss/mob_boss.glb` | **0** | aucun matériau dans le fichier |

**Rien à recréer.** Les textures existent, il faut les rebrancher.

Et le gris observé en jeu ne vient donc **pas** des fichiers source : il vient de
l'import. Le piège est déjà documenté (skill `nanos-world`, piège 4 bis) — les
textures compilent en asynchrone, et une sauvegarde unique en fin de course écrit
ce qui est prêt et **abandonne le reste, sans erreur**. Le remède connu est de
sauvegarder après chaque fichier.

Vérification restante, qui demande l'éditeur : combien de `SkeletalMesh` importés
ont réellement leurs textures aujourd'hui, et lesquels pointent le
`WorldGridMaterial` par défaut.

---

## 7. Ce que je propose de faire, dans cet ordre

Rien n'est engagé sans accord — l'étape B est irréversible sans réimport.

**A. Un `Skeleton` par empreinte, pas par fichier.** 19 au lieu de 37. Réimport
en imposant le squelette du groupe (`adk-import-narvos.py` sait déjà le faire :
c'est ce qu'il fait pour `SKEL_Mannequin`). Gain : moitié moins d'assets de
squelette, et les 130 animations du groupe des 50 deviennent partagées au lieu
d'être dupliquées.
*Sans risque : c'est un réimport, les GLB source ne bougent pas.*

**B. Le groupe des 50 vers `SKEL_Mannequin`, par IK Retargeter.** C'est le gros
gain : ils deviennent des `Character` nanos, héritent des **2 784 animations**
déjà cuites, et acceptent les pièces modulaires. Un seul retargeter à régler,
réutilisé 50 fois, parce qu'ils partagent le même rig.
*À valider sur UN modèle avant les 50 — la pose de liaison diffère de 30°.*

**C. `SetDistanceOptimizationMultiplier` sur chaque PNJ invoqué.** ✅ **FAIT le
2026-09-09.** C'est le seul point de cette liste qui agisse sur le coût
**réseau** (pas sur le tick CPU — voir la correction plus haut).

Ce qui a été posé dans `Server/Spawner.lua` :

| | |
|---|---|
| coupure d'un PNJ ordinaire | **18 000 unités** (180 m) au lieu de 26 000 |
| mannequin de test | **9 000** (90 m) — il ne prend jamais de cible et ne bouge pas |
| crabe Aquarys (×400) | **borné à 26 000** — le défaut serveur |

Les nombres sont **dérivés**, pas choisis : `IaServeur.PORTEE_MONDE = 6000`
(au-delà, un joueur n'est même pas proposé comme cible), multipliée par une
marge de 3 pour qu'un PNJ soit déjà fluide **avant** de pouvoir agir. À 6 000
unités il conserve 71 % de pertinence.

Deux garde-fous ajoutés :
- `scripts/lua-harness/distance-optim.mjs` — rejoue la formule de nanos contre
  **son propre tableau de référence, aux neuf niveaux**, puis vérifie que
  l'inversion rend bien la coupure demandée et qu'aucun multiplicateur ne
  descend sous 1 (on peut couper plus tôt que le défaut, jamais plus tard).
- `constantes-check.mjs` confronte désormais `Config.toml
  distance_optimization` et `Spawner.NIVEAU_OPTIMISATION` — l'API nanos
  n'expose pas ce réglage au Lua, la copie est inévitable, l'écart ne l'est pas.

*Détail relevé au passage : le tableau de coupures du guide arrondit au millier
supérieur (niveau 3 → formule 34 333, guide 35 000). La formule continue est la
bonne ; sans ce constat, le contrôle échoue sur deux niveaux et on croit le code
faux.*

**D. Rebrancher les textures des 5 GLB** depuis les originaux trouvés, puis
recompter les meshes gris dans l'éditeur.

**E. `pet/cat.glb`** : décider. Soit on lui emprunte les animations de `Cow`
(même convention Rigify, 46 vs 283 os — à vérifier), soit il reste décoratif.