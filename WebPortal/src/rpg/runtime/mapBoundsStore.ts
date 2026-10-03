// ══════════════════════════════════════════════════════════════════════════════
// runtime/mapBoundsStore.ts — MURS INVISIBLES par map, posés à la main en admin.
//
// POURQUOI CE STORE EXISTE
// Les limites de map étaient jusqu'ici deux constantes codées en dur dans
// `CharacterController` : un seuil de chute à y < -50 et un renvoi à (0, 5, 0).
// Sur la Forge, dont le sol au point d'apparition est à y ≈ -27,8 et dont la
// géométrie est décalée de [181, -401, -47], ces deux valeurs se retournaient
// contre le joueur : moins de 22 unités de marge avant le seuil, et un « retour
// au départ » qui atterrit dans le vide. C'est ce qu'on prenait pour un mur
// invisible ramenant au point de départ.
//
// La limite d'une map n'est pas une constante du moteur : c'est une donnée de
// contenu, propre à chaque map, qui ne se devine pas depuis le code. Elle vit
// donc ici, éditable et persistée, comme les placements de PNJ ou les points de
// spawn — mêmes conventions que `spawnPointStore`, même hydratation.
//
// DEUX MODES, ET LA DIFFÉRENCE COMPTE
//   • `block`  : volume INTERDIT. On ne peut pas y entrer. Test en 3D — c'est un
//                obstacle réel (une fosse, une zone en travaux, un décor creux).
//   • `keepIn` : volume AUTORISÉ. On ne peut pas en sortir. Test HORIZONTAL
//                seulement (x/z), délibérément : un test vertical ferait de la
//                limite de map un plafond, et le joueur se cognerait la tête en
//                sautant ou en décollant. L'altitude est déjà bornée ailleurs
//                (limite spatiale des vaisseaux).
//
// Un seul `keepIn` suffit à cerner une map — c'est le cas d'usage principal, et
// c'est pour ça qu'il existe plutôt que d'obliger à poser quatre `block`.
// ══════════════════════════════════════════════════════════════════════════════

import { useSyncExternalStore } from "react";
import { loadWorldDb, saveWorldDb } from "../persistence/dbStore";

const STORAGE_KEY = "narvos:map_bounds:v1";
const DB_KEY = "map_bounds";

export type WallMode = "block" | "keepIn";

export interface MapWall {
  /** Identifiant d'instance — deux murs identiques restent manipulables séparément. */
  id: string;
  /** Nom lisible, affiché dans la liste de l'éditeur. */
  label: string;
  mode: WallMode;
  center: [number, number, number];
  /** Dimensions COMPLÈTES (pas des demi-tailles) — ce que l'admin lit dans l'UI. */
  size: [number, number, number];
  /** Rotation autour de Y, en radians. Permet de suivre une map non alignée aux axes. */
  yaw: number;
  /** Désactivable sans être supprimé — indispensable pour comparer avec/sans. */
  enabled: boolean;
}

export interface MapBounds {
  walls: MapWall[];
  /**
   * Altitude sous laquelle le joueur est considéré comme TOMBÉ.
   *
   * `null` = repli automatique (cf. `fallFloor`). Une valeur absolue plutôt
   * qu'une marge : le sol de chaque map est à une hauteur différente, et c'est
   * précisément la constante globale -50 qui a produit le bug d'origine.
   */
  fallY: number | null;
}

/** Map vide — jamais `undefined`, pour que les appelants n'aient pas à tester. */
const VIDE: MapBounds = { walls: [], fallY: null };

/**
 * Écart entre le plus bas point mesuré et le seuil de chute.
 *
 * DÉLIBÉRÉMENT LARGE. Un premier réglage à 20 unités a redonné exactement le bug
 * qu'on venait de corriger, sous un autre nom : la limite mesurée de la Forge
 * plaçait le seuil à -38,18 alors que le sol au point d'apparition est à -27,8 —
 * dix unités de marge. Toute descente déclenchait le renvoi, ce qui se ressent
 * comme « un trigger empêche d'aller plus bas ».
 *
 * Ce seuil n'a qu'un seul rôle : empêcher une chute INFINIE. Le placer très bas
 * ne coûte rien — au pire le joueur tombe une seconde de plus — alors que le
 * placer trop haut casse le déplacement normal. L'asymétrie du risque impose la
 * générosité.
 */
const MARGE_CHUTE = 300;

function loadInitial(): Record<string, MapBounds> {
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    return r ? (JSON.parse(r) as Record<string, MapBounds>) : {};
  } catch {
    return {};
  }
}

let state: Record<string, MapBounds> = loadInitial();
let version = 0;
const listeners = new Set<() => void>();

/**
 * Map courante — posée par le runtime au montage et à chaque voyage.
 *
 * Elle existe pour que `CharacterController` reste du TS pur, sans la moindre
 * notion de map : il interroge « suis-je bloqué ici ? » et le store sait de
 * quelle map il parle. Même contrat que `collisionWorld`, qui connaît la scène
 * active sans que les contrôleurs aient à la porter.
 */
let activeMap = "";

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota */
  }
  saveWorldDb(DB_KEY, state);
}

function notify(): void {
  version++;
  for (const l of listeners) l();
}

function ensure(mapId: string): MapBounds {
  return state[mapId] ?? VIDE;
}

function write(mapId: string, next: MapBounds): void {
  state = { ...state, [mapId]: next };
  persist();
  notify();
}

