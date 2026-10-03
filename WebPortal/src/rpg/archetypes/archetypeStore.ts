// archetypes/archetypeStore.ts — archétype ACTIF du joueur (persisté par perso).
// Même patron que professionStore : localStorage instantané + hydratation base.
import { useSyncExternalStore } from "react";
import { ARCHETYPE_IDS, type ArchetypeId } from "./archetypeCatalog";
import { loadCharacterDb, saveCharacterDb } from "../persistence/dbStore";

const DB_KEY = "archetype";
const keyOf = (charId: string) => `narvos:archetype:${charId}`;
const isValid = (v: unknown): v is ArchetypeId => typeof v === "string" && (ARCHETYPE_IDS as string[]).includes(v);

class ArchetypeStore {
  private charId = "";
  private current: ArchetypeId | null = null;
  private version = 0;
  private listeners = new Set<() => void>();

  setCharacter(charId: string): void {
    this.charId = charId;
    this.current = this.loadLocal(charId);
    this.bump();
    if (charId) {
      loadCharacterDb<ArchetypeId>(charId, DB_KEY).then((db) => {
        if (this.charId === charId && isValid(db)) { this.current = db; this.bump(); }
      });
    }
  }

  get(): ArchetypeId | null { return this.current; }

  set(id: ArchetypeId): void {
    this.current = id;
    if (this.charId) {
      try { localStorage.setItem(keyOf(this.charId), id); } catch { /* quota */ }
      saveCharacterDb(this.charId, DB_KEY, id);
    }
    this.bump();
  }

  getVersion = (): number => this.version;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  };

  private loadLocal(charId: string): ArchetypeId | null {
    if (!charId) return null;
    try { const v = localStorage.getItem(keyOf(charId)); return isValid(v) ? v : null; }
    catch { return null; }
  }
  private bump(): void { this.version++; for (const fn of this.listeners) fn(); }
}

export const archetypeStore = new ArchetypeStore();

/** Hook React : archétype actif (null = non choisi). */
export function useArchetype(): ArchetypeId | null {
  useSyncExternalStore(archetypeStore.subscribe, archetypeStore.getVersion, archetypeStore.getVersion);
  return archetypeStore.get();
}
