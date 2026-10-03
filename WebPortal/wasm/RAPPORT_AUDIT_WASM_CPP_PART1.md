# AUDIT WASM C++ — Partie 1: Fichiers sources C++

**Projet:** NARVOS PRIME — `wasm/src/`
**Date:** 2026-07-29
**Périmètre:** 45 fichiers (18 .cpp, 27 .h) dans 9 sous-répertoires

---

## Résumé Exécutif

| Sous-système | Fichiers | Complétion | API Exportée | Bugs |
|---|---|---|---|---|
| Core (Types, Math) | 2 | ✅ 100% | — | 0 |
| ECS (Registry, ComponentPool) | 3 | ✅ 100% | 4 fns | 0 |
| Components (Transform, Health, etc.) | 5 | ✅ 100% | — | 0 |
| **AI** (AISystem, EQS) | 4 | ⚠️ 90% | 3 fns | **🔴 1 critique** |
| Navigation (NavMesh, PathManager) | 4 | ✅ 100% | 12 fns | 0 |
| Animation (Skeleton, Animator, AnimGraph) | 5 | ⚠️ 85% | 24 fns | ⚠️ 1 mineur |
| **Streaming** (ChunkStreaming, AssetBudget) | 4 | ✅ 100% | 24 fns | 0 |
| **Physics** (Collision, BVH, Trigger, Vehicle, Raycast) | 10 | ⚠️ 90% | 18 fns | ⚠️ 1 limité |
| Combat (StatusEffects, DamageEvents) | 3 | ✅ 100% | 6 fns | 0 |
| **Bridge** (Bindings, WorldCoordinator, AnimBridge) | 6 | ✅ 100% | 60+ fns | 0 |
| **TOTAL** | **45** | **~95%** | **~150 fns JS** | **1 critique, 1 limité, 1 mineur** |

---

## 1. Core — `wasm/src/core/` (2 fichiers)

### `Types.h`
- **Rôle:** Typedefs standard (`u8`–`f64`, `Entity = u32`).
- **État:** ✅ Complètement implémenté. Sans défaut.
- **API exportée:** Aucune (header-only).

### `Math.h`
- **Rôle:** Inclusions GLM (vec3, quat, mat4) + utility.
- **État:** ✅ Header-only, importe `glm::gtx/norm.hpp` (experimental activé par `GLM_ENABLE_EXPERIMENTAL` dans CMakeLists.txt).
- **Remarque:** GLM est en vendor/ — dépendance externe bien isolée.

---

## 2. ECS — `wasm/src/ecs/` (3 fichiers)

### `ComponentPool.h`
- **Rôle:** Pool de composants sparse-set: tableau parallèle `m_Data[]` / `m_IndexToEntity[]` / `m_EntityToIndex` (index inversé).
- **Complétion:** ✅ 100%. Classe complète avec Add, Get, Has, Remove, Clear.
- **API:** Template — utilisée uniquement depuis Registry. Pas d'exposition directe JS.
- **Dépendances:** `core/Types.h`
- **Remarque:** Remove() utilise la technique swap-with-last (O(1), préserve la compacité). Standard et correct.

### `Registry.h` / `Registry.cpp`
- **Rôle:** Registre ECS central. Création/destruction d'entités, composants typés via `type_index`.
- **Complétion:** ✅ 100%.
- **API C++ publique:**
  - `CreateEntity()` / `DestroyEntity(e)` / `IsValid(e)` / `Clear()`
  - `AddComponent<T>(e, args...)` / `GetComponent<T>(e)` / `RemoveComponent<T>(e)` / `HasComponent<T>(e)`
  - `ForEach<Ts...>(func)` — fold expression avec `(HasComponent<Ts>(e) && ...)`
  - `GetOrCreatePool<T>()` — lazy init des pools
- **Singleton:** `extern Registry g_Registry;`
- **API exportée JS (via Bindings.cpp):** `getEntityCount()`, `isEntityValid(e)`, via `WorldCoordinator`.
- **Générations:** Chaque entité a un compteur de génération. Pair = vivant, impair = mort. Permet la réutilisation des ID avec invalidation.
- **⚠️ Bug potentiel:** `ForEach()` fait une copie de la liste d'entités (`std::vector<Entity> entities = firstPool.Entities()`), ce qui est safe même si on modifie les composants pendant l'itération. 👍

---

## 3. Components — `wasm/src/components/` (5 fichiers)

