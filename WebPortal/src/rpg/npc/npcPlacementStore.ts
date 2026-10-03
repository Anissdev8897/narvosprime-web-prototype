// npc/npcPlacementStore.ts — placements PNJ persistés par map (source de vérité)
import { loadWorldDb, saveWorldDb } from "../persistence/dbStore";
import { preloadNpcAssets } from "./preloadNpc";
import type { FactionId } from "../runtime/core/worldTypes";
const STORAGE_KEY = "narvos:npcs:v1";
const DB_KEY = "npc_placements";

export type Rank = "mob" | "boss";

export interface PlacedNpc {
  id: string;
  folder: string;
  pos: [number, number, number];
  level: number;
  rank: Rank;
  scaleMult: number;
  hpMult: number;
  resistMult: number;
  /** rotation euler (radians) du groupe racine. Optionnel (défaut [0,0,0]). */
  rot?: [number, number, number];
  /** Délai de RÉAPPARITION (s) après la mort. 0 = jamais (boss scriptés). Défaut 45. */
  respawnSec?: number;
  /** Taille de MEUTE : nb de copies spawnées autour du point (1-5). Défaut 1. */
  packSize?: number;
  /** true = posé par le GÉNÉRATEUR de cartes (supprimable en bloc, éditable comme le reste). */
  gen?: boolean;
  /** Override faction catalogue (admin). undefined = utilise la faction du catalogue. */
  factionOverride?: FactionId;
  /** Override classId catalogue (admin) — détermine les sorts du PNJ. */
  classIdOverride?: string;
  /** Portée de détection (aggro) custom (admin). undefined = default Npc.tsx. */
  aggroRange?: number;
  /** Portée d'attaque custom (admin). undefined = default Npc.tsx. */
  attackRange?: number;
}
export type PlacedNpcCfg = Omit<PlacedNpc, "id">;

function loadInitial(): Record<string, PlacedNpc[]> {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : {}; }
  catch { return {}; }
}
let state = loadInitial();
let version = 0;
const listeners = new Set<() => void>();
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* quota */ }
  saveWorldDb(DB_KEY, state); // → base (débouncé, no-op hors Electron)
}
function notify() { version++; for (const fn of listeners) fn(); }
// id unique stable (sûr entre reloads — pas de compteur qui se réinitialise).
function makeId(): string { return "p_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

export const npcPlacementStore = {
  list(mapId: string): PlacedNpc[] { return state[mapId] ?? []; },
  add(mapId: string, cfg: PlacedNpcCfg): void {
    const arr = state[mapId] ?? (state[mapId] = []);
    arr.push({ id: makeId(), ...cfg });
    preloadNpcAssets(cfg.folder); // préchauffe le modèle+pack → pas de freeze à l'apparition
    persist(); notify();
  },
  update(mapId: string, id: string, patch: Partial<PlacedNpc>): void {
    const arr = state[mapId]; if (!arr) return;
    const i = arr.findIndex((n) => n.id === id); if (i < 0) return;
    arr[i] = { ...arr[i], ...patch };
    persist(); notify();
  },
  remove(mapId: string, id: string): void {
    const arr = state[mapId]; if (!arr) return;
    state[mapId] = arr.filter((n) => n.id !== id);
    persist(); notify();
  },
  clear(mapId: string): void { if (state[mapId]) { delete state[mapId]; persist(); notify(); } },
  /** Supprime UNIQUEMENT les placements posés par le générateur (gen=true). */
  removeGenerated(mapId: string): number {
    const arr = state[mapId]; if (!arr) return 0;
    const kept = arr.filter((n) => !n.gen);
    const removed = arr.length - kept.length;
    if (removed > 0) { state[mapId] = kept; persist(); notify(); }
    return removed;
  },
  /**
   * Re-accroche TOUS les PNJ de la map au sol réel (raycast vertical).
   *
   * POURQUOI : le gizmo de placement écrasait l'altitude à 0 au lieu d'utiliser
   * le point d'impact. Sur une map dont le terrain n'est pas au niveau 0, les
   * placements enregistrés sont donc faux — seul l'accrochage au sol à
   * l'exécution les rattrapait visuellement, et uniquement pour les PNJ posés
   * au-dessus du vide. Cette passe corrige les données une bonne fois.
   *
   * Un PNJ sans sol sous lui (au-dessus du vide) est laissé intact.
   * @returns nombre de placements corrigés.
   */
  resnapToGround(mapId: string, groundAt: (x: number, z: number) => number | null): number {
    const arr = state[mapId]; if (!arr) return 0;
    let fixed = 0;
    for (let i = 0; i < arr.length; i++) {
      const [x, y, z] = arr[i].pos;
      const gy = groundAt(x, z);
      if (gy === null || Math.abs(gy - y) < 0.01) continue;
      arr[i] = { ...arr[i], pos: [x, gy, z] };
      fixed++;
    }
    if (fixed > 0) { persist(); notify(); }
    return fixed;
  },
  subscribe(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; },
  getVersion(): number { return version; },
  /** Charge les placements depuis la base (source de vérité en Electron). À appeler une fois au boot. */
  async hydrate(): Promise<void> {
    const db = await loadWorldDb<Record<string, PlacedNpc[]>>(DB_KEY);
    if (db && typeof db === "object") { state = db; notify(); }
    // (Le préchauffe des PNJ placés est piloté par le préchargeur central — collectWarmAssets
    //  + AssetPreloader — pour garder ce store responsable UNIQUEMENT des données.)
  },
};
