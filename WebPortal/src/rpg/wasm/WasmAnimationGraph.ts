// ══════════════════════════════════════════════════════════════════════════════
// wasm/WasmAnimationGraph.ts — Pont JS ↔ WASM AnimationGraph
//
// Architecture WASM→JS (unifiée) :
//   WASM décide (blend weights), JS exécute (Three.js AnimationMixer)
//
// Ce bridge :
//   1. Crée un AnimationGraph WASM avec nœuds BlendDirectional
//   2. Chaque frame : envoie params (speed, direction) → WASM
//   3. Lit les décisions de blend (clipName + weight) depuis WASM
//   4. Retourne les décisions à AnimationController pour Three.js
// ══════════════════════════════════════════════════════════════════════════════

import { getEngine } from "./WasmBridge";

/** Taille d'une BlendDecision côté WASM (64 chars nom + 1 f32 weight + 1 f32 timeScale = 72 octets). */
const DECISION_STRIDE = 72; // 64 + 4 + 4 (padding implicit)

/** Décision de blend retournée par le graph WASM. */
export interface BlendDecision {
  clipName: string;
  weight: number;
  timeScale: number;
}

/** Résultat complet de l'évaluation WASM. */
export interface WasmBlendResult {
  /** Décisions de blend (clip + poids). Somme des poids = 1. */
  decisions: BlendDecision[];
  /** Nombre brut de décisions. */
  count: number;
}

/**
 * Pont vers l'AnimationGraph WASM pour les décisions de blend de locomotion.
 *
 * Utilisation :
 * ```ts
 * const wasmGraph = new WasmAnimationGraph();
 * await wasmGraph.init();
 * wasmGraph.configureLocomotion();
 *
 * // Chaque frame :
 * wasmGraph.setParams(speed, direction);
 * const result = wasmGraph.getDecisions();
 * ctrl.setLocomotionFromWasm(result);
 * ```
 */
export class WasmAnimationGraph {
  private graphId = -1;
  private skelId = -1;
  private bufferPtr = 0;
  private bufferCapacity = 0;
  private initialized = false;

  /** Nombre maximal de décisions pouvant être lues (suffisant pour 8 directions × 2 allures). */
  private static readonly MAX_DECISIONS = 32;

  // ── Initialisation ──────────────────────────────────────────────

  /**
   * Initialise le graph WASM. Appeler une fois après le chargement du module WASM.
   * @param boneCount = nombre d'os du squelette (ignoré pour les décisions de blend)
   */
  async init(boneCount = 64): Promise<boolean> {
    const eng = getEngine();
    if (!eng) return false;

    // Crée un squelette minimal (juste pour les bindings)
    this.skelId = eng.animCreateSkeleton();
    if (this.skelId < 0) return false;

    // Finalise la squelette (vide mais valide)
    eng.animFinalizeSkeleton(this.skelId);

    // Crée le graph
    this.graphId = eng.animCreateGraph(this.skelId);
    if (this.graphId < 0) return false;

    // Alloue le buffer de décisions côté WASM
    this.bufferCapacity = WasmAnimationGraph.MAX_DECISIONS;
    this.bufferPtr = eng._malloc(this.bufferCapacity * DECISION_STRIDE);

    this.initialized = true;
    return true;
  }

  /** Configure les nœuds de blend directionnel pour la locomotion. */
  configureLocomotion(): void {
    if (!this.initialized) return;
    const eng = getEngine()!;

    // Nœud directionnel pour la marche
    eng.animGraphAddBlendDirectional?.(
      this.graphId, "locomotion", "walk",
      "speed", "direction",
    );

    // Définit le nœud racine
    eng.animGraphSetRoot(this.graphId, "locomotion");
  }

  /** Nettoie et libère les ressources WASM. */
  dispose(): void {
    const eng = getEngine();
    if (!eng) return;
    if (this.graphId >= 0) eng.animDestroyGraph(this.graphId);
    if (this.skelId >= 0) eng.animDestroySkeleton(this.skelId);
    if (this.bufferPtr > 0) eng._free(this.bufferPtr);
    this.graphId = -1;
    this.skelId = -1;
    this.bufferPtr = 0;
    this.initialized = false;
  }

  // ── Paramètres ─────────────────────────────────────────────────

  /**
   * Met à jour les paramètres d'entrée du graph WASM.
   * @param speed   vitesse normalisée : 0=arrêt, 1=marche, 2=course
   * @param dirDeg  angle de déplacement en degrés (-180..180, 0=avant)
   * @param dt      delta frame (s)
   */
  setParams(speed: number, dirDeg: number, dt: number): void {
    if (!this.initialized) return;
    const eng = getEngine()!;

    eng.animGraphSetParamFloat(this.graphId, "speed", speed);
    eng.animGraphSetParamFloat(this.graphId, "direction", dirDeg);
    eng.animGraphUpdate(this.graphId, dt);
  }

  // ── Lecture des décisions ──────────────────────────────────────

  /**
   * Lit les décisions de blend depuis le WASM.
   * Le buffer WASM contient des entrées de type BlendDecision :
   *   [clipName: 64 chars] [weight: f32] [timeScale: f32]
   */
  getDecisions(): WasmBlendResult {
    if (!this.initialized) {
      return { decisions: [], count: 0 };
    }

    const eng = getEngine()!;
    const count = eng.animGraphGetBlendDecisions?.(
      this.graphId, this.bufferPtr, this.bufferCapacity,
    );
    if (count <= 0) {
      return { decisions: [], count: 0 };
    }

    const heap = eng.HEAPF32;
    const heapU8 = new Uint8Array(eng.HEAPF32.buffer);
    const decisions: BlendDecision[] = [];

    // Lecteur d'offset dans le buffer
    const readString = (byteOffset: number): string => {
      let s = "";
      for (let i = 0; i < 64; i++) {
        const c = heapU8[this.bufferPtr + byteOffset + i];
        if (c === 0) break;
        s += String.fromCharCode(c);
      }
      return s;
    };

    const readF32 = (byteOffset: number): number => {
      return heap[(this.bufferPtr + byteOffset) >> 2];
    };

    for (let i = 0; i < count; i++) {
      const base = i * DECISION_STRIDE;
      decisions.push({
        clipName: readString(base),
        weight: readF32(base + 64),
        timeScale: readF32(base + 68),
      });
    }

    return { decisions, count };
  }

  /** Retourne true si le WASM est initialisé et prêt. */
  get isReady(): boolean {
    return this.initialized && this.graphId >= 0;
  }
}
