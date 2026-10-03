# Spec — Éditeur de création : anatomie seule

Source : brief utilisateur du 2026-08-04 + maquettes.
But : l'éditeur ne règle QUE l'anatomie. Aucun équipement, aucun vêtement.

---

## ⚠ Deux corrections au brief, à lire avant de commencer

### 1. Les sliders n'existent pas dans le code

Le brief dit « la zone avec les sliders est déjà présente graphiquement, mais les
sliders ne semblent pas fonctionnels » et signale un doublon (« LONGUEUR DES BRAS »
×3).

**Ce panneau n'existe que dans la maquette.** Les deux captures fournies sont des
images de conception, pas l'application : elles montrent déjà la bascule de genre,
qui n'est pas implémentée. Il n'y a donc ni slider à réparer ni doublon à corriger —
tout est à créer. Le triplement du libellé est une duplication de la maquette.

### 2. Les assets MPFB2 n'ont jamais été importés

Le brief demande « l'intégralité des assets anatomiques extraits de l'addon Blender ».

Mesuré le 03/08/2026 : `partCatalog` ne référence **qu'un seul pack**
(`source: "biker"`), et `public/models` ne contient **aucun** contenu MPFB2.

Les 12 pièces d'anatomie livrées (`biker_m/*`, `biker_f/*`) sont issues du découpage
du **mannequin Biker**, pas de MPFB2. Le corps MPFB2 a bien été généré
(`public/models/personnages/base/SK_BaseBody_Mixamo.glb`) mais son rig Mixamo
(52 os) n'a **0 % de noms d'os en commun** avec le mannequin Biker (161 os) — 39/39
pièces refusées. Il est hors chemin critique.

**Conséquence directe :** le point 3 du brief (morphologie du visage — nez, joues,
mâchoire) dépend des 1445 cibles MPFB2, donc d'un import qui reste à faire. Ce n'est
pas un branchement, c'est un chantier.

---

## 1. Panneau de gauche

- [ ] **Bascule de genre HOMME / FEMME**, dans un bloc « SÉLECTION DE GENRE (BASE) »
      sous « TYPE DE CORPS ».
- [ ] **Défaut = FEMME.** ⚠ Le catalogue féminin est plus pauvre : `f_body`,
      `f_hair` + les 6 découpes. Ni visage alternatif ni barbe. Démarrer sur la
      femme rend ce manque immédiatement visible — c'est voulu, mais à savoir.
- [ ] **Rail en deux groupes séparés** : « APPARENCE DE BASE » (TÊTE, BUSTE, BRAS,
      MAINS, JAMBES, PIEDS, CHEVEUX, BARBE) puis « MODIFICATIONS (AVANCÉ) ».
- [ ] **DÉTAILS DU CORPS (AJUSTABLES)** — sliders à **créer** : largeur d'épaule,
      hauteur de taille, longueur des bras. **Un seul slider par paramètre.**

## 2. Carrousels de droite

- [ ] Retirer tout équipement : « GANT G/D (REFONTE) », « JAMBIÈRE G/D (REFONTE) »…
- [ ] Y afficher les pièces anatomiques. **Les 12 pièces sont au catalogue avec le
      bon genre** (`heroParts.ts`, `GENDER_BY_SOURCE`) — le lien à corriger est
      l'affichage, pas les données.
- [ ] Renommer : « TÊTES ET CHEVEUX », « ANATOMIE DU BUSTE », « STRUCTURE DES
      ÉPAULES », « TYPES DE MAINS », « ANATOMIE DES JAMBES », « ANATOMIE DES PIEDS ».
- [ ] **Pastilles ♂ / ♀ / unisexe** sur chaque vignette. La donnée existe :
      `ModularPart.gender` (`undefined` = unisexe).

## 3. Morphologie du visage — BLOQUÉ

- [ ] Nez (hauteur, largeur), joues, mâchoire, front.
- **Prérequis : importer les cibles MPFB2.** Voir correction n°2.

## 4. Aperçu de l'œil

- [ ] L'icône à droite de la palette doit prévisualiser la couleur choisie.

---

## Ordre conseillé

1. **Bascule de genre** — sans elle, le corps féminin et ses 6 découpes restent
   invisibles. Tout le reste en dépend.
2. **Affichage des 12 pièces** dans les carrousels + pastilles de genre.
3. **Renommage** des carrousels.
4. **Rail en deux groupes.**
5. **Sliders** (création complète).
6. **Aperçu de l'œil.**
7. **Import MPFB2** puis morphologie du visage.

## État au 2026-08-04

Fait : équipement retiré du créateur · marchand Vasska · corps non masqué ·
4 morphologies H/F avec `girth` au rendu · 12 pièces découpées à 100 % de
compatibilité, KTX2 (VRAM 1749 → 103 Mo), vignettes générées.

`194 fichiers de test · 2116 tests · tsc 0`