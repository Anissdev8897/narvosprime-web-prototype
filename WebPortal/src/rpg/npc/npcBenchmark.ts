// ══════════════════════════════════════════════════════════════════════════════
// npc/npcBenchmark.ts — Benchmark des performances NPC
//
// Mesure :
//   • Temps de tick moyen par NPC (ms)
//   • Mémoire utilisée par NPC (estimation)
//   • Nombre max de NPC avant chute de FPS < 30
//   • Hit rate du pool d'entités (réutilisation vs allocation)
//   • Taux de sommeil (asleep / total)
//
// Utilisation :
//   import { npcBenchmark } from "./npcBenchmark";
//   const report = npcBenchmark.sample();
//   console.table(report);
// ══════════════════════════════════════════════════════════════════════════════

import { npcEntityPool } from "./npcEntityPool";
import { npcBatchUpdater } from "./npcBatchUpdater";
import { npcSleepManager } from "./npcSleepManager";
import { npcRegistry } from "./npcRegistry";

// ── Échantillon de performance ──────────────────────────────────────────────

export interface NpcPerfSample {
  /** Timestamp de l'échantillon. */
  timestamp: number;

  // ── Population ──────────────────────────────────────────────────────────
  /** Nombre total de PNJ enregistrés dans le registre. */
  totalRegistered: number;
  /** Nombre de slots actifs dans le pool. */
  poolActive: number;
  /** Taille totale du pool. */
  poolSize: number;

  // ── Tick ───────────────────────────────────────────────────────────────
  /** Temps moyen de tick par NPC (ms), échantillonné sur la dernière période. */
  avgTickMs: number;
  /** Estimation du tick total pour TOUS les NPC cette frame (ms). */
  estimatedTotalTickMs: number;

  // ── LOD / Sommeil ──────────────────────────────────────────────────────
  /** Répartition par bande LOD. */
  byBand: { near: number; mid: number; far: number };
  /** État de sommeil. */
  sleepStats: {
    awake: number;
    throttled: number;
    asleep: number;
    percentAsleep: number;
  };

  // ── Pool ────────────────────────────────────────────────────────────────
  /** Taux de réutilisation des slots du pool (0..1). */
  poolReuseRate: number;
  /** Pic d'utilisation simultanée du pool. */
  poolPeakActive: number;

  // ── Mémoire (estimation) ────────────────────────────────────────────────
  /** Estimation de la mémoire utilisée par tous les NPC (KB). */
  estimatedMemoryKb: number;
  /** Estimation de la mémoire par NPC (KB). */
  estimatedMemoryPerNpcKb: number;

  // ── Performances globales ───────────────────────────────────────────────
  /** FPS estimé à partir du temps de tick total. */
  estimatedMaxFps: number;
  /** Nombre max de NPC estimé avant chute sous 30 FPS. */
  estimatedMaxNpcFor30Fps: number;
}

// ── Métriques cumulées (rolling window sur N frames) ────────────────────────

const WINDOW_SIZE = 60;
const tickTimes: number[] = [];

function pushTickTime(ms: number): void {
  tickTimes.push(ms);
  if (tickTimes.length > WINDOW_SIZE) tickTimes.shift();
}

function avgTickTime(): number {
  if (tickTimes.length === 0) return 0;
  return tickTimes.reduce((a, b) => a + b, 0) / tickTimes.length;
}

// ── Estimation mémoire ──────────────────────────────────────────────────────

// Coût estimé (KB) par composant NPC — mesuré expérimentalement
const MEMORY_PER_NPC_KB = {
  controller: 0.8,    // NpcController (state, cfg, timers)
  position: 0.3,      // THREE.Vector3
  animCtrl: 4.0,      // AnimationController (mixer, clips refs)
  mesh: 48.0,         // Geometries + materials partagés mais comptés par instance
  registry: 0.5,      // NpcHandle + Map entry + grid cell
  poolOverhead: 0.2,  // Pool slot overhead
  misc: 2.0,          // Refs, closures, etc.
};

const MEMORY_TOTAL_PER_NPC_KB = Object.values(MEMORY_PER_NPC_KB).reduce((a, b) => a + b, 0);

// ── Benchmark ───────────────────────────────────────────────────────────────

class NpcBenchmark {
  private _enabled = false;
  private _lastSample: NpcPerfSample | null = null;

