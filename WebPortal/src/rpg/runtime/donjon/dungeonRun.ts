// donjon/dungeonRun.ts — état d'un RUN de donjon (hors-React, pur).
//
// Cycle : idle → (clé consommée à l'entrée) inProgress → (mort du boss) bossDown →
// (coffre ouvert) idle. Sortir / mourir pendant le run → run perdu (la clé est consommée :
// le risque fait le sel). Re-entrer = nouvelle clé = nouveau run.
import { useSyncExternalStore } from "react";

export type RunState = "idle" | "inProgress" | "bossDown";

let state: RunState = "idle";
let chestPos: [number, number, number] | null = null;
let version = 0;
const listeners = new Set<() => void>();
function notify() { version++; for (const l of listeners) l(); }
function set(s: RunState, pos: [number, number, number] | null) {
  state = s; chestPos = pos; notify();
}

export const dungeonRun = {
  get state(): RunState { return state; },
  get chestPos(): [number, number, number] | null { return chestPos; },

  /** Entrée au donjon (clé déjà consommée par l'appelant). */
  start(): void { set("inProgress", null); },

  /** Mort du BOSS pendant un run → le coffre apparaît à sa position. */
  bossKilled(pos: [number, number, number]): void {
    if (state !== "inProgress") return; // boss tué hors run (admin/debug) → pas de coffre
    set("bossDown", pos);
  },

  /** Coffre ouvert → le run se clôt (les récompenses sont gérées par l'appelant). */
  chestOpened(): void { if (state === "bossDown") set("idle", null); },

  /** Sortie du donjon / mort du joueur / changement de map → run perdu. */
  abandon(): void { if (state !== "idle") set("idle", null); },

  subscribe(l: () => void): () => void { listeners.add(l); return () => { listeners.delete(l); }; },
  getVersion(): number { return version; },
};

export function useDungeonRun(): { state: RunState; chestPos: [number, number, number] | null } {
  useSyncExternalStore(dungeonRun.subscribe, dungeonRun.getVersion, dungeonRun.getVersion);
  return { state: dungeonRun.state, chestPos: dungeonRun.chestPos };
}
