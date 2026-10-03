# BRIEF — Extraction et classement de TOUS les assets de personnage

**De :** Claude · **Pour :** Hermes · **Date :** 2026-08-04
**Nature :** chantier long, automatisable. C'est le point.

---

## 1. L'objectif, en une phrase

Le créateur de personnage assemble un corps à partir de **pièces
interchangeables** greffées sur un squelette unique. Aujourd'hui il n'a que
**63 pièces** issues de 8 personnages. Le dépôt en contient des milliers,
inexploitées.

Ta tâche : **industrialiser l'extraction** pour que toute source utilisable du
projet devienne des pièces catalogées, compatibles, et rangées par catégorie.

Ce n'est pas un travail de code compliqué. C'est un travail de **volume et de
rigueur**, et c'est exactement pourquoi il t'est confié : il faut le faire une
fois, bien, et le rendre rejouable.

---

## 2. Le squelette canonique — la contrainte qui décide de tout

**Mannequin Biker UE5 · 161 os · racine `root`.**

Mesuré (`scripts/inspect-base-bodies.mjs`) : les corps homme et femme ont
**100 % de recouvrement**. Une pièce validée sur un genre vaut pour l'autre.

Une pièce n'est greffable que si **≥ 50 % de son POIDS de skinning** tombe sur des
os que le mannequin possède. Le critère est le poids, **jamais le nombre de
noms** : les héros embarquent 130 à 168 os dont une majorité de twists et de
correctifs qui ne portent aucun sommet.

⚠️ **Le rig MPFB2 (Mixamo, 52 os) a 0 % de noms en commun** avec le mannequin.
Mesuré : 39 pièces sur 39 refusées. Ne perds pas de temps dessus sans décision
préalable de l'utilisateur.

---

## 3. La chaîne existante — à réutiliser, pas à réécrire

Tout est déjà écrit et testé. Ton travail est de l'**alimenter en masse**.

| Étape | Outil | Ce qu'il fait |
|---|---|---|
| 1. Découpe | `scripts/extract-body-parts.mjs` | GLB → pièces par région. Deux voies : matériaux d'auteur, ou os dominant si le maillage est monolithique. Conserve le squelette COMPLET. |
| 2. Contrôle | `scripts/audit-part-compat.mjs` | Couverture de poids vs le mannequin. `--base=biker` (défaut). |
| 3. Allègement | `scripts/assets-to-ktx2.mjs` | Textures → KTX2. **Indispensable** : mesuré 1 749 → 103 Mo de VRAM sur 12 pièces. Sans lui, `Context Lost`. |
| 4. Vignettes | `scripts/generate-part-thumbs.mjs` | Rendu logiciel, sans GPU. Saute l'existant. |
| 5. Catalogue | `src/data/parts-manifest.json` → `heroParts.ts` | **Automatique.** Le manifest alimente le catalogue sans code à écrire. |

**Ajouter une source = une ligne dans `SOURCES` de `extract-body-parts.mjs`.**
C'est tout. Le reste suit.

---

## 4. Ce que tu dois produire

### 4.1 Inventaire d'abord — ne découpe rien avant

`public/models/CATALOG.md` indexe 208 packs. `npm run assets:catalog` le régénère.

Produis un **tableau des candidats** : chemin, nombre d'os, nom de la racine,
présence d'un skin. Une source sans squelette, ou dont la racine n'est pas `root`
avec ~161 os, est écartée d'office — inutile de la découper pour le découvrir.

Écris ce tableau dans `.hermes/INVENTAIRE_SOURCES.md` **avant** de lancer quoi que
ce soit. C'est lui qui sera relu.

### 4.2 Découpe par lots, pas d'un bloc

Par lots de 5 à 10 sources. Après chaque lot :

```bash
node scripts/extract-body-parts.mjs --write
node scripts/audit-part-compat.mjs | Select-String "REFUSÉ|pièces ·"
node scripts/assets-to-ktx2.mjs public/models/personnages/_parts/<nouveaux>
node scripts/generate-part-thumbs.mjs
npm test && npm run typecheck
```

Un lot qui casse la suite se corrige **avant** le suivant. C'est ce qui évite de
chercher parmi 200 pièces laquelle a tout fait tomber.

### 4.3 Classement

La région produite par le découpeur mappe vers un `BodySlot` via
`REGION_TO_SLOT` (`heroParts.ts`). Vérifie chaque nouvelle région : une région
inconnue est **ignorée en silence** — c'est voulu, mais ça veut dire qu'un slot
oublié ne se voit pas.

Le **genre** se déduit de la source via `GENDER_BY_SOURCE` (`heroParts.ts`).
Une source genrée doit y être déclarée, sinon ses pièces apparaîtront dans les
deux carrousels.

### 4.4 Rapport final

Dans `.hermes/RAPPORT_EXTRACTION.md` : sources traitées, pièces produites,
**pièces refusées avec leur pourcentage** (le refus est une information, pas un
échec), VRAM avant/après, compteurs de tests re-mesurés.

---

## 5. Trois pièges déjà payés — ne les repaie pas

**Ne jamais lire `.array` d'un attribut de géométrie.** Sur un maillage
entrelacé, `.array` rend le tampon PARTAGÉ (positions, normales, UV, joints,
poids mélangés). Lire ça donne des valeurs arbitraires ; y écrire disperse les
sommets — le maillage part en éclats. Utiliser `getX/getY/getZ/getW` et
`setXYZ/setXYZW`, qui connaissent `offset` et `stride`. Ça nous a coûté quatre
tours de diagnostic.

**Ne jamais écraser un fichier de test existant.** Vérifier avant d'écrire. Un
`assetQuality.test.ts` réécrit au lieu d'être étendu a détruit 8 tests, sans que
la suite ne rougisse — le compteur est passé de 2060 à 2059, seul indice.

**Un test vert ne prouve rien** tant qu'il n'a pas échoué sur le code d'avant.
Sabote volontairement, vérifie le rouge, restaure. Trois faux positifs cette
session ont été attrapés comme ça.

---

## 6. Ordre conseillé

1. **Inventaire** — le tableau des candidats. Rien d'autre.
2. **Un lot pilote de 3 sources**, chaîne complète, rapport. On valide la méthode.
3. **Le reste par lots**, une fois la méthode confirmée.

Ne lance pas les 200 packs d'un coup. Le premier lot sert à découvrir ce que
l'inventaire n'a pas vu.

## 7. État au 2026-08-04

`195 fichiers de test · 2148 tests · tsc 0`
63 pièces cataloguées · 8 sources · squelette canonique 161 os