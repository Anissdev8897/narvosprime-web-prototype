// ══════════════════════════════════════════════════════════════════════════════
// loaders/assetManifest.ts — Manifeste des assets RETENUS (cf ASSET_AUDIT.md)
//
// Tous les chemins sont relatifs à public/ (servis par Vite).
// Le script scripts/copy-rpg-assets.ps1 copie les fichiers source (glTF/GLB)
// depuis le dossier Godot vers public/assets/rpg/.
// ══════════════════════════════════════════════════════════════════════════════

import type { EquipmentSlot, Gender, OutfitStyle } from "../types";
import { FORGE_CHUNKS } from "./forgeChunks";

// Racine des assets RPG (réorganisés dans public/models/ par l'utilisateur).
export const RPG_ASSET_ROOT = "/models/assets_character/rpg";
// Racine des PNJ Meshy (réutilisés comme PNJ animés).
export const NPC_ASSET_ROOT = "/models/pnj";
// Maps et armes FPS partagées.
export const MAPS_ROOT = "/models/Maps";
export const FP_WEAPONS_ROOT = "/models/weapons";

// ── Tenues Quaternius (Modular Character Outfits - Fantasy) ──────────────────
// 6 styles × 2 genres = 12 combinaisons visuelles. Même squelette partout.
// OutfitTheme conservé comme alias de OutfitStyle pour la rétrocompatibilité.
export type OutfitTheme = OutfitStyle; // alias rétrocompat

const OUTFITS_ROOT = `${RPG_ASSET_ROOT}/characters/Outfits`;
const PARTS_ROOT   = `${RPG_ASSET_ROOT}/characters/ModularParts`;

function genderPrefix(g: Gender): string {
  return g === "male" ? "Male" : "Female";
}

/** Catalogue UI des tenues (pour l'écran de création). */
export interface OutfitDef {
  id: OutfitStyle;
  label: string;
  labelShort: string;
  description: string;
  /** Matériaux peau inclus dans cette tenue (affichent la peau du perso). */
  hasSkin: boolean;
}

export const OUTFIT_CATALOG: OutfitDef[] = [
  {
    id: "Ranger",
    label: "Rôdeur",
    labelShort: "Rôdeur",
    description: "Équipement de voyage léger avec capuche. Idéal pour les classes agiles.",
    hasSkin: true,
  },
  {
    id: "Peasant",
    label: "Paysan",
    labelShort: "Paysan",
    description: "Tenue simple et fonctionnelle. Le point de départ de tout aventurier.",
    hasSkin: false,
  },
  {
    id: "Knight",
    label: "Chevalier",
    labelShort: "Chevalier",
    description: "Armure lourde d'acier. Protection maximale pour les combattants de mêlée.",
    hasSkin: false,
  },
  {
    id: "Knight_Cloth",
    label: "Chevalier Léger",
    labelShort: "Chev. Léger",
    description: "Version allégée de l'armure chevalier. Mobilité et protection équilibrées.",
    hasSkin: false,
  },
  {
    id: "Noble",
    label: "Noble",
    labelShort: "Noble",
    description: "Tenue de cour élégante. Convient aux classes de soutien et de magie.",
    hasSkin: true,
  },
  {
    id: "Wizard",
    label: "Sorcier",
    labelShort: "Sorcier",
    description: "Robe de mage traditionnelle. Tenue iconique pour toutes les classes magiques.",
    hasSkin: true,
  },
];

/** Tenue complète pré-assemblée (utilisée par AnimatedModularCharacter).
 *  Convention Quaternius : {Gender}_{Style}.gltf avec Knight_Cloth → Knight_Cloth */
export function getOutfitPath(gender: Gender, style: OutfitStyle): string {
  const g = genderPrefix(gender);
  // Knight_Cloth a un nom spécifique
  return `${OUTFITS_ROOT}/${g}_${style}.gltf`;
}

