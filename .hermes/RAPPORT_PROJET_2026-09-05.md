# Rapport de session — 2026-09-05

Port **nanos world**. Animations UEFN portées, pack réparé, PNJ rendus visibles.
**Première session où le jeu a été vu tourner.**

---

## Métriques à la clôture

| mesure | valeur | commande |
|---|---|---|
| Animations dans le pack | **3 216** (1 842 + 1 374) | `[assets.animations]` d'`Assets.toml` |
| Assets du pack | 12 442 | `nanos-build-asset-pack.mjs` |
| Assets sous `/Game/Narvos` | 17 750 | `adk-dump-assets.py` |
| Références mortes | 0 | `narvos-verifier-catalogues.mjs` |
| Assertions Lua | 347 sur les harnais touchés, 0 échec | `run` 160 · `commandes` 107 · `voyage` 80 |
| Fichiers `node --check` | 43 | `lua-harness/syntaxe-check.mjs` |
| Tick serveur au repos | **3,47 ms** (budget 33) | `--profiling`, 12 min |

---

## 1. Ce qui marche maintenant et ne marchait pas

Le jeu se lance, le pack charge, le personnage s'affiche, 112 IPS côté client.
Avant cette session, l'écran de création n'avait **jamais été vu tourner**.

Trois défauts le bloquaient, tous silencieux, tous distincts.

---

## 2. `Assets.toml` invalide — le pack entier refusé

**Une clé nue TOML n'admet que `A-Za-z0-9_-`.** 26 animations d'AimOffset
nommées `M_Neutral_AO_Crouch_X+135_Y+90` rendaient le manifeste illisible :

```
Failed to load Asset Pack 'narvos'. Reason:
  toml::parse_key_value_pair: invalid key value separator `=`
```

**12 441 assets perdus pour 26 noms.** Quatre contrôles ne l'ont pas vu : le
builder sortait en code 0, l'inventaire donnait les bons comptes, le vérificateur
lit le TOML à la ligne, et `narvos-anims-to-lua.mjs` filtrait les clés sur
`[A-Za-z0-9_]` — il **perdait 75 noms en silence**, dont 49 RobotGirl invisibles
au Lua depuis des semaines.

### Le piège dans le piège : nanos réécrit le manifeste

Quoter les clés produit un TOML valide, le serveur le charge — **puis le
corrompt**. Mesuré, empreintes à l'appui :

```
avant démarrage  1 532 868 o  CRLF=0      valide, clés quotées
après démarrage  1 544 716 o  CRLF=12502  invalide, zéro quote
```

`Loading and caching local Asset Pack` réécrit le fichier sans quoter. Le serveur
charge une fois, sur notre version ; le **client** lit le même fichier 48 s plus
tard par la jonction et n'a **plus aucun asset** — d'où les placeholders rouges
en jeu, pris à tort pour un écran de création cassé.

**Correctif : les noms doivent être légaux, pas quotés.** 26 assets renommés dans
l'ADK (`X+135` → `X135`, le `-` étant légal), et le builder **refuse désormais
d'écrire** en nommant les coupables. Balayage de contrôle : 17 750 noms, zéro
illégal — le filtre porte sur la forme, pas sur le `+` du premier incident.

⚠ **Toujours lire le journal CLIENT** (`%LOCALAPPDATA%/NanosWorld/Saved/Logs/`).
Serveur et client divergeaient sur le même fichier à une minute d'intervalle.

---

## 3. PNJ invisibles — une erreur d'unité, pas un asset manquant

**Unreal compte en centimètres, les GLB du prototype web sont en mètres.** Un
humain à `1.70` mesure 1,7 cm : il est là, devant le joueur, haut comme un ongle.

Mesuré sur les 72 meshes du menu (`get_bounds().box_extent.z × 2`) :

```
41 meshes > 50 u   déjà en centimètres (mannequins 182,6 · modulaires 186,6)
31 meshes <  5 u   en MÈTRES — invisibles
```

⚠ **La conversion ne pouvait pas être globale** : un `×100` sur les 41 autres en
aurait fait des géants de 180 mètres. D'où une mesure par asset, écrite dans
`WebPortal/Server/adk/_pnj-bounds.json` et lue par le générateur.

Le facteur artistique se **multiplie** : le crabe Aquarys fait 0,004 u et portait
déjà `×400` ; sans le `×100` il atteignait 1,6 cm. `0,004 × 400 × 100 = 160 cm`.

