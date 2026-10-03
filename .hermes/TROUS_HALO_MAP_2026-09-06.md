# Balayage des trous — `halo_map`, 2026-09-06

Méthode, résultat, cause. Liste exploitable :
`.hermes/trous_halo_map_2026-09-06.csv`.

---

## Méthode

Trois passes, chacune répondant à une question que la précédente laissait
ouverte.

**Précondition, vérifiée avant de tracer quoi que ce soit** : un balayage par
raycast ne vaut rien si la géométrie n'a pas de collision. Mesuré sur 400 meshes
distincts : **399 en ont**, le seul sans est `SM_SkySphere`. Le sol est donc
traçable.

**1. Emprise réelle.** Les bornes d'acteurs annonçaient un cube de 32 km — un
acteur aberrant les polluait. Un balayage grossier (25 921 rayons verticaux,
0,5 s) donne l'emprise de ce qui a de la collision, c'est-à-dire de ce sur quoi
un joueur peut marcher :

```
X ∈ [-280 000, 50 000]     Y ∈ [-10 000, 260 000]     Z ∈ [7 037, 100 580]
soit ≈ 3,3 km × 2,7 km
```

**2. Balayage fin.** Un rayon vertical tous les **250 uu** sur cette emprise :

```
1 525 681 rayons        706 285 touches        47 s
130 cellules suspectes  →  98 amas
```

Le critère n'est pas « le rayon ne touche rien » — hors carte, c'est normal.
C'est **« manque alors qu'au moins 6 de ses 8 voisins touchent »**, ce qui isole
les ouvertures ENCLAVÉES et laisse tranquilles le pourtour, le ciel et les
gouffres ouverts.

**3. Confirmation à 50 uu.** Un « trou » de 250 uu au balayage grossier peut
n'être qu'une fissure de 20 uu où le rayon a rasé une arête. Chaque amas est
re-testé au cinquième du pas, et on mesure sa **petite dimension** — c'est elle
qui décide si on tombe, pas la longueur.

Seuil : **90 uu**, le diamètre de la capsule d'un personnage.

---

## Résultat : 39 trous traversants, 1 fissure cosmétique

| largeur | nombre |
|---|--:|
| 400–550 uu | 3 |
| 300–350 uu | 18 |
| 200–250 uu | 12 |
| 100–150 uu | 6 |
| < 90 uu (cosmétique) | 1 |

Les cinq plus larges :

```
550 uu   ( 16 750,  11 500, 22 863)
500 uu   (-44 500, 130 250, 16 550)
450 uu   (-32 000, 103 750, 16 695)
400 uu   (-176 250, 92 000,  9 963)
350 uu   (-187 250, 115 000, 9 914)
```

---

## La cause : une couture, pas 39 défauts

En traçant autour de chaque trou pour savoir **quels meshes le bordent**, le
motif saute aux yeux.

| meshes bordant les trous | occurrences |
|---|--:|
| `ground_with_grass___ff_unearthed_zone_i__001` | 421 |
| `ground_with_grass___ff_unearthed_zone_i_` | 336 |
| `cliff_blend_2___ff_unearthed_zone_i_` | 120 |
| `polysurface1___forge_halo_shared_poops_` | 67 |
| `cliff_blend_005___ff_unearthed_zone_i_` | 54 |
| `large_mountain___forge_halo_shared_poops_` | 23 |

**≈ 25 des 39 trous sont alignés sur la frontière entre
`ground_with_grass…zone_i_` et `ground_with_grass…zone_i__001`** — les deux
moitiés du MÊME sol, séparées au découpage. Elles ne se rejoignent pas tout à
fait : il reste une fente de 100 à 400 uu le long de leur bord commun, de
(-151 750, 76 750) à (-193 750, 129 250), à altitude constante ≈ 10 000.

Ce n'est donc pas trente-neuf défauts d'art, c'est **une couture** — plus trois
trous isolés sur `polysurface1`, un sur `large_mountain`, et un point à
z = 36 502 qu'aucun mesh ne borde (probablement un faux positif : le rayon passe
entre deux structures hautes).

---

## Comment les combler — trois voies, trois coûts

**a. Rustines de collision.** Poser 39 volumes bloquants invisibles sur les
coordonnées relevées. Immédiat, ne touche à aucun asset. ⚠ Mais ça vit dans le
`.umap` : **nanos ne charge pas le niveau**, il pose les meshes par Lua. La
rustine ne suivrait donc pas jusqu'au jeu.