Tous header-only, 100% complets.

| Fichier | Champs | Notes |
|---|---|---|
| `Transform.h` | position, rotation (Euler), scale, `ToMatrix()`, `Forward()`, `Right()` | Y-up, right-handed |
| `Health.h` | maxHealth/maxShield, current, recharge, isDead | 75 HP / 100 Shield |
| `Weapon.h` | damage, fireRate, ammo, range, lastFireTime | 15 dmg, 60 ammo |
| `AITactical.h` | AIState, AISquadRole, target, coverPos, alertLevel, courage, accuracy | 7 états |
| `PlayerTag.h` | dummy marker | Tag vide |

---

## 4. AI — `wasm/src/ai/` (4 fichiers)

### `EQS.h` / `EQS.cpp` — ✅ Ok
- **Rôle:** Environment Query System. Échantillonne une grille 2D autour du querier, applique des scorers, retourne les positions triées par score. + TraceTest (line-of-sight).
- **Complétion:** ✅ 100%.
- **Dépendances:** `physics/CollisionSystem.h` (pour TraceTest → `SegmentBlocked`)
- **API exportée JS:** Indirecte via AISystem.

### `AISystem.h` / `AISystem.cpp`

#### Rôle
Système AI: parcourt tous les `AITactical` chaque tick, fait la machine à états (Idle → Combat → Flank → Retreat), émet des `AICommand` bufferisées lues depuis JS.

#### Complétion
⚠️ **~90%.** Manque `UpdateSuppress()` et `UpdateRetreat()` dans la switch (tombent dans `default: break`). `CanSeeTarget()` est stub basique (pas de cône de vision, juste line-of-sight avec `EQS::TraceTest`).

#### 🔴 BUG CRITIQUE — Shadowing de `PlayerTag`

**Fichier:** `AISystem.cpp`, ligne 13.
```cpp
namespace nv
{
    // PlayerTag — lightweight marker for the player entity
    struct PlayerTag { u8 dummy = 0; };
```
`AISystem.cpp` **définit son propre `nv::PlayerTag`** au lieu d'inclure `components/PlayerTag.h`.

**Conséquence:** Deux types différents nommés `nv::PlayerTag` existent dans deux TU différentes :
1. `components/PlayerTag.h` → utilisé par `WorldCoordinator::CreatePlayerEntity()` (inclut le header)
2. `AISystem.cpp` (définition locale) → utilisé par `AISystem::ChooseTarget()` (cherche `g_Registry.GetOrCreatePool<PlayerTag>()`)

`typeid(nv::PlayerTag)` diffère entre les deux → **deux pools séparés dans le Registry**. Le joueur créé par `CreatePlayerEntity` a `nv::PlayerTag` du header, mais l'AI cherche dans le pool de son `nv::PlayerTag` local vide.

**Résultat: `ChooseTarget()` ne trouve jamais le joueur → les PNJs restent en `Idle` sans jamais passer en `Combat`.**

**Fix:** Supprimer la définition locale ligne 13 et ajouter `#include "components/PlayerTag.h"` en haut du fichier.

#### API exportée JS
- `createNPC(x, y, z, role, health)` → via WorldCoordinator
- `tickWorld(dt)` → déclenche `AISystem::Update(dt)` dans le pipeline

---

## 5. Navigation — `wasm/src/navigation/` (4 fichiers)

### `NavMesh.h` / `NavMesh.cpp` — ✅ Excellent
- **Rôle:** NavMesh basé grille 2D (XZ). A* 8-connexe avec string-pulling simplifié.
- **Complétion:** ✅ 100%.
- **Points forts:**
  - Init/Clear/SetCell/BakeFromHeightmap
  - A* avec max 50k iterations (garde-fou), 8 directions, pente max, anti-diagonal-fail (bloque les diagonales si les deux orthogonaux adjacents ne sont pas walkable)
  - SmoothPath: élimine les waypoints colinéaires (string-pulling simplifié)
  - `SnapToNavMesh()` avec recherche en spirale sur la grille (fallback si la position est hors navmesh)
- **Dépendances:** `core/Types.h`, `core/Math.h`
- **Singleton:** `extern NavMesh g_NavMesh;`
- **API exportée JS:** `navInit`, `navSetCell`, `navBakeFromHeightmap`, `navIsWalkable`, `navSnapToNavMesh`, `navClear`, `navWidth`, `navDepth`, `navCellSize`

