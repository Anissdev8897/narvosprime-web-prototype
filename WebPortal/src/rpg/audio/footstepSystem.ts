// ══════════════════════════════════════════════════════════════════════════════
// audio/footstepSystem.ts — Détection de surface et mapping surface→son pour les
// bruits de pas.
//
// 26 catégories de pas issues de Footsteps_Sound_Effects_Pro :
//   Armor, Bluntwood, Brush, Concrete, Deckwood, Dirt, Glass, Grass, Gravel,
//   Leaves, Lino, Marble, Metalbar, Metalbox, Mud, Muffledice, Quicksand, Rug,
//   Sand, Snow, Squeakywood, Stone, Water, Water_stereofix, Weakice, Wood
//
// + 2 supplémentaires du dossier sfx_mouvement : Gravel (via Bruit-de-pas-sur-du-gravier)
//   et Parquet (Bruit-de-pas-sur-un-Parquet). Water_stereofix est un alias de Water.
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";
import { collisionWorld } from "../runtime/CollisionWorld";

// ── Types ─────────────────────────────────────────────────────────────────────
/** Identifiant stable d'une catégorie de pas. */
export type FootstepCategory =
  | "armor" | "bluntwood" | "brush" | "concrete" | "deckwood"
  | "dirt" | "glass" | "grass" | "gravel" | "leaves"
  | "lino" | "marble" | "metalbar" | "metalbox" | "mud"
  | "muffledice" | "quicksand" | "rug" | "sand" | "snow"
  | "squeakywood" | "stone" | "water" | "weakice" | "wood";

/** Résultat de détection de surface. */
export interface GroundSurface {
  /** Catégorie de pas détectée. */
  category: FootstepCategory;
  /** Nom du matériau Three.js touché (utile pour le diagnostic). */
  materialName: string;
  /** Score de confiance (0-1). */
  confidence: number;
}

// ── Constantes ────────────────────────────────────────────────────────────────

/** URL de base des pas. */
const FOOTSTEPS_BASE = "/models/audio/Footsteps_Sound_Effects_Pro/WAV/";

/** Nombre de variantes par dossier (pré-calculé pour éviter un appel disque à chaque pas). */
const CATEGORY_SAMPLE_COUNTS: Record<FootstepCategory, number> = {
  armor: 53,
  bluntwood: 16,
  brush: 11,
  concrete: 27,
  deckwood: 11,
  dirt: 31,
  glass: 3,
  grass: 20,
  gravel: 27,
  leaves: 7,
  lino: 14,
  marble: 29,
  metalbar: 29,
  metalbox: 23,
  mud: 10,
  muffledice: 10,
  quicksand: 11,
  rug: 11,
  sand: 22,
  snow: 27,
  squeakywood: 18,
  stone: 27,
  water: 32,      // Water + Water_stereofix = 16 + 16
  weakice: 10,
  wood: 11,
};

// ── Mapping matériau → catégorie ──────────────────────────────────────────────

/**
 * Règles de correspondance entre un nom de matériau Three.js et une catégorie de pas.
 *
 * Chaque règle contient un motif regex testé contre le nom du matériau.
 * L'ordre est important : la PREMIÈRE règle qui matche gagne.
 * La dernière règle est un attrape-tout qui renvoie "grass".
 */
