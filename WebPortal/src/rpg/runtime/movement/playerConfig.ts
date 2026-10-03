// ══════════════════════════════════════════════════════════════════════════════
// movement/playerConfig.ts — Configuration CENTRALE du joueur (FPS moderne)
//
// Toutes les constantes réglables vivent ICI (vitesses, gravité, saut, caméra,
// sensibilité) + le mapping des touches. Aucun "magic number" ailleurs.
//
// ⚠ ARCHITECTURE — pourquoi des `get` accessors :
// Les valeurs liées à la TAILLE du perso (height/eyeHeight/radius/...) sont
// des **getters dynamiques** qui lisent le store `characterScaleStore` à chaque
// accès. Conséquence : quand l'admin bouge le slider, la caméra TPS et la
// capsule de collision suivent automatiquement, SANS reload, et sans toucher
// aux modules consommateurs (CharacterController, FpsCamera).
//
// Les VITESSES (walk/run/sprint) ne sont PAS scalées — un perso plus petit
// marche toujours à 3.2 m/s, le gameplay est préservé.
// ══════════════════════════════════════════════════════════════════════════════

import { characterScaleStore } from "../../characters/characterScale";

// Valeurs natives (échelle 1.0 = modèle Mixamo non scalé)
const NATIVE = {
  radius:     0.35,
  height:     1.8,
  stepHeight: 0.4,
  eyeHeight:  1.65,
  bobAmount:  0.045,
};

export const PLAYER_CONFIG = {
  // ── Vitesses horizontales (m/s) — JAMAIS scalées ─────────────────────────
  walkSpeed: 3.2,
  runSpeed: 6.0,
  sprintSpeed: 9.5,
  crouchSpeedMult: 0.45, // accroupi : ~45% de la vitesse (déplacement furtif)
  /**
   * Fraction de la hauteur de capsule conservée en accroupi.
   *
   * La capsule restait à `height` (1,8 m) quelle que soit la posture : le
   * personnage accroupi gardait un volume de collision debout, donc il ne
   * passait sous aucun obstacle bas, et les sondes de mur restaient calées sur
   * un buste qui n'était plus là.
   */
  crouchHeightMult: 0.55,

  // ── Glissade (sprint + crouch = slide) ──────────────────────────────────
  slideDuration: 0.8,     // durée max de la glissade (s)
  slideFriction: 8,       // décélération pendant slide (vs groundDecel=55)
  slideCooldown: 0.5,     // temps d'attente entre 2 slides (s)
  slideMinSpeed: 4.0,     // vitesse min pour déclencher un slide (m/s)
  slideExitSpeed: 1.0,    // en dessous de cette vitesse, le slide se termine (m/s)

  // ── Foulées animation Mixamo (m/s à timeScale=1) — ajuster empiriquement ──
  walkStride: 1.4,
  runStride: 3.8,
  sprintStride: 5.5,

  // ── Accélération / décélération (m/s²) — sensation de contrôle ───────────
  groundAccel: 60,   // montée en vitesse au sol (réactif)
  groundDecel: 55,   // freinage au sol (stop net)
  airAccel: 14,      // contrôle aérien (limité = réaliste)

  // ── Saut & gravité ───────────────────────────────────────────────────────
  jumpVelocity: 6.2,
  gravity: 22,
  maxFall: 60,
  coyoteTime: 0.12,  // saut toléré juste après avoir quitté le sol
  jumpBuffer: 0.12,  // saut mémorisé juste avant l'atterrissage

  // ── Capsule / collision — LIVE (getter qui lit le store à chaque accès) ──
  get radius()      { return NATIVE.radius      * characterScaleStore.get(); },
  get height()      { return NATIVE.height      * characterScaleStore.get(); },
  get stepHeight()  { return NATIVE.stepHeight  * characterScaleStore.get(); },
  groundSnap: 0.08, // tolérance fixe (indépendante de la taille)

  // ── Caméra — LIVE ─────────────────────────────────────────────────────────
  get eyeHeight()   { return NATIVE.eyeHeight   * characterScaleStore.get(); },
  fov: 80,                // FOV large = FPS moderne
  sensitivity: 0.0022,
  pitchMin: -Math.PI / 2 + 0.05,
  pitchMax: Math.PI / 2 - 0.05,

  // ── Vue TPS — distance partiellement scalée par characterScale ───────────
  // `cameraOffset` (slider admin séparé) est appliqué APRÈS dans FpsCamera
  // sur la distance courante (préserve le zoom molette utilisateur).
  get tpsDistanceDefault() {
    return Math.max(4.0, Math.min(12, 6.0 * characterScaleStore.get()));
  },
  tpsDistanceMin: 1.5,
  tpsDistanceMax: 12,

  // ── Head-bob FPS — amplitude scalée (proportionnelle à la taille du pas) ─
  get bobAmount()   { return NATIVE.bobAmount   * characterScaleStore.get(); },
  bobSpeed: 9,
};

// ── Bindings : référence LIVE vers le store de réglages ──────────────────────
// Les touches sont désormais gérées par settings/gameSettings (rebindables +
// persistées). KEYBINDINGS pointe sur le MÊME objet → un rebind (mutation en
// place) est vu instantanément par l'InputManager, sans ré-instanciation.
import { gameSettings } from "../../settings/gameSettings";

export type KeyBindings = typeof gameSettings.keys;
export const KEYBINDINGS: KeyBindings = gameSettings.keys;
