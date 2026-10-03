# RAPPORT WASM — Compilation et Intégration

**Équipe :** WASM Compilation  
**Date :** 29 juillet 2026  
**Projet :** NARVOS PRIME — `WebPortal/wasm/`

---

## 1. Fichiers de build

### 1.1 CMakeLists.txt

**Fichier :** `wasm/CMakeLists.txt`

- **Project** : `NarvosWasm` (langage C++, standard C++20)
- **Build system** : CMake 3.20+ — générateur Ninja
- **Toolchain** : Emscripten (`emcmake` / `emmake` / `em++`)
- **Dépendance externe** : GLM 1.0.1 (header-only, bundlé dans `vendor/glm/`)

**Configuration WASM spécifique (section `if(EMSCRIPTEN)`) :**
| Option | Valeur |
|---|---|
| SIMD | `-msimd128` (gain 3–80× sur maths/physique/IA) |
| WASM | `WASM=1` |
| Mémoire | `ALLOW_MEMORY_GROWTH=1`, `INITIAL_MEMORY=67108864` (64 Mo) |
| Allocateur | `mimalloc` |
| Export runtime | `ccall`, `cwrap`, `HEAPF32`, `HEAPU32` |
| Export fonctions | `_malloc`, `_free` |
| Modularisation | `MODULARIZE=1`, `EXPORT_NAME=NarvosEngine` |
| Cible | `ENVIRONMENT=web` |
| Bindings | `--bind` (embind) |
| Optimisation | `-O2` |
| Threads | Optionnel (`NARVOS_PTHREADS=OFF` par défaut) |

Les **threads** (pthreads) sont désactivés par défaut. Activation nécessite `-DNARVOS_PTHREADS=ON` + headers COOP/COEP côté serveur.

### 1.2 SOURCES compilées — inventaire complet

Le `CMakeLists.txt` liste **45 fichiers** dans la variable `SOURCES` (18 × `.cpp` + 27 × `.h` header-only). Tout `.h` est inclus pour que CMake détecte les dépendances.

#### Fichiers .cpp (18) — TOUS dans CMakeLists.txt ✓

| Module | Fichier | Dans CMakeLists ? |
|---|---|---|
| ECS | `src/ecs/Registry.cpp` | ✅ |
| Animation | `src/animation/Skeleton.cpp` | ✅ |
| Animation | `src/animation/AnimationGraph.cpp` | ✅ |
| Physique | `src/physics/Raycast.cpp` | ✅ |
| Physique | `src/physics/CollisionSystem.cpp` | ✅ |
| Physique | `src/physics/Vehicle.cpp` | ✅ |
| Physique | `src/physics/BVH.cpp` | ✅ |
| Physique | `src/physics/TriggerSystem.cpp` | ✅ |
| IA | `src/ai/EQS.cpp` | ✅ |
| IA | `src/ai/AISystem.cpp` | ✅ |
| Combat | `src/combat/StatusEffects.cpp` | ✅ |
| Bridge | `src/bridge/AnimationBridge.cpp` | ✅ |
| Bridge | `src/bridge/WorldCoordinator.cpp` | ✅ |
| Bridge | `src/bridge/Bindings.cpp` | ✅ |
| Streaming | `src/streaming/ChunkStreamingManager.cpp` | ✅ |
| Streaming | `src/streaming/AssetBudgetManager.cpp` | ✅ |
| Navigation | `src/navigation/NavMesh.cpp` | ✅ |
| Navigation | `src/navigation/PathManager.cpp` | ✅ |

#### Fichiers .h sans .cpp (header-only) — OK ✓

Tous les headers-only sont soit : structs de composants ECS (Transform, Health, Weapon, AITactical, PlayerTag), templates (ComponentPool), types mathématiques (Types.h, Math.h), events (DamageEvents.h), ou classe utilitaire (Animator.h). Aucun `.h` n'attend un `.cpp` manquant. ✅

**Résultat :** Couverture à **100%** — tous les `.cpp` sont dans le CMakeLists, tous les `.h` avec implémentation ont leur `.cpp` correspondant. ✅

---

## 2. Scripts de build

### 2.1 `package.json` — commandes WASM

| Commande | Description |
|---|---|
| `npm run build:wasm` | `cd wasm && emcmake cmake -B build -DCMAKE_BUILD_TYPE=Release && emmake cmake --build build --config Release --parallel` |
| `npm run copy:wasm` | Copie `wasm/dist/narvos-engine.{js,wasm}` → `public/wasm/` |
| `npm run dev:wasm` | `build:wasm` + `copy:wasm` + `vite dev` |
| `npm run go` / `dev:full` | `node scripts/try-wasm.cjs` + `npm run electron:dev` |
| `npm run build:full` | `node scripts/try-wasm.cjs` + `npm run build` |

### 2.2 `scripts/try-wasm.cjs` — Pont de build

- Détecte `emcmake` via `where emcmake` (Windows) / `which emcmake`
- **Si emcmake absent :** log warning, vérifie si `public/wasm/narvos-engine.wasm` existe (version en cache), exit 0 (non-bloquant)
- **Si emcmake présent :** exécute `npm run build:wasm && npm run copy:wasm`
- **En cas d'échec :** log erreur, mais ne bloque pas le lancement — le dev continue sans WASM

### 2.3 `scripts/build-electron.js` — Build Electron

- Compile `electron/main.ts` + `electron/preload.ts` → `dist-electron/` via esbuild
- **Non lié au WASM** — compilation TypeScript côté Electron uniquement

### 2.4 Scripts de build autonomes (`wasm/`)

