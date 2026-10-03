# Système modulaire — extraction de MPFB2 et HumGen3D

Analyse des deux addons pour en tirer une base de création de personnages
homme/femme évolutive. **Tout ce qui suit est mesuré**, pas estimé.

Emplacements (hors dépôt) :
- `C:\Users\aniss\OneDrive\Bureau\Nouveau dossier\mpfb2-master`
- `C:\Users\aniss\OneDrive\Bureau\Nouveau dossier\HumGen3D-main`
- `C:\Users\aniss\Downloads\mpfb2-master.zip`

---

## 1. Ce que contient réellement chaque addon

### MPFB2 — les assets sont là

| Dossier | Fichiers | Poids | Contenu |
|---|---|---|---|
| `data/targets/` | 1445 | **40 Mo** | Morphs, par région du corps |
| `data/rigs/` | 18 | 29 Mo | Squelettes |
| `data/3dobjs/base.obj` | 1 | 1,7 Mo | **Le mesh de base MakeHuman** |
| `data/mesh_metadata/` | 6 | 609 Ko | Groupes de sommets par partie du corps |
| `data/textures/` | 12 | 1,7 Mo | Peaux |
| `data/uv_layers/` | 13 | 564 Ko | Jeux d'UV |

Mesh de base : **19 158 sommets · 18 486 faces**.

Répartition des morphs (1260 hors `_images`, qui sont les vignettes) :

```
macrodetails 349   breast 228   expression 102   eyes 68   asym 62
legs 58   arms 50   mouth 44   ears 44   nose 42   torso 34
feet 30   head 27   hands 22   neck 20   cheek 16   chin 15
hip 14   stomach 8   forehead 8   genitals 6   eyebrows 6
pelvis 4   buttocks 2
```

`macrodetails` (349) = ethnie × genre × âge — `african|asian|caucasian` ×
`male|female` × `baby|child|young|old`. Ce sont les curseurs de haut niveau ;
tout le reste affine.

### HumGen3D — le code, pas les assets

Le dépôt contient `human/{body,face,hair,skin,eyes,clothing,height,age,keys,pose,expression}`
en **GPL-3.0**, mais ses corps et vêtements arrivent par **packs de contenu
payants** téléchargés par `humgen3d_updater`. Il n'y a donc **rien à extraire
côté assets** — seulement l'architecture et le modèle d'interface.

### Licence — le point qui décide de tout

`data/3dobjs/base.obj` porte cet en-tête :

> « This asset was explicitly released as CC0 in september 2020. »

Le mesh de base MakeHuman et ses targets sont en **CC0** : utilisables dans un
projet commercial sans contrainte. C'est précisément la raison d'être de
MakeHuman. Les assets HumGen3D, eux, sont sous licence commerciale — leur code
peut inspirer, leurs assets non.

**Conclusion : la source d'assets corps, c'est MPFB2. HumGen3D sert de modèle
d'architecture et d'interface.**

---

## 2. Le système modulaire, extrait

### MakeHuman / MPFB2 : un seul mesh, déformé

C'est le cœur, et c'est l'opposé de ce que fait NARVOS aujourd'hui.

```
base.obj (19 158 sommets)
    │
    ├── + macrodetails   (genre, ethnie, âge)      ─┐
    ├── + torso/legs/arms (gabarit)                 │  deltas de sommets
    ├── + head/nose/mouth (visage)                  │  additionnés
    └── + asym            (asymétrie naturelle)    ─┘
    │
    └──> UN mesh unique, une seule peau, un seul skinning
```

Un target est un fichier `.target.gz` : du texte gzippé listant
`index_sommet dx dy dz`. On l'applique en additionnant les deltas, pondérés par
la valeur du curseur. Trois propriétés en découlent :

1. **Aucune couture.** Il n'y a jamais deux meshes à raccorder — le buste et les
   jambes sont le même maillage.
2. **Combinatoire gratuite.** 1260 morphs additionnables donnent un espace de
   morphologies continu, pas un catalogue de variantes.
3. **Un seul skinning.** La topologie ne change jamais, donc les poids d'os sont
   calculés une fois pour toutes.

### HumGen3D : le corps comme socle, l'équipement par-dessus

`human/` sépare le corps (`body`, `face`, `height`, `age`, `skin`, `keys`) de ce
qui se pose dessus (`clothing`, `hair`). Les vêtements sont des meshes distincts
ajustés au corps après coup — pas des morphs.

Côté interface, la capture d'écran montre le patron à reprendre pour le Marchand :

```
[ rail de catégories ]  [ champ de recherche          ]
                        [ ▦ ▦ ▦ ▦ ]  grille de vignettes
                        [ ▦ ▦ ▦ ▦ ]  cliquer = appliquer
```

