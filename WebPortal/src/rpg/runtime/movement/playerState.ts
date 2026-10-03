// ══════════════════════════════════════════════════════════════════════════════
// movement/playerState.ts — État partagé du joueur (lu par caméra, perso, HUD)
//
// Stocké dans une ref (zéro re-render). Source de vérité pour : orientation,
// vue, vitesse, état de mouvement. Champs compatibles avec l'ancien
// RpgCameraState (yaw/pitch/view/tpsDistance/horizontalSpeed/grounded).
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";
import type { ActionId } from "../../types";

export type CameraView = "fps" | "tps";

/** État de locomotion — extensible (slide/dash/wallrun ajoutés plus tard). */
export type MoveState = "idle" | "walk" | "run" | "sprint" | "air" | "slide" | "dash" | "wallrun";

export interface PlayerState {
  yaw: number;             // rotation horizontale (souris) — radians
  pitch: number;           // rotation verticale (souris) — radians
  view: CameraView;        // "fps" (défaut) | "tps"
  tpsDistance: number;     // distance caméra en TPS
  horizontalSpeed: number; // vitesse au sol (anim + bobbing)
  grounded: boolean;       // au sol ?
  crouching: boolean;      // accroupi (Ctrl maintenu) → anim crouch + vitesse réduite
  sliding: boolean;         // glissade (sprint + crouch = slide avec momentum)
  moveState: MoveState;    // état courant de locomotion
  velocity: THREE.Vector3; // vélocité monde complète (x,y,z)
  /**
   * Intention de déplacement dans le repère LOCAL du personnage, normalisée.
   * `localMoveX` : +1 = strafe droite · `localMoveZ` : -1 = avant, +1 = arrière.
   *
   * INDISPENSABLE au blend directionnel, et absent jusqu'ici : `velocity` est en
   * espace MONDE (déjà tournée par le yaw) et `horizontalSpeed` est un scalaire.
   * Aucun consommateur d'animation ne pouvait donc distinguer avancer, reculer
   * et straffer — c'était le vrai verrou du système multi-directionnel, pas les
   * clips.
   */
  localMoveX: number;
  localMoveZ: number;
  /** Le joueur court-il (Maj maintenu ET endurance disponible) ? */
  running: boolean;
  /**
   * L'endurance autorise-t-elle la course ? Écrit par PlayerRig (qui tique le
   * staminaStore), lu par CharacterController.
   *
   * Ce détour garde le contrôleur PUR : il n'importe aucun singleton et reste
   * testable en environnement node, comme le reste de runtime/movement/.
   */
  sprintAllowed: boolean;
  /** Phase d'escalade de mur — "none" hors escalade. Piloté par ClimbController. */
  climbState: "none" | "attaching" | "climbing" | "topping";
  castToken: number;       // incrémenté à chaque sort → déclenche l'anim d'incantation
  castAction: "cast" | "ultimate"; // anim du dernier sort ("ultimate" pour les AoE)
  /** Arme dégainée (F) : true → idle/anims de combat (arme visible) · false → idle normal. */
  weaponDrawn: boolean;
  /** Incrémenté au clic gauche → déclenche l'anim d'auto-attaque. */
  attackToken: number;
  /** Incrémenté sur R → déclenche l'anim de rechargement. */
  reloadToken: number;
  /** Incrémenté au saut (front montant, Espace) → déclenche l'anim de saut. */
  jumpToken: number;
  /** Canal générique "jouer ce one-shot maintenant" (punch/kick/hit/dodge). */
  oneShotToken: number;
  oneShotAction: ActionId;
  /** Incrémenté quand le joueur ENCAISSE un coup → réaction d'impact. */
  hitToken: number;
  /** Vol libre sans collision ni gravité. F4 pour activer/désactiver. */
  noclip: boolean;
  /**
   * Timestamp (performance.now) jusqu'auquel le joueur est immunisé
   * contre les dégâts après son apparition (anti-spawn-kill).
   * 0 = aucune protection active.
   */
  spawnProtectedUntil: number;
}

export function createPlayerState(): PlayerState {
  return {
    yaw: 0,
    pitch: 0,
    view: "tps",
    tpsDistance: 4.0,
    horizontalSpeed: 0,
    grounded: true,
    crouching: false,
    sliding: false,
    moveState: "idle",
    velocity: new THREE.Vector3(),
    localMoveX: 0,
    localMoveZ: 0,
    running: false,
    sprintAllowed: true,
    climbState: "none",
    castToken: 0,
    castAction: "cast",
    weaponDrawn: false,
    attackToken: 0,
    reloadToken: 0,
    jumpToken: 0,
    oneShotToken: 0,
    oneShotAction: "punch1",
    hitToken: 0,
    noclip: false,
    spawnProtectedUntil: 0,
  };
}
