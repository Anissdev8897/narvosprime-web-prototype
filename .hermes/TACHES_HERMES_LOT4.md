# Récolte et craft — lot 4

Pour l'agent Hermes. Rédigé le 2026-09-07, **réécrit deux fois le même jour**
parce que j'avais écrit un brief sans regarder le dépôt. Lis d'abord pourquoi :
c'est la règle qui commande tout le lot.

---

# LA RÈGLE DE BASE DU PROJET

**On ne construit pas à côté de ce qu'on possède. On fusionne.**

Le dépôt contient 250 Go d'assets achetés et ~90 000 lignes de gameplay React.
Écrire un système neuf à côté, c'est payer deux fois et n'exploiter ni l'un ni
l'autre.

Trois questions avant la première ligne de code, dans cet ordre :

1. **Le système existe-t-il déjà en TypeScript ?** → alors la tâche est
   **PORTER**, jamais concevoir.
2. **Quel pack porte les assets 3D ?**
3. **Quel pack porte le VISUEL de l'interface ?** L'UI achetée se reprend aussi.

Le précédent qui fait autorité : l'éditeur de personnage modulaire de NARVOS
reprend le visuel du **Meta Body Tool** — ses curseurs de morphologie et sa
grille de slots. Il n'a pas été dessiné de zéro.

**J'ai violé cette règle deux fois en écrivant ce brief.** Ma v1 te demandait de
concevoir un craft ; il existait. Ma v2 te demandait de concevoir une récolte ;
elle existait aussi. Voici ce qui existe vraiment.

---

# Ce qui existe déjà — mesuré le 2026-09-07

## Le craft : `src/rpg/items/craftingSystem.ts`, 278 lignes

4 stations `forge` · `workbench` · `alchemy` · `refinery`, 9 recettes.

```ts
export interface IngredientCheck {
  recipe; missing: CraftIngredient[]; available: boolean;
  playerLevel: number; levelOk: boolean;
}
export function checkRecipe(recipeId, inventoryCounts, playerLevel): IngredientCheck | null
export function craftItem(...) / availableRecipes(...) / recipesByStation(station)
```

`missing` — la liste de ce qui manque — **existe déjà**.

## La récolte : `src/rpg/professions/`, 20 fichiers, 1 803 lignes

```
professionTypes.ts      ProfessionId, "gather"|"craft", Rarity, ResourceTier,
                        ProfessionDef, CraftRecipe, MAX_PROFESSION_LEVEL = 50,
                        xpForLevel(level)
professionCatalog.ts    PROFESSIONS (bucheron, mineur…), RECIPES,
                        RESOURCE_BY_ID, 37 ressources en 4 raretés
professionStore.ts      ProfProgress {level, xp}, STAMINA_MAX = 100
harvestRegistry.ts      ChopResult, HarvestHandle
harvestNodes.ts         HarvestNodeSeed, harvestNodesForMap(mapId)
harvestModelCatalog.ts  le pont ressource → modèle 3D
```

Plus l'interface, déjà écrite : `HarvestNode.tsx`, `HarvestProximityTicker.tsx`,
`HarvestPlacementGizmo.tsx`, `GatherMiniGame.tsx`, `ForgeMiniGame.tsx`,
`ProfessionPanel.tsx`, `CraftingPanel.tsx`.

**Tu ne conçois rien. Tu portes.**

## Deux défauts de l'existant, que tu vas rencontrer

**1. `HARVEST_NODES` est VIDE.** `harvestNodes.ts` fait 20 lignes et déclare
`HARVEST_NODES: Record<string, HarvestNodeSeed[]> = {}`. Le système sait faire
naître un gisement ; **aucun gisement n'est placé.** Les placements se font au
gizmo, en jeu. Ton port doit accepter une liste vide sans casser.

**2. Il y a DEUX listes de recettes rivales.** `CRAFT_RECIPES` dans
`craftingSystem.ts` (9, par station) et `RECIPES` dans `professionCatalog.ts`
(par profession). **Ne choisis pas en silence.** Compare-les, dis dans ton
rapport si elles se recouvrent, divergent, ou se complètent — et laquelle fait
foi. C'est la question la plus utile du lot.

---

# La fusion avec les assets — le cœur de ce lot

## Le trou à combler, écrit noir sur blanc dans le code

`harvestModelCatalog.ts`, en commentaire :

> « les *24 Free Ores and Minerals* sont des PNG (icônes 2D), pas des meshes —
> le métier **MINEUR** conserve donc son **rocher procédural** »

**Un métier entier tourne sur un caillou générique faute de modèles.** Or on a :

