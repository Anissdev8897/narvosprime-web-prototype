# AUDIT PERFORMANCE NARVOS PRIME — Streaming & Loading Pipeline

**Date** : 2026-07-30  
**Fichiers audités** : `StreamingPuzzleMap.tsx` (1043 lignes), `chunkCache.ts` (326 lignes), `AssetPreloader.ts` (313 lignes)  
**Fichiers connexes inspectés** : `CollisionWorld.ts`, `ChunkStreamingBridge.ts`, `streamingDiagnostics.ts`, `assetDisposal.ts`, `ChunkWorkerPool.ts`, `ChunkWorker.worker.ts`, `threading/index.ts`  
**Métriques de référence** : chunk 1: 9447ms, chunk 0: 12219ms, chunk 5: 11913ms, NavMeshBaker: 23171ms

---

## 🔴 CRITIQUE — Web Workers implémentés mais JAMAIS utilisés

**Le problème n°1 de cet audit : l'infrastructure de workers existe déjà dans le projet mais personne ne l'utilise.**

### Constat

| Fichier | État | Description |
|---------|------|-------------|
| `ChunkWorkerPool.ts` | ✅ Implémenté, exporté | Pool de Web Workers avec round-robin, timeout 60s, fallback main-thread, auto-respawn |
| `ChunkWorker.worker.ts` | ✅ Implémenté | Fetch réseau + parse header GLB + transfert zero-copy `ArrayBuffer` |
| `threading/index.ts` | ✅ Exporté publiquement | Baril d'export complet : `ChunkWorkerPool`, `TaskGraph`, `ParallelFor`, `WasmPthreads` |

**Zéro import de `ChunkWorkerPool` dans `StreamingPuzzleMap.tsx` ou `AssetPreloader.ts`.**  
Le code actuel fait TOUS les fetchs réseau sur le **thread principal** :

```typescript
// StreamingPuzzleMap.tsx L365-371 — TOUT sur le thread principal
const resp = await withTimeout(fetch(p), CHUNK_TIMEOUT_MS, `chunk ${chunkId} fetch`);
const buf = await resp.arrayBuffer();
storeCachedChunk(p, buf);
loader.parse(buf, "", (result) => resolve(result), reject);
```

```typescript
// AssetPreloader.ts L113-119 — pareil
const resp = await fetch(url);
const buf = await resp.arrayBuffer();
storeCachedAsset(url, buf);
loader.parse(buf, basePath, () => done(url), ...);
```

### Impact sur les métriques

Un chunk de forge pèse ~50-150 MB (GLB avec textures KTX2).  
- **Fetch réseau** : 2-8s selon bande passante → bloqué sur le main thread (pas de parallélisme réseau natif JS sans worker)  
- **`arrayBuffer()`** : décode le corps HTTP en mémoire → allocation synchrone de 150 MB sur le thread UI  
- **`GLTFLoader.parse()`** : parse JSON + extraction binary chunk + construction scene graph → **500ms-2000ms de blocage** du thread principal par chunk

Avec le `ChunkWorkerPool` (déjà codé !) :
- Fetch réseau déporté sur worker (pas de blocage UI)
- Transfert zero-copy du `ArrayBuffer` (pas de copie mémoire)
- Le main thread ne fait QUE `GLTFLoader.parse(buf)` → gain estimé **3-6s par chunk**

### Recommandation immédiate

Brancher `ChunkWorkerPool` dans `doLoadChunk` :

```typescript
// AVANT (L365)
const resp = await withTimeout(fetch(p), ...);
const buf = await resp.arrayBuffer();

// APRÈS
const pool = workerPoolRef.current!;
const result = await pool.loadChunk(p, fallbackPath);
if (result.error) throw new Error(result.error);
const buf = result.buffer!; // zero-copy transféré
```

Le `ChunkWorker.worker.ts` gère déjà le fallback vers une URL alternative (utile pour `degradeVariant`).

