/**
 * WasmPthreads — Gestion des pthreads WASM pour calculs IA.
 *
 * Le module WASM Narvos Engine peut être compilé avec le support pthreads
 * pour paralléliser les calculs lourds :
 *   - Environnement Queries (EQS) — évaluation parallèle des tests
 *   - Pathfinding A* — recherche parallèle multi-agent
 *   - Animation blending — squelettes évalués en parallèle
 *   - Collision BVH — raycasts parallèles
 *
 * Activation :
 *   1. Compiler WASM avec NARVOS_PTHREADS=ON :
 *      cd wasm && emcmake cmake -B build -DNARVOS_PTHREADS=ON -DCMAKE_BUILD_TYPE=Release
 *   2. Headers COOP/COEP déjà actifs (vite.config.ts)
 *   3. Ce module configure PTHREAD_POOL_SIZE
 *
 * État actuel :
 *   - NARVOS_PTHREADS=OFF par défaut (CMakeLists.txt ligne 64)
 *   - Activation possible via API ou détection auto
 *
 * Usage :
 *   import { wasmPthreads } from '../threading';
 *   await wasmPthreads.activate();
 *   const poolSize = wasmPthreads.poolSize; // nombre de threads
 */

export interface WasmPthreadsConfig {
  /** Taille du pool de threads (défaut: hardwareConcurrency) */
  poolSize?: number;
  /** Activer automatiquement au chargement du WASM */
  autoActivate?: boolean;
}

export type PthreadsStatus =
  | 'unavailable'   // pthreads non supportés (pas de SharedArrayBuffer)
  | 'disabled'      // compilé sans -pthread
  | 'inactive'      // disponible mais pool pas encore initialisé
  | 'active'        // pool de threads actif
  | 'error';        // erreur d'activation

export class WasmPthreadsManager {
  private _status: PthreadsStatus = 'unavailable';
  private _poolSize = 0;
  private _maxWorkers = 0;

  constructor() {
    this.detectAvailability();
  }

  /**
   * Détecte si l'environnement supporte les pthreads WASM.
   * Les pthreads nécessitent SharedArrayBuffer, donc COOP/COEP.
   */
  private detectAvailability(): void {
    try {
      // SharedArrayBuffer est requis pour les pthreads WASM
      if (typeof SharedArrayBuffer !== 'undefined') {
        this._status = 'inactive';
        this._poolSize = navigator.hardwareConcurrency || 4;
        this._maxWorkers = this._poolSize;
      } else {
        this._status = 'unavailable';
        console.warn('[WasmPthreads] SharedArrayBuffer non disponible — ' +
          'vérifier les en-têtes COOP/COEP');
      }
    } catch {
      this._status = 'unavailable';
    }
  }

  /**
   * Active le pool de threads WASM.
   * Configure PTHREAD_POOL_SIZE via le module WASM s'il est chargé.
   */
  async activate(config: WasmPthreadsConfig = {}): Promise<boolean> {
    if (this._status === 'unavailable') {
      console.warn('[WasmPthreads] Impossible d\'activer : SharedArrayBuffer manquant');
      return false;
    }

    const poolSize = config.poolSize ?? navigator.hardwareConcurrency ?? 4;
    this._poolSize = poolSize;

    // Tenter de configurer le module WASM s'il est déjà chargé
    try {
      // Vérifier si le module WASM Narvos Engine est accessible
      // et configurer PTHREAD_POOL_SIZE
      // Le membre est extrait dans une VARIABLE avant le test `typeof`. En
      // ré-écrivant `(wasmModule as Record<string, unknown>).setPthreadPoolSize`
      // dans l'appel, on recrée une expression neuve : le rétrécissement de type
      // obtenu au test ne la suit pas, et TS voit un `unknown` non appelable.
      const wasmModule = (globalThis as unknown as Record<string, unknown>).NarvosEngine;
      const setPoolSize = (wasmModule as Record<string, unknown> | undefined)?.setPthreadPoolSize;
      if (typeof setPoolSize === 'function') {
        (setPoolSize as (size: number) => void)(poolSize);
      }

      // Définir le nombre de workers pour le module Emscripten
      if (typeof navigator !== 'undefined') {
        // Emscripten lit `navigator.hardwareConcurrency` au démarrage,
        // on peut le surcharger
        Object.defineProperty(navigator, 'hardwareConcurrency', {
          get: () => poolSize,
          configurable: true,
        });
      }

      this._status = 'active';
      console.info(`[WasmPthreads] Pool de ${poolSize} threads activé`);
      return true;
    } catch (err) {
      this._status = 'error';
      console.error('[WasmPthreads] Erreur activation:', err);
      return false;
    }
  }

  /**
   * Redimensionne le pool de threads (si le module le supporte).
   */
  async resize(poolSize: number): Promise<boolean> {
    if (this._status !== 'active') return false;
    this._poolSize = poolSize;
    return this.activate({ poolSize });
  }

  /**
   * Vérifie si les pthreads sont actifs et prêts.
   */
  get isActive(): boolean {
    return this._status === 'active';
  }

  get status(): PthreadsStatus {
    return this._status;
  }

  get poolSize(): number {
    return this._poolSize;
  }

  get maxWorkers(): number {
    return this._maxWorkers;
  }

  /**
   * Résumé diagnostic.
   */
  summary(): string {
    return `WasmPthreads: ${this._status} | pool=${this._poolSize} | max=${this._maxWorkers}`;
  }
}

/** Instance singleton du gestionnaire de pthreads WASM. */
export const wasmPthreads = new WasmPthreadsManager();