```
public/models/systemes/RPGEngineUltimateMultip/RPG_Engine/CraftingSystem/Meshes/
  SM_OreMetal   SM_Metal     SM_Cooper    SM_Glass    SM_Gunpowder
  SM_CompLens   SM_Microchip SM_Transistor SM_Screw   SM_Nylon
  SM_Rubber     SM_Leather   SM_Textile   SM_Leaf     SM_Stick   SM_Lamp
```

plus **50 GLB de rochers** ailleurs dans `public/models/`. Le bûcheron, lui, a
déjà ses 8 arbres câblés dans `harvestModelCatalog.ts` — **fais pour le mineur
ce qui a été fait pour le bûcheron.**

## Les 432 icônes, déjà en WebP

`public/textures/icons/craft/` + `_alias.json`. **18 familles** :

```
bone  cloth  container  feather  gemstone  herbs  ingots  leather  meat
mushrooms  reagent  recipes  seeds  spare_parts  stone  strings  tools  wood
```

Toute ressource que tu portes doit trouver son icône ici. **Une ressource sans
icône est une ressource qu'on ne pourra pas afficher.**

## L'interface — tu n'y touches pas

nanos accepte **les deux** : `WebUI` (HTML) et `Widget` (UMG cuit), et ils se
composent — `Widget:AddChild(WebUI|Widget)` est dans l'API. Les paquets achetés
(`Inventory_System_Pro` : 81 widgets, 501 textures) sont donc exploitables.
Mais c'est d'autorité **client** et ça ne se prouve que dans le moteur, qui n'a
jamais fait tourner une ligne de ce projet. **C'est ma part.**

---

# La découpe, et une obligation nouvelle

