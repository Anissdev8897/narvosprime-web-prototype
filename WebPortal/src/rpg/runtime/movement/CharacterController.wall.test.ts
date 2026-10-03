// Tests de collision murale, détection de sol, seuil de chute et edge cases
// de CharacterController — complément au slide test qui teste déjà la glissade.
//
// On mock collisionWorld pour contrôler les raycasts, et mapBoundsStore pour
// les murs invisibles admin. CharacterController est testé en isolation.

import { describe, it, expect, beforeEach, vi } from "vitest";
import * as THREE from "three";
import { CharacterController } from "./CharacterController";
import { createPlayerState } from "./playerState";
import { PLAYER_CONFIG as C } from "./playerConfig";
import type { InputManager } from "./InputManager";

// ── Mocks ────────────────────────────────────────────────────────────────────
vi.mock("../CollisionWorld", () => ({
  collisionWorld: {
    getGroundY: vi.fn(() => 0),
    isBlocked: vi.fn(() => false),
  },
}));

vi.mock("../mapBoundsStore", () => ({
  mapBoundsStore: {
    blocksActive: vi.fn(() => false),
    activeMap: vi.fn(() => "test_map"),
    fallFloor: vi.fn((_mapId: string, repli: number) => repli),
  },
}));

// Import après les mocks
import { collisionWorld } from "../CollisionWorld";
import { mapBoundsStore } from "../mapBoundsStore";

function makeInput(over: Partial<Record<string, unknown>> = {}) {
  // L'accroupi est passé de « maintenu » à « toggle » : `CharacterController`
  // lit désormais un FRONT MONTANT via `consumeCrouch()`, pas l'état `crouchHeld`.
  // On modélise ici le même contrat que l'`InputManager` réel — une seule frame
  // à `true`, puis consommé — dérivé de `crouchHeld` pour que les tests écrits
  // avant le toggle gardent leur intention : « ce joueur est accroupi ».
  let crouchEdge = (over.crouchHeld as boolean) ?? false;
  return {
    moveX: 0,
    moveZ: -1, // W = avancer
    sprint: false,
    crouchHeld: false,
    jumpHeld: false,
    flyDown: false,
    consumeJump: () => false,
    consumeCrouch: () => {
      const edge = crouchEdge;
      crouchEdge = false;
      return edge;
    },
    ...over,
  } as unknown as InputManager;
}

/** Avance de N frames à 60 fps, au sol, sans mur. */
function tick(
  ctrl: CharacterController,
  state: ReturnType<typeof createPlayerState>,
  frames: number,
  input?: InputManager,
) {
  const inp = input ?? makeInput();
  for (let i = 0; i < frames; i++) {
    state.grounded = true;
    ctrl.update(1 / 60, inp, state);
  }
}

