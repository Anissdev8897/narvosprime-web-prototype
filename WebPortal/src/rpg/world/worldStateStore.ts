// world/worldStateStore.ts — état de l'UNIVERS VIVANT persistant + tick + rattrapage hors-ligne.
//
// La simulation (worldSim) tourne lentement (1 tick / 5 min réelles). Le monde évolue MÊME
// HORS LIGNE : au chargement, on calcule le temps écoulé depuis le dernier tick et on rejoue
// les ticks manquants (plafonnés). Pendant le jeu, un intervalle avance d'un tick. Persisté
// (localStorage + base monde). Le journal des événements alimente un panneau d'actualités.
import { useSyncExternalStore } from "react";
import { loadWorldDb, saveWorldDb } from "../persistence/dbStore";
import { createWorld, stepWorld, advanceWorld, type WorldState, type WorldEvent } from "./worldSim";

const STORAGE_KEY = "narvos:world_state:v1";
const DB_KEY = "world_sim";
const TICK_MS = 5 * 60 * 1000;   // 1 tick = 5 min réelles
const CATCHUP_CAP = 500;          // borne de rattrapage hors-ligne (~41 h)
const JOURNAL_MAX = 60;           // événements gardés pour le panneau d'actualités

interface Persisted { world: WorldState; lastTickAt: number; journal: WorldEvent[]; }

function loadInitial(): Persisted {
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    if (r) return JSON.parse(r);
  } catch { /* ignore */ }
  return { world: createWorld(Math.floor((typeof performance !== "undefined" ? performance.now() : 1) * 1000) % 1e9 || 1), lastTickAt: Date.now(), journal: [] };
}

let data: Persisted = loadInitial();
let version = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();
function notify() { version++; for (const l of listeners) l(); }
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* quota */ }
  saveWorldDb(DB_KEY, data);
}
function pushJournal(evts: WorldEvent[]) {
  if (evts.length === 0) return;
  data.journal = [...evts, ...data.journal].slice(0, JOURNAL_MAX);
}

/** Avance d'un tick (jeu en cours). */
function tickOnce(nowMs: number) {
  const r = stepWorld(data.world);
  data = { world: r.state, lastTickAt: nowMs, journal: data.journal };
  pushJournal(r.newEvents);
  persist(); notify();
}

export const worldStore = {
  get(): WorldState { return data.world; },
  journal(): WorldEvent[] { return data.journal; },
  /** Indice de prix d'une région (1 = normal). Sert aux marchands/économie. */
  regionPrice(regionId: string): number { return data.world.regions[regionId]?.price ?? 1; },
  /** Faction qui contrôle une région. */
  controller(regionId: string) { return data.world.regions[regionId]?.controller; },

  /** Démarre : rattrapage hors-ligne + tick live. Idempotent. */
  start(): void {
    const now = Date.now();
    const missed = Math.min(CATCHUP_CAP, Math.floor((now - data.lastTickAt) / TICK_MS));
    if (missed > 0) {
      const r = advanceWorld(data.world, missed);
      data = { world: r.state, lastTickAt: data.lastTickAt + missed * TICK_MS, journal: data.journal };
      pushJournal(r.newEvents.slice(-JOURNAL_MAX));
      persist(); notify();
      if (r.newEvents.length) console.info(`[world] rattrapage : ${missed} ticks, ${r.newEvents.length} événements`);
    }
    if (!timer) timer = setInterval(() => tickOnce(Date.now()), TICK_MS);
  },
  stop(): void { if (timer) { clearInterval(timer); timer = null; } },

  /** Re-graine et réinitialise (debug/admin). */
  reset(seed = 1): void { data = { world: createWorld(seed), lastTickAt: Date.now(), journal: [] }; persist(); notify(); },

  async hydrate(): Promise<void> {
    const db = await loadWorldDb<Persisted>(DB_KEY);
    if (db && db.world && Array.isArray(db.journal)) { data = db; notify(); }
  },

  subscribe(l: () => void): () => void { listeners.add(l); return () => { listeners.delete(l); }; },
  getVersion: () => version,
};

export function useWorld(): WorldState {
  useSyncExternalStore(worldStore.subscribe, worldStore.getVersion, worldStore.getVersion);
  return data.world;
}
export function useWorldJournal(): WorldEvent[] {
  useSyncExternalStore(worldStore.subscribe, worldStore.getVersion, worldStore.getVersion);
  return data.journal;
}
