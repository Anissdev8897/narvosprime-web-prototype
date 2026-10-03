// animation/playerAnimDebug.ts — Pont vers l'AnimationController du JOUEUR.
//
// Le contrôleur est créé dans OwnAnimPlayerCharacter (dans le Canvas) tandis que
// le HUD de debug vit dans l'arbre DOM de RpgGameWorld. Les faire communiquer par
// props traverserait tout le composant monolithique pour un besoin de diagnostic.
//
// Singleton hors-React, comme collisionWorld ou npcRegistry. Lu par SONDAGE
// (le HUD interroge à 10 Hz) : aucune notification, donc aucun re-render induit.
import type { AnimationController } from "./AnimationController";

let current: AnimationController | null = null;

export const playerAnimDebug = {
  /** Appelé par OwnAnimPlayerCharacter au montage et au démontage (null). */
  set(ctrl: AnimationController | null): void { current = ctrl; },
  get(): AnimationController | null { return current; },
};