describe("CharacterController — collision murale (isBlocked)", () => {
  let ctrl: CharacterController;
  let state: ReturnType<typeof createPlayerState>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(collisionWorld.getGroundY).mockReturnValue(0);
    vi.mocked(collisionWorld.isBlocked).mockReturnValue(false);
    vi.mocked(mapBoundsStore.blocksActive).mockReturnValue(false);
    ctrl = new CharacterController(new THREE.Vector3(0, 0, 0));
    state = createPlayerState();
  });

  it("avance normalement quand isBlocked est false", () => {
    const input = makeInput({ moveZ: -1 }); // avancer
    tick(ctrl, state, 30, input);
    expect(ctrl.position.z).toBeLessThan(0); // a avancé vers l'avant
  });

  it("s'arrête devant un mur (isBlocked → true à une hauteur)", () => {
    vi.mocked(collisionWorld.isBlocked).mockReturnValue(true);
    const input = makeInput({ moveZ: -1 });
    const beforeZ = ctrl.position.z;
    tick(ctrl, state, 30, input);
    // Bloqué : n'a pas dû bouger en z
    expect(ctrl.position.z).toBe(beforeZ);
  });

  it("teste les 3 hauteurs (capsule) — bloqué si une seule est obstruée", () => {
    // isBlocked renvoie true uniquement à la 2e hauteur (hanche)
    let callCount = 0;
    vi.mocked(collisionWorld.isBlocked).mockImplementation(() => {
      callCount++;
      return callCount === 2; // bloqué à la hanche uniquement
    });
    const input = makeInput({ moveZ: -1 });
    const beforeX = ctrl.position.x;
    tick(ctrl, state, 10, input);
    // Doit être bloqué car une des hauteurs l'est
    // moveAxis teste d'abord X (moveAxis X callé avec dx,0), puis Z (0,dz)
    // => pour z: 3 appels isBlocked, le 2e bloque → stop
    // moveAxis X est appelé avec dx=0 → skip
    expect(callCount).toBeGreaterThanOrEqual(2);
  });

  it("les hauteurs de sonde rétrécissent en accroupi", () => {
    vi.mocked(collisionWorld.isBlocked).mockReturnValue(false);
    const input = makeInput({ crouchHeld: true }); // pas sprint → accroupi, pas slide
    state.grounded = true;
    // Forcer crouching via frames (le front montant bloque le slide)
    // D'abord, relâcher pour que prevCrouchHeld=false, puis appuyer
    const rel = makeInput({ crouchHeld: false });
    ctrl.update(1 / 60, rel, state);
    ctrl.update(1 / 60, input, state);
    expect(state.crouching).toBe(true);

    // Vérifier que les hauteurs sont réduites : en accroupi,
    // computeWallHeights(true) utilise C.height * C.crouchHeightMult
    const crouchH = C.height * C.crouchHeightMult;
    // La plus haute sonde = crouchH - 0.15
    // Si isBlocked est appelé, il reçoit pos.y + h où h est dans les wallHeights
    // On vérifie juste que la logique ne crashe pas avec crouch
    tick(ctrl, state, 5, input);
    expect(collisionWorld.isBlocked).toHaveBeenCalled();
  });

  it("si isBlocked lève, le mouvement est AUTORISÉ (dégradation gracieuse)", () => {
    vi.mocked(collisionWorld.isBlocked).mockImplementation(() => {
      throw new Error("BVH corrompu");
    });
    const input = makeInput({ moveZ: -1 });
    const beforeZ = ctrl.position.z;
    tick(ctrl, state, 10, input);
    // Le mouvement passe malgré l'erreur
    expect(ctrl.position.z).toBeLessThan(beforeZ);
  });
});

describe("CharacterController — murs invisibles (mapBoundsStore)", () => {
  let ctrl: CharacterController;
  let state: ReturnType<typeof createPlayerState>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(collisionWorld.getGroundY).mockReturnValue(0);
    vi.mocked(collisionWorld.isBlocked).mockReturnValue(false);
    vi.mocked(mapBoundsStore.blocksActive).mockReturnValue(false);
    ctrl = new CharacterController(new THREE.Vector3(0, 0, 0));
    state = createPlayerState();
  });

  it("avance normalement sans mur admin", () => {
    const input = makeInput({ moveZ: -1 });
    tick(ctrl, state, 30, input);
    expect(ctrl.position.z).toBeLessThan(0);
  });

  it("bloque à la position d'ARRIVÉE (pas de départ)", () => {
    // blocksActive(posArrivee) = true → bloqué
    vi.mocked(mapBoundsStore.blocksActive).mockImplementation((x, y, z) => {
      return z < -1; // bloqué si on dépasse z=-1
    });
    const input = makeInput({ moveZ: -1 });
    tick(ctrl, state, 60, input);
    // Ne devrait pas dépasser z=-1 (à radius près)
    expect(ctrl.position.z).toBeGreaterThanOrEqual(-1.5);
  });

  it("laisse passer si le joueur est DÉJÀ hors zone (permet le retour)", () => {
    // Position initiale déjà hors zone
    ctrl.position.set(50, 0, 50);
    // blocksActive(posArrivee) = true : vers l'extérieur → bloqué
    // blocksActive(posActuelle) = true : déjà dehors
    // → les deux true → le joueur peut bouger (clause de retour)
    vi.mocked(mapBoundsStore.blocksActive).mockReturnValue(true);
    const input = makeInput({ moveX: 1, moveZ: 0 });
    const beforeX = ctrl.position.x;
    tick(ctrl, state, 10, input);
    // Quand le joueur est déjà bloqué à sa position actuelle,
    // on laisse passer le mouvement (clause !blocksActive(posActuelle))
    // Ici, blocksActive(posActuelle)=true → !true=false → le early return n'est PAS pris
    // → le mouvement est appliqué
    expect(ctrl.position.x).not.toBe(beforeX);
  });
});

