# Les nouveaux paquets — ce qui est récupérable, et ce qui ne l'est pas

Relevé du 2026-09-07. Mesuré, pas estimé.

## La règle qui tranche tout

nanos est un **client Unreal 5.7 *shipping*** : pas de `Source/`, aucun module
C++ tiers chargeable. Le gameplay s'écrit en **Lua**. D'où trois verdicts qui ne
se discutent pas :

| nature de l'asset | verdict |
|---|---|
| meshes, textures, matériaux, animations, sons, Niagara | **récupérable** — import + cook |
| **système Blueprint** (IA, inventaire, combat, trafic) | **ne pilote rien** dans nanos. Notre gameplay est en Lua et il est testé. Valeur = **référence de conception**, pas code |
| **plugin C++** (non whitelisté) | **jamais**. Ne s'exécutera pas |

C'est déjà la conclusion du skill `nanos-world` §0. Elle s'applique en bloc aux
paquets ci-dessous.

---

## Le tableau

| paquet | uasset | maps | moteur | verdict |
|---|---|---|---|---|
| **Meta Customization System** | **3 502** | 12 | ? | **le plus précieux du lot** — voir plus bas |
| SlotBased_inventory | 1 043 | 1 | 5.5 | 6ᵉ système d'inventaire. Blueprint |
| **MetaWardrobe** | 988 | 1 | ? | garde-robe modulaire — **assets récupérables** |
| Multiplayer Shooter System | 911 | 8 | 5.6 | Blueprint. Meshes d'armes récupérables |
| **FluidFlux** | 856 | 12 | 5.3 | **à vérifier** — voir plus bas |
| CityTrafficPro | 587 | 1 | 5.6 | Blueprint. **Les véhicules et la route, oui** |
| **ModularSewers & Tunnels** | 549 | 5 | ? | **kit d'environnement — directement utile** |
| Freeflow Combat | 517 | 1 | 5.6 | Blueprint. Notre `Combat.lua` existe |
| AIBehaviorToolkit | 466 | 10 | 5.6 | Blueprint. Notre `Ia.lua` existe |
| Open World AI Spawn System | 289 | 2 | **4.25** | Blueprint + 4.25. Notre `Peuplement.lua` fait ça |
| AdvancedGASSystem | 140 | 0 | ? | GAS = Gameplay Ability System, **C++**. Inutilisable |
| **Spring Landscape** | 50 | 1 | ? | **petit, mais c'est un vrai Landscape** |
| Enhanced_AI_Movement | 20 | 0 | ? | 20 assets. Négligeable |

---

## Ce qui est vraiment récupérable, par ordre

### 1. Le modulaire — `Meta Customization System` (3 502) + `MetaWardrobe` (988)

**C'est le seul lot dont la valeur n'est pas dans le Blueprint.** Son contenu :

```
Meta_Body_Tool  Meta_Face_Tool  Meta_Styler  Metahuman_Face_Customization
Metawadrobe  Hair  Skeletal_Meshes  Textures  Material  Premade_Blueprints
Underwear_Remover  Fantasy_RPG_Game  StartMenu
```

Le **Meta Body Tool** est déjà notre référence visuelle pour l'éditeur de
personnage — ses curseurs de morphologie et sa grille de slots ont été repris.
Là on a **la source**, pas seulement la capture d'écran.

⚠ `Metahuman_*` : les MetaHumans ont leur propre squelette et leur propre
licence. Le corps modulaire de NARVOS est sur `SKEL_Mannequin` 68 os. **Ne pas
supposer que ça s'emboîte** — c'est à mesurer avec `narvos-skeleton-compat.mjs`.

### 2. Les environnements — `ModularSewers & Tunnels` (549, 5 maps)

Kit modulaire d'égouts et tunnels. **Aucun Blueprint à convertir** : ce sont des
meshes. Utilisables tels quels après import + cook. Un souterrain manque à
NARVOS, et c'est exactement le genre de lieu qu'un kit modulaire fabrique bien.

### 3. Les véhicules et la route — `CityTrafficPro` (587)

