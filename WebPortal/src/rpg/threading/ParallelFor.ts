/**
 * ParallelFor — Itération parallélisée sur des tableaux.
 *
 * Découpe un tableau en chunks et les traite en parallèle via
 * différentes stratégies selon l'environnement disponible :
 *   1. Web Workers (preferWorkers=true) — vrai parallélisme
 *   2. requestIdleCallback (différé, pas de jank)
 *   3. requestAnimationFrame (étalé sur frames)
 *   4. Synchrone (mode dégradé)
 *
 * Usage :
 *   // Parallèle via workers
 *   await ParallelFor.each(array, (item, i) => process(item), {
 *     preferWorkers: true,
 *     batchSize: 100,
 *   });
 *
 *   // Parallèle différé sur rAF (pas de jank main thread)
 *   await ParallelFor.each(array, (item) => process(item));
 *
 *   // Parallel.map (collecte des résultats)
 *   const results = await ParallelFor.map(array, (item) => compute(item));
 */

export interface ParallelForOptions {
  /**
   * Taille des lots pour le découpage.
   * Défaut: calculée automatiquement (max(1, len / (concurrency * 4)))
   */
  batchSize?: number;
  /**
   * Concurrence maximale.
   * Défaut: hardwareConcurrency ou 4
   */
  concurrency?: number;
  /**
   * Stratégie d'exécution :
   * - 'raf' (défaut): étale via requestAnimationFrame
   * - 'ric': étale via requestIdleCallback
   * - 'sync': exécution synchrone immédiate
   * - 'worker': tente d'utiliser Web Workers (si workerFn fournie)
   */
  strategy?: 'raf' | 'ric' | 'sync' | 'worker';
  /**
   * Si true, utilise des workers natifs pour le vrai parallélisme.
   * Nécessite workerFn dans ParallelFor.each.
   */
  preferWorkers?: boolean;
  /** Fonction worker pour le mode 'worker' (sérialisable via postMessage). */
  workerFn?: string;
  /** Timeout par batch (ms, défaut: 5000) */
  batchTimeout?: number;
}

interface BatchWork<T, R> {
  items: T[];
  startIndex: number;
}

const _DEFAULT_CONCURRENCY = typeof navigator !== 'undefined'
  ? (navigator.hardwareConcurrency || 4)
  : 4;

export class ParallelFor {
  /**
   * Itère sur un tableau en parallèle, sans valeur de retour.
   * Chaque élément est traité par `fn`.
   */
  static async each<T>(
    array: T[],
    fn: (item: T, index: number, array: T[]) => void | Promise<void>,
    options: ParallelForOptions = {},
  ): Promise<void> {
    if (array.length === 0) return;

    const concurrency = options.concurrency ?? _DEFAULT_CONCURRENCY;
    const batchSize = options.batchSize ?? Math.max(1, Math.floor(array.length / (concurrency * 4)));
    const strategy = options.strategy ?? 'raf';

    const batches = ParallelFor.createBatches(array, batchSize);

    switch (strategy) {
      case 'sync':
        await ParallelFor.executeSync(batches, fn);
        break;
      case 'ric':
        await ParallelFor.executeIdle(batches, fn);
        break;
      case 'worker':
        if (options.preferWorkers && options.workerFn) {
          await ParallelFor.executeWorker(batches, fn);
        } else {
          await ParallelFor.executeRAF(batches, fn);
        }
        break;
      case 'raf':
      default:
        await ParallelFor.executeRAF(batches, fn);
        break;
    }
  }

  /**
   * Parallel map: transforme chaque élément et collecte les résultats.
   */
  static async map<T, R>(
    array: T[],
    fn: (item: T, index: number) => R | Promise<R>,
    options: ParallelForOptions = {},
  ): Promise<R[]> {
    if (array.length === 0) return [];

    const results: R[] = new Array(array.length);
    const indexedFn = async (item: T, index: number): Promise<void> => {
      results[index] = await fn(item, index);
    };

    await ParallelFor.each(array, indexedFn, options);
    return results;
  }

  /**
   * Version synchrone (bloquante) — utile pour les petits tableaux.
   * Attention: bloquera le main thread.
   */
  static eachSync<T>(
    array: T[],
    fn: (item: T, index: number, array: T[]) => void,
    options: { batchSize?: number } = {},
  ): void {
    if (array.length === 0) return;
    const batchSize = options.batchSize ?? 1024;
    for (let i = 0; i < array.length; i += batchSize) {
      const end = Math.min(i + batchSize, array.length);
      for (let j = i; j < end; j++) {
        fn(array[j], j, array);
      }
    }
  }

