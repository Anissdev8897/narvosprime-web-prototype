// forge/forgeSceneStore.ts — BROUILLONS de l'éditeur de monde Forge (persistés).
//
// Une scène = nom + objets placés (modèle/pos/rot/échelle) + surfaces d'EAU. Sauvegarde
// manuelle + AUTOSAVE configurable ; reprise exacte de session. L'HISTORIQUE undo/redo
// (snapshots JSON) vit ici, hors-React. Une scène « publiée » devient une map jouable
// (customMapStore kind editor) rendue au runtime par ForgeBuiltMap.
import { useSyncExternalStore } from "react";
import { readWorldDb, saveWorldDb } from "../persistence/dbStore";
import type { TerrainData } from "./terrainData";
import type { ForgeWeather } from "./ForgeWeatherRig";

export interface ForgeObject {
  id: string;
  model: string;                     // chemin GLB (models_index)
  pos: [number, number, number];
  rot: [number, number, number];     // euler radians
  scale: [number, number, number];
  layerId?: string;                  // calque (visibilité / verrou) — défaut "default"
  material?: ForgeMaterial;          // surcharge de matériau (texture custom + PBR)
}
/** Surcharge de matériau d'un objet — texture personnalisée + réglages PBR réalistes. */
export interface ForgeMaterial {
  tint?: string;              // couleur multipliée (#ffffff = inchangé)
  texture?: string;          // image (remplace la map d'origine), répétée selon repeat
  textureRepeat?: number;    // répétition UV (1 = tel quel)
  roughness?: number;        // 0 (miroir) .. 1 (mat)
  metalness?: number;        // 0 (diélectrique) .. 1 (métal)
  emissive?: string;         // couleur d'émission (#000 = aucune)
  emissiveIntensity?: number;
}
export type WaterKind = "riviere" | "lac" | "mer" | "ocean";
export interface ForgeWater {
  id: string;
  kind: WaterKind;
  pos: [number, number, number];     // centre (y = niveau de l'eau)
  size: [number, number];            // largeur × longueur (m)
  rotY: number;
}
/**
 * Calque d'édition. Défini ICI et non dans `ForgePanels` : c'est de la DONNÉE de
 * scène, persistée et synchronisée, pas de l'état d'interface. `ForgePanels`
 * réexporte ce type pour ses props.
 */
export interface ForgeLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  color: string;
}

/** Calque unique d'une scène neuve — et repli des scènes créées avant M3. */
export const DEFAULT_LAYERS: ForgeLayer[] = [
  { id: "default", name: "Calque principal", visible: true, locked: false, color: "#4fc3f7" },
];

export type PathKind = "route" | "sentier" | "pont" | "rail";
export interface ForgePath {
  id: string;
  kind: PathKind;
  points: [number, number, number][]; // points de contrôle (spline)
  width: number;
  color: string;                       // teinte (si pas de texture)
  texture?: string;                    // chemin d'image (répétée le long)
}
export interface ForgeScene {
  id: string;
  name: string;
  objects: ForgeObject[];
  waters: ForgeWater[];
  paths?: ForgePath[];                 // routes/chemins (spline → géométrie)
  /** Map EXISTANTE servant de fond (forge/orbital/tower/donjon…). Permet d'éditer une
   *  map déjà présente : on la rend en backdrop et on pose des objets PAR-DESSUS. */
  baseMap?: string;
  /** Terrain sculpté (heightmap) — LEGACY mono-terrain (migré vers `terrains` au runtime). */
  terrain?: TerrainData;
  /** Terrains sculptés (multi-tuiles) — chacun déplaçable/redimensionnable. */
  terrains?: TerrainData[];
  /**
   * Ambiance : angle solaire, preset météo, brume, ombres.
   *
   * Ajouté le 02/08/2026 (constat M4). Ces réglages n'existaient que dans l'état
   * local de l'éditeur : l'auteur composait une ambiance de coucher de soleil ou
   * de nuit, et la map publiée s'affichait sous l'éclairage par défaut. Rien ne
   * le signalait — le travail disparaissait à la publication.
   *
   * `undefined` pour les scènes créées avant : `DEFAULT_WEATHER` s'applique.
   */
  weather?: ForgeWeather;
  /**
   * Calques (visibilité / verrou / couleur).
   *
   * Ajouté le 02/08/2026 (constat M3). Ils vivaient dans un `useState` de
   * `ForgeEditor` — donc perdus à chaque rechargement — alors que CHAQUE objet
   * porte un `layerId` qui les référence. Au retour, les objets pointaient vers
   * des calques inexistants : `layerById.get(o.layerId)` rendait `undefined`,
   * et le filtre de visibilité les laissait passer par défaut. Le masquage et le
   * verrouillage étaient donc silencieusement annulés d'une session à l'autre.
   *
   * Un état transitoire ne doit jamais être référencé par un état persisté.
   *
   * `undefined` pour les scènes créées avant → `DEFAULT_LAYERS`.
   */
  layers?: ForgeLayer[];
  updatedAt: number;
}

