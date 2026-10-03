// weapons/fpsWeaponOffsets.ts — offsets FPS (position/rotation/échelle) par type d'arme.
//
// Chaque type d'arme a une position, rotation et échelle FPS dédiée pour que
// toutes les armes s'affichent correctement en vue 1ʳᵉ personne avec des proportions
// cohérentes entre TPS et FPS.
//
// POSITION : [avant, bas, droite] en mètres, espace local caméra.
// ROTATION : Euler XYZ radians, appliquée dans l'espace local caméra.
//            Une épée légèrement penchée, un bouclier devant la main, etc.
// SCALE    : multiplicateur PAR-DESSUS l'auto-scale bbox (VM_TARGET_HEIGHT / hauteur).
//
// Si un type d'arme n'est PAS dans le registre, FPS_OFFSET_DEFAULT est utilisé :
// jamais d'arme invisible ou mal positionnée.
//
// Les valeurs sont des réglages de base « raisonnables ». L'éditeur in-game
// (weaponEditorStore / weaponCalibrationStore) permet de les affiner en direct.

import type { WeaponType } from "./weaponClassifier";
import { WEAPON_TARGET_SIZE } from "./weaponScale";

// ── Interface ───────────────────────────────────────────────────────────────

export interface FpsWeaponOffset {
  /** Position dans l'espace caméra : [Z avant, Y bas, X droite] en mètres. */
  position: [number, number, number];
  /** Rotation Euler XYZ en radians, dans l'espace local caméra. */
  rotation: [number, number, number];
  /**
   * Multiplicateur d'échelle par-dessus l'auto-scale bbox.
   * Permet d'ajuster la taille FPS pour qu'elle soit cohérente avec la
   * taille cible TPS (WEAPON_TARGET_SIZE).
   */
  scale: number;
}

// ── Défaut pour toute arme sans offset FPS spécifique ──────────────────────

/**
 * Position neutre, bras tendu, arme centrée.
 * Utilisé comme fallback pour tout type d'arme non listé.
 */
export const FPS_OFFSET_DEFAULT: FpsWeaponOffset = {
  position: [-0.45, -0.35, 0.2],
  rotation: [0, 0, 0],
  scale: 1,
};

// ── Registre par type d'arme ────────────────────────────────────────────────

const FPS_TARGET_SIZE = 0.6; // VM_TARGET_HEIGHT de FpsWeaponViewmodel

/**
 * Calcule le scale FPS idéal pour qu'une arme de type donné garde une taille
 * proportionnelle à sa taille TPS. Si l'arme fait 0.95 m en TPS (sword_1h),
 * elle sera plus grande en FPS qu'un gun (0.45 m) — comme attendu.
 */
function fpsTypeScale(tpsTarget: number): number {
  if (tpsTarget <= 0) return 1;
  // Ratio : si la cible TPS est plus grande que la base FPS,
  // on augmente l'échelle pour compenser, et inversement.
  return tpsTarget / FPS_TARGET_SIZE;
}

export const FPS_WEAPON_OFFSETS: Partial<Record<WeaponType, FpsWeaponOffset>> = {
  // ── Armes blanches ──────────────────────────────────────────────────────
  // Les épées/bâtons sont tenus avec un angle léger pour ne pas cacher la vue.
  sword_1h: {
    position: [-0.50, -0.38, 0.15],
    rotation: [-0.15, 0, 0.25],
    scale: fpsTypeScale(WEAPON_TARGET_SIZE.sword_1h),
  },
  sword_2h: {
    position: [-0.55, -0.42, 0.10],
    rotation: [-0.10, 0, 0.15],
    scale: fpsTypeScale(WEAPON_TARGET_SIZE.sword_2h),
  },
  dagger: {
    position: [-0.38, -0.30, 0.22],
    rotation: [-0.20, 0, 0.35],
    scale: fpsTypeScale(WEAPON_TARGET_SIZE.dagger),
  },
  axe: {
    position: [-0.48, -0.36, 0.18],
    rotation: [-0.15, 0, 0.25],
    scale: fpsTypeScale(WEAPON_TARGET_SIZE.axe),
  },
  blunt: {
    position: [-0.45, -0.35, 0.18],
    rotation: [-0.10, 0, 0.20],
    scale: fpsTypeScale(WEAPON_TARGET_SIZE.blunt),
  },
  spear: {
    position: [-0.60, -0.42, 0.08],
    rotation: [-0.25, 0, 0],
    scale: fpsTypeScale(WEAPON_TARGET_SIZE.spear),
  },

  // ── Distances / Magie ──────────────────────────────────────────────────
  bow: {
    position: [-0.35, -0.30, 0.10],
    rotation: [0, 0, 0],
    scale: fpsTypeScale(WEAPON_TARGET_SIZE.bow),
  },
  staff: {
    position: [-0.50, -0.40, 0.12],
    rotation: [-0.10, 0, 0.10],
    scale: fpsTypeScale(WEAPON_TARGET_SIZE.staff),
  },

  // ── Armes à feu ────────────────────────────────────────────────────────
  // Centrées, pas de rotation → visée naturelle.
  gun: {
    position: [-0.40, -0.32, 0.18],
    rotation: [0, 0, 0],
    scale: fpsTypeScale(WEAPON_TARGET_SIZE.gun),
  },

  // ── Bouclier (offhand, ne devrait pas être en FPS seule, mais au cas où) ─
  shield: {
    position: [-0.30, -0.28, -0.15],
    rotation: [0, 0.40, 0],
    scale: fpsTypeScale(WEAPON_TARGET_SIZE.shield),
  },
};

// ── Fonctions d'accès ──────────────────────────────────────────────────────

/**
 * Résout l'offset FPS pour un type d'arme donné.
 * Retourne FPS_OFFSET_DEFAULT si le type n'est pas dans le registre →
 * jamais d'arme invisible ou mal positionnée.
 */
export function getFpsWeaponOffset(type: string): FpsWeaponOffset {
  return FPS_WEAPON_OFFSETS[type as WeaponType] ?? FPS_OFFSET_DEFAULT;
}

/**
 * Résout le multiplicateur d'échelle FPS pour un type d'arme donné.
 * @returns scale multiplier (≥ 0.1, jamais NaN/0)
 */
export function getFpsWeaponScale(type: string): number {
  const off = getFpsWeaponOffset(type);
  return Math.max(0.1, off.scale || 1);
}

/** Nombre de types d'armes avec un offset FPS dédié (utile pour les stats). */
export const FPS_OFFSET_COVERAGE = Object.keys(FPS_WEAPON_OFFSETS).length;
