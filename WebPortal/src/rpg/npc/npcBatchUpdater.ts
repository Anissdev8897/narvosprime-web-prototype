// ══════════════════════════════════════════════════════════════════════════════
// npc/npcBatchUpdater.ts — Mise à jour par lots des PNJ (étalement CPU)
//
// Problème : 200 PNJ qui font tous un update()+raycast dans le même useFrame
//   créent un pic CPU d'environ 6-8 ms, qui fait rater la deadline 16 ms du 60 FPS.
//
// Solution : on répartit les mises à jour des PNJ sur plusieurs frames.
//   • Chaque frame, on traite BATCH_SIZE slots actifs.
//   • Les PNJ NEAR sont prioritaires (combat en cours).
//   • Les PNJ FAR sont throttlés (1 tick toutes les N frames).
//   • Ce système est DÉCORRELÉ du React → pas de re-render déclenché.
//
// Intégration :
//   Dans RpgGameWorld.tsx, appeler npcBatchUpdater.tick(dt) depuis un useFrame
//   global (pas depuis chaque Npc.tsx). Les PNJ individuels n'ont plus besoin
//   de leur propre useFrame — ils lisent le résultat depuis une Map partagée.
// ══════════════════════════════════════════════════════════════════════════════

import { Band } from "../runtime/perf/distanceBand";

// ── Configuration ───────────────────────────────────────────────────────────

export interface BatchConfig {
  /** Nombre max de PNJ traités par frame (NEAR prioritaire). */
  batchSize: number;
  /** Intervalle de tick (en frames) pour les PNJ FAR. */
  farInterval: number;
  /** Intervalle de tick pour les PNJ MID. */
  midInterval: number;
}

const DEFAULT_CONFIG: BatchConfig = {
  batchSize: 30,
  farInterval: 8,   // 1 tick toutes les 8 frames (~7.5 Hz à 60 FPS)
  midInterval: 2,   // 1 tick toutes les 2 frames (~30 Hz)
};

// ── Résultat d'un tick batché ───────────────────────────────────────────────

export interface BatchedTickResult {
  npcId: string;
  /** Résultat de l'IA (action, moving, attackFired). */
  result: import("./NpcController").NpcFrameResult;
  /** Bande LOD appliquée. */
  band: BandT;
  /** Le PNJ était-il en veille (FAR + pas de tick cette frame) ? */
  slept: boolean;
}

type BandT = 0 | 1 | 2;

// ── Entrée du planificateur ─────────────────────────────────────────────────

interface NpcTickEntry {
  id: string;
  /** Priorité : 0 = NEAR (combat), 1 = MID, 2 = FAR. */
  priority: number;
  /** Compteur de frames depuis le dernier tick. */
  frameSinceTick: number;
  /** Dernier résultat connu (utilisé quand le PNJ dort). */
  lastResult: import("./NpcController").NpcFrameResult | null;
  /** Dernière bande connue. */
  lastBand: BandT;
}

// ── Planificateur batch ─────────────────────────────────────────────────────

class NpcBatchUpdater {
  private config: BatchConfig = { ...DEFAULT_CONFIG };
  private entries = new Map<string, NpcTickEntry>();
  /** Index round-robin pour la sélection par priorité. */
  private frameIndex = 0;

  /** Stats de tick. */
  private _tickCount = 0;
  private _sleepCount = 0;
  private _cumulativeTickMs = 0;

  // ── Configuration ────────────────────────────────────────────────────────

  setConfig(patch: Partial<BatchConfig>): void {
    Object.assign(this.config, patch);
  }

  getConfig(): BatchConfig {
    return { ...this.config };
  }

  // ── Enregistrement des PNJ à ticker ──────────────────────────────────────

  register(id: string, initialBand: BandT = 0): void {
    if (!this.entries.has(id)) {
      this.entries.set(id, {
        id,
        priority: initialBand,
        frameSinceTick: Math.floor(Math.random() * 10), // décalage aléatoire initial
        lastResult: null,
        lastBand: initialBand,
      });
    }
  }