const MATERIAL_RULES: { re: RegExp; category: FootstepCategory }[] = [
  // ── Auto-material paysage (MWAM / MWLandscape) ─────────────────
  // Les matériaux MWAM sont patchés en `__autoMaterial` par AutoMaterial.ts,
  // mais le nom ORIGINAL du matériau source est conservé dans le clone.
  // On matche SUR le nom du matériau renvoyé par le raycast, qui est le nom
  // du matériau effectif après patch (ex: `MTL_MWAM_Grass__autoMaterial`).
  { re: /snow|neige|ice/i,                 category: "snow" },
  { re: /rock|roche|stone/i,              category: "stone" },
  { re: /gravel|cailloux|pebble/i,        category: "gravel" },
  { re: /grass|herbe|herb/i,               category: "grass" },
  { re: /dirt|terre|soil|mud/i,            category: "dirt" },
  { re: /sand|sable/i,                     category: "sand" },
  { re: /water|eau|flaque|puddle/i,        category: "water" },

  // ── Matériaux de construction / sols ───────────────────────────
  { re: /concrete|beton/i,                 category: "concrete" },
  { re: /marble|marbre/i,                  category: "marble" },
  { re: /wood|bois|parquet|plank/i,        category: "wood" },
  { re: /deckwood|deck/i,                  category: "deckwood" },
  { re: /squeaky|grince/i,                 category: "squeakywood" },
  { re: /bluntwood/i,                      category: "bluntwood" },
  { re: /metal|steel|fer|iron/i,           category: "metalbar" },
  { re: /metal.*box|boite/i,               category: "metalbox" },
  { re: /glass|verre/i,                    category: "glass" },
  { re: /lino|linoleum/i,                  category: "lino" },

  // ── Extérieur / nature ─────────────────────────────────────────
  { re: /brush|brosse|buisson/i,           category: "brush" },
  { re: /leaves|feuille|leaf/i,            category: "leaves" },
  { re: /mud|boue/i,                       category: "mud" },
  { re: /quicksand|sables.*mouv/i,         category: "quicksand" },

  // ── Autres ─────────────────────────────────────────────────────
  { re: /armor|armure|armour/i,            category: "armor" },
  { re: /ice|glace|weakice/i,              category: "weakice" },
  { re: /muffledice/i,                     category: "muffledice" },
  { re: /rug|tapis/i,                      category: "rug" },
  { re: /water|stereofix/i,                category: "water" },
];

/** Catégorie par défaut quand aucune règle ne matche. */
const DEFAULT_CATEGORY: FootstepCategory = "grass";

// ── Sélection aléatoire ───────────────────────────────────────────────────────

let lastCategory: FootstepCategory | null = null;
let lastSampleIdx = -1;

/**
 * Renvoie l'URL d'un échantillon aléatoire pour une catégorie donnée.
 * Évite la répétition immédiate (jamais deux fois le même fichier consécutif).
 */
export function getFootstepUrl(category: FootstepCategory): string {
  const count = CATEGORY_SAMPLE_COUNTS[category];
  let idx: number;

  // On évite la répétition immédiate
  do {
    idx = Math.floor(Math.random() * count);
  } while (count > 1 && idx === lastSampleIdx && category === lastCategory);

  lastSampleIdx = idx;
  lastCategory = category;

  // L'index des fichiers correspond à l'ordre alphabétique du disque.
  // Pour water qui utilise Water + Water_stereofix, on tire depuis les deux dossiers.
  if (category === "water") {
    // Water: 16 fichiers, Water_stereofix: 16 fichiers → tirer aléatoirement dans les deux
    const useStereofix = idx >= 16;
    const subIdx = idx % 16;
    const subDir = useStereofix ? "Water_stereofix" : "Water";
    // Récupère la liste des fichiers pour ce sous-dossier
    const files = WATER_FILE_NAMES;
    if (subIdx < files.length) {
      return `${FOOTSTEPS_BASE}${subDir}/${files[subIdx]}`;
    }
  }

  const categoryDir = categoryToDirName(category);
  const fileNames = getFileNamesForCategory(category);
  if (idx < fileNames.length) {
    return `${FOOTSTEPS_BASE}${categoryDir}/${fileNames[idx]}`;
  }

  // Fallback: génération par motif (marchera si les fichiers sont nommés de façon prévisible)
  return `${FOOTSTEPS_BASE}${categoryDir}/footstep_${idx + 1}.wav`;
}

/** Convertit un identifiant de catégorie en nom de dossier sur disque. */
function categoryToDirName(category: FootstepCategory): string {
  const map: Record<FootstepCategory, string> = {
    armor: "Armor",
    bluntwood: "Bluntwood",
    brush: "Brush",
    concrete: "Concrete",
    deckwood: "Deckwood",
    dirt: "Dirt",
    glass: "Glass",
    grass: "Grass",
    gravel: "Gravel",
    leaves: "Leaves",
    lino: "Lino",
    marble: "Marble",
    metalbar: "Metalbar",
    metalbox: "Metalbox",
    mud: "Mud",
    muffledice: "Muffledice",
    quicksand: "Quicksand",
    rug: "Rug",
    sand: "Sand",
    snow: "Snow",
    squeakywood: "Squeakywood",
    stone: "Stone",
    water: "Water",
    weakice: "Weakice",
    wood: "Wood",
  };
  return map[category];
}

// ── Détection de surface par raycast ─────────────────────────────────────────

