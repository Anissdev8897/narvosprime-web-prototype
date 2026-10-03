// ══════════════════════════════════════════════════════════════════════════════
// audio/AudioSpatial.ts — Module de spatialisation 3D (wrapper PannerNode)
//
// Gère les PannerNode 3D + mise à jour de l'auditeur. Chaque son spatialisé
// reçoit un PannerNode configuré avec les paramètres Narvos par défaut (HRTF,
// distance inverse, refDistance=8, maxDistance=50).
// ══════════════════════════════════════════════════════════════════════════════

import type { SpatialParams, ListenerState } from './types';

// ── Constantes par défaut ────────────────────────────────────────────────────

export const DEFAULT_SPATIAL: Required<SpatialParams> = {
  position:        { x: 0, y: 0, z: 0 },
  panningModel:    'HRTF',
  distanceModel:   'inverse',
  refDistance:     8,
  maxDistance:     50,
  rolloffFactor:   1.5,
  coneInnerAngle:  360,
  coneOuterAngle:  360,
  coneOuterGain:   0,
};

// ── Fabrique de PannerNode ───────────────────────────────────────────────────

/**
 * Crée et configure un PannerNode avec les paramètres de spatialisation donnés.
 * Les valeurs non fournies prennent les défauts Narvos.
 */
export function createSpatialPanner(
  ctx: AudioContext,
  params: Partial<SpatialParams> = {},
): PannerNode {
  const panner = ctx.createPanner();
  const p = { ...DEFAULT_SPATIAL, ...params };

  panner.panningModel   = p.panningModel;
  panner.distanceModel  = p.distanceModel;
  panner.refDistance    = p.refDistance;
  panner.maxDistance    = p.maxDistance;
  panner.rolloffFactor  = p.rolloffFactor;
  panner.coneInnerAngle = p.coneInnerAngle;
  panner.coneOuterAngle = p.coneOuterAngle;
  panner.coneOuterGain  = p.coneOuterGain;

  panner.positionX.value = p.position.x;
  panner.positionY.value = p.position.y;
  panner.positionZ.value = p.position.z;

  return panner;
}

/**
 * Met à jour la position d'un PannerNode existant.
 */
export function updatePannerPosition(
  panner: PannerNode,
  pos: { x: number; y: number; z: number },
): void {
  panner.positionX.value = pos.x;
  panner.positionY.value = pos.y;
  panner.positionZ.value = pos.z;
}

// ── Gestionnaire de l'auditeur ───────────────────────────────────────────────

/**
 * Listener audio 3D suivant la position du joueur.
 * Met à jour la position et l'orientation de l'auditeur chaque frame.
 */
export class AudioListener3D {
  private _ctx: AudioContext | null = null;

  /** Initialise avec le contexte audio. */
  init(ctx: AudioContext): void {
    this._ctx = ctx;
  }

  /**
   * Met à jour la position et l'orientation de l'auditeur (joueur).
   * À appeler chaque frame.
   */
  update(state: ListenerState): void {
    const ctx = this._ctx;
    if (!ctx) return;

    const l = ctx.listener;
    l.positionX.value = state.position.x;
    l.positionY.value = state.position.y;
    l.positionZ.value = state.position.z;
    l.forwardX.value  = state.forward.x;
    l.forwardY.value  = state.forward.y;
    l.forwardZ.value  = state.forward.z;
    l.upX.value       = state.up.x;
    l.upY.value       = state.up.y;
    l.upZ.value       = state.up.z;
  }

  /** Définit uniquement la position (garde l'orientation par défaut). */
  setPosition(x: number, y: number, z: number): void {
    const ctx = this._ctx;
    if (!ctx) return;

    const l = ctx.listener;
    l.positionX.value = x;
    l.positionY.value = y;
    l.positionZ.value = z;
    l.forwardX.value  = 0;
    l.forwardY.value  = 0;
    l.forwardZ.value  = -1;
    l.upX.value       = 0;
    l.upY.value       = 1;
    l.upZ.value       = 0;
  }

  /** Libère la référence. */
  dispose(): void {
    this._ctx = null;
  }
}

// ── Utilitaire : calcul de distance atténuée (pour debug/fallback) ────────────

/**
 * Calcule l'atténuation de volume selon le modèle inverse.
 * À utiliser pour du volume 2D approximant une position 3D.
 */
export function inverseDistanceAttenuation(
  distance: number,
  refDistance: number,
  maxDistance: number,
  rolloffFactor: number,
): number {
  if (distance <= refDistance) return 1;
  if (distance >= maxDistance) return 0;
  return refDistance / (refDistance + rolloffFactor * (distance - refDistance));
}
