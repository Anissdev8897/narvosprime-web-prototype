// ══════════════════════════════════════════════════════════════════════════════
// runtime/debug/gameplayDebugger/Debug3DHelpers.ts — Helpers de debug 3D
//
// Fonctions factory pour créer des DebugDrawCall sans se répéter.
// Chaque helper renvoie un objet prêt à être consommé par Debug3DScene.
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";
import type { DebugLineCall, DebugSphereCall, DebugTextCall } from "./core";

/** Couleur par défaut : vert clair. */
const DEFAULT_LINE_COLOR = 0x00ff00;
const DEFAULT_SPHERE_COLOR = 0xffff00;
const DEFAULT_TEXT_COLOR = 0xffffff;

/**
 * Crée un appel de ligne de debug entre deux points.
 * @param start  Point de départ (Vector3)
 * @param end    Point d'arrivée (Vector3)
 * @param color  Couleur hex (défaut 0x00ff00)
 * @param duration Durée en frames (0 = une frame)
 */
export function DebugLine(
  start: THREE.Vector3,
  end: THREE.Vector3,
  color: number = DEFAULT_LINE_COLOR,
  duration?: number,
): DebugLineCall {
  return { type: "line", start, end, color, duration };
}

/**
 * Crée un appel de sphère de debug à une position.
 * @param center Centre de la sphère (Vector3)
 * @param radius Rayon de la sphère
 * @param color  Couleur hex (défaut 0xffff00)
 * @param duration Durée en frames (0 = une frame)
 */
export function DebugSphere(
  center: THREE.Vector3,
  radius: number,
  color: number = DEFAULT_SPHERE_COLOR,
  duration?: number,
): DebugSphereCall {
  return { type: "sphere", center, radius, color, duration };
}

/**
 * Crée un appel de texte de debug dans l'espace 3D.
 * @param position Position du texte (Vector3)
 * @param text     Texte à afficher
 * @param color    Couleur hex (défaut 0xffffff)
 * @param size     Taille du texte (défaut 0.4)
 * @param duration Durée en frames (0 = une frame)
 */
export function DebugText(
  position: THREE.Vector3,
  text: string,
  color: number = DEFAULT_TEXT_COLOR,
  size?: number,
  duration?: number,
): DebugTextCall {
  return { type: "text", position, text, color, size, duration };
}