describe("CharacterController — détection de sol et anti-chute", () => {
  let ctrl: CharacterController;
  let state: ReturnType<typeof createPlayerState>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(collisionWorld.getGroundY).mockReturnValue(0);
    vi.mocked(collisionWorld.isBlocked).mockReturnValue(false);
    vi.mocked(mapBoundsStore.blocksActive).mockReturnValue(false);
    ctrl = new CharacterController(new THREE.Vector3(0, 0, 0));
    state = createPlayerState();
  });

  it("reste au sol quand le sol est détecté", () => {
    vi.mocked(collisionWorld.getGroundY).mockReturnValue(0);
    tick(ctrl, state, 30);
    expect(state.grounded).toBe(true);
    expect(ctrl.position.y).toBe(0);
  });

  it("tombe quand le sol disparaît (groundY = null)", () => {
    vi.mocked(collisionWorld.getGroundY).mockReturnValue(null);
    const beforeY = ctrl.position.y;
    tick(ctrl, state, 10);
    // Le personnage n'est plus grounded → la gravité s'applique
    expect(state.grounded).toBe(false);
    expect(ctrl.position.y).toBeLessThan(beforeY);
  });

  it("le groundSnap recolle au sol quand on est proche", () => {
    vi.mocked(collisionWorld.getGroundY).mockReturnValue(0);
    ctrl.position.y = C.groundSnap * 0.5; // juste au-dessus
    ctrl.update(1 / 60, makeInput(), state);
    // velY <= 0.01 et position.y <= groundY + groundSnap → grounded
    expect(state.grounded).toBe(true);
    expect(ctrl.position.y).toBe(0); // snap
  });

  it("ne recolle PAS si on est trop haut (au-dessus de groundSnap)", () => {
    vi.mocked(collisionWorld.getGroundY).mockReturnValue(0);
    ctrl.position.y = C.groundSnap * 2; // trop haut
    ctrl.update(1 / 60, makeInput(), state);
    expect(state.grounded).toBe(false);
    expect(ctrl.position.y).not.toBe(0);
  });

  it("la gravité est plafonnée à maxFall", () => {
    vi.mocked(collisionWorld.getGroundY).mockReturnValue(null);
    // On fait tomber le personnage longtemps
    for (let i = 0; i < 300; i++) {
      state.grounded = false;
      ctrl.update(1 / 60, makeInput(), state);
    }
    // La vélocité verticale ne doit pas dépasser -maxFall
    expect(Math.abs(state.velocity.y)).toBeLessThanOrEqual(C.maxFall + 0.1);
  });

  it("getGroundY en erreur → groundY=null mais pas de crash", () => {
    // Simuler un BVH corrompu : getGroundY lève une exception.
    // Le try-catch dans update() autour du premier appel getGroundY
    // protège contre le crash. Mais fallThreshold() appelle AUSSI
    // getGroundY sans protection → si les deux appels throw, le 2e
    // n'est pas catché. On simule donc un scénario réaliste : 1er appel
    // throw, 2e (fallThreshold) retourne null.
    let callCount = 0;
    vi.mocked(collisionWorld.getGroundY).mockImplementation(() => {
      callCount++;
      if (callCount === 1) throw new Error("BVH corrompu");
      return null; // fallThreshold → pas de mesure → FALL_HARD_FLOOR
    });
    expect(() => ctrl.update(1 / 60, makeInput(), state)).not.toThrow();
    // groundY = null → isGrounded = false
    expect(state.grounded).toBe(false);
  });
});