/** Liste unifiée des terrains (migration transparente de l'ancien champ `terrain`).
 *  GARANTIT un id stable par terrain (les anciennes scènes n'en avaient pas → key React). */
export function sceneTerrains(s: ForgeScene): TerrainData[] {
  const list = s.terrains ?? (s.terrain ? [s.terrain] : []);
  return list.map((t, i) => (t.id ? t : { ...t, id: `terrain_${i}` }));
}

const STORAGE_KEY = "narvos:forge_scenes:v1";
const DB_KEY = "forge_scenes";

function loadInitial(): ForgeScene[] {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
}
let scenes: ForgeScene[] = loadInitial();
let version = 0;
const listeners = new Set<() => void>();
// ── PERSISTANCE : anti-rebond + dirty-check (constat M8) ─────────────────────
//
// `persist()` était appelé à CHAQUE mutation et réécrivait aussitôt TOUTES les
// scènes — dans localStorage ET en base. Un glisser de curseur, un déplacement au
// gizmo, un autosave sur un état déjà enregistré : chaque frame d'interaction
// sérialisait l'intégralité du contenu. Le bouton « Sauvegarder » réécrivait donc
// systématiquement un état identique.
//
// Deux garde-fous, dans cet ordre :
//   1. ANTI-REBOND — les mutations arrivent en rafale (curseurs, drag) ; on ne
//      sérialise qu'une fois la rafale terminée ;
//   2. DIRTY-CHECK — si le JSON produit est identique au dernier écrit, on ne
//      touche ni au disque ni à la base.
const PERSIST_DEBOUNCE_MS = 250;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let lastPersisted = "";

/** Écrit MAINTENANT si le contenu a changé. Annule un rebond en attente. */
function persistNow() {
  if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
  const json = JSON.stringify(scenes);
  if (json === lastPersisted) return;   // rien n'a changé → aucune écriture
  lastPersisted = json;
  try { localStorage.setItem(STORAGE_KEY, json); } catch { /* quota */ }
  saveWorldDb(DB_KEY, scenes);
}

function persist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(persistNow, PERSIST_DEBOUNCE_MS);
}

// Filet : une fermeture d'onglet pendant la fenêtre d'anti-rebond perdrait la
// dernière rafale. `pagehide` couvre aussi le retour arrière et le mobile, là où
// `beforeunload` n'est pas garanti.
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", persistNow);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") persistNow();
  });
}
function notify() { version++; for (const l of listeners) l(); }
const uid = (p: string) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export const forgeSceneStore = {
  list(): ForgeScene[] { return scenes; },
  get(id: string): ForgeScene | undefined { return scenes.find((s) => s.id === id); },

  create(name: string, baseMap?: string): ForgeScene {
    const s: ForgeScene = { id: uid("scene_"), name: name.trim() || "Sans nom", objects: [], waters: [], baseMap, updatedAt: Date.now() };
    scenes = [...scenes, s];
    persist(); notify();
    return s;
  },

  /**
   * Applique un patch à une scène — manuel ou autosave. FUSION, pas remplacement :
   * un champ absent du patch garde sa valeur (cf. `EditHistory`, qui doit donc
   * fournir un snapshot COMPLET pour qu'un undo remette vraiment à zéro).
   *
   * Le type se définit par SOUSTRACTION. Il énumérait auparavant ses champs
   * (`Pick<ForgeScene, "name" | "objects" | …>`) : ajouter `weather` à la scène
   * ne suffisait pas à pouvoir l'enregistrer, il fallait penser à l'ajouter ici
   * aussi. Deux listes du même ensemble = deux occasions de diverger. `id` et
   * `updatedAt` restent exclus : l'identité ne se patche pas, l'horodatage est
   * posé ci-dessous.
   */
  save(id: string, patch: Partial<Omit<ForgeScene, "id" | "updatedAt">>): void {
    const i = scenes.findIndex((s) => s.id === id);
    if (i < 0) return;
    scenes = scenes.slice();
    scenes[i] = { ...scenes[i], ...patch, updatedAt: Date.now() };
    persist(); notify();
  },

  remove(id: string): void { scenes = scenes.filter((s) => s.id !== id); persist(); notify(); },

  async hydrate(): Promise<void> {
    const db = await readWorldDb<ForgeScene[]>(DB_KEY);
    if (db.status === "unavailable") return;        // couldn't read — don't overwrite
    if (db.status === "ok" && db.value && Array.isArray(db.value)) { scenes = db.value; notify(); }
  },

  subscribe(l: () => void): () => void { listeners.add(l); return () => { listeners.delete(l); }; },
  getVersion: () => version,
};

export function useForgeScenes(): ForgeScene[] {
  useSyncExternalStore(forgeSceneStore.subscribe, forgeSceneStore.getVersion, forgeSceneStore.getVersion);
  return scenes;
}

/** Abonnement à UNE scène : re-render à chaque mutation du store (sliders, undo, save…
 *  réactifs). Sans ça l'éditeur ne se rafraîchissait que par effet de bord de setState. */
