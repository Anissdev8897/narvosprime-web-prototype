/**
 * TaskGraph — Planificateur de tâches avec priorité et dépendances.
 *
 * Système de task-graph orienté async pour ordonnancer des opérations
 * (chargement, calcul, upload GPU) avec :
 *   - Priorité numérique (plus haut = plus urgent)
 *   - Dépendances entre tâches (une tâche attend que ses dépendances finissent)
 *   - Concurrence maximale configurable
 *   - File d'attente triée par priorité (heap)
 *
 * Usage :
 *   const graph = new TaskGraph({ maxConcurrency: 4 });
 *
 *   // Tâche simple
 *   graph.add('task1', () => fetch('/data'), { priority: 10 });
 *
 *   // Tâche avec dépendance
 *   graph.add('task2', (results) => process(results.get('task1')), {
 *     priority: 5,
 *     dependsOn: ['task1'],
 *   });
 *
 *   // Attendre tout
 *   await graph.whenAll();
 */

export interface TaskGraphOptions {
  /** Nombre maximum de tâches exécutées simultanément (défaut: 2) */
  maxConcurrency?: number;
}

export interface TaskOptions {
  /** Priorité : plus haut = plus urgent (défaut: 0) */
  priority?: number;
  /** IDs des tâches dont celle-ci dépend */
  dependsOn?: string[];
  /** Timeout en ms (défaut: aucun) */
  timeout?: number;
  /** Label pour le diagnostic */
  label?: string;
}

export interface TaskInfo {
  id: string;
  label: string;
  priority: number;
  dependsOn: string[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  /** Timestamps */
  addedAt: number;
  startedAt?: number;
  completedAt?: number;
  /** Résultat ou erreur */
  error?: string;
}

type TaskFn<T = unknown> = (results: Map<string, unknown>) => T | Promise<T>;

interface InternalTask {
  id: string;
  label: string;
  fn: TaskFn;
  priority: number;
  dependsOn: string[];
  timeout?: number;
  addedAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
}

export class TaskGraph {
  private tasks = new Map<string, InternalTask>();
  private results = new Map<string, unknown>();
  private running = new Set<string>();
  private completed = new Set<string>();
  private failed = new Set<string>();
  private readyQueue: InternalTask[] = [];
  private maxConcurrency: number;
  private _allPromise: Promise<void> | null = null;
  private _resolveAll: (() => void) | null = null;

  constructor(options: TaskGraphOptions = {}) {
    this.maxConcurrency = options.maxConcurrency ?? 2;
  }

  /**
   * Ajoute une tâche au graphe.
   * Retourne une Promise qui résout quand la tâche est terminée.
   */
  add<T = unknown>(
    id: string,
    fn: TaskFn<T>,
    options: TaskOptions = {},
  ): Promise<T> {
    if (this.tasks.has(id)) {
      throw new Error(`TaskGraph: tâche dupliquée "${id}"`);
    }

    return new Promise<T>((resolve, reject) => {
      const task: InternalTask = {
        id,
        label: options.label ?? id,
        fn: fn as TaskFn,
        priority: options.priority ?? 0,
        dependsOn: options.dependsOn ?? [],
        timeout: options.timeout,
        addedAt: performance.now(),
        resolve: resolve as (value: unknown) => void,
        reject,
      };

      this.tasks.set(id, task);

      // Vérifier les dépendances cycliques
      if (this.hasCycle(id)) {
        this.tasks.delete(id);
        reject(new Error(`TaskGraph: dépendance cyclique détectée pour "${id}"`));
        return;
      }

      this.scheduleReady();
    });
  }

  /**
   * Vérifie si une tâche est prête (toutes ses dépendances sont complétées).
   */
  private isReady(task: InternalTask): boolean {
    if (this.running.has(task.id) || this.completed.has(task.id)) return false;
    for (const depId of task.dependsOn) {
      if (!this.completed.has(depId)) return false;
    }
    return true;
  }

  private _scheduled = false;

