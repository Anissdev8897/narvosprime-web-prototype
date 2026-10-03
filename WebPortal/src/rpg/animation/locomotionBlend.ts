// animation/locomotionBlend.ts — Blend space directionnel, logique PURE.
//
// Convertit une intention de déplacement locale (avant/arrière/gauche/droite)
// en poids de mélange sur 8 clips cardinaux. Zéro dépendance à Three.js ou React :
// testable en environnement node, comme le reste des contrôleurs du projet.

import { fastAtan2 } from "../math/math-fast";
//
// PORTAGE DEPUIS LES SOURCES C++ (src/rpg/_vendor_sources/scriptC++)
// Ces sources n'implémentent AUCUN calcul de poids : côté Unreal les BlendSpaces
// sont des assets d'éditeur, et le C++ se contente d'exposer deux scalaires
// (Direction en degrés, NormalizedSpeed). Ce qui EST portable, et qu'on reprend
// ici, c'est leur couche de quantification directionnelle :
//   • l'angle signé  atan2(rightDot, forwardDot)
//   • les bornes cardinales à 45° / 135°
//   • une zone morte et une hystérésis pour empêcher le clignotement à la
//     frontière entre deux directions
// La conversion angle → poids, elle, est écrite entièrement ici.

/** Les 8 directions cardinales, dans l'ordre trigonométrique depuis l'avant. */
export type LocoDir =
  | "forward" | "forwardLeft" | "left" | "backLeft"
  | "back" | "backRight" | "right" | "forwardRight";

/** Angle canonique de chaque direction, en degrés (0 = avant, positif = droite). */
export const DIR_ANGLES: Readonly<Record<LocoDir, number>> = {
  forward:       0,
  forwardRight:  45,
  right:         90,
  backRight:     135,
  back:          180,
  backLeft:     -135,
  left:         -90,
  forwardLeft:  -45,
};

const ORDER: LocoDir[] = [
  "forward", "forwardRight", "right", "backRight",
  "back", "backLeft", "left", "forwardLeft",
];

/** Un clip et son poids dans le mélange. Poids toujours > 0. */
export interface BlendWeight {
  dir: LocoDir;
  weight: number;
}

/**
 * Angle de déplacement signé, en degrés dans ]-180, 180].
 *
 * @param localX intention latérale (+1 = droite)
 * @param localZ intention longitudinale (-1 = avant, convention du projet :
 *               `InputManager.moveZ` vaut -1 pour W, comme l'axe Z de Three.js
 *               pointe vers l'arrière)
 */
export function movementAngle(localX: number, localZ: number): number {
  // -localZ ramène « avant » à +1, ce que atan2 attend comme composante avant.
  return (fastAtan2(localX, -localZ) * 180) / Math.PI;
}

