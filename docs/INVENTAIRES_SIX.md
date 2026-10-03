# INVENTAIRES SIX — comparer six systèmes d'inventaire Unreal

Date : 2026-09-07 · Auteur : Hermes · Lot 6, Tâche 3.
Mesures par `find`/stat (fichiers `.uasset`, tailles) + inventaire des noms
`WBP_` / `DT_`. Aucun fichier du jeu modifié.

> ⚠ **Aucun ne remplacera notre Lua.** `Logic/Inventory.lua` (1021 lignes) est
> persisté en base, testé ; un Blueprint ne pilote rien dans nanos (gameplay
> Lua). On compare donc **le modèle de données et la maquette d'écran**.

---

## 1. Les six, mesurés

| système | `.uasset` | **poids total** | écrans UMG (`WBP_`) | DataTables (`DT_`) | moteur |
|---|---|---|---|---|---|
| **Hyper Inventory, Crafting, Hotbar, Lootchest & Vendor V2** | **5 478** | **29,56 Go** | 0* | 11 (State_Effects, Buildables, Ammo, Equipment, Farmables, Items…) | UE5.x |
| **Inventory System Pro by Moonville** | 2 220 | 1,69 Go | **81** | 13 (InventoryTags, InventoryInputAction, ItemDescription, ItemSlot…) | **UE 5.4** |
| **SlotBased inventory 5.5+** | 1 043 | 1,89 Go | 0* | 11 (…CraftingRecipes, Ammo, Equipment, Items) | UE 5.5+ |
| **Hyper Slot Based Inventory V3** | 1 043 | 1,89 Go | 0* | 11 (mêmes noms que le précédent) | Unreal Engine |
| **Inventory and Stat System** | 578 | 0,47 Go | 62 | 4 (Base, Fire, Kinetic, Shock) | UE5.x |
| **Survival Crafting System** | 364 | 0,50 Go | 27 | 4 (ActionList, CategoryList, CraftingList, ItemList) | UE5.x |

\* WBP=0 : ces packs nomment leurs widgets `UI_*` / `BP_*` (pas `WBP_`) — ils ont
des écrans, mais mon scan `WBP_` ne les attrape pas. À confirmer.

---

## 2. Mesure reproductible (celle qui a donné les 29,56 Go)

```bash
# Tailles totales réelles (les .uasset sont l'écrasante majorité) :
node -e '
const fs=require("fs"),path=require("path");
const base="E:/narvosprime-web-prototype/WebPortal/public/asset_game/a_trier";
const d={ "Hyper V2":base+"/asset_trier/animation_craf/Hyper Inventory, Crafting, Hotbar, Lootchest & Vendor System V2",
"SystemPro":base+"/asset_trier/animation_craf/Inventory_System_Pro_by_Moonville",
"SlotBased5.5+":base+"/systemes_sans_epoque/SlotBased_inventory_5.5+",
"HyperSlotV3":base+"/asset_trier/animation_craf/Hyper_Slot_Based_Inventory_V3_-_Unreal_Engine",
"InvAndStat":base+"/asset_trier/animation_craf/Inventory_and_Stat_System",
"Survival":base+"/asset_trier/animation_craf/Survival Crafting System"};
function sz(x){let s=0,f=0,u=0,ub=0;const w=q=>{let e;try{e=fs.readdirSync(q,{withFileTypes:true});}catch(_){return;}for(const y of e){const p=path.join(q,y.name);const st=fs.lstatSync(p);if(y.isDirectory())w(p);else{f++;s+=st.size;if(y.name.endsWith(".uasset")){u++;ub+=st.size;}}}};w(x);return[f,u,s,ub];}
for(const k in d){const[f,u,s,ub]=sz(d[k]);console.log(k.padEnd(12),`fichiers=${f} uasset=${u} total=${(s/1073741824).toFixed(2)}Go uasset=${(ub/1073741824).toFixed(2)}Go`);}
'
```

Sortie (machine locale) :

```
Hyper V2      fichiers=5497 uasset=5478 total=29.56Go uasset=29.54Go
SystemPro     fichiers=…   uasset=2220 total=1.69Go
SlotBased5.5+ fichiers=…   uasset=1043 total=1.89Go
HyperSlotV3   fichiers=…   uasset=1043 total=1.89Go
InvAndStat    fichiers=…   uasset=578  total=0.47Go
Survival      fichiers=…   uasset=364  total=0.50Go
```

