# AUDIT WASM BINDINGS — Pont C++→TypeScript

**Projet :** Narvos Prime — WebPortal
**Date :** 2026-07-29
**Analyse :** `wasm/src/bridge/Bindings.cpp` ↔ `src/rpg/wasm/*.ts`

---

## Résumé

| Métrique | Valeur |
|---|---|
| Fonctions bindées dans `EMSCRIPTEN_BINDINGS` | **117** |
| Méthodes dans l'interface `NarvosWasmModule` (WasmBridge.ts) | **117** |
| Fonctions bindées **avec** un appelant TS effectif | **109** |
| Fonctions bindées **sans** aucun appelant TS | **8** (⚠️ ORPHELINES) |
| Fonctions C++ définies mais **jamais bindées** | **1** (🔴 INACCESSIBLE) |
| Fonctions TS appelées sans binding correspondant | **0** ✅ |
| Incohérences de types critiques (float/double) | **0** ✅ |
| Incohérences mineures | **1** (ℹ️ getWorldTime retourne `double` en C++) |

---

## PARTIE 1 — Interface NarvosWasmModule ↔ Bindings : COUVERTURE COMPLÈTE ✅

Toutes les **117 méthodes** déclarées dans `NarvosWasmModule` (WasmBridge.ts lignes 24–203) ont un `function()` correspondant dans `EMSCRIPTEN_BINDINGS(narvos_engine)` (Bindings.cpp lignes 131–429). La correspondance est **bijective au niveau des déclarations**.

---

## PARTIE 2 — Fonctions bindées SANS appelant TS (⚠️ ORPHELINES)

Ces 8 fonctions sont déclarées dans `EMSCRIPTEN_BINDINGS` et dans l'interface TS, mais **aucun fichier source ne les invoque** :

| # | Nom bindé | Bindings.cpp | NarvosWasmModule (ligne) | Utilisation réelle |
|---|---|---|---|---|
| 1 | `initCollisionSystem` | L.173 | L.48 | ❌ Zéro appelant dans `src/` |
| 2 | `getEntityCount` | L.171 | L.45 | ❌ Zéro appelant dans `src/` |
| 3 | `getColliderCount` | L.180 | L.61 | ❌ Zéro appelant dans `src/` |
| 4 | `initVehicle` | L.182 | L.94 | ❌ Zéro appelant dans `src/` |
| 5 | `updateVehicle` | L.183 | L.95 | ❌ Zéro appelant dans `src/` |
| 6 | `emitDamage` | L.191 | L.105 | ❌ Zéro appelant dans `src/` |
| 7 | `animGetBoneCount` | L.207 | L.113 | ❌ Zéro appelant dans `src/` |
| 8 | `streamingSetRadii` | L.270 | L.148 | ❌ Zéro appelant dans `src/` |

**Impact immédiat :**
- Le système véhicule (`initVehicle`, `updateVehicle`) est **complètement inutilisable** côté JS — les bindings existent mais personne ne les appelle. Soit le véhicule n'est pas encore intégré (code mort en attente), soit il manque le code TS.
- `emitDamage` ne peut être déclenché depuis le JS — seuls les dégâts générés côté C++ (burn DoT, combat IA) seront visibles. Les sorts/armes JS ne peuvent pas infliger de dégâts via WASM.
- `initCollisionSystem` n'est jamais appelé — le système C++ pourrait ne jamais être initialisé (vérifier si g_CollisionSystem.Init() est safe sans appel). **Risque potentiel** si un autre système C++ dépend de cette initialisation.
- `getEntityCount` / `getColliderCount` sont des utilitaires debug inutilisés.
- `animGetBoneCount` doublonne avec `animGraphBoneCount` qui est utilisé.
- `streamingSetRadii` n'est jamais appelé depuis TS (les radii sont figés aux valeurs de init).

---

## PARTIE 3 — Fonction C++ définie mais NON BINDÉE (🔴 INACCESSIBLE)

| Fonction | Bindings.cpp | Statut |
|---|---|---|
| `GetVehicleTransform(float* out)` | L.114-119 | ❌ **Aucun `function()` dans EMSCRIPTEN_BINDINGS** |

Cette fonction lit la matrice de transformation du véhicule et l'écrit dans un buffer float[16]. Sans binding, le JS ne peut pas récupérer la position/rotation du véhicule après que le C++ l'a mise à jour. Combiné avec `initVehicle` et `updateVehicle` qui existent mais ne sont pas appelés, le système véhicule est **totalement inaccessible** depuis JS.