**b. Rustines côté nanos.** Les mêmes 39 volumes, mais posés par `MapLoader` /
un catalogue Lua. Ça, ça suit. Coût : un petit catalogue de 39 entrées, et
c'est de la collision invisible — aucun impact visuel.

**c. Réparer la géométrie.** Recoller les deux moitiés de `ground_with_grass`
dans le GLB source, puis re-chunker et réimporter. C'est la vraie correction,
et elle règle aussi l'aspect (une fente se voit, pas seulement se traverse).
Coût : passer par le monolithe, `scripts/puzzle-chunks.mjs`, réimport, recook.

⚠ Rien n'a été modifié : ni le niveau, ni un asset. La mesure d'abord, la
décision ensuite.

---

## Note d'outillage

Les captures d'écran du MCP sont revenues **identiques** après chaque
déplacement de caméra — même MD5 — alors que la caméra bougeait bien
(relu par `get_level_viewport_camera_info`). Unreal ne redessine pas la vue
quand sa fenêtre n'a pas le focus. Pour obtenir des images fraîches, il faut que
l'éditeur soit au premier plan. Les coordonnées, elles, sont exactes.

---

# Réparation — faite le 2026-09-06

## Ce qui a changé par rapport au plan

Tu avais retenu **(c)** pour la couture — recoller les deux moitiés dans le GLB
source — et **(b)** pour les isolés. La mesure a écarté (c) tel quel :

```
ground_with_grass___ff_unearthed_zone_i_       loc [-690, 290, 230]  scale 1  rot 0
ground_with_grass___ff_unearthed_zone_i__001   loc [-690, 290, 230]  scale 1  rot 0
```

Les deux moitiés sont au **même transform** : la géométrie est cuite dans les
sommets. Ce n'est donc pas un écart de placement qu'on corrige en déplaçant un
acteur — c'est un trou dans les triangles, et le refermer demande une soudure
dans Blender sur un monolithe de 3 Go, puis re-chunkage, réimport, recook.

Voie prise à la place, qui sert les deux intentions : **fabriquer la géométrie
manquante dans Unreal**. Elle est cuite dans le pack, donc elle atteint nanos —
ce que (b) visait — et c'est de la vraie géométrie, ce que (c) visait.

⚠ Geometry Scripting n'est pas activé dans l'ADK : pas de fabrication de mesh à
la demande. On réutilise donc le cube du moteur, **dupliqué** sous
`/Game/Narvos/halo_map/patches/SM_Patch_Sol` — un asset de `/Engine/` ne serait
jamais cuit dans le pack.

## Résultat

```
trous traversants   39  ->  0
dalles posées                43
crevasses reclassées          4
```

**Les 4 « trous » restants n'en sont pas.** Le dénivelé du sol autour d'eux vaut
1 953 à 5 961 uu : ce sont des **crevasses verticales entre deux parois**. Un
rayon vertical les manque, un joueur qui marche ne les rencontre pas.

## L'essai raté, et pourquoi il compte

Première tentative sur ces 4 : une dalle assez épaisse pour couvrir le dénivelé.
Ça bouchait — et c'était pire. Mesuré en tirant une grille de rayons sur
l'emprise de chaque dalle pour voir ce qui est **en surface** :

```
PATCH_Pente_03   100 % de sa surface visible   1800 x 1800 x 3018
PATCH_Pente_06    98 %                         1800 x 1800 x 6234
```

Des cubes de 18 × 18 × 62 m posés SUR la montagne, pas enfouis dedans. Les 8 ont
été retirés. Les 43 restantes sont toutes sous 70 % de surface apparente.

**Une rustine qui se voit est un défaut de plus.** Le contrôle « quelle part de
la dalle est en surface » est ce qui a évité de livrer ça.

## Le chemin jusqu'à nanos

| pièce | rôle |
|---|---|
| `SM_Patch_Sol` | copie du cube moteur, sous `Narvos/` donc cuisible |
| `_patches-trous.json` | 43 transforms exportées de l'éditeur |
| `scripts/narvos-patches-to-lua.mjs` | génère le catalogue (simulation par défaut) |
| `Shared/Catalogs/Patches.lua` | 43 entrées, position **et** échelle |
| `MapLoader.PoserPatches` | pose les dalles, applique décalage et dimension |
| `Server/Index.lua` | appel **après** le chargement de la Forge, même décalage |

