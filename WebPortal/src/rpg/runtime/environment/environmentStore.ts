// environment/environmentStore.ts — source de vérité unique (persistée par map)
// Mirroir du pattern characterScaleStore : get/set/reset/subscribe + localStorage.
import { DEFAULT_ENV, FALLBACK_ENV, type EnvConfig } from "./environmentTypes";
import { loadWorldDb, saveWorldDb } from "../../persistence/dbStore";

const STORAGE_KEY = "narvos:env:v1";
const DB_KEY = "environment";

/** Résolution PURE : override stocké (mergé sur défaut) → défaut map → FALLBACK. Jamais undefined. */
export function resolveEnv(stored: Record<string, Partial<EnvConfig>>, mapId: string): EnvConfig {
  const base = DEFAULT_ENV[mapId] ?? FALLBACK_ENV;
  const ov = stored[mapId];
  return ov ? { ...base, ...ov } : base;
}

function loadInitial(): Record<string, Partial<EnvConfig>> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; } // localStorage absent (Node/SSR) ou corrompu → vide
}

let state = loadInitial();
let version = 0;
const listeners = new Set<() => void>();

function persist(): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* quota / pas de localStorage */ }
  saveWorldDb(DB_KEY, state); // → base (monde/admin, débouncé, no-op hors Electron)
}
function notify(): void { version++; for (const fn of listeners) fn(); }

export const environmentStore = {
  /** Config résolue pour une map (jamais undefined). */
  get(mapId: string): EnvConfig { return resolveEnv(state, mapId); },
  /** Applique un patch partiel à une map, persiste, notifie. */
  set(mapId: string, patch: Partial<EnvConfig>): void {
    state[mapId] = { ...(state[mapId] ?? {}), ...patch };
    persist(); notify();
  },
  /** Supprime l'override d'une map → revient au défaut. */
  reset(mapId: string): void {
    if (mapId in state) { delete state[mapId]; persist(); notify(); }
  },
  /** Abonnement (retourne un unsubscribe) — compatible useSyncExternalStore. */
  subscribe(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; },
  /** Snapshot STABLE (compteur de version) → déclencheur de re-render sans boucle. */
  getVersion(): number { return version; },
  /** Charge le tuning d'environnement depuis la base (monde). À appeler une fois au boot. */
  async hydrate(): Promise<void> {
    const db = await loadWorldDb<Record<string, Partial<EnvConfig>>>(DB_KEY);
    if (db && typeof db === "object") { state = db; notify(); }
  },
};
