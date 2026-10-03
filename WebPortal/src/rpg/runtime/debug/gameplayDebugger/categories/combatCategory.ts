// ══════════════════════════════════════════════════════════════════════════════
// categories/combatCategory.ts — Catégorie Combat du GameplayDebugger
//
// Affiche l'état du combat en temps réel :
//   • Dégâts infligés/reçus (dernières secondes)
//   • État du combo (mains nues)
//   • État de l'auto-attack
//   • Debug 3D : impacts, portées, zones de détection
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";
import type { GameplayDebuggerCategory, DebugDrawCall } from "../core";
import { DebugLine, DebugSphere, DebugText } from "../Debug3DHelpers";

// ── Types de données de combat ──────────────────────────────────────────────

export interface DamageEvent {
  timestamp: number;
  amount: number;
  isCrit: boolean;
  target: string;
  source: string;
  type: "deal" | "received";
}

export interface ComboState {
  current: number;
  max: number;
  windowMs: number;
  remainingMs: number;
  chargeMs: number;
  isCharging: boolean;
}

export interface CombatDebugData {
  dps: number;
  lastDamageEvents: DamageEvent[];
  combo: ComboState | null;
  targetLocked: boolean;
  targetId: string | null;
  inCombat: boolean;
  combatDuration: number;
}

// ── Store de combat partagé ─────────────────────────────────────────────────

let currentCombat: CombatDebugData = {
  dps: 0,
  lastDamageEvents: [],
  combo: null,
  targetLocked: false,
  targetId: null,
  inCombat: false,
  combatDuration: 0,
};

/** Met à jour les données de debug du combat. */
export function updateCombatDebugData(data: Partial<CombatDebugData>): void {
  currentCombat = { ...currentCombat, ...data };
}

/** Ajoute un événement de dégâts. */
export function pushDamageEvent(event: DamageEvent): void {
  currentCombat.lastDamageEvents.push(event);
  // Garde seulement les 20 derniers événements
  if (currentCombat.lastDamageEvents.length > 20) {
    currentCombat.lastDamageEvents = currentCombat.lastDamageEvents.slice(-20);
  }
}

/** Récupère les données de debug du combat. */
export function getCombatDebugData(): CombatDebugData {
  return { ...currentCombat, lastDamageEvents: [...currentCombat.lastDamageEvents] };
}

// ── Catégorie ───────────────────────────────────────────────────────────────

/**
 * Catégorie Combat : dégâts, combos, verrouillage.
 */
export class CombatDebugCategory implements GameplayDebuggerCategory {
  id = "combat";
  label = "Combat";
  keybind = "4";

  /** Position du joueur (injectée depuis l'extérieur). */
  playerPos: THREE.Vector3 = new THREE.Vector3();
  /** Position de la cible verrouillée (injectée). */
  targetPos: THREE.Vector3 | null = null;

  private lines: string[] = [];
  private drawCalls: DebugDrawCall[] = [];

  update(_dt: number): void {
    const data = currentCombat;
    const lines: string[] = [];
    const drawCalls: DebugDrawCall[] = [];

    lines.push(`▓ COMBAT`);
    lines.push("");

    if (!data.inCombat) {
      lines.push("  Hors combat.");
      lines.push("");
    } else {
      const durMin = Math.floor(data.combatDuration / 60);
      const durSec = Math.floor(data.combatDuration % 60);
      lines.push(`  Combat: ${durMin}m${durSec.toString().padStart(2, "0")}s`);
      lines.push(`  DPS: ${data.dps.toFixed(1)}`);
      lines.push("");
    }

    // Dégâts récents
    const recent = data.lastDamageEvents;
    if (recent.length > 0) {
      lines.push(`  Derniers dégâts (${recent.length} events):`);
      const now = performance.now();
      for (const ev of recent.slice(-8)) {
        const ago = ((now - ev.timestamp) / 1000).toFixed(1);
        const sign = ev.type === "deal" ? "→" : "←";
        const crit = ev.isCrit ? " CRIT!" : "";
        const color = ev.isCrit ? "#f59e0b" : ev.type === "deal" ? "#4ade80" : "#f87171";
        lines.push(`    [${color}]${sign} ${ev.amount}${crit}  (${ago}s) ${ev.target.slice(0, 12)}[/]`);
      }
      lines.push("");
    }

    // Combo
    if (data.combo) {
      const c = data.combo;
      const comboBar = "■".repeat(c.current) + "□".repeat(Math.max(0, c.max - c.current));
      lines.push(`  Combo: [${c.current > 0 ? "#fbbf24" : "#94a3b8"}][${comboBar}][/] ${c.current}/${c.max}`);
      lines.push(`  Fenêtre combo: ${(c.remainingMs / 1000).toFixed(1)}s`);
      if (c.isCharging) {
        lines.push(`  [CHARGEMENT] ${(c.chargeMs / 1000).toFixed(1)}s`);
      }
      lines.push("");
    }

    // Cible
    if (data.targetLocked && data.targetId) {
      lines.push(`  Cible: ${data.targetId.slice(0, 20)}`);
      // Ligne 3D vers la cible
      if (this.targetPos) {
        drawCalls.push(DebugLine(
          this.playerPos,
          this.targetPos,
          0xf87171, // rouge
        ));
        drawCalls.push(DebugSphere(this.targetPos, 1.5, 0xff4444));
        drawCalls.push(DebugText(
          this.targetPos.clone().add(new THREE.Vector3(0, 3, 0)),
          "🎯 CIBLE",
          0xff4444,
          0.6,
        ));
      }
    } else {
      lines.push(`  Cible: aucun verrouillage`);
    }

    // Portées d'attaque
    const rangeCircle = this.playerPos.clone();
    drawCalls.push(DebugLine(
      rangeCircle.clone().add(new THREE.Vector3(-3, 0, 0)),
      rangeCircle.clone().add(new THREE.Vector3(3, 0, 0)),
      0x444466,
    ));
    drawCalls.push(DebugLine(
      rangeCircle.clone().add(new THREE.Vector3(0, 0, -3)),
      rangeCircle.clone().add(new THREE.Vector3(0, 0, 3)),
      0x444466,
    ));

    lines.push(`───`);
    lines.push(`combatDebug: ${recent.length} events`);

    this.lines = lines;
    this.drawCalls = drawCalls;
  }

  getOverlayData(): string[] {
    return this.lines;
  }

  getDrawCalls(): DebugDrawCall[] {
    return this.drawCalls;
  }
}