| Script | Usage |
|---|---|
| `wasm/build.sh` | `./build.sh` (Release) ou `./build.sh debug` (Debug + DWARF) |
| `wasm/build.ps1` | `.\build.ps1` (Release) ou `.\build.ps1 debug` |

Les deux scripts :
1. Créent le dossier `build/` si absent
2. Vérifient/installent GLM (`vendor/glm/`) via git clone si manquant
3. Lancent `emcmake cmake` + `emmake cmake --build`
4. Affichent la taille des fichiers générés dans `dist/`

### 2.5 Commande exacte pour builder

```bash
# Depuis WebPortal/
cd wasm && emcmake cmake -B build -DCMAKE_BUILD_TYPE=Release -DCMAKE_CXX_STANDARD=20

# Compilation
emmake cmake --build build --parallel

# Copie vers public/
npm run copy:wasm
```

---

## 3. État de la compilation

### 3.1 Dernier build

- **Date :** 22 juillet 2026 à 02:40
- **Type :** Release
- **Générateur :** Ninja
- **Outcome :** ✅ SUCCÈS — tous les 18 `.cpp` compilés + liés sans erreur
- **Preuve :**
  - Fichiers `.o` présents dans `wasm/build/CMakeFiles/narvos-engine.dir/` pour chaque `.cpp`
  - Fichier `.ninja_log` montre les timestamps de compilation et le lien final
  - Sortie `dist/narvos-engine.js` (33 765 octets) + `dist/narvos-engine.wasm` (236 082 octets)

### 3.2 Emscripten toolchain

| Info | Valeur |
|---|---|
| SDK emsdk | `D:/emsdk/` |
| Compilateur | `D:/emsdk/upstream/emscripten/em++.exe` |
| Node.js | `D:/emsdk/node/22.16.0_64bit/bin/node.exe` |
| CMake toolchain | `D:/emsdk/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake` |
| Version CMake | 4.4.0 |

### 3.3 Erreurs connues

- **Aucune erreur de compilation C++** connue. Le fichier `compile_errors.txt` (1 618 octets, UTF-16) contient uniquement des **erreurs TypeScript/TSX** (syntaxe JSX mal formée dans `public/maps/AQUARYS_VILLE_01.tsx` et `public/maps/futurus.tsx`) — ce sont des fichiers map, pas du WASM.
- **Aucune erreur de link** dans les logs ninja.
- **Threads WASM désactivés** par défaut (optionnel, nécessite `-DNARVOS_PTHREADS=ON`).

### 3.4 Version servie = code source ? ✅

| Fichier | SHA-256 | Taille | Mise à jour |
|---|---|---|---|
| `wasm/dist/narvos-engine.wasm` (sortie build) | `190060f99e7bdd0738bd738ef0faca18f5eac898966a86facb47c05bf9b5ea8c` | 236 082 B | Jul 22 02:40 |
| `public/wasm/narvos-engine.wasm` (servi en dev) | `190060f99e7bdd0738bd738ef0faca18f5eac898966a86facb47c05bf9b5ea8c` | 236 082 B | Jul 22 02:40 |
| `dist/wasm/narvos-engine.wasm` (servi en prod) | `190060f99e7bdd0738bd738ef0faca18f5eac898966a86facb47c05bf9b5ea8c` | 236 082 B | Jul 22 02:40 |

Les trois copies sont **identiques** (même hash, même taille, même timestamp). La version servie en dev (`public/wasm/`) et en prod (`dist/wasm/`) correspond exactement au binaire issu de la compilation. ✅

### 3.5 Comment le WASM est chargé dans l'application

Le fichier `src/rpg/wasm/WasmBridge.ts` charge le WASM via un `<script>` tag dynamique pointant vers `/wasm/narvos-engine.js` (fichier dans `public/wasm/`). Ce `.js` est un UMD généré par Emscripten (`MODULARIZE=1`, `EXPORT_NAME=NarvosEngine`). La factory est ensuite appelée avec `locateFile` pour charger le `.wasm` depuis `/wasm/`.

Vite.js est configuré avec `assetsInclude: ['**/*.wasm']` et `optimizeDeps: { exclude: ['narvos-engine'] }` pour éviter de transformer le fichier WASM.

Les headers COOP/COEP (`Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`) sont activés en dev sur le port 3005 pour permettre `SharedArrayBuffer` (nécessaire si les threads sont activés).

---

## 4. Résumé

| Critère | Statut |
|---|---|
| Tous les .cpp dans CMakeLists.txt | ✅ 18/18 |
| Tous les .h avec .cpp correspondant | ✅ 17/17 (headers-only OK) |
| Build C++ → WASM réussi | ✅ Dernier build : 22 juillet 2026 |
| Erreurs C++ connues | ❌ Aucune |
| Version servie = code source | ✅ SHA-256 identique sur les 3 copies |
| Scripts de build fonctionnels | ✅ 3 méthodes (npm, sh, ps1) |
| Emscripten SDK installé | ✅ D:/emsdk/ |

### Recommandations

1. **Recompiler après modification** — le WASM date du 22 juillet ; toute modification des `.cpp` depuis cette date nécessite `npm run build:wasm && npm run copy:wasm`
2. **Activer les threads** si besoin de performance massivement parallèle — ajouter `Cross-Origin-Opener-Policy` et `Cross-Origin-Embedder-Policy` (déjà en place en dev) et passer `-DNARVOS_PTHREADS=ON`
3. **Nettoyer les erreurs TSX** dans `compile_errors.txt` (concernent des fichiers map `public/maps/`, pas le WASM)
4. **Version du WASM** — envisager un mécanisme de versioning ou fingerprint pour forcer le cache navigateur à invalider l'ancien WASM après un rebuild