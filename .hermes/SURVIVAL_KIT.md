# Survival Crafting System (a_trier) — ce qui vaut la peine — 2026-09-07

**Cible :** `WebPortal/public/asset_game/a_trier/animation_craf/Survival Crafting System/` —
510 Mo, **364 uasset** mesurés, `.uproject` 4.21. **Aucun fichier du jeu n'a été
modifié** : relevé seul. Les DataTables ont été lues en Binaire (`strings` absent
sur cette machine — extraction par octets lisible, script fourni par le brief).

## 1. Modèle de données des 4 DataTables (livrable principal)

Extraction réelle (chaînes uniques, suffixes GUID retirés) :

### `DT_ItemList` — structure `S_ItemInformation` (+ 7 sous-structures)

| champ (nom exact) | type | sens |
|---|---|---|
| `ItemName` | text | libellé |
| `ItemInformationText` | text | description (ex. réelle : « Chunked tuna found as food… ») |
| `ItemImage` | Texture2D | icône d'item (`T_Icon_*`) |
| `ItemMesh` | StaticMesh | modèle dans le monde (`SM_*`) |
| `ItemClass` | BP | Blueprint acteur de l'objet (`BP_*_C`) |
| `EItemType` | enum `E_Item` (~21 valeurs, `NewEnumerator0..20`) | catégorie d'item |
| `ItemSlotMaximumAmount` | int | **taille de pile max par item** |
| `ItemOnClickedSound` / `ItemOnReleasedSound` / `ItemOnUsed` | son | **sons attachés à l'item** |
| `S_ItemSkinInformation` (`SkinName`, `SkinDisplayName`, `SkinDisplayTexture`, `SkinDetails`) | struct | **SKINS / variantes visuelles** : `Default*/Blue/Black/Gray/Green/Iron` (Backpack, Barrel, Helmet, Buff, Sandals…) |
| `S_ItemPhysicsSettings` (`EnableGravity`, `IsSimulatingPhysics`, `MassInKg`, `ReplicatePhyiscsToAutonomousProxy`…) | struct | physique par item |
| `S_ItemImpulseSettings` (`ImpulseMultiplier`, `VelChange`, `ApplyImpulseOnDamage`…) | struct | impulsions |
| `S_ItemVisualSettings`, `S_ItemSpawnSettings`, `S_ItemWidgetSoundSettings`, `S_MassInKgSettings` | structs | rendu, spawn, sons d'UI, masse |

**Objets présents :** Aspirin, Bandage, FirstAidKit, Flashlight, Backpack, Barrel,
WoodenBarrel, Buff, Helmet, Sandals, CanOfTuna, CanOfSoup, Chocolate, CookedMeat,
RawMeat, WaterBottle, CampFire, Cloth, Leather, Wood (+ variantes de skins).
Textures d'icônes : `T_Icon_004…047` (~45 icônes) ; meshes : `SM_Back_Pack_001`,
`SM_Barrel_Clothes_001/2`, `SM_Helmet_002`, `SM_Cloth`, `SM_leather`, `SM_Wood_003`…

### `DT_CraftingList` — `S_CraftingInformation` + `S_CraftingIngredients`

| champ | sens |
|---|---|
| `CraftingIngredients` | **tableau** de `S_CraftingIngredients { Amount, … }` (une entrée = un ingrédient) |
| `CraftingTime` | temps de fabrication |
| `ItemAmountPerCraft` | quantité sortie par craft |
| `MaximumCraftAmountMultiplier` | **multiplicateur de quantité max** (craft en lot) |
| `RowStruct` | `S_CraftingInformation` |

**Recettes (8) :** Backpack, Bandage, Barrel, CampFire, FirstAidKit, Helmet,
Sandals, WoodenBarrel. Ingrédients référencés par l'enum `E_Item`.

### `DT_CategoryList` — `S_ItemCategoryInformation`

| champ | sens |
|---|---|
| `CategoryVisualIcon` | icône de catégorie (`T_Attribute_008/009/012/017/018/019`) |
| `E_ItemCategory` | enum user : *7 catégories* (`NewEnumerator0..6`). ⚠ Les noms ne sont pas dans les chaînes (enum sans libellés lisibles) |

### `DT_ActionList` — `S_ActionInformation`

| champ | sens |
|---|---|
| `ActionName` | libellé (« Put On A Bandage ») |
| `ActionClass` | Blueprint généré : `BP_DropAction_C`, `BP_EatAction_C`, `BP_PutBandageAction_C` |

→ **3 actions** : déposer, manger, poser un bandage. La mécanique « une action
par item » est dans le champ `ItemOnUsed` de l'ItemList qui pointe vers elle.

## 2. Les 27 écrans UMG — rôle déduit du nom