⚠ **Pourquoi un catalogue à part de `Map_forge_map.lua`** : celui-ci spawne tout
à `Vector(0,0,0)` parce que les transforms des meshes de carte sont cuites dans
les sommets. Les dalles sont UN cube réutilisé 43 fois — sans position ni
échelle explicites, elles s'empileraient à l'origine.

Contrôles : `syntaxe-check` 45 générateurs OK · `portee-check` aucun emploi
avant déclaration · `narvos-verifier-catalogues` a désormais un contrôle
**Patches** (ajouté : une seule référence morte ferait disparaître les 43 dalles
en silence).

## Deux réserves, à ne pas passer sous silence

**1. `SM_Patch_Sol` n'est pas encore dans le pack.** Il vient d'être créé ; le
vérificateur le signale `MANQUE`, et c'est correct tant que le cook n'a pas eu
lieu. Rien ne se posera en jeu avant.

**2. La carte scannée n'est pas celle que nanos charge.**

```
/Game/Narvos/halo_map/…          12 988 StaticMesh   ← le niveau ouvert, scanné, patché
/Game/Narvos/chunks_unreal_v3/      623 StaticMesh   ← ce que Map_forge_map.lua charge
```

Deux imports du même GLB source. Le balayage a mesuré le premier. Que les mêmes
trous existent dans le second est une **inférence**, pas une mesure : le
pipeline de `puzzle-chunks.mjs` regroupe et compresse (`flatten` → bucketing →
`prune`/`dedup` → `textureCompress` → `draco`) mais **ne soude aucun sommet** —
la fente du source survit donc au découpage, et les coordonnées monde sont les
mêmes. À confirmer par un balayage de `chunks_unreal_v3` si tu veux la certitude.

---

# Balayage de `chunks_unreal_v3` — la carte réellement livrée

## Monter la carte pour pouvoir la mesurer

`chunks_unreal_v3` n'a **pas de Level** : nanos spawne ses 623 meshes un par un
depuis le Lua, à `Vector(0,0,0)`. Pour la balayer, il a fallu la reconstruire —
niveau neuf `Narvos/_scratch/BalayageChunksV3`, 623 meshes posés à l'origine,
exactement comme le fait `MapLoader`. Les poser dans `halo_map` aurait tout
faussé : les deux versions occupent le même espace monde.

```
1 438 801 rayons        695 161 touches        48 s
165 cellules suspectes  →  133 amas  →  119 traversants
```

## Le tri qui compte — et mes deux erreurs de critère

**119 « trous » bruts. Douze en sont vraiment.**

Premier critère essayé, le dénivelé autour du point : mauvais. Sur un petit
trou, l'anneau de mesure est petit, donc le dénivelé reste faible **même sur une
falaise**. 97 trous sont passés au travers.

Second critère, la **pente locale** (plan ajusté aux moindres carrés sur 16
points de sol) : bien meilleur. Pente médiane des 119 : **47°**. Ce ne sont pas
des trous de sol, ce sont des interstices entre parois rocheuses.

Troisième filtre, ajouté après un ratage : sur un sommet, l'anneau touche le
haut du relief et la médiane des altitudes atterrit **12 000 uu au-dessus** du
trou. Quatre dalles ont été posées en plein ciel avant que ça se voie. D'où la
seconde condition : **l'altitude ajustée doit concorder avec celle du trou**
(écart < 500 uu).

```
pente ≤ 30°  ET  |écart| < 500 uu   →   12 vrais trous de sol
```

Tous sur la couture `ground_with_grass`, aux mêmes coordonnées que dans
`halo_map`. L'inférence de la section précédente était juste : **le découpage ne
soude pas**, la fente du GLB source survit.

## Réparation — 17 dalles, cohérentes visuellement

Trois règles, chacune corrigeant un essai raté :

| règle | ce qu'elle évite |
|---|---|
| matériau **du sol qui borde ce trou-là** | une dalle d'herbe au milieu de la roche |
| orientée sur la **pente locale**, inclinaison plafonnée à 25° | une dalle horizontale qui dépasse d'un côté sur une pente |
| altitude = **médiane** de l'anneau, jamais l'intercept du plan ajusté | les dalles à 12 000 uu au-dessus du sol |

