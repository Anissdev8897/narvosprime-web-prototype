// ══════════════════════════════════════════════════════════════════════════════
// runtime/optimizations/ChunkLOD.ts — LOD progressif pour chunks de map
//
// 3 niveaux de détail alignés sur distanceBand (NEAR=35m, MID=60m, FAR=∞) :
//   HIGH   (0-35m)  → mesh complet, textures haute définition
//   MEDIUM (35-60m) → mesh simplifié (décimé 50%), textures 1024
//   LOW    (60+ m)  → mesh très simplifié (décimé 75%) OU billboard sprite
//   CULL   (max+)   → invisible (complète le frustum culling)
//
// Chaque chunk peut avoir jusqu'à 3 niveaux de détail chargés depuis des
// fichiers `.lod_med.glb` et `.lod_low.glb` déduits du chemin du chunk.
// Si les fichiers LOD n'existent pas, le chunk reste au niveau le plus haut.
//
// TRANSITION PROGRESSIVE (cross-fade) :
// Un système d'opacité interpolée entre les niveaux LOD consécutifs évite
// le pop visuel. Le cross-fade s'étend sur LOD_FADE_DURATION unités de distance.
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";
import { NEAR_MAX as LOD_HIGH_DIST, MID_MAX as LOD_MED_DIST } from "../perf/distanceBand";

// ── Constantes partagées ────────────────────────────────────────────────────

/** Seuil HIGH→MEDIUM : 35 mètres (aligné sur distanceBand NEAR_MAX). */
export const LOD_NEAR = 0;

/** Seuil MEDIUM→LOW : 60 mètres (aligné sur distanceBand MID_MAX). */
export const LOD_MEDIUM = LOD_MED_DIST;

/** Seuil LOW→CULL : distance au-delà de laquelle le chunk devient invisible. */
export const LOD_FAR = LOD_MED_DIST * 3; // 180m — au-delà du rayon de décharge

/** Seuil CULL : complètement invisible. */
export const LOD_CULL = LOD_FAR * 2; // 360m

/** Durée du cross-fade en unités monde. */
export const LOD_FADE_DIST = 5; // 5 mètres de fondu entre deux niveaux

/**
 * Noms de fichiers LOD : le pipeline de génération produit `.lod_med.glb`
 * et `.lod_low.glb` à côté du chunk original.
 * Convention :
 *   chunk_01.glb       → HIGH (mesh complet)
 *   chunk_01.lod_med.glb → MEDIUM (50% triangles)
 *   chunk_01.lod_low.glb  → LOW (25% triangles ou billboard)
 */
export const LOD_FILE_SUFFIX_MED = "lod_med";
export const LOD_FILE_SUFFIX_LOW = "lod_low";

// ── Helper types ────────────────────────────────────────────────────────────

export interface ChunkLODLevels {
  high: THREE.Object3D;
  medium: THREE.Object3D | null;
  low: THREE.Object3D | null;
  /** Billboard sprite pour le LOD lointain (optionnel, remplace low si présent). */
  billboard?: THREE.Sprite | null;
}

// ── Cross-fade helpers ──────────────────────────────────────────────────────

/**
 * Calcule le facteur d'opacité (0..1) pour une transition douce entre
 * deux niveaux LOD consécutifs.
 *
 * @param dist        Distance caméra→chunk.
 * @param threshold   Seuil de transition (ex: LOD_MEDIUM).
 * @param fadeDist    Largeur du fondu (ex: LOD_FADE_DIST).
 * @returns 1 = niveau courant visible ; 0 = niveau suivant visible.
 */
export function lodCrossFade(
  dist: number,
  threshold: number,
  fadeDist: number = LOD_FADE_DIST,
): number {
  // Transition s'étend de (threshold - fadeDist) à (threshold + fadeDist)
  const lo = threshold - fadeDist;
  const hi = threshold + fadeDist;
  if (dist <= lo) return 1; // 100 % niveau courant
  if (dist >= hi) return 0; // 100 % niveau suivant
  // Interpolation linéaire dans la zone de fondu
  return 1 - (dist - lo) / (fadeDist * 2);
}

