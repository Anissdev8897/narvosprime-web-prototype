# Import animaux + bâtiments — préparation (2026-09-06)

Import **non lancé** : un `UnrealEditor-Cmd.exe` tourne déjà (PID 3368, 9,8 Go de
RSS, relevé par `tasklist`). Deux commandlets sur le même projet se verrouillent
le DDC. Tout ce qui suit est prêt ; il ne reste qu'à lancer.

Les deux manifestes sont écrits et **validés fichier par fichier** :

| manifeste | fichiers | poids source | destination |
|---|---|---|---|
| `WebPortal/Server/adk/_manifests/animaux.json`   | 183 | **7 336 Mo** | `/Game/Narvos/creatures/…`, `/Game/Narvos/pnj_monstre/…` |
| `WebPortal/Server/adk/_manifests/batiments.json` | 183 | **1 014 Mo** | `/Game/Narvos/environnements/…` |

---

## 1. Ce que j'ai réutilisé, et la seule chose que j'ai modifiée

La chaîne existait. Je n'ai rien réécrit :

- **`scripts/narvos-manifeste-brut.mjs`** produit le manifeste sans contrôle de
  squelette — exactement le cas des créatures. C'est lui que j'ai étendu.
- **`scripts/adk-import-narvos.py`** le consomme. Lu ligne à ligne pour en tirer
  le format et les variables d'environnement (§5) plutôt que de les supposer.
- `narvos-skeleton-compat.mjs` a été **écarté volontairement** : son mode `--json`
  ne retient que `IDENTIQUE / SUR-ENSEMBLE / IK SEULS`. Les créatures ont 31 à
  105 os et aucun nom commun avec le Mannequin — il aurait rendu un manifeste
  **vide**. C'est le bon outil pour un personnage, pas pour un animal.

### Les quatre modifications de `narvos-manifeste-brut.mjs`

1. **Plusieurs cibles** au lieu d'une. Le lot s'étale sur `creatures/` **et**
   `pnj_monstre/`, qui ne se touchent pas. Un seul appel est la seule façon
   d'obtenir une racine commune.
2. **`--racine <dossier>`.** Le script posait `racine = la cible`. Avec deux
   cibles disjointes, il aurait fallu deux manifestes, donc deux racines, donc
   deux arbres qui s'écrasent sous `/Game/Narvos/`.
3. **`--exclure <regex>`**, employé ici pour les LOD (§4).
4. **Le filtre d'extensions, qui était incomplet.**

Le point 4 est une correction, pas un ajout. Le filtre ne connaissait que
`KHR_texture_basisu`. Or la règle n'est pas « le KTX2 pose problème » mais, selon
la spec glTF, « une extension listée dans `extensionsRequired` engage le lecteur :
il DOIT la comprendre ou refuser le document **entier** ». Mesuré aujourd'hui :

```
pnj_monstre/aquarys_crab/…withSkin.glb   extensionsRequired = EXT_texture_webp
```

Ce fichier **passait** le filtre, figurait comme importable dans
`_manifests/pnj-monstre.json`, et Interchange le refusait en bloc. Le dépôt
contient déjà le contournement (`adk/_textures_png/` + `pnj-monstre-png.json`),
qui traite le symptôme sans corriger le garde-fou. La liste est désormais celle
de `narvos-textures-vers-png.mjs` — l'outil qui les répare :
`KHR_texture_basisu`, `EXT_texture_webp`, `EXT_texture_avif`.

Le filtre corrigé a immédiatement attrapé 2 fichiers sur les 13 packs (§3).

`node scripts/lua-harness/syntaxe-check.mjs` : **47 générateurs compilent**.

---

## 2. GLB par pack, poids, et la décision de budget

État actuel mesuré : **`adk/Content/Narvos` 38 Go** (les `.uasset` importés) →
**`Server/Assets/narvos` 34,5 Go / 123 495 fichiers** (le pack cuit).

