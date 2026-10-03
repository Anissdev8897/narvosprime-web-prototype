// npc/respawnManager.ts — cycle de vie de RÉAPPARITION des PNJ placés (hors-React, pur).
//
// Chaque PLACEMENT admin (npcPlacementStore) devient un point de spawn persistant : le
// runtime configure ici son délai (`respawnSec`, 0 = jamais), le PNJ notifie sa mort
// (front de mort dans Npc.tsx), et un tick léger (1×/s) fait réapparaître les copies
// échues — sauf si le joueur campe le point (< ANTI_CAMP_M). La réapparition incrémente
// un EPOCH par copie : le rendu re-keye le PNJ → remontage propre (assets déjà en cache
// drei → coût négligeable).
import { useSyncExternalStore } from "react";

export const DEFAULT_RESPAWN_SEC = 45;
export const ANTI_CAMP_M = 8;

interface SpawnPoint {
  respawnSec: number;                 // 0 = ne respawn jamais
  pos: [number, number, number];      // anti-camping
  dead: Map<string, number>;          // copyId → diedAt (ms)
  epoch: Map<string, number>;         // copyId → génération (clé de remount)
}

const points = new Map<string, SpawnPoint>();
let version = 0;
const listeners = new Set<() => void>();
function notify() { version++; for (const l of listeners) l(); }

export const respawnManager = {
  /** (Re)configure un point de spawn (appelé quand les placements de la map changent). */
  configure(placementId: string, respawnSec: number, pos: [number, number, number]): void {
    const p = points.get(placementId);
    if (p) { p.respawnSec = respawnSec; p.pos = pos; }
    else points.set(placementId, { respawnSec, pos, dead: new Map(), epoch: new Map() });
  },

  /** Mort d'une COPIE d'un placement (copyId = `${placementId}#k`). No-op si non configuré. */
  notifyDeath(placementId: string, copyId: string, nowMs: number): void {
    const p = points.get(placementId);
    if (!p || p.respawnSec <= 0) return; // 0 = jamais (boss scriptés, PNJ uniques)
    p.dead.set(copyId, nowMs);
  },

  /** Tick (≈1×/s) : réapparitions échues. `playerPos` pour l'anti-camping. */
  tick(nowMs: number, playerPos: { x: number; z: number }): void {
    let changed = false;
    for (const [, p] of points) {
      if (p.dead.size === 0) continue;
      for (const [copyId, diedAt] of p.dead) {
        if (nowMs - diedAt < p.respawnSec * 1000) continue;
        // Anti-camping : tant que le joueur est sur le point, la réapparition attend.
        const dx = playerPos.x - p.pos[0], dz = playerPos.z - p.pos[2];
        if (dx * dx + dz * dz < ANTI_CAMP_M * ANTI_CAMP_M) continue;
        p.dead.delete(copyId);
        p.epoch.set(copyId, (p.epoch.get(copyId) ?? 0) + 1);
        changed = true;
      }
    }
    if (changed) notify();
  },

  /** Génération de la copie — entre dans la CLÉ React (epoch+1 = remount frais). */
  epochOf(placementId: string, copyId: string): number {
    return points.get(placementId)?.epoch.get(copyId) ?? 0;
  },
  /** true si la copie est actuellement MORTE en attente de réapparition. */
  isDead(placementId: string, copyId: string): boolean {
    return points.get(placementId)?.dead.has(copyId) ?? false;
  },

  /** Changement de map / reset : tout le monde revit, époques conservées inutiles. */
  reset(): void { points.clear(); notify(); },

  subscribe(l: () => void): () => void { listeners.add(l); return () => { listeners.delete(l); }; },
  getVersion(): number { return version; },
};

/** Hook : re-render quand une réapparition a lieu. */
export function useRespawnVersion(): number {
  return useSyncExternalStore(respawnManager.subscribe, respawnManager.getVersion, respawnManager.getVersion);
}