Catégorie → recherche → grille de vignettes → application immédiate sur l'aperçu.

---

## 3. Ce que fait NARVOS aujourd'hui, et l'écart

NARVOS **échange des meshes GLB entiers** par emplacement. D'où toute la
machinerie de `characters/modular/` : `bindFit.ts`, `boneRemap.ts`,
`rebindSkinnedMesh.ts`, `weightedCoverage.ts` — tout ce code existe pour faire
tenir ensemble des morceaux qui viennent de squelettes différents.

| | MakeHuman / MPFB2 | NARVOS actuel |
|---|---|---|
| Corps | 1 mesh + deltas | N meshes échangés |
| Morphologie | continue (1260 morphs) | discrète (archétype × gabarit) |
| Coutures | aucune | à masquer (`SLOT_HIDES`) |
| Skinning | une fois | re-bind par pièce |
| Nouveaux assets | +1 fichier target | +1 GLB à re-rigger |

**La contrainte qui tranche : un morph target est indexé par numéro de sommet.**
Il ne s'applique QUE sur la topologie MakeHuman exacte (19 158 sommets). Un
target n'a aucun sens sur un mesh découpé depuis un personnage du commerce.

Cette contrainte technique produit exactement la séparation demandée :

| Onglet | Topologie | Source |
|---|---|---|
| **Corps** | MakeHuman, 19 158 sommets | `base.obj` + morphs CC0 |
| **Création** | MakeHuman | variantes d'anatomie sur la même topologie |
| **Marchand** | quelconque | meshes découpés, ajustés par-dessus |

Autrement dit : les modèles découpés **ne peuvent pas** être du corps, ils ne
peuvent être que de l'équipement. La règle métier et la contrainte technique
disent la même chose.

---

## 4. État du code après cette session

`bodySlots.ts` porte maintenant la taxonomie des trois onglets, **dérivée** de
`slotSource` et `REQUIRED_SLOTS` (jamais réécrite à la main, donc un nouvel
emplacement ne peut pas être oublié) :

```ts
export type EditorTab = "corps" | "creation" | "marchand";
export function tabForSlot(slot: BodySlot): EditorTab;
export function slotsInTab(tab: EditorTab): BodySlot[];
export function isCreationTab(tab: EditorTab): boolean;  // false pour marchand
```

8 tests neufs verrouillent le contrat, dont celui qui compte : aucun emplacement
d'équipement ne peut atterrir dans un onglet de création, et aucun emplacement
n'est orphelin.

Déjà en place avant cette session, et conforme à la demande : `slotSource()`
route l'anatomie vers le créateur et le reste vers le marchand, et
`ModularCreatorScreen` ne lit que `editableSlots("anatomy", …)`.

Reste à faire côté UI : monter les trois onglets et la grille de vignettes du
Marchand.

---

## 5. Pipeline d'intégration des assets corps

Pour amener les 1260 morphs et le mesh de base dans le moteur.

1. **Convertir `base.obj` → GLB**, en préservant l'ordre des sommets. C'est la
   condition de tout le reste : si l'export réordonne les sommets, tous les
   targets deviennent faux, en silence et sans erreur.
2. **Décompresser les `.target.gz`** et les convertir en un format compact
   (`Int32Array` d'indices + `Float32Array` de deltas), un fichier par région.
3. **Appliquer au runtime** en additionnant les deltas pondérés dans un
   `BufferAttribute` de positions, puis `computeVertexNormals()`.
4. **Rigger une fois** sur le mesh de base et garder les poids : la topologie ne
   bougeant jamais, le skinning reste valide quelle que soit la morphologie.
5. **Vérifier avant d'intégrer**, comme demandé : un asset ne rentre que s'il
   fonctionne avec le système et respecte la séparation corps / équipement.

Point de vigilance : les 349 `macrodetails` couvrent ethnie × genre × âge. Pour
un MMO, `baby` et `child` sont probablement hors sujet — filtrer réduit d'emblée
le volume à charger.

---

## 6. Décision à prendre

Deux voies, et elles ne se mélangent pas bien :

- **Porter les morph targets** — gros chantier (pipeline de conversion, moteur de
  morphs, re-rig), mais donne une morphologie continue et supprime les coutures
  et le re-bind. C'est ce que demande « une base modulaire pour exploiter tous
  les futurs assets corporels ».
- **Rester sur l'échange de meshes** — l'existant fonctionne, mais chaque nouvel
  asset corps demande un re-rig, et le nombre de morphologies reste discret.

Les deux peuvent coexister un temps : le Marchand restera de toute façon en
échange de meshes, puisque les modèles découpés n'ont pas la topologie MakeHuman.