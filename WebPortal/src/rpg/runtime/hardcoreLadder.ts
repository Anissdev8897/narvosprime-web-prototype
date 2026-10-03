// runtime/hardcoreLadder.ts — LADDER du serveur Mort Définitive (persisté).
//
// Chaque mort héroïque inscrit une entrée : nom, niveau, tueur, durée de jeu. Le top
// s'affiche à la sélection de serveur (la vitrine du défi). localStorage = lecture
// synchrone instantanée ; saveWorldDb = cross-device (débouncé, no-op hors Electron).
import { saveWorldDb } from "../persistence/dbStore";

export interface LadderEntry {
  name: string;
  level: number;
  killedBy: string;
  diedAt: number;   // epoch ms
  playSec: number;  // durée de la session au moment de la mort
}

const KEY = "narvos:hardcore_ladder";
const DB_KEY = "hardcore_ladder";
const MAX = 50;

function load(): LadderEntry[] {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    return raw ? (JSON.parse(raw) as LadderEntry[]) : [];
  } catch { return []; }
}

export const hardcoreLadder = {
  add(entry: LadderEntry): void {
    const list = load();
    list.push(entry);
    list.sort((a, b) => b.level - a.level || b.playSec - a.playSec);
    const top = list.slice(0, MAX);
    try { if (typeof localStorage !== "undefined") localStorage.setItem(KEY, JSON.stringify(top)); } catch { /* quota */ }
    saveWorldDb(DB_KEY, top);
  },
  top(n = 10): LadderEntry[] { return load().slice(0, n); },
};

// ── Personnages TOMBÉS (mort définitive) — verrouillés à la sélection ───────────
const FALLEN_KEY = "narvos:hardcore_fallen";

/** Accessor — returns the full list of fallen character IDs without duplicating the storage key. */
export function fallenIds(): string[] {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(FALLEN_KEY) : null;
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch { return []; }
}

export function markFallen(characterId: string): void {
  try {
    const list = fallenIds();
    if (!list.includes(characterId)) list.push(characterId);
    localStorage.setItem(FALLEN_KEY, JSON.stringify(list));
    saveWorldDb(FALLEN_KEY, list);
  } catch { /* quota */ }
}

export function isFallen(characterId: string): boolean {
  return fallenIds().includes(characterId);
}
