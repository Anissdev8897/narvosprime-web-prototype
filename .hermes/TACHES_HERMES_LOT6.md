# Lot 6 — quatre tâches, aucune ne demande Unreal

Pour l'agent Hermes. Rédigé le 2026-09-07, après le lot 5.

## Le lot 5 est validé, et tu m'as encore corrigé

Ton comptage de 3 215 animations bat le mien (3 169) : le mien venait du pack
d'**avant** le cook. Tes 37 animations de forge (20 `ANIM_IP_*` + 17 `ANIM_RM_*`)
ont confirmé qu'on possédait déjà le pack Fab « 37 Blacksmith ». Et ta
conclusion sur les ressources était **exacte** — j'ai vérifié les six : elles
n'ont qu'un émoji et aucun mesh.

**Une erreur, et elle a failli coûter 41 €.** Tu as déclaré minage, alchimie et
fabrication ABSENTS en renvoyant vers un paquet Fab. On le possède :
`a_trier/asset_trier/animation_craf/Crafting_Animations/` contient
`Mining_START/IDLE/END`, `Potion_*` ×5, `MP_*` ×7 (mortier et pilon),
`Cauldron_*` ×5, `Table_*` ×3 — sur `UE4_Mannequin_Skeleton`.

Le dossier était le voisin de celui que je t'avais fait analyser. **Regarde
toujours les dossiers frères.**

---

## Le partage, et pourquoi

Tu n'as pas Unreal. Tout ce qui demande l'éditeur, un cook ou un import reste de
mon côté — et c'est la moitié du travail restant. Ce lot est l'autre moitié :
**quatre tâches qui se prouvent avec `node` et rien d'autre.**

---

# Tâche 1 — Corriger le portage du craft

C'est ta seule vraie erreur du lot 4, et elle est réparable en une passe.

`Shared/Catalogs/Recettes.lua` porte **7 recettes inventées**.
`WebPortal/src/rpg/items/craftingSystem.ts` en déclare **9**, avec 4 stations
(`forge`, `workbench`, `alchemy`, `refinery`). **Zéro identifiant commun.**

Ton motif écrit — « aucun item n'est inventé ici » — ne tient pas : j'ai vérifié
les **13 ingrédients** des 9 recettes TS, **tous les 13 sont dans les 26 objets**
d'`Items.lua`. Le portage était possible tel quel.

## Ce que tu fais

Porte les **9 recettes** et les **4 stations**. Garde leurs identifiants
(`craft_plasma_blade`, `craft_cyber_armor`, `craft_noyau_plasma`…).

Si tu veux garder une de tes 7 en plus, garde-la — mais **marquée comme ajout**,
dans une section séparée, avec sa raison. Ce qui est interdit c'est de
**remplacer** la source en silence.

⚠ `refinery` a disparu de ton portage. Les 4 stations doivent exister.

## Vérifie

Le harnais `craft.mjs` doit prouver que **les 9 recettes portées donnent le même
verdict qu'en TypeScript** — ingrédients manquants compris.

---

# Tâche 2 — Trancher les DEUX univers d'objets

**La découverte la plus lourde du 2026-09-07, et personne ne l'a tranchée.**

```
src/rpg/items/itemCatalog.ts              26 objets
src/rpg/professions/professionCatalog.ts  42 ressources
intersection                               0
```

Zéro identifiant commun. Deux économies côte à côte dans le même jeu. C'est ce
qui a rendu mon brief du lot 4 impossible à suivre : « porte `professions/` » et
« n'invente aucun objet » sont incompatibles quand les 42 ressources n'existent
nulle part ailleurs.

Ce n'est **pas** un défaut de portage. **C'est une décision de jeu jamais
prise** : quelle est la liste d'objets de NARVOS ?

## Ce que tu produis — `.hermes/UNIVERS_OBJETS.md`

1. **Les deux listes en regard**, avec pour chacune : d'où elle vient, qui la
   lit, dans quel écran elle apparaît.
2. **Les recouvrements de SENS** malgré l'absence de recouvrement d'identifiant.
   `metal_rare` (26) et `fer` / `acier` / `adamantite` (42) désignent-ils la même
   chose à des paliers différents ? Dis-le, c'est le cœur.
3. **Trois fusions possibles**, chacune avec son coût :
   - tout ramener sur les 26 ;
   - tout ramener sur les 42 ;
   - garder deux niveaux (matières brutes / objets finis) et les relier.
4. **Ta recommandation, une seule**, et pourquoi.

⚠ **Tu ne modifies aucun catalogue dans cette tâche.** C'est un document de
décision. La fusion se fera après, sur la voie choisie.

## Le contexte qui doit peser

Le jeu vise la chaîne EXPLORE → RÉCOLTE → RESSOURCES → TRANSFORMATION → CRAFT →
INVENTAIRE → UTILISATION → COMMERCE. Une liste d'objets qui se scinde en deux au
milieu de cette chaîne la casse.

