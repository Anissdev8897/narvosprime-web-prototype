# MODULAR_GARDEROBE_CUITE — chiffrage de l'élargissement de `narvos-modular-to-lua.mjs`

Date : 2026-09-09 · Auteur : Kimi · Suite de : MISSION_KIMI_FAB_20260909.md §2
**Lecture seule : aucun code modifié, aucun `--apply` lancé.**

---

## 0. Le verdict d'abord

Le §2 de Claude a raison sur le constat (une garde-robe MetaCustom entière est cuite
et inutilisée, et le générateur ne la voit pas) mais **se trompe sur l'obstacle** — et
c'est l'obstacle qui fixe le prix. Il écrit : « leurs noms d'os concordent avec
SKEL_Mannequin, vérifié […] le seul obstacle est le mélange des VOLUMES ».

**Re-mesuré sur les `.uasset` eux-mêmes : les pièces MetaCustom ne sont PAS liées à
`SKEL_Mannequin`.** Elles pointent sur `Skel_Dummy` (et `metahuman_base_skel` pour
certaines), un squelette de type MetaHuman avec os twist, os correctifs et doigts
complets — des centaines d'os, pas 68. `AddSkeletalMeshAttached` exige « the same
skeleton used by this Actor's mesh » (SKILL.md §6, ligne 308) : ces pièces seront
**refusées à l'attachement**, avant même que la question des volumes se pose. C'est
exactement le problème que le générateur a déjà mesuré et documenté pour la famille
MetaHuman GLB, désactivée pour ça (`METAHUMAN_ACTIF = false`,
`scripts/narvos-modular-to-lua.mjs:45-68`).

Conséquence sur le chiffrage : élargir le générateur est la partie **facile** (~150
lignes). La partie **coûteuse** est en amont : rebinder les meshes sur `SKEL_Mannequin`
dans l'éditeur, ou renoncer à `AddSkeletalMeshAttached` pour ces pièces.

---

## 1. Re-mesure : les pièces dans `Assets.toml`

Fichier : `WebPortal/Server/Assets/narvos/Assets.toml` — 67 406 lignes (confirmé par
`wc -l`). Toutes les entrées citées sont dans la section `[assets.skeletal_meshes]`
(qui court de la ligne 43603 à la ligne 45706).

### 1.1 Les 27 noms cités par Claude — TOUS PRÉSENTS (27/27)

Sortie brute (grep sur les 27 noms, section `[assets.skeletal_meshes]`) :