  /** Active la collecte d'échantillons. */
  enable(): void { this._enabled = true; }
  disable(): void { this._enabled = false; }
  get enabled(): boolean { return this._enabled; }

  get lastSample(): NpcPerfSample | null { return this._lastSample; }

  /**
   * Enregistre un temps de tick pour la moyenne glissante.
   * Appelé par le batch updater à chaque frame traitée.
   */
  recordTickTime(ms: number): void {
    if (this._enabled) pushTickTime(ms);
  }

  /**
   * Collecte un échantillon complet des performances NPC.
   */
  sample(): NpcPerfSample {
    const poolStats = npcEntityPool.stats;
    const batchStats = npcBatchUpdater.stats;
    const sleepStats = npcSleepManager.stats;
    const byBand = npcEntityPool.countByBand();

    const totalActive = poolStats.activeCount;
    const avgTick = avgTickTime();

    // Estimation mémoire
    const estimatedMemoryKb = totalActive * MEMORY_TOTAL_PER_NPC_KB;

    // FPS estimé
    const totalTickMs = avgTick * totalActive;
    const frametimeBudget = 16.67; // 60 FPS
    const otherCostMs = 8.0; // rendu, physique, etc.
    const availableForNpc = frametimeBudget - otherCostMs;

    const sample: NpcPerfSample = {
      timestamp: performance.now(),

      totalRegistered: npcRegistry.all().length,
      poolActive: poolStats.activeCount,
      poolSize: poolStats.poolSize,

      avgTickMs: avgTick,
      estimatedTotalTickMs: totalTickMs,

      byBand,
      sleepStats: {
        awake: sleepStats.awake,
        throttled: sleepStats.throttled,
        asleep: sleepStats.asleep,
        percentAsleep: sleepStats.total > 0
          ? (sleepStats.asleep / sleepStats.total) * 100
          : 0,
      },

      poolReuseRate: poolStats.totalAcquired > 0
        ? poolStats.reuseCount / poolStats.totalAcquired
        : 0,
      poolPeakActive: poolStats.peakActive,

      estimatedMemoryKb: Math.round(estimatedMemoryKb),
      estimatedMemoryPerNpcKb: Math.round(MEMORY_TOTAL_PER_NPC_KB),

      estimatedMaxFps: avgTick > 0 ? Math.round(1000 / (otherCostMs + totalTickMs)) : 60,
      estimatedMaxNpcFor30Fps: avgTick > 0
        ? Math.round((frametimeBudget - otherCostMs) / avgTick)
        : 9999,
    };

    this._lastSample = sample;
    return sample;
  }

  /**
   * Génère un rapport textuel formaté pour l'affichage debug / console.
   */
  report(): string {
    const s = this.sample();
    const lines: string[] = [];
    lines.push("═ NPC BENCHMARK ═══════════════════════════════════");
    lines.push(`  Population : ${s.totalRegistered} registered, ${s.poolActive} pool active / ${s.poolSize}`);
    lines.push(`  Pool reuse : ${(s.poolReuseRate * 100).toFixed(1)}%  (peak: ${s.poolPeakActive})`);
    lines.push(`  ─── Tick ───`);
    lines.push(`  avg tick   : ${(s.avgTickMs * 1000).toFixed(2)} μs / npc`);
    lines.push(`  total tick : ${s.estimatedTotalTickMs.toFixed(2)} ms / frame`);
    lines.push(`  ─── LOD ───`);
    lines.push(`  NEAR: ${s.byBand.near}  MID: ${s.byBand.mid}  FAR: ${s.byBand.far}`);
    lines.push(`  asleep     : ${s.sleepStats.asleep} / ${s.poolActive} (${s.sleepStats.percentAsleep.toFixed(1)}%)`);
    lines.push(`  ─── Mémoire ───`);
    lines.push(`  estimée    : ${s.estimatedMemoryKb} KB total`);
    lines.push(`  par NPC    : ${s.estimatedMemoryPerNpcKb} KB`);
    lines.push(`  ─── Limite ───`);
    lines.push(`  FPS estimé : ${s.estimatedMaxFps}`);
    lines.push(`  NPC max @30: ${s.estimatedMaxNpcFor30Fps}`);
    lines.push("════════════════════════════════════════════════════");
    return lines.join("\n");
  }
}

/** Instance unique. */
export const npcBenchmark = new NpcBenchmark();
