# export/ — Tri des assets ennemis et pistes d'optimisation

Produit par `node scripts/triage-ennemis.mjs`. Rapport SEUL : rien n'a été copié
ni supprimé. `--copier` remplit `ennemis/` avec les fichiers retenus.

## 1. Ce qui a été mesuré

10 packs candidats (tags `alien` / `creature` / `zombie` du catalogue),
**68 Go** au total. Lecture des seuls en-têtes JSON des GLB — ni géométrie ni
texture décodées.

| Pack | GLB | Riggés | ≥50 % Manny | Retenus |
|---|---|---|---|---|
| ZombieSoldierPack | 425 | 425 | 420 | **291** |
| Animals_Warrior_Pack | 163 | 158 | 158 | 11 |
| Animalia | 143 | 143 | **0** | 0 |
| Dragon8 | 59 | 58 | **0** | 0 |
| AnimalsVol01 | 74 | 74 | **0** | 0 |
| animalis · VOL2_Birds · RobotGirl · 2 aliens PNJ | 50 | 28 | **0** | 0 |

**Aucun asset Halo / Covenant dans le projet** — `halo_map.glb` est une MAP.
Rien à récupérer de ce côté, et c'est préférable : ce serait de la PI 343/Bungie.

## 2. Les 6 corps d'ennemis exploitables

Tous à **161 os, 100 % de couverture Manny** — donc pilotables par les 668 GLB
d'animation du projet sans retarget.

| Fichier | Triangles | Mo |
|---|---|---|
| `SM_ZombieSoldierOfficer_UE5.glb` | 41 879 | 12,6 |
| `SM_ZombieSoldier2_UE5.glb` | 40 914 | 12,0 |
| `SM_ZombieSoldierTankman_UE5.glb` | 38 787 | 11,2 |
| `SM_ZombieSoldierWinter_UE5.glb` | 38 680 | 12,0 |
| `SM_ZombieSoldier1_UE5.glb` | 37 982 | 12,2 |
| `SM_ZombieSoldier4_FullBody_UE5.glb` | 37 935 | 14,0 |

⚠ Ces six-là sont **déjà déclarés** dans `src/rpg/npc/npcCatalog.ts` en
`role: "enemy"`. Le tri les a retrouvés par la mesure seule — il valide le
choix existant, il ne le remplace pas.

Les autres packs (Animalia, Dragon8, AnimalsVol01…) sont riggés mais sur des
squelettes ANIMAUX : 0 os commun avec Manny. Inanimables par notre
bibliothèque — et three n'en dirait rien, il ignore en silence toute piste dont
le nœud cible est absent.

## 3. L'optimisation qui compte : 40 Go de textures dupliquées

Mesuré sur ZombieSoldierPack (425 fichiers) :

| | |
|---|---|
| Poids total | **39 989 Mo** |
| dont textures | **39 365 Mo — 98,4 %** |
| géométrie + reste | **623 Mo** |
| Images | 3 417 |
| Images DISTINCTES | **249** |
| Doublons | **92,7 %** |

Une seule PNG de 28,8 Mo est répétée **228 fois** = 6,6 Go pour une image.

Le pack est modulaire : chaque pièce (botte, sacoche, chapeau) embarque le jeu
de textures COMPLET. Un sac à munitions de **252 triangles pèse 44,6 Mo**.

### Deux leviers, tous deux déjà outillés dans le dépôt

1. **Fichiers de clips portant le mesh** — `Anim_ZombieSoldier1_*.glb` font
   **64,6 Mo pièce** pour un clip, avec 30 048 triangles de mesh embarqués.
   three lie les pistes aux NŒUDS : mesh, skin et textures d'un fichier de clip
   ne sont jamais lus. `scripts/strip-anim-meshes.mjs` traite exactement ce cas
   (mesuré ailleurs : 520 Mo → 48 Mo).
2. **Déduplication + KTX2** — `scripts/assets-to-ktx2.mjs` existe. Rappel du
   skill `narvos-mesh-pipeline` : la VRAM ne dépend PAS du poids du fichier, un
   PNG 2048² fait 22 Mo décompressé sur le GPU. C'est LA cause des
   « Context Lost » observés dans les logs.

## 4. État de l'intégration

