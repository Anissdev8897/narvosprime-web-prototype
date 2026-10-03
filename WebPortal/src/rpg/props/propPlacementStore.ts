// props/propPlacementStore.ts — placements de props (décors) persistés par map.
// Pattern identique à npcPlacementStore : singleton mutable + useSyncExternalStore,
// persistance localStorage, listeners manuels.

const STORAGE_KEY = "narvos_props_v1";

/** Instance d'un prop placé sur une map. */
export interface PlacedProp {
  /** Identifiant unique de cette instance (généré à l'ajout). */
  uid: string;
  /** Référence vers PROP_CATALOG (PropDef.id). */
  propId: string;
  /** Identifiant de la map (ex: "orbital", "forge"). */
  mapId: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

// ── État interne ───────────────────────────────────────────────────────────────

function loadInitial(): Record<string, PlacedProp[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

let state = loadInitial();
let version = 0;
const listeners = new Set<() => void>();

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota dépassé — silencieux */
  }
}

function notify(): void {
  version++;
  for (const fn of listeners) fn();
}

/** Génère un identifiant unique stable entre reloads. */
function makeUid(): string {
  return "prop_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── API publique ───────────────────────────────────────────────────────────────

export const propPlacementStore = {
  /** Retourne la liste des props placés pour la map donnée. */
  getForMap(mapId: string): PlacedProp[] {
    return state[mapId] ?? [];
  },

  /** Ajoute un nouveau prop placé. */
  add(prop: PlacedProp): void {
    const arr = state[prop.mapId] ?? (state[prop.mapId] = []);
    arr.push({ ...prop, uid: prop.uid || makeUid() });
    persist();
    notify();
  },

  /** Met à jour un prop existant (merge partiel). */
  update(uid: string, patch: Partial<PlacedProp>): void {
    for (const mapId of Object.keys(state)) {
      const arr = state[mapId];
      const i = arr.findIndex((p) => p.uid === uid);
      if (i < 0) continue;
      arr[i] = { ...arr[i], ...patch };
      persist();
      notify();
      return;
    }
  },

  /** Supprime un prop placé par son uid. */
  remove(uid: string): void {
    for (const mapId of Object.keys(state)) {
      const arr = state[mapId];
      const filtered = arr.filter((p) => p.uid !== uid);
      if (filtered.length !== arr.length) {
        state[mapId] = filtered;
        persist();
        notify();
        return;
      }
    }
  },

  /** Supprime TOUS les props d'une map. */
  clear(mapId: string): void {
    if (state[mapId]) {
      delete state[mapId];
      persist();
      notify();
    }
  },

  /** Abonnement pour useSyncExternalStore. */
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },

  /** Version incrémentale (snapshot pour useSyncExternalStore). */
  getVersion(): number {
    return version;
  },
};

/** Génère un uid pour usage externe (ex: PropAdminPanel). */
export function makePropUid(): string {
  return makeUid();
}
