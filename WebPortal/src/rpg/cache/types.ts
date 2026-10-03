// ══════════════════════════════════════════════════════════════════════════════
// cache/types.ts — Types fondamentaux du système de cache unifié
// ══════════════════════════════════════════════════════════════════════════════

/** Stratégie d'éviction du cache. */
export enum EvictionStrategy {
  /** Least Recently Used — évince l'entrée utilisée le moins récemment. */
  LRU = "lru",
  /** Least Frequently Used — évince l'entrée utilisée le moins fréquemment. */
  LFU = "lfu",
  /** First In, First Out — évince la plus ancienne entrée. */
  FIFO = "fifo",
  /** Time To Live — évince les entrées après un délai configurable. */
  TTL = "ttl",
}

/** Niveau de cache dans la hiérarchie. */
export enum CacheLevel {
  /** Cache mémoire (Map). Rapide, volatil. */
  L1_MEMORY = 1,
  /** Cache persistant (IndexedDB). Lent, persistant. */
  L2_INDEXED_DB = 2,
  /** Cache réseau (fetch). Très lent, toujours disponible. */
  L3_NETWORK = 3,
}

/** Métadonnées internes pour chaque entrée de cache. */
export interface CacheEntryMeta {
  /** Horodatage de création (ms). */
  createdAt: number;
  /** Horodatage du dernier accès (ms). */
  lastAccessedAt: number;
  /** Nombre d'accès (pour LFU). */
  accessCount: number;
  /** Durée de vie en ms (0 = pas de TTL). */
  ttl: number;
}

/** Entrée complète dans le cache. */
export interface CacheEntry<V> {
  value: V;
  meta: CacheEntryMeta;
}

/** Statistiques d'un cache ou d'un niveau. */
export interface CacheStats {
  /** Nombre d'entrées actuellement dans le cache. */
  size: number;
  /** Capacité maximale (0 = illimitée). */
  capacity: number;
  /** Nombre de hits (lectures réussies). */
  hits: number;
  /** Nombre de misses (lectures échouées). */
  misses: number;
  /** Ratio de succès (0-1). */
  hitRate: number;
  /** Nombre d'évictions. */
  evictions: number;
  /** Nombre d'entrées expirées (TTL) nettoyées. */
  expired: number;
}

/** Options de configuration d'un cache. */
export interface CacheOptions {
  /** Capacité maximale (0 = illimitée). */
  capacity?: number;
  /** Stratégie d'éviction. */
  strategy?: EvictionStrategy;
  /** TTL par défaut en ms (0 = pas de TTL). */
  defaultTtl?: number;
  /** Activer les statistiques détaillées. */
  trackStats?: boolean;
  /** Nom du cache (pour debug). */
  name?: string;
}

/** Résultat d'une opération de cache. */
export interface CacheResult<V> {
  value: V | undefined;
  /** Niveau où la valeur a été trouvée, ou undefined si miss. */
  level?: CacheLevel;
  /** Temps d'accès en ms. */
  accessTimeMs: number;
}

/** Interface qu'un niveau de cache (L1, L2, L3) doit implémenter. */
export interface ICacheLevel<K, V> {
  readonly level: CacheLevel;
  readonly name: string;

  get(key: K): Promise<CacheResult<V> | undefined>;
  set(key: K, value: V, ttl?: number): Promise<void>;
  has(key: K): Promise<boolean>;
  delete(key: K): Promise<boolean>;
  clear(): Promise<void>;
  getStats(): CacheStats;
  get size(): Promise<number>;
}

/** Fonction de sérialisation pour le cache IDB. */
export interface Serializer<V> {
  serialize(value: V): unknown;
  deserialize(raw: unknown): V;
}