- **Jeu** : les 5 zombies sont dans `npcCatalog.ts`, avec `classId` et `role`.
- **Prototype combat** : NON. `Proto_combat/CombatPrototypeSandbox.tsx:21`
  charge un seul modèle codé en dur,
  `/models/pnj/soldat_humain/Meshy_AI_biped_Character_output.glb`.
- **Système FPS** : déjà complet — 20 fichiers dans `src/rpg/weapons/`
  (viewmodels armé/mains nues, offsets par arme, sockets, chargeurs, VFX,
  gizmo de réglage), avec tests. Rien à importer d'ailleurs.

## Fichiers

- `ennemis/triage.json` — 302 fichiers retenus, avec leurs mesures
- `ennemis/corps.json` — 150 corps distincts, accessoires et templates UE écartés

---

# 5. Déduplication faite — ZombieSoldierPack : 42 706 Mo → 2 362 Mo

`node scripts/dedupe-textures.mjs <dossier> [--write] [--out <dir>]`

Sort chaque image du binaire et la remplace par une `uri` relative vers un
fichier partagé nommé par le hash de son contenu. glTF autorise explicitement
`image.uri` dans un GLB — c'est du glTF valide, et `GLTFLoader` résout l'URI
relativement au chemin du GLB.

| | |
|---|---|
| Avant | **42 706 Mo** |
| GLB après | **623 Mo** |
| Textures partagées | **1 738 Mo** (278 fichiers) |
| **Total** | **2 362 Mo — 94,5 % de gain** |
| Durée | 48 s · 0 erreur |

## Validation

Comparaison AVANT/APRÈS via gltf-transform sur les 4 corps d'ennemis de
`npcCatalog.ts` + 6 fichiers d'animation : **nœuds, mailles, skins, os,
animations, matériaux, triangles, sommets et somme de contrôle des positions —
identiques**. `KHR_texture_basisu` et `extensionsRequired` préservés, les 26
liens texture→image valides. Les corps passent de ~12 Mo à ~3 Mo pièce.

## Ce qui reste, et qui est maintenant facile

Le pack est MIXTE : **6 fichiers en KTX2 — exactement les 6 corps d'ennemis**,
déjà convertis parce que ce sont les seuls que le runtime charge. Les **419
accessoires sont en PNG**, jamais convertis parce que jamais chargés.

Textures partagées, par format :

| Format | Fichiers | Poids |
|---|---|---|
| PNG | 167 | **1 691 Mo** |
| KTX2 | 111 | 48 Mo |

Passer les 167 PNG en KTX2 ramènerait le pack autour de **700 Mo**. Et c'est
désormais **167 fichiers à convertir au lieu de 3 417** — la déduplication a
rendu l'étape triviale.

⚠ La déduplication ne réduit PAS la VRAM par elle-même : celle-ci dépend des
DIMENSIONS de texture, pas des octets sur disque. Elle réduit le disque, le
téléchargement et le temps de parse. C'est KTX2 qui attaque la VRAM.

## Basculer — ✅ FAIT (voir §8)

Le pack allégé est désormais `ZombieSoldierPack` ; l'original de 42 Go est
conservé sous `ZombieSoldierPack_original`. Aucun code n'a été touché : la seule
vraie dépendance était **6 chemins dans `src/rpg/npc/npcCatalog.ts`** (les 3
autres fichiers citant le pack ne sont que des commentaires).

Retour arrière, symétrique :

```
mv public/models/personnages/ZombieSoldierPack          public/models/personnages/ZombieSoldierPack_dedup
mv public/models/personnages/ZombieSoldierPack_original public/models/personnages/ZombieSoldierPack
```

---

# 6. KTX2 fait — ZombieSoldierPack : 2 362 Mo → 733 Mo

`node scripts/shared-textures-to-ktx2.mjs <dossier> [--write]`

Convertit les textures PARTAGÉES posées sur le disque par l'étape 5, puis
réécrit les 425 GLB pour pointer vers les `.ktx2`.

Le script ne peut pas deviner l'espace colorimétrique depuis un fichier isolé :
une texture sortie du binaire n'a plus de matériau autour d'elle. Il reconstitue
donc la table rôle→texture en balayant les matériaux des 425 GLB **avant** de
convertir. Mesuré : 73 normal · 65 metalRough · 63 baseColor · 61 occlusion ·
7 emissive · 7 specular, **0 orpheline**, 2 ambiguës (`metalRough`+`occlusion`,
toutes deux linéaires — donc sans conflit). baseColor et emissive en sRGB, le
reste en linéaire.

