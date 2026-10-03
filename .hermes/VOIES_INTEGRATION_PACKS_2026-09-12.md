# Par quelle voie ces systèmes peuvent-ils vivre dans nanos ? (2026-09-12)

Analyse faite sur le CONTENU RÉEL des packs (`ls`/`grep` dans les `.uasset`, les
`.uplugin`, les `Source/`), pas sur leurs fiches de vente. Aucun fichier modifié,
ni cook ni éditeur lancé.

**Trois voies possibles :**
- **A — assets seulement** : on importe meshes/animations/icônes/sons, notre Lua pilote.
- **B — Blueprint piloté** : le pack tient dans des Blueprints spawnables, déclenchables par `CallBlueprintEvent`.
- **C — impossible en l'état** : dépend de C++, d'un plugin, du Behavior Tree/AIController d'Unreal ou du GameplayAbilities System.

---

## ⚠ AVANT TOUT : un pack est une COPIE PIRATÉE

`systemes_sans_epoque/AI Behavior System - Unreal Engine` contient
`Desire FX … .url` et `GameDev - Unreal Engine, Unity.txt` portant
« All materials are taken from open sources » et un renvoi Telegram
(@GameDevUE). **Rien de ce pack ne doit être importé ni livré** — ni ses
animations, ni ses meshes. Décision à prendre : le mettre en quarantaine.

---

## Verdict par système

| système | voie | ce qui bloque, ou ce qui vaut le coup | coût |
|---|---|---|---|
| **Hyper Skill Level Manager v2** | **A** | Le « système » est un `ActorComponent` (`AC_Level_Manager_*`) + 6 widgets qui font `GetComponentByClass` dessus. `Blueprint()` de nanos spawne des **Actors, jamais des composants** : les widgets tomberaient sur un cast nul. La logique (courbe d'XP, points) est 50 lignes dans `Competences.lua`. **À prendre** : 42 icônes (santé, stats, température, UI), police `Play`, 77 sons dont `level_up_Sound_Cue`, 20 Niagara. | ½ j |
| **AI Behavior System** | **C** | `BT_Main`, `BB_Main`, `BP_AIController` (`/Script/AIModule`, `RunBehaviorTree`, `AIPerception`), 5 EQS. Un Behavior Tree n'a d'autorité que sur un serveur Unreal ; le serveur nanos n'en est pas un. **Et surtout : copie piratée (voir ci-dessus).** | 0 |
| **AIBehaviorToolkit 1.9.6** | **C** | 34 assets importent `BehaviorTree`, 20 `AIController`, 28 `EnvQuery` ; `BP_NPC_Base` attend la réplication serveur d'Unreal. Le design (couverture, investigation, coordination de groupe) se **réécrit** dans `Ia.lua`. **À prendre** : `SK_UFO` + son AnimBP, poisson, poulet, épée/bouclier/grenade, 19 sons. | ½ j pour les assets |
| **AdvancedGASSystem** | **C** | `.uplugin` avec module **C++ Runtime** et 95 fichiers `.cpp/.h` ; dépend de `GameplayAbilities`, `Mover`, `TargetingSystem`. `Binaries/Win64` ne contient que des DLL d'ÉDITEUR. 63 des 140 assets importent `/Script/AdvancedGASSystem` : sans le module, ils ne chargent pas. **À prendre** : `NS_DamageNumbers` (chiffres de dégâts Niagara). | 1 h |
| **Survival Crafting Stations** | **A** | Aucun blocage : 256 StaticMesh (établis, fours, générateurs, stations de chimie), **27 SkeletalMesh animés** avec leurs squelettes et **47 animations** (`AS_Lathe_03`…), 31 icônes, 80 sons, 233 textures. Sa couche Blueprint est un placement à la première personne, redondant avec `Props.lua`. **C'est exactement le trou mesuré : nos 4 ateliers sont des `SM_Cube`.** | ~1 j |
| **Survival Crafting System** | **A** | Projet UE **4.21** (2018) : logique en `ActorComponent` répliqué + 28 widgets couplés. On a déjà inventaire et craft. **À prendre** : 65 icônes d'objets, 36 meshes (bandage, trousse, bidon, lampe, bois, casque, sac à dos), **4 vêtements sur `UE4_Mannequin_Skeleton` — notre squelette, attachables directement**, et `DT_CraftingList` lisible en clair (9 recettes avec temps et quantités). | ½ j + 1 h |
| **Ako Minimap System** | **B** | Le seul des cinq dont le SYSTÈME peut tourner : 100 % Blueprint/UMG, **zéro C++, zéro AIController, zéro SceneCapture**. nanos expose `Widget(chemin)` côté client et `Blueprint()` pour ses deux acteurs. Deux inconnues à lever dans l'éditeur : `DA_MinimapSettings_Track` pointe les classes du démo (à repointer sur le `Character` nanos), et le fond de carte se cuit par map via un Editor Utility. | ~1 j, risque moyen |

## Deux corrections à mon cadrage initial

1. **L'UMG EST spawnable dans nanos** (`Widget.json`, autorité client). Ce qui
   bloque Hyper et Survival Crafting System n'est pas l'UMG, c'est le couplage de
   leurs widgets à leurs propres composants.
2. **`AIModule` et les Behavior Trees existent dans le client.** Le blocage n'est
   pas un plugin manquant : c'est l'absence d'autorité serveur Unreal et de pont
   vers les `Character` nanos.

## Ordre recommandé

1. **Survival Crafting Stations** (A) — zéro logique, cook incrémental, et les
   `SM_Cube` de nos 4 ateliers disparaissent. Le gain visible le plus rapide.
2. **Survival Crafting System** (A), puis **Hyper** (A) — les icônes de la grille
   WebUI, les meshes d'objets, les 4 vêtements sur notre squelette, les recettes,
   les sons de montée de niveau.
3. **Ako** (B) seulement si le radar WebUI ne suffit pas. Les deux packs d'IA et
   le GAS ne s'intègrent jamais comme systèmes : on y pioche l'OVNI, le poisson
   et les sons — **et on ne touche pas à AI Behavior System**.