  unregister(id: string): void {
    this.entries.delete(id);
  }

  updatePriority(id: string, band: BandT): void {
    const e = this.entries.get(id);
    if (e) {
      e.priority = band;
      e.lastBand = band;
    }
  }

  clear(): void {
    this.entries.clear();
    this._tickCount = 0;
    this._sleepCount = 0;
    this._cumulativeTickMs = 0;
  }

  // ── Stats ────────────────────────────────────────────────────────────────

  get stats() {
    return {
      registered: this.entries.size,
      tickCount: this._tickCount,
      sleepCount: this._sleepCount,
      avgTickMs: this._tickCount > 0 ? this._cumulativeTickMs / this._tickCount : 0,
    };
  }

  /**
   * Exécute le tick batché pour la frame courante.
   *
   * @param dt       Delta time (s)
   * @param tickFn   Fonction de tick réelle : (id, dt, slept) => void
   * @returns        Liste des PNJ qui ont été tickés cette frame
   */
  tick(
    dt: number,
    tickFn: (id: string, dt: number) => void,
  ): BatchedTickResult[] {
    this.frameIndex++;
    const { batchSize, farInterval, midInterval } = this.config;

    // 1. Sépare les entrées par priorité
    const near: NpcTickEntry[] = [];
    const mid: NpcTickEntry[] = [];
    const far: NpcTickEntry[] = [];

    for (const [, e] of this.entries) {
      e.frameSinceTick++;
      if (e.priority === Band.NEAR) near.push(e);
      else if (e.priority === Band.MID) mid.push(e);
      else far.push(e);
    }

    // 2. Construit la liste des candidats pour cette frame
    //    NEAR : tick tous les frames (si prioritaire)
    //    MID : tick toutes les midInterval frames
    //    FAR : tick toutes les farInterval frames
    const toTick: NpcTickEntry[] = [];

    // NEAR — on les prend tous (ils sont en combat), mais limité par batchSize
    for (const e of near) {
      if (e.frameSinceTick >= 1) {
        toTick.push(e);
        if (toTick.length >= batchSize) break;
      }
    }

    // MID — 1 sur midInterval
    if (toTick.length < batchSize) {
      for (const e of mid) {
        if (e.frameSinceTick >= midInterval) {
          toTick.push(e);
          if (toTick.length >= batchSize) break;
        }
      }
    }

    // FAR — 1 sur farInterval
    if (toTick.length < batchSize) {
      for (const e of far) {
        if (e.frameSinceTick >= farInterval) {
          toTick.push(e);
          if (toTick.length >= batchSize) break;
        }
      }
    }

    // 3. Exécute le tick sur les candidats
    const results: BatchedTickResult[] = [];
    for (const e of toTick) {
      e.frameSinceTick = 0;
      const t0 = performance.now();
      tickFn(e.id, dt);
      const elapsed = performance.now() - t0;
      this._cumulativeTickMs += elapsed;
      this._tickCount++;

      results.push({
        npcId: e.id,
        result: e.lastResult ?? { action: "idle", moving: false, attackFired: false },
        band: e.lastBand,
        slept: false,
      });
    }

    // 4. Compte les dormeurs (ceux qui n'ont PAS été tickés cette frame)
    this._sleepCount = this.entries.size - toTick.length;

    return results;
  }

  /**
   * Met à jour le dernier résultat connu d'un PNJ (pour que les lecteurs
   * puissent consommer le résultat même quand le PNJ dort).
   */
  storeResult(id: string, result: import("./NpcController").NpcFrameResult): void {
    const e = this.entries.get(id);
    if (e) e.lastResult = result;
  }

  /**
   * Récupère le dernier résultat connu (pour les PNJ qui dorment).
   */
  getLastResult(id: string): import("./NpcController").NpcFrameResult | null {
    return this.entries.get(id)?.lastResult ?? null;
  }
}

/** Instance unique. */
export const npcBatchUpdater = new NpcBatchUpdater();