```
45023: SK_Belt              = "Narvos/MetaCustom/Metawadrobe/Meshes/F_Tal_Nrm_Medieval/SK_Belt"
45027: SK_Boots             = "Narvos/MetaCustom/Skeletal_Meshes/Metahuman_Tall_Medium_Female/SK_Boots"
45028: SK_Boots_2           = "Narvos/MetaCustom/Skeletal_Meshes/Metahuman_Tall_Medium_Male/SK_Boots_2"
45046: SK_Dress             = "Narvos/MetaCustom/Metawadrobe/Meshes/F_Tal_Nrm_Medieval/SK_Dress"
45047: SK_Dress_Sim         = "Narvos/MetaCustom/Metawadrobe/Meshes/F_Tal_Nrm_Medieval/SK_Dress_Sim"
45092: SK_Inner_Clothing    = "Narvos/MetaCustom/Skeletal_Meshes/Metahuman_Tall_Medium_Male/SK_Inner_Clothing"
45093: SK_Jacket            = "Narvos/MetaCustom/Skeletal_Meshes/Metahuman_Tall_Medium_Male/SK_Jacket"
45129: SK_Male_Armor_Bottoms= "Narvos/MetaCustom/Metawadrobe/Meshes/M_Tal_Nrm_Medieval/SK_Male_Armor_Bottoms"
45130: SK_Male_Armor_Top    = "Narvos/MetaCustom/Metawadrobe/Meshes/M_Tal_Nrm_Medieval/SK_Male_Armor_Top"
45167: SK_Meta_Female_Base  = "Narvos/MetaCustom/Skeletal_Meshes/Metahuman_Tall_Medium_Female/SK_Meta_Female_Base"
45168: SK_MetaP             = "Narvos/MetaCustom/Skeletal_Meshes/Metahuman_Tall_Medium_Female/SK_MetaP"
45169: SK_MetaP1            = "Narvos/MetaCustom/Skeletal_Meshes/Metahuman_Tall_Medium_Female/SK_MetaP1"
45171: SK_Pants             = "Narvos/MetaCustom/Skeletal_Meshes/Metahuman_Tall_Medium_Female/SK_Pants"
45172: SK_Pants_2           = "Narvos/MetaCustom/Skeletal_Meshes/Metahuman_Tall_Medium_Male/SK_Pants"
45173: SK_Pants3            = "Narvos/MetaCustom/Skeletal_Meshes/Metahuman_Tall_Medium_Male/SK_Pants3"
45205: SK_Sci_Fi_Armor      = "Narvos/MetaCustom/Skeletal_Meshes/Metahuman_Tall_Medium_Female/SK_Sci_Fi_Armor"
45206: SK_Sci_Fi_Jumpsuit   = "Narvos/MetaCustom/Skeletal_Meshes/Metahuman_Tall_Medium_Female/SK_Sci_Fi_Jumpsuit"
45211: SK_Set_1_Crop_Top    = "Narvos/MetaCustom/Skeletal_Meshes/Metahuman_Tall_Medium_Female/SK_Set_1_Crop_Top"
45212: SK_Set_1Shorts       = "Narvos/MetaCustom/Skeletal_Meshes/Metahuman_Tall_Medium_Female/SK_Set_1Shorts"
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
| « l'en-tête dit que les deux familles passent AddSkeletalMeshAttached, noms d'os concordant avec SKEL_Mannequin, vérifié » | L'en-tête dit textuellement : « Les DEUX passent AddSkeletalMeshAttached : leurs noms d'os concordent avec SKEL_Mannequin, vérifié. » (lignes 11–12) | **Textuellement exact, mais l'en-tête est un leurre** — voir ci-dessous |
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->

## 4. Re-mesure : le squelette des pièces — **là où Claude se trompe**

Vérifié **sans l'éditeur**, par extraction de chaînes dans les `.uasset` binaires
(source ADK et version cuite du pack) :

```
SK_Shirt.uasset (ADK)            → /Game/Metahuman_Customization_System/Meta_Body_Tool/Skeletal_Meshes/Skel_Dummy
SK_Shirt.uasset (CUIT, pack)     → /Game/Metahuman_Customization_System/Meta_Body_Tool/Skeletal_Meshes/Skel_Dummy   (inchangé par le cook)
SK_Sci_Fi_Jumpsuit.uasset        → Skel_Dummy
SK_Boots.uasset                  → Skel_Dummy
SK_Meta_Female_Base.uasset       → Skel_Dummy
SK_Dress.uasset                  → metahuman_base_skel   (⚠ un AUTRE squelette, même pack)
```

`Skel_Dummy` contient des os `calf_correctiveRoot_l`, `lowerarm_correctiveRoot_l`,
`calf_twist_01/02`, `clavicle_pec`, `index_01_mcp/pip/dip`, `index_metacarpal`… :
plusieurs centaines de noms de type os (605 chaînes uniques candidates extraites —
surestimation, mais l'ordre de grandeur est sans appel face aux 68 os du Mannequin).
Ce sont les os **twist et correctifs MetaHuman**, précisément le schéma « INTERCALE »
mesuré le 2026-09-03 sur les GLB MetaHuman. `SKEL_Mannequin.uasset`, lui, contient des
twist (le Mannequin UE4 en a) mais `spine_01..03` et `neck_01` seulement — pas de
`spine_04/05`, pas de `neck_02`, pas de correctives.

**Trois conséquences :**

1. **Squelette lié ≠ `SKEL_Mannequin`** → `AddSkeletalMeshAttached` exigeant le même
   squelette, ces pièces seront refusées à l'attachement sur un `Character` standard.
   L'affirmation « les noms d'os concordent » est vraie seulement pour le sous-ensemble
   des noms communs — c'est le piège « IK SEULS » déjà documenté dans le générateur
   (lignes 50-62).
2. **Référence pendante dans le pack cuit** : les meshes pointent
   `/Game/Metahuman_Customization_System/…`, or le pack `WebPortal/Server/Assets/narvos/`
   ne contient que l'arbre `Narvos/` (`grep Metahuman_Customization_System Assets.toml`
   : 0). Une *copie* de `Skel_Dummy` est bien cuite sous
   `Narvos/MetaCustom/Meta_Body_Tool/Skeletal_Meshes/`, mais **aucun mesh ne la
   référence** — c'est le motif « références internes cassées après copie » du SKILL
   §22, version squelette au lieu de matériau. (Le mesh cuit embarque son RefSkeleton
   dans l'`.uexp`, donc il *charge* probablement ; c'est la comparaison de squelette à
   l'attachement qui échoue.)
3. **Même les corps de base MetaCustom ne sauvent pas le plan** : `Character` impose le
   Mannequin (SKILL §6, « CharacterSimple accepte n'importe quel mesh »). Un PNJ civil
   en `SK_Meta_Female_Base` devrait être un `CharacterSimple`, ce qui sort du chemin
   `Builder.Habiller` actuel.

Sur le « 212 os » du brief pour SKEL_Mannequin : non confirmé. Le SKILL (§19, mesuré
en jeu) dit 68 ; l'extraction brute du `.uasset` rend 813 chaînes candidates (incomptable
ainsi). Je retiens 68, source SKILL vérifiée.

---

## 5. Qui consomme `Modular.lua` — le chemin d'appel complet

- `Shared/Index.lua:87` — `Narvos.Modular = Package.Require("Catalogs/Modular.lua")`.
- **Création joueur** : `Shared/Logic/CharacterCreation.lua:197-237` — `Modular.Corps`,
  `CorpsParGenre`, `TenueDefaut`, puis `ValiderTenue`.
- **Habillage** : `Shared/Logic/Character.lua` — `Builder.Habiller` (ligne 477) lit
  `Modular.PIECES`, teste `PorteurCachable` (ligne 484) et appelle
  `character:AddSkeletalMeshAttached(slot, piece.asset)` (ligne 550).
- **Vestiaire/boutique** : `Shared/Logic/Vestiaire.lua` (prix, essais, validation) et
  `narvos-map-proto/Server/Vestiaire.lua:150` (ré-applique la tenue à la connexion via
  `Builder.Habiller`).
- **PNJ** : `Shared/Logic/Roster.lua:80` parcourt `Modular.SLOTS` — les PNJ passent par
  le même catalogue.
- **Widgets** : `Shared/Logic/WidgetsLogic.lua:95` expose les données au tableau de bord.
- **Harnais** : `scripts/narvos-verifier-catalogues.mjs:146` et `:207` contrôlent les
  références de `Modular` (assets morts, liens) — c'est le test à faire passer après
  régénération.

Pour qu'un PNJ civil ou un joueur **porte réellement** ces pièces, il faut donc, dans
l'ordre : (a) des meshes dont le squelette passe `AddSkeletalMeshAttached`, (b) des
entrées `PIECES` + un `CORPS` de la même famille (sinon la règle « famille sans corps =
famille morte » du générateur, lignes 804-819, **écarte les pièces comme orphelines**),
(c) une `TENUE_BASE` si l'on veut cacher le porteur, (d) les registres/prix côté
Vestiaire (déduits des champs, rien à coder), (e) le harnais vert, (f) la vérif en jeu.

---

## 6. Chiffrage

**Préambule bloquant (hors générateur), le vrai coût :** rebinder/retargeter les ~37
meshes (et 1-2 corps) sur `SKEL_Mannequin` dans l'éditeur, puis re-cook. Travail Unreal,
pas chiffrable en lignes ici ; alternative à évaluer : `CharacterSimple` pour PNJ
uniquement. **Tant que ce point n'est pas tranché, tout le reste produit des entrées de
catalogue inattachables.**

**Partie générateur (si le préambule est résolu) :**

| Changement | Volume estimé |
|---|---|
| Nouvelle source : parser la section `[assets.skeletal_meshes]` d'`Assets.toml`, filtrer `Narvos/MetaCustom/` (parseur toml minimal maison, pas de dépendance) | ~50-70 lignes, 1 fichier (`narvos-modular-to-lua.mjs`) |
| Table de classification écrite à la main `PIECES_METACUSTOM` (slot, label, registre, genre déduit du chemin `Female`/`Male`, `F_Tal`/`M_Tal`) — 37 entrées, précédent : `PIECES_MH` lignes 89-100 | ~60-80 lignes |
| 1-2 `CORPS` + inscription dans `CORPS_RETENUS` (indispensable : règle des familles vivantes) | ~10 lignes |
| Nouveaux slots éventuels (`ceinture` pour `SK_Belt`/`SK_Suspenders`, `accessoire` pour `SK_Hat`/casques ?) → `Modular.SLOTS` + impact écran de création | ~5 lignes Lua + UI à vérifier (coût inconnu) |
| Corriger l'en-tête périmé du gabarit (« Deux familles cohabitent » / « vérifié ») | ~10 lignes |
| **Total générateur** | **~150-180 lignes, 1 seul fichier** |

**En 5 lignes :** (1) lire `Assets.toml` au lieu de GLB pour cette famille, en prenant
les **clés** dédupliquées ; (2) table de classification main de 37 entrées, genre par
chemin ; (3) ajouter un corps `metacustom` sinon les pièces sont écartées comme
orphelines ; (4) `--apply` réécrit tout `Modular.lua`, donc aucune retouche manuelle ;
(5) tout cela ne sert à rien tant que les meshes ne sont pas rebindés sur
`SKEL_Mannequin` — c'est là que sont les jours-homme, pas dans le `.mjs`.

**Risques principaux :**

1. **Squelette `Skel_Dummy`/`metahuman_base_skel` ≠ `SKEL_Mannequin`** — refus
   d'attachement quasi certain ; le risque n'est pas « ça se voit mal », c'est « ça
   n'attache pas ». Deux squelettes différents *dans* le pack (au moins `SK_Dress`
   diffère) : audit pièce par pièce obligatoire (`adk-audit-skeletons.py` avec
   `NARVOS_RACINE=Game/Narvos/MetaCustom`).
2. **Référence squelette pendante dans le pack cuit** (chemin
   `/Game/Metahuman_Customization_System/…` absent du pack) — même après rebind, vérifier
   que la nouvelle liaison pointe *dans* `/Game/Narvos/…`.
3. **`--apply` destructeur** pour toute modification manuelle (confirmé lignes 1227-1231).
4. **Clés dédupliquées** (`SK_Pants_2` → fichier `SK_Pants`) : utiliser la clé toml,
   pas le basename, sinon références mortes que le vérificateur attrapera.
5. **Slots manquants** (ceinture, bretelles) : en inventer casse l'écran de création
   qui itère `Modular.SLOTS` ; les ranger dans un slot existant trompe le joueur.
6. **Volumes** : même rebindés, ces vêtements sont taillés sur les corps MetaHuman
   Tall/Medium — la famille `metacustom` et `ValiderTenue` gèrent déjà ce cas, à
   condition de ne jamais réutiliser la famille `stylized`.

**Plan d'exécution ordonné :**
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
  mais long). Si par chance elles ne sont pondérées que sur les 68 os communs, un simple
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->