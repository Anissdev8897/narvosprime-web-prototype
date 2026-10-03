# Audit WASM C++ — Partie 6: Streaming & Physics

**Date:** 2026-07-29
**Équipe:** WASM Streaming+Physics
**Périmètre:** ChunkStreamingManager, AssetBudgetManager, CollisionSystem, BVH, TriggerSystem, Raycast vs JS CollisionWorld.ts

---

## Résumé Exécutif

| Système | État | Risque |
|---------|------|--------|
| ChunkStreamingManager (WASM) | ✅ Fonctionnel — distance + budget | Faible |
| AssetBudgetManager (WASM) | ✅ Fonctionnel — multi-catégorie, tiers de qualité | Faible |
| StreamingScheduler (WASM) | ❌ **N'existe pas** — pas de fichier dans wasm/src/ | Moyen |
| CollisionSystem (WASM) | ✅ BVH complet, dual statique/dynamique | Faible |
| BVH (WASM) | ✅ Median-split, traversée itérative, AABB uniquement | Faible |
| TriggerSystem (WASM) | ✅ Zones enter/exit avec ring buffer | Faible |
| Raycast (WASM) | ✅ AABB ray + segment + segmentBlocked | Faible |
| CollisionWorld.ts (JS) | ⚠️ Hybride WASM+Three.js, requêtes spécifiques | Moyen |
| PhysicsSystem.ts (legacy) | 📦 Archivé — tactique ISO, sans collision | Aucun |

**Problème central :** Les deux systèmes de collision (WASM BVH + Three.js BVH) sont actifs simultanément. Le partage des responsabilités est explicite dans le code mais crée une duplication des AABB et deux appels `setFromObject` lors du `registerScene`. Pas de conflit fonctionnel mais un surcoût mémoire et init.

---

## 1. ChunkStreamingManager (WASM)

**Fichiers :** `wasm/src/streaming/ChunkStreamingManager.h/.cpp`

### Architecture
- Classe singleton globale `g_ChunkStreaming`
- Gère un `std::vector<ChunkMeta>` — chaque chunk a : id, centre (x,y,z), radius, estimatedMB, loaded flag
- Budget mémoire : `m_BudgetMB` (défaut 512 MB), `m_MaxLoaded` (défaut 6)
- Rayons : `m_LoadRadius` = 200, `m_UnloadRadius` = 300

### Tick() — Logique de streaming
1. **Distance à la sphère, pas au centre :** `dist = max(0, distanceCentre - chunk.radius)` — évite qu'un chunk étendu (radius 1600) ne soit pas chargé quand le joueur est dedans
2. **Phase 1 — Unload :** Parcourt du plus loin au plus proche, décharge si `dist > unloadRadius`
3. **Phase 2 — Load :** Parcourt du plus proche au plus loin, charge si `dist <= loadRadius`, respecte `m_MaxLoaded` et `m_BudgetMB`

### Points forts
- ✅ Correction de la distance à la sphère (commentaire détaillé)
- ✅ Budget mémoire respecté (`m_UsedMB += estimatedMB`)
- ✅ `UpdateChunkRadius(id, newRadius)` — corrige les métadonnées initiales gonflées (coques enveloppantes → 30k+ unités) avec la vraie sphère après chargement
- ✅ `CacheFingerprint()` — détecte les changements de configuration (re-génération)

### Points faibles
- ⚠️ `m_UnloadRadius = 300` de base — très serré si `LoadRadius = 200`. La zone morte (200-300) n'est que de 100 unités. Si le joueur tourne en bordure, oscillation load/unload possible
- ⚠️ Pas d'ordonnancement inter-chunk (priorité). StreamingScheduler **n'existe pas** dans le WASM — décision de conception : c'est le JS qui gère l'ordonnancement avec les commandes vidées par `DrainCommands`
- ⚠️ `estimatedMB` est fixe par chunk (16 MB défaut) — ne reflète pas la variation réelle de taille des chunks

### Budget Mémoire
```
Budget par défaut : 512 MB
Max chunks chargés : 6 (mais contrainte budget prioritaire)
EstimatedMB/chunk : 16 MB (modifiable via RegisterChunk)
=> Au max budget : 512/16 = 32 chunks (mais plafond à 6 maxLoaded)
=> Au maxLoaded (6) : 6 × 16 = 96 MB
```

---

## 2. AssetBudgetManager (WASM)