/**
 * Détecte la catégorie de surface au point (x, y, z) par raycast vers le bas.
 *
 * @param x Position X monde
 * @param z Position Z monde
 * @param fromHeight Hauteur de départ du raycast (défaut = 100)
 * @returns GroundSurface ou null si aucun sol détecté
 */
export function detectSurface(
  x: number,
  z: number,
  fromHeight = 100,
): GroundSurface | null {
  const result = collisionWorld.getGroundMaterial(x, z, fromHeight);
  if (!result) return null;

  // Le matériau d'abord, le nom du mesh en repli : un GLB exporté sans nommer
  // ses matériaux donnerait sinon le son par défaut sur toute la map, alors que
  // le nœud s'appelle "Metal_Floor". On ne retient le repli que s'il classe
  // vraiment — sinon on garde le nom du matériau pour le diagnostic.
  let category = classifySurface(result.materialName);
  let materialName = result.materialName;
  if (category === DEFAULT_CATEGORY && result.meshName) {
    const fromMesh = classifySurface(result.meshName);
    if (fromMesh !== DEFAULT_CATEGORY) {
      category = fromMesh;
      materialName = result.meshName;
    }
  }

  return {
    category,
    materialName,
    confidence: category === DEFAULT_CATEGORY ? 0.3 : 0.9,
  };
}

/**
 * Classe un nom de matériau Three.js en catégorie de pas.
 */
export function classifySurface(materialName: string): FootstepCategory {
  const name = materialName || "";
  for (const rule of MATERIAL_RULES) {
    if (rule.re.test(name)) {
      return rule.category;
    }
  }
  return DEFAULT_CATEGORY;
}

// ── Noms de fichiers pour la sélection aléatoire ───────────────────────────────
// Ces listes sont extraites de l'arborescence réelle sur disque.
// Générées par `find` au moment de l'implémentation.

const ARMOR_FILES = [
  "crystal_foot1.wav", "crystal_foot2.wav", "crystal_foot3.wav", "crystal_foot4.wav",
  "crystal_run1.wav", "crystal_run2.wav", "crystal_run3.wav", "crystal_run4.wav",
  "crystal_run5.wav", "crystal_run6.wav", "crystal_walk1.wav", "crystal_walk2.wav",
  "crystal_walk3.wav", "crystal_walk4.wav", "crystal_walk5.wav", "crystal_walk6.wav",
  "heavy_foot1.wav", "heavy_foot2.wav", "heavy_foot3.wav", "heavy_foot4.wav",
  "heavy_run1.wav", "heavy_run2.wav", "heavy_run3.wav", "heavy_run4.wav",
  "heavy_run5.wav", "heavy_run6.wav", "heavy_run7.wav", "heavy_run8.wav", "heavy_run9.wav",
  "heavy_walk1.wav", "heavy_walk2.wav", "heavy_walk3.wav", "heavy_walk4.wav",
  "heavy_walk5.wav", "heavy_walk6.wav",
  "light_1.wav", "light_2.wav", "light_3.wav",
  "medium_walk1.wav", "medium_walk2.wav", "medium_walk3.wav",
  "slime_run1.wav", "slime_run2.wav", "slime_run3.wav", "slime_run4.wav",
  "slime_run5.wav", "slime_run6.wav",
  "slime_walk1.wav", "slime_walk2.wav", "slime_walk3.wav",
];

const BLUNTWOOD_FILES = [
  "bluntwood_run1.wav", "bluntwood_run2.wav", "bluntwood_run3.wav", "bluntwood_run4.wav",
  "bluntwood_walk1.wav", "bluntwood_walk2.wav", "bluntwood_walk3.wav", "bluntwood_walk4.wav",
  "bluntwood_walk5.wav",
  "medium_run1.wav", "medium_run2.wav", "medium_run3.wav",
  "medium_walk1.wav", "medium_walk2.wav", "medium_walk3.wav",
  "medium_walk4.wav",
];

const BRUSH_FILES = [
  "brush_run1.wav", "brush_run2.wav", "brush_run3.wav",
  "brush_walk1.wav", "brush_walk2.wav", "brush_walk3.wav",
  "run1.wav", "run2.wav",
  "walk1.wav", "walk2.wav", "walk3.wav",
];