Écrit : 30 entrées à `echelle = 100`, une à `40000`, 41 sans échelle.

---

## 4. « Modèles gris » — un seul l'était

Premier détecteur : faux positifs. Il cherchait le **nom** `WorldGridMaterial`,
or quatre meshes ont un matériau local qui porte légitimement ce nom, importé
depuis leur GLB avec ses textures. Le critère est le **chemin** : `/Engine/…`.

Balayage corrigé : **71 correctement texturés, 1 gris**.

`mob_boss` n'avait ni matériau ni texture — sa couleur est dans l'attribut
**`COLOR_0` de ses sommets**. Rien à rebrancher. Créé `M_NarvosCouleurSommet`
(`VertexColor.RGB` → BaseColor, rugosité 0,75), assigné, **vérifié par
relecture**.

⚠ `materials` est un tableau de **structs** : modifier un élément rendu par
`get_editor_property` agit sur une copie. La première écriture a « réussi » et la
relecture montrait toujours l'ancien matériau, sans erreur.

⚠ `boss_mob.glb` n'est PAS le jumeau texturé de `mob_boss` — je l'ai cru et
c'était faux. Son unique texture est une bande `PaletteMetallicRoughness` 64×4 et
son `baseColorFactor` vaut 1,1,1,1 : il rendrait **blanc**. Il est en outre
refusé à l'import (`KHR_texture_basisu`).

---

## 5. Les 1 374 animations UEFN portées sur le squelette nanos

`RTG_UEFN_to_UE4_Mannequin`, un IK Retargeter écrit par Epic, appliqué en lot par
`scripts/adk-retarget-anims.py`. Vérifié une à une contre le registre : 13 lots,
source = sortie sur chacun, **1 374/1 374 sur `SK_UE4_Mannequin`**, zéro
illisible.

Les 327 écartés des 1 701 sont des PoseSearchDatabase, montages et blendspaces —
hors `PlayAnimation`.

### Le squelette nanos a 126 os, pas 68

Mesure contredisant ce que le projet croyait. Les 68 du Mannequin UE4 sont un
**sous-ensemble strict** : zéro absent. Les 58 en plus sont des terminateurs de
feuille (`ball_l_end`, et leurs doublons `*_end_end` — signature d'un
aller-retour d'export refait deux fois). 11 os ne diffèrent que par la **casse** :
`FName` est insensible à la casse, comparer des `str` Python fabrique 11 faux
écarts.

Les 1 374 ont ensuite été passées sur `SKEL_Mannequin` par **Replace Skeleton**
(action d'éditeur, non exposée à l'API). Pistes vérifiées après coup : 68 pistes
d'os conservées, mêmes noms, images intactes.

Le squelette UE4 intermédiaire a été supprimé et la compatibilité retirée : les
animations **sont** sur le squelette nanos, plus rien à faire voyager.

---

## 6. Outillage nouveau

### `scripts/ue-remote.py` — piloter l'éditeur depuis le shell

Le pont UnrealMCP (TCP 55557) expose Blueprints, acteurs, matériaux — **aucune
exécution de Python**. La voie qui marche est l'exécution distante de
`PythonScriptPlugin`, avec le client que le moteur livre lui-même.

Activation : une case à cocher, **sans redémarrage** (le seul réglage de sa
section sans `ConfigRestartRequired`). Vérifier par `Get-NetUDPEndpoint` sur le
port **6766**.

⚠ Deux pièges payés : `MODE_EXEC_STATEMENT` refuse tout ce qui dépasse une
instruction (le multi-lignes passe par `MODE_EXEC_FILE`) ; et `print` vers un
flux cp1252 lève `UnicodeEncodeError` et **tue le pilote alors que la commande
distante a parfaitement tourné**.

UnrealMCP installé dans GameAnimationSample **et** dans l'ADK (DLL préconstruite,
BuildId 47537391 identique au moteur — aucune recompilation).

---

## 7. Le tick serveur — mesuré, et ce n'est pas notre Lua

```
Server Tick                      74 mesures   moy 3,47 ms   max 7,1 ms
Waiting Lock Critical Data - Trigger Thread   4340   5884 ms   (async)
Actors Tick Preparation                       1059   1444 ms
avertissements « Tick time extremely high » : 0
```

**Zéro avertissement sur 12 minutes de jeu — sans la map chargée.** Le pic à
92 ms et la moyenne à 39 ms observés plus tôt étaient **avec la Forge** et ses
1 461 entités `StaticMesh`.

