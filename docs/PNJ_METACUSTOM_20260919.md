# PNJ civils MetaCustom — étape 1 du plan garde-robe (2026-09-19/20)

**Auteur :** Hermes · **Batterie :** 111 harnais · 14 116 assertions · 0 rouge

---

## Ce qui est fait

Le plan de `docs/INVENTAIRE_MCS_20260919.md` §5 étape 1 était : « PNJ civils en
`CharacterSimple` portant les tenues MetaCustom comme corps autonomes — zéro
travail 3D ». C'est maintenant branché, sans créer de système parallèle.

### 1. Sortie `pnj_simple` du générateur modulaire

`scripts/narvos-modular-to-lua.mjs` — la garde MetaCustom distinguait deux
issues (prouvé Mannequin → joueur, sinon exclu). Elle en a trois :

1. **Prouvé `SKEL_Mannequin`** (manifeste `compatibles`) → sortie joueur (inchangé) ;
2. **Squelette `Skel_Dummy`** (manifeste `autres`) → sortie **`pnj_simple = true`** :
   attachable à un `CharacterSimple` dont le corps est aussi `Skel_Dummy`
   (`AddSkeletalMeshAttached` exige le même squelette, pas le Mannequin en soi) ;
3. **Autre squelette** (`metahuman_base_skel`, introuvable…) → exclu, avec le
   squelette réel écrit dans le motif.

`--apply` (sauvegarde dans `.hermes/sauvegardes/modular-pnj-simple-20260919/`) :
**16 entrées `pnj_simple`** dans `Modular.lua` — 3 corps F
(SK_Meta_Female_Base, SK_MetaP, SK_MetaP1) + 13 pièces (SK_Boots, SK_Pants,
SK_Set_1Shorts/Crop_Top/2_Pants, SK_Sci_Fi_*…). Les pièces M n'ont pas de corps
M Skel_Dummy : elles restent orphelines (règle des familles, comportement
documenté).

### 2. Civils dans le catalogue Spawnables

`scripts/narvos-spawnables-to-lua.mjs` — nouvelle source « civils MetaCustom »
qui lit les corps `pnj_simple` de `Modular.lua` (regex dédiée ; celle des
modulaires classiques ne les voit pas, et c'est voulu). Sortie dans
`Spawnables.lua` :

- `civil_sk_meta_female_base`, `civil_sk_metap`, `civil_sk_metap1`
- rôle `neutre` (menu « Autres PNJ »), `simple = true`, `tenue = "metacustom"`,
  texture vérifiée « ok » dans le pack cuit.

### 3. Habillage au spawn

`Server/Peuplement.lua` — `HabillerMetaCustom(entite, asset, rang)` : pour une
entrée `tenue = "metacustom"`, lit le genre du corps depuis `Modular.CORPS`,
attache une pièce `pnj_simple` par slot (torse, jambes, pieds, taille, tête)
par `AddSkeletalMeshAttached` — mêmes primitives que la garde-robe. Le choix
par `(rang + pos) % #candidats` est **stable** : le même point de peuplement
refait naître la même tenue, deux points voisins portent des panoplies
différentes.

### 4. Animations

`Spawner.ANIM_BLOQUES` : les 3 civiles sont déclarées bloquées (aucune
`PlayAnimation` scriptée — leurs animations vivent dans le squelette
Skel_Dummy). Les harnais `pnj-anims.mjs` et `pnj-anims-verif.mjs` couvrent
exactement la liste et sautent les bloquées (le vérificateur crasherait sinon
sur leur dossier source absent de `public/models/`).

## Ce qui reste (test en jeu)

Poser des points de peuplement référençant `civil_sk_meta_female_base` (menu
props → entités de jeu, ou carte), s'approcher : la civile naît habillée
(haut/bas/chaussures MetaCustom), son cadavre est fouillable, elle suit l'IA
passive. Vérifier visuellement que les pièces ne flottent pas ni ne
s'interpénètrent (proportions MetaHuman sur corps MetaHuman : attendu correct).

## Limites assumées

- **Femmes uniquement** : aucun corps masculin `Skel_Dummy` dans le pack
  (les pièces M restent au catalogue, prêtes si un corps M arrive).
- **Pas de casque MetaCustom** : les pièces de tête sont sur
  `metahuman_base_skel`, exclues — la tête nue est le corps MetaCustom lui-même.
- **Pas de morphs sur ces civiles** : leurs corps n'ont pas de morph targets
  cuits ; la silhouette se règle par l'échelle, comme les autres PNJ simples.