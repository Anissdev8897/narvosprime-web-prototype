/**
 * ChunkWorkerPool — Pool de Web Workers pour le chargement de chunks.
 *
 * Gère un pool de workers qui chargent les GLB en parallèle.
 * Les workers effectuent le fetch réseau et transfèrent le buffer
 * au main thread via transferList (zero-copy).
 *
 * Avantages :
 *  - Fetch réseau déchargé du main thread
 *  - Parse GLB partiel (analyse d'en-tête) fait hors main thread
 *  - Transfert zero-copy du ArrayBuffer
 *  - Pool sizing automatique (hardwareConcurrency)
 *
 * Utilisation :
 *   const pool = new ChunkWorkerPool();
 *   const result = await pool.loadChunk(url, id);
 *   // result.buffer est l'ArrayBuffer prêt pour GLTFLoader.parse()
 *   pool.terminate(); // nettoyage
 */

export interface ChunkLoadResult {
  id: number;
  buffer?: ArrayBuffer;
  error?: string;
  loadMs: number;
  fetchMs: number;
  /** Métadonnées extraites par le worker (en-tête GLB) */
  header?: Record<string, unknown>;
}

export interface ChunkWorkerPoolOptions {
  /** Nombre de workers (défaut: hardwareConcurrency - 1) */
  size?: number;
  /** Timeout par défaut pour chaque fetch (ms) */
  timeout?: number;
}

type PendingRequest = {
  resolve: (result: ChunkLoadResult) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class ChunkWorkerPool {
  private workers: Worker[] = [];
  private pending = new Map<number, PendingRequest>();
  private nextId = 1;
  private terminated = false;
  private readonly timeoutMs: number;

  constructor(options: ChunkWorkerPoolOptions = {}) {
    const size = options.size ?? Math.max(1, (navigator.hardwareConcurrency || 4) - 1);
    this.timeoutMs = options.timeout ?? 60_000;

    for (let i = 0; i < size; i++) {
      this.spawnWorker(i);
    }
  }

  private spawnWorker(index: number): void {
    try {
      const worker = new Worker(
        new URL('./ChunkWorker.worker.ts', import.meta.url),
        { type: 'module' },
      );

      worker.onmessage = (e: MessageEvent) => {
        const msg = e.data;
        if (msg.type === 'loaded') {
          this.handleLoaded(msg as ChunkLoadResult & { buffer?: ArrayBuffer });
        }
      };

      worker.onerror = (err) => {
        console.error(`[ChunkWorkerPool] Worker ${index} error:`, err.message);
        // Remplacer le worker défaillant
        worker.terminate();
        if (!this.terminated) {
          this.spawnWorker(index);
        }
      };

      this.workers.push(worker);
    } catch (err) {
      console.warn(`[ChunkWorkerPool] Échec création worker ${index}:`, err);
    }
  }

  private handleLoaded(msg: ChunkLoadResult & { buffer?: ArrayBuffer }): void {
    const pending = this.pending.get(msg.id);
    if (!pending) return;
    this.pending.delete(msg.id);
    clearTimeout(pending.timer);

    if (msg.error) {
      pending.resolve({
        id: msg.id,
        error: msg.error,
        loadMs: msg.loadMs,
        fetchMs: msg.fetchMs ?? 0,
        header: msg.header,
      });
    } else {
      pending.resolve({
        id: msg.id,
        buffer: msg.buffer,
        loadMs: msg.loadMs,
        fetchMs: msg.fetchMs ?? 0,
        header: msg.header,
      });
    }
  }

  /**
   * Charge un chunk via le pool de workers.
   * Retourne le buffer ArrayBuffer prêt pour GLTFLoader.parse().
   */
  loadChunk(url: string, fallbackUrl?: string): Promise<ChunkLoadResult> {
    return this.loadChunkWithId(url, this.nextId++, fallbackUrl);
  }

  private loadChunkWithId(url: string, id: number, fallbackUrl?: string): Promise<ChunkLoadResult> {
    if (this.terminated) {
      return Promise.reject(new Error('ChunkWorkerPool terminé'));
    }

    const worker = this.getNextWorker();
    if (!worker) {
      // Fallback: chargement direct sur le main thread
      return this.mainThreadFallback(url, id, fallbackUrl);
    }

    return new Promise<ChunkLoadResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        // Fallback vers main thread après timeout
        this.mainThreadFallback(url, id, fallbackUrl).then(resolve).catch(reject);
      }, this.timeoutMs);

      this.pending.set(id, { resolve, reject, timer });

      worker.postMessage({
        type: 'load',
        id,
        url,
        fallbackUrl,
        timeout: this.timeoutMs,
      });
    });
  }

  private getNextWorker(): Worker | null {
    if (this.workers.length === 0) return null;
    // Round-robin simple
    const idx = this.nextId % this.workers.length;
    return this.workers[idx];
  }

  /**
   * Fallback: chargement direct sur le main thread si les workers sont
   * indisponibles (environnement non-support, erreur de création).
   */
  private async mainThreadFallback(
    url: string,
    id: number,
    fallbackUrl?: string,
  ): Promise<ChunkLoadResult> {
    const t0 = performance.now();
    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        if (fallbackUrl) {
          const fb = await fetch(fallbackUrl);
          if (!fb.ok) throw new Error(`HTTP ${resp.status} (fallback: ${fb.status})`);
          const buffer = await fb.arrayBuffer();
          return { id, buffer, loadMs: performance.now() - t0, fetchMs: performance.now() - t0 };
        }
        throw new Error(`HTTP ${resp.status}`);
      }
      const buffer = await resp.arrayBuffer();
      return { id, buffer, loadMs: performance.now() - t0, fetchMs: performance.now() - t0 };
    } catch (err) {
      return {
        id,
        error: err instanceof Error ? err.message : String(err),
        loadMs: performance.now() - t0,
        fetchMs: 0,
      };
    }
  }

  /** Nombre de workers actifs */
  get size(): number {
    return this.workers.length;
  }

  /** Pending requests */
  get pendingCount(): number {
    return this.pending.size;
  }

  /** Termine tous les workers et libère les ressources. */
  terminate(): void {
    this.terminated = true;
    for (const w of this.workers) {
      w.terminate();
    }
    this.workers = [];
    // Rejeter les pending
    for (const [id, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new Error('ChunkWorkerPool terminé'));
    }
    this.pending.clear();
  }
}