Piste creusée et **écartée** : `InstancedStaticMesh`. Mesuré — `Map_forge_map`
1 461 entrées, **1 461 meshes uniques, répétition 1,00**. Il rend N copies d'UN
mesh ; il ne s'applique pas. La doc exige en outre que chaque matériau soit marqué
« Used with Instanced Static Meshes » (2 683 chez nous).

La voie restante est de **fusionner les meshes de map dans l'ADK** — non
commencée, et à ne pas engager avant d'avoir mesuré avec la map chargée.

---

## 8. Corrections de gameplay

- **`/noclip`** — son commentaire affirmait que `SetFlyingMode` coupe la
  collision. **Faux, vérifié en jeu** : il ne coupe que la gravité. Ajout de
  `SetCollision(NoCollision)`, et `Normal` au retour (pas `Auto`).
- **`/mapz <n>`** — déplace la Forge en Z, hauteur absolue. Les meshes portent
  leur transform monde cuite : déplacer l'origine déplace tout. ⚠ Ne bouge ni
  portails ni spawns.
- **Tab** — « ranger ce qu'on tient » (`GetPicked` puis `Drop`). Quatre fichiers
  alignés : le catalogue majuscule tout, le moteur veut `Tab`, la conversion se
  fait au seul point d'appel d'`Input.Register`, comme pour les chiffres.
  ⚠ Tab lâche l'ARME, pas les vêtements — ceux-ci sont des slots du Vestiaire.

---

## 9. `Modular.TENUE_BASE` — piste de l'audit vérifiée et close

Fait exact, gravité nulle : les 3 familles trooper étaient absentes de
`FAMILLES`, donc jamais atteintes. **Cause : dans le générateur, `tenueBase` était
construit 125 lignes AVANT le filtre des familles sans corps.** Bloc déplacé.

Garde-fou ajouté — contrôle **« Modular liens »** dans le vérificateur : cohérence
INTERNE du catalogue (`TENUE_BASE` → `PIECES`, `CORPS.famille` → `FAMILLES`).
18 liens rompus détectés sur l'ancienne version, 0 après.

Troisième instance de la même règle : le vérificateur ne confrontait le catalogue
qu'au pack cuit — un inventaire **externe**. Les liens internes ne quittent jamais
le fichier.

---

## 10. Ce qui reste ouvert

1. **La map de la Forge est la mauvaise version.** Diagnostic complet :
   `chunks_v3` (28/07) porte 7 203 nœuds / 1 799 174 sommets ; `chunks_unreal`,
   `chunks_v2`, `chunks` et `chunks_webp_backup` en portent tous 12 988 /
   2 898 481 — le monolithe `halo_map.glb` du 21/07 n'a jamais été remis à jour.
   **Le seul jeu à la bonne géométrie est le seul qu'Unreal refuse** (KTX2).
   Deux voies : réexport Blender en PNG (ce qui a produit `chunks_unreal`), ou
   écrire un transcodeur KTX2 → PNG — outillage vérifié présent (`ktx-parse`,
   `public/basis/basis_transcoder`, format RGBA32 = 13, `sharp`).
2. **IA d'agression** — rien n'existe. `Spawner.lua` invoque et retire, c'est tout.
3. **Mutable modulaire** — voir [[project-mutable-bp-test]] ; à faire APRÈS le tick.
4. **Fusion des meshes de map** — l'optimisation du tick.
5. **12 corps Trooper disparus du menu de spawn** : il tire ses modulaires de
   `Modular.CORPS`, réduit à 4 pour des raisons de corps JOUABLE. Les assets sont
   toujours dans le pack ; découpler les deux questions rendrait le menu complet.
6. **Risque de licence** : UIWS, FlexiCam, FastAI, NPCEyesSightPRO et FGear —
   plugins Marketplace payants — sont dans `public/`, servi par HTTP. Le README de
   `_vendor_sources` dit que c'est précisément ce qui avait été corrigé.
7. **Halo** : `halo_map.glb` est de la géométrie Halo dans un pack de jeu, même
   nature de risque que les assets Ankama déjà notés.

---

## 11. Ce qui n'a pas été vu tourner

Les échelles des 31 PNJ, `mob_boss` coloré, `/noclip` corrigé, `/mapz` et **Tab**
sont livrés et cuits, mais **aucun n'a été observé en jeu**. Un redémarrage du
serveur suffit pour les cinq — ils vivent dans le Lua et le pack, pas dans un
recook.