/** Retourne le chemin glTF d'une partie modulaire, ou null si indisponible. */
export function getModularPartPath(
  gender: Gender,
  style: OutfitStyle,
  slot: EquipmentSlot
): string | null {
  const g = genderPrefix(gender);
  const styleBase = style === "Knight_Cloth" ? "Knight" : style;
  // Cas particuliers de nommage Quaternius
  const suffixes: Partial<Record<EquipmentSlot, string>> = {
    body:      `_Body`,
    arms:      `_Arms`,
    legs:      `_Legs`,
    feet:      `_Feet`,
    head:      style === "Ranger" ? `_Head_Hood` : style === "Knight" ? `_Head_Armet` : null,
    shoulders: style === "Ranger"  ? (gender === "male" ? `_Acc_Pauldron` : `_Acc_Pauldrons`) : null,
  } as Partial<Record<EquipmentSlot, string>>;

  const suffix = suffixes[slot];
  if (!suffix) return null;

  // Exceptions de nommage Quaternius
  if (gender === "male" && style === "Ranger" && slot === "feet") {
    return `${PARTS_ROOT}/Male_Ranger_Feet_Boots.gltf`;
  }
  if (gender === "male" && style === "Knight" && slot === "feet") {
    return `${PARTS_ROOT}/Male_Knight_Feet_Armor.gltf`;
  }
  if (gender === "male" && style === "Knight" && slot === "legs") {
    return `${PARTS_ROOT}/Male_Knight_Legs_Armor.gltf`;
  }

  return `${PARTS_ROOT}/${g}_${styleBase}${suffix}.gltf`;
}

/** Retourne les IDs des OutfitStyles (pour les boucles de préchargement). */
export const OUTFIT_STYLE_IDS: OutfitStyle[] = [
  "Ranger", "Peasant", "Knight", "Knight_Cloth", "Noble", "Wizard",
];

// ── Têtes réelles (Ultimate Modular Men/Women) ────────────────────────────────
// Ces GLTFs contiennent un SkinnedMesh de visage compatible avec le squelette
// Quaternius universel. Ils sont rebindés au squelette du corps Outfit au runtime.
// Convention : renommer les fichiers _Head.gltf du pack Ultimate Modular en
//   Male_Head.gltf / Female_Head.gltf et les placer dans le dossier Heads/.
const HEADS_ROOT = `${RPG_ASSET_ROOT}/characters/Heads`;

/**
 * Chemin du GLTF de tête (visage réel, Ultimate Modular).
 * Retourne null si le fichier n'est pas encore disponible (fallback sphère proc).
 */
export function getHeadPath(gender: Gender): string {
  return `${HEADS_ROOT}/${genderPrefix(gender)}_Head.gltf`;
}

/** Styles de tenue dont la tête est couverte → pas besoin de charger un Head GLTF. */
export const OUTFIT_HEAD_COVERED = new Set<OutfitStyle>(["Ranger", "Knight"]);

// ── Armes magiques ────────────────────────────────────────────────────────────
//
// ⚠ Ces trois entrées pointaient `${RPG_ASSET_ROOT}/weapons/…`, c.-à-d.
// `/models/assets_character/rpg/weapons/` — un dossier qui N'EXISTE PLUS sur le
// disque, comme tout le reste de `assets_character/rpg/`. `weaponRegistry.test.ts`
// le dit déjà en toutes lettres (« leurs fichiers sont supprimés ») ; le manifeste,
// lui, continuait de les déclarer.
//
// Rien ne levait : `getWeaponPath` rendait un chemin valide, et le fallback SPA de
// Vite répond 200 `text/html` sur un fichier absent. Repointées sur des GLB
// mesurés présents dans `armes/`.
export const WEAPONS: Record<string, { path: string; label: string }> = {
  arcane_staff: {
    path: "/models/armes/sceptre_of_the_ancient_free.glb",
    label: "Bâton Arcanique",
  },
  fantasy_staff: {
    path: "/models/armes/fantasy_weapon/Meshes/Staff00_mesh.glb",
    label: "Bâton Fantasy",
  },
  wooden_wand: {
    path: "/models/armes/magic_wand.glb",
    label: "Baguette de Bois",
  },
};

export function getWeaponPath(weaponKey: string): string | null {
  return WEAPONS[weaponKey]?.path ?? null;
}

