// ══════════════════════════════════════════════════════════════════════════════
// materials/terrainMaterialStore.ts — Choix de couches de terrain de l'éditeur.
//
// Singleton hors-React (comme `gameSettings`, `collisionWorld`, `npcRegistry`),
// ponté vers React par `useSyncExternalStore` — l'UI doit réagir, mais le monde
// 3D ne se re-rend PAS via React : il lit le compteur de génération de
// `autoMaterialStore` à chaque frame.
//
// Ce fichier ne connaît que des IDENTIFIANTS de couche, jamais des chemins de
// fichiers. C'est délibéré : une faute de frappe dans un chemin ne se voit qu'au
// runtime, et le fallback SPA de Vite renvoie du `text/html` en 200 au lieu d'un
// 404 (cf. CLAUDE.md) — donc pas d'erreur, juste une texture vide.
// ══════════════════════════════════════════════════════════════════════════════

import { useSyncExternalStore } from "react";
import {
  buildAutoMaterial, TERRAIN_LAYERS,
  type TerrainLayerId, type AutoMaterialConfig,
} from "./autoMaterialConfig";
import { setAutoMaterialConfig } from "./autoMaterialStore";

/** Sélection de l'éditeur. Trois couches + les bornes de la bande de transition. */
export interface TerrainSelection {
  /** Couche des surfaces horizontales. */
  flat: TerrainLayerId;
  /** Couche des parois. */
  steep: TerrainLayerId;
  /** Couche de transition. `null` = transition directe entre les deux autres. */
  mid: TerrainLayerId | null;
  /** Pente à laquelle `flat` commence à céder (0 = horizontal, 1 = vertical). */
  slopeStart: number;
  /** Pente à laquelle `steep` a totalement pris le dessus. */
  slopeEnd: number;
  /** Amplitude du masque qui casse la régularité de la frontière. */
  variationStrength: number;
}

/** Réglage d'origine — identique à `FORGE_AUTO_MATERIAL`, vérifié par un test. */
export const DEFAULT_SELECTION: TerrainSelection = {
  flat: "neige",
  steep: "roche",
  mid: "cailloux",
  slopeStart: 0.18,
  slopeEnd: 0.45,
  variationStrength: 0.12,
};

const STORAGE_KEY = "narvos.terrainMaterial";

/**
 * Valide une sélection venue du disque.
 *
 * Le stockage local survit aux mises à jour du jeu : une couche renommée ou
 * retirée y reste indéfiniment, et produirait un `undefined` au moment de
 * construire la config — bien plus loin, dans le shader, sans rapport visible
 * avec la cause. On valide donc à la lecture, et on retombe sur le défaut.
 */
export function sanitize(raw: unknown): TerrainSelection {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SELECTION };
  const r = raw as Partial<TerrainSelection>;
  const layer = (v: unknown, fallback: TerrainLayerId): TerrainLayerId =>
    typeof v === "string" && v in TERRAIN_LAYERS ? (v as TerrainLayerId) : fallback;
  const num = (v: unknown, fallback: number, lo: number, hi: number): number =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;

  const slopeStart = num(r.slopeStart, DEFAULT_SELECTION.slopeStart, 0, 1);
  // `slopeEnd` doit rester STRICTEMENT au-dessus de `slopeStart` : à égalité, le
  // `smoothstep` divise par zéro et la frontière devient une arête franche qui
  // suit les triangles — le défaut visuel qu'on a mis des heures à écarter.
  const slopeEnd = Math.max(slopeStart + 0.01, num(r.slopeEnd, DEFAULT_SELECTION.slopeEnd, 0, 1));

  return {
    flat: layer(r.flat, DEFAULT_SELECTION.flat),
    steep: layer(r.steep, DEFAULT_SELECTION.steep),
    mid: r.mid === null ? null : layer(r.mid, DEFAULT_SELECTION.mid ?? "cailloux"),
    slopeStart,
    slopeEnd,
    variationStrength: num(r.variationStrength, DEFAULT_SELECTION.variationStrength, 0, 0.5),
  };
}

export function toConfig(sel: TerrainSelection): AutoMaterialConfig {
  return buildAutoMaterial(sel.flat, sel.steep, sel.mid ?? undefined, {
    slopeStart: sel.slopeStart,
    slopeEnd: sel.slopeEnd,
    variationStrength: sel.variationStrength,
  });
}

let selection: TerrainSelection = { ...DEFAULT_SELECTION };
const listeners = new Set<() => void>();

function persist(): void {
  // Les tests tournent en environnement `node` sans DOM (cf. vitest.config.ts).
  if (typeof localStorage === "undefined") return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(selection)); } catch { /* quota plein */ }
}

/** Charge la sélection persistée et l'applique. Idempotent. */
export function loadTerrainSelection(): void {
  if (typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) selection = sanitize(JSON.parse(raw));
  } catch { selection = { ...DEFAULT_SELECTION }; }
  setAutoMaterialConfig(toConfig(selection));
}

export function getTerrainSelection(): TerrainSelection { return selection; }

/** Applique une modification partielle. C'est le seul point d'écriture. */
export function setTerrainSelection(patch: Partial<TerrainSelection>): TerrainSelection {
  selection = sanitize({ ...selection, ...patch });
  setAutoMaterialConfig(toConfig(selection));
  persist();
  for (const l of listeners) l();
  return selection;
}

export function resetTerrainSelection(): TerrainSelection {
  return setTerrainSelection({ ...DEFAULT_SELECTION });
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Pont React. `selection` est remplacé (jamais muté) — l'égalité de référence suffit. */
export function useTerrainSelection(): TerrainSelection {
  return useSyncExternalStore(subscribe, getTerrainSelection, getTerrainSelection);
}