### `PathManager.h` / `PathManager.cpp` — ✅ Excellent
- **Rôle:** Gère une map `Entity → NavPath`. `RequestPath()`, `Update()` (avance les waypoints), `WriteWaypoints()` (buffer JS).
- **Complétion:** ✅ 100%.
- **Singleton:** `extern PathManager g_PathManager;`
- **API exportée JS:** `navRequestPath`, `navCancelPath`, `navClearAllPaths`, `navHasPath`, `navIsPathComplete`, `navGetNextWaypoint`, `navActivePathCount`, `navReadWaypoints`

---

## 6. Animation — `wasm/src/animation/` (5 fichiers)

### `Skeleton.h` / `Skeleton.cpp`
- **Rôle:** `JointPose`, `Bone`, `Skeleton` (arborescence), `AnimationClip` avec channels (pos/rot/scale keys).
- **Complétion:** ✅ 100%.
- `AnimationClip::Sample()`: Lerp/SLERP entre keys temporelles. Code robuste avec edge cases (keys vides, out-of-range).

### `Animator.h`
- **Rôle:** Conteneur de `AnimationClip` + `BlendPoses()` (mix + slerp).
- **Complétion:** ✅ 100%.
- **Remarque:** Simple — un vector de clips, pas de state machine interne.

### `AnimationGraph.h` / `AnimationGraph.cpp`
- **Rôle:** Graphe d'animation modulaire: Clip, Blend1D, StateMachine, IKPose, AimOffset nodes.
- **Complétion:** ⚠️ **~85%.**
  - **Clip:** ✅ Implémenté
  - **Blend1D:** ✅ Implémenté (blend entre deux clips, tri par seuil)
  - **StateMachine:** ⚠️ **Stub.** `AddStateMachine()` ignore `states` et `entry`. L'évaluation délègue au root node. Les transitions sont drives depuis JS via `SetParam("state", ...)`.
  - **IKTwoBone:** ⚠️ **Partiel.** Calcule l'angle `midAngle` par loi des cosinus mais ne modifie pas les rotations (TODO au milieu du code). Le stub est présent mais le solver est incomplet.
  - **AimOffset:** Type déclaré dans l'enum mais aucun code d'évaluation.
- **API exportée JS:** 24 fonctions d'animation (création skeleton, bones, clips, channels, graph, blend1D, paramètres, écriture bone matrices).

---

## 7. Streaming — `wasm/src/streaming/` (4 fichiers)

### `ChunkStreamingManager.h` / `.cpp`
- **Rôle:** Streaming de chunks basé sur la distance du joueur. Budget mémoire, chargement/déchargement.
- **Complétion:** ✅ 100%.
- **Points forts:**
  - `Tick()`: calcule la distance à la **sphère** du chunk (pas au centre) — évite les faux négatifs sur les gros chunks de forge (radius 200-1600m)
  - Deux phases: décharge les lointains → charge les proches
  - `DrainCommands()`: buffer binaire pour JS
  - `UpdateChunkRadius()`: corrige le radius initial (qui inclut les coques enveloppantes) avec la vraie bounding sphere
  - `CacheFingerprint()`: hash simple pour détecter les changements de chunks
- **Singleton:** `extern ChunkStreamingManager g_ChunkStreaming;`
- **API exportée JS:** 12 fonctions.

### `AssetBudgetManager.h` / `.cpp`
- **Rôle:** Budget mémoire global avec 7 catégories (Chunk, Player, Npc, Weapon, Vehicle, Animation, Ui). 3 QualityTiers. Éviction, downgrade, preload, upgrade.
- **Complétion:** ✅ 100%. Très complet.
- **Points forts:**
  - 4 phases par tick: Éviction → Downgrade → Preload → Upgrade
  - `RecommendedTier()` basé sur distance + budget restant
  - Priorités statiques par catégorie
  - `CacheFingerprint()` similaire au ChunkStreaming
- **API exportée JS:** 12 fonctions.

---

## 8. Physics — `wasm/src/physics/` (10 fichiers)

### `Raycast.h` / `Raycast.cpp`
- **Rôle:** Structures `Ray`, `RaycastHit`, `AABB`. Fonctions `IntersectRay()` (Slabs method) et `Contains()`.
- **Complétion:** ✅ 100%.

