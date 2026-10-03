---
name: wasm-engine
description: Logique d'implémentation du moteur hybride C++/WASM (NarvosEngine) — architecture, conventions, pièges et règles inviolables. À utiliser pour toute modification touchant WebPortal/wasm/ (C++) ou src/rpg/wasm/ (pont TypeScript), ou tout code qui interagit avec l'IA, la physique, le combat ou l'animation WASM.
---

# NarvosEngine WASM — Mémoire d'implémentation

Moteur C++ compilé en WebAssembly (Emscripten/embind) pour le compute lourd du MMORPG NARVOS PRIME. JS/TS garde le rendering (Three.js/R3F) et l'UI (React). Ce skill encode la logique établie sur les phases 1→5 pour que toute modification future reste cohérente sans ré-itération.

## 1. Frontière architecturale (règle n°1, jamais violée)

**C++ (`WebPortal/wasm/src/`)** : décisions et calcul — IA tactique (FSM, EQS), physique broadphase (AABB), santé/mort, status effects, blend d'animation, véhicules, tick monde.
**TS (`WebPortal/src/rpg/wasm/`)** : glue — upload de données, drain d'events, dispatch de commandes, mapping d'identités.
**Le C++ ne rend rien, ne touche jamais au DOM. Le TS ne prend jamais de décision de gameplay qui existe déjà côté C++.** Si une logique de gameplay compute-heavy apparaît, elle va dans `wasm/src/` — pas dans un composant R3F, pas dans un hook.

## 2. Architecture et flux de données

### Tick déterministe (WorldCoordinator)
`bridge/WorldCoordinator.{h,cpp}` est le singleton C++ (`g_WorldCoordinator`) qui orchestre TOUT. Ordre de tick fixe et non négociable :

```
AISystem::Update → StatusEffects.Tick → TickHealthSystem → TickDeathCleanup
```

- HealthSystem : regen bouclier après `shieldRechargeDelay`, détection de mort (`currentHealth <= 0` → `isDead = true` + `AIState::Dead`).
- DeathCleanup : sweep toutes les 2 s (`kCleanupInterval`), détruit les entités mortes depuis ≥ 5 s (`kDeathGracePeriod`). La grâce laisse le temps au JS de jouer l'animation de mort.
- Pause / `timeScale` gérés DANS le coordinator (`Tick` early-return si paused, `dt *= timeScale`). Ne jamais réimplémenter côté JS.
- **Toute nouvelle fonctionnalité de tick s'insère dans `WorldCoordinator::Tick`, jamais dans `Bindings.cpp`** (les fonctions de Bindings sont des délégués fins).

### Boucle frame côté JS (WasmWorldTicker.tsx)
Un SEUL point d'entrée WASM dans le render loop R3F, ordre fixe :

```
sync position joueur → wasmWorldCoordinator.tick(dt) → drainWasmDamageEvents
→ readAICommands → wasmNpcBridge.dispatchCommands → pullEffectsFromWasm
```

`dt` clampé à 0.05 s (dans `WasmWorldCoordinator.tick`) — protège contre les gros dt après un onglet inactif.

### Ponts TS (un fichier = une responsabilité)
| Fichier | Rôle |
|---|---|
| `WasmBridge.ts` | Loader singleton + interface typée `NarvosWasmModule` (miroir exact des bindings embind) |
| `WasmWorldCoordinator.ts` | Wrapper du coordinator (init/tick/reset/pause/timeScale/stats) |
| `WasmNpcBridge.ts` | Mapping bidirectionnel `jsId (string) ↔ Entity (u32)` + dispatch commandes IA |
| `PhysicsSync.ts` | Upload colliders (batch Float32Array), raycast/segment helpers |
| `DamageEventSync.ts` | Drain ring buffer dégâts WASM → bus JS |
| `AICommandSync.ts` | Lecture buffer commandes IA |
| `StatusEffectSync.ts` | Sync bidirectionnel effets (burn/root/stun) |
| `AnimationBridge.ts` | Upload skeleton/clips, lecture bone matrices |
| `playerPositionStore.ts` | Ref position joueur exposée hors React |
| `useWasmNpcAI.ts` | Hook per-NPC : commande WASM → `NpcFrameResult` |
| `index.ts` | Barrel — **tout nouvel export public passe par là** |

