// ══════════════════════════════════════════════════════════════════════════════
// weapons/weaponCalibrationStore.ts — "CharacterWeaponMappingDatabase".
//
// Base d'offsets d'arme calibrés PAR COMBINAISON (type de personnage × type d'arme).
// Là où weaponOffsetStore surcharge UNE arme précise (par id), ce store mémorise un
// réglage RÉUTILISABLE : « comment un GUERRIER tient une ÉPÉE 1 main », « comment un
// ARCHER tient un ARC »… → toute arme du même type héritée par la même classe se place
// automatiquement avec le bon offset, sans re-régler arme par arme.
//
// Clé = `${characterKind}::${weaponType}` (ex: "guerrier::sword_1h", "archer::bow").
//   characterKind : ArchetypeId joueur ("guerrier"/"archer"/"mage"/"guerrier_spatial"/
//                   "ninja") OU "monster" (PNJ) OU "default" (repli universel).
//   weaponType    : sortie de classifyWeapon ("sword_1h"/"shield"/"bow"/"gun"/"staff"…).
//
// Persisté (localStorage instantané + base monde) et hydraté au boot, comme les autres
// singletons du projet. C'est le "WeaponTransformPresetManager" du cahier des charges.
// ══════════════════════════════════════════════════════════════════════════════
import { useSyncExternalStore } from "react";
import { loadWorldDb, saveWorldDb } from "../persistence/dbStore";
import type { WeaponType } from "./weaponClassifier";

/** Un override d'offset (chaque champ est optionnel → fusion partielle par-dessus la base). */
export interface WeaponCalibration {
  position?: [number, number, number];
  rotation?: [number, number, number]; // Euler XYZ radians
  scale?: number;
}

/** Type de personnage pour le calibrage (archétype joueur + catégories génériques). */
export type CharacterKind =
  | "guerrier" | "archer" | "mage" | "guerrier_spatial" | "ninja"
  | "monster" | "default";

/** Liste ordonnée + libellés FR pour l'éditeur in-game. */
export const CHARACTER_KINDS: { id: CharacterKind; label: string }[] = [
  { id: "guerrier",         label: "Guerrier" },
  { id: "archer",           label: "Archer" },
  { id: "mage",             label: "Mage" },
  { id: "guerrier_spatial", label: "Guerrier Spatial" },
  { id: "ninja",            label: "Ninja" },
  { id: "monster",          label: "Monstres / PNJ" },
  { id: "default",          label: "Défaut (universel)" },
];

const STORAGE_KEY = "narvos:weaponcalibration:v1";
const DB_KEY = "weapon_calibration";

/** Mode de port de l'arme : dégainée (en main/combat) vs rangée (au repos/dos/hanche).
 *  Permet 2 offsets distincts pour la MÊME combinaison perso×arme (comme idle base/dégainé
 *  côté animation). "drawn" = clé LEGACY sans suffixe (compat ascendante des sauvegardes). */
export type CalibMode = "drawn" | "sheathed";

/** Compose la clé composite. Exporté pour les tests + l'admin. "drawn" garde la clé
 *  historique `kind::type` ; "sheathed" ajoute le suffixe → les réglages existants restent. */
export function calibrationKey(kind: string, weaponType: string, mode: CalibMode = "drawn"): string {
  return mode === "sheathed" ? `${kind}::${weaponType}::sheathed` : `${kind}::${weaponType}`;
}

function loadInitial(): Record<string, WeaponCalibration> {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : {}; } catch { return {}; }
}
let state = loadInitial();
let version = 0;
const listeners = new Set<() => void>();
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* quota */ }
  saveWorldDb(DB_KEY, state); // → base (monde, débouncé, no-op hors Electron)
}
function notify() { version++; for (const fn of listeners) fn(); }

export const weaponCalibrationStore = {
  /** Calibrage pour (perso × type d'arme × mode), avec repli : combo exacte du mode →
   *  default du mode → (pour "sheathed" uniquement) la valeur "drawn" de la combo →
   *  default drawn. Ainsi une arme sans réglage rangé hérite de son réglage dégainé. */
  resolve(kind: string, weaponType: WeaponType | string, mode: CalibMode = "drawn"): WeaponCalibration | undefined {
    return (
      state[calibrationKey(kind, weaponType, mode)] ??
      state[calibrationKey("default", weaponType, mode)] ??
      (mode === "sheathed"
        ? state[calibrationKey(kind, weaponType, "drawn")] ?? state[calibrationKey("default", weaponType, "drawn")]
        : undefined)
    );
  },
  /** Calibrage EXACT (sans repli) — pour l'éditeur (affiche la valeur de la combo+mode en cours). */
  getExact(kind: string, weaponType: WeaponType | string, mode: CalibMode = "drawn"): WeaponCalibration | undefined {
    return state[calibrationKey(kind, weaponType, mode)];
  },
  set(kind: string, weaponType: WeaponType | string, patch: WeaponCalibration, mode: CalibMode = "drawn"): void {
    const k = calibrationKey(kind, weaponType, mode);
    state = { ...state, [k]: { ...state[k], ...patch } };
    persist(); notify();
  },
  reset(kind: string, weaponType: WeaponType | string, mode: CalibMode = "drawn"): void {
    const k = calibrationKey(kind, weaponType, mode);
    if (state[k]) { const n = { ...state }; delete n[k]; state = n; persist(); notify(); }
  },
  all(): Record<string, WeaponCalibration> { return state; },
  subscribe(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; },
  getVersion(): number { return version; },
  /** Charge les calibrages depuis la base (À appeler une fois au boot). */
  async hydrate(): Promise<void> {
    const db = await loadWorldDb<Record<string, WeaponCalibration>>(DB_KEY);
    if (db && typeof db === "object") { state = db; notify(); }
  },
};

/** Hook : version du store (re-render à chaque réglage live). */
export function useWeaponCalibration(): number {
  useSyncExternalStore(weaponCalibrationStore.subscribe, weaponCalibrationStore.getVersion, weaponCalibrationStore.getVersion);
  return weaponCalibrationStore.getVersion();
}