### `animaux.json` — 183 fichiers, 7 336 Mo

| pack | GLB | Mo | os | fichiers animés | clips | images |
|---|---:|---:|---:|---:|---:|---:|
| **creatures/Tiger_M** | **133** | **7 323** | 105 | 127 | 127 | 657 |
| creatures/Lion_M | 8 | 4 | 53 | 0 | 0 | 24 |
| creatures/Buffalo | 6 | 1 | 38/39 | 0 | 0 | 0 |
| creatures/Bear | 5 | 1 | 36 | 0 | 0 | 0 |
| creatures/Wolf | 5 | 1 | 42 | 0 | 0 | 0 |
| creatures/Deer | 5 | 1 | 37 | 0 | 0 | 0 |
| creatures/Fox | 5 | 1 | 39 | 0 | 0 | 0 |
| creatures/Rat | 5 | 1 | 41 | 0 | 0 | 0 |
| creatures/Spider | 5 | 1 | 31 | 0 | 0 | 0 |
| creatures/Raccoon | 5 | 1 | 37/42 | 1 | 1 | 0 |
| pnj_monstre/dog | 1 | 0,09 | 48 | 1 | 1 | 1 |

**Tiger_M pèse 7 323 Mo des 7 336. Les dix autres animaux réunis font 13 Mo.**

Ce n'est pas de la géométrie. Ses 127 GLB d'animation embarquent chacun ~5
textures d'aperçu — la *même* texture, recopiée 127 fois. Mesuré en dégraissant
un fichier réel avec `scripts/narvos-degraisser-anim.mjs` :

```
Tiger_M/Animations/Stand_01.glb    57,5 Mo -> 2,8 Mo   (5 textures, 3 matériaux retirés)
```

Extrapolé aux 127 fichiers (**un seul a été mesuré**, les 126 autres ont des
tailles voisines, 54–57,5 Mo) :

| | animations | Tiger_M entier |
|---|---:|---:|
| tel quel | 7 091 Mo | 7 323 Mo |
| dégraissé | ~356 Mo | **~588 Mo** |

**~6,7 Go économisés sur un pack qui en fait 34,5.** Une animation n'a pas de
texture à porter : le dégraissage ne retire rien d'utile. C'est la seule décision
de budget réelle du lot, et je ne l'ai pas prise à votre place — le manifeste
contient Tiger_M **tel quel**. Commande au §5.

### `batiments.json` — 183 fichiers, 1 014 Mo

| pack | GLB | Mo | images | os |
|---|---:|---:|---:|---:|
| environnements/High_Tech_Base | 103 | 576 | 334 | 0 |
| environnements/SciFi_Space_Station | 80 | 438 | 324 | 0 |

Rien à arbitrer ici : aucune extension bloquante, textures embarquées, 0 os
partout. Le compte correspond à vos « ~103 » et « ~80 ».

**Aucun risque d'explosion d'assets.** Vérifié sur les 5 plus gros fichiers :
`nodes=1, meshes=1`. Un GLB donnera **un** StaticMesh. Le désastre de la Forge
(12 987 StaticMesh depuis un GLB) venait de fichiers à milliers de nœuds ;
`NARVOS_COMBINE` est donc **inutile** ici.

À savoir : les 4 `Reference_Models/SM_Reference_Plane|Sphere` (0,2 Mo pièce) sont
des repères d'échelle, pas des bâtiments. Je les ai laissés — ils font 1 Mo en
tout — mais ils sont bons à supprimer après import.

---

## 3. KTX2 et jumeaux `_original` : la question ne se pose presque pas

**Aucun des 13 packs n'a de jumeau `_original`.** Vérifié sur disque : le seul
`_original` de tout `public/models/` est `personnages/ZombieSoldierPack_original`,
conforme à ce que dit `CLAUDE.md`.

Ce n'est pas grave, parce que **le KTX2 n'est presque pas là**. Sur 423 GLB
sondés (240 créatures + 183 bâtiments), 2 fichiers seulement portent une
extension bloquante :