/**
 * Applique un cross-fade entre deux niveaux en modulant l'opacité.
 * Le niveau entrant est rendu visible immédiatement avec opacité = 1 - fade,
 * le niveau sortant avec opacité = fade.
 * La transition s'étend sur ±fadeDist autour de threshold.
 */
export function applyCrossFade(
  currentLevel: THREE.Object3D | null,
  nextLevel: THREE.Object3D | null,
  fadeFactor: number,
): void {
  if (!currentLevel || !nextLevel) return;

  // Le niveau courant s'estompe
  setObjectOpacity(currentLevel, fadeFactor);
  // Le niveau suivant apparaît
  setObjectOpacity(nextLevel, 1 - fadeFactor);
}

/**
 * Applique une opacité uniforme à tous les meshes d'un objet 3D.
 * Préserve l'état `transparent` (activé si nécessaire).
 */
function setObjectOpacity(root: THREE.Object3D, opacity: number): void {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    for (const mat of mats) {
      if (!mat) continue;
      mat.transparent = true;
      mat.opacity = Math.max(0, Math.min(1, opacity));
      mat.needsUpdate = true;
    }
  });
}

/**
 * Crée un sprite billboard pour le LOD lointain.
 * Utilise une texture procédurale simple (cercle gris) qui remplace
 * entièrement le mesh pour les très grandes distances.
 *
 * @param color Couleur hexadécimale du billboard (défaut 0x888888).
 * @param size  Taille en unités monde.
 */
export function createBillboardSprite(
  color: number = 0x888888,
  size: number = 1,
): THREE.Sprite {
  // Texture procédurale : cercle flouté sur fond transparent
  // Utilise OffscreenCanvas si disponible (Worker/Node), sinon document (Browser)
  let canvas: HTMLCanvasElement | OffscreenCanvas;
  if (typeof document !== "undefined") {
    canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
  } else if (typeof OffscreenCanvas !== "undefined") {
    canvas = new OffscreenCanvas(64, 64);
  } else {
    // Fallback : pas de canvas disponible (test Node.js sans DOM)
    // On crée un sprite simple sans texture personnalisée
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        color,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      }),
    );
    sprite.scale.set(size, size, 1);
    return sprite;
  }
  const ctx = canvas.getContext("2d")! as CanvasRenderingContext2D;

  // Fond transparent
  ctx.clearRect(0, 0, 64, 64);

  // Cercle avec dégradé radial (flou)
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.6)`);
  gradient.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, 0.3)`);
  gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(size, size, 1);
  return sprite;
}

/**
 * Capture la couleur dominante d'un mesh pour le billboard LOD.
 * Extrait la couleur moyenne des matériaux d'un objet 3D.
 */
export function extractDominantColor(root: THREE.Object3D): number {
  let r = 0, g = 0, b = 0, count = 0;
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    for (const mat of mats) {
      if (!mat) continue;
      const m = mat as THREE.MeshStandardMaterial;
      if (m.color) {
        r += m.color.r;
        g += m.color.g;
        b += m.color.b;
        count++;
      }
    }
  });
  if (count === 0) return 0x888888;
  const ri = Math.min(255, Math.round((r / count) * 255));
  const gi = Math.min(255, Math.round((g / count) * 255));
  const bi = Math.min(255, Math.round((b / count) * 255));
  return (ri << 16) | (gi << 8) | bi;
}

/**
 * Calcule la taille d'un billboard à partir de la bounding sphere d'un objet.
 */
export function estimateBillboardSize(root: THREE.Object3D): number {
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  return Math.max(size.x, size.y, size.z) * 0.8;
}

// ── LOD Camera Update ──────────────────────────────────────────────────────

/**
 * État du cross-fade pour un chunk LOD.
 */
interface CrossFadeState {
  /** Index du niveau actif en transition (0=high, 1=med, 2=low, 3=cull). */
  fromLevel: number;
  /** Index du niveau cible. */
  toLevel: number;
  /** Facteur de progression 0..1 (0 = fromLevel, 1 = toLevel). */
  progress: number;
  /** Timestamp de début de transition. */
  startedAt: number;
}

// Map des états de cross-fade par chunk
const crossFadeStates = new Map<number, CrossFadeState>();

const FADE_DURATION_MS = 300; // 300 ms pour un cross-fade complet