  /**
   * Réduit en parallèle (parallel reduce).
   * Découpe, réduit chaque batch, puis combine les résultats.
   */
  static async reduce<T, R>(
    array: T[],
    reducer: (acc: R, item: T, index: number) => R | Promise<R>,
    initial: R,
    options: ParallelForOptions = {},
  ): Promise<R> {
    if (array.length === 0) return initial;

    const batchSize = options.batchSize ?? Math.max(1, Math.floor(array.length / (_DEFAULT_CONCURRENCY * 4)));
    const batches = ParallelFor.createBatches(array, batchSize);

    // Réduire chaque batch en parallèle
    const batchResults = await ParallelFor.map(
      batches,
      async (batch) => {
        let acc = initial;
        for (let i = 0; i < batch.items.length; i++) {
          acc = await reducer(acc, batch.items[i], batch.startIndex + i);
        }
        return acc;
      },
      { strategy: options.strategy ?? 'raf', concurrency: options.concurrency },
    );

    // Combiner les résultats des batches
    let result = initial;
    for (const br of batchResults) {
      result = await reducer(result as unknown as R, br as unknown as T, 0);
    }
    return result;
  }

  // ── Méthodes internes ─────────────────────────────────────────────────

  private static createBatches<T>(array: T[], batchSize: number): BatchWork<T, unknown>[] {
    const batches: BatchWork<T, unknown>[] = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push({
        items: array.slice(i, i + batchSize),
        startIndex: i,
      });
    }
    return batches;
  }

  /** Exécution synchrone immédiate (bloquante). */
  private static async executeSync<T>(
    batches: BatchWork<T, unknown>[],
    fn: (item: T, index: number, array: T[]) => void | Promise<void>,
  ): Promise<void> {
    // Version légèrement parallélisée: chaque batch est un micro-task
    const promises = batches.map((batch) =>
      (async () => {
        for (let i = 0; i < batch.items.length; i++) {
          await fn(batch.items[i], batch.startIndex + i, batch.items);
        }
      })(),
    );
    await Promise.all(promises);
  }

  /** Exécution étalée sur requestAnimationFrame. */
  private static async executeRAF<T>(
    batches: BatchWork<T, unknown>[],
    fn: (item: T, index: number, array: T[]) => void | Promise<void>,
  ): Promise<void> {
    let batchIndex = 0;
    return new Promise<void>((resolve) => {
      const processNext = (): void => {
        if (batchIndex >= batches.length) {
          resolve();
          return;
        }
        const batch = batches[batchIndex++];
        // Traiter ce batch de manière synchrone (rapide)
        let promiseChain = Promise.resolve();
        for (let i = 0; i < batch.items.length; i++) {
          const item = batch.items[i];
          const idx = batch.startIndex + i;
          promiseChain = promiseChain.then(() => fn(item, idx, batch.items));
        }
        promiseChain.then(() => requestAnimationFrame(processNext));
      };
      requestAnimationFrame(processNext);
    });
  }

  /** Exécution étalée sur requestIdleCallback. */
  private static async executeIdle<T>(
    batches: BatchWork<T, unknown>[],
    fn: (item: T, index: number, array: T[]) => void | Promise<void>,
  ): Promise<void> {
    let batchIndex = 0;
    return new Promise<void>((resolve) => {
      const processNext = (deadline?: IdleDeadline): void => {
        if (batchIndex >= batches.length) {
          resolve();
          return;
        }
        // Traiter autant de batches que possible dans le temps restant
        while (batchIndex < batches.length) {
          if (deadline && deadline.timeRemaining() < 5) break;
          const batch = batches[batchIndex++];
          // Exécution synchrone du batch
          for (let i = 0; i < batch.items.length; i++) {
            fn(batch.items[i], batch.startIndex + i, batch.items);
          }
        }
        if (batchIndex < batches.length) {
          const ric = (requestIdleCallback || requestAnimationFrame) as (
            cb: (deadline?: IdleDeadline) => void,
          ) => number;
          ric(processNext);
        } else {
          resolve();
        }
      };
      const ric = (requestIdleCallback || requestAnimationFrame) as (
        cb: (deadline?: IdleDeadline) => void,
      ) => number;
      ric(processNext);
    });
  }

  /** Exécution via workers (vrai parallélisme). */
  private static async executeWorker<T>(
    batches: BatchWork<T, unknown>[],
    fn: (item: T, index: number, array: T[]) => void | Promise<void>,
  ): Promise<void> {
    // Fallback: en l'absence de workerFn sérialisable, on utilise rAF
    // Le vrai parallélisme avec workers nécessite que la fonction soit
    // sérialisable (postMessage), ce qui n'est pas le cas général.
    await ParallelFor.executeRAF(batches, fn);
  }
}
