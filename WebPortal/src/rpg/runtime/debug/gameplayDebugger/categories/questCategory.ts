// ══════════════════════════════════════════════════════════════════════════════
// categories/questCategory.ts — Catégorie Quêtes du GameplayDebugger
//
// Affiche l'état des quêtes actives depuis questStore :
//   • Quêtes actives avec progression
//   • Objectifs et compteurs
//   • Debug 3D : marqueurs de zones "reach" sur la map
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";
import type { GameplayDebuggerCategory, DebugDrawCall } from "../core";
import { DebugSphere, DebugText } from "../Debug3DHelpers";
// 4 niveaux, pas 3 : categories → gameplayDebugger → debug → runtime → rpg.
import { questStore } from "../../../../quests/questStore";
import { getQuest, type QuestDef } from "../../../../quests/questCatalog";

/**
 * Catégorie Quêtes : suivi des quêtes actives et progression.
 */
export class QuestDebugCategory implements GameplayDebuggerCategory {
  id = "quetes";
  label = "Quêtes";
  keybind = "3";

  private playerPos: THREE.Vector3 = new THREE.Vector3();
  private currentMapId = "";

  private lines: string[] = [];
  private drawCalls: DebugDrawCall[] = [];

  /** Met à jour la position du joueur pour le debug 3D. */
  setPlayerPosition(pos: THREE.Vector3): void {
    this.playerPos.copy(pos);
  }

  /** Met à jour la map courante. */
  setMapId(mapId: string): void {
    this.currentMapId = mapId;
  }

  update(_dt: number): void {
    const lines: string[] = [];
    const drawCalls: DebugDrawCall[] = [];

    const state = questStore.get();
    const active = state.active;
    const completed = state.completed;

    lines.push(`▓ QUÊTES (${active.length} active, ${completed.length} complétée)`);
    lines.push("");

    if (active.length === 0) {
      lines.push("  Aucune quête active.");
      lines.push(`  Complétées: ${completed.length > 0 ? completed.join(", ") : "aucune"}`);
    } else {
      for (const prog of active) {
        // `getQuest` est importé statiquement en tête de fichier. Il était
        // chargé ici par `require()`, DANS la boucle — donc à chaque quête
        // active et à chaque rafraîchissement du debugger. Deux défauts :
        //   • `require` n'existe pas dans un module ESM servi par Vite : le
        //     bloc aurait levé au premier affichage de la catégorie ;
        //   • le motif « import différé pour ne pas ralentir le module » ne
        //     tient pas — `questStore` importe déjà le catalogue, il est dans
        //     le graphe de toute façon.
        const def = getQuest(prog.id);

        if (!def) {
          lines.push(`  [!] Quête inconnue: ${prog.id}`);
          continue;
        }

        // Titre de la quête
        lines.push(`  ▸ ${def.title}  (${prog.done ? "TERMINÉE" : "EN COURS"})`);

        // Objectifs
        for (let i = 0; i < def.objectives.length; i++) {
          const obj = def.objectives[i];
          const count = prog.counts[i] ?? 0;
          const target = obj.target;
          const done = count >= target;

          const icon = done ? "✓" : "○";
          const countColor = done ? "#4ade80" : "#fbbf24";

          switch (obj.kind) {
            case "kill":
              lines.push(`    ${icon} [${countColor}]Tuer ${count}/${target} ${obj.enemyFolder ?? "ennemis"}[/]`);
              break;
            case "reach":
              lines.push(`    ${icon} [${countColor}]Atteindre ${count > 0 ? "✓" : "✗"} ${obj.zone ? `(${obj.mapId})` : ""}[/]`);
              // DebugSphere à la zone cible
              if (obj.zone) {
                const center = new THREE.Vector3(obj.zone.x, this.playerPos.y, obj.zone.z);
                drawCalls.push(DebugSphere(center, obj.zone.radius, done ? 0x4ade80 : 0xfbbf24));
                drawCalls.push(DebugText(
                  center.clone().add(new THREE.Vector3(0, 3, 0)),
                  `📌 ${def.title}`,
                  done ? 0x4ade80 : 0xfbbf24,
                ));
              }
              break;
            case "collect":
              lines.push(`    ${icon} [${countColor}]Collecter ${count}/${target} ${obj.itemId ?? "items"}[/]`);
              break;
            default:
              lines.push(`    ${icon} [${countColor}]Objectif #${i + 1}: ${count}/${target}[/]`);
          }
        }

        // Progression globale
        const totalTargets = def.objectives.length;
        const doneTargets = def.objectives.filter((_, i) =>
          (prog.counts[i] ?? 0) >= def.objectives[i].target,
        ).length;
        const pct = (doneTargets / totalTargets) * 100;
        const barLen = Math.round(pct / 5);
        const bar = "█".repeat(barLen) + "░".repeat(Math.max(0, 20 - barLen));
        lines.push(`    [${pct >= 100 ? "#4ade80" : "#fbbf24"}][${bar}] ${pct.toFixed(0)}%[/]`);
        lines.push("");
      }
    }

    // Résumé
    lines.push(`───`);
    lines.push(`questStore: ${active.length} active, ${completed.length} completed`);

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
