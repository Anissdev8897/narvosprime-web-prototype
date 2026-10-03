# scripts/diagnostics — Garde-fous de mesure

Scripts de **diagnostic ponctuel**, écrits pour trancher une hypothèse précise.
Chacun a éliminé au moins une piste fausse — ne pas supprimer. Ils ne font
partie d'aucune chaîne automatisée ; on les relance à la main quand le doute
revient.

| Script | Ce qu'il mesure | La question qu'il tranche |
|---|---|---|
| `check-skin-indices.mjs` | Validité des `skinIndex` d'un GLB | « Les sommets pointent-ils hors du tableau d'os ? » (maillage qui part en éclats) |
| `check-bone-axes.mjs` | Axe local d'allongement des os | « Quel axe suit la longueur de cet os ? » (pré-requis à toute mesure de proportion) |
| `check-weight-coverage.mjs` | Couverture de poids de skinning, hors ligne | « Le calcul runtime de couverture est-il confirmé sans lancer le jeu ? » |
| `check-target-topology.mjs` | Compatibilité des cibles morph MPFB2 avec nos têtes | « Les morphs MakeHuman (19 158 sommets) sont-ils applicables à nos têtes (8 049) ? » → NON sans projection |
| `check-eye-and-slider-bones.mjs` | Deux défauts rapportés en jeu (yeux, os de curseurs) | « Les os incriminés existent-ils et portent-ils du poids ? » |
| `inspect-base-bodies.mjs` | Recouvrement de squelette entre corps de base H/F | « Une pièce validée sur un genre vaut-elle pour l'autre ? » → oui, 100 % |
| `check-clip-rig.mjs` | Jouabilité d'un clip d'animation sur un squelette | « Ce clip trouve-t-il ses os sur ce rig ? » |
| `check-ktx2-dims.mjs` | Dimensions KTX2 illégales pour le GPU | « Cette texture compressée respecte-t-elle les contraintes matérielles ? » (référencé par `chunks-to-ktx2.mjs`) |
| `check_dimensions.mjs` | Dimensions de textures (sharp) | Diagnostic ponctuel sprites — ⚠ chemins en dur obsolètes (`c:/mes_projets/…`) |
| `check_orig_dims.mjs` | Dimensions originales avant conversion | idem — chemins obsolètes |
| `check_pixels.mjs` | Pixels d'une frame de sprite sheet | idem — chemins obsolètes |
| `check_pixels_final.mjs` | Pixels après correction | idem — chemins obsolètes |

Règle de la maison : un script de diagnostic qui a servi une fois **se range
ici**, avec sa ligne dans ce tableau — jamais à la racine de `scripts/`.
