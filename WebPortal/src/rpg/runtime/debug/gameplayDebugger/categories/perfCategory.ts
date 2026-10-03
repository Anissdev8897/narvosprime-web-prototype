// ══════════════════════════════════════════════════════════════════════════════
// categories/perfCategory.ts — Catégorie Performance du GameplayDebugger
//
// Affiche les métriques de performance de la scène :
//   • FPS, 1% low, frametime
//   • Draw calls, triangles, VRAM estimée
//   • Informations GPU (renderer)
//
// Compatible avec les données produites par PerfProbe (PerfOverlay.tsx).
// ══════════════════════════════════════════════════════════════════════════════

import type { GameplayDebuggerCategory, DebugDrawCall } from "../core";

// ── Store de perf partagé (lecture seule pour le debugger) ──────────────────
// Les données sont poussées ici par PerfProbe ou par un tick direct.

export interface PerfData {
  fps: number;
  low1: number;
  ms: number;
  calls: number;
  tris: number;
  vram?: number;    // MB, si disponible
  textures?: number; // nb de textures chargées
  geometries?: number;
}

let currentPerf: PerfData = {
  fps: 0,
  low1: 0,
  ms: 0,
  calls: 0,
  tris: 0,
};

/** Met à jour les données de perf (appelé par PerfProbe ou autre source). */
export function updatePerfData(data: Partial<PerfData>): void {
  currentPerf = { ...currentPerf, ...data };
}

/** Récupère les données de perf courantes. */
export function getPerfData(): PerfData {
  return { ...currentPerf };
}

/**
 * Catégorie Performance : FPS, draw calls, mémoire.
 */
export class PerfDebugCategory implements GameplayDebuggerCategory {
  id = "perf";
  label = "Perf";
  keybind = "2";

  private lines: string[] = [];

  update(_dt: number): void {
    const p = currentPerf;
    const lines: string[] = [];

    lines.push(`▓ PERFORMANCE`);

    // FPS
    const fpsColor = p.fps >= 55 ? "#4ade80" : p.fps >= 30 ? "#fbbf24" : "#f87171";
    lines.push(`  [${fpsColor}]FPS: ${p.fps}  (1% low: ${p.low1})[/]`);
    lines.push(`  Frametime: ${p.ms.toFixed(1)} ms`);

    // GPU
    const callsColor = p.calls > 500 ? "#fbbf24" : "#4ade80";
    lines.push(`  [${callsColor}]Draw calls: ${p.calls}[/]`);
    const trisColor = p.tris > 500000 ? "#fbbf24" : "#4ade80";
    lines.push(`  [${trisColor}]Triangles: ${(p.tris / 1000).toFixed(0)}k[/]`);

    // VRAM
    if (p.vram !== undefined) {
      const vramColor = p.vram > 1500 ? "#fbbf24" : "#4ade80";
      lines.push(`  [${vramColor}]VRAM: ${p.vram} MB[/]`);
    }

    // Infos complémentaires
    if (p.textures !== undefined) {
      lines.push(`  Textures: ${p.textures}`);
    }
    if (p.geometries !== undefined) {
      lines.push(`  Geometries: ${p.geometries}`);
    }

    // Barre FPS visuelle (50 caractères)
    const barLen = Math.min(50, Math.max(1, Math.round(p.fps / 2)));
    const bar = "█".repeat(barLen) + "░".repeat(Math.max(0, 50 - barLen));
    lines.push(`  [${fpsColor}][${bar}] ${p.fps} FPS[/]`);

    // Informations navigateur
    lines.push(``);
    lines.push(`───`);
    lines.push(`Navigator: ${navigator.userAgent.slice(0, 60)}`);
    if ("deviceMemory" in navigator) {
      lines.push(`RAM système: ${(navigator as any).deviceMemory} GB`);
    }
    if ("hardwareConcurrency" in navigator) {
      lines.push(`CPU threads: ${navigator.hardwareConcurrency}`);
    }

    this.lines = lines;
  }

  getOverlayData(): string[] {
    return this.lines;
  }

  getDrawCalls(): DebugDrawCall[] {
    return []; // Pas de draw 3D pour la perf
  }
}