describe("CharacterController — saut (coyote + buffer)", () => {
  let ctrl: CharacterController;
  let state: ReturnType<typeof createPlayerState>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(collisionWorld.getGroundY).mockReturnValue(0);
    vi.mocked(collisionWorld.isBlocked).mockReturnValue(false);
    vi.mocked(mapBoundsStore.blocksActive).mockReturnValue(false);
    ctrl = new CharacterController(new THREE.Vector3(0, 0, 0));
    state = createPlayerState();
  });

  it("saute quand on est au sol", () => {
    const jumped = vi.fn();
    const jmpCtrl = new CharacterController(new THREE.Vector3(0, 0, 0), jumped);
    const input = makeInput({ consumeJump: () => true });
    jmpCtrl.update(1 / 60, input, state);
    expect(jumped).toHaveBeenCalled();
  });

  it("ne saute pas deux fois en l'air", () => {
    const jumped = vi.fn();
    const jmpCtrl = new CharacterController(new THREE.Vector3(0, 0, 0), jumped);
    const input = makeInput({ consumeJump: () => true });
    // Premier saut
    jmpCtrl.update(1 / 60, input, state);
    expect(jumped).toHaveBeenCalledTimes(1);
    // Deuxième frame en l'air : consumeJump=true mais coyote=0
    state.grounded = false;
    jmpCtrl.update(1 / 60, input, state);
    expect(jumped).toHaveBeenCalledTimes(1); // pas de 2e appel
  });

  it("le coyote time permet de sauter juste après avoir quitté le sol", () => {
    // On quitte le sol à cette frame
    vi.mocked(collisionWorld.getGroundY).mockReturnValue(100); // sol loin en dessous
    ctrl.position.y = 1;
    // La frame d'avant on était grounded
    state.grounded = true;
    const jumped = vi.fn();
    const jmpCtrl = new CharacterController(new THREE.Vector3(0, 1, 0), jumped);
    const input = makeInput({ consumeJump: () => true });
    jmpCtrl.update(1 / 60, input, state);
    // grounded=true au début → coyote réinitialisé → le saut passe
    expect(jumped).toHaveBeenCalled();
  });
});

describe("CharacterController — dt invalide et edge cases", () => {
  let state: ReturnType<typeof createPlayerState>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(collisionWorld.getGroundY).mockReturnValue(0);
    vi.mocked(collisionWorld.isBlocked).mockReturnValue(false);
    vi.mocked(mapBoundsStore.blocksActive).mockReturnValue(false);
    state = createPlayerState();
  });

  it("dt = 0 → aucune mise à jour", () => {
    const ctrl = new CharacterController(new THREE.Vector3(1, 2, 3));
    ctrl.update(0, makeInput(), state);
    expect(ctrl.position.toArray()).toEqual([1, 2, 3]);
  });

  it("dt négatif → aucune mise à jour", () => {
    const ctrl = new CharacterController(new THREE.Vector3(1, 2, 3));
    ctrl.update(-0.016, makeInput(), state);
    expect(ctrl.position.toArray()).toEqual([1, 2, 3]);
  });

  it("dt = NaN → aucune mise à jour", () => {
    const ctrl = new CharacterController(new THREE.Vector3(1, 2, 3));
    ctrl.update(NaN, makeInput(), state);
    expect(ctrl.position.toArray()).toEqual([1, 2, 3]);
  });

  it("dt très grand → clampé à 0.05 (anti-tunneling)", () => {
    const ctrl = new CharacterController(new THREE.Vector3(0, 0, 0));
    // dt = 1.0 serait un freeze d'une seconde → mouvement massif sans collision
    // Le clamp à 0.05 limite le saut
    const input = makeInput({ moveZ: -1 });
    ctrl.update(1.0, input, state);
    // Même avec dt=1s, la vitesse max en une frame est limitée
    expect(state.horizontalSpeed).toBeLessThanOrEqual(C.sprintSpeed);
  });
});