export function useForgeScene(id: string | null): ForgeScene | undefined {
  useSyncExternalStore(forgeSceneStore.subscribe, forgeSceneStore.getVersion, forgeSceneStore.getVersion);
  return id ? scenes.find((s) => s.id === id) : undefined;
}

// ── HISTORIQUE undo/redo ────────────────────────────────────────────────────────
//
// Le snapshot couvre TOUT le contenu éditable de la scène, défini par SOUSTRACTION
// plutôt que par énumération. C'est la propriété qui compte : un champ ajouté un
// jour à `ForgeScene` entre automatiquement dans l'historique, sans que personne
// ait à y penser.
//
// L'ancienne version listait `{ objects, waters }`. Routes, terrains et map de
// base n'étaient donc jamais annulables : un undo après la création d'une route
// la laissait en place, et l'utilisateur ne pouvait pas savoir lesquelles de ses
// actions étaient couvertes. Un historique partiel est pire qu'un historique
// absent — il inspire confiance, puis trahit sur l'action qu'on ne soupçonnait pas.
//
// `id` / `name` / `updatedAt` sont exclus : ce sont l'identité et l'horodatage de
// la scène, pas son contenu. Les restaurer n'aurait aucun sens (annuler ne doit
// pas renommer une scène).
//
// ⚠️ NON COUVERT : `layers` et `prefabs` vivent dans un `useState` de
// `ForgeEditor`, pas dans `ForgeScene` (constat M3). Ils entreront ici d'eux-mêmes
// le jour où ils rejoindront la scène — c'est l'intérêt du `Omit`.
export type SceneSnapshot = Omit<ForgeScene, "id" | "name" | "updatedAt">;

/**
 * Bornes de l'historique : un plafond en NOMBRE et un en OCTETS.
 *
 * Le compte seul ne suffit plus. Le snapshot inclut désormais les terrains, dont
 * le champ `heights` est une heightmap complète : une scène à plusieurs tuiles
 * sculptées pèse des mégaoctets par entrée. 500 × ça saturait la mémoire de
 * l'onglet. Le budget en octets est la vraie borne ; le compte n'est qu'un garde
 * pour les scènes légères.
 */
const HISTORY_MAX = 100;
const HISTORY_BYTES_MAX = 32 * 1024 * 1024;

export class EditHistory {
  private past: string[] = [];
  private future: string[] = [];
  private pastBytes = 0;

  /** Empile l'état COURANT avant une mutation. Vide le futur (nouvelle branche). */
  push(snap: SceneSnapshot): void {
    const s = JSON.stringify(snap);
    this.past.push(s);
    this.pastBytes += s.length;
    // Évince les plus ANCIENS jusqu'à repasser sous les deux bornes.
    while (this.past.length > HISTORY_MAX || (this.pastBytes > HISTORY_BYTES_MAX && this.past.length > 1)) {
      this.pastBytes -= this.past.shift()!.length;
    }
    this.future.length = 0;
  }
  undo(current: SceneSnapshot): SceneSnapshot | null {
    const prev = this.past.pop();
    if (!prev) return null;
    this.pastBytes -= prev.length;
    this.future.push(JSON.stringify(current));
    return JSON.parse(prev);
  }
  redo(current: SceneSnapshot): SceneSnapshot | null {
    const next = this.future.pop();
    if (!next) return null;
    const s = JSON.stringify(current);
    this.past.push(s);
    this.pastBytes += s.length;
    return JSON.parse(next);
  }
  get canUndo(): boolean { return this.past.length > 0; }
  get canRedo(): boolean { return this.future.length > 0; }
  /** Empreinte mémoire de la pile d'annulation, en octets — diagnostic. */
  get bytes(): number { return this.pastBytes; }
}

/**
 * Extrait le contenu éditable d'une scène pour l'historique.
 *
 * Passe par la liste des clés à EXCLURE : ajouter un champ à `ForgeScene` le rend
 * annulable sans toucher à cette fonction.
 */
export function snapshotOf(scene: ForgeScene): SceneSnapshot {
  const { id: _id, name: _name, updatedAt: _updatedAt, ...content } = scene;
  return content;
}

/** Aimantation à la grille (snap). step 0 = désactivé. */
export function snap(v: number, step: number): number {
  return step > 0 ? Math.round(v / step) * step : v;
}

/** Défauts des surfaces d'eau par type (taille de départ, teinte gérée au rendu). */
export const WATER_DEFAULTS: Record<WaterKind, { size: [number, number]; label: string }> = {
  riviere: { size: [6, 80], label: "Rivière" },
  lac:     { size: [40, 40], label: "Lac" },
  mer:     { size: [160, 160], label: "Mer" },
  ocean:   { size: [600, 600], label: "Océan" },
};
export const newWater = (kind: WaterKind): ForgeWater => ({
  id: uid("water_"), kind, pos: [0, 0.3, 0], size: [...WATER_DEFAULTS[kind].size], rotY: 0,
});
export const newObject = (model: string): ForgeObject => ({
  id: uid("obj_"), model, pos: [0, 0, 0], rot: [0, 0, 0], scale: [1, 1, 1],
});