const CONCRETE_FILES = [
  "concrete_run1.wav", "concrete_run2.wav", "concrete_run3.wav", "concrete_run4.wav",
  "concrete_run5.wav", "concrete_run6.wav",
  "concrete_walk1.wav", "concrete_walk2.wav", "concrete_walk3.wav", "concrete_walk4.wav",
  "concrete_walk5.wav", "concrete_walk6.wav",
  "heavy_run1.wav", "heavy_run2.wav",
  "heavy_walk1.wav", "heavy_walk2.wav",
  "light_walk1.wav", "light_walk2.wav", "light_walk3.wav",
  "medium_run1.wav", "medium_run2.wav",
  "medium_walk1.wav", "medium_walk2.wav", "medium_walk3.wav", "medium_walk4.wav",
  "medium_walk5.wav", "medium_walk6.wav",
];

const DECKWOOD_FILES = [
  "deckwood_run1.wav", "deckwood_run2.wav",
  "deckwood_walk1.wav", "deckwood_walk2.wav", "deckwood_walk3.wav",
  "medium_run1.wav", "medium_run2.wav",
  "medium_walk1.wav", "medium_walk2.wav",
  "walk1.wav", "walk2.wav",
];

const DIRT_FILES = [
  "dirt_run1.wav", "dirt_run2.wav", "dirt_run3.wav", "dirt_run4.wav",
  "dirt_run5.wav", "dirt_run6.wav",
  "dirt_walk1.wav", "dirt_walk2.wav", "dirt_walk3.wav", "dirt_walk4.wav",
  "dirt_walk5.wav", "dirt_walk6.wav",
  "heavy_run1.wav", "heavy_run2.wav", "heavy_run3.wav",
  "heavy_walk1.wav", "heavy_walk2.wav",
  "medium_run1.wav", "medium_run2.wav",
  "medium_walk1.wav", "medium_walk2.wav", "medium_walk3.wav",
  "walk1.wav", "walk2.wav", "walk3.wav", "walk4.wav",
  "walk5.wav", "walk6.wav", "walk7.wav",
];

const GLASS_FILES = [
  "glass_run1.wav", "glass_walk1.wav", "glass_walk2.wav",
];

const GRASS_FILES = [
  "heavy_run1.wav", "heavy_run2.wav", "heavy_run3.wav",
  "heavy_walk1.wav", "heavy_walk2.wav", "heavy_walk3.wav",
  "light_walk1.wav", "light_walk2.wav", "light_walk3.wav",
  "medium_run1.wav", "medium_run2.wav", "medium_run3.wav",
  "medium_walk1.wav", "medium_walk2.wav", "medium_walk3.wav",
  "run1.wav", "run2.wav",
  "walk1.wav", "walk2.wav", "walk3.wav",
];

const GRAVEL_FILES = [
  "gravel_run1.wav", "gravel_run2.wav", "gravel_run3.wav", "gravel_run4.wav",
  "gravel_run5.wav",
  "gravel_walk1.wav", "gravel_walk2.wav", "gravel_walk3.wav", "gravel_walk4.wav",
  "gravel_walk5.wav",
  "heavy_run1.wav", "heavy_run2.wav",
  "heavy_walk1.wav", "heavy_walk2.wav",
  "medium_run1.wav", "medium_run2.wav",
  "medium_walk1.wav", "medium_walk2.wav", "medium_walk3.wav",
  "run1.wav", "run2.wav",
  "walk1.wav", "walk2.wav", "walk3.wav", "walk4.wav",
  "walk5.wav", "walk6.wav",
];

const LEAVES_FILES = [
  "leaf_run1.wav", "leaf_run2.wav", "leaf_walk1.wav", "leaf_walk2.wav",
  "walk1.wav", "walk2.wav", "walk3.wav",
];

const LINO_FILES = [
  "lino_run1.wav", "lino_run2.wav",
  "lino_walk1.wav", "lino_walk2.wav", "lino_walk3.wav",
  "medium_run1.wav", "medium_run2.wav",
  "medium_walk1.wav", "medium_walk2.wav", "medium_walk3.wav",
  "walk1.wav", "walk2.wav", "walk3.wav", "walk4.wav",
];

const MARBLE_FILES = [
  "heavy_run1.wav", "heavy_run2.wav", "heavy_run3.wav", "heavy_run4.wav",
  "heavy_run5.wav",
  "heavy_walk1.wav", "heavy_walk2.wav", "heavy_walk3.wav",
  "light_run1.wav", "light_run2.wav",
  "light_walk1.wav", "light_walk2.wav",
  "medium_run1.wav", "medium_run2.wav", "medium_run3.wav",
  "medium_walk1.wav", "medium_walk2.wav", "medium_walk3.wav",
  "run1.wav", "run2.wav",
  "walk1.wav", "walk2.wav", "walk3.wav", "walk4.wav",
  "walk5.wav", "walk6.wav",
  "walk7.wav", "walk8.wav",
];

