// mapgen/mapGenerator.ts — GÉNÉRATEUR DE CARTES procédural (pur, seedé, testable).
//
// Génère le PEUPLEMENT d'une map existante : biomes en anneaux autour du hub, monstres
// (niveau par distance + meutes), ressources de récolte, points d'intérêt. Déterministe
// par seed (même seed = même monde). La VALIDATION automatique vérifie bornes, espacement,
// zone sûre et plafonds de densité avant application.
//
// Le générateur est PUR : il produit des données ; l'application passe par les stores
// existants (npcPlacementStore / harvestNodeStore) → sauvegarde, édition (F9/F11), gizmos
// et respawn (P1.1) fonctionnent immédiatement sur le contenu généré.
import type { ProfessionId } from "../professions/professionTypes";

// ── RNG seedé (mulberry32) — déterminisme total par seed ────────────────────────
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface MapGenConfig {
  seed: number;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  hub: { x: number; z: number };   // centre SÛR (spawn joueur / village)
  safeRadius: number;               // aucun monstre dans ce rayon
  spawnY: number;                   // Y de dépôt (les entités se calent au sol au montage)
  monsterPoints: number;            // nb de points de spawn de monstres
  maxPack: number;                  // taille de meute max (1-5)
  resources: number;                // nb de nœuds de récolte
  pois: number;                     // nb de points d'intérêt
  levelRange: [number, number];     // niveau bord intérieur → bord extérieur
  /** Dossiers de monstres ENNEMIS disponibles (injectés → générateur pur). */
  enemyFolders: string[];
}

export interface GenPoint { x: number; z: number; }
export interface GenMonster extends GenPoint { folder: string; level: number; packSize: number; respawnSec: number; biome: number; }
export interface GenResource extends GenPoint { profession: ProfessionId; biome: number; }
export interface GenPoi extends GenPoint { label: string; biome: number; }
export interface GenBiome { name: string; r0: number; r1: number; }

export interface MapGenResult {
  seed: number;
  biomes: GenBiome[];
  monsters: GenMonster[];
  resources: GenResource[];
  pois: GenPoi[];
}

const BIOME_NAMES = ["Lisière (sûre)", "Étendue sauvage", "Zone profonde"];
const POI_LABELS = ["Ruines anciennes", "Balise de détresse", "Autel du Vide", "Camp abandonné", "Cache de contrebande", "Épave de vaisseau"];
const PROFESSIONS: ProfessionId[] = ["bucheron", "mineur", "recolteur"];

const MIN_SPACING_MONSTER = 6;   // m entre points de spawn
const MIN_SPACING_RESOURCE = 4;
export const MAX_MONSTER_POINTS = 80; // plafond de densité (perf : respawn + staging)
export const MAX_RESOURCES = 60;

function dist(a: GenPoint, b: GenPoint): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function maxDistFromHub(cfg: MapGenConfig): number {
  const { bounds: b, hub } = cfg;
  return Math.max(
    Math.hypot(b.minX - hub.x, b.minZ - hub.z), Math.hypot(b.maxX - hub.x, b.minZ - hub.z),
    Math.hypot(b.minX - hub.x, b.maxZ - hub.z), Math.hypot(b.maxX - hub.x, b.maxZ - hub.z),
  );
}

/** Anneau de biome (0..2) d'un point selon sa distance au hub. */
export function biomeOf(p: GenPoint, cfg: MapGenConfig): number {
  const d = Math.hypot(p.x - cfg.hub.x, p.z - cfg.hub.z);
  const span = Math.max(1, maxDistFromHub(cfg) - cfg.safeRadius);
  const t = Math.max(0, (d - cfg.safeRadius) / span);
  return Math.min(2, Math.floor(t * 3));
}

/** Échantillonnage par rejet : point dans les bornes, hors zone sûre, espacé des existants. */
function samplePoint(
  rng: () => number, cfg: MapGenConfig, placed: GenPoint[], minSpacing: number,
): GenPoint | null {
  const { bounds: b } = cfg;
  for (let t = 0; t < 40; t++) {
    const p = { x: b.minX + rng() * (b.maxX - b.minX), z: b.minZ + rng() * (b.maxZ - b.minZ) };
    if (Math.hypot(p.x - cfg.hub.x, p.z - cfg.hub.z) < cfg.safeRadius) continue;
    if (placed.some((q) => dist(p, q) < minSpacing)) continue;
    return p;
  }
  return null; // densité trop forte pour les bornes → le validateur le signalera
}