### `BVH.h` / `BVH.cpp`
- **Rôle:** Bounding Volume Hierarchy. Construction top-down median-split. Traversée itérative (pile).
- **Complétion:** ✅ 100%.
- **[TREES-4]** Structure BVH, construction, QueryAABB (single + all), RayCast, SegmentCast, SegmentBlocked.
- **Qualité:** Très bon. Pile de taille fixe (64), pas de récursion (bon pour WASM).

### `CollisionSystem.h` / `CollisionSystem.cpp`
- **Rôle:** Point d'entrée central. Colliders statiques (batch → BVH) + dynamiques (fallback linéaire).
- **Complétion:** ✅ 95%.
- **Fonctions:** RegisterStatic, RegisterDynamic, UpdateDynamic, RemoveDynamic, BuildBVH, CheckCollision, Resolve, RaycastDown, SegmentBlocked, SegmentCastDistance.
- **Détail:** `RegisterStatic()` applique scale + position. Fallback linéaire si BVH pas encore construit.
- **Singleton:** `extern CollisionSystem g_CollisionSystem;`

### `TriggerSystem.h` / `TriggerSystem.cpp`
- **Rôle:** Zones trigger typeées (Generic, Damage, Heal, Teleport, Quest). Détection enter/exit par tick.
- **Complétion:** ✅ 100%.
- **Points forts:**
  - Ring buffer d'events (128 max) drainable vers JS
  - Émission automatique d'exit sur RemoveZone / SetZoneActive(false)
  - ID zone séparé (80000+) du namespace entité
- **⚠️ Performance:** `Tick()` appelle `g_Registry.ForEach<Transform>(check)` pour **chaque zone active**. Si N zones × M entités = O(N×M) — coûteux sur de grandes maps.

### `Vehicle.h` / `Vehicle.cpp`
- **Rôle:** Système de véhicule à 4 roues avec suspension, moteur, frein, dérive.
- **Complétion:** ⚠️ **85%.**
- **⚠️ Limitation suspension:** `UpdateSuspension()` ne fait pas de raycast contre le CollisionSystem. Elle utilise un plan solide à y=0 (formule simplifiée `t = (0.0f - wheelWorldPos.y) / rayDir.y`). **Le véhicule ne peut rouler que sur terrain plat à y=0.**
- **Qualité:** Le reste (ApplyInput, GetPointVelocity, UpdateWheel, Update) est correct — dynamique rigide avec inertie matricielle, freinage, drift limité.
- **API exportée JS:** `initVehicle()`, `updateVehicle(dt, throttle, brake, steer, handbrake)`, `GetVehicleTransform(float* out)` — **véhicule singleton** (un seul véhicule à la fois).

---

## 9. Combat — `wasm/src/combat/` (3 fichiers)

### `DamageEvents.h` — ✅ 100%
- **Rôle:** Ring buffer d'events de dégâts (pos, amount, kind). Drainable vers JS.
- **API:** `Emit()`, `Drain()`, `WritePending()` (buffer plat: 5 floats par event)

### `StatusEffects.h` / `StatusEffects.cpp` — ✅ 100%
- **Rôle:** Root, Stun, Burn, Invisibility (player only). Tick dégrade les durées, Brûlure tick damage.
- **API exportée JS:** `applyBurn`, `applyRoot`, `applyStun`, `isRooted`, `isStunned`
- **Singletons:** `g_StatusEffects`, `g_DamageEvents`

---

## 10. Bridge — `wasm/src/bridge/` (6 fichiers)

### `WorldCoordinator.h` / `WorldCoordinator.cpp`
- **Rôle:** Orchestrateur du tick world. Pipeline déterministe:
  1. AI decisions
  2. PathManager (advance waypoints)
  3. TriggerSystem (enter/exit zones)
  4. StatusEffects (tick brûlure, durées)
  5. TickHealthSystem (recharge shield, death detection)
  6. TickDeathCleanup (destroy entities dead > 5s)
- **Complétion:** ✅ 100%.
- **Singleton:** `extern WorldCoordinator g_WorldCoordinator;`
- **API:** Tick, Pause, Resume, TimeScale, Stats

### `AnimationBridge.h` / `AnimationBridge.cpp`
- **Rôle:** Gère des instances Skeleton / Animator / AnimGraph indexées par ID entier (pas de shared_ptr traversant la frontière JS).
- **Complétion:** ✅ 100%.
- **Fonctions:** CreateSkeleton, AddBone, FinalizeSkeleton, CreateClip, AddClipChannel, CreateAnimGraph, AddClipNode, Blend1D (accumulation puis finalize), SetParam, Update, WriteBones.

