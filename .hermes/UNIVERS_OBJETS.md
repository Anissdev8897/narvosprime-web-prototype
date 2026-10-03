# UNIVERS OBJETS — les deux économies de NARVOS

Date : 2026-09-07 · Auteur : Hermes · Lot 6, Tâche 2.
**Document de décision — aucun catalogue n'a été modifié.**

---

## 1. Les deux listes en regard

### Liste A — `src/rpg/items/itemCatalog.ts` (26 objets)
| id | label (type) | nature |
|---|---|---|
| arch_sword | Épée de Combat (weapon) | équipement |
| arch_shield | Bouclier Tactique (weapon) | équipement |
| arch_gun | Pistolet Standard (weapon) | équipement |
| plasma_blade | Lame Plasma (weapon) | équipement |
| void_saber | Sabre du Vide (weapon) | équipement |
| plasma_shield | Bouclier Plasma (weapon) | équipement |
| cyber_armor | Armure Cybernétique (armor) | équipement |
| combat_helmet | — (helmet) | équipement |
| combat_gloves | — | équipement |
| combat_boots | — | équipement |
| tactical_cape | — | équipement |
| void_amulet | Amulette du Vide (accessory) | équipement |
| power_ring | Anneau de Puissance (accessory) | équipement |
| ward_ring | — (accessory) | équipement |
| potion_soin_mineure | — (consumable) | consommable |
| potion_soin_majeure | Potion de Soin Majeure | consommable |
| potion_mana_mineure | — | consommable |
| fragment_vie | — (material) | **matière (émoji)** |
| cristal_energie | — (material) | **matière (émoji)** |
| metal_rare | — (material) | **matière (émoji)** |
| adn_alien | — (material) | **matière (émoji)** |
| noyau_plasma | — (material) | **matière (émoji)** |
| powernax | — (material) | **matière (émoji)** |
| ammo_arrows | — (ammo) | munition |
| ammo_cells | — (ammo) | munition |
| key_donjon_furiste | — (quest) | quête |

**D'où il vient** : `src/rpg/items/itemCatalog.ts` → généré en `Shared/Catalogs/Items.lua` (`ITEM_DB`) par `scripts/narvos-catalogs-to-lua.mjs`.
**Qui le lit** : `Inventory.lua` (grille), `Craft.lua` (recettes), `equipmentSlots.ts`, `lootTables.ts`, `inventoryStore.ts`.
**Dans quel écran** : `InventoryScreen` / `InventoryGrid` / `EquipmentPanel` (inventaire & équipement), `components/inventory/CraftingPanel.tsx` (craft par items), volet inventaire du HUD.

### Liste B — `src/rpg/professions/professionCatalog.ts` (42 identifiants = 6 métiers + 18 ressources + 18 sorties de craft)
Le vrai découpage (corrigé le 2026-09-07) : **6 métiers** (bucheron, mineur, recolteur,
forgeron, alchimiste, joaillier), **18 ressources récoltables** (paliers 1→50) et
**18 sorties de craft** — des OBJETS FINIS, qui appartiennent au même monde que
les 26 de `Items.lua`, pas au monde des matières.

| métier | tiers (niv 1 → 50) | objets fabriqués |
|---|---|---|
| Bûcheron | bois_use · chene_solide · bois_ancien · bois_spectral · bois_lunaire · bois_legendaire | — (alimente forgeron) |
| Mineur | pierre_fragile · **fer** · **acier** · cristal_magique · minerai_lunaire · **adamantite** | — |
| Récolteur | herbe_commune · racine_robuste · fleur_de_givre · lichen_arcanique · essence_lunaire · fleur_eternelle | — |
| Forgeron | — | dague_fer · epee_acier · hache_raffinee · lame_magique · egide_lunaire · lame_adamantite |
| Alchimiste | — | potion_soin_min · elixir_vigueur · philtre_givre · decoction_arcanique · essence_concentree · panacee_eternelle |
| Joaillier | — | anneau_fer · pendentif_acier · bague_givre · talisman_magique · diademe_lunaire · couronne_eternelle |

**D'où il vient** : `professionCatalog.ts` (source de vérité des métiers).
**Qui le lit** : `professionStore.ts`, `craftedItems.ts`, `RpgGameWorld`.
**Dans quel écran** : `ProfessionPanel`, `HarvestNodeAdminPanel`, `HarvestPlacementGizmo`, `rpg/professions/CraftingPanel.tsx` (craft par métier).

---

## 2. Recouvrements de SENS malgré intersection nulle

`itemCatalog` et `professionCatalog` ne partagent **aucun identifiant** (0 intersection, mesuré). Mais plusieurs paires **désignent la même chose à des échelles différentes** :