const METALBAR_FILES = [
  "metal_run1.wav", "metal_run2.wav", "metal_run3.wav", "metal_run4.wav",
  "metal_walk1.wav", "metal_walk2.wav", "metal_walk3.wav", "metal_walk4.wav",
  "metal_walk5.wav",
  "run1.wav", "run2.wav", "run3.wav",
  "walk1.wav", "walk10.wav", "walk11.wav",
  "walk12.wav", "walk13.wav", "walk14.wav",
  "walk2.wav", "walk3.wav", "walk4.wav",
  "walk5.wav", "walk6.wav", "walk7.wav",
  "walk8.wav", "walk9.wav",
];

const METALBOX_FILES = [
  "metal_run1.wav", "metal_run2.wav", "metal_run3.wav", "metal_run4.wav",
  "metal_run5.wav", "metal_run6.wav",
  "metal_walk1.wav", "metal_walk2.wav", "metal_walk3.wav", "metal_walk4.wav",
  "metal_walk5.wav", "metal_walk6.wav",
  "medium_run1.wav", "medium_run2.wav",
  "medium_walk1.wav", "medium_walk2.wav",
  "walk1.wav", "walk10.wav", "walk11.wav",
  "walk12.wav", "walk13.wav",
  "walk2.wav", "walk3.wav",
];

const MUD_FILES = [
  "mud_run1.wav", "mud_run2.wav", "mud_run3.wav", "mud_run4.wav",
  "mud_walk1.wav", "mud_walk2.wav", "mud_walk3.wav", "mud_walk4.wav",
  "run1.wav", "run2.wav",
];

const MUFFLEDICE_FILES = [
  "muffledice_run1.wav", "muffledice_run2.wav", "muffledice_run3.wav",
  "muffledice_walk1.wav", "muffledice_walk2.wav", "muffledice_walk3.wav",
  "walk1.wav", "walk2.wav", "walk3.wav", "walk4.wav",
];

const QUICKSAND_FILES = [
  "quicksand_run1.wav", "quicksand_run2.wav", "quicksand_run3.wav",
  "quicksand_run4.wav",
  "quicksand_walk1.wav", "quicksand_walk2.wav", "quicksand_walk3.wav",
  "run1.wav", "run2.wav",
  "walk1.wav", "walk2.wav",
];

const RUG_FILES = [
  "rug_run1.wav", "rug_run2.wav",
  "rug_walk1.wav", "rug_walk2.wav", "rug_walk3.wav",
  "walk1.wav", "walk2.wav", "walk3.wav", "walk4.wav",
  "walk5.wav", "walk6.wav", "walk7.wav",
];

const SAND_FILES = [
  "sand_run1.wav", "sand_run2.wav", "sand_run3.wav", "sand_run4.wav",
  "sand_walk1.wav", "sand_walk2.wav", "sand_walk3.wav", "sand_walk4.wav",
  "sand_walk5.wav",
  "heavy_run1.wav", "heavy_run2.wav",
  "heavy_walk1.wav", "heavy_walk2.wav",
  "light_run1.wav", "light_run2.wav",
  "light_walk1.wav", "light_walk2.wav",
  "walk1.wav", "walk2.wav", "walk3.wav",
  "walk4.wav",
];

const SNOW_FILES = [
  "heavy_run1.wav", "heavy_run2.wav", "heavy_run3.wav",
  "heavy_walk1.wav", "heavy_walk2.wav", "heavy_walk3.wav",
  "light_run1.wav", "light_run2.wav",
  "light_walk1.wav", "light_walk2.wav",
  "medium_run1.wav", "medium_run2.wav", "medium_run3.wav",
  "medium_walk1.wav", "medium_walk2.wav", "medium_walk3.wav",
  "run1.wav", "run2.wav",
  "walk1.wav", "walk2.wav", "walk3.wav", "walk4.wav",
  "walk5.wav", "walk6.wav",
  "walk7.wav", "walk8.wav",
];