### Collision hybride (décision figée, ne pas "simplifier")
WASM = AABB broadphase uniquement. Three.js BVH = précision triangulaire. Répartition dans `runtime/CollisionWorld.ts` (même singleton, même API, 25+ call sites intouchés) :
- `isBlocked` → WASM `isSegmentBlocked` quand `wasmActive` (mass-checks IA, 10×).
- `getGroundY`, `resolveCameraPosition`, `raycastPoint` → **TOUJOURS** Three.js BVH (filtrage par normale, anti-clip caméra 3 niveaux, point triangle exact). Un remplacement pur par WASM serait une régression de qualité — déjà analysé, décision actée.
- `registerScene`/`add`/`clear` → double registration (BVH + AABBs WASM via `batchRegisterSceneColliders`).

## 3. Conventions de développement

### C++ (`wasm/src/`)
- C++20, GLM (avec `GLM_ENABLE_EXPERIMENTAL` défini dans CMakeLists — ne pas retirer).
- Types : `f32/f64/u32/Entity` de `core/Types.h`. `Entity = u32`, `INVALID_ENTITY = 0xFFFFFFFF`. **Ces alias sont à portée fichier, PAS dans `namespace nv`** → dans les lambdas embind, écrire `uint32_t`, jamais `nv::Entity`.
- Singletons globaux : `g_Registry`, `g_CollisionSystem`, `g_StatusEffects`, `g_DamageEvents`, `g_WorldCoordinator`, `bridge::g_AnimBridge`.
- Composants = structs POD dans `components/` (Transform, Health, Weapon, AITactical, PlayerTag). **Un composant partagé entre .cpp = un header dans `components/`** — jamais de struct locale à un .cpp (violation ODR : `typeid` divergerait entre translation units et créerait des pools ECS séparés — bug déjà rencontré avec PlayerTag).
- ECS : sparse-set (`ComponentPool`), `g_Registry.ForEach<T>` prend un `std::function<void(Entity, T&...)>` — **une lambda brute ne matche pas la déduction de template** ; déclarer explicitement :
  ```cpp
  std::function<void(Entity, Health&)> fn = [&](Entity e, Health& h) { ... };
  g_Registry.ForEach<Health>(fn);
  ```
- Nouveau fichier C++ → ajouter au `SOURCES` de `CMakeLists.txt` (headers inclus, par convention du projet).

### Bindings embind (`bridge/Bindings.cpp`)
- Lambdas : **préfixe `+` obligatoire** (`+[](){ ... }`) — force la conversion en pointeur de fonction, sinon `no matching function for call to 'function'`.
- Pointeurs bruts JS→C++ : passer en `uintptr_t` puis `reinterpret_cast`.
- Retour d'objet structuré : `emscripten::val::object()` + `.set(...)` (cf. `getWorldStats`).
- Chaque binding ajouté DOIT être miroité dans l'interface `NarvosWasmModule` (`WasmBridge.ts`) — même nom, même signature. C'est le contrat de type unique.

### TypeScript (`src/rpg/wasm/`)
- Tout accès moteur passe par `getEngine()` avec guard null + fallback JS silencieux (le jeu doit fonctionner sans WASM chargé) :
  ```ts
  const engine = getEngine();
  if (!engine) return fallbackJS();
  ```
- Singletons hors-React (pattern projet : `npcRegistry`, `collisionWorld`) ; pont React via hooks dédiés seulement.
- Buffers partagés : `_malloc` à l'init, `_free` au cleanup, accès via `HEAPF32/HEAPU32` avec `>> 2` pour l'offset. Toujours apparier init/free (cf. `initDamageBuffers`/`freeDamageBuffers`).
- Commentaires en **français** (convention projet).