| | Avant | Après |
|---|---|---|
| Textures partagées | 1 691 Mo (167 PNG) | **61 Mo** |
| _textures/ complet | 1 739 Mo | **108 Mo** |
| **Pack total** | 2 362 Mo | **733 Mo** |

**42 706 Mo → 733 Mo, soit 98,3 %.** 167/167 converties, 0 échec. 53 s.

## Validation

- 4 témoins comparés AVANT/APRÈS via gltf-transform (3 corps + 1 clip
  d'animation) : nœuds, os, animations, matériaux, textures, triangles,
  sommets, somme de contrôle des positions — **identiques**.
- Balayage des **425 GLB** : 3 417 images référencées, **0** `texture.source`
  direct restant, **3 417** déclarées en `KHR_texture_basisu`, **0** GLB sans
  `extensionsUsed`/`extensionsRequired`, **0** URI non résolue sur disque.

Un point mérite d'être noté : `texture.source` ne suffit pas pour du KTX2. La
source doit passer dans `texture.extensions.KHR_texture_basisu.source`, ET
l'extension doit figurer dans `extensionsUsed` **et** `extensionsRequired`.
Oublier l'un des trois donne un GLB qui se parse sans erreur et affiche du noir.

Effet de bord notable : `Anim_ZombieSoldier1_Attack2.glb` passe de **64,6 Mo à
1,4 Mo**. Les fichiers de clips embarquaient le jeu de textures complet pour un
mesh que three ne lit jamais (cf. §3). `strip-anim-meshes.mjs` reste pertinent
pour la géométrie, mais l'essentiel du poids vient de partir.

La bascule du §5 est **faite** — détail et vérifications en §8.

---

# 7. `export/model/` — tri des 4 projets Unreal (dont Survival)

Quatre projets, **11,3 Go**. Verdict : **aucun C++ gameplay récupérable**, mais
un jeu d'icônes utilisable et une architecture qui vaut d'être lue.

| Projet | Mo | `.uasset` | C++ propre |
|---|---|---|---|
| PirateGameTutorial | 2 532 | — | 0 |
| FPSZombieGame | 2 240 | — | 0 |
| PropHuntGameTutorial | 1 319 | — | 0 |
| SurvivalGameCourse | 4 602 | 1 061 | **0** |

## Le C++ : mesuré, pas supposé

`SurvivalGameCourse` a un `.vs/` et un `.vsconfig` avec le workload
`NativeGame` — signature d'un projet C++. Mais aucun `Source/` n'est présent.
L'index Copilot de Visual Studio (`.vs/…/CopilotIndices/CodeChunks.db`, 425 Mo)
donne la réponse par la mesure : **31 374 fichiers indexés**, dont

- **31 326** = source Unreal Engine 5.4 (code Epic — hors sujet, et hors droit)
- **48** = tout le C++ du projet, et ce sont **uniquement** les plugins
  `AdvancedSessions` / `AdvancedSteamSessions`

Ces plugins font des sessions Steam, listes d'amis, voix et workshop, via
OnlineSubsystem. Inutilisables pour un client web three.js — NARVOS passe par
MySQL/SQLite en IPC Electron. **La logique du jeu est donc 100 % Blueprint**,
sans module C++ gameplay.

⚠ `better-sqlite3` du dépôt est compilé pour Electron (ABI 140) et refuse de se
charger dans Node (ABI 137). Ne PAS le reconstruire : ça casserait le build
Electron. Le module `node:sqlite` intégré à Node 24 lit ces bases sans rien
installer.

## Ce qui a été récupéré : 432 icônes de craft

`node scripts/import-craft-icons.mjs --write`

| | |
|---|---|
| Source | 432 PNG 256×256, 420 avec alpha — **26 Mo** |
| Doublons exacts | **0** (les variantes `_b` sont du vrai art distinct) |
| Sortie | `public/textures/icons/craft/` — 432 WebP, **4 Mo** (84,8 %) |

18 catégories × 24 variantes : `spare_parts`, `ingots`, `gemstone`, `tools`,
`container`, `recipes`, `reagent`, `cloth`, `strings`, `wood`, `stone`, `bone`,
`meat`, `leather`, `herbs`, `mushrooms`, `seeds`, `feather`.

**WebP et non KTX2** : ces icônes sont de l'UI, affichées en `<img>` / canvas 2D
et jamais échantillonnées par le GPU. KTX2 ne gagnerait aucune VRAM et rendrait
le fichier illisible par une balise `<img>`.

**`public/textures/icons/` et non `public/textures/objet/`** :
`generate-assets-manifest.cjs` ne scanne que 7 catégories nommées
(`personnage`, `monstres`, `objet`, `spells`, `sprites`, `ui`, `decor`). Un
dossier `icons` reste donc hors `assets-manifest.json` — pas 432 entrées que
personne ne consomme — tout en étant vu par `build-texture-index.mjs`, donc
navigable dans le TextureBrowser.

⚠ **Non branché.** Dans `src/rpg/`, le champ `icon` de `ItemDefinition`,
`LootRegistry`, `equipmentSlots`, `petSummons` et `professionTypes` contient
aujourd'hui des **emoji** (`icon: "⚔️"`, `"🛡️"`…). Passer aux images demande de
décider si `icon` accepte un chemin en plus d'un emoji, et de prévoir le repli.
C'est un choix de conception, pas une conversion — laissé ouvert.

## L'architecture survie, lisible sans Unreal

`.vs/SurvivalGameCourse/BlueprintCache/SurvivalGameCourse.json` (234 Ko) indexe
les **277 Blueprints** avec leur classe parente et leurs propriétés. C'est le
seul moyen de lire cette conception : les `.uasset` sont binaires.

- **23 interfaces** — le contrat : `BPI_Interactable`, `BPI_BuildInterface`,
  `BPI_StructureDamage`, `BPI_GroundItem`, `BPI_EquipableItem`, `BPI_Zone`,
  `BPI_Water`, `BPI_TribeSaveGame`, `BPI_StructuresSaveGame`…
- **Construction** : un `BP_BuildableMaster` → 19 types de pièces →
  **3 paliers (Wood/Stone/Metal) × 17 pièces identiques**. Le palier est une
  reskin, pas une hiérarchie parallèle.
- **Récolte** : arbres et rochers en `ChildClasses` + `Destructables` appariés.
- **Reste** : inventaire, craft, tribus, zones procédurales, 4 `SaveGame`.

Rien à importer — mais le découpage interfaces d'abord, un maître par famille,
paliers en reskin est directement transposable aux systèmes NARVOS.


---

# 8. Bascule faite — le pack allégé est en place

```
ZombieSoldierPack            733 Mo   <- ex-_dedup, servi au jeu
ZombieSoldierPack_original 42 706 Mo   <- intact, conservé
```

Aucun fichier supprimé, aucun code modifié. Deux `mv`, réversibles par les deux
`mv` inverses (§5).

## Vérifications passées

**Avant** de renommer : les 6 `modelPath` de `npcCatalog.ts` présents dans le
dossier dédupliqué — 6/6.

**Après**, chargement réel des 6 corps via gltf-transform depuis le nouveau
chemin : **6/6**, toutes textures résolues depuis le disque (0 vide), **100 %
en KTX2**, 161 os chacun, triangles inchangés (37 935 à 41 879).

**Service HTTP réel** (`npm run dev`, port 3005) — c'est la vérification qui
comptait. Les textures ne sont plus embarquées : `GLTFLoader` doit maintenant
les chercher par URI relative, et ce dépôt s'est déjà fait piéger par le repli
SPA de Vite (un fichier manquant renvoie `text/html` en **200**, jamais un 404 —
cf. `assetExists` / `AudioManager` dans CLAUDE.md). Une URI fausse serait donc
passée pour un succès.

Mesuré : le GLB sort en `model/gltf-binary`, les 6 textures échantillonnées en
`image/ktx2`, **0 réponse `text/html`**. Vite sert `_textures/` sans réglage
particulier, et le préfixe `_` ne gêne ni le dev server ni la copie vers `dist`.

⚠ Reste non vérifié : le **rendu à l'écran**. Les 6 corps étaient déjà en KTX2
avant la bascule (seuls fichiers chargés par le runtime, donc seuls convertis) —
le format ne change donc pas pour le jeu, seul le mode de transport des textures
change (embarqué → URI externe). Rappel : `KTX2Loader` exige
`detectSupport(renderer)`, d'où `<RendererRegistrar />` dans chaque `<Canvas>`.
Le volet navigateur n'exécute aucune frame ici (mémoire
`reference_verifier_la_3d`) — à confirmer en jeu.