| fichier | extension requise | recours |
|---|---|---|
| `pnj_monstre/aquarys_crab/…withSkin.glb` | `EXT_texture_webp` | **oui** — `adk/_textures_png/` existe déjà, et l'asset est **déjà importé** |
| `pnj_monstre/lion/PSX_lion.glb` | `KHR_texture_basisu` | **aucun** |

Les deux sont écartés par le manifeste, nommés à l'écran, jamais avalés.

**`lion` est le seul vrai perdant du lot.** Pas d'`_original`, pas d'autre source
sur le disque (recherche `*lion*.glb` : uniquement `creatures/Lion_M`, qui est un
pack différent), et `narvos-textures-vers-png.mjs` ne peut rien pour lui — son
en-tête le dit : le décodeur du KTX2 est Basis, que `sharp` n'embarque pas. Le
seul `ktx-parse` présent dans `node_modules` lit le conteneur, il ne décode pas
les pixels. **`pnj_monstre/lion` ne sera pas importé.**

État des 3 cibles `pnj_monstre`, relevé dans `adk/Content/Narvos/pnj_monstre/` :

- `aquarys_crab` — **déjà importé** (6 assets)
- `dog` — **déjà importé** (6 assets) ; laissé au manifeste, l'import le sautera
- `lion` — **absent**, et le restera

---

## 4. Le problème qui compte vraiment : ces packs sont des packs FBX

C'est la découverte la plus lourde de conséquences, et elle n'a rien à voir avec
le KTX2.

**Huit des dix packs d'animaux sont livrés en FBX. Les GLB n'en sont qu'une
conversion partielle : sans textures et sans animations.**

Mesuré, `creatures/Bear` :

```
100 FBX  (dont 90 animations, 45 Mo)   9 PNG (52 Mo)   9 GLB (2 Mo)
SK-Bear.glb : images=0  textures=0  animations=0  materials=["Bear"]
```

Idem pour Wolf, Deer, Buffalo, Raccoon, Rat, Fox, Spider — colonnes `images` et
`clips` à **0** dans le tableau du §2. Au total **621 animations FBX** (280 Mo)
que le manifeste GLB laisse au sol :

| pack | animations FBX | pack | animations FBX |
|---|---:|---|---:|
| Bear | 90 | Raccoon | 81 |
| Wolf | 81 | Rat | 80 |
| Deer | 73 | Fox | 78 |
| Buffalo | 67 | Spider | 71 |

Autrement dit : **l'import GLB donnera huit animaux gris et immobiles.** Le
symptôme est exactement celui des « personnages gris » déjà payé sur ce projet,
mais la cause est autre — ici la texture n'a jamais été dans le GLB. Aucun
réglage d'Interchange n'y changera quoi que ce soit.

Deux packs échappent à ça : `Lion_M` (24 images embarquées) et `Tiger_M`
(657 images, 127 clips) n'ont **aucun** FBX et sont complets en GLB.

**Ce que je n'ai pas fait, et pourquoi.** Vous avez demandé des manifestes GLB :
ils sont livrés, corrects, et importeront ce qu'ils contiennent. Basculer sur le
FBX est un choix qui vous revient. Le chemin est court si vous le voulez :
`adk-import-narvos.py` ne filtre **pas** l'extension en mode manifeste (il lit
`[e["fichier"] for e in donnees["fichiers"]]` tel quel), et
`narvos-manifeste-brut.mjs` ne collecte que `.glb`/`.gltf` — il faudrait donc
élargir sa collecte au `.fbx`. Je n'ai **pas vérifié** que l'Interchange de cette
installation lit le FBX en commandlet (§7).

---

## 5. Les commandes exactes

Éditeur **fermé** — vérifié par le script lui-même. Depuis
`E:/narvosprime-web-prototype`.

### Bâtiments — StaticMesh

