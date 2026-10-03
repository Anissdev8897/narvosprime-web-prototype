// ══════════════════════════════════════════════════════════════════════════════
// characters/cameraCollision.ts — Toggle on/off de la collision caméra TPS
//
// Quand activée (true) :
//   • Comportement Warzone/Fortnite — la caméra se rapproche du perso quand
//     un mur s'interpose. Évite les "vues à travers les murs" en extérieur.
//   • Inconvénient : peut bloquer la caméra à l'entrée des bâtiments / dans
//     des espaces clos, donnant l'impression que le perso est repoussé.
//
// Quand désactivée (false, défaut) :
//   • La caméra passe à TRAVERS les géométries — entrée dans les bâtiments
//     parfaitement fluide.
//   • Inconvénient : en extérieur, on peut voir derrière les montagnes.
//
// Le défaut est OFF parce que (1) le user a explicitement demandé ce comportement,
// (2) on privilégie la praticité d'exploration sur le réalisme visuel.
//
// Persisté dans localStorage. Toggleable depuis l'AdminPanel (F8).
// ══════════════════════════════════════════════════════════════════════════════

const STORAGE_KEY = "narvos:cameraCollisionEnabled";

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

export const cameraCollisionStore = {
  get(): boolean {
    return current;
  },
  set(v: boolean): void {
    if (v === current) return;
    current = v;
    persist(v);
    for (const fn of listeners) fn();
  },
  toggle(): void {
    this.set(!current);
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },
};