Et six ressources centrales — `powernax`, `noyau_plasma`, `cristal_energie`,
`adn_alien`, `metal_rare`, `fragment_vie` — n'ont **qu'un émoji** pour visuel.
Ce que tu recommandes décidera ce qu'il faut dessiner ou acheter.

---

# Tâche 3 — SIX systèmes d'inventaire : en désigner UN

Le dépôt en contient six, jamais comparés :

| paquet | uasset |
|---|---|
| Hyper Inventory, Crafting, Hotbar, Lootchest & Vendor V2 | **5 478** |
| Inventory_System_Pro_by_Moonville | 2 220 |
| SlotBased_inventory_5.5+ | 1 043 |
| Hyper_Slot_Based_Inventory_V3 | 1 043 |
| Inventory_and_Stat_System | 578 |
| Survival Crafting System | 364 |

Ils sont sous `public/asset_game/a_trier/` (deux niveaux : `a_trier/` et
`a_trier/asset_trier/animation_craf/`) et dans `systemes_sans_epoque/`.

## ⚠ Ce que tu ne dois PAS conclure

**Aucun ne remplacera notre Lua.** `Logic/Inventory.lua` fait 1 021 lignes, il
est persisté en base, il est testé. Un système Blueprint ne pilote rien dans
nanos, où le gameplay est en Lua.

**Leur valeur est ailleurs** : le modèle de données, la disposition d'écran, les
icônes, les meshes. C'est ça que tu compares.

## Ce que tu produis — `.hermes/INVENTAIRES_SIX.md`

Pour chacun : version de moteur, nombre d'écrans UMG, DataTables et leurs
champs, ce qu'il a que notre `Inventory.lua` n'a pas.

Puis **une seule recommandation** : lequel garder pour sa maquette et son modèle,
et lesquels on peut cesser de traîner. Chiffre le gain en Go.

Sers-toi de la technique de lecture de `.uasset` du lot 5 — elle a rendu 429
chaînes utiles sur `DT_ItemList`.

---

# Tâche 4 — Les 15 modules Lua qui ne disent pas d'où ils viennent

Mesuré le 2026-09-07 : sur les 20 modules de `Shared/Logic/`, **5 seulement**
citent leur source TypeScript (`Character`, `Inventory`, `Loot`, `Macros`,
`CharacterCreation`, plus `Combat` qui la cite dans son corps).

Les 15 autres ont un équivalent dans `src/rpg` et ne le nomment nulle part.
**On ne peut donc pas savoir s'ils ont été portés ou réinventés**, et une
divergence y serait invisible.

Deux cas déjà mesurés, qui montrent que les deux existent :

- **`Ia.lua` est une réinvention.** `src/rpg/npc/NpcController.ts` déclare
  `NpcState = "idle" | "chase" | "attack" | "dead"` avec `LEASH_MULT` à 1,5.
  Le Lua a `repos | patrouille | poursuite | attaque | repli` et
  `HYSTERESIS_ATTAQUE = 1.25`. **Même concept, valeur différente, personne n'a
  réconcilié.**
- **`Sorts.lua` est un portage** — 73 % de vocabulaire commun avec
  `spells/spellCatalog.ts` — mais il ne le dit pas.

## Ce que tu produis — `.hermes/PORTAGES_SOURCES.md`

Pour chacun des 15 : le fichier `src/rpg` correspondant s'il existe, et un
verdict en trois seaux — **porté** / **réinventé alors qu'une source existait**
/ **légitimement neuf** (`Ciel.lua` pilote Ultra Dynamic Sky, `Voyage.lua` le
level streaming nanos : ces deux-là n'ont aucun équivalent React possible).

Pour chaque **réinvention**, liste les **divergences de valeur** comme celle de
`Ia.lua`. Ce sont des bugs qui dorment.

⚠ **Tu ne modifies aucun `.lua` dans cette tâche.** C'est un relevé. Les
en-têtes de provenance seront posés ensuite, sur la base de ton verdict.

---

# Règles du lot

- **Français.**
- Tâches 2, 3, 4 : **aucune modification de fichier du jeu**, uniquement des
  `.md` dans `.hermes/`.
- Tâche 1 : seuls `Catalogs/Recettes.lua`, `Logic/Craft.lua` et
  `scripts/lua-harness/craft*` peuvent bouger.
- **Colle les sorties brutes** des commandes. Un compte sans sa commande ne vaut
  rien ici.
- **Regarde les dossiers frères.** C'est ce qui t'a manqué au lot 5, et c'est ce
  qui m'a manqué quatre fois dans la même journée.

## Ce que tu rends

Les trois `.md`, plus pour la tâche 1 la sortie de :

```bash
node scripts/lua-harness/syntaxe-check.mjs
node scripts/lua-harness/portee-check.mjs
node scripts/lua-harness/craft.mjs
node scripts/lua-harness/recolte.mjs
```

Et ta rubrique **« ce dont je ne suis pas sûr »** — elle vaut plus que le reste,
et tu l'as prouvé deux lots de suite.