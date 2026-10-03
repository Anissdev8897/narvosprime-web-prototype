// ══════════════════════════════════════════════════════════════════════════════
// npc/npcSleepManager.ts — Gestionnaire de sommeil des PNJ (hors écran = dormant)
//
// Principe :
//   • NEAR  (≤ 35 m)  → éveillé, tick complet (IA, anim, raycast LOS)
//   • MID   (36-60 m) → éveillé throttlé (IA tick 1/2 frames, anim 1/2 frames)
//   • FAR   (> 60 m)  → ENDORMI : pas d'IA, pas de raycast, pas de synchro WASM,
//     pas d'update de position. Le PNJ conserve son dernier état connu.
//
// Transition au réveil :
//   Quand un PNJ passe de FAR → MID/NEAR, il reçoit un "wake-up call" :
//   son dt accumulé est passé à l'IA pour simuler le temps écoulé (optionnel).
//
// Bénéfices :
//   • 0 coût CPU pour les PNJ hors écran (typiquement 60-80% d'une map).
//   • Les PNJ endormis ne génèrent PAS d'alloc mémoire (pas de raycast,
//     pas de calcul Three.js).
// ══════════════════════════════════════════════════════════════════════════════

import { Band } from "../runtime/perf/distanceBand";

// ── États de sommeil ────────────────────────────────────────────────────────

export type SleepState = "awake" | "throttled" | "asleep";

// ── Entrée du gestionnaire ──────────────────────────────────────────────────

interface SleepEntry {
  /** Dernière bande connue. */
  lastBand: BandT;
  /** État de sommeil actuel. */
  state: SleepState;
  /** Timestamp (performance.now) de la dernière transition FAR→autre. */
  lastWakeMs: number;
  /** Temps total passé dans l'état FAR (ms). */
  totalSleepMs: number;
  /** Compteur de frames consécutives en FAR. */
  farFrames: number;
}

type BandT = 0 | 1 | 2;

// ── Statistiques ────────────────────────────────────────────────────────────

export interface SleepStats {
  total: number;
  awake: number;
  throttled: number;
  asleep: number;
  totalSleepMs: number;
  avgSleepPerNpcMs: number;
}

// ── Manager ─────────────────────────────────────────────────────────────────

class NpcSleepManager {
  private entries = new Map<string, SleepEntry>();

  // Stats cumulées
  private _totalSleepMs = 0;
  private _wakeTransitions = 0;
  private _sleepTransitions = 0;

  // ── Enregistrement ────────────────────────────────────────────────────────

  register(id: string, initialBand: BandT = Band.NEAR): void {
    if (!this.entries.has(id)) {
      this.entries.set(id, {
        lastBand: initialBand,
        state: initialBand === Band.FAR ? "asleep" : "awake",
        lastWakeMs: initialBand === Band.FAR ? 0 : performance.now(),
        totalSleepMs: 0,
        farFrames: 0,
      });
    }
  }

  unregister(id: string): void {
    const e = this.entries.get(id);
    if (e) {
      this._totalSleepMs += e.totalSleepMs;
    }
    this.entries.delete(id);
  }

  clear(): void {
    this._totalSleepMs = 0;
    this._wakeTransitions = 0;
    this._sleepTransitions = 0;
    this.entries.clear();
  }

  // ── Mise à jour par bande ────────────────────────────────────────────────

  /**
   * Met à jour l'état de sommeil d'un PNJ selon sa bande de distance.
   *
   * @returns `true` si le PNJ est endormi (FAR) — l'appelant DOIT sauter le tick.
   *          `false` si le PNJ est éveillé ou throttlé — l'appelant continue.
   *          Si le PNJ vient de se réveiller, `wakeTransition` est true.
   */
  update(
    id: string,
    band: BandT,
    nowMs: number = performance.now(),
  ): { asleep: boolean; wakeTransition: boolean; state: SleepState } {
    const e = this.entries.get(id);
    if (!e) {
      // Auto-enregistrement si non trouvé
      this.register(id, band);
      return { asleep: band === Band.FAR, wakeTransition: false, state: band === Band.FAR ? "asleep" : "awake" };
    }

    const wasAsleep = e.state === "asleep";
    const wasFar = e.lastBand === Band.FAR;

    // Met à jour la bande
    e.lastBand = band;

    if (band === Band.FAR) {
      // FAR → s'endort (ou reste endormi)
      e.farFrames++;
      if (!wasAsleep) {
        // Transition VEILLE → SOMMEIL
        e.state = "asleep";
        e.farFrames = 0;
        this._sleepTransitions++;
      }
      return { asleep: true, wakeTransition: false, state: "asleep" };
    }

    // MID ou NEAR
    if (band === Band.MID) {
      e.state = "throttled";
    } else {
      e.state = "awake";
    }

    if (wasAsleep || wasFar) {
      // Transition SOMMEIL → VEILLE
      e.lastWakeMs = nowMs;
      this._wakeTransitions++;
      return { asleep: false, wakeTransition: true, state: e.state };
    }

    return { asleep: false, wakeTransition: false, state: e.state };
  }

  // ── Accès ────────────────────────────────────────────────────────────────

  getState(id: string): SleepState {
    return this.entries.get(id)?.state ?? "awake";
  }

  /** Temps (ms) depuis le dernier réveil. Utile pour calculer le catch-up dt. */
  msSinceWake(id: string, nowMs: number = performance.now()): number {
    const e = this.entries.get(id);
    if (!e || e.lastWakeMs === 0) return 0;
    return nowMs - e.lastWakeMs;
  }

  isAsleep(id: string): boolean {
    return this.entries.get(id)?.state === "asleep";
  }

  isThrottled(id: string): boolean {
    return this.entries.get(id)?.state === "throttled";
  }

  isAwake(id: string): boolean {
    const s = this.entries.get(id)?.state;
    return s === "awake" || s === "throttled";
  }

  // ── Stats ────────────────────────────────────────────────────────────────

  get stats(): SleepStats {
    let awake = 0, throttled = 0, asleep = 0;
    let totalSleepMs = 0;

    for (const [, e] of this.entries) {
      if (e.state === "awake") awake++;
      else if (e.state === "throttled") throttled++;
      else if (e.state === "asleep") asleep++;
      totalSleepMs += e.totalSleepMs;
    }

    return {
      total: this.entries.size,
      awake,
      throttled,
      asleep,
      totalSleepMs: this._totalSleepMs + totalSleepMs,
      avgSleepPerNpcMs: this.entries.size > 0
        ? (this._totalSleepMs + totalSleepMs) / this.entries.size
        : 0,
    };
  }

  /** Nombre de transitions sommeil→veille. */
  get wakeTransitions(): number { return this._wakeTransitions; }

  /** Nombre de transitions veille→sommeil. */
  get sleepTransitions(): number { return this._sleepTransitions; }
}

/** Instance unique. */
export const npcSleepManager = new NpcSleepManager();