| notion | liste A (`items`) | liste B (`professions`) | même chose ? |
|---|---|---|---|
| **métal** | `metal_rare` (1 seul, plat) | `fer` (10) → `acier` (20) → `adamantite` (50) · valeur 9 → 24 → 340 | **OUI** — le même « métal » à 3 paliers vs 1 palier. `metal_rare` est le sommet jamais relié. |
| **cristal** | `cristal_energie` (source d'énergie) | `cristal_magique` (30) · `minerai_lunaire` (40) | partiellement — énergie vs enchantement/minerai. |
| **biolé/plante** | `fragment_vie` (fragment de vie) | herbes/fleurs (herbe_commune → fleur_eternelle) | partiellement — le « vivant » des deux côtés. |
| **avancé sci-fi** | `noyau_plasma`, `adn_alien`, `powernax` | *aucun* | non — ces matières n'existent que côté `items`. |

**Le cœur** : `metal_rare` (A) et `fer/acier/adamantite` (B) sont la **même matière** mais deux économies la déclarent séparément. Un joueur qui raffine `fer` ne voit jamais `metal_rare` ; un joueur qui craft une Lame Plasma n'a jamais touché un gisement de `fer`.

**Les 6 matières « à un émoji »** : `powernax, noyau_plasma, cristal_energie, adn_alien, metal_rare, fragment_vie` sont **toutes dans liste A** et **aucune dans B**. Ce sont les goulots d'étranglement du craft sci-fi, et elles n'ont qu'un emoji pour visuel.

---

## 3. Trois fusions possibles

### Fusion A — tout ramener sur les 26 (`items`)
Tous les objets de B deviennent des `material` d'`itemCatalog`. 
- **Coût** : réécrire `professionCatalog` pour référencer des id `items` ; recâbler les 21 recettes métier ; **perd la progression à 6 paliers** (bois_use → bois_legendaire n'existe plus tel quel) ; les nœuds de récolte devraient dropper des items plats.
- **Perte** : la courbe de métier (1/10/20/30/40/50) qui structure l'exploration.

### Fusion B — tout ramener sur les 42 (`professions`)
Les 26 items deviennent des ressources récoltables/fabricables.
- **Coût** : un `plasma_blade` ou une `cyber_armor` n'est **pas une ressource** — forcer ce modèle fausse l'inventaire/équipement ; le craft sci-fi (`craftingSystem.ts` + `Craft.lua`) serait réécrit sur l'échelle profession.
- **Perte** : les objets d'équipement (armes/armures/accessoires) n'ont pas de paliers de collecte.

### Fusion C — deux niveaux RELIÉS (matière brute / objet fini)
On garde B = **matières brutes** (récolte, paliers) et A = **objets finis** (équipement + matières avancées), et on **ajoute le pont** : les ressources de B se raffinent en matières de A.
- Exemple de chaîne : `fer + acier` → `metal_rare` ; `cristal_magique` → `cristal_energie` ; `fleur_eternelle` → `fragment_vie`.
- **Coût** : écrire 3-4 recettes de *raffinage* + rendre visibles les 6 matières à émoji dans la chaîne (icônes/véritables visuels). C'est un coût *d'ajout*, pas de casse : rien n'est détruit, on relie.

---

## 4. Recommandation (une seule)

**Fusion C** — matériaux bruts (B) → raffinage → matières avancées + objets fini (A).

**Pourquoi** :
1. Respecte la chaîne visée `EXPLORE → RÉCOLTE → RESSOURCES → TRANSFORMATION → CRAFT → INVENTAIRE → UTILISATION → COMMERCE`. A et B ne sont plus deux économies parallèles : B alimente A, une seule progression.
2. **Aucune casse** : ni l'inventaire/équipement (`Inventory.lua` + `Items.lua`), ni les métiers (`professionCatalog` + recettes) ne changent de modèle. On ne déplace que la jonction.
3. Les **6 matières à émoji** deviennent les **produits finis du raffinage** (le sommet de la chaîne de transformation). C'est là qu'il faut investir en visuels (ou acheter des icônes), au lieu de dessiner 39 ressources dispersées.
4. Le craft sci-fi (`craftingSystem.ts` / `Craft.lua`) continue à consommer les matières de A ; le craft métier (`professionCatalog` RECIPES) continue à produire des objets de B. Le pont est uniquement au **raffinage**, pas dans les systèmes de craft eux-mêmes.

**Coût estimé du pont** : ~4 recettes de raffinage + 2-6 icônes/meshes pour `powernax, noyau_plasma, cristal_energie, adn_alien, metal_rare, fragment_vie`. Gain : une seule liste d'objets cohérente, chaîne d'économie complète.

---

## 5. Ce dont je ne suis pas sûr

- L'écart **42 vs 39** : j'ai mesuré **39 identifiants uniques** dans `professionCatalog`. Le brief dit 42. Soit le comptage du brief inclut des champs non-`itemId` (labels de recettes ?), soit il compte des doublons. Je n'ai pas trouvé le 40-42e id.
- La direction du raffinage est une **décision d'équipe** : `fer/acier` → `metal_rare` n'est qu'un exemple. Le sens inverse (`metal_rare` extrait en gisements professionnels) est tout aussi défendable et moins coûteux (pas de nouvelle recette, juste le nœud de récolte). Je recommande celle qui **reste dans la logique EXPLORE→RÉCOLTE** : les gisements donnent les ressources brutes, le raffinage grossit vers les matières avancées.
- `fragment_vie` vs herbes : `fragment_vie` a une connotation « fragment d'ADN » alors que les herbes de B sont végétales. Les traiter comme une même famille est un choix thématique ; si le jeu veut des « fragments » distincts des « plantes », le pont devient plus étroit.