**Artisanat (9)** : `WBP_CraftingMain` (fenêtre principale) · `WBP_CraftingCategory`
(choix de catégorie) · `WBP_CraftingItem` (liste d'items à la recette) ·
`WBP_CraftingItemProcess` (progression de craft) · `WBP_QuickCraft` (recettes
rapides) · `WBP_CraftInformation` (détails recette) · `WBP_CraftIndicator` /
`WBP_CraftingNameIndicator` (badges) · `WBP_CraftingSkins` (choix de skin du
produit !).

**Inventaire (10)** : `WBP_InventoryGridSlotPanel` (grille) · `WBP_InventorySlot_Item`
(une cellule) · `WBP_ItemPanel` · `WBP_ItemInformation` (fiche) ·
`WBP_ItemActionsPanel` (menu d'actions) · `WBP_ItemSplitting` + `WBP_SplittedItem`
(split de pile) · `WBP_DraggedItem` (drag & drop) · `WBP_CollectedItem` ·
`WBP_ItemPickingWidget` (ramassage).

**Personnage (4)** : `WBP_AttributesPanel`, `WBP_Attribute`, `WBP_3DLiveCharacter`
(mannequin 3D encarté), `WBP_ClothSlotPanel` (panneau de vêtements).

**HUD / barre d'action (3)** : `WBP_HUD`, `WBP_MainbarSlot`, `WBP_ActionButton`.

## 3. Comparaison avec notre Lua (Inventory.lua, Craft.lua, Recettes.lua)

| notion | nous | le paquet | verdict |
|---|---|---|---|
| Grille (cols×rows, instances uid) | ✓ | ✓ (InventoryGridSlotPanel) | équivalent |
| Piles max par item | ✓ `maxStack` | `ItemSlotMaximumAmount` | équivalent |
| Équipement / slots | ✓ 6 slots | vêtements (ClothSlotPanel, Back/Foot/Head…) | le nôtre est plus structuré (registres) |
| Recette entrées → sortie | ✓ | ✓ (+ `Amount` par ingrédient) | équivalent |
| Temps de fabrication | ✓ `duree_ms` | `CraftingTime` | équivalent |
| Station (forge/alchimie) | ✓ | (pas de station explicite) | nous avons plus |
| **Skinaudition (variantes visuelles)** | ✗ | **`S_ItemSkinInformation`** | **le paquet a UNE notion que nous n'avons pas** |
| **Multiplicateur de lot** | ✗ | `MaximumCraftAmountMultiplier` | **à reprendre** |
| **Sons par item** (clic/release/use) | ✗ | `ItemOn*Sound` | **à reprendre** |
| **Action par item** | ✗ | `ItemOnUsed` + BP ActionClass | **à reprendre (mécanique)** |
| **Masse / physique par item** | ✗ (weight = nombre) | `MassInKg`, impulses | **à reprendre si l'économie le veut** |
| Icône + description par item | ✓ (`icon` emoji, `description`) | `ItemImage` + `ItemInformationText` | équivalent |
| Skins affichés en UI | ✗ | `CraftingSkins` | **à reprendre** |
| Crédits / valeur | ✓ | (valeur simple via S_MassInKg ? non mesuré) | nous avons plus |

## 4. Verdict en trois seaux

**À REPRENDRE :**
- le **modèle de données** (structure `S_ItemInformation`/`S_CraftingInformation`)
  comme spécification de notre futur catalogue : skins, sons par item, action par
  item, multiplicateur de lot, masse. Il ne faut pas les copier en `.uasset`,
  mais en reprendre les **concepts pour `itemCatalog.ts`** et l'UI web.
- la **disposition** `WBP_QuickCraft` (recettes rapides) et `WBP_ItemSplitting`
  (la bonne ergonomie de partage de pile : des quantités entières) — à reproduire
  en HTML ; le reste des écrans (CraftingMain, ItemPanel) est un bon plan de
  référence visuelle.

**À IGNORER :**
- les **63 Blueprints 4.21** (toute la logique) : en nanos c'est du Lua, et le
  nôtre est testé. Une conversion 4.21 → 5.7 casse régulièrement (six générations).
- **le contenu** : tuna, chocolate, aspirin, bandage, campfire, flashlight —
  du survival moderne, pas de la sci-fi NARVOS. Ne proposer aucun de ces objets.
- les DataTables en tant qu'**assets** (inutilisables hors UE).

**À VÉRIFIER DANS L'ÉDITEUR :**
- les **meshes** d'objets (SM_Cloth, SM_Back_Pack_001, SM_Helmet_002, SM_leather,
  SM_Wood_003…) : conversion 5.7 ?, matériaux d'origine `M_Survival_Kit_*` ;
  ce sont des vêtements/ressources **basiques** qui pourraient servir à une tenue
  civ-2 dans la campagne — à juger à l'écran.
- les **27 UMG** : lisibilité réelle (typographie, échelle) pour reprendre les
  bons principes sans ouvrir Unreal.
- les ~45 **icônes** `T_Icon_*` : souvent du contenu survival (boîtes de conserve)
  mais quelques-unes réutilisables (icônes de catégorie/action).

## Sorties réelles (extraits)

```
find "Survival Crafting System" -iname '*.uasset' | wc -l            → 364
find "Survival Crafting System" -iname '*WBP*' | wc -l               → 27 (liste collée au §2)
node survival_extract.js
   DT_ItemList    : 563 chaines brutes -> 399 uniques   (S_ItemInformation + 7 sous-structs)
   DT_CraftingList: 63 chaines brutes -> 54 uniques     (S_CraftingInformation + S_CraftingIngredients)
   DT_CategoryList: 51 chaines brutes -> 43 uniques     (S_ItemCategoryInformation, E_ItemCategory)
   DT_ActionList  : 39 chaines brutes -> 30 uniques     (S_ActionInformation + 3 BP actions)
```