**Fichiers :** `wasm/src/streaming/AssetBudgetManager.h/.cpp`

### Architecture
- Singleton `g_AssetBudget`
- Gère TOUS les types d'assets (7 catégories) : Chunk, Player, NPC, Weapon, Vehicle, Animation, UI
- 3 QualityTiers : Low (0), Medium (1), High (2)
- Budget total : 2048 MB par défaut

### Tick() — 4 phases
1. **Éviction** : décharge les assets spatiaux non essentiels trop loin
2. **Downgrade** : si budget > 90%, downgrade les assets lointains (High→Med→Low)
3. **Preload** : charge les assets proches/essentiels avec la qualité recommandée
4. **Upgrade** : upgrade les assets proches si budget < 95%

### Qualité adaptative
```cpp
// Distances :
dist < 30   → High
dist < 100  → Medium
else        → Low

// Budget restant (non spatiaux) :
remaining < 15% du total → Low
remaining < 30% du total → Medium
else                      → High
```

### Points forts
- ✅ Priorités statiques : Player(0) > Weapon(1) > Vehicle(2) > Chunk(3) > NPC(4) > Animation(5) > UI(6)
- ✅ Downgrade/Upgrade progressifs
- ✅ `CacheFingerprint()` distinct du chunk manager
- ✅ **Doublon évité** avec `Find(id)` avant registration

### Points faibles
- ⚠️ Projection optimiste du budget en phase Downgrade : `m_UsedMB -= savings` avant confirmation JS. Si JS rejette la commande, le compteur est désynchronisé
- ⚠️ ChunkStreamingManager et AssetBudgetManager gèrent TOUS DEUX des chunks — le premier a son propre budget (512 MB), le second aussi (2048 MB). Qui décide vraiment ? Les deux systèmes Tick() sont appelés séparément depuis JS

---

## 3. StreamingScheduler (WASM)

**❌ N'EXISTE PAS**

Aucun fichier `StreamingScheduler.cpp` ou `.h` dans `wasm/src/`. Le seul fichier trouvé avec "scheduler" dans le nom est absent de tout le projet WASM.

**Conclusion :** L'ordonnancement des chargements a été implémenté de façon simplifiée directement dans `ChunkStreamingManager::Tick()` (tri par distance, pas de file de priorité). L'AssetBudgetManager ajoute un deuxième niveau d'ordonnancement par priorité de catégorie. L'architecture suppose que JS vide régulièrement les commandes via `DrainCommands` et les exécute — c'est JS qui fait office de scheduler.

---

## 4. CollisionSystem (WASM)

**Fichiers :** `wasm/src/physics/CollisionSystem.h/.cpp`

### Architecture
- Singleton `g_CollisionSystem`
- Dual registre : **Statiques** (via BVH) + **Dynamiques** (fallback linéaire O(n))
- `RegisterStatic()` → stocke dans `m_StaticColliders[]` puis `BuildBVH()` construit le BVH
- `RegisterDynamic()` → stocke dans `m_DynamicColliders[]` — pas de BVH, balayage linéaire

### Queries disponibles
| Méthode | Statiques | Dynamiques | Algo |
|---------|-----------|------------|------|
| `CheckCollision(AABB)` | BVH O(log n) | Linéaire O(n) | BVH + fallback |
| `SegmentBlocked(from, to)` | BVH O(log n) | Linéaire O(n) | Ray-AABB |
| `SegmentCastDistance(from, to)` | BVH O(log n) | Linéaire O(n) | Ray-AABB |
| `RaycastDown(start)` | BVH O(log n) | Linéaire O(n) | AABB ray |
| `Resolve(a, b)` | — | — | Pénétration axis |

### Points forts
- ✅ BVH avec fallback linéaire si pas construit (graceful degradation)
- ✅ `ignore` entity dans les segment queries (pour éviter self-collision)
- ✅ `Contains(from)` skip pour les entités déjà dans la bounding box
- ✅ Construction BVH séparée (`BuildBVH()`) — appelée une fois après batch registration, pas chaque frame

### Points faibles
- ⚠️ DynamicColliders en O(n) — acceptable pour quelques entités, problème avec 50+ NPCs
- ⚠️ `Resolve()` ne gère que l'axe de moindre pénétration — pas de réponse de collision physique réaliste (pas de friction, restitution)
- ⚠️ Pas de swept collision pour les dynamiques (tunneling possible à haute vitesse)

