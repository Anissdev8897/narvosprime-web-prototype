// characters/characterOffsetStore.ts — offset d'orientation PAR (avatar × ÉTAT × animation).
//
// ÉTAT = "base" (arme rangée → anims propres du perso) ou "drawn" (arme dégainée → anims
// de pack). C'est CRUCIAL : l'idle rangé (clip Sorcier, droit) et l'idle dégainé (clip de
// pack, parfois retourné) sont DEUX animations distinctes → chacune son offset. Sinon
// régler l'un inverse l'autre. Clé = `${avatar}::${mode}::${action}`. Persisté + hydraté.
import { useSyncExternalStore } from "react";
import { loadWorldDb, saveWorldDb } from "../persistence/dbStore";
import type { ActionId } from "../types";

export type OffsetMode = "base" | "drawn";

export interface CharacterOffset {
  position: [number, number, number];
  rotation: [number, number, number]; // Euler XYZ radians (groupe local)
}

/** Animations réglables (= ActionId de l'AnimationController). */
export const OFFSET_ACTIONS: ActionId[] = [
  "idle", "walk", "run", "sprint", "jump", "attack", "cast", "channeling", "hit", "death", "dodge", "ultimate",
];

const ZERO: CharacterOffset = { position: [0, 0, 0], rotation: [0, 0, 0] };

/**
 * Offsets par DÉFAUT, appliqués tant que l'utilisateur n'a rien réglé.
 *
 * VIDE volontairement. Une entrée `crouch: [0, +0.42, 0]` a existé ici, fondée
 * sur l'idée que les rotations du clip conservaient la descente du bassin et
 * qu'il fallait donc remonter le personnage. La cinématique directe sur les
 * assets réels dit l'inverse : `pelvis` est un enfant DIRECT de `root`, aucune
 * rotation ne translate son origine, et il reste à 0,968 dans tous les cas.
 * Toute la descente (0,373) vivait dans la piste `pelvis.position`, supprimée
 * par `remapClipsToRig`. L'offset relevait donc une pose déjà trop haute.
 *
 * La réinjection se fait maintenant dans OwnAnimPlayerCharacter, pilotée par
 * l'état `crouching` et multipliée par l'échelle du rig — pas ici, où une
 * constante non scalée serait fausse de 14 % d'un avatar à l'autre.
 */
const ACTION_DEFAULTS: Record<string, CharacterOffset> = {};
const STORAGE_KEY = "narvos:characteroffset:v3";
const DB_KEY = "character_offset_v3";

const keyOf = (avatar: string, mode: string, action: string) => `${avatar}::${mode}::${action}`;

function loadInitial(): Record<string, CharacterOffset> {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : {}; } catch { return {}; }
}
let state = loadInitial();
let version = 0;
const listeners = new Set<() => void>();
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* quota */ }
  saveWorldDb(DB_KEY, state);
}
function notify() { version++; for (const fn of listeners) fn(); }

export const characterOffsetStore = {
  /** Offset pour (avatar × état × animation). Toujours défini (zéro par défaut). */
  get(avatar: string | undefined, mode: OffsetMode, action: string): CharacterOffset {
    // Réglage utilisateur > défaut par action > zéro.
    return (avatar && state[keyOf(avatar, mode, action)])
      || ACTION_DEFAULTS[action]
      || ZERO;
  },
  set(avatar: string, mode: OffsetMode, action: string, patch: Partial<CharacterOffset>): void {
    const k = keyOf(avatar, mode, action);
    const cur = state[k] ?? ZERO;
    state = { ...state, [k]: { ...cur, ...patch } };
    persist(); notify();
  },
  reset(avatar: string, mode: OffsetMode, action: string): void {
    const k = keyOf(avatar, mode, action);
    if (state[k]) { const n = { ...state }; delete n[k]; state = n; persist(); notify(); }
  },
  subscribe(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; },
  getVersion(): number { return version; },
  async hydrate(): Promise<void> {
    const db = await loadWorldDb<Record<string, CharacterOffset>>(DB_KEY);
    if (db && typeof db === "object") { state = db; notify(); }
  },
};

/** Hook : version du store (re-render au réglage live). */
export function useCharacterOffset(): number {
  useSyncExternalStore(characterOffsetStore.subscribe, characterOffsetStore.getVersion, characterOffsetStore.getVersion);
  return characterOffsetStore.getVersion();
}