## 4. Règles de gameplay inviolables

1. **Ordre de tick** AI → StatusEffects → Health → DeathCleanup. Le combat lit l'état APRÈS l'IA, la mort est détectée APRÈS les dégâts de burn du même tick.
2. **Grâce de mort 5 s** : une entité morte reste dans l'ECS (pour l'anim de mort côté JS) puis est détruite. Ne jamais détruire immédiatement à la mort.
3. **La position joueur est autoritative côté JS** (CharacterController) — le WASM la reçoit en lecture (`syncPlayerPosition`), jamais l'inverse.
4. **Les positions NPC visuelles sont autoritatives côté JS** ; le WASM émet des COMMANDES (MoveTo/Attack/FindCover/Retreat/Die), le JS les exécute et re-synchronise. Le WASM ne téléporte pas les NPC.
5. **Un seul `createPlayer`** — `registerPlayer` est idempotent (re-check `isEntityValid`). `AISystem::ChooseTarget` cible l'entité `PlayerTag` ; deux joueurs = IA cassée.
6. Fallback sans WASM : chaque système doit dégrader proprement (NpcController JS, BVH Three.js) — jamais de hard dependency au .wasm.

## 5. Contraintes techniques

- **Build** : emsdk (`D:\emsdk`, activer via `emsdk_env.bat` ou exporter `EMSDK`, `EMSDK_NODE`, `EMSDK_PYTHON`, PATH += `D:\emsdk;D:\emsdk\upstream\emscripten`) + CMake (`C:\Program Files\CMake\bin`) + Ninja (fourni par emsdk). Commande : `cd WebPortal/wasm && .\build.ps1`, puis copier `dist/narvos-engine.{js,wasm}` → `public/wasm/`. Alternative npm : `npm run build:wasm && npm run copy:wasm`.
- **`build.ps1` piège PowerShell** : si `emcmake cmake ... -DCMAKE_BUILD_TYPE=$BuildType` échoue avec `rules.ninja: lexing error` sur `$BuildType`, la variable n'a pas été interpolée — lancer `emcmake`/`emmake` avec les valeurs en dur.
- **Chargement Vite** : `public/wasm/narvos-engine.js` est importé dynamiquement avec **spécificateur en variable + `/* @vite-ignore */`** (WasmBridge.ts). Un littéral statique fait échouer `vite:import-analysis` ("Cannot import non-asset file inside /public") — et casse les TESTS de tout fichier qui importe transitivement le barrel wasm. Ne pas "nettoyer" ce pattern.
- **Mémoire WASM** : `ALLOW_MEMORY_GROWTH=1`, initial 64 MB. `HEAPF32` peut être invalidé après growth — ne jamais cacher la vue TypedArray entre frames, toujours relire `engine.HEAPF32`.
- **Namespace d'IDs** : entités ECS commencent à 0 ; colliders batch de scène commencent à l'Entity 90000 (`PhysicsSync.ts`). Ne pas créer d'entités gameplay au-delà de ~90k, ne pas changer cette base sans mettre à jour les deux côtés.
- **Environnement** : output Emscripten `ENVIRONMENT=web` — le module ne se charge pas sous Node/vitest. Les tests ne doivent JAMAIS charger le moteur : tout module testé doit pouvoir s'importer sans effet de bord WASM (`getEngine()` rend null, c'est suffisant).
- **COOP/COEP** : headers configurés dans `vite.config.ts` pour SharedArrayBuffer — ne pas retirer.
- **tsc** : zéro nouvelle erreur dans `src/rpg/**` (erreurs legacy 2D pré-existantes tolérées ailleurs).

## 6. Erreurs courantes (déjà commises, ne pas répéter)