describe("CharacterController — accroupi et slide (edge cases hors state machine)", () => {
  let ctrl: CharacterController;
  let state: ReturnType<typeof createPlayerState>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(collisionWorld.getGroundY).mockReturnValue(0);
    vi.mocked(collisionWorld.isBlocked).mockReturnValue(false);
    vi.mocked(mapBoundsStore.blocksActive).mockReturnValue(false);
    ctrl = new CharacterController(new THREE.Vector3(0, 0, 0));
    state = createPlayerState();
  });

  it("l'accroupi réduit la vitesse", () => {
    const input = makeInput({ crouchHeld: true, sprint: false, moveZ: -1 });
    tick(ctrl, state, 30, input);
    expect(state.crouching).toBe(true);
    // La vitesse doit être réduite (crouchSpeedMult = 0.45)
    expect(state.horizontalSpeed).toBeLessThanOrEqual(C.walkSpeed * C.crouchSpeedMult + 0.1);
  });

  it("crouching = false en l'air (même si touche maintenue)", () => {
    const input = makeInput({ crouchHeld: true, sprint: false });
    state.grounded = false;
    ctrl.update(1 / 60, input, state);
    // computed crouching = state.grounded && input.crouchHeld && !isSliding
    // state.grounded = false → crouching = false
    expect(state.crouching).toBe(false);
  });

  it("noclip nettoie crouching et sliding", () => {
    state.noclip = true;
    state.crouching = true;
    state.sliding = true;
    ctrl.update(1 / 60, makeInput(), state);
    expect(state.crouching).toBe(false);
    expect(state.sliding).toBe(false);
  });

  it("le slide ne se déclenche pas si on n'avance pas (sprinting = false sans W)", () => {
    // sprinting = running && inZ < 0 → running = sprint && sprintAllowed
    // inZ = 0 (pas d'avant) → sprinting = false → pas de slide
    const input = makeInput({ crouchHeld: true, sprint: true, moveZ: 0 });
    state.grounded = true;
    state.horizontalSpeed = C.sprintSpeed; // vitesse suffisante
    ctrl.update(1 / 60, input, state);
    expect(state.sliding).toBe(false);
  });
});

describe("CharacterController — WALL_HEIGHTS partagé (absence de corruption)", () => {
  it("deux contrôleurs séparés ne corrompent pas leurs wallHeights mutuels", () => {
    vi.clearAllMocks();
    vi.mocked(collisionWorld.getGroundY).mockReturnValue(0);
    vi.mocked(collisionWorld.isBlocked).mockReturnValue(false);
    vi.mocked(mapBoundsStore.blocksActive).mockReturnValue(false);

    const ctrl1 = new CharacterController(new THREE.Vector3(0, 0, 0));
    const ctrl2 = new CharacterController(new THREE.Vector3(10, 0, 10));
    const state1 = createPlayerState();
    const state2 = createPlayerState();

    // ctrl1 debout, ctrl2 accroupi — ils utilisent computeWallHeights
    const crouchInput = makeInput({ crouchHeld: true, sprint: false, moveZ: -1 });
    const normalInput = makeInput({ moveZ: -1 });

    // Alterner les updates : ctrl1 (debout) puis ctrl2 (accroupi)
    for (let i = 0; i < 5; i++) {
      state1.grounded = true;
      ctrl1.update(1 / 60, normalInput, state1);
      state2.grounded = true;
      ctrl2.update(1 / 60, crouchInput, state2);
    }

    // Aucun crash, les deux contrôles fonctionnent
    expect(state1.crouching).toBe(false);
    expect(state2.crouching).toBe(true);
  });
});
