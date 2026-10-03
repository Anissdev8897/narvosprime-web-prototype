// ══════════════════════════════════════════════════════════════════════════════
// runtime/debug/debugCollisions.ts — Toggle du mode debug collisions
//
// Quand activé, affiche en jeu :
//   • Capsule de collision joueur (wireframe) — vert si grounded, jaune sinon
//   • Vecteur "forward" du perso (cyan)
//   • Compteur de colliders enregistrés (overlay HUD)
//
// Persisté dans localStorage. Toggleable depuis l'AdminPanel.
// ══════════════════════════════════════════════════════════════════════════════

const STORAGE_KEY = "narvos:debugCollisions";

function loadInitial(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

let current = loadInitial();
const listeners = new Set<() => void>();

function persist(v: boolean): void {
  try {
    if (v) localStorage.setItem(STORAGE_KEY, "1");
    else   localStorage.removeItem(STORAGE_KEY);
  } catch { /* quota / private mode */ }
}

export const debugCollisionsStore = {
  get(): boolean { return current; },
  set(v: boolean): void {
    if (v === current) return;
    current = v;
    persist(v);
    for (const fn of listeners) fn();
  },
  toggle(): void { this.set(!current); },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },
};
