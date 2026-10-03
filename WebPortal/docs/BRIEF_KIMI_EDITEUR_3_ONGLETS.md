# Brief — éditeur de personnage à trois onglets

Tâche attribuée à Kimi. La chaîne de morphs (pipeline + moteur runtime) est
traitée en parallèle et **ne touche aucun des fichiers ci-dessous**.

---

## Périmètre

| Tu modifies | Tu ne touches PAS |
|---|---|
| `src/rpg/characters/modular/ModularCreatorScreen.tsx` | `bodySlots.ts` — **figé**, taxonomie livrée et testée |
| `src/rpg/characters/modular/modular-creator.css` | `scripts/mpfb-*.mjs` — pipeline morphs |
| nouveaux `src/rpg/characters/modular/creator/*.tsx` | `src/rpg/characters/modular/morph*.ts` — moteur morphs |
| | `public/models/personnages/_body/` |

Si tu as besoin d'un changement dans `bodySlots.ts`, demande-le — ne l'édite pas.
Trois écrans consomment déjà cette taxonomie ; c'est écrit dans l'entête du
fichier pourquoi elle ne doit pas diverger.

---

## L'API que tu consommes — déjà en place, déjà testée

```ts
import {
  type EditorTab, EDITOR_TABS, EDITOR_TAB_LABELS,
  slotsInTab, tabForSlot, isCreationTab,
  type BodySlot, SLOT_LABELS, carouselLabel,
} from "./bodySlots";
```

| Fonction | Rend |
|---|---|
| `EDITOR_TABS` | `["corps", "creation", "marchand"]` |
| `EDITOR_TAB_LABELS` | `{ corps: "Corps", creation: "Création", marchand: "Marchand" }` |
| `slotsInTab("corps")` | `["body"]` — le mannequin nu |
| `slotsInTab("creation")` | têtes, cheveux, buste, bras, mains, jambes, pieds… |
| `slotsInTab("marchand")` | `top, pants, shoes, gloves, headwear, eyewear, back, accessory` |
| `isCreationTab(tab)` | `false` uniquement pour `"marchand"` |

Pour lister les pièces d'un emplacement :

```ts
optionsForSlot(slot, gender)   // modularEditorState.ts
partsBySource(slot)            // partCatalog.ts — groupées par pack d'origine
```

`partsBySource` est ce qui te permet d'afficher l'origine dans le Marchand : les
pièces portent un champ `source` (`"biker"`, ou l'identifiant du héros découpé).

---

## Ce qu'il faut construire

### Onglet CORPS — le mannequin nu

Homme / femme sans vêtements, plus tout ce qui touche à la morphologie :
archétype, gabarit, curseurs de proportions, teintes peau et yeux. Un seul
emplacement (`body`) — c'est la base modulaire sur laquelle tout se pose.

Le contenu existe déjà dans `ModularCreatorScreen` (panneaux « Corps de base »,
morphologie, couleurs) : il s'agit de le regrouper sous cet onglet, pas de le
réécrire.

### Onglet CRÉATION — les variantes d'anatomie

Têtes, cheveux, barbe, buste, bras, mains, jambes, pieds. C'est le carrousel
actuel, restreint à `slotsInTab("creation")`.

### Onglet MARCHAND — l'équipement

Nouveau. Reprendre le patron d'HumGen3D (cf. capture dans
`SYSTEME_MODULAIRE_MPFB_HUMGEN.md` §2) :

```
[ rail d'emplacements ]  [ champ de recherche              ]
  Haut                   [ ▦ ▦ ▦ ▦ ]   grille de vignettes
  Pantalon               [ ▦ ▦ ▦ ▦ ]   clic = essayer
  Chaussures             …
  Gants                  groupées par pack d'origine
```

Vignettes : `src/data/part-thumbs.json`, indexé par id de pièce. Une pièce sans
entrée retombe sur le glyphe de son emplacement (`SLOT_GLYPH` dans
`creator/creatorTokens.ts`) — ajouter un pack ne laisse donc pas de case vide.

**Règle métier, non négociable :** ce qui est essayé dans le Marchand ne fait pas
partie du personnage sauvegardé. En jeu, ça s'achète. `isCreationTab()` existe
pour ça — la sauvegarde ne doit retenir que les onglets qui rendent `true`.

---

## À vérifier avant de dire que c'est fini

- [ ] Les trois onglets s'affichent et se naviguent
- [ ] Aucun équipement n'apparaît dans Corps ni dans Création
- [ ] Changer d'onglet ne laisse pas la sélection sur un emplacement absent du
      nouvel onglet (le repli existe déjà, ligne ~91 : `active && slots.includes(active) ? active : slots[0]`)
- [ ] Sauvegarder un personnage ne retient rien de l'onglet Marchand
- [ ] La recherche du Marchand filtre sur le nom **et** sur le pack d'origine
- [ ] `npx tsc --noEmit` : zéro nouvelle erreur dans `src/rpg/**`
- [ ] `npm test` : suite complète verte

Un test sur la règle métier — que la sauvegarde ignore le Marchand — vaut mieux
qu'une vérification à l'œil. `bodySlots.test.ts` montre le style attendu.

---

## Contexte utile

- `docs/SYSTEME_MODULAIRE_MPFB_HUMGEN.md` — pourquoi la séparation en trois
  catégories n'est pas qu'une préférence : les modèles découpés n'ont pas la
  topologie MakeHuman, ils **ne peuvent pas** être du corps.
- Commentaires en français, comme le reste du projet.
- Pas de linter configuré : la barrière qualité est `tsc` + les tests.