---

## PARTIE 4 — Fonctions TS effectives avec correspondance C++ ✅

Chaque fonction TS qui appelle une méthode WASM a bien son équivalent bindé :

| Module TS | Fonctions TS → WASM | Binding présent |
|---|---|---|
| `WasmWorldCoordinator.ts` | tickWorld, resetWorld, initWorld, pauseWorld, resumeWorld, isWorldPaused, setTimeScale, getTimeScale, getWorldTime, getTickCount, getWorldStats, destroyEntity | ✅ Toutes |
| `WasmNpcBridge.ts` | createNPC, createPlayer, setEntityPosition, setEntityRotation, isEntityValid | ✅ Toutes |
| `PhysicsSync.ts` | registerCollider, clearColliders, raycastDown, isSegmentBlocked, segmentCastDistance, registerColliderBatch | ✅ Toutes |
| `StatusEffectSync.ts` | applyBurn, applyRoot, applyStun, isRooted, isStunned | ✅ Toutes |
| `DamageEventSync.ts` | pendingDamageCount, drainDamageEvents | ✅ Toutes |
| `AnimationBridge.ts` | animCreateSkeleton, animAddBone, animFinalizeSkeleton, animCreateClip, animAddClipChannel, animCreateGraph, animGraphAddClipNode, animGraphAddBlend1DEntry, animGraphFinalizeBlend1D, animGraphSetParamFloat, animGraphSetParamBool, animGraphSetRoot, animGraphUpdate, animGraphBoneCount, animGraphWriteBones, animDestroyGraph, animDestroySkeleton, animClearAll | ✅ Toutes |
| `ChunkStreamingBridge.ts` | streamingInit, streamingRegisterChunk, streamingMarkLoaded, streamingMarkUnloaded, streamingTick, streamingDrainCommands, streamingPendingCount, streamingBudgetUsedMB, streamingLoadedCount, streamingChunkCount, streamingClear, streamingCacheFingerprint, streamingUpdateChunkRadius | ✅ Toutes |
| `AssetBudgetBridge.ts` | budgetInit, budgetSetCategoryBudget, budgetRegisterAsset, budgetSetAssetPosition, budgetMarkLoaded, budgetMarkUnloaded, budgetTick, budgetDrainCommands, budgetPendingCount, budgetTotalUsedMB, budgetTotalBudgetMB, budgetCategoryUsedMB, budgetLoadedCount, budgetAssetCount, budgetRecommendedTier, budgetClear, budgetCacheFingerprint | ✅ Toutes |
| `NavMeshBridge.ts` | navInit, navSetCell, navBakeFromHeightmap, navIsWalkable, navSnapToNavMesh, navClear, navWidth, navDepth, navCellSize, navRequestPath, navCancelPath, navClearAllPaths, navHasPath, navIsPathComplete, navGetNextWaypoint, navActivePathCount, navReadWaypoints | ✅ Toutes |
| `TriggerBridge.ts` | triggerRegisterZone, triggerRemoveZone, triggerSetActive, triggerDrainEvents, triggerPendingCount, triggerZoneCount, triggerClear, buildBVH, bvhNodeCount, isBVHBuilt, dynamicColliderCount, registerDynamicCollider, updateDynamicCollider, removeDynamicCollider | ✅ Toutes |
| `useWasmWorld.ts` | tickWorld (via engine.tickWorld) | ✅ |
| `WasmWorldTicker.tsx` | coordonne tous les appels ci-dessus, tickAssetBudget, drainAssetCommands | ✅ |

---

## PARTIE 5 — Analyse des types (cohérence C++ ↔ TS)

### Signature matching

| Domaine | Type C++ | Type TS | Cohérence |
|---|---|---|---|
| Coordonnées/couleurs | `f32`/`float` | `number` | ✅ OK (Emscripten convertit f64↔f32) |
| Entiers (Entity, indices) | `u32`/`uint32_t` / `int` | `number` | ✅ OK (JS number ≥ safe integer) |
| Booléens | `bool` | `boolean` | ✅ |
| Chaînes | `std::string` | `string` | ✅ |
| Pointeurs vers buffers | `uintptr_t` | `number` (adresse WASM) | ✅ |
| Énumérations (category) | `AssetCategory`, `DamageKind` | `number` (enum TS) | ✅ |
| Retours `glm::vec3` | `emscripten::val::array()` | `[number, number, number]` | ✅ |
| Retours stats | `emscripten::val::object()` | `WasmWorldStats` interface | ✅ |