/**
 * Met à jour le LOD d'un chunk avec cross-fade.
 * Appelé dans useFrame pour chaque chunk LOD actif.
 *
 * @param lod           Le groupe THREE.LOD du chunk.
 * @param cameraPos     Position de la caméra.
 * @param chunkWorldPos Position monde du chunk.
 * @param chunkId       Identifiant unique du chunk.
 * @param dt            Delta time en secondes (pour l'interpolation).
 */
export function updateChunkLODWithFade(
  lod: THREE.LOD,
  cameraPos: THREE.Vector3,
  chunkWorldPos: THREE.Vector3,
  chunkId: number,
  dt: number,
): void {
  const dist = cameraPos.distanceTo(chunkWorldPos);

  // Déterminer le niveau LOD cible
  let targetLevel: number;
  if (dist <= LOD_MEDIUM) {
    targetLevel = 0; // HIGH
  } else if (dist <= LOD_FAR) {
    targetLevel = 1; // MEDIUM
  } else if (dist <= LOD_CULL) {
    targetLevel = 2; // LOW
  } else {
    targetLevel = 3; // CULL
  }

  // Forcer l'update Three.js LOD (choix du niveau selon distance brute)
  const lodCamera = new THREE.Camera();
  lodCamera.position.copy(cameraPos);
  lod.update(lodCamera);

  // ── Cross-fade entre niveaux consécutifs ──
  // On n'applique le fondu qu'entre HIGH↔MEDIUM et MEDIUM↔LOW
  const state = crossFadeStates.get(chunkId);
  const currentLevel = lod.levels[0]?.object; // Three.js donne le niveau actif

  if (state && state.toLevel !== targetLevel) {
    // Changement de cible : redémarrer la transition
    crossFadeStates.set(chunkId, {
      fromLevel: state.toLevel, // on part de là où on allait
      toLevel: targetLevel,
      progress: 0,
      startedAt: performance.now(),
    });
  } else if (!state || state.toLevel !== targetLevel) {
    // Nouvelle transition
    const activeIdx = lod.levels.findIndex((l) => l.object === currentLevel);
    crossFadeStates.set(chunkId, {
      fromLevel: activeIdx >= 0 ? activeIdx : 0,
      toLevel: targetLevel,
      progress: 0,
      startedAt: performance.now(),
    });
  }

  const cur = crossFadeStates.get(chunkId);
  if (!cur) return;

  // Avancer la progression
  const elapsed = performance.now() - cur.startedAt;
  cur.progress = Math.min(1, elapsed / FADE_DURATION_MS);

  if (cur.progress >= 1) {
    // Transition terminée : on nettoie les opacités
    crossFadeStates.delete(chunkId);
    // Rétablir l'opacité normale sur tous les niveaux
    for (const level of lod.levels) {
      setObjectOpacity(level.object, 1);
      level.object.visible = level.object !== currentLevel
        ? level.distance <= dist
        : true;
    }
    return;
  }

  // Pendant la transition : les deux niveaux sont visibles avec fondu
  const fromObj = lod.levels[cur.fromLevel]?.object;
  const toObj = lod.levels[cur.toLevel]?.object;

  if (fromObj && toObj) {
    fromObj.visible = true;
    toObj.visible = true;
    setObjectOpacity(fromObj, 1 - cur.progress);
    setObjectOpacity(toObj, cur.progress);
  }
}

/**
 * Nettoie l'état de cross-fade pour un chunk (au déchargement).
 */
export function clearCrossFade(chunkId: number): void {
  crossFadeStates.delete(chunkId);
}

// ── ChunkLOD creation ───────────────────────────────────────────────────────

/**
 * Crée un groupe THREE.LOD pour un chunk avec support billboard.
 *
 * @param levels  Les 3 niveaux de détail (high, medium, low) + billboard optionnel.
 * @param worldPos Position monde du chunk (pour le calcul de distance).
 * @returns Un THREE.Object3D qui gère le LOD (peut être un groupe ou un LOD).
 */