---

## 5. BVH (WASM)

**Fichiers :** `wasm/src/physics/BVH.h/.cpp`

### Structure
- Arbre binaire : `BVHNode { AABB bounds, left, right, leafIndex }`
- Nœuds internes : `leafIndex = -1`, `left/right >= 0`
- Feuilles : `leafIndex >= 0` → index dans `m_LeafBoxes[]` / `m_LeafEntities[]`

### Construction (top-down median-split)
1. Calcule les bounds de tout le set
2. Split sur l'axe le plus long (median split par centre)
3. Itératif via pile statique de 64 entrées (pas de récursion — critique WASM)
4. Taille max implicite : pile de 64 → profondeur max 64 → 2^64 feuilles (jamais atteint en pratique)

### Traversée (itérative par pile)
- `QueryAABB` : premier hit
- `QueryAABBAll` : tous les hits (boundé par maxResults)
- `RayCast` : nearest hit avec early-out sur `tNode > nearest`
- `SegmentCast/SegmentBlocked` : ignore self, skip si `Contains(from)`

### Points forts
- ✅ Pile statique de 64 (pas d'allocation dynamique pendant la traversée)
- ✅ Early-out dans RayCast : skip les nœuds plus loin que le hit le plus proche
- ✅ Construction itérative (pas de récursion — pile limitée)
- ✅ AABB ray intersection standard (slab method)

### Points faibles
- ⚠️ Median-split simple : peut produire des BVH déséquilibrés si les AABB sont très irrégulières (vs SAH ou volume heuristic)
- ⚠️ Pas de refit/update du BVH — `Build()` reconstruit tout depuis zéro
- ⚠️ Une seule AABB par feuille — pas de clustering

---

## 6. TriggerSystem (WASM)

**Fichiers :** `wasm/src/physics/TriggerSystem.h/.cpp`

### Architecture
- Détection entrée/sortie de zones de trigger
- 5 types : Generic, Damage, Heal, Teleport, Quest
- Parcours complet de toutes les entités avec Transform chaque tick
- Ring buffer de 128 events, drainable vers JS

### Points forts
- ✅ Ring buffer sans allocation — taille fixe 128 events
- ✅ Namespace d'entités séparé (80000+) vs colliders (90000+)
- ✅ Événements exit émis quand zone supprimée/désactivée

### Points faibles
- ⚠️ **O(n × m)** chaque tick : `g_Registry.ForEach<Transform>` pour chaque zone active — coût quadratique avec le nombre de zones × entités
- ⚠️ Test par point (centre de l'entité) — pas par bounding box. Une grande entité peut chevaucher une zone sans que son centre y soit

---

## 7. Comparaison WASM CollisionSystem vs JS CollisionWorld.ts

### Responsabilités actuelles

| Fonction | WASM (C++) | JS (Three.js) |
|----------|------------|---------------|
| `isBlocked()` | ✅ **Prioritaire** via `SegmentBlocked` | ⚠️ Fallback si WASM désactivé |
| `getGroundY()` | ❌ Jamais appelé | ✅ **Toujours** Three.js BVH + normal filtering |
| `resolveCameraPosition()` | ❌ Jamais appelé | ✅ **Toujours** Three.js |
| `raycastPoint()` | ❌ Jamais appelé | ✅ **Toujours** Three.js |
| RaycastDown | ✅ Exposé mais peu utilisé côté JS | ❌ Non utilisé |
| RegisterScene | ✅ AABBs batch | ✅ three-mesh-bvh sur chaque geometry |
| Collision queries (IA) | ✅ SegmentBlocked | ❌ Non utilisé |

### Analyse du dual-system

**Quand WASM est actif (`_wasmEnabled && isEngineLoaded()`) :**
- `registerScene` / `add` → **double enregistrement** : Three.js `ensureBoundsTree()` + WASM `registerCollider`/`batchRegisterSceneColliders`
- `isBlocked()` → WASM `engine.isSegmentBlocked()`
- `clear()` → **double nettoyage** : `colliders = []` + `engine.clearColliders()`

**Pourquoi `getGroundY()` reste sur Three.js :**
1. **Précision triangulaire** — Three.js test les vrais triangles, WASM ne fait que des AABB. Le sol étant souvent incliné ou à géométrie fine (dalles, rochers), un AABB serait trop grossier
2. **Filtrage par normale** — `worldNormal.y > 0.5` exclut les faces verticales (murs). WASM AABB ne peut pas filtrer par normale
3. **Correction documentée** — `GROUND_SEARCH_DEPTH = 1000` avec commentaire détaillant le bug de `fromHeight + 60` (plancher absolu à y=-60 qui cassait la Forge)

**Redondance constatée :**
- Chaque mesh est traversé **deux fois** lors du register : une fois par `batchRegisterSceneColliders` (Three.js `Box3.setFromObject` → AABB monde), une fois par `ensureBoundsTree` (three-mesh-bvh → BVH triangle)
- Les AABB calculés côté JS sont envoyés à WASM via `HEAPF32[base…]` — coût de marshaling mais batché

### Risques
1. **Désynchronisation potentielle** : si un mesh est ajouté côté JS sans notifier WASM (`add()` le fait, mais `remove()` ne nettoie que le JS, pas WASM — et WASM n'a pas de `removeCollider()` publique)
2. **Double mémoire GPU/CPU** : les AABB WASM sont CPU, les BVH three-mesh-bvh sont GPU — pas de conflit direct mais double footprint
3. **Deux vérités** : une requête peut passer WASM mais échouer Three.js (ou vice-versa) si les AABB simplifiés ne capturent pas la géométrie fine

---

## 8. Recommandations

### Immédiat (priorité haute)

1. **Ajouter `removeCollider(entity)` au CollisionSystem WASM** — actuellement, `remove()` côté JS ne nettoie pas le collider WASM. Le collider reste dans le BVH et continue de blocker les raycasts. Prévoir un `m_RemovedEntities` set filtré lors des queries, ou marquer les colliders comme inactifs.

2. **Unifier ChunkStreamingManager + AssetBudgetManager** — les deux systèmes gèrent le budget mémoire avec des valeurs par défaut différentes (512 MB vs 2048 MB). Décider qui est l'autorité. Idéalement, AssetBudgetManager délègue la logique chunk à ChunkStreamingManager et se concentre sur les assets non-chunk.

3. **Optimiser TriggerSystem** — remplacer le O(n×m) par une structure spatiale. Soit le BVH existant (`QueryAABBAll` avec tag trigger), soit une grid spatiale pour les zones statiques.

### Court terme (priorité moyenne)

4. **Améliorer `RegisterColliderBatch`** — la fonction JS `batchRegisterSceneColliders` alloue `_malloc`/`_free` à chaque registerScene. Utiliser une arena allouée une fois pour éviter la fragmentation mémoire WASM.

5. **Ajouter un cache spatial au Tick() streaming** — `Tick()` trie tous les chunks par distance chaque frame. Pour 500+ chunks, c'est O(n log n) par frame. Un KD-tree ou un spatial hash réduirait à O(k log n) où k = chunks dans le rayon.

6. **Supprimer le `Projection optimiste` du downgrade budget** — l'ajustement immédiat de `m_UsedMB` en phase Downgrade peut désynchroniser le compteur si JS refuse la commande. Marquer la commande comme "pending" et ajuster seulement sur confirmation.

### Long terme (recommandations architecturales)

7. **Migrer progressivement Three.js BVH → WASM BVH** — pour les requêtes qui n'ont pas besoin de précision triangulaire (broad-phase collision, isBlocked). `getGroundY` et les requêtes précises resteront Three.js. À terme : WASM = broad phase, Three.js = narrow phase.

8. **Ajouter un flag `collisionFilter` aux colliders WASM** — permettre de tagger les colliders (terrain, mur, décor, trigger) pour filtrer les requêtes sans reparcourir tout le BVH.

9. **Envisager un SAH (Surface Area Heuristic)** pour la construction du BVH — améliorerait l'équilibrage des nœuds et les performances de traversée sur des scènes irrégulières.

---

## 9. Schéma d'architecture actuel

```
┌─────────────────────────────────────────────────────────────────┐
│  JS (CollisionWorld.ts + PhysicsSync.ts)                        │
│                                                                 │
│  isBlocked() → engine.isSegmentBlocked() ──┐                    │
│  getGroundY() → Three.js Raycaster ──────┐ │                    │
│  raycastPoint() → Three.js Raycaster ───┐│ │                    │
│  resolveCamera() → Three.js Raycaster ─┐││ │                    │
│                                        │││ │                    │
│  registerScene() ──┬─ ensureBoundsTree()→ Three.js BVH          │
│                    └─ batchRegisterSceneColliders() ──┐         │
│                                                       │         │
└───────────────────────────────────────────────────────┼─────────┘
                                                        │
┌───────────────────────────────────────────────────────┼─────────┐
│  EMSMIPTEN BINDING (Bindings.cpp)                     │         │
│  registerCollider / registerColliderBatch             ▼         │
│  isSegmentBlocked → CollisionSystem::SegmentBlocked()           │
│  raycastDown      → CollisionSystem::RaycastDown()              │
│  buildBVH         → CollisionSystem::BuildBVH()                  │
└───────────────────────────────────────────────────────┬─────────┘
                                                        │
┌───────────────────────────────────────────────────────┴─────────┐
│  WASM C++                                                       │
│                                                                │
│  ┌─────────────────────┐    ┌───────────────────────────────┐  │
│  │ CollisionSystem     │    │ ChunkStreamingManager         │  │
│  │  ├─ m_StaticCollider│    │  ├─ m_Chunks[] (ChunkMeta)    │  │
│  │  ├─ BVH (BVHNode[]) │    │  ├─ m_LoadRadius              │  │
│  │  └─ m_Dynamic...    │    │  ├─ m_UnloadRadius            │  │
│  └────────┬────────────┘    │  └─ m_BudgetMB = 512          │  │
│           │                 └───────────────────────────────┘  │
│           ▼                                                    │
│  ┌──────────────────┐    ┌───────────────────────────────┐     │
│  │ BVH              │    │ AssetBudgetManager            │     │
│  │  ├─ median-split │    │  ├─ 7 catégories              │     │
│  │  ├─ pile 64      │    │  ├─ 3 quality tiers           │     │
│  │  └─ Ray/AABB     │    │  └─ m_TotalBudgetMB = 2048    │     │
│  └──────────────────┘    └───────────────────────────────┘     │
│                                                                │
│  ┌──────────────────┐    ┌───────────────────────────────┐     │
│  │ TriggerSystem    │    │ VehicleSystem                 │     │
│  │  ├─ Ring buffer  │    │  └─ Warthog simulation        │     │
│  │  └─ O(n×m)       │    └───────────────────────────────┘     │
│  └──────────────────┘                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. Fichiers audités

| Fichier | Lignes | Rôle |
|---------|--------|------|
| `wasm/src/streaming/ChunkStreamingManager.h` | 68 | Déclaration streaming chunks |
| `wasm/src/streaming/ChunkStreamingManager.cpp` | 176 | Implémentation streaming chunks |
| `wasm/src/streaming/AssetBudgetManager.h` | 103 | Déclaration budget multi-catégorie |
| `wasm/src/streaming/AssetBudgetManager.cpp` | 304 | Implémentation budget multi-catégorie |
| `wasm/src/physics/BVH.h` | 50 | Déclaration BVH |
| `wasm/src/physics/BVH.cpp` | 306 | Implémentation BVH (build + queries) |
| `wasm/src/physics/CollisionSystem.h` | 60 | Déclaration collision |
| `wasm/src/physics/CollisionSystem.cpp` | 288 | Implémentation collision |
| `wasm/src/physics/TriggerSystem.h` | 75 | Déclaration triggers |
| `wasm/src/physics/TriggerSystem.cpp` | 150 | Implémentation triggers |
| `wasm/src/physics/Raycast.h` | 29 | Structures Ray/AABB |
| `wasm/src/physics/Raycast.cpp` | 39 | Intersection Ray-AABB |
| `wasm/src/bridge/Bindings.cpp` | 430 | Pont embind JS ↔ C++ |
| `wasm/src/bridge/WorldCoordinator.h` | 62 | Ordonnanceur global |
| `wasm/src/bridge/WorldCoordinator.cpp` | 177 | Tick logique déterministe |
| `src/rpg/runtime/CollisionWorld.ts` | 239 | Collision hybride JS |
| `src/rpg/wasm/PhysicsSync.ts` | 136 | Pont Three.js → WASM |
| `src/rpg/wasm/WasmBridge.ts` | 249 | Interface WASM complète |
| `_legacy_archive/core/PhysicsSystem.ts` | 120 | Ancien système (archivé) |

---

*Fin du rapport — 29 juillet 2026*