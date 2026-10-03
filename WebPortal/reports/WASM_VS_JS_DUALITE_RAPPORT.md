# RAPPORT D'AUDIT : Dualité WASM vs JS — NARVOS PRIME

**Date :** 2026-07-29  
**Projet :** Narvos Prime Web Portal  
**Périmètre :** `E:/narvosprime-web-prototype/WebPortal/`  
**Auteur :** Équipe d'audit WASM vs JS  

---

## Résumé Exécutif

Le projet Narvos Prime fait cohabiter un moteur C++ compilé en WASM (ECS, AI, collision BVH, navigation A*, animation graph, streaming) avec un runtime Three.js/React (rendu 3D, animation mixer, logique NPC, gestion des chunks). L'architecture est **hybride pragmatique** mais révèle 5 dualités critiques, des boucles de rétroaction cachées, et des risques de divergence qui, combinés, représentent une **dette technique de plusieurs semaines**.

**Constat principal :** Le WASM est le **maître logique** (décisions IA, collision BVH, pathfinding A*, streaming budget). JS est le **maître visuel** (rendu Three.js, animation des squelettes, chargement GLB, UI). Les ponts (`PhysicsSync`, `WasmNpcBridge`, `NavMeshBaker`, `AnimationBridge`, `ChunkStreamingBridge`) sont fonctionnels mais exposent des **frottements** à chaque tick.

---

## 1. COLLISION — CollisionWorld.ts vs CollisionSystem (WASM)

### Architecture

```
┌──────────────────────────────────────────────┐
│ CollisionWorld.ts (JS, singleton)           │
│  • Three.js BVH (three-mesh-bvh)           │
│  • isBlocked → WASM AABB ou Three.js raycast│
│  • getGroundY / resolveCamera → Three.js AVEC│
│    filtrage par normale (précision triangle) │
│  • registerScene/add → DUAL : BVH JS + WASM │
│  • _wasmEnabled flag (toggle)                │
└──────────────┬───────────────────────────────┘
               │
     ┌─────────▼─────────────┐
     │ PhysicsSync.ts (pont) │
     │  • registerMeshCollider│
     │  • batchRegisterScene  │
     │  • wasmRaycastDown     │
     │  • wasmSegmentBlocked  │
     └─────────┬─────────────┘
               │
┌──────────────▼───────────────────────────────┐
│ CollisionSystem (WASM/C++)                  │
│  • BVH (Bounding Volume Hierarchy)          │
│  • StaticCollider (BVH) + DynamicCollider   │
│  • SegmentBlocked, RaycastDown, Resolve     │
│  • AABB broadphase (≈10× plus rapide que    │
│    Three.js raycast pour l'IA bulk)          │
└──────────────────────────────────────────────┘
```

### Dualité