12 dalles + 5 compléments : cinq trous restaient percés parce que l'ouverture
réelle était **à côté** du centre de l'amas, pas dessous — épaissir ne changeait
rien, il fallait relocaliser.

**Contrôle final : 441 rayons sur chacun des 12 trous → 0 cellule sans sol.**
Aucune dalle n'excède 71 % de surface apparente.

---

# Végétation — 300 touffes

Contraintes tenues (skill `narvos-level-design`) :

- **pente locale sous 25°** — le moteur marche jusqu'à 60°, l'herbe ne pousse pas
  sur une paroi ;
- le sol touché doit porter un **matériau d'herbe**, lu au raycast, pas deviné ;
- position bruitée, **échelle et rotation variées dans le groupe** : « la
  végétation est la première source de bruit visuel », quatre clones alignés se
  voient ;
- **plafond à 300** sur 2 355 emplacements éligibles. Le coût du tick nanos est
  le NOMBRE d'entités et la Forge en pose déjà 623 : monter ce chiffre est un
  arbitrage de performance, pas de décoration.

Rejets mesurés : 4 259 pour la pente, 341 pour le matériau, 7 409 sans sol.

## ⚠ Pas d'arbres, et ce n'est pas un oubli

Le pack de base nanos contient **449 props et aucun arbre** — un chou-fleur et un
ananas sont les seules plantes. L'ADK n'en a pas davantage : les seules
disponibles sont les **quatre touffes** `SM_MWAM_Grass A/B/C/D` du pack
MWLandscapeAutoMaterial.

Poser des arbres demande d'abord un import. La matière existe :
`public/models/nature/` — 14 packs, 695 GLB, 13 Go — au format web. C'est un
chantier d'import, pas un placement.

---

# État — ce qui manque pour que ça vive en jeu

```
Patches.lua      17 dalles     1 référence morte : SM_Patch_Sol
Vegetation.lua  300 touffes    4 références mortes : SM_MWAM_Grass A/B/C/D
```

**Les cinq assets sont dans le projet, aucun n'est dans le pack cuit.** Le
vérificateur les signale — c'est exactement ce qu'on lui demande. Un cook les
fait entrer, et rien ne se posera en jeu avant.

Contrôles verts par ailleurs : 46 générateurs compilent, tous les Lua compilent,
aucun emploi avant déclaration.

---

# Les traînées noires des falaises — 289 matériaux simple face

La capture du user montre des **traînées noires verticales** sur les parois.
Elles ne sont pas dans le balayage : un rayon vertical passe à côté d'une face
verticale. Et ce ne sont pas des trous de géométrie.

**Une surface simple face vue de l'arrière n'est pas dessinée — Unreal laisse du
noir.** Sur une falaise faite de plaques importées d'un GLB, où l'orientation des
faces n'est pas garantie, ça se lit exactement comme un trou.

C'est une propriété de MATÉRIAU, ce qui rejoint le « c'est dû à l'auto texture »
du user : la cause était bien du côté matériau, pas de la géométrie.

```
matériaux de chunks_unreal_v3   707
        simple face             289   ->   0
        double face             418   ->  707
```

289 fichiers réécrits sur disque, vérifiés par leur date de modification.

⚠ **Ce n'est pas gratuit.** Le double face double les triangles ombrés sur ces
surfaces et retire quelques optimisations d'occlusion. C'est le compromis usuel
pour du décor importé depuis un GLB ; si le coût se voit au profilage, il faudra
restreindre aux seuls matériaux de falaise plutôt que de revenir en arrière.

⚠ **Deux pièges de l'API, tous deux muets :**

- sur une **instance**, poser `two_sided` ne suffit pas — il faut armer
  `override_two_sided`, sinon la valeur du parent continue de s'appliquer ;
- la plupart des `MTL_*` de cette carte sont des **UMaterial**, pas des
  instances : `base_property_overrides` n'existe pas dessus. Tester la classe
  RÉELLE de l'asset, jamais se fier au préfixe du nom.

Et un rappel de méthode : le premier passage a bien écrit les 289 assets **puis
a échoué en écrivant son rapport**. Sans le recomptage indépendant, on aurait
conclu à un échec total et refait le travail.