```bash
UE="D:/Epic Games/UE_5.7/Engine/Binaries/Win64/UnrealEditor-Cmd.exe"
ADK="E:/narvosprime-web-prototype/WebPortal/Server/adk/NanosWorldADK.uproject"
RACINE="E:/narvosprime-web-prototype"

NARVOS_MANIFEST="$RACINE/WebPortal/Server/adk/_manifests/batiments.json" \
NARVOS_SANS_SQUELETTE=1 \
NARVOS_STATIC=1 \
"$UE" "$ADK" -run=pythonscript \
  -script="$RACINE/scripts/adk-import-narvos.py" \
  -unattended -nosplash
```

### Créatures — SkeletalMesh

```bash
NARVOS_MANIFEST="$RACINE/WebPortal/Server/adk/_manifests/animaux.json" \
NARVOS_SANS_SQUELETTE=1 \
"$UE" "$ADK" -run=pythonscript \
  -script="$RACINE/scripts/adk-import-narvos.py" \
  -unattended -nosplash
```

**Lire le résultat** — `journal()` passe par `unreal.log`, donc rien d'utile ne
sort sur stdout :

```bash
grep "NARVOS" "$RACINE/WebPortal/Server/adk/Saved/Logs/NanosWorldADK.log" \
  | sed 's/.*\[NARVOS\] /  /' | tail -40
```

### Les variables, lues dans le code (pas devinées)

| variable | effet dans `adk-import-narvos.py` | ici |
|---|---|---|
| `NARVOS_MANIFEST` | active le mode manifeste ; met `DESTINATION = /Game/Narvos` | **obligatoire** |
| `NARVOS_SANS_SQUELETTE=1` | n'impose aucun squelette ; Interchange en crée un par fichier | **obligatoire** pour les créatures |
| `NARVOS_STATIC=1` | `import_skeletal_meshes=False` + `import_static_meshes=True` | **bâtiments** |
| `NARVOS_COMBINE=1` | `combine_static_meshes=True` | **à ne pas mettre** (§2) |
| `NARVOS_PACK` | ignoré en mode manifeste | — |

`NARVOS_SANS_SQUELETTE=1` sur les créatures n'est pas une commodité : leurs os
(31 à 105) ne portent aucun nom du Mannequin. Leur imposer `SKEL_Mannequin` ne
les retargete pas — Interchange apparie par nom, n'en reconnaît aucun, et les
sommets pendent à la racine. Elles seront jouées par **`CharacterSimple`**, qui
n'impose aucun squelette, jamais par `Character`.

Pour les bâtiments, `NARVOS_STATIC=1` est ce qui décide ; `NARVOS_SANS_SQUELETTE=1`
l'accompagne parce que c'est le couple déjà employé par
`scripts/narvos-chaine-cheveux.sh` et que ça évite de dépendre de la présence de
`SKEL_Mannequin`.

### Option : dégraisser Tiger_M avant import (~6,7 Go de moins)

```bash
node scripts/narvos-degraisser-anim.mjs \
  WebPortal/public/models/creatures/Tiger_M/Animations \
  WebPortal/public/models/creatures/Tiger_M/Animations_degraissees --apply
```

Puis régénérer le manifeste en visant le dossier dégraissé. Le script refuse tout
GLB sans animation — un mesh ne peut pas être dégraissé par erreur.

### Régénérer les manifestes

```bash
export MSYS_NO_PATHCONV=1      # sinon Git Bash réécrit "(^|/)LODs/" en chemin Windows
R="E:/narvosprime-web-prototype/WebPortal/public/models"

node scripts/narvos-manifeste-brut.mjs \
  "$R/creatures/Bear" "$R/creatures/Wolf" "$R/creatures/Deer" "$R/creatures/Buffalo" \
  "$R/creatures/Raccoon" "$R/creatures/Rat" "$R/creatures/Fox" "$R/creatures/Spider" \
  "$R/creatures/Lion_M" "$R/creatures/Tiger_M" \
  "$R/pnj_monstre/aquarys_crab" "$R/pnj_monstre/dog" "$R/pnj_monstre/lion" \
  animaux --racine "$R" --exclure "(^|/)LODs/"

node scripts/narvos-manifeste-brut.mjs \
  "$R/environnements/High_Tech_Base" "$R/environnements/SciFi_Space_Station" \
  batiments --racine "$R"
```