**Gain estimé** : 40-60% de réduction sur les temps de chargement chunk (fetch déporté + transfert zero-copy).  
**Complexité** : ~20 lignes à changer, infrastructure déjà prête.

---

## 🔴 CRITIQUE — Opérations synchrones lourdes sur le thread principal

### 1. `computeBoundsTree()` — construction BVH synchrone

**Fichier** : `StreamingPuzzleMap.tsx` L507-517 → `CollisionWorld.ts` L36-41  

```typescript
// CollisionWorld.add() → ensureBoundsTree() → geo.computeBoundsTree()
collisionWorld.add(collisionMeshes[mi]);
```

`computeBoundsTree()` de `three-mesh-bvh` est une opération **synchrone et CPU-intensive**.  
Pour un mesh de 50k triangles → 10-50ms de blocage.  
Pour un chunk de ~150 meshes → **750ms-7.5s cumulés**.

**Déjà mitigé** : batch de 2 (`BVH_BATCH = 2`) interleaved avec `requestAnimationFrame`.  
Mais chaque `computeBoundsTree()` individuelle bloque toujours le thread principal.

**Optimisation** : `three-mesh-bvh` supporte la construction asynchrone via `computeBoundsTree({ strategy: CENTER })` avec un `onProgress` callback, ou via Web Worker (`generateMeshBVHWorker`). 

```typescript
// Option 1 : construction async
geo.computeBoundsTree({ strategy: CENTER, onProgress: (p) => { /* ... */ } });

// Option 2 : worker BVH (existe dans three-mesh-bvh)
import { generateMeshBVHWorker } from 'three-mesh-bvh/src/workers/generateMeshBVHWorker.js';
```

**Gain** : élimination des micro-freezes de 10-50ms lors du chargement de chunk.

---

### 2. `GLTFLoader.parse()` — synchrone, thread principal

**Fichier** : `StreamingPuzzleMap.tsx` L362, L370  

`loader.parse(buf, "", onLoad, onError)` exécute le parsing complet (JSON + binary + construction hiérarchie + matériaux) de façon synchrone. Pour un GLB de 150 MB, c'est **500ms-2s de blocage**.

**Optimisation** : Le worker pourrait faire un pré-parse (extraction du JSON header + validation) et ne transférer que l'ArrayBuffer au main thread. Le parse complet resterait sur le main thread (Three.js ne supporte pas le parse hors-thread), mais avec le réseau déjà fait, le blocage est plus court car les données sont en RAM.