/** Écart angulaire le plus court entre deux angles, dans [-180, 180]. */
export function angleDelta(a: number, b: number): number {
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

/**
 * Poids de mélange pour un angle donné.
 *
 * On ne mélange QUE les deux directions cardinales encadrant l'angle. Mélanger
 * les 8 (façon distance inverse) produirait une bouillie : les clips opposés
 * s'annuleraient et le personnage marcherait sur place.
 *
 * Les poids sont linéaires sur les 45° qui séparent deux cardinales, et leur
 * somme vaut toujours exactement 1.
 */
export function blendWeightsForAngle(angleDeg: number): BlendWeight[] {
  // Index fractionnaire dans ORDER : chaque cran vaut 45°.
  const raw = ((angleDeg % 360) + 360) % 360; // [0, 360[
  const slot = raw / 45;
  const lo = Math.floor(slot) % 8;
  const hi = (lo + 1) % 8;
  const t = slot - Math.floor(slot);

  if (t < 1e-4) return [{ dir: ORDER[lo], weight: 1 }];
  return [
    { dir: ORDER[lo], weight: 1 - t },
    { dir: ORDER[hi], weight: t },
  ];
}

/**
 * Quantifie un angle vers une direction cardinale, avec hystérésis.
 *
 * Sans hystérésis, un angle qui oscille autour d'une frontière (le joueur tenant
 * W+D relâche D par intermittence) ferait basculer la direction plusieurs fois
 * par seconde. On élargit donc le secteur de la direction COURANTE : il faut
 * dépasser la frontière d'une marge pour en sortir. C'est la technique des
 * sources ACF, qui doublent l'hystérésis sur la direction courante.
 *
 * @keep — Conservée pour usage futur. Portée des sources C++ ACF, cette fonction
 *   fournit une quantification discrète (≠ blend continu de blendWeightsForAngle)
 *   utile pour les machines d'état, l'UI directionnelle (boussole, radar), ou la
 *   sélection d'état d'animation (clip unique vs blend). Actuellement non appelée
 *   en production — à supprimer si définitivement inutilisée après intégration UI
 *   et state machines.
 */
export function quantizeDirection(
  angleDeg: number,
  current: LocoDir | null,
  hysteresisDeg = 12,
): LocoDir {
  let best: LocoDir = "forward";
  let bestDelta = Infinity;
  for (const dir of ORDER) {
    let d = Math.abs(angleDelta(angleDeg, DIR_ANGLES[dir]));
    // La direction courante conserve son secteur un peu plus longtemps.
    if (dir === current) d -= hysteresisDeg;
    if (d < bestDelta) { bestDelta = d; best = dir; }
  }
  return best;
}

/** Entrée du solveur de blend, telle que le personnage la connaît chaque frame. */
export interface LocomotionInput {
  /** Intention locale normalisée (voir PlayerState.localMoveX/localMoveZ). */
  localX: number;
  localZ: number;
  /** Vitesse horizontale réelle, en m/s. */
  speed: number;
  /** Vitesses de référence du contrôleur. */
  walkSpeed: number;
  runSpeed: number;
  /** Le personnage est-il accroupi ? Si true + en mouvement → gait "crouchwalk". */
  crouching?: boolean;
}

/** Résultat : quelle allure, quels clips, et à quelle vitesse les lire. */
export interface LocomotionBlend {
  /** "idle" quand le personnage ne se déplace pas, "crouchwalk" quand accroupi en mouvement. */
  gait: "idle" | "walk" | "run" | "crouchwalk";
  /** Clips à mélanger (vide si idle). Somme des poids = 1. */
  weights: BlendWeight[];
  /**
   * Facteur de vitesse de lecture, pour que les pieds ne glissent pas : un clip
   * de marche joué à 1.0 correspond à `walkSpeed`. En dessous ou au-dessus, on
   * étire le temps plutôt que de changer de clip.
   */
  timeScale: number;
  /** Fondu 0..1 entre marche et course, si l'appelant veut superposer les deux. */
  runBlend: number;
}

/** Seuil sous lequel on considère le personnage immobile (m/s). */
const IDLE_SPEED = 0.3;
/** Bornes de vitesse de lecture : au-delà, l'animation devient grotesque. */
const MIN_TIMESCALE = 0.6;
const MAX_TIMESCALE = 1.8;

/**
 * Résout l'état de locomotion complet pour une frame.
 *
 * Le choix d'allure suit la VITESSE réelle, pas la touche : si le joueur relâche
 * Maj, la vitesse décroît progressivement (`approach()` dans CharacterController)
 * et l'animation suit cette décroissance au lieu de sauter brutalement.
 */
export function solveLocomotion(input: LocomotionInput): LocomotionBlend {
  const { localX, localZ, speed, walkSpeed, runSpeed, crouching } = input;
  const moving = speed >= IDLE_SPEED && (localX !== 0 || localZ !== 0);

  if (!moving) {
    return { gait: "idle", weights: [], timeScale: 1, runBlend: 0 };
  }

  const angle = movementAngle(localX, localZ);
  const weights = blendWeightsForAngle(angle);

  // ── Accroupi en mouvement → clips crouchwalk dédiés ────────────────────────
  // Sans cette branche, le système jouait walk/run + crouch additif, ce qui
  // déformait les jambes (double rotation : cycle de marche × repli additif).
  // Les clips crouchwalk contiennent la pose accroupie native → pas de déformation.
  if (crouching) {
    const timeScale = Math.min(MAX_TIMESCALE, Math.max(MIN_TIMESCALE, speed / Math.max(0.001, walkSpeed)));
    return { gait: "crouchwalk", weights, timeScale, runBlend: 0 };
  }

  // Position de la vitesse entre marche et course.
  const runBlend = Math.min(1, Math.max(0, (speed - walkSpeed) / Math.max(0.001, runSpeed - walkSpeed)));
  const gait: "walk" | "run" = runBlend >= 0.5 ? "run" : "walk";

  // Vitesse de lecture relative à la vitesse nominale du clip retenu.
  const reference = gait === "run" ? runSpeed : walkSpeed;
  const timeScale = Math.min(MAX_TIMESCALE, Math.max(MIN_TIMESCALE, speed / Math.max(0.001, reference)));

  return { gait, weights, timeScale, runBlend };
}