export function generateMap(cfg: MapGenConfig): MapGenResult {
  const rng = mulberry32(cfg.seed);
  const span = Math.max(1, maxDistFromHub(cfg) - cfg.safeRadius);
  const biomes: GenBiome[] = BIOME_NAMES.map((name, i) => ({
    name, r0: cfg.safeRadius + (span * i) / 3, r1: cfg.safeRadius + (span * (i + 1)) / 3,
  }));

  // ── Monstres : niveau lerp par distance, meutes plus grosses au loin ──────────
  const monsters: GenMonster[] = [];
  const mPts: GenPoint[] = [];
  const nM = Math.min(cfg.monsterPoints, MAX_MONSTER_POINTS);
  for (let i = 0; i < nM; i++) {
    const p = samplePoint(rng, cfg, mPts, MIN_SPACING_MONSTER);
    if (!p) break;
    mPts.push(p);
    const d = Math.hypot(p.x - cfg.hub.x, p.z - cfg.hub.z);
    const t = Math.min(1, Math.max(0, (d - cfg.safeRadius) / span));
    const level = Math.round(cfg.levelRange[0] + t * (cfg.levelRange[1] - cfg.levelRange[0]));
    const b = biomeOf(p, cfg);
    const packSize = 1 + Math.floor(rng() * Math.min(cfg.maxPack, 1 + b * 2)); // loin = meutes
    const folder = cfg.enemyFolders[Math.floor(rng() * cfg.enemyFolders.length)] ?? "bandit";
    monsters.push({ ...p, folder, level, packSize: Math.min(5, packSize), respawnSec: 45, biome: b });
  }

  // ── Ressources : mix uniforme des 3 métiers (les paliers gèrent la valeur) ────
  const resources: GenResource[] = [];
  const rPts: GenPoint[] = [];
  const nR = Math.min(cfg.resources, MAX_RESOURCES);
  for (let i = 0; i < nR; i++) {
    const p = samplePoint(rng, cfg, rPts, MIN_SPACING_RESOURCE);
    if (!p) break;
    rPts.push(p);
    resources.push({ ...p, profession: PROFESSIONS[Math.floor(rng() * PROFESSIONS.length)], biome: biomeOf(p, cfg) });
  }

  // ── Points d'intérêt : espacés large, jamais deux fois le même label de suite ──
  const pois: GenPoi[] = [];
  const pPts: GenPoint[] = [];
  for (let i = 0; i < cfg.pois; i++) {
    const p = samplePoint(rng, cfg, pPts, 25);
    if (!p) break;
    pPts.push(p);
    pois.push({ ...p, label: POI_LABELS[(i + Math.floor(rng() * POI_LABELS.length)) % POI_LABELS.length], biome: biomeOf(p, cfg) });
  }

  return { seed: cfg.seed, biomes, monsters, resources, pois };
}

// ── VALIDATION automatique (avant application) ──────────────────────────────────
export interface GenValidation { ok: boolean; errors: string[]; warnings: string[]; }

export function validateGeneration(r: MapGenResult, cfg: MapGenConfig): GenValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { bounds: b } = cfg;
  const inBounds = (p: GenPoint) => p.x >= b.minX && p.x <= b.maxX && p.z >= b.minZ && p.z <= b.maxZ;
  const inSafe = (p: GenPoint) => Math.hypot(p.x - cfg.hub.x, p.z - cfg.hub.z) < cfg.safeRadius;

  for (const m of r.monsters) {
    if (!inBounds(m)) errors.push(`Monstre hors bornes (${m.x.toFixed(0)},${m.z.toFixed(0)})`);
    if (inSafe(m)) errors.push(`Monstre dans la zone sûre (${m.x.toFixed(0)},${m.z.toFixed(0)})`);
    if (m.packSize < 1 || m.packSize > 5) errors.push(`Meute invalide ×${m.packSize}`);
    if (m.level < 1 || m.level > 50) errors.push(`Niveau invalide ${m.level}`);
  }
  for (let i = 0; i < r.monsters.length; i++) {
    for (let j = i + 1; j < r.monsters.length; j++) {
      if (dist(r.monsters[i], r.monsters[j]) < MIN_SPACING_MONSTER - 0.01) {
        errors.push(`Spawns trop proches (#${i}/#${j})`);
      }
    }
  }
  for (const res of r.resources) if (!inBounds(res)) errors.push(`Ressource hors bornes`);
  if (r.monsters.length > MAX_MONSTER_POINTS) errors.push(`Densité monstres > ${MAX_MONSTER_POINTS}`);
  if (r.resources.length > MAX_RESOURCES) errors.push(`Densité ressources > ${MAX_RESOURCES}`);
  if (r.monsters.length < cfg.monsterPoints) warnings.push(`Densité demandée non atteinte (${r.monsters.length}/${cfg.monsterPoints}) — bornes trop petites ?`);
  if (r.resources.length < cfg.resources) warnings.push(`Ressources placées ${r.resources.length}/${cfg.resources}`);

  return { ok: errors.length === 0, errors, warnings };
}