// ── Textures PBR partagées (recoloration via uniforms) ───────────────────────
export const TEXTURES = {
  rangerBaseColor: `${RPG_ASSET_ROOT}/characters/textures/T_Ranger_BaseColor.png`,
  rangerNormal:    `${RPG_ASSET_ROOT}/characters/textures/T_Ranger_Normal.png`,
  rangerORM:       `${RPG_ASSET_ROOT}/characters/textures/T_Ranger_ORM.png`,
  peasantBaseColor:`${RPG_ASSET_ROOT}/characters/textures/T_Peasant_BaseColor.png`,
  peasantNormal:   `${RPG_ASSET_ROOT}/characters/textures/T_Peasant_Normal.png`,
  peasantORM:      `${RPG_ASSET_ROOT}/characters/textures/T_Peasant_ORM.png`,
};

// ── PNJ (modèles Meshy dans /models/pnj/<nom>/) ──────────────────────────────
/** Les 20 PNJ disponibles (noms de dossier sous /models/pnj/). */
export const NPC_FOLDERS = [
  "Grunt", "general", "general_mission", "gran_cheff", "grongnoni_majeur",
  "gronomi_ardent", "gronomi_infaterie", "gronomi_mineur", "kgnitig",
  "mercenaire_alien", "mercenaire_tank", "profhete", "profhete_alien",
  "soldat_femme", "soldat_humain", "soldat_mercenaire", "soldat_vert",
  "sou_major", "venom_stalker",
] as const;
export type NpcFolder = (typeof NPC_FOLDERS)[number];

/**
 * Overrides du nom de fichier GLB pour les PNJ qui n'utilisent PAS le naming
 * standard Meshy. Si absent de cette map → on tombe sur le pattern par défaut.
 *
 * Pourquoi : 18/20 PNJ suivent la convention Meshy
 * `Meshy_AI_biped_Meshy_AI_Meshy_Merged_Animations.glb`. Seuls profhete_alien
 * et venom_stalker exportent un fichier `{folder}_idle.glb`. Sans cet override,
 * `useGLTF` reçoit 404 (HTML) → crash three.js « Unexpected token '<' ».
 *
 * Future Phase 2 : remplacer par un scan auto via `import.meta.glob` qui
 * détecte le premier .glb du dossier — éliminera ces overrides manuels.
 */
const NPC_MODEL_FILE_OVERRIDES: Record<string, string> = {
  profhete_alien:  "profhete_alien_idle.glb",
  venom_stalker:   "venom_stalker_idle.glb",
  mercenaire_tank: "mercenaire_tank_idle.glb",
};

/** Chemin du GLB animé d'un PNJ (Meshy merged animations + overrides).
 *  `root` (ex: "/models/pnj_monstre") et `file` (nom GLB custom) permettent de
 *  pointer un PNJ hors du dossier standard — cf NpcDef.assetRoot / modelFile. */
export function getNpcModelPath(folder: string, root?: string, file?: string): string {
  const filename = file ?? NPC_MODEL_FILE_OVERRIDES[folder]
    ?? "Meshy_AI_biped_Meshy_AI_Meshy_Merged_Animations.glb";
  return `${root ?? NPC_ASSET_ROOT}/${folder}/${filename}`;
}