  private rebuildReadyQueue(): void {
    this.readyQueue = [];
    for (const task of Array.from(this.tasks.values())) {
      if (this.isReady(task)) {
        this.readyQueue.push(task);
      }
    }
    // Trier par priorité (descendant)
    this.readyQueue.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Ordonnance les tâches prêtes dans la limite de concurrence.
   * Accumule les appels via un micro-task pour éviter les drainings redondants
   * pendant l'ajout en masse.
   */
  private scheduleReady(): void {
    if (!this._scheduled) {
      this._scheduled = true;
      void Promise.resolve().then(() => {
        this._scheduled = false;
        this.rebuildReadyQueue();
        this.drain();
      });
    }
  }

  /**
   * Exécute les tâches prêtes dans la limite de concurrence.
   */
  private drain(): void {
    while (this.readyQueue.length > 0 && this.running.size < this.maxConcurrency) {
      const task = this.readyQueue.shift()!;
      if (this.completed.has(task.id) || this.running.has(task.id)) continue;
      this.executeTask(task);
    }
  }

  /**
   * Exécute une tâche individuelle.
   */
  private async executeTask(task: InternalTask): Promise<void> {
    this.running.add(task.id);
    task.startedAt = performance.now();

    const execPromise = (async () => {
      const result = await task.fn(this.results);
      return result;
    })();

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;

    if (task.timeout && task.timeout > 0) {
      timeoutHandle = setTimeout(() => {
        timedOut = true;
        const err = new Error(`TaskGraph: timeout "${task.id}" après ${task.timeout}ms`);
        task.reject(err);
        task.error = err.message;
        task.completedAt = performance.now();
        this.failed.add(task.id);
        this.running.delete(task.id);
        // Nettoyer sans attendre checkAllDone
      }, task.timeout);
    }

    try {
      const result = await execPromise;
      if (timedOut) return; // déjà rejeté par le timeout

      clearTimeout(timeoutHandle);
      this.results.set(task.id, result);
      this.completed.add(task.id);
      this.running.delete(task.id);
      task.resolve(result);
      task.completedAt = performance.now();

      // Déclencher les tâches dépendantes
      this.scheduleReady();
      this.checkAllDone();
    } catch (err) {
      if (timedOut) return;
      clearTimeout(timeoutHandle);
      this.failed.add(task.id);
      this.running.delete(task.id);
      const msg = err instanceof Error ? err.message : String(err);
      task.reject(new Error(msg));
      task.error = msg;
      task.completedAt = performance.now();
    }

    // Vérifier si tout est terminé
    this.checkAllDone();
  }

  /**
   * Vérifie si toutes les tâches sont terminées (succès ou échec).
   */
  private checkAllDone(): void {
    if (this.tasks.size === 0) return;
    const allDone = this.completed.size + this.failed.size >= this.tasks.size;
    if (allDone && this._resolveAll) {
      this._resolveAll();
      this._allPromise = null;
    }
  }

  /**
   * Détection de cycles dans le graphe de dépendances.
   */
  private hasCycle(taskId: string): boolean {
    const visited = new Set<string>();
    const stack = new Set<string>();

    const dfs = (id: string): boolean => {
      if (stack.has(id)) return true;
      if (visited.has(id)) return false;
      visited.add(id);
      stack.add(id);

      const task = this.tasks.get(id);
      if (task) {
        for (const dep of task.dependsOn) {
          if (dfs(dep)) return true;
        }
      }

      stack.delete(id);
      return false;
    };

    return dfs(taskId);
  }

  /**
   * Attends que toutes les tâches soient terminées.
   */
  whenAll(): Promise<void> {
    if (this._allPromise) return this._allPromise;
    if (this.tasks.size === 0 || this.completed.size + this.failed.size >= this.tasks.size) {
      return Promise.resolve();
    }
    this._allPromise = new Promise((resolve) => {
      this._resolveAll = resolve;
    });
    return this._allPromise;
  }

  // ── Diagnostics ────────────────────────────────────────────────────────

  /** Liste toutes les tâches avec leur statut */
  snapshot(): TaskInfo[] {
    return Array.from(this.tasks.values()).map((t) => ({
      id: t.id,
      label: t.label,
      priority: t.priority,
      dependsOn: t.dependsOn,
      status: this.failed.has(t.id)
        ? 'failed'
        : this.completed.has(t.id)
          ? 'completed'
          : this.running.has(t.id)
            ? 'running'
            : 'pending' as const,
      addedAt: t.addedAt,
      startedAt: t.startedAt,
      completedAt: t.completedAt,
      error: t.error,
    }));
  }

  /** Nombre de tâches en file d'attente */
  get pendingCount(): number {
    return this.tasks.size - this.completed.size - this.failed.size - this.running.size;
  }

  /** Nombre de tâches en cours */
  get runningCount(): number {
    return this.running.size;
  }

  /** Nombre de tâches terminées */
  get completedCount(): number {
    return this.completed.size;
  }

  /** Nombre de tâches en échec */
  get failedCount(): number {
    return this.failed.size;
  }

  /** Réinitialise le graphe */
  clear(): void {
    this.tasks.clear();
    this.results.clear();
    this.running.clear();
    this.completed.clear();
    this.failed.clear();
    this.readyQueue = [];
    this._resolveAll = null;
    this._allPromise = null;
  }
}