### `Bindings.cpp`
- **Rôle:** Tous les `EMSCRIPTEN_BINDINGS(narvos_engine)`. Centrale d'exposition JS.
- **Complétion:** ✅ 100%.
- **API exposée:** ~60 fonctions JS couvrant tous les sous-systèmes.
- **Pattern:** Fonctions C++ libres + lambdas dans le `EMSCRIPTEN_BINDINGS` block.

---

## Bugs et Problèmes Détectés

### 🔴 Critique: `AISystem.cpp` — Shadowing de `PlayerTag`
- **Fichier:** `ai/AISystem.cpp` ligne 13
- **Description:** Définition locale de `struct PlayerTag` au lieu d'inclure `components/PlayerTag.h`
- **Impact:** L'AI ne trouve jamais le joueur → les PNJs ne passent jamais en mode Combat
- **Fix:** Supprimer la définition ligne 13, ajouter `#include "components/PlayerTag.h"` en haut du fichier

### ⚠️ Limitation: `VehicleSystem::UpdateSuspension` — Sol plat forcé
- **Fichier:** `physics/Vehicle.cpp` ligne 50
- **Description:** `t = (0.0f - wheelWorldPos.y) / rayDir.y` — hardcodé à y=0
- **Impact:** Le véhicule ne fonctionne que sur terrain plat
- **Fix:** Utiliser `g_CollisionSystem.RaycastDown()` à la place

### ⚠️ Mineur: `AnimationGraph::AddStateMachine` — Stub
- **Fichier:** `animation/AnimationGraph.cpp` ligne 104
- **Description:** `NV_UNUSED(states)` et `NV_UNUSED(entry)` — ignore les paramètres
- **Impact:** Les StateMachines C++ ne marchent pas; la logique est repoussée côté JS
- **Fix:** Implémenter la machine à états ou retirer proprement

### ⚠️ Performance: `TriggerSystem::Tick()` — O(N×M) par tick
- **Fichier:** `physics/TriggerSystem.cpp` ligne 84-113
- **Description:** Pour chaque zone active, `ForEach<Transform>` itère toutes les entités
- **Impact:** Potentiel ralentissement sur les grandes maps avec 100+ zones
- **Fix:** Ajouter un BVH pour les zones trigger, ou un grid spatial

### ⚠️ Absence: Pas de fichier `Archetype` ou `BehaviorTree`
- **Archetype:** L'utilisateur mentionne `Archetype` dans la demande — inexistant dans le code. L'ECS est basé sur `ComponentPool` (sparse-set), pas d'Archétypes.
- **BehaviorTree:** L'utilisateur mentionne `BehaviorTree` — inexistant. Le système AI est une FSM (switch states), pas un BT.
- **AITactical.cpp / AITactical.h dans components/:** Seul `.h` existe (`components/AITactical.h`), pas de `.cpp`.

---

## Synthèse du Build System

- **Outil:** CMake 3.20+, C++20
- **Compilateur:** Emscripten (`em++`)
- **Flags importants:** `-msimd128` (SIMD 128-bit pour math/physique), `-O2`
- **Options WASM:** `WASM=1`, `ALLOW_MEMORY_GROWTH=1`, `MALLOC=mimalloc`, `--bind` (embind)
- **Output:** `dist/narvos-engine.js` + `.wasm`, `MODULARIZE=1`, `EXPORT_NAME=NarvosEngine`
- **Dépendances:** GLM (vendor/, header-only)
- **Threads:** Optionnel (`NARVOS_PTHREADS`, OFF par défaut)
- **Tous les fichiers sources sont listés dans le CMakeLists.txt** ✅

---

## Conclusion

La base C++ est **solide et majoritairement complète (~95%)**. Le code est bien structuré, en namespace `nv`, avec des singletons globaux propres et une API JS exhaustive via embind.

**Le bug critique du `PlayerTag` shadowing doit être corrigé impérativement avant tout test fonctionnel de l'AI** — sans cette correction, tout le système AI (y compris les démos de combat) est inopérant.

Les limitations restantes (Vehicle à sol plat, StateMachine stub) sont documentées et n'impactent pas le fonctionnement des autres sous-systèmes.