// ── Maps ──────────────────────────────────────────────────────────────────────
// ── Maps avec 3 variantes de qualité (high/medium/low) ────────────────────────
// Convention de nommage :
//   - `<name>.glb`      → version high (qualité originale, textures full size)
//   - `<name>.med.glb`  → version medium (textures 1024, geometry Draco)
//   - `<name>.low.glb`  → version low (textures 512, geometry Draco)
//
// Le helper `getMapPath(mapId)` choisit automatiquement selon
// `gameSettings.video.quality`. Si une variante n'existe pas (ex: low pas
// encore généré), on fallback sur la version `path` (= high) — le code reste
// fonctionnel pendant le rollout progressif des variantes.
interface MapDef {
  /** Path canonique (= high) — utilisé comme fallback. */
  path: string;
  /** Variantes par qualité — partiellement renseignées au fur et à mesure. */
  paths?: Partial<Record<"low" | "medium" | "high", string>>;
  label: string;
  /**
   * ── PuzzleMap (optionnel) ────────────────────────────────────────────────
   * Si défini : la map est composée de N chunks GLB pré-positionnés dans
   * Blender (chaque chunk garde sa world position). Le système PuzzleMap
   * les charge SÉQUENTIELLEMENT (1 par 1 + requestAnimationFrame entre chaque)
   * → zéro freeze visible (vs 3-10s avec un seul gros GLB).
   *
   * Convention : chemins relatifs à public/, fichiers exportés depuis Blender
   * SANS toucher au transform (position monde conservée). Chaque chunk est
   * compressé Draco via `gltf-pipeline -d`.
   *
   * Si `chunks` est `undefined` → fallback sur le `path` unique (compat
   * descendante pour les maps non-encore découpées).
   *
   * Les chunks supportent les variantes qualité via le suffixe `.med.glb` /
   * `.low.glb` — résolu par `qualityVariant()` au runtime, comme pour `path`.
   */
  chunks?: string[];
  /**
   * Répertoire contenant les chunks ET chunk-metadata.json (généré par
   * `puzzle-chunks.mjs --spatial`). Si défini, StreamingPuzzleMap utilise
   * le C++ WASM pour charger/décharger dynamiquement selon la distance joueur.
   * Sans chunkDir → PuzzleMap classique (charge tout séquentiellement).
   */
  chunkDir?: string;
  /** Décalage monde appliqué à la géométrie (ex: map exportée à Y=200 → offset [0,-200,0]). */
  offset?: [number, number, number];
  /** Si true, charge le GLB monolithique depuis `path` (cache mémoire, pas de chunks). */
  monolithic?: boolean;
}

/** Enregistre une map CUSTOM (Forge Map) au runtime — visible par tout le moteur
 *  (travelTo, PuzzleMap, portails, préchargeur) comme une map du manifest. */
export function registerRuntimeMap(id: string, def: MapDef): void {
  MAPS[id] = def;
}
export type { MapDef };

export const MAPS: Record<string, MapDef> = {
  forge: {
    path:  `${MAPS_ROOT}/forge_map/halo_map.glb`,
    label: "Forge World",
    chunks: FORGE_CHUNKS,
    chunkDir: `${MAPS_ROOT}/forge_map/chunks_v3`,
    // DÉCALAGE RECALCULÉ POUR chunks_v3 — surtout pas un réglage à l'œil.
    //
    // Le réexport du 28/07 a déplacé la géométrie : sondé au rayon vertical
    // exact, l'ancien décalage [0, -200, 0] ne laissait AUCUN SOL sous le point
    // d'apparition (0, 5, 10) ni sur aucun des 8 points testés autour — le
    // joueur naissait dans le vide, et tout ce qui avait été placé sur
    // l'ancienne map (PNJ, coffres) flottait avec lui.
    //
    // Calcul : barycentre du sol de v2 (-800, 176, 852) moins celui de v3
    // (-981, 211, 899) → translation (+181, -35, -47). La composante Y a
    // ensuite été ajustée pour retrouver la hauteur de sol EXACTE de v2 sous le
    // spawn : -27,7 sur v2, -27,8 obtenu ici. Tout ce qui était placé reste
    // donc valide, et les PNJ se re-posent au sol au chargement.
    //
    // Vérifié : 6 des 8 points de sonde retrouvent du sol (les 2 autres sont
    // hors de l'emprise de la map, comme sur v2).
    offset: [181, -401, -47],
  },
  orbital: {
    path:  `${MAPS_ROOT}/Orbital/Orbital_map.gltf`,
    label: "Orbital Hub",
    // CHUNKÉE depuis le 28/07 — la version monolithique ne pouvait pas s'afficher.
    //
    // Le .gltf se CHARGEAIT bien (2,9 s, mesuré) : le problème n'était pas le
    // fichier mais son contenu — 25 222 meshes, donc 25 222 draw calls, plus un
    // BVH de collision par mesh. À titre de comparaison, la Forge tourne avec
    // ~800 nodes répartis sur 8 chunks.
    //
    // Après passage dans `scripts/rebuild-map-chunks.mjs` : 737 primitives, soit
    // 34 fois moins de draw calls, textures en KTX2, 3 variantes de qualité.
    chunks: Array.from({ length: 8 }, (_, i) =>
      `${MAPS_ROOT}/Orbital/chunks/chunk_${String(i + 1).padStart(2, "0")}.glb`),
    chunkDir: `${MAPS_ROOT}/Orbital/chunks`,
    offset: [0, -50, 0],
  },
  tower: {
    path:  `${MAPS_ROOT}/tower_map/tower_map.gltf`,
    label: "Tower",
  },
  donjon_furiste: {
    // ⚠ `path` pointait `donjon_furiste_v2.glb`, le monolithe — SUPPRIMÉ du disque.
    // Seuls les 4 chunks ci-dessous subsistent, et ce sont eux qui chargent la map
    // (`PuzzleMap` prend le relais dès que `chunks` est défini). Le monolithe ne
    // servait donc que de repli théorique, et ce repli menait à un 200 `text/html`.
    // `path` désigne maintenant le premier chunk : présent, et cohérent avec la
    // liste. Les trois variantes de qualité étaient identiques — aucune n'existait,
    // et les garder aurait fait croire à un choix qui n'a jamais été fait.
    path:  `${MAPS_ROOT}/donjon/chunk_01.glb`,
    label: "Donjon Furiste",
    chunks: [
      `${MAPS_ROOT}/donjon/chunk_01.glb`,
      `${MAPS_ROOT}/donjon/chunk_02.glb`,
      `${MAPS_ROOT}/donjon/chunk_03.glb`,
      `${MAPS_ROOT}/donjon/chunk_04.glb`,
    ],
  },
};

