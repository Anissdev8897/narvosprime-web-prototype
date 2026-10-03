// ══════════════════════════════════════════════════════════════════════════════
// categories/npcCategory.ts — Catégorie NPC du GameplayDebugger
//
// Affiche la liste des PNJ enregistrés dans npcRegistry :
//   • ID, rôle, position, santé, niveau
//   • Debug 3D : sphères de position, lignes vers le joueur, labels de vie
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";
import type { GameplayDebuggerCategory, DebugDrawCall } from "../core";
import { DebugSphere, DebugLine, DebugText } from "../Debug3DHelpers";
// 4 niveaux, pas 3 : categories → gameplayDebugger → debug → runtime → rpg.
import { npcRegistry } from "../../../../npc/npcRegistry";

/**
 * Catégorie NPC : debug des PNJ dans la scène.
 */
export class NpcDebugCategory implements GameplayDebuggerCategory {
  id = "npc";
  label = "NPC";
  keybind = "1";

  private cachedLines: string[] = [];
  private cachedDrawCalls: DebugDrawCall[] = [];

  update(_dt: number): void {
    const lines: string[] = [];
    const drawCalls: DebugDrawCall[] = [];
    const tmpPos = new THREE.Vector3();

    const all = npcRegistry.all();
    const alive = all.filter((h) => h.isAlive());
    const dead = all.length - alive.length;

    lines.push(`▓ PNJ (${all.length} total, ${alive.length} vivants, ${dead} morts)`);
    lines.push("");

    if (alive.length === 0) {
      lines.push("  Aucun PNJ vivant dans la scène.");
    } else {
      for (const npc of alive) {
        const pos = npc.getPosition();
        const label = npc.getLabel?.() ?? npc.id.slice(0, 12);
        const hpFrac = npc.getHpFraction?.() ?? 1;
        const maxHp = npc.getMaxHp?.() ?? 0;
        const level = npc.getLevel?.() ?? 0;
        const role = npc.role;
        const aliveStr = npc.isAlive() ? "VIVANT" : "MORT";

        // Couleur selon la santé
        const hpColor = hpFrac > 0.5 ? "#4ade80" : hpFrac > 0.25 ? "#fbbf24" : "#f87171";

        lines.push(`  [${hpColor}]${label}[/]`);
        lines.push(`    ID: ${npc.id.slice(0, 16)}  Rôle: ${role}  Niv: ${level}`);
        lines.push(`    HP: ${(hpFrac * 100).toFixed(0)}%  (${maxHp > 0 ? `max ${maxHp}` : "?"}) ${aliveStr}`);
        lines.push(`    Pos: ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`);

        // DebugSphere au niveau du PNJ (taille selon santé)
        const sphereRadius = 0.5 + hpFrac * 0.5;
        const sphereColor = hpFrac > 0.5 ? 0x4ade80 : hpFrac > 0.25 ? 0xfbbf24 : 0xf87171;
        drawCalls.push(DebugSphere(pos, sphereRadius, sphereColor));

        // Label 3D au-dessus du PNJ
        const labelPos = pos.clone();
        labelPos.y += 2.5;
        drawCalls.push(DebugText(
          labelPos,
          `${label} ${(hpFrac * 100).toFixed(0)}%`,
          sphereColor,
          0.5,
        ));

        lines.push("");
      }
    }

    // Stats résumé
    lines.push(`───`);
    lines.push(`npcRegistry: ${all.length} handles`);
    lines.push(`playerAlive: ${npcRegistry.playerAlive}`);
    lines.push(`playerTargetable: ${npcRegistry.playerTargetable}`);

    this.cachedLines = lines;
    this.cachedDrawCalls = drawCalls;
  }

  getOverlayData(): string[] {
    return this.cachedLines;
  }

  getDrawCalls(): DebugDrawCall[] {
    return this.cachedDrawCalls;
  }
}