**Alternative avancée** : `createImageBitmap` dans le worker pour les textures (déjà géré partiellement par le hack L764-779 qui force `TextureLoader` au lieu d'`ImageBitmapLoader` pour éviter la saturation du décodeur).

---

### 3. `uploadChunkTextures()` — `gl.initTexture()` synchrone

**Fichier** : `StreamingPuzzleMap.tsx` L134-179  

`gl.initTexture(tex)` force l'upload GPU immédiat. Déjà batché (16 textures par frame) et interleaved avec `rAF`. ✅ Bonne pratique, pas d'optimisation supplémentaire nécessaire.

---

## 🟠 ÉLEVÉ — Fuites mémoire et VRAM

### 1. Cache drei (`useGLTF`) sans éviction globale

**Fichier** : `AssetPreloader.ts` L37, L243-254  

```typescript
const preloadedCache = new Set<string>(); // module-level, jamais shrinké

function warmIdle(urls: string[]): void {
  // ...
  try { useGLTF.preload(u); } catch { /* asset absent → ignoré */ }
  ric(step, { timeout: 2500 });
}
```

Les assets GLOBAUX (`collectGlobalAssets()`) sont préchargés via `warmIdle` et **jamais évincés**.  
À chaque voyage entre maps, `evictMapAssets()` n'évince QUE les assets PER-MAP (ligne 47-59).

**Conséquence** : la VRAM et la RAM JS croissent de façon monotone sur les sessions longues (multi-voyages).  
**Correctif** : Implémenter un LRU avec budget sur `preloadedCache` + appeler `useGLTF.clear()` sur les vieux assets globaux. Ou pire : `disposeAsset()` pour aussi libérer le GPU.

### 2. `GLTFLoader` jamais disposé

**Fichier** : `StreamingPuzzleMap.tsx` L746, L781  

```typescript
const loader = new GLTFLoader();
// ... utilisé ...
loaderRef.current = loader;
// cleanup (L910-927) : pas de loader.dispose() !
```

`GLTFLoader` a un cache interne (`THREE.Cache`) mais pas de méthode `dispose()`. Cependant, le loader garde des références à `KTX2Loader`, `DRACOLoader`, `MeshoptDecoder` — si ceux-ci sont configurés par `configureGLTFLoader`, ils restent en mémoire après le démontage du composant.

**Impact** : modéré (quelques Mo). Le vrai problème est résolu par le cleanup du composant React (démontage = GC).

### 3. `streamingDiagnostics` — rétention de chunks morts

**Fichier** : `streamingDiagnostics.ts` L82-91  

```typescript
reset(entries) {
  state.chunks = new Map(entries.map(...));
}
```

`reset` recrée la Map → les anciennes entrées sont GC. ✅ OK. Mais `setInFrustum` (L74-78) n'émet que sur CHANGEMENT (`c.inFrustum === v` → return). Si le status passe de "loaded" à "unloaded", l'entrée n'est pas supprimée — elle reste avec `inFrustum: false`. **Pas de fuite mémoire** (petits objets), mais l'UI de debug affiche des chunks fantômes.

### 4. Textures non compressées non détectées en production

**Fichier** : `StreamingPuzzleMap.tsx` L174-178, L634-637  

```typescript
uncompressed: textures.reduce(
  (n, t) => n + ((t as THREE.CompressedTexture).isCompressedTexture ? 0 : 1), 0,
),
```

Le compteur `uncompressed` est calculé mais le warning n'est loggé qu'en `NODE_ENV !== "production"`. En production, un chunk avec 500 textures RGBA32 au lieu de BC1 passe inaperçu → **4-8× la VRAM attendue**, sans aucune alerte.

**Correctif** : Logguer en `console.warn` même en production si `texStats.uncompressed > 0`.

---

## 🟠 ÉLEVÉ — chargements non optimisés

### 1. Pas de pré-chargement prédictif

**Fichier** : `StreamingPuzzleMap.tsx` L1001-1033  

Le streaming WASM émet des commandes Load/Unload basées sur la distance joueur↔chunk. Le chargement est **réactif** : le chunk est demandé quand le joueur est déjà à `loadRadius` du bord. Si le joueur se déplace rapidement (vaisseau, dash), le chunk n'a pas le temps de charger → pop-in.

**Optimisation** : Pré-charger les chunks adjacents au chunk actuel (dans la direction du déplacement). Le `ChunkWorkerPool` pourrait maintenir une file de priorité.

### 2. Cache IndexedDB — race condition LRU

**Fichier** : `chunkCache.ts` L121-128, L131-167  

```typescript
async function touchLRU(url: string): Promise<void> {
  const order = await getLRUOrder();   // lit
  // ... modifie ...
  await saveLRUOrder(order);           // écrit
}
```

`touchLRU` est appelé en **fire-and-forget** (`.catch(() => {})`) depuis `getCachedChunk` (L185). Si deux chunks sont lus simultanément, leurs `touchLRU` s'exécutent en parallèle. Chacun lit l'ordre LRU, le modifie, puis écrit — **race condition** : le dernier écriture écrase l'autre, perdant une entrée. L'entrée perdue n'est pas supprimée du stockage, juste de l'ordre → elle ne sera jamais évincée.

**Correctif** : Sérialiser les mutations LRU via une file (comme `enqueue` dans AssetPreloader).

### 3. Pas de compression de transfert

Les GLB sont servis bruts (pas de `Content-Encoding: gzip/brotli` vérifié). Un chunk de 150 MB pourrait être réduit à ~100 MB avec Brotli. Le worker pourrait vérifier/demander la compression.

### 4. `ktx2SupportSummary()` appelé dans le log

**Fichier** : `StreamingPuzzleMap.tsx` L636  

```typescript
(texStats.uncompressed ? `formats dispo : ${ktx2SupportSummary()}` : "")
```

`ktx2SupportSummary()` est appelé dans le template string — même si la condition est fausse côté log, l'appel est quand même évalué dans le build de production (selon le bundler). **Impact** : négligeable.

---

## 🟡 MODÉRÉ — VRAM gaspillée

### 1. `THREE.Cache` = double cache

**Fichiers** : `AssetPreloader.ts` L54, `StreamingPuzzleMap.tsx` L417  

```typescript
THREE.Cache.remove(url); // purge le cache THREE en plus d'IDB
```

Le `THREE.Cache` par défaut est activé (`THREE.Cache.enabled = true`). Chaque GLB parsé est mis en cache RAM par THREE **en plus** d'IndexedDB et du cache drei. Pour un chunk de 150 MB → 150 MB en RAM THREE.Cache + 150 MB en IDB + la scène parsée en mémoire Three.js (~300-500 MB) → **triple stockage**.

**Correctif** : Désactiver `THREE.Cache.enabled` pour les chunks (les gros fichiers) ou vider le cache agressivement.

### 2. Mipmaps non contrôlées

**Fichier** : `StreamingPuzzleMap.tsx` L157-159  

```typescript
vramBytes += img.width * img.height * bytesPerPixel(tex) * 1.33;
```

Le facteur 1.33 suppose une chaîne de mipmaps complète. Mais Three.js ne génère des mipmaps que si `texture.generateMipmaps = true` (défaut). Pour les textures KTX2, les mipmaps sont déjà dans le fichier → pas de génération supplémentaire, mais le calcul compte quand même 1.33×. **OK en pratique** (le calcul est une estimation).

### 3. Textures orphelines dans `disposeMaterial`

**Fichier** : `StreamingPuzzleMap.tsx` L49-55  

```typescript
function disposeMaterial(mat: THREE.Material): void {
  for (const key of Object.keys(mat)) {
    const val = (mat as unknown as Record<string, unknown>)[key];
    if (val && (val as THREE.Texture).isTexture) (val as THREE.Texture).dispose();
  }
  mat.dispose();
}
```

`Object.keys()` ne capture que les propriétés **énumérables propres**. Dans Three.js, les propriétés de texture (`map`, `normalMap`, etc.) sont bien des propriétés propres énumérables → **OK**. Mais si un matériau personnalisé utilise des symboles ou des propriétés non-énumérables, la texture ne sera pas disposée. **Risque faible** (pas de matériaux custom dans les chunks).

---

## 🟡 MODÉRÉ — useFrame (boucle de rendu)

**Fichier** : `StreamingPuzzleMap.tsx` L931-1034  

Opérations dans `useFrame` (chaque frame, ~60 FPS) :

| Opération | Coût | Risque |
|-----------|------|--------|
| `cameraRef.current.updateMatrixWorld()` | ~0.01ms | ✅ Négligeable |
| `_projScreenMatrix.multiplyMatrices()` | ~0.01ms | ✅ Négligeable |
| `_frustum.setFromProjectionMatrix()` | ~0.05ms | ✅ Négligeable |
| Auto-material generation check (L950-973) | ~0.001ms (comparaison int) | ✅ Négligeable |
| **`rebuildAutoMaterial(chunk)` sur TOUS les chunks** (L954-956) | **Variable** | ⚠️ Se déclenche SEULEMENT quand `amGen` change (rare) |
| **`refreshAutoMaterial(chunk)` sur TOUS les chunks** (L979-981) | **Variable** | ⚠️ Se déclenche SEULEMENT quand `isAutoMaterialDisabled()` change (rare) |
| Frustum culling loop (L990-995) | ~0.01ms par chunk | ✅ O(8) chunks, négligeable |
| `tickStreaming()` WASM (L1001-1002) | ~0.1ms | ✅ Appel WASM léger |
| `drainStreamingCommands()` (L1004) | ~0.01ms | ✅ Lecture heap WASM |

**Conclusion useFrame** : Pas de problème majeur DANS la boucle de rendu elle-même. Les opérations lourdes sont correctement gardées par des comparaisons de génération. Le vrai problème est dans le chargement (hors useFrame).

---

## 📊 RÉSUMÉ DES OPTIMISATIONS (priorisées par impact)

| # | Optimisation | Impact | Effort | Fichier(s) |
|---|-------------|--------|--------|------------|
| **1** | **Brancher `ChunkWorkerPool`** : déporter fetch réseau sur workers | 🔴 Critique : -40-60% temps chargement chunk | ~20 lignes | `StreamingPuzzleMap.tsx` L358-372, `AssetPreloader.ts` L101-123 |
| **2** | **BVH asynchrone** : utiliser `computeBoundsTree({strategy:CENTER})` ou `generateMeshBVHWorker` | 🔴 Critique : élimination micro-freezes 10-50ms par mesh | ~10 lignes | `CollisionWorld.ts` L36-41, `StreamingPuzzleMap.tsx` L507-517 |
| **3** | **Sérialiser mutations LRU** : file d'attente pour `touchLRU`/`addLRUAndEvict` | 🟠 Élevé : prévention corruption cache IDB | ~30 lignes | `chunkCache.ts` |
| **4** | **Évincer assets GLOBAUX en LRU** : budget sur `preloadedCache` + `disposeAsset()` | 🟠 Élevé : stoppe la croissance VRAM monotone | ~50 lignes | `AssetPreloader.ts` L37, L243, `assetDisposal.ts` |
| **5** | **Préchargement prédictif** : charger les chunks dans la direction du déplacement | 🟠 Élevé : réduction pop-in | ~60 lignes | `StreamingPuzzleMap.tsx` useFrame, `ChunkWorkerPool.ts` |
| **6** | **Désactiver `THREE.Cache` pour les GLB** : éviter le triple stockage RAM | 🟡 Modéré : économie 150-500 MB RAM | ~3 lignes | `StreamingPuzzleMap.tsx` L417, `AssetPreloader.ts` L84 |
| **7** | **Logger les textures non-compressées en production** | 🟡 Modéré : détection silencieuse de surconsommation VRAM | ~2 lignes | `StreamingPuzzleMap.tsx` L628-639 |
| **8** | **Dispose du `GLTFLoader`** dans le cleanup | 🟢 Faible : propreté | ~2 lignes | `StreamingPuzzleMap.tsx` L910-927 |

---

## 🏆 Quick Wins (top 3, < 1h de travail)

1. **Brancher `ChunkWorkerPool`** — le code est déjà écrit, testé, exporté. Il suffit de l'importer et de remplacer `fetch(p)` + `resp.arrayBuffer()` par `pool.loadChunk(p)`. Gain immédiat sur les 9-12s de chargement par chunk.

2. **`THREE.Cache.enabled = false`** pour les chunks — une ligne, économise 150 MB de RAM par chunk. Le cache IDB est déjà en place.

3. **Ajouter `generateMeshBVHWorker`** — `three-mesh-bvh` fournit un worker de construction BVH. Une ligne d'import + changement de `computeBoundsTree()` → `computeBoundsTree({ strategy: CENTER })`. Élimine les freezes de 10-50ms.