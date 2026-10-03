// characters/customEquipmentStore.ts — BIBLIOTHÈQUE d'ÉQUIPEMENTS no-code (persistée).
//
// Une pièce = un GLB + un socket (Head/Spine/Main) + un offset TUNÉ UNE FOIS, nommée et
// catégorisée. Réutilisable sur n'importe quel perso (Forge Personnages → onglet Bibliothèque
// → la pièce s'ajoute comme attachement avec son offset pré-réglé). Évite de re-tuner à chaque fois.
import { useSyncExternalStore } from "react";
import { loadWorldDb, saveWorldDb } from "../persistence/dbStore";
import type { SocketName } from "../weapons/weaponTypes";

export type EquipCategory = "casque" | "cape" | "arme" | "accessoire";

export interface EquipmentItem {
  id: string;
  name: string;
  category: EquipCategory;
  path: string;                         // GLB (models_index)
  socket: SocketName;                    // Head | Spine | RightHand | LeftHand
  offsetPos: [number, number, number];   // mètres
  offsetRot: [number, number, number];   // euler radians
  scale: number;
  updatedAt: number;
}

const STORAGE_KEY = "narvos:equipment_lib:v1";
const DB_KEY = "equipment_lib";

function loadInitial(): EquipmentItem[] {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
}
let items: EquipmentItem[] = loadInitial();
let version = 0;
const listeners = new Set<() => void>();
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch { /* quota */ }
  saveWorldDb(DB_KEY, items);
}
function notify() { version++; for (const l of listeners) l(); }
const uid = () => "eq_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const DEFAULT_SOCKET: Record<EquipCategory, SocketName> = { casque: "Head", cape: "Spine", arme: "RightHand", accessoire: "Spine" };

export const customEquipmentStore = {
  list(): EquipmentItem[] { return items; },
  get(id: string): EquipmentItem | undefined { return items.find((i) => i.id === id); },

  create(name: string, path: string, category: EquipCategory): EquipmentItem {
    const it: EquipmentItem = {
      id: uid(), name: name.trim() || "Pièce", category, path,
      socket: DEFAULT_SOCKET[category], offsetPos: [0, 0, 0], offsetRot: [0, 0, 0], scale: 1, updatedAt: Date.now(),
    };
    items = [...items, it];
    persist(); notify();
    return it;
  },
  save(id: string, patch: Partial<Omit<EquipmentItem, "id">>): void {
    const i = items.findIndex((x) => x.id === id);
    if (i < 0) return;
    items = items.slice();
    items[i] = { ...items[i], ...patch, updatedAt: Date.now() };
    persist(); notify();
  },
  remove(id: string): void { items = items.filter((i) => i.id !== id); persist(); notify(); },

  async hydrate(): Promise<void> {
    const db = await loadWorldDb<EquipmentItem[]>(DB_KEY);
    if (db && Array.isArray(db)) { items = db; notify(); }
  },

  subscribe(l: () => void): () => void { listeners.add(l); return () => { listeners.delete(l); }; },
  getVersion: () => version,
};

export function useEquipmentLib(): EquipmentItem[] {
  useSyncExternalStore(customEquipmentStore.subscribe, customEquipmentStore.getVersion, customEquipmentStore.getVersion);
  return items;
}