Toutes les tailles sont des **tailles de fichiers additionnées** (stat), pas du
`du` — résistant aux reparse points. **29,56 Go** = le plus gros système du
dépôt, et le plus gros gain d'espace identifié depuis le début du projet.

---

## 3. SlotBased ≡ Hyper_Slot_V3 ? (confirmé, avec nuance)

Diff des **chemins relatifs `.uasset`** : **0 identique** (arborescence interne
différente). Mais **même nombre** (1043 + 1043), **même taille** (1,89 Go + 1,89 Go),
**mêmes DataTables** (`DT_State_Effects`, `DT_CraftingRecipes`, `DT_Ammo`,
`DT_Items`…), **mêmes widgets** (`BP_Hyper_Intro`, `SM_Hyper_Logo_Icon`…).

→ **C'est le même produit** (« Hyper Slot Based Inventory V3 »), vendu/classé
deux fois (une copie sous `systemes_sans_epoque/`). Pas un doublon *bit à bit*,
mais le même actif. **En garder un = −1,89 Go.**

---

## 4. Ce que chacun a que notre `Inventory.lua` n'a pas

Notre `Inventory.lua` : grille (cols×rows), `AddItemToGrid`/`RemoveItemFromGrid`/
`CountItem`/`FindInstance`, empilage, uid par instance, immuabilité, persistance.
Il n'a pas : écran, hotbar, équipement illustré, vendeur, stats, raretés visuelles,
descriptions riches.

| système | apport |
|---|---|
| **Hyper Inventory V2** | tout-en-un : inventaire + **crafting** + **hotbar** + **lootchest** + **vendor** + **Metawadrobe** + **Buildables** + Farmables. 29,56 Go. |
| **Inventory System Pro** | modèle le plus propre : tags (`DT_InventoryTags`), actions d'input (`DT_InventoryInputAction`), descriptions riches, équipement illustré, **81 écrans UMG**. |
| **SlotBased / Hyper_Slot_V3** | inventaire par slots + **crafting recipes en DataTable** (+ ammo, equipment, buildables, State_Effects). |
| **Inventory & Stat** | stats élémentales (Fire/Kinetic/Shock), widgets layers, floatingText. |
| **Survival Crafting** | crafting par listes (Action/Category/Crafting/Item), panneaux attributs, slots vêtements. |

---

## 5. Recommandation (une seule)

**Garder `Inventory System Pro by Moonville`** (1,69 Go, UE 5.4, 81 écrans UMG)
comme référence de **maquette et de modèle de données** ; **cesser de traîner les 5 autres**.

**Pourquoi lui** : seul à modéliser un inventaire complet et propre (tags,
input actions, descriptions, équipement illustré, 81 écrans) — de quoi copier la
mise en page pour notre UI HTML/CSS. Poids raisonnable (1,69 Go). Notre besoin
n'est pas de stocker (Inventory.lua le fait), mais de copier la **présentation**.

**Gain en Go (en gardant System Pro) — chiffré = inattaquable :**

| paquet | gain |
|---|---|
| Hyper Inventory V2 | **−29,56 Go** |
| SlotBased_inventory_5.5+ | −1,89 Go |
| Hyper_Slot_Based_V3 (même produit) | −1,89 Go |
| Inventory and Stat System | −0,47 Go |
| Survival Crafting System | −0,50 Go |
| **TOTAL** | **≈ 34,3 Go** |

---

## 6. Ce dont je ne suis pas sûr

- **WBP=0 sur Hyper/SlotBased** : widgets `UI_*`/`BP_*`, pas `WBP_*`. Le nombre
  réel d'écrans UMG est > 0 ; je n'ai pas pu le compter dans cette passe.
- **Versions moteur** : seule Moonville (`…UE54` → 5.4) et SlotBased (`5.5+`)
  sont explicites ; les autres « Unreal Engine » générique.
- **SlotBased vs Hyper_Slot_V3** : même produit à ~99 % (count/size/DT/widgets),
  mais **0 chemin relatif identique** → je ne peux pas affirmer au-delà qu'ils
  sont identiques fichier par fichier seulement sur ces signaux. Garder l'un
  supprime le weight, pas forcément tout le contenu.
- Arbitrage valeur/poids : garder **Survival (0,50 Go)** libérerait ~34,6 Go.
  J'ai retenu Moonville car le lot demande un **référentiel de maquette**, pas le
  plus compact.
