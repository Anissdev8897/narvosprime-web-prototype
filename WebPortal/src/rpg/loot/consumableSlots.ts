// ══════════════════════════════════════════════════════════════════════════════
// loot/consumableSlots.ts — Slots fixes de consommables (style action bar)
//
// 3 slots assignables (index 0/1/2) qui mémorisent un itemId. Les touches 4/5/6
// déclenchent l'utilisation du consommable du slot correspondant.
//
// Persistance par PERSO (clé localStorage = char id) :
//   • Loadout différent par perso (chacun ses combats de prédilection)
//   • Survit aux changements de map et redémarrages
//
// Aucune dépendance React → utilisable depuis le store et les handlers du
// gameworld. Le hook `useConsumableSlots` (cf. fichier voisin) fait le pont.
// ══════════════════════════════════════════════════════════════════════════════

import { loadCharacterDb, saveCharacterDb } from "../persistence/dbStore";

export type ConsumableSlots = [string | null, string | null, string | null];

const EMPTY: ConsumableSlots = [null, null, null];
const DB_KEY = "consumable_slots";

const keyOf = (charId: string) => `narvos:consumableSlots:${charId}`;

/** Normalise une valeur sauvegardée (array) → 3 slots sûrs. */
function sanitize(parsed: unknown): ConsumableSlots {
  if (!Array.isArray(parsed) || parsed.length !== 3) return [...EMPTY] as ConsumableSlots;
  return parsed.map((s) => (typeof s === "string" ? s : null)) as ConsumableSlots;
}

function load(charId: string): ConsumableSlots {
  if (!charId) return [...EMPTY] as ConsumableSlots;
  try { const raw = localStorage.getItem(keyOf(charId)); return sanitize(raw ? JSON.parse(raw) : null); }
  catch { return [...EMPTY] as ConsumableSlots; }
}

function persist(charId: string, slots: ConsumableSlots): void {
  if (!charId) return;
  try { localStorage.setItem(keyOf(charId), JSON.stringify(slots)); }
  catch { /* quota */ }
  saveCharacterDb(charId, DB_KEY, slots); // → base (débouncé, no-op hors Electron)
}

class ConsumableSlotsStore {
  private charId = "";
  private slots: ConsumableSlots = [...EMPTY] as ConsumableSlots;
  private listeners = new Set<() => void>();

  /** Initialise/recharge pour un perso donné. À appeler au boot du gameworld. */
  setCharacter(charId: string): void {
    this.charId = charId;
    this.slots = load(charId);   // localStorage : instantané
    this.notify();
    if (charId) {
      loadCharacterDb<unknown>(charId, DB_KEY).then((db) => {
        if (db != null && this.charId === charId) { this.slots = sanitize(db); this.notify(); }
      });
    }
  }

  /** Lecture courante des 3 slots (référence stable entre appels si pas de set). */
  get(): ConsumableSlots {
    return this.slots;
  }

  /** Assigne un itemId à un slot 0/1/2. null = vider le slot. */
  setSlot(index: 0 | 1 | 2, itemId: string | null): void {
    const next = [...this.slots] as ConsumableSlots;
    next[index] = itemId;
    this.slots = next;
    persist(this.charId, next);
    this.notify();
  }

  /** Lit l'itemId au slot 0/1/2 (ou null). */
  getSlot(index: 0 | 1 | 2): string | null {
    return this.slots[index] ?? null;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  private notify(): void {
    for (const fn of this.listeners) fn();
  }
}

export const consumableSlotsStore = new ConsumableSlotsStore();