| Aspect | JS (CollisionWorld) | WASM (CollisionSystem) |
|--------|---------------------|----------------------|
| **Maître ?** | OUI pour le rendu/visuel (raycastPoint, getGroundY, resolveCameraPosition) | OUI pour les décisions bulk (isBlocked de l'IA) |
| **Suivant ?** | WASM pour isBlocked (quand actif) | Three.js BVH pour tout le rendu |
| **Doublon ?** | OUI partiel : les colliders sont enregistrés DANS LES DEUX mondes | Même scene traverse → box calées deux fois |
| **Feedback loop ?** | OUI : les positions Three.js → PhysicsSync → WASM chaque frame | NON (sens unique JS→WASM) |
| **Risque** | Désync si un collider est ajouté/retiré uniquement dans un monde | Oubli de `clearColliders()` au reset |

### Analyse

`CollisionWorld` est le point d'entrée unique côté JS mais bifurque selon `_wasmEnabled` :
- **isBlocked** → WASM SegmentBlocked (AABB broadphase, 10× meilleur pour l'IA bulk)
- **getGroundY** → TOUJOURS Three.js BVH (précision triangulaire + filtrage normale Y > 0.5)
- **resolveCameraPosition** → TOUJOURS Three.js BVH (précision indispensable)

La dualité est **assumée et documentée** : le WASM fait le gros de la détection de collision pour l'IA, le Three.js BVH fait les requêtes de précision (sol, caméra). Le problème est le **coût d'entretien** : tout ajout/suppression de mesh collidable doit être dupliqué (registerMeshCollider + Three.js push).

### Recommandation
- **Unifier le registre** : un seul tableau de colliders côté JS, synchronisé vers WASM par batch diff (ajout/suppression uniquement). Actuellement `batchRegisterSceneColliders` fait un `clearColliders()` + ré-enregistrement complet à chaque `registerScene`, ce qui est violent.
- `getGroundY` et `resolveCameraPosition` ne peuvent PAS migrer vers WASM tant que le WASM ne supporte que les AABB (pas de mesh triangles normals). C'est acceptable.

---

## 2. NPC — NpcController.ts vs AISystem (WASM)

### Architecture

```
┌─────────────────────────────────────┐
│ NpcController.ts (JS)              │
│  • Machine à états : idle/chase/   │
│    attack/dead                     │
│  • Pour NPC sans WASM activé       │
│  • Testable isolément (pure logique)│
│  • decideNpcState() pure function  │
│  • Gère aggro, leash, giveUpTime,  │
│    LOS, cooldown d'attaque         │
└─────────────────┬───────────────────┘
                  │
    ┌─────────────▼──────────────┐
    │ useWasmNpcAI.ts (hook)    │
    │ • registerNpc → WASM ECS  │
    │ • getCommand() → lit les  │
    │   décisions WASM          │
    │ • convertit AICommand en  │
    │   NpcFrameResult          │
    └─────────────┬──────────────┘
                  │ dispatchCommands
┌─────────────────▼───────────────────┐
│ AISystem (WASM/C++)                 │
│  • Machine à états tactique :       │
│    Idle → Combat → Flank → Retreat  │
│  • EQS (Environment Query System)   │
│  • ChooseTarget, FindCover          │
│  • CanSeeTarget (raycast)           │
│  • Émet AICommand[] dans buffer     │
└─────────────────────────────────────┘
```

### Dualité

| Aspect | JS (NpcController) | WASM (AISystem) |
|--------|-------------------|------------------|
| **Maître ?** | Fallback seulement | OUI (quand WASM chargé) |
| **Suivant ?** | useWasmNpcAI dispatch | Les commandes sont lues par JS |
| **Doublon ?** | OUI TOTAL : deux machines à états complètes | Idle↔Chase↔Attack (JS) vs Idle↔Combat↔Flank↔Retreat (WASM) |
| **Feedback loop ?** | OUI : JS sync position → WASM tick IA → JS lit commandes → JS applique mouvement → JS re-sync | |
| **Risque** | Divergence d'états : un NPC peut être "attack" dans un monde et "Flank" dans l'autre | |

### Analyse

Les deux systèmes sont **totalement redondants** :
- `NpcController.ts` est une machine à 4 états (idle/chase/attack/dead) avec détection aggro et ligne de vue
- `AISystem.cpp` est une machine à 5 états (Idle/Patrol/Combat/Flank/Retreat/Dead) avec EQS, couverture, flanc

Quand WASM est activé, `useWasmNpcAI` **remplace** complètement `NpcController.update()` : le hook lit les commandes WASM et les convertit en `NpcFrameResult`. Mais le `NpcController` existe toujours en mémoire pour chaque NPC, ses états ne sont plus mis à jour.

**Boucle de rétroaction :**
1. JS met à jour la position des NPCs (Three.js → `syncNpcPosition`)
2. `WasmWorldTicker` → `coordinator.tick(dt)` → `AISystem::Update(dt)`
3. AISystem lit les Transform, décide, écrit les AICommand[]
4. `readAICommands()` → `wasmNpcBridge.dispatchCommands()`
5. Chaque NPC lit sa commande avec `useWasmNpcAI().getResult()`
6. Le NPC bouge → on retourne à l'étape 1

**Risque de divergence critique :** Si `syncNpcPosition` rate un frame, l'IA WASM décide sur des positions obsolètes, mais le NPC bouge côté JS → le WASM voit le NPC ailleurs que là où il est vraiment.

### Recommandation
- **Éliminer `NpcController.ts`** quand WASM est actif, ou le transformer en traducteur direct (wrapper decorator). Actuellement les deux coexistent mais `NpcController` n'est plus piloté → dead code.
- Ajouter un **checksum d'état** : à chaque tick, le WASM devrait renvoyer le `state` de chaque entité IA, et JS devrait le logger en debug pour détecter les divergences.
- Faire transiter les **événements de dégâts** par le WASM (déjà partiellement fait avec `DamageEventSync`) pour que `AISystem::TickHealthSystem` sache quand le NPC a vraiment perdu des HP.

---

## 3. NAVMESH — NavMeshBaker.ts vs NavMesh.cpp

### Architecture

```
┌──────────────────────────────────────────────┐
│ NavMeshBaker.ts (JS)                        │
│  • Échantillonne CollisionWorld (getGroundY │
│    + isBlocked) pour chaque cellule         │
│  • Grille régulière, cache par fingerprint  │
│  • Yields au navigateur toutes les 16 lignes│
│  • Appelé async par WasmWorldTicker         │
└──────────────┬───────────────────────────────┘
               │ heights[] + walkFlags[]
               ▼
┌──────────────────────────────────────────────┐
│ NavMeshBridge.ts (pont)                     │
│  • initNavMesh → navInit()                  │
│  • bakeNavMeshFromHeightmap → upload buffers│
│  • requestPath, getNextWaypoint, snapToNav   │
└──────────────┬───────────────────────────────┘
               │
┌──────────────▼───────────────────────────────┐
│ NavMesh.cpp (WASM/C++)                      │
│  • Grille A* 8-connexe                      │
│  • Init / SetCell / BakeFromHeightmap       │
│  • FindPath (A* + SmoothPath string-pulling)│
│  • SnapToNavMesh (spirale)                  │
│  • PathManager : requêtes par entité         │
└──────────────────────────────────────────────┘
```

### Dualité

| Aspect | JS (NavMeshBaker) | WASM (NavMesh) |
|--------|-------------------|-----------------|
| **Maître ?** | OUI : la construction (échantillonnage) | OUI : les requêtes (pathfinding) |
| **Suivant ?** | NavMesh.cpp ne fait que stocker/servir | Baker produit les données brutes |
| **Doublon ?** | NON — complémentarité saine | Le baker échantillonne, le CPP stocke + A* |
| **Feedback loop ?** | NON : bake est one-shot (fire-and-forget) | |
| **Risque** | Cache de bake obsolète si la scène change dynamiquement | A* ne voit pas les obstacles mobiles |

### Analyse

C'est la dualité la **mieux conçue** du projet : séparation claire entre la **construction** (JS, asynchrone, avec yields) et les **requêtes** (WASM, synchrone, A* optimisé).

Le cache par fingerprint (`colliderCount|bounds`) évite les re-bakes inutiles lors des changements de personnage.

**Risque principal :** Le navmesh est statique (baked une fois au chargement de la map). Si un obstacle est ajouté/retiré (destruction, construction), le navmesh n'est pas mis à jour → les NPCs marchent à travers les nouveaux murs.

### Recommandation
- Ajouter une fonction `navSetCell(x, z, walkable)` exposée au JS (elle existe déjà mais n'est pas appelée dynamiquement)
- Pour les obstacles temporaires, ajouter des **coûts de zone** plutôt que de rebake
- Le bake asynchrone est excellent — le garder comme pattern de référence pour les autres systèmes

---

## 4. ANIMATION — AnimationController.ts vs AnimationGraph.cpp

### Architecture

```
┌──────────────────────────────────────────────┐
│ AnimationController.ts (JS)                 │
│  • THREE.AnimationMixer                     │
│  • Crossfade, one-shot, overlay upper-body  │
│  • Locomotion directionnelle (blend entre   │
│    walk_forward/back/left/right)            │
│  • Crouch additif procédural                │
│  • Resolution des clips par ActionId        │
│  • AnimEvents (frame-exact)                 │
│  • HÉRITAGE du code Three.js legacy         │
└──────────────────┬───────────────────────────┘
                   │
┌──────────────────▼───────────────────────────┐
│ AnimationBridge.ts (pont)                   │
│  • uploadSkeleton (cold path)               │
│  • uploadClip (cold path)                   │
│  • createAnimGraph + setParamFloat          │
│  • updateAndApplyBones (hot path)           │
│    → écrit les boneMatrices Three.js        │
│    → chaque frame                           │
└──────────────────┬───────────────────────────┘
                   │
┌──────────────────▼───────────────────────────┐
│ AnimationGraph.cpp (WASM/C++)               │
│  • Nœuds : Clip, Blend1D, StateMachine, IK  │
│  • Sample depuis l'Animator (clips stockés  │
│    en C++)                                  │
│  • WriteBoneMatrices (skin * invBind)       │
│  • Calcule les transforms globaux          │
└──────────────────────────────────────────────┘
```

### Dualité

| Aspect | JS (AnimationController) | WASM (AnimationGraph) |
|--------|-------------------------|----------------------|
| **Maître ?** | OUI (dans la pratique, 99% des animations) | OUI (expérimental, PNJ militaire) |
| **Suivant ?** | WASM écrit les boneMatrices (quand graph actif) | JS lit les matrices |
| **Doublon ?** | OUI : DEUX pipelines d'animation complètes | |
| **Feedback loop ?** | NON (pour l'instant — écriture one-way WASM→JS) | |
| **Risque** | Les clips uploadés dans le WASM ne sont PAS les mêmes que ceux de Three.js → doublon mémoire + désync potentielle | |

### Analyse

C'est la dualité la **plus coûteuse** du projet :

- **AnimationController.ts** est un système mature (~922 lignes) avec crossfade, overlays, crouch additif, locomotion directionnelle, one-shots, events frame-exact — tout le pipeline de rendu Three.js
- **AnimationGraph.cpp** est un système C++ complet avec Blend1D, IK, State Machine, skinning — mais il n'est utilisé que pour les PNJ avec rig "militaire" (upload squelette + clips → graph → updateAndApplyBones chaque frame)

Les **deux pipelines coexistent** et ne se parlent pas : un PNJ utilise soit l'un, soit l'autre. Les clips sont chargés DEUX FOIS (une fois par Three.js GLTFLoader, une fois uploadés manuellement dans le WASM via `uploadClip`). Les squelettes sont uploadés avec `uploadSkeleton` en plus du skeleton Three.js natif.

**Problème d'architecture :** `AnimationController` résout les clips par nom (ActionId → fallback multi-noms) tandis que `AnimationGraph` les adresse par nom de clip direct. Il n'y a pas de mapping entre les deux.

### Recommandation
- **Choisir un maître unique** : soit tout le skinning passe par le WASM (migration progressive), soit on abandonne `AnimationGraph.cpp` au profit d'une approche 100% Three.js
- Si on garde les deux, créer un **mapping d'action unifié** (ActionId → clip name) partagé entre JS et WASM
- **Éliminer le double stockage des clips** : soit les clips restent dans Three.js (et le WASM ne fait que du contrôle logique), soit ils migrent tous dans le WASM et Three.js ne fait que lire les boneMatrices
- L'IK et le Blend1D du WASM sont redondants avec ce que Three.js/Three-Animation peut faire

---

## 5. STREAMING — StreamingPuzzleMap.tsx vs ChunkStreamingManager (WASM)

### Architecture

```
┌──────────────────────────────────────────────────┐
│ StreamingPuzzleMap.tsx (React/R3F)              │
│  • GLTFLoader avec cache IndexedDB              │
│  • Budget VRAM, dégradation auto (OOM→low res)  │
│  • Frustum culling + textures GPU upload        │
│  • Auto-material paysage, coques enveloppantes  │
│  • 1039 lignes de logistique de chargement      │
│  • DÉCIDEUR RÉEL : c'est ici que les chunks     │
│    sont chargés/déchargés                       │
└────────────────────┬─────────────────────────────┘
                     │ tickStreaming / drainCommands
┌────────────────────▼─────────────────────────────┐
│ ChunkStreamingBridge.ts (pont)                  │
│  • initStreaming, registerStreamingChunk        │
│  • tickStreaming(px, py, pz)                    │
│  • drainStreamingCommands → Load/Unload         │
└────────────────────┬─────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────┐
│ ChunkStreamingManager (WASM/C++)                │
│  • Décide QUOI charger/décharger selon distance │
│    ET budget VRAM                               │
│  • MarkLoaded/MarkUnloaded (compteur VRAM)     │
│  • UpdateChunkRadius (correction post-load)    │
│  • CacheFingerprint()                          │
│  • MAIS le WASM ne charge rien lui-même        │
└──────────────────────────────────────────────────┘
```

### Dualité

| Aspect | JS (StreamingPuzzleMap) | WASM (ChunkStreamingManager) |
|--------|------------------------|------------------------------|
| **Maître ?** | OUI : chargement effectif, textures GPU, gestion mémoire | OUI : décision de load/unload |
| **Suivant ?** | Wasm lit les décisions → JS les exécute | WASM ne fait que trier par distance |
| **Doublon ?** | NON : le WASM décide, JS exécute (saine séparation) | |
| **Feedback loop ?** | OUI : JS tick streaming → WASM décide Load/Unload → JS charge → JS markLoaded → budget MAJ | |
| **Risque** | Le budget VRAM du WASM est basé sur `estimatedMB` (approximation statique) alors que JS calcule le vrai coût GPU après chargement → dérive budgétaire | |

### Analyse

C'est la dualité la **mieux architecturée** parmi les cinq : le WASM fait le calcul spatial (tri par distance + budget) et JS fait le travail lourd (fetch GLB, parse, textures, upload GPU, collisions, auto-material).

**Boucle de rétroaction fonctionnelle :**
1. `StreamingPuzzleMap` → `tickStreaming(joueur)` → WASM trie les chunks par distance
2. WASM produit des commandes Load/Unload → `drainStreamingCommands()`
3. JS charge les chunks demandés (GLTFLoader + KTX2 textures + GPU upload)
4. JS → `markChunkLoaded(id)` → WASM met à jour son compteur VRAM interne
5. Au tick suivant, le budget VRAM WASM reflète les vrais chunks chargés

**Risque de dérive budgétaire :** Le WASM utilise `estimatedMB` (métadonnée du chunk). JS calcule le vrai coût GPU (textures compressées → BC1/BC3 × mipmaps). Si l'estimation est trop basse, le WASM autorise trop de chunks → OOM GPU.

### Recommandation
- Remplacer `estimatedMB` par le **vrai coût GPU** mesuré après chargement (retourné par `uploadChunkTextures`) et synchroniser ce chiffre vers le WASM
- Fusionner `ChunkStreamingManager` et `AssetBudgetManager` (WASM) : ils font la même chose (budget + distance), un seul suffit
- Le `Tick` WASM est un simple tri + boucle : pourrait être fait en JS à moindre coût de friction

---

## 6. WasmWorldTicker.tsx — LE POINT D'ENTRÉE UNIQUE

### Tick cycle complet (chaque frame)

```
useFrame(_, dt)
  │
  ├─ 1. syncPlayerPosition(x, y, z)        ← WasmNpcBridge
  │     → engine.setEntityPosition(playerEntity)
  │
  ├─ 2. coordinator.tick(dt)               ← WasmWorldCoordinator
  │     → engine.tickWorld(dt)
  │         ├─ AISystem::Update(dt)        → AICommand[]
  │         ├─ PathManager::Update()        → avance waypoints
  │         ├─ TriggerSystem::Tick()        → events entrée/sortie
  │         ├─ StatusEffects::Tick(dt)     → brûlure, stun, root
  │         ├─ TickHealthSystem(dt)        → regen shield, death check
  │         └─ TickDeathCleanup(dt)        → détruit entités mortes > 5s
  │
  ├─ 3. drainWasmDamageEvents()            ← DamageEventSync
  │     → lit les dégâts du buffer WASM
  │
  ├─ 4. readAICommands()                    ← AICommandSync
  │     → AICommand[] du buffer WASM
  │   wasmNpcBridge.dispatchCommands(cmds)  ← WasmNpcBridge
  │     → map entity → jsId pour chaque NPC
  │
  ├─ 5. pullEffectsFromWasm(entityMap)     ← StatusEffectSync
  │     → sync les statuts vers JS
  │
  └─ 6. tickAssetBudget(px, py, pz)        ← AssetBudgetBridge
        drainAssetCommands()               ← Load/Unload assets
```

### Timing et synchronisation

| Problème | Impact |
|----------|--------|
| dt clampé à 0.05s | WASM ne reçoit que des dt ≤ 50ms (limite les dégâts d'un freeze) |
| Un seul tick WASM par frame JS | Possible **décalage** si le frame rate fluctue (60fps → 1 tick = 16ms, 30fps → 33ms) |
| `initAIBuffers` alloue une seule fois | OK — mais `readAICommands` lit `HEAPU32[countPtr]` qui n'est pas écrit si `WriteCommands` n'est pas bindé (TODO dans le code) |
| Le bake navmesh est **fire-and-forget** | Les NPC tombent sur `useWasmNpcAI` qui n'a pas de commandes tant que le navmesh n'est pas prêt → idle par défaut |
| `collisionWorld.enableWasm()` au mount | Bascule atomique — si le WASM crash, `_wasmEnabled` reste false → fallback Three.js |

---

## 7. TABLEAU RÉCAPITULATIF DES DUALITÉS

| Système | JS | WASM | Maître | Suivant | Doublon ? | Feedback ? | Risque |
|---------|----|------|--------|---------|-----------|-------------|--------|
| **Collision** | CollisionWorld.ts (BVH Three.js) | CollisionSystem (BVH C++) | Split : JS pour précision, WASM pour bulk | Split | OUI partiel | OUI (JS→WASM position sync) | Désync registre |
| **NPC** | NpcController.ts (4 états) | AISystem (5 états + EQS) | WASM (quand actif) | JS (lecture commandes) | **TOTAL** | OUI (positions→IA→commandes→mouvement) | **Divergence d'états** |
| **Navmesh** | NavMeshBaker.ts (échantillon) | NavMesh.cpp (A* stockage) | JS (construction) / WASM (requêtes) | Complémentaire | NON | NON | Cache statique |
| **Animation** | AnimationController.ts (Mixer) | AnimationGraph.cpp (C++ skin) | JS (99% usage) | WASM (expérimental) | **TOTAL** | NON | **Double mémoire + désync** |
| **Streaming** | StreamingPuzzleMap.tsx (load réel) | ChunkStreamingManager (décision) | JS (exécution) / WASM (décision) | Complémentaire | NON | OUI (saine) | Dérive budgétaire |

---

## 8. RISQUES CUMULATIFS (priorisés)

### 🔴 Critique
1. **Double système d'IA NPC :** `NpcController.ts` et `AISystem.cpp` sont deux implémentations complètes qui ne sont JAMAIS synchronisées. Un NPC peut être "Flank" dans le WASM mais "chase" dans JS si on lit le mauvais système.
2. **Double pipeline d'animation :** Les clips sont stockés et traités dans les deux mondes. `AnimationGraph.cpp` n'est utilisé que pour un sous-ensemble de PNJ mais ajoute une complexité de maintenance énorme pour un bénéfice marginal.

### 🟠 Élevé
3. **Budget streaming dérivant :** Le WASM utilise `estimatedMB` statique tandis que JS mesure le vrai coût GPU. Sans synchronisation, le WASM peut autoriser trop de chargements.
4. **Collision register coûteux :** `batchRegisterSceneColliders` refait un `clearColliders()` + ré-enregistrement complet à chaque `registerScene`. Sur une map à 12 000 meshes, le calcul des AABBs et l'upload WASM sont gaspillés.

### 🟡 Moyen
5. **Navmesh statique :** Pas de mise à jour en cours de partie si la scène de collision change.
6. **Pas de filet WASM → JS :** Si `tickWorld` crash (boucle infinie, OOB memory), tout le render loop est figé. Il n'y a pas de timeout watchdog.
7. **Double initialisation du moteur :** `initWorld()` + `initCollisionSystem()` sont appelés à chaque montée de `WasmWorldTicker` (useEffect). Si le composant est remonté (changement de personnage), tout le monde WASM est recréé.

---

## 9. PROPOSITION D'ARCHITECTURE UNIFIÉE

### Principe directeur

> **Le WASM est le moteur logique (decide). Le JS est le moteur de rendu (execute).**
> Toute logique métier (IA, pathfinding, décision de streaming, collision detection bulk) doit converger vers le WASM.
> Tout rendu visuel (Three.js, animation, UI) reste en JS.

### Architecture cible

```
┌─────────────────────────────────────────────────────────────┐
│ JS (Three.js / React)                                      │
│                                                             │
│  StreamingPuzzleMap  →  GLTF load, GPU textures, collision  │
│  CollisionWorld      →  raycast PRÉCISION (sol, caméra)    │
│  AnimationController →  THREE.AnimationMixer (rendu final)  │
│  Npc.tsx             →  rendu NPC + sync positions          │
│  UI / HUD            →  React                              │
│                                                             │
│  BRIDGES (fins, pas de duplication) :                       │
│    • PhysicsSync     →  register colliders ONLY              │
│    • WasmNpcBridge   →  sync positions + read commands      │
│    • NavMeshBridge   →  upload baked data + read paths      │
│    • ChunkStreaming  →  read load/unload commands           │
│    • DamageEventSync →  drain events                        │
└──────────────────────────┬──────────────────────────────────┘
                           │ FlatBuffer / typed arrays (zero-copy)
┌──────────────────────────▼──────────────────────────────────┐
│ WASM (C++)                                                   │
│                                                              │
│  WorldCoordinator::Tick(dt)                                  │
│    ├─ AISystem::Update(dt)        ← SEUL décideur IA       │
│    ├─ PathManager::Update()       ← SEUL pathfinding        │
│    ├─ CollisionSystem             ← AABB bulk QUERIES ONLY │
│    ├─ ChunkStreamingManager       ← Streaming DÉCISIONS     │
│    ├─ StatusEffects::Tick(dt)     ← SEUL état effets       │
│    └─ HealthSystem + DeathCleanup ← SEUL cycle de vie      │
│                                                              │
│  ⚠ SUPPRIMER AnimationGraph (redondant avec Three.js)       │
│  ⚠ GARDER NavMesh : stockage + A* uniquement               │
└──────────────────────────────────────────────────────────────┘
```

### Plan de migration (par priorité)

| Phase | Action | Effort | Bénéfice |
|-------|--------|--------|----------|
| **P1** | Supprimer `AnimationGraph` (WASM). Tout le skinning reste dans Three.js. Les PNJ "militaires" passent par `AnimationController` standard. | 2-3j | Élimine la dualité la plus coûteuse |
| **P2** | Unifier l'IA NPC : `NpcController.ts` devient un wrapper qui délègue à `useWasmNpcAI`. Plus de machine à états JS dupliquée. | 2j | Élimine le risque de divergence |
| **P3** | Synchroniser le budget VRAM réel (JS → WASM) après chaque chargement de chunk. | 1j | Élimine la dérive budgétaire |
| **P4** | Remplacer `clearColliders()` + ré-enregistrement par un **diff registry** côté WASM. | 1j | Économise les AABB recalcs inutiles |
| **P5** | Ajouter des cellules dynamiques au navmesh (setCell post-bake pour obstacles temporaires). | 1j | NPC peuvent contourner les obstacles dynamiques |
| **P6** | Ajouter un watchdog WASM (timeout sur `tickWorld`). | 0.5j | Filet de sécurité anti-freeze |

### Métriques de succès

- **Code supprimé :** ~1 000 lignes (AnimationGraph (164) + AnimationBridge upload (219) + AnimationController redondances)
- **Friction réduite :** Plus qu'un seul registre de collision, une seule IA NPC, un seul budget streaming
- **Latence :** Élimination des doubles appels de malloc/free HEAPF32 pour les clips d'anim
- **Maintenabilité :** Le pont JS↔WASM devient un flux unidirectionnel : JS sync → WASM tick → JS drain

---

## Annexe A : Fichiers analysés

### Côté WASM (`wasm/src/`)
| Fichier | Rôle |
|---------|------|
| `physics/CollisionSystem.cpp/.h` | BVH + AABB collision |
| `ai/AISystem.cpp/.h` | IA tactique (5 états + EQS) |
| `navigation/NavMesh.cpp/.h` | Grille A* pathfinding |
| `navigation/PathManager.cpp/.h` | Gestionnaire de chemins par entité |
| `animation/AnimationGraph.cpp/.h` | Graph d'animation (Blend1D, IK, SM) |
| `streaming/ChunkStreamingManager.cpp/.h` | Décisions de streaming basées distance+budget |
| `bridge/WorldCoordinator.cpp/.h` | Orchestrateur du tick WASM |
| `bridge/Bindings.cpp` | Binding Emscripten (C++ → JS) |
| `ecs/Registry.cpp/.h` | ECS maison |

### Côté JS/TS (`src/`)
| Fichier | Rôle |
|---------|------|
| `runtime/CollisionWorld.ts` | Collision hybride Three.js + WASM |
| `runtime/StreamingPuzzleMap.tsx` | Chargement streaming de chunks |
| `npc/NpcController.ts` | Machine à états NPC (fallback) |
| `wasm/WasmBridge.ts` | Chargeur WASM + interface `NarvosWasmModule` |
| `wasm/WasmWorldTicker.tsx` | Point d'entrée WASM dans R3F |
| `wasm/WasmWorldCoordinator.ts` | Wrapper JS pour `WorldCoordinator` C++ |
| `wasm/PhysicsSync.ts` | Pont collision (register + raycast) |
| `wasm/WasmNpcBridge.ts` | Pont NPC (ECS ↔ JS) |
| `wasm/AICommandSync.ts` | Lecture des commandes IA WASM |
| `wasm/useWasmNpcAI.ts` | Hook NPC → commande WASM |
| `wasm/NavMeshBaker.ts` | Échantillonnage collision → grille navmesh |
| `wasm/NavMeshBridge.ts` | Pont navmesh (upload + requêtes) |
| `wasm/AnimationBridge.ts` | Upload squelettes/clips + skin WASM→Three.js |
| `wasm/ChunkStreamingBridge.ts` | Pont décisions WASM → JS |
| `wasm/AssetBudgetBridge.ts` | Pont budget VRAM catégorisé |
| `wasm/DamageEventSync.ts` | Drain des événements de dégâts |
| `wasm/StatusEffectSync.ts` | Sync statuts WASM → JS |
| `animation/AnimationController.ts` | Contrôleur d'animation Three.js (Mixer) |

---

*Rapport généré par l'équipe d'audit WASM vs JS — Narvos Prime, Juillet 2026*
