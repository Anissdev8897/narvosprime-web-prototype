// npc/npcAdminStore.ts — config courante de l'éditeur PNJ + mode placement (transitoire)
import { getNpcsByRole } from "./npcCatalog";
import type { Rank } from "./npcPlacementStore";
import type { FactionId } from "../runtime/core/worldTypes";

export interface NpcAdminConfig {
  folder: string;
  level: number;
  scaleMult: number;
  hpMult: number;
  resistMult: number;
  rank: Rank;
  placementActive: boolean;
  /** id du PNJ placé sélectionné pour le gizmo de transformation (null = aucun). */
  selectedId: string | null;
  /** mode du gizmo : déplacement (axes) ou rotation. */
  gizmoMode: "translate" | "rotate";
  /** Override faction catalogue. undefined = faction du catalogue. */
  factionOverride?: FactionId;
  /** Override classId → détermine les sorts. undefined = classId catalogue. */
  classIdOverride?: string;
  /** Portée de détection (aggro). undefined = default Npc.tsx. */
  aggroRange?: number;
  /** Portée d'attaque. undefined = default Npc.tsx. */
  attackRange?: number;
}

const firstEnemy = getNpcsByRole("enemy")[0]?.folder ?? "Grunt";
let cfg: NpcAdminConfig = {
  folder: firstEnemy, level: 1, scaleMult: 1, hpMult: 1, resistMult: 0, rank: "mob", placementActive: false,
  selectedId: null, gizmoMode: "translate",
};
let version = 0;
const listeners = new Set<() => void>();
function notify() { version++; for (const fn of listeners) fn(); }

export const npcAdminStore = {
  get(): NpcAdminConfig { return cfg; },
  set(patch: Partial<NpcAdminConfig>): void { cfg = { ...cfg, ...patch }; notify(); },
  subscribe(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; },
  getVersion(): number { return version; },
};
