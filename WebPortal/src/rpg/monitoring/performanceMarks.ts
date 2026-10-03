// ══════════════════════════════════════════════════════════════════════════════
// monitoring/performanceMarks.ts — Performance marks pour les phases de
// chargement du jeu. Utilise performance.mark/measure de l'API User Timing.
//
// Usage typique :
//   markLoadPhase("login→boot")
//   // … chargement …
//   markLoadPhase("boot→server_select")
//   measureLoadPhase("login→boot", "boot→server_select", "boot_total")
// ══════════════════════════════════════════════════════════════════════════════

import { monitoringService } from "./MonitoringService";

// ── Marqueurs de phase ──────────────────────────────────────────────────────

const LOAD_MARKS = new Map<string, number>();

/**
 * Marquer le début d'une phase de chargement.
 * @param phase Nom unique de la phase (ex: "boot_start", "db_hydrate").
 */
export function markLoadPhase(phase: string): void {
  if (typeof performance === "undefined") return;
  performance.mark(phase);
  LOAD_MARKS.set(phase, performance.now());
}

/**
 * Mesurer le temps écoulé entre deux phases et enregistrer la durée.
 * @param fromPhase Nom de la phase de début (doit être marquée avant).
 * @param toPhase Nom de la phase de fin (doit être marquée avant).
 * @param measureName Nom de la mesure (optionnel, auto-généré si omis).
 */
export function measureLoadPhase(
  fromPhase: string,
  toPhase: string,
  measureName?: string,
): number {
  if (typeof performance === "undefined") return 0;
  const name = measureName ?? `${fromPhase}→${toPhase}`;
  try {
    performance.measure(name, fromPhase, toPhase);
    const entries = performance.getEntriesByName(name, "measure");
    if (entries.length > 0) {
      const duration = entries[0].duration;
      monitoringService.setLoadDuration(Math.round(duration));
      return Math.round(duration);
    }
  } catch {
    // Les marks n'existent pas forcément
  }
  return 0;
}

/**
 * Récupérer la durée entre deux marks manuellement (sans API User Timing).
 */
export function getPhaseDuration(fromPhase: string, toPhase: string): number {
  const from = LOAD_MARKS.get(fromPhase);
  const to = LOAD_MARKS.get(toPhase);
  if (from !== undefined && to !== undefined) {
    return Math.round(to - from);
  }
  return 0;
}

/**
 * Récupérer toutes les mesures enregistrées via performance.measure.
 */
export function getAllMeasures(): { name: string; duration: number }[] {
  if (typeof performance === "undefined") return [];
  try {
    return performance.getEntriesByType("measure").map((e) => ({
      name: e.name,
      duration: Math.round(e.duration),
    }));
  } catch {
    return [];
  }
}

/**
 * Effacer toutes les marks/measures de performance.
 */
export function clearPerformanceMarks(): void {
  if (typeof performance === "undefined") return;
  performance.clearMarks();
  performance.clearMeasures();
  LOAD_MARKS.clear();
}

/**
 * Marquer le début du chargement boot.
 */
export function markBootStart(): void {
  markLoadPhase("boot_start");
}

/**
 * Marquer la fin du chargement boot et enregistrer la mesure.
 */
export function markBootEnd(): number {
  markLoadPhase("boot_end");
  return measureLoadPhase("boot_start", "boot_end", "boot_total");
}

/**
 * Marquer le début de l'hydratation DB.
 */
export function markDbHydrateStart(): void {
  markLoadPhase("db_hydrate_start");
}

/**
 * Marquer la fin de l'hydratation DB.
 */
export function markDbHydrateEnd(): number {
  markLoadPhase("db_hydrate_end");
  return measureLoadPhase("db_hydrate_start", "db_hydrate_end", "db_hydrate");
}

/**
 * Marquer le début du chargement des assets globaux (boot GLTF).
 */
export function markAssetLoadStart(): void {
  markLoadPhase("asset_load_start");
}

/**
 * Marquer la fin du chargement des assets globaux.
 */
export function markAssetLoadEnd(): number {
  markLoadPhase("asset_load_end");
  return measureLoadPhase("asset_load_start", "asset_load_end", "asset_load");
}

/**
 * Marquer le début de l'entrée en jeu (world mount).
 */
export function markWorldMountStart(): void {
  markLoadPhase("world_mount_start");
}

/**
 * Marquer le moment où le monde de jeu est prêt.
 */
export function markWorldReady(): number {
  markLoadPhase("world_ready");
  return measureLoadPhase("world_mount_start", "world_ready", "world_mount");
}