Tu écris **uniquement** dans `Shared/Logic/`. J'écris les exécutants `Server/`,
qui appellent l'API nanos — invérifiable hors moteur, et déjà responsable de
trois corrections (`Session.Personnage` n'existe pas, `Trace` est client,
`ApplyHeal` n'existe pas).

## ⚠ Chaque module porté DÉCLARE sa source en en-tête

Mesuré ce matin : sur 20 modules de `Shared/Logic/`, **3 seulement** nomment le
fichier TS dont ils viennent. Les 17 autres ont un équivalent dans `src/rpg` et
ne le disent pas — impossible de savoir s'ils ont été portés ou réinventés, et
une divergence y est invisible.

Tes deux modules portent donc, en première ligne :

```lua
-- Porté de WebPortal/src/rpg/professions/ (professionCatalog.ts,
-- professionTypes.ts, harvestRegistry.ts) — état du 2026-09-07.
-- Toute divergence volontaire est signalée en commentaire à l'endroit exact.
```

## Règles

- **Français**, comme tout le dépôt.
- **Lua 5.4 pur.** Aucun appel nanos. Ce qui vient du moteur — heure, position,
  tirage — entre **en paramètre**.
- **N'édite pas** `Inventory.lua`, `Loot.lua`, `Items.lua`, ni aucun `Server/*.lua`.
- **Vérifie ce que tu affirmes.**

---

# Les signatures réelles de l'inventaire, mesurées

```
Inventory.GetItemDef(item_id)                 -> def | nil
Inventory.CountItem(grid, item_id)            -> nombre
Inventory.FindInstance(grid, uid)             -> instance | nil
Inventory.AddItemToGrid(grid, def, quantity)
Inventory.RemoveItemFromGrid(grid, uid, quantity)
Inventory.FindFreeSlot(grid, w, h)
Inventory.IsAreaFree(grid, x, y, w, h, exclude_uid)
Inventory.CreateGridState(cols, rows)
```

## ⚠ Le piège qui va te mordre

**`RemoveItemFromGrid` prend un `uid`, pas un `item_id`.**

`CountItem(grid, "fragment_vie")` dit 12 — répartis sur trois piles, chacune
avec son `uid`. Consommer « 3 » veut dire : trouver les piles, les vider dans
l'ordre, s'arrêter au compte. **Aucune fonction ne fait ça.**

Appeler `RemoveItemFromGrid(grid, "fragment_vie", 3)` échoue **en silence** :
aucun uid trouvé, rien retiré, fabrication réussie quand même. C'est la famille
de bug qui a déjà effacé les couleurs de personnage sur ce projet.

Le TS ne t'aide pas ici : il reçoit `inventoryCounts: Record<string, number>`,
un dictionnaire déjà compté, et **ne consomme rien** — c'est React qui le fait.
**La consommation par `uid` est la vraie part neuve de ce lot.**

---

# Tâches

**1. `Shared/Logic/Recolte.lua`** — porter `professions/` : professions,
ressources, paliers, XP (`xpForLevel`, `MAX_PROFESSION_LEVEL = 50`), endurance
(`STAMINA_MAX = 100`), nœuds, repousse.

**2. `Shared/Logic/Craft.lua`** — porter `craftingSystem.ts` : 4 stations,
9 recettes, `checkRecipe` → `missing`, plus la consommation par `uid`.

**3. `Shared/Catalogs/Gisements.lua`** — le catalogue de gisements, **écrit à la
main** (précédent : `Catalogs/Factions.lua`, manuel, et son en-tête le dit).
Chaque gisement porte **son mesh** pris dans la liste ci-dessus et **son icône**
prise dans les 18 familles. C'est là que la fusion se matérialise.

**4. Les harnais** :

```
scripts/lua-harness/recolte.mjs  +  recolte-tests.lua
scripts/lua-harness/craft.mjs    +  craft-tests.lua
```

Gabarit : `combat.mjs` / `combat-tests.lua`, ton propre code du lot 1, vert.

## Quatre contraintes venues d'erreurs déjà payées

**Le tirage entre en paramètre.** Jamais `math.random` dans le module : chaque
VM a sa graine, le serveur tire et le client reçoit. Un module qui tire lui-même
ne se rejoue pas et ne se teste pas.

**Distinguer « récolté » de « réinitialisé ».** Un gisement vidé attend sa
repousse ; un gisement remis à zéro parce que la zone s'est déchargée revient
tout de suite. Confondre les deux fait réapparaître le minerai sous les yeux de
qui vient de le prendre. C'est la distinction mort/retrait de
`Server/Peuplement.lua` — va la lire.

**Pas de balayage global.** 400 joueurs visés, 33 ms par tick. Parcourir tous
les gisements pour chaque joueur à chaque passe est un défaut de conception.
Indexe par zone. `HarvestProximityTicker.tsx` a déjà résolu ça côté React — lis-le.

**Immuable.** Une fonction rend un état neuf, elle ne mute pas le sien.

## Ce que les harnais doivent prouver

- **consommer 3 unités réparties sur 3 piles retire bien 3 unités** — le test
  qui compte le plus du lot ;
- grille pleine → échec **sans rien consommer** ;
- **les 9 recettes portées donnent le même verdict qu'en TypeScript** ;
- `xpForLevel` rend les mêmes valeurs que le TS sur les 50 niveaux ;
- rendement borné min/max sur beaucoup de tirages ;
- outil ou palier insuffisant → refus **avec sa raison** ;
- repousse non écoulée → refus ; écoulée → accepte ;
- une liste de gisements **vide** ne casse rien.

```bash
node scripts/lua-harness/syntaxe-check.mjs
node scripts/lua-harness/portee-check.mjs
node scripts/lua-harness/recolte.mjs
node scripts/lua-harness/craft.mjs
```

`syntaxe-check` couvre le Lua **et** les `.mjs`. Un backtick dans une chaîne de
gabarit a cassé un générateur **quatre fois** en une journée sur ce projet.

---

# Les pièges Lua 5.4 déjà payés ici

- **`local function` déclarée APRÈS son appelant** → global `nil`, sans erreur
  au chargement. Cinq fois en une session. Déclare en tête, assigne ensuite.
- **`t[nil] = v` lève.**
- **`#t` n'est pas défini sur une table trouée.**
- **`%d` et `%.0f` font de l'arrondi bancaire** : 2,5 → 2. `math.floor(x + 0.5)`.
- **`pairs` n'a aucun ordre.** Voir `Factions.ORDRE`.

---

# Ce que tu rends

1. **Les sorties brutes** des quatre commandes. Pas un résumé.
2. **Le verdict sur les deux listes de recettes rivales** — se recouvrent-elles,
   divergent-elles, laquelle fait foi.
3. **Les écarts TS → Lua**, chacun qualifié : bug de port, ou décision assumée.
4. **La table de fusion** : pour chaque ressource portée, son mesh et son icône.
   Celles pour lesquelles tu n'as trouvé ni l'un ni l'autre — nomme-les.
5. **Ce dont tu n'es pas sûr.** Cette rubrique vaut plus que les quatre autres.
   Au lot 1 tu as relevé deux de mes erreurs, toutes deux réelles. Ce brief a dû
   être réécrit **deux fois** parce que je n'avais pas cherché l'existant.
   Continue.

**Ne dis pas qu'une commande est passée sans coller sa sortie.**