export function createChunkLOD(
  levels: ChunkLODLevels,
  worldPos?: THREE.Vector3,
): THREE.Object3D {
  const { high, medium, low, billboard } = levels;

  // Si on a un billboard, on l'utilise comme niveau LOW (plus efficace)
  const lowFinal: THREE.Object3D = billboard ?? low ?? high;

  // Si on a un billboard, on veut que le sprite remplace le low mesh
  // On crée un groupe qui contient TOUS les niveaux superposés
  // et on gère la visibilité manuellement via updateChunkLODWithFade
  const group = new THREE.Group();
  group.name = "ChunkLOD";

  // Ajouter tous les niveaux au groupe (visibles selon LOD)
  const highCopy = high.clone();
  highCopy.name = "LOD_HIGH";
  group.add(highCopy);

  const medMesh = medium ?? high;
  const medCopy = medMesh.clone();
  medCopy.name = "LOD_MED";
  // Caché par défaut (s'affiche via cross-fade)
  medCopy.visible = false;
  group.add(medCopy);

  const lowObj = lowFinal.clone();
  lowObj.name = "LOD_LOW";
  lowObj.visible = false;
  group.add(lowObj);

  // Niveau CULL : vide, invisible
  const invisible = new THREE.Group();
  invisible.name = "LOD_CULL";
  invisible.visible = false;
  group.add(invisible);

  // Stocker la position monde pour les calculs de distance
  if (worldPos) {
    group.userData.chunkWorldPos = worldPos.clone();
  }

  return group;
}

/**
 * Version alternative utilisant THREE.LOD natif (sans cross-fade).
 * Plus simple, pop visuel aux seuils. Utilisé quand le cross-fade n'est pas
 * nécessaire (petits chunks, transition peu perceptible).
 */
export function createChunkLODSimple(
  highScene: THREE.Object3D,
  mediumScene: THREE.Object3D | null,
  lowScene: THREE.Object3D | null,
): THREE.LOD {
  const lod = new THREE.LOD();

  // Niveau 0 : mesh complet (HIGH)
  const highCopy = highScene.clone();
  lod.addLevel(highCopy, LOD_NEAR);

  // Niveau 1 : version médium (MEDIUM), ou high en fallback
  const medMesh = mediumScene ?? highScene;
  const medCopy = medMesh.clone();
  lod.addLevel(medCopy, LOD_MEDIUM);

  // Niveau 2 : version low (LOW), ou medium/high en fallback
  const lowMesh = lowScene ?? medMesh;
  const lowCopy = lowMesh.clone();
  lod.addLevel(lowCopy, LOD_FAR);

  // Niveau 3 : invisible au-delà de LOD_CULL
  const invisible = new THREE.Group();
  invisible.visible = false;
  lod.addLevel(invisible, LOD_CULL);

  return lod;
}

// ── LOD Variant paths ───────────────────────────────────────────────────────

/**
 * Déduit le chemin d'une variante LOD de géométrie.
 *
 * Convention :
 *   chunks/chunk_0.glb → chunks/chunk_0.lod_med.glb, chunks/chunk_0.lod_low.glb
 *
 * Ces fichiers sont générés par scripts/generate-chunk-lod.mjs avec
 * meshoptimizer (décimation géométrique, pas seulement redimension texture).
 *
 * @param chunkPath Chemin du chunk original (ex: /maps/forge/chunks/chunk_0.glb)
 * @param level     "high" | "med" | "low" — génère le suffixe approprié
 * @returns Chemin de la variante LOD.
 */
export function lodVariantPath(
  chunkPath: string,
  level: "high" | "med" | "low",
): string {
  if (level === "high") return chunkPath;

  const suffix = level === "med" ? LOD_FILE_SUFFIX_MED : LOD_FILE_SUFFIX_LOW;

  if (chunkPath.endsWith(".glb")) {
    return chunkPath.replace(/\.glb$/i, `.${suffix}.glb`);
  }
  // Cas avec suffixe déjà présent
  return `${chunkPath}.${suffix}`;
}

/**
 * Met à jour la position de la caméra pour forcer le LOD à se recalculer.
 * Version simple (sans cross-fade).
 */
export function updateChunkLOD(
  lod: THREE.LOD,
  cameraPosition: THREE.Vector3,
): void {
  const lodCamera = new THREE.Camera();
  lodCamera.position.copy(cameraPosition);
  lod.update(lodCamera);
}