/**
 * Retourne la liste des chunks de la map si elle est découpée, sinon `null`.
 * Le caller (PuzzleMap / AssetPreloader) doit basculer sur `getMapPath()` quand
 * `null` est retourné (fallback compat GLB unique).
 *
 * Note : on ne résout PAS la variante qualité ici — c'est le boulot de
 * `qualityVariant()` côté caller. Ça garde ce module pur (manifeste statique).
 */
export function getMapChunks(mapId: string): string[] | null {
  const map = MAPS[mapId];
  if (!map?.chunks || map.chunks.length === 0) return null;
  return map.chunks;
}

export function getMapChunkDir(mapId: string): string | null {
  return MAPS[mapId]?.chunkDir ?? null;
}

/**
 * Résolution dynamique du chemin de map selon la qualité graphique courante.
 * Fallback silencieux sur la version `path` (= high) si la variante demandée
 * n'est pas définie dans le manifest.
 *
 * Note : le **fallback fichier-manquant** est géré par `useGLTF` qui throw
 * en cas de 404 — on intercepte via `verifyMapPath()` (HEAD fetch) appelé par
 * `AssetPreloader.ts` qui peut alors basculer en silence sur le `path` par défaut.
 */
export function getMapPath(mapId: string, quality: "low" | "medium" | "high"): string {
  const map = MAPS[mapId];
  if (!map) return MAPS.forge.path; // garde-fou
  return map.paths?.[quality] ?? map.path;
}

// ── Skin (têtes de base Quaternius — couleur de peau réglable) ───────────────
export const SKIN_TEXTURES: Record<Gender, { baseColor: string; normal: string }> = {
  female: {
    baseColor: `${RPG_ASSET_ROOT}/characters/textures/T_Regular_Female_Dark_BaseColor.png`,
    normal:    `${RPG_ASSET_ROOT}/characters/textures/T_Regular_Female_Normal.png`,
  },
  male: {
    baseColor: `${RPG_ASSET_ROOT}/characters/textures/T_Regular_Male_Dark_BaseColor.png`,
    normal:    `${RPG_ASSET_ROOT}/characters/textures/T_Regular_Male_Normal.png`,
  },
};
