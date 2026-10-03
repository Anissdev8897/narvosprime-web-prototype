// ══════════════════════════════════════════════════════════════════════════════
// camera/recoilProfiles.ts — "DataAssets" de recul caméra (équivalent ScriptableObject).
//
// CHAQUE profil = le FEELING d'un type d'arme / sort / attaque. 100% data : régler
// le ressenti = éditer ces nombres, AUCUN code à toucher. Indexé par id (= payload
// de l'AnimEvent qui le déclenche).
//
// Repère caméra : pitch- = recul vers le HAUT · pos.z+ = caméra reculée (vue -Z).
// ══════════════════════════════════════════════════════════════════════════════

import type { EaseId } from "./ease";

export interface CameraRecoilProfile {
  id: string;
  /** Impulsion de rotation (radians, repère caméra). */
  rot: { pitch: number; yaw: number; roll: number };
  /** Impulsion de position (mètres, repère caméra local : z+ = recul). */
  pos: { x: number; y: number; z: number };
  /** Temps de MONTÉE du kick (s) — court = sec. */
  attack: number;
  /** Temps de RETOUR à zéro (s). */
  duration: number;
  /** Courbe de retour. */
  returnEase: EaseId;
  /** Trauma ajouté au screenShake existant (0..1) — la part "tremblement". */
  shakeTrauma: number;
}

function profile(id: string, p: Partial<CameraRecoilProfile>): CameraRecoilProfile {
  return {
    id,
    rot: p.rot ?? { pitch: 0, yaw: 0, roll: 0 },
    pos: p.pos ?? { x: 0, y: 0, z: 0 },
    attack: p.attack ?? 0.04,
    duration: p.duration ?? 0.26,
    returnEase: p.returnEase ?? "easeOutCubic",
    shakeTrauma: p.shakeTrauma ?? 0,
  };
}

export const RECOIL_PROFILES: Record<string, CameraRecoilProfile> = {
  // ── Sorts ───────────────────────────────────────────────────────────────────
  spell_fire:  profile("spell_fire",  { rot: { pitch: -0.045, yaw: 0, roll: 0.012 }, pos: { x: 0, y: 0, z: -0.05 }, attack: 0.035, duration: 0.26, returnEase: "easeOutCubic", shakeTrauma: 0.16 }),
  spell_aoe:   profile("spell_aoe",   { rot: { pitch: -0.09, yaw: 0, roll: 0 },      pos: { x: 0, y: -0.02, z: -0.09 }, attack: 0.05, duration: 0.42, returnEase: "spring", shakeTrauma: 0.35 }),
  // ── Mêlée ────────────────────────────────────────────────────────────────────
  melee_light: profile("melee_light", { rot: { pitch: -0.02, yaw: 0.015, roll: 0.02 }, pos: { x: 0.01, y: 0, z: -0.03 }, attack: 0.03, duration: 0.2, returnEase: "easeOutQuad", shakeTrauma: 0.1 }),
  melee_heavy: profile("melee_heavy", { rot: { pitch: -0.06, yaw: 0.02, roll: 0.035 }, pos: { x: 0.02, y: -0.01, z: -0.06 }, attack: 0.04, duration: 0.34, returnEase: "spring", shakeTrauma: 0.28 }),
  // ── Archery ──────────────────────────────────────────────────────────────────
  bow_release: profile("bow_release", { rot: { pitch: -0.03, yaw: 0, roll: 0 },       pos: { x: 0, y: 0, z: -0.02 }, attack: 0.02, duration: 0.18, returnEase: "easeOutCubic", shakeTrauma: 0.08 }),
  // ── Impacts reçus / boss (secousse seule, pas de recul directionnel) ──────────
  boss_slam:   profile("boss_slam",   { rot: { pitch: 0, yaw: 0, roll: 0 },           pos: { x: 0, y: 0, z: 0 }, attack: 0.02, duration: 0.4, returnEase: "easeOutCubic", shakeTrauma: 0.55 }),
};

export function getRecoilProfile(id: string): CameraRecoilProfile | undefined {
  return RECOIL_PROFILES[id];
}
