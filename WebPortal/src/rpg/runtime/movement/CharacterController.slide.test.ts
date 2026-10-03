// Tests de la machine à états "glissade" (sprint + appui accroupi).
// CharacterController est du TS pur : seul le monde de collision est mocké
// (sol plat à y=0, aucun mur) pour isoler la logique de slide.

import { describe, it, expect, beforeEach, vi } from "vitest";
import * as THREE from "three";

vi.mock("../CollisionWorld", () => ({
  collisionWorld: {
    getGroundY: () => 0,
    isBlocked: () => false,
  },
}));

import { CharacterController } from "./CharacterController";
import { createPlayerState } from "./playerState";
import { PLAYER_CONFIG as C } from "./playerConfig";
import type { InputManager } from "./InputManager";

/** InputManager minimal : seuls les champs lus par update() sont fournis. */
function makeInput(over: Partial<Record<string, unknown>> = {}) {
  return {
    moveX: 0,
    moveZ: -1, // W = avancer
    sprint: true,
    crouchHeld: false,
    crouchEdge: false,
    jumpHeld: false,
    flyDown: false,
    consumeJump: () => false,
    consumeCrouch: (): boolean => { const c = (over.crouchEdge as boolean) || false; (over as any).crouchEdge = false; return c; },
    ...over,
  } as unknown as InputManager;
}

/** Fait tourner le controller jusqu'à atteindre la vitesse de sprint. */
function reachSprintSpeed(ctrl: CharacterController, state: ReturnType<typeof createPlayerState>) {
  const input = makeInput();
  for (let i = 0; i < 60; i++) {
    state.grounded = true;
    ctrl.update(1 / 60, input, state);
  }
}

describe("CharacterController — glissade", () => {
  let ctrl: CharacterController;
  let state: ReturnType<typeof createPlayerState>;

  beforeEach(() => {
    ctrl = new CharacterController(new THREE.Vector3(0, 0, 0));
    state = createPlayerState();
  });

  it("atteint la vitesse de sprint avant tout test de glissade", () => {
    reachSprintSpeed(ctrl, state);
    expect(state.horizontalSpeed).toBeGreaterThan(C.slideMinSpeed);
    expect(state.sliding).toBe(false);
  });

  it("déclenche la glissade sur un appui accroupi pendant le sprint", () => {
    reachSprintSpeed(ctrl, state);
    state.grounded = true;
    ctrl.update(1 / 60, makeInput({ crouchHeld: true }), state);
    expect(state.sliding).toBe(true);
    expect(state.moveState).toBe("slide");
  });

  it("ne déclenche pas de glissade en dessous de slideMinSpeed", () => {
    state.grounded = true;
    // Une seule frame depuis l'arrêt : vitesse encore quasi nulle.
    ctrl.update(1 / 60, makeInput({ crouchHeld: true }), state);
    expect(state.sliding).toBe(false);
  });

  it("ne déclenche pas de glissade sans sprint", () => {
    reachSprintSpeed(ctrl, state);
    state.grounded = true;
    ctrl.update(1 / 60, makeInput({ crouchHeld: true, sprint: false }), state);
    expect(state.sliding).toBe(false);
  });

  it("passe en accroupi (pas glissade) si la touche est déjà tenue avant le sprint", () => {
    // Front montant requis : accroupi maintenu depuis l'arrêt → jamais de slide.
    // `crouchEdge: true` est l'appui INITIAL : depuis le passage du crouch en
    // toggle, c'est lui qui bascule `crouchToggled`, pas `crouchHeld`. Sans lui
    // le personnage ne s'accroupissait jamais et l'assertion tombait sur
    // `crouching`, alors que le comportement testé est celui de la glissade.
    const held = makeInput({ crouchHeld: true, crouchEdge: true });
    for (let i = 0; i < 60; i++) {
      state.grounded = true;
      ctrl.update(1 / 60, held, state);
    }
    expect(state.sliding).toBe(false);
    expect(state.crouching).toBe(true);
  });

  it("ne relance pas la glissade en boucle quand la touche reste enfoncée", () => {
    reachSprintSpeed(ctrl, state);
    const crouch = makeInput({ crouchHeld: true });
    state.grounded = true;
    ctrl.update(1 / 60, crouch, state);
    expect(state.sliding).toBe(true);

    // Laisse la glissade se terminer, puis continue de tenir la touche bien
    // au-delà du cooldown : aucune nouvelle glissade sans relâcher.
    let retriggered = false;
    let ended = false;
    for (let i = 0; i < 300; i++) {
      state.grounded = true;
      ctrl.update(1 / 60, crouch, state);
      if (!state.sliding) ended = true;
      else if (ended) retriggered = true;
    }
    expect(ended).toBe(true);
    expect(retriggered).toBe(false);
  });

  it("termine la glissade après slideDuration", () => {
    reachSprintSpeed(ctrl, state);
    const crouch = makeInput({ crouchHeld: true });
    state.grounded = true;
    ctrl.update(1 / 60, crouch, state);
    expect(state.sliding).toBe(true);

    const frames = Math.ceil(C.slideDuration * 60) + 2;
    for (let i = 0; i < frames; i++) {
      state.grounded = true;
      ctrl.update(1 / 60, crouch, state);
    }
    expect(state.sliding).toBe(false);
  });

  it("décélère pendant la glissade (momentum décroissant)", () => {
    reachSprintSpeed(ctrl, state);
    const crouch = makeInput({ crouchHeld: true });
    state.grounded = true;
    ctrl.update(1 / 60, crouch, state);
    const atStart = state.horizontalSpeed;

    for (let i = 0; i < 20; i++) {
      state.grounded = true;
      ctrl.update(1 / 60, crouch, state);
    }
    expect(state.horizontalSpeed).toBeLessThan(atStart);
  });

  it("annule la glissade en quittant le sol", () => {
    reachSprintSpeed(ctrl, state);
    const crouch = makeInput({ crouchHeld: true });
    state.grounded = true;
    ctrl.update(1 / 60, crouch, state);
    expect(state.sliding).toBe(true);

    state.grounded = false;
    ctrl.update(1 / 60, crouch, state);
    expect(state.sliding).toBe(false);
  });

  it("désactive crouching pendant la glissade (états exclusifs)", () => {
    reachSprintSpeed(ctrl, state);
    state.grounded = true;
    ctrl.update(1 / 60, makeInput({ crouchHeld: true }), state);
    expect(state.sliding).toBe(true);
    expect(state.crouching).toBe(false);
  });

  it("nettoie l'état de glissade en noclip", () => {
    reachSprintSpeed(ctrl, state);
    const crouch = makeInput({ crouchHeld: true });
    state.grounded = true;
    ctrl.update(1 / 60, crouch, state);
    expect(state.sliding).toBe(true);

    state.noclip = true;
    ctrl.update(1 / 60, crouch, state);
    expect(state.sliding).toBe(false);

    // À la sortie du noclip, la glissade ne reprend pas toute seule.
    state.noclip = false;
    state.grounded = true;
    ctrl.update(1 / 60, crouch, state);
    expect(state.sliding).toBe(false);
  });
});