Le `MSYS_NO_PATHCONV=1` n'est pas décoratif : sans lui, `--exclure` a été reçu
comme `(^|C:/Program Files/Git/)LODs/` et **0 LOD a été exclu**, en silence, avec
un manifeste qui avait l'air bon.

---

## 6. Les LOD, écartés

`--exclure "(^|/)LODs/"` retire **55 fichiers, 393 Mo**.

Un `SK-Bear_LOD1.glb` importé seul ne devient pas le LOD 1 de `SK-Bear` : il
devient un SkeletalMesh autonome nommé `SK-Bear_LOD1`, que rien ne référence.
Cinquante-cinq assets morts à cuire. Unreal construit ses LOD lui-même.

Pour les réintégrer, retirer `--exclure` de la commande ci-dessus.

---

## 7. Ce que je n'ai pas pu vérifier

- **Le poids au cook.** Trois grandeurs mesurées, et le maillon qui manque est
  justement celui qu'il faudrait :

  | étape | mesuré |
  |---|---|
  | source GLB à importer | 7 336 Mo (animaux) + 1 014 Mo (bâtiments) |
  | `adk/Content/Narvos` (les `.uasset` importés) | **38 Go** |
  | `Server/Assets/narvos` (le pack cuit) | **35 Go** |

  On peut donc dire que, sur le contenu déjà en place, **le cook rend environ
  0,92 × le poids des `.uasset`** — il ne gonfle pas. Mais ce ratio part de
  l'`.uasset`, pas du GLB. Le multiplicateur **GLB → `.uasset`** n'est pas
  mesuré, et c'est lui qui décide : Unreal décode les PNG/JPEG du GLB et les
  recuit en BC/DXT non compressé au repos, ce qui gonfle typiquement une texture
  bien au-delà de son poids de fichier. C'est la leçon déjà payée sur ce projet
  (`Wraith.glb` : 832 Mo de VRAM pour un fichier bien plus léger).

  **Ne prenez donc pas « +8,3 Go au cook » pour un chiffre mesuré — il ne l'est
  pas, et il est probablement sous-estimé.** Le seul moyen de le savoir est
  d'importer puis de cuire, et de remesurer ces deux dossiers.
- **Que l'import réussisse.** Rien n'a été lancé : un Unreal occupe le projet.
  Les manifestes sont validés (clé `racine` présente et existante, 366 chemins
  absolus, 366 fichiers présents sur le disque, aucun `..`, aucune collision de
  destination) — mais valider un manifeste n'est pas importer.
- **Que l'Interchange de cette installation lise le FBX** en commandlet (§4). Je
  n'ai pas ouvert `Engine/Plugins/Interchange` pour le confirmer, et je ne
  l'affirme donc pas.
- **Le dégraissage de Tiger_M à l'échelle.** Un seul fichier mesuré
  (57,5 → 2,8 Mo). Les ~356 Mo projetés sont une extrapolation.
- **L'aspect en jeu.** Prédire « gris » depuis `images=0` est solide, mais je ne
  l'ai pas vu à l'écran — et sur ce projet, c'est précisément ce qui a déjà
  trompé plusieurs fois.

---

## Fichiers touchés

| fichier | quoi |
|---|---|
| `scripts/narvos-manifeste-brut.mjs` | **modifié** — multi-cibles, `--racine`, `--exclure`, filtre d'extensions corrigé |
| `WebPortal/Server/adk/_manifests/animaux.json` | **créé** — 183 fichiers ⚠ *réécrit depuis par un autre agent, voir §8* |
| `WebPortal/Server/adk/_manifests/batiments.json` | **créé** — 183 fichiers |

