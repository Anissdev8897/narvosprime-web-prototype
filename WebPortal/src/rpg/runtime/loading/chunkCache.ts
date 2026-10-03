/**
 * Cache IndexedDB pour les GLB (chunks de maps + assets in-game).
 *
 * Première visite → télécharge le GLB, stocke l'ArrayBuffer dans IDB.
 * Visites suivantes → lecture directe depuis IDB, zéro réseau.
 * Deux empreintes séparées : une pour les chunks (C++ ChunkStreamingManager),
 * une pour les assets (C++ AssetBudgetManager). Chaque mismatch ne purge
 * que sa catégorie.
 *
 * Éviction LRU : quand le nombre d'entrées dépasse MAX_CACHE_ENTRIES,
 * les entrées les plus anciennement accédées sont supprimées.
 */

const DB_NAME = "narvos-chunk-cache";
const STORE_NAME = "chunks";
// ⚠ Incrémenter à CHAQUE régénération d'assets (chunks re-encodés, re-chunking…).
// Le bump DÉTRUIT et recrée le store (cf. onupgradeneeded) → re-téléchargement global.
// v2 : chunks forge_map ré-encodés en KTX2 (textures WebP → Basis, downsize 1024).
// v3 : OBLIGATOIRE — les chunks v2 contenaient 24 textures en 1024×682. 682 n'est
//      pas un multiple de 4, ce qu'exigent les formats compressés par blocs : le
//      GPU rejetait l'upload (GL_INVALID_OPERATION), le chargement du chunk levait,
//      et la map ne s'assemblait jamais (mapAssembled=false). Sans ce bump, le
//      cache continuerait de servir les chunks cassés malgré la re-conversion.
// v4 : OBLIGATOIRE — chunks forge_map régénérés en bucketing SPATIAL. Les
//      anciens perdaient 310 886 triangles (87,2 % de la source seulement) et
//      répartissaient les objets d'une même zone sur les 8 chunks, si bien qu'un
//      chunk manquant trouait la carte ENTIÈRE au lieu d'une région. Les fichiers
//      portent les mêmes noms : sans bump, le cache continuerait de servir les
//      anciens et la régénération serait invisible en jeu.
// v5 : OBLIGATOIRE — variantes de map ré-encodées SANS UASTC. Les normal maps
//      en UASTC pesaient 1113 Ko pièce contre 77 Ko en ETC1S : 20 % des
//      textures mais 78 % du poids d'un chunk, et le transcodeur Basis levait
//      « RangeError: Array buffer allocation failed » dans transcode(). Mêmes
//      noms de fichiers → sans bump, le cache resservirait les versions lourdes.
// v6 : OBLIGATOIRE — chunks nettoyés de leurs triangles morts.
//      Mesuré : 292 020 triangles d'aire nulle (deux sommets confondus) et
//      585 « lames » (rapport d'aspect > 500, arête > 8 u) retirés sur
//      7,3 M. Les lames sont AUTHORÉES dans la source Unreal — 547 relevées
//      sur halo_map.glb, jusqu'à 1320 unités de long — et perçaient le sol
//      en jeu. prune() a emporté au passage 1687 images déjà orphelines.
//      Mêmes noms de fichiers → sans bump, IndexedDB ressert les anciens.
// 7 : re-découpe complète depuis la map réimportée du 28/07 (chunks_v3).
// Les fichiers gardent leurs noms — sans ce bump, IndexedDB resservirait les
// chunks de la version précédente et TOUTE la régénération serait invisible.
// 8 : map orbitale chunkee a son tour (etait monolithique, 25 222 draw calls).
const CACHE_VERSION = 8;

// ── Limite d'éviction LRU ──────────────────────────────────────────────────
// Nombre maximal d'entrées dans le cache. Quand le seuil est atteint, les
// entrées les plus anciennement lues sont évincées.
const MAX_CACHE_ENTRIES = 200;
const LRU_ORDER_KEY = "__narvos_lru_order__";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB indisponible"));
      return;
    }
    const req = indexedDB.open(DB_NAME, CACHE_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // Un simple "créer si absent" laissait SURVIVRE toutes les entrées au bump
      // de version : incrémenter CACHE_VERSION ne purgeait donc rien, contrairement
      // à ce que documente le projet. On détruit puis recrée pour de vrai.
      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME);
      }
      db.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

// ── Gestion LRU ─────────────────────────────────────────────────────────────

