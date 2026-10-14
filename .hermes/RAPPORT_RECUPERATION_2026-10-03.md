# Récupération du projet — état au 03/10/2026 (nuit du 02 au 03)

Suite des rapports du 01/10 et du 02/10 (`RAPPORT_RECUPERATION_2026-10-02.md`). Le
projet est toujours à un seul endroit : `E:\narvosprime-web-prototype`. Les outils et
leur mode d'emploi sont dans `scripts\recuperation\README.md`.

## 0. Mise à jour du matin (03/10, 10 h) — à lire avant le reste

Le projet a été réassemblé une seconde fois à 09 h 56 (sauvegardes :
`E:\mes_projet\_avant_reassemblage_2026-10-03_09h56`). Les chiffres des sections
suivantes datent de la nuit ; ceux-ci les remplacent :

| | nuit (00 h 30) | matin (09 h 56) |
|---|---|---|
| `scripts\` complets | 374 sur 394 | **376 sur 394** |
| batterie | 85 verts, 22 rouges, 11 626 assertions | **87 verts, 20 rouges, 11 745 assertions** (`creation`, `sorts-vfx-check` au vert) |
| historiques SEULS, web | 820 identiques, 36 complets mais différents | **828**, 30 |
| historiques SEULS, Lua | 125 identiques, 3 complets mais différents | **130**, 1 |
| preuves des outils | 348 assertions | 387 |
| journaux du jeu | 0 faux | 0 faux, 108 messages sur 108 |

Ce qui a changé dans les outils (détail et tests : `scripts\recuperation\README.md`) :

- **un segment inconnu n'emporte plus la commande** : 21 457 commandes sur 30 904
  étaient jetées en entier pour un `ls` ou un `node x.mjs` au milieu de lectures
  séparées par des `echo`. +1 581 commandes alignées, +32 663 lignes lues ;
- `$(…)` rend un mot insoluble, pas la commande illisible ; lectures « flottantes »
  (plage courte en tête de sortie) calées contre le fichier ou ignorées ;
- **contamination entre projets corrigée** : un chemin relatif était replié sur la
  racine de NARVOS même quand la commande tournait dans un autre projet — notre
  `.env.example` portait des lignes de `goldluxuryking-shop` ;
- le bac Node reçoit l'environnement stable de la machine (plus de fichier fantôme
  `undefined\…`).

Pistes ouvertes, non traitées : 20 commandes PowerShell qui modifient des fichiers en
place (`[regex]::Replace` puis `WriteAllText`, fichiers web déjà couverts par DMDE) ;
les `cat > f <<FIN` sans guillemets (sonde écrite, résultat non vérifié).

## 0 bis. Reprise de l'après-midi (03/10) — les gardes « du vrai code »

Batterie : **90 verts, 17 rouges, 11 750 assertions** (`E:\mes_projet\BATTERIE_12_reprise_2026-10-03.txt`).
Fichiers d'avant : `E:\mes_projet\_avant_reprise_2026-10-03`.

| garde | cause | ce qui a été fait |
|---|---|---|
| `menottes-cablage-check` | vrai défaut : `Server/Dash.lua:127` et `Server/Traversee.lua:299` refusent `esquive` / `traversee`, absentes de `Menottes.CAPACITES` — `Refuse` rendait false, le menotté esquivait et escaladait | les deux capacités ajoutées à `Shared/Logic/Menottes.lua` (s'écarte donc du cache client d'une ligne) |
| `z-absolu-check` | faux positif : `Client/Traversee.lua:164`, Z = `pieds_z - 40`, relatif au personnage | exception déclarée dans `TOLERES` |
| `zaaps-serveur` | test périmé : attendait « Zaap Zaap du port », que `Zaaps.Libelle` (cache, état final) interdit exprès | attente corrigée |
| `roster` | NON TOUCHÉ : `roster-tests.lua` est une ancienne version (263 lignes d'ancienne version) ; il cherche un torse de famille `metahuman` (aucune pièce au catalogue final) et une « tenue offerte » que la décision du 14/09 (aucun vêtement d'office) contredit | à réécrire quand la règle voulue est confirmée |

Les 16 autres rouges : pack cuit / ADK (9), harnais ou générateurs troués (7).

## 0 ter. Soir du 03/10 — l'ADK n'est rendu qu'à 60 %, et rien de cuit n'a survécu

Décision de Hanibes : recuire le pack. En préparant le cook, chaque « copie » annoncée plus
haut a été SONDÉE (octets lus, pas seulement les noms). Ce qui suit corrige les §4, §5 et le
bloqueur n° 2 de `AUDIT_REFONTE_2026-10-03.md`.

**Les lots ont changé de place.** `E:\mes_projet` a été déplacé dans le projet vers 15 h 10 :
`E:\narvosprime-web-prototype\mes_projet\`. Les six jonctions pointaient dans le vide ; elles
sont repointées, `lots.py` prend l'emplacement qui existe, et le dossier est exclu de git
(`.git/info/exclude`) — il pèse 1,2 To et contient des identifiants récupérés.
`assembler-final.py --ecrire` et `ecarter-orphelins.py --ecrire` refusent désormais de tourner
sur le dépôt vivant, et ne prennent plus les lots pour des orphelins.

**Ce que DMDE a rendu de l'ADK.**

| quoi | état mesuré | preuve |
|---|---|---|
| sources `adk\Content` (1re passe) | 67 377 paquets, 80,9 Go, **0 en-tête malade** | marque `C1 83 2A 9E` lue sur chacun |
| … mais incomplètes | **55 225 paquets de `/Game/Narvos` présents sur 91 438** (inventaire du 23/09) | la copie s'est arrêtée en plein `Narvos\Orbital\chunks_png` : tout dossier avant `Orbital` est à 100 %, tout dossier après à 0 % |
| jamais copiés | `personnages`, `pnj` (329), `pnj_monstre` (142), `PontMetaHuman` (27), `Sewer`, `Shared`, `SpaceScenes`, `stylized_modular`, `tower_map` (28 647), `UI`, `Valkiria`, `VFX`, `Weapon`, `WW100IdleAnimPack`, `ZombieSoldierPack_original`…, `Map_Narvos`, `Map_Alien` ; et tout `Server\` hors `adk` (`Assets` = le pack, `AssetBuilds`, `AssetBackups`, `nanos_world`), `adk\Saved`, `Plugins`, `DerivedDataCache` | dossiers présents et vides |
| 2e passe (`Nouveau dossier\$F…`, `recup_dir.1`, `scripts-astra\$F00010`) | noms, tailles, dates justes ; **contenu faux à 99 %** | cook du 26/09 : 41 744 `.uasset` sur 41 994 sans la marque ; `$F09232` (= les dossiers manquants de Narvos) : 35 122 sur 35 222 ; sauvegardes d'Astra : tous les `.lua`, `.ini`, `.uasset`, `.umap` illisibles |
| pourquoi | ces clusters avaient été recouverts par la copie des lots sur E: (30/09, 19 h) avant la 2e passe | on lit, DANS ces fichiers, les en-têtes de paquets des lots en ordre alphabétique (`…/CITY_PACK/INTERIORS/LIBRARY/TEXTURES/T_S…`, `…/Hypernova/…/MF_…`) |

Donc : **aucune copie du pack cuit, du cook du 26/09, des sauvegardes d'Astra ni des cartes
`Map_Narvos` / `Map_Alien` n'est utilisable**, et le disque n'a plus rien à rendre. Seuls les
fichiers de moins de ~700 octets de ces lots sont justes (ils vivent dans la fiche MFT).

**Ce qui a été refait.**

- `adk\Config\DefaultEngine.ini` (absent du lot) : rebâti par `scripts/recuperation/rebatir-ini-moteur.py`
  — vrai fichier du 06/09 (115 lignes jamais relues comblées, trou par trou, entre deux lignes
  connues), reconstitution des historiques (état du 13/09 + édition du 23/09), **85 lignes lues
  par Codex le 15/09 retrouvées à leur numéro, 0 écart**. Les 201 redirects exacts qu'Astra avait
  ajoutés par script (données perdues) sont remplacés par 1 169 redirects régénérés depuis le
  disque par sa règle. 7 lignes d'un commentaire restent inconnues (notées dans le fichier).
  Gardes : `redirects-idempotents-check` 50/50, `rendu-client-check` 14 réglages / 0 écart.
- `NanosWorldADK.uproject` : plugin `UnrealMCPServer` (perdu) désactivé ; copie `.avant-recook-2026-10-03`.
- `_assets-inventory.json` du 23/09 (seule liste complète des 92 015 assets) : copié en
  `_assets-inventory.2026-09-23.avant-recook.json` avant que la chaîne de cook ne le réécrive.
- Le DDC d'Unreal a survécu hors de E: (`C:\Users\aniss\AppData\Local\UnrealEngine\Common\Zen`, 49 Go).

**Le cook.** Lancé le 03/10 à 17 h 40 sur ce qui existe : 67 812 paquets à cuire. Parmi les
paquets présents, 1 160 seulement citent un paquet absent (1 147 meshes d'`Orbital` sans
matériau, `Map_Orbital` sans 57 paquets de `SpaceScenes`) et aucune animation n'a perdu son
squelette. Ce cook ne rend PAS ce qui manque en source : sur 668 clés `narvos::…` citées par
le Lua, 470 ont leur source, 193 non (emotes `Tactical_HandSignals` 70 et `WW100` 52, corps
`stylized_modular` 40, `PontMetaHuman` 16, motos 6, `Map_Narvos`…) — et les PNJ Meshy, appelés
par des clés fabriquées, n'y sont pas comptés.

**Ce qui reste à rebâtir** (travail d'éditeur, sources présentes sous `WebPortal\public`) :
réimport des GLB (`public\models` : pnj, pnj_monstre, personnages, tower_map, animations),
repromotion des packs achetés (`public\asset_game` : Sewer, SpaceScenes, SmartLocomotion,
QuarantineTent, RidableMotorBikes…), puis nos propres créations (`PontMetaHuman`, blend space
de locomotion, `Map_Narvos`, `Map_Alien`), dans l'ordre de ce que le jeu appelle.

## 0 quater. Soir du 03/10 (22 h) — POINT DE REPRISE pour l'agent suivant

Où on en est, et la commande exacte pour continuer. Rien n'a été vu en jeu ; rien n'est commité.

> **ÉTAT AU 04/10, 18 h — lire d'abord « Suite du 04/10 (16 h – 17 h) » plus bas.** ADK : 106
> dossiers conformes sur 118 ; `Map_Narvos` et `Map_Alien` rebâties et sondées ;
> `BS_Narvos_Locomotion` refait ; second cook stagé sous
> `AssetBuilds\chaine-20261004-172943\narvos\` (45 169 clés, 47 cartes), **pas promu** ; il n'y
> manque au Lua que les 16 `BP_NarvosMH_*`. Depuis (19 h, « Soir du 04/10 ») : PontMetaHuman
> refait à 21 paquets sur 27, dont 14 de ces 16 Blueprints — PAS encore cuits ; les 6 restants
> (dont `BP_NarvosMH_M/F`) demandent une chirurgie de graphe, et du plugin `UnrealMCPServer` il
> ne reste sur le disque que les noms. Décisions ouvertes, à Hanibes : remettre l'archive du
> plugin (ou réécrire les chirurgies sur l'ancien `UnrealMCP`), promouvoir le pack, commiter.

**Le cook est fait.** 67 812 paquets cuits (34 min, 0 plantage), pack STAGÉ sous
`WebPortal\Server\AssetBuilds\recook-20261003\narvos\` (39 326 clés, 4 cartes : Forge,
Megastructure, Orbital, Tour). **PAS promu** vers `Server\Assets\narvos`. Avant de promouvoir :
`node scripts/lua-harness/pack-staging-check.mjs`, puis remplacer le dossier actif.
⚠ NE PAS lancer les générateurs de catalogues (`narvos-*-to-lua.mjs`) tant que le pack est
partiel : ils retireraient des catalogues Lua les entrées des assets encore manquants.

**L'ADK se rebâtit dossier par dossier** depuis `WebPortal\public` (toutes les sources GLB y
sont, saines : 10 326 GLB). État mesuré : `python scripts\recuperation\etat-adk.py` (disque
contre l'inventaire du 23/09 `_assets-inventory.2026-09-23.avant-recook.json`, 91 438 paquets).
Carte des recettes : `python scripts\recuperation\recette-dossiers.py`.

Fait ce soir (4 dossiers rendus conformes, +406 puis +2 imports) :
| dossier | recette | résultat |
|---|---|---|
| QuarantineTent, RidableMotorBikes_Advanced | copie de pack d'origine (`restaurer-copies-de-packs.py --ecrire`) | conformes |
| pnj (45 PNJ Meshy) | `bash scripts/recuperation/adk-importer.sh pnj NARVOS_SANS_SQUELETTE=1` | **329/329, 0 manquant, 0 en trop** |
| pnj_monstre (20 monstres) | textures en PNG puis import (textures KTX2/webp qu'Interchange ne lit pas) | rebâti ; 55 assets nommés autrement qu'au 23/09, 1 matériau éditeur `M_NarvosCouleurSommet` à refaire |

Recette pnj_monstre, en entier (à copier) :
```
node scripts/narvos-textures-vers-png.mjs WebPortal/public/models/pnj_monstre WebPortal/Server/adk/_textures_png/pnj_monstre --apply
node scripts/narvos-manifeste-brut.mjs WebPortal/Server/adk/_textures_png/pnj_monstre pnj-monstre-png --racine "E:/narvosprime-web-prototype/WebPortal/Server/adk/_textures_png"
bash scripts/recuperation/adk-importer.sh pnj-monstre-png NARVOS_SANS_SQUELETTE=1
```

⚠ **Réparé ce soir** : la réinstallation npm du 01/10 a monté `@gltf-transform` v4.5.1 (au lieu
de v4.3) ; l'entrée ESM a été renommée `dist/index.js`. 6 scripts codaient `dist/index.modern.js`
en dur et plantaient (`ERR_MODULE_NOT_FOUND`) : `narvos-textures-vers-png`, `-degraisser-anim`,
`-nommer-morphs`, `-renommer-os`, `-verifier-chunks`, `-verifier-transcodage`. Corrigés.

**Ce qui reste** (`recette-dossiers.py` : ~25 réimports GLB, ~21 éditeur) :
- Réimport GLB `SANS_SQUELETTE`, même recette que pnj (source présente sous public/models) :
  ZombieSoldierPack_original, StealthLocomotion, WW100IdleAnimPack, ThirdPerson,
  Tactical_HandSignals, Valkiria, samurai, ProceduralWeaponAnimationSystem, _parts, _body,
  tr_f_body/tr_m_form/tr_pf_body/tr_pf_form/ue4_mannequin. Les packs d'ANIMATION (StealthLocomotion…)
  peuvent exiger un retarget (`adk-retarget-anims.py`) — à vérifier au cas par cas.
- Cartes `.gltf` (le compteur GLB de `recette-dossiers.py` les RATE, source bien là) :
  **tower_map** (`public/models/Maps/tower_map/tower_map.gltf`, import `NARVOS_COMBINE=1`
  d'origine — 6 393 meshes, tick serveur à surveiller) et **Orbital** (moitié déjà là,
  `public/models/Maps/Orbital`).
- Promotions de pack d'origine, PAS des imports GLB (le `recette-dossiers.py` dit « ÉDITEUR »
  à tort, la source est sous public/asset_game) : Sewer, SpaceScenes, SpaceShips_Vol1,
  StylizedModularChar, Showcase, Shared, Tutorials, Planet_Project, SFSHelmet, Weapon, UI →
  `adk-promouvoir-packs.py` (variable `PACKS=`, `APPLIQUER=1`).
- Éditeur / nos créations : stylized_modular (corps modulaire), PontMetaHuman (BP_NarvosMH_*,
  chirurgie de graphe par MCP — voir [[reference-mcp-graphes-blueprint]]), Widgets, VFX,
  **Map_Narvos** et **Map_Alien** (assemblage de sous-niveaux, `.hermes/ARCHI_MONDE_2026-09-06.md`).
- **Le serveur ne démarrera pas sur sa carte** tant que `Map_Narvos` n'est pas rebâtie.

Après chaque vague d'imports : recuire (`bash scripts/narvos-chaine-cook.sh` — DDC Zen chaud,
~34 min), régénérer l'inventaire, reconstruire le pack, PUIS seulement les générateurs de
catalogues. Un seul UnrealEditor à la fois.

### Mise à jour du 04/10, 02 h 30 — la méthode d'import est fixée, les manifestes sont PRÊTS

⚠ Ne PAS rejouer les commandes d'import d'origine telles quelles : `narvos-skeleton-compat.mjs`
a changé depuis (ce qu'il rangeait SUR-ENSEMBLE le 02/09 est INTERCALE/REPARENTE depuis le
08/09 et n'est plus importé), et `public/models/personnages` a grossi (`_parts_png`). La même
commande importerait un AUTRE ensemble de fichiers.

La méthode retenue part de l'inventaire : `python scripts/recuperation/manifeste-depuis-inventaire.py
<dossier> --ecrire` écrit `adk/_manifests/inv-<dossier>.json` — exactement les GLB dont les
meshes attendus portent le nom. Il dit aussi le mode (squelette imposé, ou
`NARVOS_SANS_SQUELETTE=1` si le dossier a ses propres squelettes) et les GLB à convertir.
Prérequis refait : `adk/_export/SK_Mannequin.glb` (`adk-export-mannequin.py`).

Pilote du 04/10 (squelette imposé) : `_body` et `_parts` conformes ; `Valkiria` 0 manquant,
3 en trop (un matériau et deux textures sous `Animations/`, absents au 23/09 — laissés).
État : 56 257 paquets sur 91 438, 72 dossiers conformes, 46 à rebâtir.

Manifestes prêts, à importer UN PAR UN (`bash scripts/recuperation/adk-importer.sh <nom>`, sans
`NARVOS_SANS_SQUELETTE`), puis `python scripts/recuperation/etat-adk.py --manquants <dossier>` :
`inv-Tactical_HandSignals` (73), `inv-StealthLocomotion` (125), `inv-WW100IdleAnimPack` (51
animations dégraissées sous `adk/_anim_degraissees`) puis `inv-WW100IdleAnimPack-2` (59),
`inv-ThirdPerson` (99), `inv-ProceduralWeaponAnimationSystem` (1),
`inv-ZombieSoldierPack_original` (414 GLB, 42 Go : le plus long, en dernier ; relançable,
l'import saute ce qui existe déjà).

Recettes PAS encore fixées (ne pas improviser) : `tower_map` et `Orbital` (un `.gltf` → des
milliers de meshes), les pièces modulaires (`tr_*`, `samurai`, `ue4_mannequin`,
`stylized_modular` : sources sous `personnages/_parts_png`, préfixe `smc__`), `personnages`
(corps morphable), les packs promus (Sewer, SpaceScenes, SmartLocomotion, SpaceShips_Vol1) et
l'échantillon Mutable (Weapon, UI, Showcase, Shared, Tutorials), `PontMetaHuman`, les cartes.

### Mise à jour du 04/10, après-midi — imports faits, recettes retrouvées, réparations à rejouer

**Importé ce jour** (chaque dossier relu par `etat-adk.py --manquants/--en-trop`) :

| dossier | recette (d'où elle vient) | résultat |
|---|---|---|
| Tactical_HandSignals, StealthLocomotion, WW100IdleAnimPack (2 manifestes) | `adk-importer.sh inv-…` | conformes |
| ThirdPerson | `inv-ThirdPerson` | 358/358 ; **128 en trop** = textures que l'import du 02/09 avait PERDUES (sauvegarde unique en fin de course, piège 4 bis) — gardées. 99 lignes `cannot merge bone tree` (Manny UE5 sur SKEL_Mannequin) : même entrée, même squelette qu'à l'origine |
| ProceduralWeaponAnimationSystem | déjà importé à 04 h 05 | reste `MI_FPManny`, fabriqué par la passe « brancher » (voir plus bas) |
| **Orbital** | 8 chunks PNG, `NARVOS_SANS_SQUELETTE=1`, racine `public/models/Maps` (script `import-maps.sh` du 03/09, relu dans l'historique) → `adk-importer.sh chunks-Orbital NARVOS_SANS_SQUELETTE=1` | **2 097/2 097**. Les 1 147 paquets rendus par DMDE ont été réécrits par l'import (même source, + `OriginalSectionInfoMap`) ; originaux gardés sous `adk/_sauvegardes/Orbital-avant-reimport-2026-10-04` |
| **tower_map/chunks_png** | idem, `chunks-tower_map` | **2 046/2 046** |
| samurai, tr_* (11), ue4_mannequin | `inv-modulaires` : 49 GLB de `personnages/_parts_png`, squelette imposé (recette du 08/09) | meshes là ; matériaux Trooper à renommer et câbler (session d'éditeur, plus bas) |
| **stylized_modular** | export des 40 meshes depuis le projet 4.26 d'origine (`adk-lancer.sh adk-export-echantillon.py --projet <pack>.uproject NARVOS_SORTIE=…/_export/stylized_modular NARVOS_ETIQUETTE=smc NARVOS_FILTRE=SMC_Skeleton NARVOS_TOUT=1`, recette du 03/09), puis `inv-stylized_modular` | **94/94** |
| **SpaceScenes** | copie du pack d'origine (`asset_game/asset_futuriste/Space Scenes/SpaceScenes`, sans `Map_Overview`) sous `Content/Narvos/SpaceScenes` : le `PackageRedirects` `/Game/SpaceScenes/` de `DefaultEngine.ini` résout ses références | **441/441** ; Nanite (44 meshes, `monde-2026-09-06/44_nanite.py`) à reposer |

**Le monolithe `tower_map/Orbital_map` (26 601 paquets) n'est PAS rebâti, exprès** : aucune clé du
jeu n'y mène. ⚠ Ses homonymes comptaient dans les RANGS des clés (`-000_001_2`, `_3`) : après le
prochain pack, régénérer `Map_tower_map.lua` et `Map_Orbital.lua` par préfixe
(`narvos-map-to-lua.mjs --map … --prefixe …/chunks_png --apply`) — catalogues que le jeu ne charge
d'ailleurs pas (`Shared/Index.lua:138`).

**Un import refait ne rend pas l'état du 23/09 : trois passes de réparation sont à rejouer.**
Mesuré en comparant les paquets rebâtis à la liste fantôme (`$F09232` : nom, taille, date de
chaque paquet perdu) — tailles identiques ou à 2 %, SAUF les matériaux, plus petits de ~5 Ko :

1. `adk-renommer-worldgrid-tout.py` — 12 dossiers Trooper portent `WorldGridMaterial*` au lieu de
   `M_/T_<dossier>` ;
2. `adk-brancher-materiaux-modulaires.py` — instances `MI_<dossier>` (borné par `NARVOS_DOSSIERS`
   aux dossiers où l'inventaire l'attend et où elle manque) ;
3. `adk-usage-skeletal.py` — **0 matériau rebâti ne porte `bUsedWithSkeletalMesh`** (cause mesurée
   des PNJ gris du 13/09) ; borné par `NARVOS_ECRITS_DEPUIS=2026-10-03` (date du FICHIER : ce que
   DMDE a rendu garde sa date et son état).

Les trois passent par une session d'ÉDITEUR COMPLET (un `UMaterial` sauvé en commandlet perd son
graphe) : `bash scripts/recuperation/adk-session-reparations.sh` — ouvre et referme l'éditeur,
puis prouve sur disque (drapeau dans la table de noms, aucun matériau « fondu », plus de nom
réservé). **À lancer après le dernier import, avant de cuire.**

Déjà rejoué : `node scripts/narvos-pnj-physique.mjs --apply` — les 54 PhysicsAssets Meshy étaient
retombés au plancher (PNJ intuables du 13/09) ; garde `--verifier` : 0 dégénéré.

**Outils ajoutés** : `adk-lancer.sh` (n'importe quel script ADK en commandlet, `--projet` pour un
autre `.uproject`) ; `adk-session-reparations.{py,sh}` ; `manifeste-depuis-inventaire.py` connaît
les racines `personnages/_parts_png` et `adk/_export`. `adk-promouvoir-packs.py` : sa garde
anti-jonction comparait depuis le chemin lancé — l'ADK étant lui-même derrière une jonction, elle
arrêtait TOUTE promotion ; elle résout la racine d'abord (prouvé : Sewer passe, une jonction de
test sous `Content/` arrête).

**`Map_Narvos` peut se rejouer.** Les 49 scripts de session du 06/09 qui l'ont assemblée (créée,
4 sous-niveaux décalés, ciel unique, 3 systèmes solaires, semis, réparation des Landscape) n'ont
jamais été des fichiers du dépôt : ils sont relus des historiques et posés sous
`scripts/recuperation/monde-2026-09-06/` (ordre = préfixe ; chemins `D:` d'époque à adapter).
Suite de la chaîne, déjà dans `scripts/` : `adk-recolter-maps-ville.py`, `adk-copier-ville-vers-narvos.py`
(capitale, 08/09), `adk-ajouter-foret.py`, `adk-ranger-outliner.py` (09/09), puis
`.hermes/astra_megastructure_*.py`, `astra_planetes_ajouter.py` (15/09). `Map_Alien` =
`LandscapeAutoMaterial_Island_Example` du pack MW Landscape, renommée (`32_univers_2.py`).

**Suite du 04/10 (14 h – 15 h).**

| dossier | recette | résultat |
|---|---|---|
| personnages (corps morphable + 4 vêtements) | `inv-personnages`, squelette imposé | **16/16** ; `base_morphable.uasset` à 46 octets de l'original (129 Mo) |
| **Sewer**, **SmartLocomotion** | pack d'origine recopié sous `Content/<Pack>`, puis `adk-lancer.sh adk-promouvoir-packs.py NARVOS_PACKS=… NARVOS_APPLIQUER=1` (recette du 05/09 et du 07/09) | **506/506** et **356/356** ; mêmes 3 paquets refusés qu'à l'origine ; tailles égales à celles du 23/09 |
| **StylizedModularChar** | `Materials` + `Textures` du pack 4.26 sous `Content/StylizedModularChar` puis promotion ; 24 coiffures copiées sous `Narvos/…/Meshes/<genre>/Hair` (recette du 04/09) ; puis `adk-lancer.sh recuperation/adk-chaine-stylized.py` : rebranchement des 40 meshes, coiffures, peau teintable | 112/115 avant la chaîne (les 3 `NarvosPeau` en sortent) |

⚠ **Une promotion laisse des imports à l'ANCIEN chemin.** `rename_asset` sauve chaque asset au
moment où il le déplace, donc avec l'ancien chemin de toute dépendance déplacée après lui, et
ne garde un redirecteur que là où il croit qu'un référent reste (Sewer 163, StylizedModularChar
0). Mesuré : `MI_AfricanFace` sauvé à 14:29:10, ses textures à 14:29:20, et son paquet ne cite
que `/Game/StylizedModularChar/Textures/…`. Correctif du projet (celui de CraftingStations, 12/09) :
un `PackageRedirects` de préfixe par pack promu — ajoutés à `DefaultEngine.ini` pour Sewer,
SmartLocomotion, StylizedModularChar (garde `redirects-idempotents-check` : 59/59).
⚠ Ces redirects posés, **ne plus rejouer la promotion de ces packs** : un asset pas encore déplacé
serait cherché à sa future place, et chargé vide.

**Sessions d'éditeur du 04/10 (14 h 35 – 14 h 55), toutes passées** — `bash
scripts/recuperation/adk-session.sh <script>` ouvre l'éditeur complet, garde sa durée, le referme :

| session | ce qu'elle a fait | preuve |
|---|---|---|
| `adk-chaine-stylized.py` (commandlet, 32 s) | 40 meshes Stylized rebranchés sur les matériaux du pack, 24 coiffures validées (leurs matériaux d'ORIGINE résolvent par le redirect : aucun rebranchement déduit nécessaire), `M_NarvosPeau` + 2 instances | StylizedModularChar **115/115** ; 58 textures atteintes |
| `adk-session-reparations.sh` (4 min) | 48 renommages `WorldGridMaterial` → `M_/T_<dossier>` ; 6 instances `MI_<dossier>` ; `M_NarvosCouleurSommet` créé et posé sur `mob_boss` (refait d'après les deux scripts de session du 04/09) ; **130 drapeaux skeletal** | 130/130 portent `bUsedWithSkeletalMesh` sur le disque, 0 matériau fondu, 36 meshes Trooper citent leur instance — **95 dossiers conformes** |
| `adk-session-monde.py` (2 min) | **`Map_Narvos` recréée** : Orbital, Forge, Tower en `LevelStreamingDynamic` aux décalages de `Mondes.DECALAGES`, forêt (`ForestKitONE`) et Mégastructure en `AlwaysLoaded` à l'identité (leurs acteurs sont déjà en place dans les niveaux survivants : on ne rejoue PAS leur déplacement), ciel unique tagué `Sun` | rapport `adk/_manifests/session-monde.json` ; `Map_Alien` ABSENTE, donc non montée |
| `adk-session-capitale.py` (7 min) | récolte des 18 cartes CITY_PACK (`.hermes/maps_ville.json` refait) puis pose : **13 490 acteurs `NARVOS_VILLE_*`, 0 raté**, 10 scènes — le chiffre du 08/09 | `Map_Narvos.umap` 28,8 Mo ; `.hermes/ville_posee.txt` |

Après les deux sessions du monde, les sous-niveaux survivants (Forge, Tower, Orbital,
Megastructure, ForestKitONE) sont **identiques à l'octet** à leur sauvegarde
(`adk/_sauvegardes/maps-avant-sessions-monde-2026-10-04/`, empreintes `sha256.txt` ; la carte de
base sans la ville y est aussi). ⚠ `World.streaming_levels` n'est pas exposé à Python en 5.7 :
passer par `GameplayStatics.get_streaming_level(monde, "<nom court>")`.

**Textures (consigne de Hanibes, 04/10 : « ne pas oublier les textures »).**
`python scripts/recuperation/textures-rebaties.py` relit, sans Unreal, chaque matériau et maillage
écrit depuis la perte : sur 7 495 paquets rebâtis (942 matériaux), **0 texture attendue absente**
hors monolithe écarté, **5 références mortes** — toutes de Sewer vers `/Game/Horror_Hospital/…`,
un reste du pack d'origine — et 5 matériaux sans image, tous par construction (couleur de sommet,
maîtres procéduraux). SpaceScenes (`--depuis 2000-01-01 --dossier SpaceScenes`) : 198 textures
attendues, 198 là. Ce contrôle ne voit pas un graphe qui ne câble pas sa texture : relire le
journal du cook (« Missing input texture », « Failed to compile Material ») et lancer
`adk-verifier-textures-tout.py` (registre d'Unreal, inventaire des meshes gris par dossier).

**Cook du 04/10** (14 h 58 – 15 h 34, 35 min 54 s, `Packages Remain 0`) : 60 440 paquets, pack
STAGÉ sous `Server/AssetBuilds/chaine-20261004-153446/narvos/` — **44 032 clés** (39 326 le 03/10),
43 cartes dont `Map_Narvos`, 71,7 Go. **PAS promu** : la promotion vers `Server/Assets/narvos`
reste une décision. Journal gardé hors rotation : `adk/_manifests/cook-2026-10-04.log` (celui du
03/10 a été purgé par Unreal, qui ne garde que dix journaux).

Ce que le journal dit des textures :
- **dossiers rebâtis : 0 erreur, 0 matériau qui ne compile pas, 0 dépendance introuvable** ;
- les 372 « Failed to compile Material » et les 2 154 dépendances introuvables sont TOUS dans
  des dossiers rendus tels quels par la récupération. 1 906 de ces dépendances visent une
  ancienne racine `/Game/<X>/` dont le paquet existe au même sous-chemin sous `/Game/Narvos/<X>/`
  (100 % des cibles, comptées sur le disque) : ce sont les dossiers de GameAnimationSample et de
  MutableSample copiés les 04-05/09, et deux promotions d'avant le correctif du 09/09. **19
  redirects de préfixe ajoutés** à `DefaultEngine.ini` (liste et mesure dans son commentaire ;
  garde : 116/116). ⚠ C'est un MIEUX par rapport au 23/09, pas une restauration : à confirmer au
  prochain cook (les deux compteurs doivent chuter), et à retirer si un effet de bord apparaît.
  Non couverts : `/Game/Characters/`, `/Game/Character/` (aucun miroir), `PontMetaHuman` (9, à
  rebâtir), `TechDefaults/T_ORM_Neutre` (2 : `.hermes/astra_city_orm_repli_20260915.py`).

`Map_Narvos` sondée (`adk-session.sh recuperation/adk-sonder-monde.py`, lecture seule, rapport
`adk/_manifests/sonde-monde.json`) : raycast aux centres de `Mondes.CENTRES` — **Tour 151 834,5
pour 151 834 attendus ; capitale 157 859,5 pour 157 859 ; forêt −8 062,0 pour −8 062**. Forge sans
sol (son décor est posé par le Lua, comme avant), Alien sans sol (carte absente). ⚠ Orbital :
RIEN à moins de 3,5 km de l'arrivée du Lua `(-363 190, 85 940, 246 529)` — le hub de la carte
survivante (14/09) est près de l'origine, z ≈ 6 600. Écart antérieur à la perte selon toute
apparence (même carte, même Lua) ; à voir en jeu, on y arrive en vol.

**Copies HORS du disque perdu, trouvées le 04/10** : le cache d'Epic
(`C:\ProgramData\Epic\EpicGamesLauncher\VaultCache` : MutableSample_5.7, Planet_Project,
SFSHelmet, MWLandscapeAutoMaterial, AutoFootsteps, Footsteps…) et les projets d'exemple
(`…\OneDrive\Documents\Unreal Projects\GameAnimationSample`, `MutableSample`).
`restaurer-copies-de-packs.py --origine <cache> --origine <projets> --resauves Weapon,UI,Showcase,Shared,Tutorials,Planet_Project --ecrire`
a rendu **632 paquets, 8 dossiers** : SFSHelmet et Widgets (copies exactes), Weapon, UI, Showcase,
Shared, Tutorials, Planet_Project (copies exactes + 47 instances de matériau resauvées le 05/09 —
passe rejouée : `adk-lancer.sh adk-appliquer-parents-source.py NARVOS_APPLIQUER=1`, données
`adk/_parents-source.json` survivantes). **103 dossiers conformes sur 118.**
`Map_Alien` : sa carte d'origine est là aussi
(`VaultCache\MWLandsc…\data\Content\MWLandscapeAutoMaterial\Maps\LandscapeAutoMaterial_Island_Example.umap`).

Passe des parents relue : les 47 instances ont leur maître ; **43 identiques à l'octet près à leur
taille du 23/09**, 4 à 3 % (témoin : liste fantôme).

**Inventaire Unreal des meshes gris** (`adk-lancer.sh recuperation/adk-verifier-textures-rebatis.py`,
rapports `adk/_manifests/textures-rebaties/`) sur les 39 dossiers rebâtis ou recopiés :
**3 751 meshes propres sur 3 865**. Tout ce qui sort d'un import GLB ou d'une promotion est à
100 % (Orbital 1 546, tower_map 1 451, Sewer 117, stylized_modular 40, coiffures 24, pnj 45,
ThirdPerson 99, Trooper…). Les 114 signalés, un par un :
- 51 `WW100IdleAnimPack` au matériau du moteur : les meshes PORTEURS des animations dégraissées
  (on en joue l'animation, jamais le mesh) — même état qu'au 23/09 (tailles égales) ;
- `mob_boss` (couleur de sommet), maîtres procéduraux de SpaceScenes et de SmartLocomotion,
  gizmos et panneaux de démo de MutableSample (UI, Showcase, Tutorials, Weapon) : aucun n'a de
  texture, par construction ;
- `SFSHelmet` (slots VIDES) et `Planet_Project` : copies exactes dont les matériaux citaient
  `/Game/SFSHelmet/…` et `/Game/Planet_Project/…` — **2 redirects de plus** (0 référence morte
  ensuite ; garde 122/122). Le casque était donc gris aussi le 23/09.

`TechDefaults/T_ORM_Neutre` refaite (`adk-lancer.sh recuperation/adk-texture-orm-neutre.py`, source
`.hermes/generated/T_ORM_Neutre.png` régénérée) : six matériaux de CITY_PACK l'attendaient.

### Suite du 04/10 (16 h – 17 h) — zombies, blend space, `Map_Alien`

**Zombies** (`adk-importer.sh inv-ZombieSoldierPack_original`) : 414 GLB, 0 échec, 13 min 30
(pas « des heures »). Le dossier rebâti est MEILLEUR que celui du 23/09, et `etat-adk.py` le
dira toujours « à rebâtir » pour deux raisons qui n'en sont pas :
- **306 paquets « en trop »** : les textures que l'import d'origine avait PERDUES (une seule
  sauvegarde en fin de course — piège 4 bis du skill nanos-world). Audit disque : 208
  matériaux, 208 avec image, 462 textures attendues, 0 absente, 0 référence morte. Inventaire
  Unreal après réparations (`adk-verifier-textures-rebatis.py`) : 414 meshes, 414 propres, 0 gris.
- **13 paquets « manquants »**, tous des `MI_Parts` / `MI_Mesh` : les instances génériques que
  la PREMIÈRE version de `adk-brancher-materiaux-modulaires.py` (08/09) posait dès qu'UN
  matériau du dossier était sans texture (la faute Murdock, corrigée depuis). Les matériaux
  ont aujourd'hui leurs textures : la passe ne retient aucun de ces dossiers (0 candidat sur
  14), et c'est juste. Manques DÉFINITIFS et voulus ; aucune clé du jeu ne les cite.

**Holster du Tankman, et un piège payé.** Le GLB nomme son matériau `MTL_UE4`, l'inventaire
`MTL_SovietZombieTankman1_UE4` : le 05/09 le nom réservé `WorldGridMaterial` avait été retiré
deux fois, par deux outils qui ne dérivent pas le même nom (`adk-renommer-asset.py` dans l'ADK,
`glb-renommer-materiau.mjs` dans les sources). La session de réparations rend maintenant leur
nom d'inventaire aux `MTL_*` (étape `noms_d_origine`). ⚠ Mais `rename_asset` SAUVE chaque asset
au moment où il le renomme : le matériau, renommé le premier, est parti sur le disque en citant
`MTL_UE4_BaseColor` — renommée la seconde d'après. Trois références mortes, un holster GRIS au
prochain chargement, aucune erreur, et le contrôle du script (« plus aucun asset nommé
MTL_UE4* ») passait : c'est `textures-rebaties.py` qui l'a vu. Corrigé à la source
(`adk-renommer-asset.py` resauve de force ce qu'il a renommé) et sur le paquet abîmé
(`adk-session.sh recuperation/adk-rebrancher-apres-renommage.py` : les textures reprennent
l'ancien nom, le matériau se charge et les retrouve, on renomme de nouveau, on sauve de force).
Relu : 0 référence morte, drapeau skeletal présent.

**Seconde session de réparations** (`adk-session-reparations.sh`, journal
`.hermes/session_reparations_2_2026-10-04.log`) : 209 matériaux reçoivent
`bUsedWithSkeletalMesh` (206 des zombies), 209 prouvés sur le disque, 0 fondu, 0 nom réservé.
**105 dossiers conformes sur 118.**

**`BS_Narvos_Locomotion` refait SANS le serveur MCP** (`adk-blend-space-locomotion.py`, étape de
la même session). `adk-creer-blend-spaces.py` ne marche pas en 5.7 : `blend_parameter_x`
n'existe pas (c'est `BlendParameters[3]`, propriété `blend_parameters`) et `add_sample` n'est
pas exposé à Python (on pose `sample_data`). ⚠ Lu dans la source du moteur : poser les
échantillons ne construit PAS les données d'exécution — `ResampleData()` n'est appelé que par
l'éditeur de blend space de Persona, à sa construction et à chaque propriété changée tant
qu'il est ouvert. Le script OUVRE donc l'éditeur de l'asset (`AssetEditorSubsystem`), pose axe
et échantillons, referme, sauve. Preuve sur le disque : `BlendSpaceData` et `Segments` dans le
paquet (9 266 octets) ; axe Speed 0..600, 4 boucles à 0 / 150 / 375 / 600 — la recette de
`Character.lua:250`. ⚠ Toujours 1D : son effet en jeu reste À VOIR (audit de refonte §3).

**`Map_Alien` rebâtie et montée** (`adk-session-alien.sh`, journal
`.hermes/session_alien_2026-10-04.log`, rapport `adk/_manifests/session-alien.json`). Source :
`LandscapeAutoMaterial_Island_Example.umap` du cache d'Epic, datée du 05/09 12:58 — l'heure où
le pack est entré dans le projet. La session la renomme (`32_univers_2.py`), ôte son ciel, ses
4 caméras et sa mire (`36_univers_4.py` : 11 acteurs sur 12, reste le Landscape), et pose le
terrain à la place qu'il avait à la fin : acteur en (−614 220, 284 620, 152 020) dans son
niveau. Cette place n'était écrite nulle part : elle vient de la SORTIE de `47_reparer_land.py`
relue dans les historiques (06/09 13:19, `avant_acteur` moins le décalage du sous-niveau), et
elle est recoupée trois fois — bornes mesurées après pose = celles du relevé (centre z
152 012,3, demi z 5 127,6) ; sol au centre de la carte d'exemple 1 485,7 = l'ancienne arrivée
du Lua moins un mètre ; `Map_Tower`, sa jumelle survivante, porte son terrain au même écart.
Sondée dans un processus neuf (`adk-sonder-monde.py`) : **sol de l'île à 153 405,7 pour 153 406
attendus par `Mondes.CENTRES.alien`**, sous-niveau au décalage (−8 000 000, 4 000 000, 0) ; les
cinq autres sous-niveaux inchangés à l'octet (sha256). `Map_Alien.umap` : 166 Mo (Tour :
225 Mo). Ses vraies références (matériau `MTL_MWAM_Landscape_IslandExample`, 5 `LGT_*`)
résolvent toutes ; les noms `/Game/MWAutoMaterial/Textures/…` qu'elle cite sont des noms de
streaming hérités du pack, identiques dans `Map_Tower`. Sans végétation, comme au 09/09
(« alien, 0 instance »). `Maps` redevient conforme : **106 dossiers sur 118**.

**Second cook du 04/10** (`narvos-chaine-cook.sh`, 16:56 → 17:29, 33 min 6 s, `Packages Remain 0`,
63 205 paquets ; journal hors rotation `adk/_manifests/cook-2026-10-04-2.log`). Pack stagé :
`WebPortal/Server/AssetBuilds/chaine-20261004-172943/narvos/` — 45 169 clés, 47 cartes dont
`Map_Narvos` et `Map_Alien`, 153 845 fichiers, 85 Go. **PAS promu.**
- contre le Lua (`pack-contre-lua.py`) : 663 clés `narvos::` écrites, **16 absentes — les
  `BP_NarvosMH_*`**, rien d'autre (le premier staging en manquait 18 : `BS_Narvos_Locomotion` et
  `SM_ZombieSoldierTankman_UE4` y sont) ;
- textures cuites, comptées dans le staging contre l'inventaire : 3 520 sur 3 520 pour quatorze
  dossiers rebâtis ou sensibles (zombies 768, CITY_PACK 1 567, Orbital 239, tower_map 244…) ;
  le blend space cuit garde `Segments` ;
- matériaux qui ne compilent pas (`cook-materiaux.py --contre` le premier cook) : **180 → 147**,
  34 réparés (ExternalAssets 19, Locomotor 6, Infinite 3, Levels 3, CITY_PACK 2 par
  `T_ORM_Neutre`, Megastructure 1) — les redirects du 04/10 sont donc CONFIRMÉS —, 1 apparu
  (`Showcase/…/M_ColorPatterns`, démo Mutable recopiée). Les 147 sont TOUS dans des dossiers
  rendus tels quels par la récupération, donc dans l'état du 23/09 : 117 « Texture Object>
  Requires valid texture » (matériaux d'imports GLB dont l'import d'origine avait perdu les
  textures — porteurs d'animations pour l'essentiel : Action_Crossbow 27, Animations 26,
  CG_ShotgunPack 14, FPS_Arms 14…), 19 « Missing Material Function » (`M_Generic` et 13 maisons
  d'OpenWorlds, déjà hors fermeture de la forêt le 13/09 ; 3 armes Hyper dont la couche
  `ML_Dark_Leather02_Brown` n'existe ni dans l'ADK, ni dans le pack d'origine, ni à
  l'inventaire) ;
- erreurs 4 271 → 3 192, avertissements 6 007 → 3 797. « Content is missing from cook » monte de
  143 à 162 paires : 19 références que les redirects font maintenant ABOUTIR à des dossiers
  sortis du cook exprès (`Shared/Mannequins/Rigs/Poses`, `MetaHumans`) — avant, elles
  n'aboutissaient nulle part ;
- face au manifeste actif (reconstruit, 634 clés connues) : 71 clés en moins, dont 61 du
  monolithe `tower_map/Orbital_map` (non rebâti exprès), 5 `Premade_Blueprints` de MetaCustom
  (sortis du cook par `DefaultGame.ini`), 3 SpaceShips_Vol1.

**Pour promouvoir** (décision de Hanibes — `Server/Assets/narvos` ne porte aujourd'hui qu'un
`Assets.toml` reconstruit, aucun asset) : garder ce manifeste
(`AssetBackups/chaine-20261004-172943/`), remplacer `Server/Assets/narvos/` par le contenu du
staging, puis `bash scripts/narvos-chaine-cook.sh --apres-promotion` (générateurs de
catalogues — ils réécrivent du Lua suivi par git : lire leur diff avant de le garder).

**Reste** : l'éditeur pur — **PontMetaHuman** (27 paquets ; ses 16 `BP_NarvosMH_*` sont les
SEULES clés citées par le Lua qui manquent encore à l'ADK : 671 clés `narvos::` relevées, 0
autre dans un dossier manquant). Relu le 04/10 : rigs, retargeters, ABP de retarget, 14 porteurs
et duplicatas M/F sont du Python (`scripts/adk-pont-metahuman.py`, rejouable en session) ; mais
trois chirurgies de GRAPHE passent par le plugin `UnrealMCPServer`, dont il ne reste que les
NOMS (voir « Soir du 04/10 » ci-dessous) —
le visage sans LiveLink (`adk-visage-sans-livelink.mjs`), les fonctions `Narvos*` de
`BP_NarvosMH_M/F` (`adk-mcs-fonctions.mjs`), les adaptateurs de sculpture
(`.hermes/astra_mcs_corps_*.mjs`). ⚠ Ne PAS refaire M/F sans la première : `Face_AnimBP` porte
un nœud LiveLink absent du client nanos — crash client du 13/09. Puis
SpaceShips_Vol1 (109 paquets, `.hermes/astra_spaceships_*.py`, source
`asset_game/asset_futuriste/Spaceship_Pack_1`), VFX (18, essais), `MI_FPManny`, `_scratch`,
Nanite de SpaceScenes (`44_nanite.py`), planètes et Mégastructure d'Astra ; puis, pack promu :
`Map_tower_map.lua` / `Map_Orbital.lua` par préfixe et générateurs.

### Soir du 04/10 (19 h) — le plugin MCP cherché DANS le projet ; PontMetaHuman à 21 sur 27

Hanibes : « c'est toi qui cherche mal, logiquement tout est ici : E:\narvosprime-web-prototype ».
Juste : le plugin avait été déclaré « introuvable sur C: et D: » sans que le projet lui-même ait
été fouillé. Fait depuis, par le NOM sur tout le projet, lots compris (2 234 192 fichiers —
`chercher-nom.py`), puis par le CONTENU (`sonder-contenu.py`) :
- **le dossier du plugin est là** : `mes_projet/Nouveau dossier/$F10497/Plugins/UnrealMCPServer`
  (361 fichiers, noms, tailles et dates d'origine ; `UnrealEditor.modules` dit bien
  `BuildId 47537391`). **Mais son contenu est RECOUVERT** : la « DLL » n'a pas d'en-tête `MZ` et
  porte dix marques de paquets Unreal, le `.uplugin` et les sources sont illisibles ; plus petit
  fichier faux 712 octets, plus grand sain 672 — la signature des lots de la seconde passe ;
- même verdict pour les copies CUITES de PontMetaHuman que portent ces lots
  (`$F14009/AssetBackups/astra-20260915-lot6` : 27 sur 27 fausses ; `$F10497/Saved/Cooked`) ;
- `WebPortal/Server/adk.reconstruit/Plugins/UnrealMCPServer` : quatre sources relues des
  historiques, trouées (1 339 à 3 685 lignes manquantes) — pas compilable ;
- l'archive d'origine était `C:\Users\aniss\Downloads\Telegram Desktop\UnrealMCPServerUE57_v2.0.2.7z`
  (raccourci « Récent » du 18/07) : ce dossier n'existe plus, et aucune archive du plugin n'est
  dans le projet, ni sur C: (dossier utilisateur, ProgramData, corbeille), ni sur D: ;
- **ce qui a survécu** : l'ancien plugin `UnrealMCP` (Flopperam + commandes ajoutées), sources ET
  DLL compilée pour ce moteur (`BuildId 47537391`), sous `C:\Users\aniss\Documents\Plugins57\UnrealMCP`.
  Il sait lire un graphe, supprimer un nœud, relier, créer une fonction (`read_blueprint_content`,
  `delete_node`, `connect_nodes`, `create_function`, `add_blueprint_node`…), pont TCP 55557. Il
  se charge pour UNE session sans toucher au `.uproject` :
  `UnrealEditor.exe <ADK> -plugin="C:/Users/aniss/Documents/Plugins57/UnrealMCP/UnrealMCP.uplugin"`
  (essayé à 19 h 10 : « Server started on 127.0.0.1:55557 », connexion acceptée, fermeture
  propre ; un premier lancement est mort au démarrage dans le DDC HTTP, non reproduit). Les
  trois chirurgies ont été écrites pour l'API de UnrealMCPServer (HTTP 13579) : les refaire avec
  lui est une RÉÉCRITURE, pas un rejeu.

**PontMetaHuman, partie Python refaite** (`adk-session.sh recuperation/adk-session-pont-metahuman.py`,
45 s, journal `.hermes/session_pont_metahuman_2026-10-04.log`) : **21 paquets sur 27** — 3 rigs,
2 retargeters, 2 ABP de retarget, 14 porteurs. Sorties identiques au témoin `adk/_pont-metahuman.log`
(20 chaînes sur 28 en EXACT, 6 opérations par retargeter, 2 nœuds de retarget par ABP, porteurs
« Actor, SkeletalMeshComponent* ») ; tailles à moins de 2 % de celles du 23/09 (liste fantôme),
`ABP_NanosVersMetaHumanCorps` à l'octet près — sauf `ABP_NanosVersMetaHuman` (−12,7 % : l'original
avait été sauvé depuis l'éditeur ouvert). **Pas encore cuit** : le staging du 04/10 17 h 30 ne les a pas.
Restent les six qui demandent un graphe : `ABP_NarvosVisage`, `ABP_NarvosVisageOutil`,
`ABP_NarvosPersonnalisationCorps`, `ABP_NarvosPersonnalisationVisage`, `BP_NarvosMH_M`,
`BP_NarvosMH_F`. Leurs sources sont là : `BP_MCSGavin` et `BP_Hana` dans l'ADK ; les deux
`Face_AnimBP` d'origine dans `public/asset_game/mixte_epoques/Meta Customization System - Unreal
Engine/` (`adk/_quarantaine/` est vide).

**Laissé tel quel, à savoir** : `pnj_monstre` porte 55 paquets « en trop » — cinq monstres
(bandit, boss_mob, golem_glace, lion, zombi) que l'import d'origine REFUSAIT (textures KTX2) et
que la conversion PNG du 03/10 a laissé entrer ; ils apparaîtront dans `Spawnables` au prochain
passage des générateurs. `M_NarvosPeau` n'est cité par aucun maillage (le Lua le pose à
l'exécution) : la passe des drapeaux ne le voit pas — à vérifier en jeu sur une peau teintée.

## 1. L'essentiel

Rien de nouveau n'a été trouvé hors du disque ; ce passage a corrigé **quatre défauts
de l'extracteur** qui faisaient entrer des faussetés dans le projet, et a ajouté une
contre-épreuve indépendante sur `Server\`.

| défaut | ce qu'il faisait | mesuré |
|---|---|---|
| une commande « réussie » tenue pour un script réussi | `python - <<'PY' … PY` échoue (AssertionError), `node x.mjs` qui suit réussit : la commande n'est pas en erreur. Le script était rejoué avec indulgence et appliquait une modification qui n'avait jamais eu lieu — ou mettait en doute un fichier qu'il n'avait pas touché | 61 scripts ; un générateur complet rendu « ancienne version » |
| une commande « en erreur » tenue pour une commande sans effet | le script modifie le fichier, puis `node --check` échoue : « Exit code 1 ». Toute la commande était ignorée | 159 commandes : 37 scripts menés à bien, 53 fichiers écrits par heredoc puis lancés ; `nanos-build-asset-pack.mjs` (59 trous) revenu complet, `narvos-audit-packs.mjs`, `narvos-nanos-base-to-lua.mjs`, `schema-check.mjs` aussi |
| l'horloge du rejeu | un manifeste du 04/09 rejoué portait `"genere_le": "2026-10-02T21:27…"` ; deux extractions de suite ne rendaient pas le même fichier | l'horloge du bac est celle de la commande d'origine |
| ce que le bac ne peut pas savoir | un `.glb`, un `.uasset` y est toujours « absent », un dossier d'assets toujours vide, `Assets.toml` connu à 1 % : les générateurs rejoués écrivaient « lus : 0 », « 22 assets manquants sur 22 », `"entrees": {}` — et c'était posé dans le projet | 6 fichiers inventés retirés du projet ; un fichier généré à partir de ce que le bac ignore n'est plus posé, un fichier modifié en place l'est toujours |

Chaque règle a sa preuve (348 assertions, 6 suites) et sa mesure : les deux vérités
(901 fichiers web de DMDE, 164 fichiers du cache client) n'ont pas bougé — 820 et 125
identiques à partir des seuls historiques —, et quatre scripts de plus sont complets.

## 2. Le projet remonté (03/10, 00 h 30)

| | 02/10 | 03/10 |
|---|---|---|
| packages nanos complets | 197 sur 198 | 197 sur 198 (le dernier est un journal de diagnostic) |
| `.lua` qui compilent | 175 sur 175 | 175 sur 175 |
| `scripts\` complets (générateurs, harnais) | 366 sur 394 | **374 sur 394** |
| fichiers texte sains (`sante.py`) | — | 5 726, 1 « corrompu » (un octet de contrôle vrai dans une ligne commentée de `narvos-verifier-catalogues.mjs`) |
| batterie `lua-harness\tout.mjs` | 85 verts, 22 rouges, 11 621 assertions | 85 verts, 22 rouges, **11 626** assertions |
| journaux du jeu (`verifier-journaux.py`) | — | 4 cadres de pile justes, 0 faux ; 108 messages du 26/09 sur 108 retrouvés dans le code |

- **Remplacés** : 229 fichiers (presque tous pour un chemin `D:` → `E:` que
  `chemins-vers-e.py` a remis ensuite) ; chacun copié avant dans
  `E:\mes_projet\_avant_reassemblage_2026-10-03_00h29`.
- **Sortis** (`E:\mes_projet\_orphelins_reassemblage_2026-10-03_00h30`) : cinq manifestes
  de `adk.reconstruit\_manifests` et `WebPortal\regression-report.json`, au contenu
  inventé par le bac ; `src\rpg\wasm\animationPipeline.benchmark.ts`, renommé
  `…benchmark.test.ts` le 30/07 (une commande en erreur que l'on ne lisait pas). La
  reconstruction honnête du rapport de régression (anciennes lignes, marqueurs) est
  posée à côté : `WebPortal\regression-report.json.reconstruit`.
- **`Server\` (33 fichiers Lua)** : contenu identique à celui du 02/10. La contre-épreuve
  des journaux porte sur lui : `Voyage.lua:282`, `Voyage.lua:328`, `Index.lua:4116`
  tombent à la ligne près ; tout avertissement du 26/09 se retrouve dans le code.

## 3. Les 22 harnais rouges

| cause | harnais |
|---|---|
| **pack cuit perdu** (`Assets.toml`, manifeste ADK) — 7 | `animaux`, `incarnations-check`, `metahumain-bp`, `pas`, `pose-recolte`, `vehicules`, `minimap-cablage-check` |
| **`DefaultEngine.ini` de l'ADK** incomplet — 2 | `redirects-idempotents-check`, `rendu-client-check` |
| **harnais ou générateur lui-même incomplet** — 8 | `parcours`, `pnj-anims`, `pnj-anims-verif`, `assemblage-ui` (tests absents), `creation`, `modular`, `syntaxe-check`, `chaine-generateurs-check` (lit une ligne commentée de `narvos-verifier-catalogues.mjs`) |
| **gardes qui parlent du vrai code** — 5 | `menottes-cablage-check`, `sorts-vfx-check`, `z-absolu-check`, `zaaps-serveur` (1 assertion sur 71), `roster` (2 assertions) |

`pack-staging-check` est passé au vert (son harnais est revenu complet). Les cinq
derniers portent sur des fichiers dont le contenu est certain (cache) : des rouges du
projet, pas de la récupération.

## 4. Ce qui reste

1. **Le pack d'assets cuit** (88,7 Go, 231 710 fichiers) et son `Assets.toml` : un
   cook. Tout est là pour le faire — l'ADK du lot DMDE (`Content` de 76 Go,
   `NanosWorldADK.uproject`, `_assets-inventory.json` du 23/09), le moteur
   `D:\Epic Games\UE_5.7`, et `scripts\nanos-build-asset-pack.mjs`, revenu complet
   cette nuit, qui dérive `Assets.toml` du cook. Cuire écrit à travers la jonction
   `WebPortal\Server\adk` dans le lot : à décider, pas à lancer par un outil.
2. **20 scripts incomplets** sous `scripts\` (`narvos-verifier-catalogues.mjs`,
   `narvos-emotes-to-lua.mjs`, `narvos-modular-to-lua.mjs`, `creation-tests.lua`,
   `roster-tests.lua`, `menottes-tests.lua`…) : `python scripts\recuperation\bilan.py
   E:\mes_projet\narvos-reconstruit-final --detail scripts`.
3. **39 fichiers que DMDE a rendus corrompus et qu'aucun agent n'avait lus** (31 sous
   `docs\`, 8 fichiers de build).
4. Relire les cinq gardes rouges du point 3.

## 5. Ce que Hanibes seul peut faire

DMDE tourne en administrateur : je peux le voir, pas le piloter.

- **Balayer D: avec DMDE** (1,5 To libres sur 1,9 : ce qui a été « supprimé » le
  19/09 a de bonnes chances de n'avoir pas été réécrit). Le projet a été DÉPLACÉ de
  `D:\mes_projet\narvosprime-web-prototype` vers E: : `Server\` et le pack cuit peuvent
  revenir dans leur état du 19/09. Uniquement « Récupérer », jamais Appliquer / Écrire /
  Réparer / Initialiser ; récupérer VERS E:.
- **Les « Versions précédentes » de `D:\mes_projet`** (clic droit → Propriétés), si la
  protection du système était active sur D: ; `vssadmin list shadows` en administrateur
  le dit.
- `$F32992\nanos_world` sur E: — toujours vu par DMDE, jamais rendu.
- Changer le disque d'installation par défaut de l'application Xbox.
- **Garder une copie du code hors de E:** (quelques dizaines de Mo sans les assets).
- Supprimer le dossier vide `D:\mes_projet\narvosprime-web-prototype`.

## 6. Sous `E:\mes_projet\`

| dossier | rôle |
|---|---|
| `cache-client-nanos\` | le cache du client, déchiffré (lot de vérité) |
| `narvos-reconstruit-v15\` | ce que les historiques savent seuls (la mesure du 03/10) |
| `narvos-reconstruit-v14\` | idem, avec `INDEX_DMDE.tsv` (celui qu'a utilisé l'extraction finale) |
| `narvos-reconstruit-final\` | l'extraction finale du 03/10, avec `EVENEMENTS.pickle` pour les outils de diagnostic |
| `narvos-reconstruit-final-2026-10-02-20h16\`, `…-23h22\`, `…-2026-10-01\` | les extractions finales précédentes, gardées pour comparaison |
| `_avant_reassemblage_2026-10-03_00h29\` | chaque fichier du projet remplacé cette nuit, tel qu'il était |
| `_orphelins_reassemblage_2026-10-03_00h30\` | les 7 fichiers sortis du projet, et pourquoi |
| `BATTERIE_9_avant_…`, `BATTERIE_10_apres_reassemblage_2026-10-03.txt` | la batterie avant et après |
| `narvos-reconstruit-v4` … `v13` | extractions intermédiaires de mesure (140 Mo chacune) — supprimables |