| Erreur | Symptôme | Fix |
|---|---|---|
| Lambda embind sans `+` | `no matching function for call to 'function'` | `+[](...)` |
| `nv::Entity` dans un binding | `no type named 'Entity' in namespace 'nv'` | `uint32_t` |
| Struct composant locale à un .cpp | Pools ECS séparés par translation unit, lookups qui échouent silencieusement | Header partagé dans `components/` |
| Lambda brute dans `ForEach` | `could not match 'std::function<...>' against lambda` | `std::function` explicite |
| Include GLM `gtx/*` sans define | `GLM_GTX_* is an experimental extension` | `GLM_ENABLE_EXPERIMENTAL` (déjà dans CMake) |
| Import statique de `/wasm/*.js` | Vite import-analysis échoue, tests cassés en cascade | Variable + `@vite-ignore` |
| Oublier le miroir TS d'un binding | Erreur runtime `engine.foo is not a function` | Ajouter à `NarvosWasmModule` dans le même commit |
| Oublier `CMakeLists.txt` | Symbole non défini au link | Ajouter le .cpp aux SOURCES |
| Passer positions live à `useWasmNpcAI` | Cycle unregister/register chaque frame (deps x,y,z de l'effect) | Passer la position de SPAWN uniquement ; sync live via `syncPosition()` |
| Vérifier les exports dans le .js compilé | grep vide → fausse alerte | Les noms embind vivent dans le **.wasm** (segment data), pas dans le .js |

## 7. Exemples canoniques

### Ajouter une fonctionnalité de tick C++
```cpp
// 1. WorldCoordinator.h : déclarer TickMonSysteme(f32 dt) en privé
// 2. WorldCoordinator.cpp : implémenter + insérer dans Tick() à la bonne place de l'ordre
// 3. Si nouvel état exposé à JS : binding délégué dans Bindings.cpp
function("maStat", +[]() -> float { return nv::g_WorldCoordinator.GetMaStat(); });
// 4. Miroir dans NarvosWasmModule (WasmBridge.ts) : maStat(): number;
// 5. Exposer via WasmWorldCoordinator.ts si c'est du contrôle monde
// 6. Recompiler + copier dist → public/wasm/
```

### Batch upload JS → WASM (pattern de référence : batchRegisterSceneColliders)
```ts
const floats = new Float32Array(count * STRIDE);
// ... remplir ...
const ptr = engine._malloc(floats.byteLength);
engine.HEAPF32.set(floats, ptr >> 2);   // relire HEAPF32, jamais de vue cachée
engine.registerColliderBatch(ptr, count, 90000);
engine._free(ptr);
```

### Intégration runtime (pattern défini, PAS ENCORE branché dans RpgGameWorld)
```tsx
// 1. Au boot : await loadNarvosEngine() → setWasmReady(true)
// 2. Au mount joueur : playerPositionStore.setRef(playerPos)
// 3. Dans le Canvas : <WasmWorldTicker enabled={wasmReady} />
// 4. Dans chaque <Npc> : useWasmNpcAI({id, x, y, z, role, health}) en alternative à NpcController
```
État actuel : la couche `src/rpg/wasm/` est complète, testée et compilée, mais **aucun composant runtime ne la monte encore**. Le branchement dans RpgGameWorld est la prochaine étape d'intégration — suivre ce pattern exactement, ne pas en inventer un autre.

## 8. Checklist avant de conclure une modification WASM

1. `npx tsc --noEmit` — zéro nouvelle erreur `src/rpg/**`.
2. `npm test` — la suite complète passe (les tests ne chargent jamais le moteur).
3. Si C++ modifié : recompiler, copier vers `public/wasm/`, vérifier les nouveaux exports via `grep "nomBinding" public/wasm/narvos-engine.wasm`.
4. Chaque binding ajouté a son miroir `NarvosWasmModule` + export barrel `index.ts` si public.
5. Le fallback sans WASM fonctionne toujours (guard `getEngine()`).
6. Mettre à jour la mémoire projet (`project_wasm_engine.md`) si une phase est franchie.
<!-- [TROU — ligne jamais lue dans les transcriptions] -->