Le **système** de trafic est Blueprint, donc mort pour nous. Mais le paquet
contient les **véhicules et le mobilier de route** — feux, panneaux, garde-corps,
marquages. C'est ça qu'on prend pour peupler les routes des maps humaines.

### 4. `Spring Landscape` (50 uasset, 1 map)

Petit, mais il porte un vrai `MI_Landscape` et une map `Overview`. **Candidat
planète** : un Landscape entre comme sous-niveau, exactement comme forge, tower
et alien.

### 5. Les armes — `Multiplayer Shooter System` (911)

Le système est Blueprint. Les **meshes d'armes** ne le sont pas.

---

## `FluidFlux` — le système de vagues, à VÉRIFIER avant d'y croire

856 uassets, 12 maps, UE 5.3. Dossiers : `Waves`, `Simulation`, `Surface`,
`Coastline`, `Interaction`, `Tools`, `Editor`.

**Cette copie ne contient que `Content/`** — aucun `Source/`, aucun `.uplugin`
trouvé jusqu'à trois niveaux de profondeur.

Deux lectures possibles, et je ne peux pas trancher sans essayer :

1. FluidFlux 3.x fonctionne par **matériaux + Niagara + render targets**, tous
   natifs au moteur → le contenu seul pourrait suffire ;
2. c'est un plugin de code amputé de son module → **rien ne fonctionnera**, et
   la simulation restera figée.

⚠ FluidFlux **n'est pas dans la whitelist de plugins nanos**. Si la simulation
dépend d'un module C++, elle ne tournera jamais côté client. La whitelist
n'autorise que **Water** et **Advanced Water** (natifs).

**À faire avant de compter dessus :** importer le contenu dans l'ADK, ouvrir une
des 12 maps de démonstration, regarder si la surface bouge.

---

## Les systèmes Blueprint : pourquoi on ne les prend pas

`AIBehaviorToolkit`, `Enhanced_AI_Movement`, `Open World AI Spawn`,
`Freeflow Combat`, `SlotBased_inventory`, `AdvancedGAS`.

Ce ne sont pas de mauvais paquets. **Ils font ce que notre Lua fait déjà**, et
notre Lua est testé :

| leur paquet | notre équivalent | état |
|---|---|---|
| AIBehaviorToolkit, Enhanced_AI_Movement | `Server/Ia.lua` + `Logic/Ia.lua` | écrit, harnais vert |
| Open World AI Spawn System | `Server/Peuplement.lua` | écrit, deux rayons |
| Freeflow Combat | `Logic/Combat.lua` + `Server/Combat.lua` | écrit, harnais vert |
| SlotBased_inventory | `Logic/Inventory.lua` | 1 021 lignes, persisté |
| AdvancedGAS | — | GAS est **C++**, hors whitelist |

**Leur valeur est en conception, pas en code.** Ouvrir leur graphe pour voir
comment ils gèrent un cas qu'on a mal traité : oui. Les importer : non.

⚠ **Cela porte à SIX les systèmes d'inventaire du dépôt** (Hyper V2 5 478,
Inventory_System_Pro 2 220, SlotBased 1 043, Hyper V3 1 043,
Inventory_and_Stat 578, Survival Crafting 364). La décision « en choisir un
seul » n'est plus reportable.

---

## Blocage en cours — `Spaceship Pack 1`

Copié dans `adk/Content/Spaceship Pack 1/` (141 uasset, UE 4.26), mais la
promotion échoue :

```
[NARVOS] ABSENT      /Game/Spaceship Pack 1  (pack non stage ?)
```

Le registre d'assets ne voit pas le dossier. Cause probable : **l'espace dans le
nom**. Renommer le dossier sur disque casserait les références internes, qui
pointent vers `/Game/Spaceship Pack 1/…`. À traiter avec `rename_asset`, un par
un, comme le reste.

`Megastructure_Scifi_World` est passé sans problème : **82 assets sous
`/Game/Narvos/`**, plus 44 redirecteurs restés à l'ancienne place — non cuits,
donc inoffensifs.

⚠ La promotion s'est terminée sur une erreur Python :
`'AssetTools' object has no attribute 'fixup_referencers'` — l'API a changé en
5.7. `scripts/adk-promouvoir-packs.py:229` est à corriger.