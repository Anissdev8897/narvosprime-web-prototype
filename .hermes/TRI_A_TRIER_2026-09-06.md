# Tri de `asset_game/a_trier` — 2026-09-06

21 paquets, **~31,5 Go**. Mesuré par énumération du disque, pas estimé.

Le critère qui décide de tout : **nanos est un client Unreal 5.7 *shipping*.**
Aucun plugin C++ tiers ne s'y exécute. Un pack en C++ n'apporte donc que ses
assets et son idée — jamais son code.

Second critère, qui a failli me faire écarter 5,4 Go à tort : **nanos SAIT
afficher de l'UMG.** La classe `Widget` prend un `BlueprintPath`, l'ajoute au
viewport, et expose `CallBlueprintEvent` / `SetBlueprintPropertyValue`
(`Classes/Widget.json`, autorité client). Les interfaces des packs ne sont donc
pas mortes d'avance.

⚠ Mais le pont Lua ↔ Blueprint ne porte que des **scalaires** — Boolean, Integer,
Float, String, Name, Text, Vector, Rotator, Color… **ni tableau, ni structure.**
Nourrir une grille d'inventaire se ferait case par case.

---

## 1. Immédiatement utilisable

Blueprint + assets, zéro C++, cuisible tel quel.

| paquet | Mo | pour quel chantier |
|---|---|---|
| **SlotBased_inventory_5.5+** | 2 027 | D4 inventaire — 1 043 uasset, 62 BP |
| **Inventory_System_Pro (Moonville)** | 1 689 | D4 — **194 BP**, le plus fourni |
| **Hyper Skill Level Manager v2** | 1 345 | progression, métiers (E1) |
| **Hyper_Slot_Based_Inventory_V3** | 1 198 | D4 |
| **Spring Landscape** | 973 | D1 map — 50 uasset, **0 BP** : pur décor |
| **AI Behavior System** | 549 | E7 monde vivant — 371 uasset, 25 BP |
| **Inventory_and_Stat_System** | 500 | D4 — 84 BP, le plus léger |
| **Spaceship_Pack_1** | 416 | D1 map spatiale — 141 uasset, 20 BP |
| **AIBehaviorToolkit v1.9.6** | 223 | E7 |
| **Open World AI Multiplayer Spawn** | 208 | **récolte / spawn de PNJ** — 289 uasset |

**Sous-total : ~9,1 Go.**

### ⚠ Quatre systèmes d'inventaire pour un seul besoin

5,4 Go, quatre paquets qui font la même chose. **Il faut en choisir UN**, et le
critère n'est pas la taille : c'est ce qu'on veut leur prendre.

Notre interface est déjà en **WebUI** (HTML/CSS/JS) et elle fonctionne. Ce qui a
de la valeur ici, dans l'ordre :

1. **les icônes, textures et matériaux** — réutilisables tels quels ;
2. **le modèle de données** — comment ils rangent piles, poids, catégories ;
3. **les widgets UMG** — spawnables, mais à travers un pont qui ne porte pas de
   tableau. À réserver à un écran simple.

Cuire les quatre serait absurde : ~5 Go pour trois de trop.

---

## 2. Utilisable après adaptation

| paquet | Mo | réserve |
|---|---|---|
| **Meta Customization System** | 11 222 | **déjà stagé dans l'ADK**, exclu du cook. 3 502 uasset, 51 BP. Le plus gros paquet à lui seul. |
| **FluidFlux v3.0.4** | 463 | ⚠ **plugin de simulation d'eau, non whitelisté par nanos.** La simulation ne tournera pas. Ses matériaux et meshes, peut-être. |

---

## 3. Mort au runtime — C++

| paquet | Mo | fichiers C++ |
|---|---|---|
| **AdvancedGASSystemUE56** | 360 | **467** |
| **Enhanced_AI_Movement** | 67 | 42 |

⚠ Piège d'homonymie déjà documenté : `AdvancedGASSystem` **n'est pas** le
Gameplay Ability System natif d'Unreal, qui, lui, est whitelisté. C'est un plugin
tiers. Il ne s'exécutera pas.

Leur seule valeur est l'**idée** : lire leur conception, la réécrire en Lua.

---

## 4. Mauvais moteur — Unity

| paquet | Mo |
|---|---|
| Spaceship_Engine (Unity) | 1 630 |
| Spaceship_Echo_One (Unity) | 32 |
| UGUI_MiniMap v2.5.0 | 4 |
| Multiversal Vehicle Controller Pro | 0,03 |

**~1,7 Go de `.unitypackage`.** Format propriétaire Unity : ni Unreal ni nanos ne
le lisent. Extraire les meshes est possible avec un outil tiers, mais les
scripts, matériaux et prefabs ne se portent pas.

⚠ `UGUI_MiniMap` est une minimap **Unity uGUI**. Notre HUD est en WebUI — une
minimap s'y écrit en canvas HTML, ce paquet n'aide pas.

---

## 5. Pas des assets de jeu

| paquet | Mo | quoi |
|---|---|---|
| **Modern Tanks and Vehicles** | **8 107** | 769 `.stl` + 706 `.x_t` |

`.stl` et `.x_t` (Parasolid) sont des formats de **CAO et d'impression 3D** :
pas d'UV, pas de matériaux, pas de LOD, et une densité de triangles calculée
pour une imprimante, pas pour un moteur temps réel.

**8,1 Go — le quart du dossier — pour zéro asset directement jouable.** Les
convertir demanderait un retopo complet, modèle par modèle : plus cher que
modéliser à neuf ou qu'acheter un pack de véhicules game-ready.

---

## Bilan

| catégorie | Mo | part |
|---|---|---|
| immédiatement utilisable | 9 128 | 29 % |
| après adaptation | 11 685 | 37 % |
| mort au runtime (C++) | 427 | 1 % |
| mauvais moteur (Unity) | 1 666 | 5 % |
| pas des assets de jeu | 8 107 | **26 %** |

**Un tiers du dossier ne servira pas** — 8,1 Go de CAO et 1,7 Go d'Unity.

---

## Ce que je recommande, sans rien faire pour l'instant

1. **Choisir UN système d'inventaire** avant d'en cuire un seul. Mon avis :
   `Inventory_System_Pro` (194 BP, le plus fourni) pour son modèle de données et
   ses icônes — mais on garde notre WebUI.
2. **Spring Landscape et Spaceship_Pack_1** sont les deux gains les plus francs
   pour la map : du décor pur, sans logique, sans dépendance.
3. **Open World AI Multiplayer Spawn System** mérite une lecture avant d'écrire
   la récolte : c'est exactement le problème « faire exister des choses autour du
   joueur, et pas ailleurs ».
4. **Ne rien promouvoir sous `Narvos/` avant de l'avoir choisi.** Le cook avale
   tout ce qui s'y trouve — c'est ce qui l'a tué deux fois aujourd'hui, dont une
   à cause d'assets qu'on y avait mis nous-mêmes.

⚠ Rien n'a été déplacé, copié ni supprimé. Ce document est une mesure et un avis.