Rien écrit sous `adk/Content/`. Aucun `.lua` touché, `Shared/Index.lua` compris.

---

## 8. ⚠ `animaux.json` a été réécrit par un autre agent (18:40:41)

**Ceci n'est pas mon travail et je ne l'ai pas défait.** À arbitrer par vous.

Chronologie relevée sur l'horodatage des fichiers :

| heure | fichier | taille | contenu |
|---|---|---|---|
| 18:31:14 | `animaux.json` (le mien) | 33 982 o | **183** fichiers, 11 packs |
| 18:40:41.826 | `animaux.json` (réécrit) | 25 775 o | **141** fichiers, 2 packs |
| 18:40:41.853 | `animaux-fbx-A-FAIRE.json` (nouveau) | 1 582 o | fiche des 8 packs retirés |

Un autre agent a **retiré 42 entrées** d'`animaux.json` : les 8 packs FBX
(Bear, Wolf, Deer, Buffalo, Raccoon, Rat, Fox, Spider) **et** `pnj_monstre/dog`.
Il ne reste que `Lion_M` (8) et `Tiger_M` (133).

Sur le fond, il est arrivé au même constat que le §4, avec les mêmes chiffres au
fichier près (100/90/83/82/91/89/87/81 FBX). Le raisonnement se tient : ces GLB
n'importeraient que des coquilles grises. Mais trois défauts sont à corriger
avant de s'en servir.

### a. Le manifeste est devenu incohérent avec lui-même

```
"total_analyses": 185,  "importables": 183,  "ecartes_ktx2": 2
"fichiers": [ … 141 entrées … ]
```

Les compteurs n'ont pas suivi le tableau. L'import lui-même ne s'en soucie pas —
`adk-import-narvos.py` journalise `len(fichiers)`, donc la vraie valeur — mais
tout humain qui relit ce fichier lira **183** et en importera **141**. C'est
exactement la forme de défaut qui coûte un diagnostic à l'aveugle.

### b. `pnj_monstre/dog` a été retiré sans raison

`dog` n'est pas un pack FBX : 1 GLB, 48 os, 1 clip d'animation, 1 texture
embarquée, **aucun** FBX à côté. Le motif invoqué ne s'y applique pas. Il est
retombé avec les autres. (Sans conséquence pratique : il est **déjà importé**,
l'import l'aurait sauté — mais la liste ne dit plus la vérité sur son contenu.)

### c. L'instruction `a_changer` est fausse — vérifié

`animaux-fbx-A-FAIRE.json` demande :

> `adk-import-narvos.py:100 — accepter .fbx en plus de .glb`

**Ce n'est pas nécessaire, et ce serait modifier le mauvais fichier.** La ligne
100 est à l'intérieur de `collecter()`, qui n'est appelée que dans la branche
`else` — le mode « un pack ». En mode manifeste, ligne 125 :

```python
fichiers = [e["fichier"] for e in donnees["fichiers"]]
```

Aucun filtre d'extension. **Un manifeste peut déjà contenir des `.fbx`
aujourd'hui, sans toucher au Python.** Le filtre `.glb`/`.gltf` qui bloque
réellement est dans `collecter()` de `narvos-manifeste-brut.mjs` — c'est *là*
qu'il faudrait élargir, comme le disait le §4.

En revanche sa seconde remarque est juste et complète la mienne : le piège FBX
connu du dépôt concerne l'**export** d'un SkeletalMesh, qui est un autre chemin
de code que l'import. Ni lui ni moi n'avons mesuré l'import FBX en commandlet.

### Pour restaurer le manifeste complet à 183 fichiers

La commande du §5 le régénère à l'identique. `animaux-fbx-A-FAIRE.json` peut
être conservé tel quel : c'est une fiche de suivi, pas un manifeste — son propre
en-tête le dit.