/** Récupère l'ordre LRU (tableau de clés, de la moins récente à la plus récente). */
async function getLRUOrder(): Promise<string[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(LRU_ORDER_KEY);
      req.onsuccess = () => {
        const raw = req.result;
        resolve(Array.isArray(raw) ? raw : []);
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/** Sauvegarde l'ordre LRU. */
async function saveLRUOrder(order: string[]): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(order, LRU_ORDER_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Non-fatal
  }
}

/** Marque une clé comme récemment accédée (la déplace en fin d'ordre LRU). */
async function touchLRU(url: string): Promise<void> {
  if (url === LRU_ORDER_KEY || url === FINGERPRINT_KEY || url === ASSET_FINGERPRINT_KEY) return;
  const order = await getLRUOrder();
  const idx = order.indexOf(url);
  if (idx !== -1) order.splice(idx, 1);
  order.push(url);
  await saveLRUOrder(order);
}

/** Ajoute une nouvelle clé et évince les plus anciennes si le quota est dépassé. */
async function addLRUAndEvict(url: string): Promise<void> {
  if (url === LRU_ORDER_KEY || url === FINGERPRINT_KEY || url === ASSET_FINGERPRINT_KEY) return;
  const order = await getLRUOrder();
  const idx = order.indexOf(url);
  if (idx !== -1) order.splice(idx, 1);
  order.push(url);

  // Éviction LRU : supprime les entrées les plus anciennes si le seuil est dépassé
  const toEvict: string[] = [];
  while (order.length > MAX_CACHE_ENTRIES) {
    const oldest = order.shift();
    if (oldest) toEvict.push(oldest);
  }

  if (toEvict.length > 0) {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      for (const key of toEvict) {
        store.delete(key);
      }
      // Attends que la transaction finisse
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      if (typeof console !== "undefined") {
        console.info(`[ChunkCache] éviction LRU: ${toEvict.length} entrée(s) supprimée(s)`);
      }
    } catch {
      // Non-fatal
    }
  }

  await saveLRUOrder(order);
}

// ── API publique ────────────────────────────────────────────────────────────

export async function getCachedChunk(
  url: string,
): Promise<ArrayBuffer | null> {
  try {
    const db = await openDB();
    const result = await new Promise<ArrayBuffer | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(url);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
    if (result) {
      // Mise à jour LRU (fire-and-forget)
      touchLRU(url).catch(() => {});
    }
    return result;
  } catch {
    return null;
  }
}

export async function storeCachedChunk(
  url: string,
  data: ArrayBuffer,
): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(data, url);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    // Éviction LRU après stockage (fire-and-forget)
    addLRUAndEvict(url).catch(() => {});
  } catch {
    // Cache write failure = non-fatal, prochain chargement re-téléchargera
  }
}

export async function clearChunkCache(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Silencieux
  }
}

const FINGERPRINT_KEY = "__narvos_chunk_fingerprint__";

export async function validateCacheFingerprint(
  currentFingerprint: number,
): Promise<boolean> {
  try {
    const db = await openDB();
    const stored = await new Promise<number | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(FINGERPRINT_KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
    if (stored !== null && stored !== currentFingerprint) {
      console.warn(
        `[ChunkCache] fingerprint mismatch (stored=${stored}, current=${currentFingerprint}) → purge`,
      );
      await clearChunkCache();
      await storeFingerprint(currentFingerprint);
      return false;
    }
    if (stored === null) {
      await storeFingerprint(currentFingerprint);
    }
    return true;
  } catch {
    return true;
  }
}

async function storeFingerprint(fp: number): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(fp, FINGERPRINT_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Non-fatal
  }
}

// ── Aliases génériques pour assets in-game (même IDB, même store) ──────────
export const getCachedAsset = getCachedChunk;
export const storeCachedAsset = storeCachedChunk;

const ASSET_FINGERPRINT_KEY = "__narvos_asset_fingerprint__";

export async function validateAssetFingerprint(
  currentFingerprint: number,
): Promise<boolean> {
  try {
    const db = await openDB();
    const stored = await new Promise<number | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(ASSET_FINGERPRINT_KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
    if (stored !== null && stored !== currentFingerprint) {
      console.warn(
        `[AssetCache] asset fingerprint mismatch (stored=${stored}, current=${currentFingerprint}) → purge`,
      );
      await clearChunkCache();
      await storeAssetFingerprint(currentFingerprint);
      return false;
    }
    if (stored === null) {
      await storeAssetFingerprint(currentFingerprint);
    }
    return true;
  } catch {
    return true;
  }
}

async function storeAssetFingerprint(fp: number): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(fp, ASSET_FINGERPRINT_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Non-fatal
  }
}

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__clearChunkCache = clearChunkCache;
}