### Anomalie mineure

- **`getWorldTime`** (Bindings.cpp ligne 146) : C++ retourne **`double`** (`g_WorldCoordinator.GetWorldTime()`), alors que les autres getters (getTimeScale, getTickCount, etc.) retournent `float`/`int`. Le TS utilise `number` dans les deux cas, donc l'appelant ne voit pas la différence, mais c'est une **incohérence C++** — les consommateurs JS n'auront pas de perte de précision, mais la norme du code est `float`.

---

## PARTIE 6 — Fichiers TS analysés

| Fichier | Rôle | Écarts trouvés |
|---|---|---|
| `WasmBridge.ts` | Interface + loader | 8 méthodes orphelines |
| `WasmWorldCoordinator.ts` | Coordinator wrapper | ✅ aucun |
| `WasmNpcBridge.ts` | Bridge PNJ | ✅ aucun |
| `PhysicsSync.ts` | Bridge collisions | ✅ aucun |
| `AnimationBridge.ts` | Bridge animation squelettique | ✅ aucun |
| `DamageEventSync.ts` | Drain events dégâts | ✅ aucun |
| `StatusEffectSync.ts` | Sync effets de statut | ✅ aucun |
| `AICommandSync.ts` | Sync commandes IA | ✅ aucun (note : WriteCommands pas bindé — voir ci-dessous) |
| `ChunkStreamingBridge.ts` | Bridge streaming chunks | ✅ aucun |
| `AssetBudgetBridge.ts` | Bridge budget VRAM | ✅ aucun |
| `NavMeshBridge.ts` | Bridge navmesh + pathfinding | ✅ aucun |
| `NavMeshBaker.ts` | Bake navmesh depuis scène Three.js | ✅ aucun |
| `TriggerBridge.ts` | Bridge zones trigger + BVH | ✅ aucun |
| `WasmWorldTicker.tsx` | Tick principal R3F | ✅ aucun |
| `useWasmWorld.ts` | Hook tick + animation WASM | ✅ aucun |
| `useWasmNpcAI.ts` | Hook NPC IA WASM | ✅ aucun |
| `playerPositionStore.ts` | Store position joueur | ✅ aucun |
| `index.ts` | Barrel exports | ✅ aucun |

---

## PARTIE 7 — Notes complémentaires

### AICommandSync — WriteCommands non bindé (référence)

Dans `AICommandSync.ts` lignes 52-53, un commentaire indique :
> *"WriteCommands n'est pas encore bind (sera ajouté phase 3)"*

Actuellement, `readAICommands()` lit les commandes depuis le buffer JS alloué manuellement (`initAIBuffers` → `_malloc`), et pas depuis une fonction WASM `drainAICommands()`. **Aucun binding C++ n'expose `AISystem::WriteCommands`**. Ce n'est pas un écart bloquant (le commentaire le documente), mais à tracker pour la roadmap.

### Véhicule — système complet en attente

Le système véhicule (`initVehicle`, `updateVehicle`) est bindé dans le C++ mais :
1. Aucun TS ne l'appelle
2. `GetVehicleTransform` n'est même pas bindé
3. Le seul buffer véhicule est le static `s_Vehicle` partagé → pas d'instance multiple possible

Le véhicule est soit une feature non encore intégrée, soit du code legacy à nettoyer.

### Recommandations

| Priorité | Action |
|---|---|
| 🔴 Haute | Décider du sort du **système véhicule** : l'intégrer (ajouter les appels TS + binder GetVehicleTransform) ou supprimer les bindings morts |
| 🟡 Moyenne | Supprimer ou appeler `initCollisionSystem` depuis le TS (initialisation manquante potentiellement dangereuse) |
| 🟡 Moyenne | Ajouter un binding `drainAICommands` dans `EMSCRIPTEN_BINDINGS` (phase 3, déjà documenté) |
| 🟢 Basse | Nettoyer les 8 fonctions orphelines si elles ne seront pas utilisées |
| 🟢 Basse | Uniformiser `getWorldTime` en `float` si la perte de précision est acceptable |