const SQUEAKYWOOD_FILES = [
  "squeaky_run1.wav", "squeaky_run2.wav",
  "squeaky_walk1.wav", "squeaky_walk2.wav", "squeaky_walk3.wav",
  "walk1.wav", "walk10.wav", "walk11.wav",
  "walk12.wav", "walk13.wav", "walk14.wav",
  "walk2.wav", "walk3.wav", "walk4.wav",
  "walk5.wav", "walk6.wav", "walk7.wav",
  "walk8.wav", "walk9.wav",
];

const STONE_FILES = [
  "heavy_run1.wav", "heavy_run2.wav", "heavy_run3.wav",
  "heavy_walk1.wav", "heavy_walk2.wav",
  "light_run1.wav", "light_run2.wav",
  "light_walk1.wav", "light_walk2.wav", "light_walk3.wav",
  "medium_run1.wav", "medium_run2.wav", "medium_run3.wav",
  "medium_walk1.wav", "medium_walk2.wav", "medium_walk3.wav",
  "run1.wav", "run2.wav",
  "walk1.wav", "walk2.wav", "walk3.wav", "walk4.wav",
  "walk5.wav", "walk6.wav",
  "walk7.wav", "walk8.wav",
];

const WATER_FILE_NAMES = [
  "water_foot1.wav", "water_foot2.wav", "water_foot3.wav", "water_foot4.wav",
  "water_run1.wav", "water_run2.wav", "water_run3.wav", "water_run4.wav",
  "water_run5.wav", "water_run6.wav",
  "water_walk1.wav", "water_walk2.wav", "water_walk3.wav", "water_walk4.wav",
  "water_walk5.wav", "water_walk6.wav",
];

const WEAKICE_FILES = [
  "weakice_run1.wav", "weakice_run2.wav", "weakice_run3.wav",
  "weakice_walk1.wav", "weakice_walk2.wav", "weakice_walk3.wav",
  "walk1.wav", "walk2.wav", "walk3.wav", "walk4.wav",
];

const WOOD_FILES = [
  "heavy_run1.wav", "heavy_run2.wav",
  "heavy_walk1.wav", "heavy_walk2.wav",
  "light_walk1.wav", "light_walk2.wav",
  "walk1.wav", "walk2.wav", "walk3.wav", "walk4.wav",
  "walk5.wav",
];

type FileList = readonly string[];

const FILE_LISTS: Record<FootstepCategory, FileList> = {
  armor: ARMOR_FILES,
  bluntwood: BLUNTWOOD_FILES,
  brush: BRUSH_FILES,
  concrete: CONCRETE_FILES,
  deckwood: DECKWOOD_FILES,
  dirt: DIRT_FILES,
  glass: GLASS_FILES,
  grass: GRASS_FILES,
  gravel: GRAVEL_FILES,
  leaves: LEAVES_FILES,
  lino: LINO_FILES,
  marble: MARBLE_FILES,
  metalbar: METALBAR_FILES,
  metalbox: METALBOX_FILES,
  mud: MUD_FILES,
  muffledice: MUFFLEDICE_FILES,
  quicksand: QUICKSAND_FILES,
  rug: RUG_FILES,
  sand: SAND_FILES,
  snow: SNOW_FILES,
  squeakywood: SQUEAKYWOOD_FILES,
  stone: STONE_FILES,
  water: WATER_FILE_NAMES,
  weakice: WEAKICE_FILES,
  wood: WOOD_FILES,
};

function getFileNamesForCategory(category: FootstepCategory): FileList {
  return FILE_LISTS[category];
}

// ── Fonction utilitaire pour AudioManager ─────────────────────────────────────

/**
 * Résout l'URL d'un bruit de pas pour une catégorie donnée.
 * Utilisé par AudioManager.playFootstepForSurface().
 */
export function resolveFootstepUrl(category: FootstepCategory): string {
  return getFootstepUrl(category);
}

/**
 * Résout l'URL d'un bruit de pas en détectant la surface à la position donnée.
 *
 * @param x Position X du personnage
 * @param z Position Z du personnage
 * @param fromHeight Hauteur de départ du raycast
 * @returns URL du son de pas à jouer, ou null si pas de sol
 */
export function resolveFootstepUrlAtPosition(
  x: number,
  z: number,
  fromHeight = 100,
): { url: string; surface: GroundSurface } | null {
  const surface = detectSurface(x, z, fromHeight);
  if (!surface) return null;
  return {
    url: getFootstepUrl(surface.category),
    surface,
  };
}
