# RAPPORT D'ANALYSE — SYSTÈME DE RENDU & PERFORMANCES
## Équipe AMÉLIORATIONS RENDU (10 agents)
**Date :** 29 juillet 2026  
**Périmètre :** StreamingPuzzleMap, materials, loaders, chunkCache, WASM C++

---

## SOMMAIRE

1. [RÉSUMÉ EXÉCUTIF](#1-résumé-exécutif)
2. [ANALYSE PAR COMPOSANT](#2-analyse-par-composant)
   - 2.1 [StreamingPuzzleMap.tsx](#21-streamingpuzzlemaptsx)
   - 2.2 [src/rpg/materials/](#22-srcrpgmaterials)
   - 2.3 [src/rpg/loaders/](#23-srcrpgloaders)
   - 2.4 [chunkCache (IndexedDB)](#24-chunkcache-indexeddb)
   - 2.5 [distanceBand](#25-distanceband)
   - 2.6 [WASM C++ (ChunkStreamingManager)](#26-wasm-c-chunkstreamingmanager)
   - 2.7 [WASM C++ (Physics/BVH)](#27-wasm-c-physicsbvh)
   - 2.8 [WasmBridge & Bridges associés](#28-wasmbridge--bridges-associés)
3. [GOULOTS D'ÉTRANGLEMENT IDENTIFIÉS](#3-goulots-détranglement-identifiés)
4. [PROBLÈMES DE MÉMOIRE](#4-problèmes-de-mémoire)
5. [PROBLÈMES DE PERFORMANCE](#5-problèmes-de-performance)
6. [RECOMMANDATIONS D'OPTIMISATION](#6-recommandations-doptimisation)
7. [ÉVALUATION DE LA DETTE TECHNIQUE](#7-évaluation-de-la-dette-technique)
8. [PLAN D'ACTION PRIORISÉ](#8-plan-daction-priorisé)

---

## 1. RÉSUMÉ EXÉCUTIF

Le système de rendu de Narvos Prime est **remarquablement bien instrumenté** — chaque problème identifié dans l'historique est documenté avec ses causes racines, ses mesures et ses correctifs. Cependant, plusieurs **goulots d'étranglement structurels** persistent :

| Métrique | Constat |
|---|---|
| **VRAM** | Chunk forge : ~396 Mo/chunk en KTX2 BC1 → 3,2 Go pour 8 chunks. Budget poussé à 3600 Mo. |
| **Temps chargement** | ~90 s soupape de sécurité. Latence réseau + parse GLB + transcodage KTX2 + upload GPU. |
| **Draw calls** | Orbital monolithique : 25 222 meshes → 25 222 draw calls. Passé à 737 après chunking. |
| **Collision** | BVH AABB C++ fonctionnel mais sans mesh précis → raycast limité aux boîtes. |
| **Cache** | IndexedDB versionné manuellement (v8). Fingerprint aide mais purge brutale. |
| **Concurrence** | MAX_CONCURRENT=2 charge 2 chunks max en parallèle. |
| **Memory leaks** | Gérés via disposeStaleAutoMaterials (idle callback) mais le cycle de vie des textures orphelines en cas d'erreur reste fragile. |

**Points forts :** qualité du code remarquable (commentaires, métriques, raisons des décisions), auto-material triplanaire efficace (26 Mo VRAM vs 500 Mo en bakes), KTX2 bien intégré, soupape de sécurité anti-blocage, cache IndexedDB.

---

## 2. ANALYSE PAR COMPOSANT

### 2.1 StreamingPuzzleMap.tsx

**Rôle :** Composant React Three Fiber qui charge/stream les chunks de map (8+ chunks) avec support WASM.

**Dépendances :**
- `@react-three/fiber` (useFrame, useThree)
- `three` (GLTFLoader, Frustum, Matrix4)
- `../loaders/assetQuality` (qualityVariant, degradeVariant, assetExists)
- `../materials/terrainMaterialStore` (loadTerrainSelection)
- `../materials/autoMaterialStore` (applyAutoMaterial, loadAutoMaterialTextures, etc.)
- `../wasm/ChunkStreamingBridge` (initStreaming, tickStreaming, etc.)
- `../wasm/WasmBridge` (isEngineLoaded, loadNarvosEngine)
- `./CollisionWorld` (collisionWorld)
- `./loading/chunkCache` (getCachedChunk, storeCachedChunk)

**Points sensibles :**

1. **Concurrence limitée (MAX_CONCURRENT=2)** : 2 chunks max en parallèle. Pour 8 chunks de ~500 textures chacun, le temps de chargement total est linéaire. Avec des chunks de 100+ Mo chacun, c'est un goulet sérieux.

2. **Upload GPU par lots de 16 textures** : `uploadChunkTextures` processe les textures par lots de 16 avec rAF entre chaque lot. C'est prudent (évite le context lost) mais très lent pour des chunks de 500-600 textures.

3. **Sécurité soupape à 90 s** : Le `SAFETY_MS = 90_000` est un filet, mais si le chargement est vraiment lent, le joueur attend 90 s avant le reveal. C'est trop long pour une expérience acceptable.

4. **createImageBitmap masqué** : Solution élégante mais radicale — supprimer `createImageBitmap` globalement pendant le parse force le fallback `TextureLoader`, ce qui ralentit le décodage.

5. **Repli automatique qualité** : Le `degradeVariant` dans le catch OOM est excellent, mais il ne tente que 4 essais. En situation de mémoire très tendue, les 4 peuvent échouer.

6. **Collision BVH batch** : `batchRegisterSceneColliders` copie toutes les bounding boxes en WASM mais ne rebuild le BVH qu'une fois. Si un chunk est chargé après le build, ses colliders ne sont pas pris en compte.

**Dette technique :**
- `doLoadChunk` est une fonction de 350+ lignes — candidate au refactoring en sous-étapes (fetch, parse, material, collision, upload).
- `eslint-disable react-hooks/exhaustive-deps` sur 3 hooks — les dépendances sont intentionnellement incomplètes.
- `(loader as any).parse = function(...)` — cast `any` pour patcher le prototype.

---

### 2.2 src/rpg/materials/

#### 2.2.1 autoMaterialStore.ts

**Rôle :** Singleton qui gère les textures procédurales du terrain (snow/rock/grass/etc. en triplanaire monde).

**Points sensibles :**

1. **20 textures chargées au démarrage** : `allLayerTextureUrls()` charge les 7 couches × 2 (couleur + normale) + variation = 15 textures. ~56 Mo de VRAM. C'est délibéré (changement instantané dans l'éditeur) mais coûteux au boot.

2. **WeakMap patched → fuite potentielle** : Le WeakMap `patched` ne garde pas de référence forte, donc le matériau source peut être GC. Mais `liveMaterials` est un `Set<Material>` avec références fortes — si le dispose n'est pas appelé, les shaders compilés restent en mémoire.

3. **Stale materials différés** : `disposeStaleAutoMaterials()` est appelé en `requestIdleCallback` — safe mais si le callback n'est jamais exécuté (onglet caché, CPU saturé), les matériaux s'accumulent.

4. **loadPromise partagé** : Tous les appels concurrents partagent `loadPromise`. Si la 1ère tentative échoue partiellement (certaines textures OK, d'autres non), le code dispose TOUT et retente. C'est correct mais peut boucler 2 fois avant d'abandonner.

**Forces :**
- Mécanisme de `generation` (entier comparé à chaque frame) → zéro overhead React
- Disposal en idle callback → pas de crash GPU
- Cache de program key dans `customProgramCacheKey` → évite la recompilation du shader

#### 2.2.2 AutoMaterial.ts (makeAutoMaterial)

**Rôle :** Fabrique un MeshStandardMaterial patché avec le shader triplanaire via `onBeforeCompile`.

**Points sensibles :**

1. **`onBeforeCompile` remplacement de shader** : La technique est élégante mais fragile — elle dépend de l'ordre exact des `#include <...>` dans le shader Three.js. Une mise à jour de Three.js peut casser les `replace()`.

2. **FRAG_NORMAL dépend des variables de FRAG_COLOR** : Le commentaire l'explique et le justifie, mais c'est un couplage fort entre deux injections de shader.

3. **Clone du matériau source** : `base.clone()` copie potentiellement des textures qui sont ensuite nullifiées. Si `clone()` est lent pour des matériaux complexes, ça peut impacter le chargement.

#### 2.2.3 terrainMaterialStore.ts

**Rôle :** Persistance et édition des couches de terrain (sélection → localStorage).

Sans problème notable : code propre, validation `sanitize` pour les données localStorage corrompues, pont React via `useSyncExternalStore`.

#### 2.2.4 autoMaterialConfig.ts

**Rôle :** Catalogue des 7 couches de terrain et fonctions de mélange.

**Points sensibles :**
- 7 couches → 14 fichiers KTX2 (couleur + normal) + 1 variation = 15 fichiers
- `TERRAIN_LAYERS` hard-codé — un fichier renommé sur le disque casse le chargement sans message d'erreur clair (SPA fallback renvoie 200/text/html)

---

### 2.3 src/rpg/loaders/

#### 2.3.1 assetQuality.ts

**Rôle :** Système de variantes qualité (.glb / .med.glb / .low.glb) avec cache HEAD.

**Points sensibles :**
1. **HEAD HTTP par asset au démarrage** : `precomputeQualityCache` fait un `fetch(method:'HEAD')` par asset. Pour ~40 useGLTF + 8 chunks + etc., ça peut être 50+ requêtes.
2. **Cache mémoire simple (Map)** : Pas d'expiration. Un changement de qualité en cours de partie via `refreshQualityCache` refait tous les HEAD.
3. **Détection de variante basée sur suffixe `.med.glb` / `.low.glb`** : Pas de support pour d'autres conventions.

#### 2.3.2 sharedLoaders.ts

**Rôle :** Singletons DRACOLoader (4 workers) + KTX2Loader (4 workers).

**Points sensibles :**
1. **DRACOLoader preload bloquant** : `dracoLoader.preload()` télécharge le WASM Draco au chargement du module.
2. **KTX2Loader detectSupport sur renderer jetable** : Le commentaire explique le problème — si le renderer réel a des capacités différentes, le transcodage peut tomber en RGBA32 (×8 VRAM). La re-détection via `registerRenderer` corrige ça mais ajoute de la complexité.
3. **Worker limit hard-codé à 4** : `setWorkerLimit(4)` pour les deux loaders. Sur CPU 16 cœurs, c'est sous-optimal.

#### 2.3.3 forgeChunks.ts

Simple liste de 8 chemins de chunks. Propre.

#### 2.3.4 installKtx2Everywhere.ts

Patch prototype global sur GLTFLoader pour injecter KTX2. Solution pragmatique mais :
- Patch monkey sur `parse()` des prototypes
- Marqueur `__narvosKtx2Patched` sur le proto — pas idéal en termes de propreté

---

### 2.4 chunkCache (IndexedDB)

**Rôle :** Cache persistant pour les GLB chunks et assets in-game.

**Points sensibles :**
1. **Version bump manuel à 8** : Chaque régénération d'assets nécessite l'incrémentation de `CACHE_VERSION` → purges brutales de TOUT le cache.
2. **Fingerprint C++/JS** : Le hash est simple (somme avec rotation) et peut collisionner.
3. **Même store pour chunks et assets** : `getCachedChunk` et `getCachedAsset` sont des alias vers le même store et la même DB. Une purge chunk nettoie aussi les assets et vice-versa.
4. **Pas de quota management** : L'IndexedDB peut consommer tout l'espace disque sans limite.
5. **Fingerprint clé-valeur dans le même store** : Les fingerprints sont stockés comme des entrées normales dans le store (clés `__narvos_chunk_fingerprint__` et `__narvos_asset_fingerprint__`). Mélange des données avec les métadonnées.

---

### 2.5 distanceBand

**Rôle :** LOD par bandes de distance (NEAR=35m, MID=60m, FAR=au-delà).

**Problème critique :** Ce système est **défini mais presque pas utilisé**. Seul le test existe. Dans le code de rendu principal (StreamingPuzzleMap), le LOD se résume à frustum culling des chunks complets. Il n'y a pas de LOD progressif basé sur la distance.

Les PNJ peuvent utiliser `distanceBand` (via l'IA WASM) mais :
- Aucun mécanisme de réduction de qualité de mesh à distance
- Aucun système d'échange de mesh LoD
- Aucune réduction de fréquence d'update des animations par bande

---

### 2.6 WASM C++ ChunkStreamingManager

**Rôle :** Moteur de streaming en C++ compilé en WASM. Décide quels chunks charger/décharger selon la distance joueur et le budget VRAM.

**Code :** 164 lignes, propre, bien structuré.

**Points sensibles :**
1. **Distance sphérique uniquement** : Prend `dist = distCenter - radius`. Pas de considération de frustum ou d'orientation caméra → des chunks derrière le joueur sont chargés en priorité.
2. **Budget VRAM basé sur `estimatedMB`** : L'estimation est fournie par le JSON de métadonnées. Si elle est inexacte (ex: textures non compressées=RGBA32), le budget est mal géré.
3. **`Tick()` alloue un vector temporaire** : `std::vector<DistEntry> sorted` alloué et trié à chaque tick (potentiellement 60 ou 30 fois/s). C'est un vecteur de 8 entrées seulement, donc négligeable, mais l'allocation existe.
4. **`MarkUnloaded` ne vérifie pas le `loaded` flag** : En fait si — il vérifie. Mais `MarkLoaded` ne protège pas contre les doubles appels.
5. **Chargement préemptif absent** : Le système ne précharge pas les chunks dans la direction du mouvement.

**Améliorations C++ possibles :**
- Pool mémoire fixe pour `DistEntry` au lieu d'allocation dynamique à chaque tick
- Intégration de la direction caméra dans la priorité
- Score de priorité basé sur distance + orientation (dot product direction caméra/centre chunk)
- Cache du résultat du sort entre ticks si le joueur est immobile

---

### 2.7 WASM C++ Physics/BVH

**Rôle :** Collision basée sur AABB (Axis-Aligned Bounding Box), raycast et segment cast.

**Points sensibles :**
1. **BVH median-split naïf** : L'arbre est construit par median split sur l'axe le plus long. Pas de SAH (Surface Area Heuristic) → l'arbre n'est pas optimal pour le raycast.
2. **Stack fixe de 64** : La traversée utilise un stack local de 64 entrées. Pour des scènes très profondes (milliers de colliders), ça peut déborder silencieusement.
3. **Pas de cache de nœuds chauds** : Pas de temporal coherence — le raycast re-descend l'arbre à chaque appel.
4. **Dynamic colliders en O(n)** : `CheckDynamic` et `SegmentCastDynamic` parcourent linéairement tous les colliders dynamiques. Pour ~50 entités dynamiques, c'est ok mais pas scalable.
5. **SegmentBlocked refait le calcul de delta et dir** : Le code définit `delta` et `dir` deux fois (lignes 170-195) dans les branches avec et sans BVH. La branche sans BVH définit `delta` puis dans une portée plus large « vérifier les dynamiques » définit un nouveau `delta` — conflit de nom, le second cache le premier.

**Bugs potentiels :**
- Ligne 195 : `glm::vec3 delta = to - from;` dans la portée après le `else` — mais `delta` est déjà défini soit dans le `if` (m_BVH.IsBuilt()) soit dans le `else`. Le second bloc déclare un nouveau `delta` qui shadow l'ancien, ce qui compile mais le second segment cast utilise le mauvais `delta` si le BVH était présent.

---

### 2.8 WasmBridge & Bridges associés

**Rôle :** Pont TypeScript ↔ WASM via Emscripten embind.

**Points sensibles :**

1. **Script tag dynamique** : `WasmBridge.ts` injecte une `<script>` tag dans le `<head>` pour charger `narvos-engine.js`. Ce n'est pas un ES module — la factory est sur `globalThis`. Cela contourne Vite mais ajoute un point de fragilité (COOP/COEP headers, fallback).

2. **`locateFile` hard-codé** : `locateFile: (path) => '/wasm/${path}'` — pas configurable.

3. **Memory growth potentiel** : Les buffers HEAPU32/HEAPF32 sont relus APRÈS chaque appel C++ qui pourrait faire du memory growth. C'est fait correctement dans `drainStreamingCommands` mais pas forcément partout.

4. **AssetBudgetBridge non utilisé dans WasmWorldTicker** : `tickAssetBudget` est appelé, mais les commandes sont juste émises vers un callback `onAssetCommand`. Il n'y a pas de système de réponse automatique — le callback doit être implémenté ailleurs.

---

## 3. GOULOTS D'ÉTRANGLEMENT IDENTIFIÉS

### Goulot #1 — Chargement initial linéaire (Criticité: HAUTE)
- 2 chunks max en parallèle
- Upload GPU par lots de 16 textures avec rAF entre chaque lot
- Chunk de 500+ textures → ~30 frames d'upload par chunk
- 8 chunks × ~30 frames = ~240 frames (~4 s) juste pour l'upload GPU

### Goulot #2 — Budget VRAM gargantuesque (Criticité: HAUTE)
- Forge : 3600 MB budget
- Même en KTX2 BC1 optimisé, un chunk fait ~396 Mo
- Sur GPU 4-6 Go (majorité des laptops), c'est juste ou insuffisant
- Le downgrade automatique est le bon filet, mais variant 1 cran → /4 surface → le chunk perd en qualité

### Goulot #3 — Pas de LOD progressif (Criticité: MOYENNE)
- `distanceBand` existe mais n'est pas connecté au rendu des chunks
- Frustum culling binaire : visible ou invisible
- Aucun mesh LOD swapping, aucune réduction de qualité texture basée distance

### Goulot #4 — BVH sans mesh précis (Criticité: MOYENNE)
- La collision WASM utilise des AABB, pas la géométrie réelle
- Le Three.js BVH (three-mesh-bvh) est plus précis mais sert seulement de fallback
- Le raycast WASM ne peut pas filtrer par normale (contrairement au Three.js BVH qui le fait dans `getGroundY`)

### Goulot #5 — L'auto-material recompile les shaders onBeforeCompile (Criticité: BASSE)
- Chaque chunk chargé déclenche `makeAutoMaterial` → `onBeforeCompile` → `customProgramCacheKey`
- La recompilation est partiellement mitigée par le cache de programme Three.js
- Mais le `clone()` du matériau source crée un objet intermédiaire

---

## 4. PROBLÈMES DE MÉMOIRE

### 4.1 Fuites potentielles

| Source | Type | Gravité |
|---|---|---|
| `liveMaterials` Set non vidé si `disposeStaleAutoMaterials` jamais appelé | Faible | Moyenne |
| Textures KTX2 stockées dans `textures` Map jusqu'à `disposeAutoMaterial()` | Volontaire | Faible |
| `original` WeakMap jamais vidé (sauf si on repasse sur le même matériau source) | Négligeable | Très faible |
| `staleMaterials` si requestIdleCallback n'est pas exécuté | Faible | Basse |
| Command buffer WASM (`_malloc`) si `clearStreaming` pas appelé | Faible | Basse |

### 4.2 Gestion VRAM

- Le suivi VRAM via `bytesPerPixel` + dimensions est une **estimation** (×1.33 pour mipmaps)
- Les textures non compressées (RGBA32) sont détectées via `uncompressed` count → bon diagnostic
- Le budget 3600 Mo est un maximum — le système downgrade si nécessaire
- L'auto-material économise ~474 Mo (500 Mo bakes - 26 Mo auto-material)

### 4.3 IndexedDB

- Pas de limite de taille → peut saturer le disque
- Version bump purge tout → re-téléchargement complet des 8 chunks (~750 Mo)
- Fingerprint C++/JS synchronisé pour éviter les purges inutiles

---

## 5. PROBLÈMES DE PERFORMANCE

### 5.1 CPU (Main Thread)

| Opération | Coût estimé |
|---|---|
| `GLTFLoader.parse` (chunk) | 500-2000 ms (bloquant si createImageBitmap) |
| `uploadChunkTextures` (500 textures × 16 batch × rAF) | ~2-4 s étalé |
| `Box3.setFromObject` (par chunk) | 10-50 ms |
| `batchRegisterSceneColliders` (par chunk) | 20-100 ms |
| `rebuildAutoMaterial` × 8 chunks (changement de couche) | 100-300 ms |
| `SegmentBlocked` (par frame, WASM) | <0.1 ms |

### 5.2 GPU

| Opération | Coût |
|---|---|
| Render par chunk (draw calls) | ~100-800 draw calls/chunk |
| Auto-material shader (onBeforeCompile) | Un programme compilé par combinaison unique de couches |
| KTX2 transcodage (Basis) | 4 workers, ~0.5-2 ms/texture |
| Frustum culling par chunk (8 spheres) | <0.01 ms |

### 5.3 WASM ↔ JS Bridge

- Appels via embind → overhead de marshalling
- `drainStreamingCommands` : copie des U32 depuis HEAPU32 → nouveau tableau JS
- `segmentCastDistance` : un appel C++ par test de blocage
- La fonction `getWorldStats` crée un objet JS avec 16 propriétés → overhead

### 5.4 Redondances

1. **CollisionWorld hybride** : Three.js BVH PRÉCIS + WASM BVH AABB = du travail en double
2. **createImageBitmap patching global** : Correct mais force un chemin de décodage plus lent
3. **cache IndexedDB + qualityVariant** : Les deux systèmes font du cache, l'un sur le fichier complet, l'autre sur le path
4. **estimateMB vs real vram tracking** : Deux systèmes de mesure VRAM distincts (C++ et JS)

---

## 6. RECOMMANDATIONS D'OPTIMISATION

### 6.1 CRITIQUE — Actions immédiates

#### R1 — Paralléliser le chargement des chunks
**Problème :** MAX_CONCURRENT=2  
**Solution :** 
- Passer à MAX_CONCURRENT=4 ou `navigator.hardwareConcurrency / 2`
- Ajouter un contrôle de saturation mémoire côté JS avant de lancer un nouveau chunk
- Si `gl.getContext().isContextLost()` → baisser MAX_CONCURRENT à 1

#### R2 — Upload GPU différé et priorisé
**Problème :** 16 textures par lot avec rAF = lent  
**Solution :**
- Uploader les textures en priorité pendant l'écran de chargement (pas de rAF si pas nécessaire)
- Réserver un budget de ~10 ms/frame pour l'upload GPU
- Utiliser `gl.initTexture` par lots de 32-64 si la frame n'est pas visible
- Classifier les textures par priorité : textures visibles depuis le spawn en premier

#### R3 — Streaming préemptif directionnel
**Problème :** La priorité de chargement ignore la direction du regard  
**Solution :**
- Dans `Tick()`, pondérer la distance par `max(0, dot(cameraDir, chunkDir))`²
- Les chunks dans le champ de vision sont chargés en priorité
- Les chunks derrière le joueur peuvent être dégradés (low quality) ou déchargés plus tôt

#### R4 — LOD progressif des chunks
**Problème :** Pas de LOD, juste binaire chargé/déchargé  
**Solution :**
- À mi-distance, réduire la résolution des textures (utiliser les variantes `.low.glb`/`.med.glb`)
- Pour les chunks FAR (au-delà de 60m selon distanceBand), désactiver les ombres
- Ajouter un `LOD` group Three.js par chunk avec 2-3 niveaux de détail

### 6.2 MOYENNE — Améliorations significatives

#### R5 — Pool mémoire C++ fixe pour le streaming
**Problème :** Allocation dynamique à chaque `Tick()`  
**Solution :**
- Remplacer `std::vector<DistEntry>` par un tableau fixe de `MAX_CHUNKS` (32)
- Si le nombre de chunks dépasse, fallback sur tableau dynamique ou diviser en batches

#### R6 — BVH avec Surface Area Heuristic
**Problème :** Median split → arbre sous-optimal  
**Solution :**
- Implémenter SAH (Surface Area Heuristic) dans `BVH::Build`
- Réduit le nombre de nœuds visités par raycast de 30-50%
- Coût unique au build (lors du chargement de la map)

#### R7 — Cache de temporal coherence pour raycast WASM
**Problème :** Pas de cache entre frames  
**Solution :**
- Si le joueur n'a pas bougé de plus de 0.1 unité, réutiliser les résultats de raycast de la frame précédente
- Implémenter un « hit cache » pour les raycast down (sol) — le sol change rarement entre frames

#### R8 — Découplage upload GPU / frame de rendu
**Problème :** L'upload GPU des textures peut causer des micro-freezes  
**Solution :**
- Forcer l'upload dans un render target offscreen (renderer.setRenderTarget) pendant le chargement
- Utiliser `gl.getContext().getParameter(webgl?.MAX_TEXTURE_SIZE)` pour downsample adaptatif

#### R9 — `SegmentBlocked` C++ réécriture du delta
**Problème :** Dans `CollisionSystem::SegmentBlocked`, `delta` est défini deux fois (bug potentiel)  
**Solution :**
- Déplacer `delta` et `dir` en haut de la fonction avant la branche if/else
- Remplacer la déclaration du second `delta` par une affectation directe

### 6.3 BASSE — Optimisations secondaires

#### R10 — Détection d'immobilité pour le tick streaming
Si le joueur ne bouge pas depuis N ticks → sauter `Tick()` → zéro overhead.

#### R11 — Preload des chunks voisins en idle
Quand le joueur s'arrête, utiliser `requestIdleCallback` pour pré-charger les chunks dans un rayon de 1.5×loadRadius.

#### R12 — Compression des métadonnées IndexedDB
Stocker les ArrayBuffer GLB compressés gzip/brotli dans IndexedDB. Le coût de décompression CPU (~5-10 ms/chunk) peut valoir le gain de bande passante disque.

#### R13 — WeakRef pour les textures auto-material non utilisées
Utiliser `FinalizationRegistry` pour détecter quand un matériau auto-material n'est plus référencé et disposer son shader compilé.

#### R14 — Fusion des fichiers de config auto-material
`autoMaterialConfig.ts`, `autoMaterialStore.ts`, `AutoMaterial.ts` pourraient être fusionnés ou réorganisés pour réduire les imports circulaires.

#### R15 — AssetBudgetBridge activé
L'AssetBudgetManager WASM est initialisé mais les commandes (Preload/Upgrade/Downgrade/Evict) ne sont pas traitées — elles vont dans un callback `onAssetCommand` qui semble inactif. Compléter l'implémentation.

---

## 7. ÉVALUATION DE LA DETTE TECHNIQUE

### 7.1 Par fichier

| Fichier | Lignes | Dette estimée | Problèmes |
|---|---|---|---|
| `StreamingPuzzleMap.tsx` | 1027 | **Élevée** | Monolithe, 3x eslint-disable, 350+ lignes doLoadChunk |
| `AutoMaterial.ts` | 341 | Moyenne | onBeforeCompile fragile, clone coûteux |
| `autoMaterialStore.ts` | 396 | Moyenne | 4 singletons, loadPromise complexe |
| `sharedLoaders.ts` | 157 | Faible | detectSupport jetable, workers fixés |
| `installKtx2Everywhere.ts` | 69 | Faible | Monkey-patch prototype |
| `chunkCache.ts` | 222 | Moyenne | IndexedDB version bump manuel, store partagé |
| `ChunkStreamingManager.cpp` | 164 | Faible | Allocation tick, pas de direction |
| `BVH.cpp` | 306 | Moyenne | Median split, stack 64 fixe |
| `CollisionSystem.cpp` | 288 | **Moyenne** | double delta shadowing, dynamic en O(n) |
| `Bindings.cpp` | 427 | Faible | Scripté — juste des wrappers |
| `CollisionWorld.ts` | 239 | Faible | Hybride mais propre |

### 7.2 Problèmes transversaux

1. **Tests insuffisants** : Seuls `distanceBand.test.ts` et quelques tests materials existent. `StreamingPuzzleMap` n'a pas de test.
2. **Documentation intégrée** : Les commentaires sont très détaillés mais pas externalisés (pas de docs/ séparé).
3. **Monkey-patching global** : `createImageBitmap`, `computeBoundsTree`, `installKtx2Everywhere` — 3 patchs de prototypes/globaux.
4. **Singleton pattern** : `collisionWorld`, `streamingDiagnostics`, `autoMaterialStore` — pas idéal pour le test unitaire.

---

## 8. PLAN D'ACTION PRIORISÉ

| Priorité | Action | Effort | Gain attendu | Composant |
|---|---|---|---|---|
| **P0** | Paralléliser le chargement (R1) | 1j | -40% temps de chargement | StreamingPuzzleMap |
| **P0** | Upload GPU priorisé (R2) | 2j | -60% micro-freezes au chargement | StreamingPuzzleMap |
| **P1** | LOD progressif chunks (R4) | 3j | -50% draw calls à distance | StreamingPuzzleMap |
| **P1** | Streaming directionnel (R3) | 2j | Chargement priorisé dans le champ de vision | ChunkStreamingManager C++ |
| **P1** | Corriger le double `delta` dans SegmentBlocked (R9) | 0.5j | Bug fix | CollisionSystem.cpp |
| **P2** | SAH BVH (R6) | 3j | +30% perf raycast | BVH.cpp |
| **P2** | Pool mémoire streaming (R5) | 0.5j | Zéro alloc/tick | ChunkStreamingManager C++ |
| **P2** | Cache temporal raycast (R7) | 1j | -50% appels raycast redondants | CollisionWorld |
| **P3** | Activer AssetBudgetBridge (R15) | 2j | Gestion VRAM globale fonctionnelle | WasmWorldTicker |
| **P3** | Détection d'immobilité (R10) | 0.5j | -90% appels tick streaming idle | ChunkStreamingManager |
| **P3** | Refactoring tests StreamingPuzzleMap | 3j | Couverture + confiance | Tests |
| **P4** | Fusion config files auto-material (R14) | 1j | Maintenabilité | materials/ |

---

## ANNEXE : Statistiques du projet

| Métrique | Valeur |
|---|---|
| Fichiers analysés | 25+ |
| Lignes de code C++ WASM | ~1500 |
| Lignes de code TypeScript/React (rendu) | ~4000 |
| Nombre de chunks | 8 (forge) / 8 (orbital) |
| Textures KTX2 par chunk | 500-600 |
| VRAM estimée par chunk | ~396 Mo (BC1) |
| Draw calls orbitale (avant chunking) | 25 222 |
| Draw calls orbitale (après chunking) | 737 |
| Auto-material textures | 15 (56 Mo VRAM) |
| Workers Draco/KTX2 | 4 chacun |
| Budget VRAM streaming | 3600 Mo |
| Cache IndexedDB version | 8 |
| Période de transition terrain | 0.18→0.45 pente |
| Taille auto-material tile | 4-12 unités monde |

---

*Rapport généré par l'Équipe AMÉLIORATIONS RENDU — 10 agents d'analyse.*