/**
 * Le point (x, z) est-il DANS l'emprise horizontale du mur, à `marge` près ?
 *
 * `marge` élargit le volume pour un test `block` (le joueur a un rayon, on
 * l'arrête avant qu'il ne pénètre) et le RÉTRÉCIT pour un `keepIn` (on l'arrête
 * avant qu'il ne dépasse). L'appelant passe donc le signe qui convient.
 */
function dansEmpriseXZ(w: MapWall, x: number, z: number, marge: number): boolean {
  // Passage en repère local du mur : on translate, puis on tourne de -yaw.
  const dx = x - w.center[0];
  const dz = z - w.center[2];
  const c = Math.cos(-w.yaw);
  const s = Math.sin(-w.yaw);
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  return Math.abs(lx) <= w.size[0] / 2 + marge && Math.abs(lz) <= w.size[2] / 2 + marge;
}

/** Le point est-il dans la tranche verticale du mur ? (hauteur pleine, sans marge) */
function dansEmpriseY(w: MapWall, y: number): boolean {
  return Math.abs(y - w.center[1]) <= w.size[1] / 2;
}

export const mapBoundsStore = {
  /** Limites de cette map. Objet VIDE si rien n'est défini — jamais `undefined`. */
  get(mapId: string): MapBounds {
    return ensure(mapId);
  },

  walls(mapId: string): MapWall[] {
    return ensure(mapId).walls;
  },

  /** Déclare la map active. À appeler au montage et à chaque voyage. */
  setActiveMap(mapId: string): void {
    activeMap = mapId;
  },

  activeMap(): string {
    return activeMap;
  },

  /** Ajoute un mur et retourne l'entrée créée (avec son id). */
  add(mapId: string, w: Omit<MapWall, "id"> & { id?: string }): MapWall {
    const b = ensure(mapId);
    const entree: MapWall = { ...w, id: w.id ?? `wall_${mapId}_${version}_${b.walls.length}` };
    write(mapId, { ...b, walls: [...b.walls, entree] });
    return entree;
  },

  /** Modifie un mur en place (patch partiel). Sans effet si l'id est inconnu. */
  update(mapId: string, id: string, patch: Partial<Omit<MapWall, "id">>): void {
    const b = ensure(mapId);
    if (!b.walls.some((w) => w.id === id)) return;
    write(mapId, {
      ...b,
      walls: b.walls.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    });
  },

  remove(mapId: string, id: string): void {
    const b = ensure(mapId);
    if (!b.walls.some((w) => w.id === id)) return;
    write(mapId, { ...b, walls: b.walls.filter((w) => w.id !== id) });
  },

  /** Fixe l'altitude de chute pour cette map. `null` rétablit le repli automatique. */
  setFallY(mapId: string, y: number | null): void {
    write(mapId, { ...ensure(mapId), fallY: y });
  },

  /**
   * Altitude de chute effective pour cette map.
   *
   * À défaut de réglage admin, on descend sous le plus bas des `keepIn` posés —
   * ils cernent la zone jouable, donc leur base est un plancher plausible. Sans
   * aucun mur, on retombe sur `repli`, que l'appelant calcule depuis le sol réel
   * (et NON sur une constante globale : c'était l'erreur d'origine).
   */
  fallFloor(mapId: string, repli: number): number {
    const b = ensure(mapId);
    if (b.fallY !== null) return b.fallY;
    let bas = Infinity;
    for (const w of b.walls) {
      if (!w.enabled || w.mode !== "keepIn") continue;
      bas = Math.min(bas, w.center[1] - w.size[1] / 2);
    }
    return Number.isFinite(bas) ? bas - MARGE_CHUTE : repli;
  },

  /**
   * Ce point est-il interdit sur cette map ?
   *
   * `radius` est le rayon horizontal du joueur : on l'arrête AVANT le contact,
   * jamais après — un test au centre laisserait la moitié du corps traverser.
   */
  blocks(mapId: string, x: number, y: number, z: number, radius = 0): boolean {
    for (const w of ensure(mapId).walls) {
      if (!w.enabled) continue;
      if (w.mode === "block") {
        // Volume interdit : bloqué si on est DEDANS, en 3D.
        if (dansEmpriseXZ(w, x, z, radius) && dansEmpriseY(w, y)) return true;
      } else {
        // Volume autorisé : bloqué si on en SORT. Horizontal uniquement — un
        // test vertical transformerait la limite de map en plafond.
        if (!dansEmpriseXZ(w, x, z, -radius)) return true;
      }
    }
    return false;
  },

  /** Idem, sur la map active. C'est ce qu'appelle le contrôleur de personnage. */
  blocksActive(x: number, y: number, z: number, radius = 0): boolean {
    if (!activeMap) return false;
    return mapBoundsStore.blocks(activeMap, x, y, z, radius);
  },

  subscribe(l: () => void): () => void {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },

  getVersion: (): number => version,

  async hydrate(): Promise<void> {
    const db = await loadWorldDb<Record<string, MapBounds>>(DB_KEY);
    if (db && typeof db === "object") {
      state = db;
      notify();
    }
  },

  /** Réservé aux TESTS — repart d'un état vide. */
  __resetForTest(): void {
    state = {};
    activeMap = "";
    version = 0;
  },
};

/** Pont React — re-rend quand un mur bouge. */
export function useMapBoundsVersion(): number {
  return useSyncExternalStore(
    mapBoundsStore.subscribe,
    mapBoundsStore.getVersion,
    mapBoundsStore.getVersion,
  );
}
