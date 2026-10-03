import { describe, it, expect } from "vitest";
import { ClimbController, CLIMB, type ClimbProbe, type ClimbInput } from "./ClimbController";

/** Mur plat à `wallDist` devant, s'arrêtant à la hauteur `wallTop`. */
function wallProbe(wallDist: number, wallTop = Infinity): ClimbProbe {
  return {
    castRay: (_ox, oy, _oz, _dx, _dy, _dz, maxDist) =>
      oy <= wallTop && wallDist <= maxDist ? wallDist : null,
  };
}

const NO_WALL: ClimbProbe = { castRay: () => null };

function input(over: Partial<ClimbInput> = {}): ClimbInput {
  return {
    doubleJump: false, intentUp: 0, release: false,
    x: 0, y: 0, z: 0, fwdX: 0, fwdZ: -1, grounded: true,
    ...over,
  };
}

/** Fait tourner la machine assez longtemps pour franchir une phase temporisée. */
function advance(c: ClimbController, seconds: number, inp: ClimbInput, step = 1 / 60) {
  let last = c.update(step, inp);
  for (let t = step; t < seconds; t += step) last = c.update(step, inp);
  return last;
}

describe("ClimbController", () => {
  it("ne s'accroche pas sans double appui, même face à un mur", () => {
    const c = new ClimbController(wallProbe(0.5));
    expect(c.update(0.016, input()).state).toBe("none");
  });

  it("ne s'accroche pas sur double appui sans mur", () => {
    const c = new ClimbController(NO_WALL);
    expect(c.update(0.016, input({ doubleJump: true })).state).toBe("none");
  });

  it("ne s'accroche pas si le mur est hors de portée", () => {
    const c = new ClimbController(wallProbe(CLIMB.reach + 0.5));
    expect(c.update(0.016, input({ doubleJump: true })).state).toBe("none");
  });

  it("s'accroche sur double appui face à un mur à portée", () => {
    const c = new ClimbController(wallProbe(0.5));
    const out = c.update(0.016, input({ doubleJump: true }));
    expect(out.state).toBe("attaching");
    expect(out.overridesMovement).toBe(true);
  });

  it("mémorise la normale du mur, opposée au regard", () => {
    const c = new ClimbController(wallProbe(0.5));
    c.update(0.016, input({ doubleJump: true, fwdX: 0, fwdZ: -1 }));
    expect(c.wallNormal.z).toBeCloseTo(1);
    expect(c.wallNormal.x).toBeCloseTo(0);
  });

  it("passe de attaching à climbing après la durée du raccord", () => {
    const c = new ClimbController(wallProbe(0.5));
    c.update(0.016, input({ doubleJump: true }));
    const out = advance(c, CLIMB.attachDuration + 0.1, input());
    expect(out.state).toBe("climbing");
  });

  it("monte quand le joueur pousse vers l'avant", () => {
    const c = new ClimbController(wallProbe(0.5));
    c.update(0.016, input({ doubleJump: true }));
    advance(c, CLIMB.attachDuration + 0.1, input());
    const out = c.update(0.1, input({ intentUp: 1 }));
    expect(out.state).toBe("climbing");
    expect(out.deltaY).toBeCloseTo(CLIMB.climbSpeed * 0.1, 5);
  });

  it("lâche la paroi sur demande de relâchement", () => {
    const c = new ClimbController(wallProbe(0.5));
    c.update(0.016, input({ doubleJump: true }));
    advance(c, CLIMB.attachDuration + 0.1, input());
    const out = c.update(0.016, input({ release: true }));
    expect(out.state).toBe("none");
    expect(out.overridesMovement).toBe(false);
  });

  it("lâche si le mur disparaît latéralement", () => {
    // Cas réel : le joueur glisse sur le côté et sort de la paroi. Rester
    // agrippé le laisserait suspendu dans le vide.
    const probe = wallProbe(0.5);
    const c = new ClimbController(probe);
    c.update(0.016, input({ doubleJump: true }));
    advance(c, CLIMB.attachDuration + 0.1, input());
    // Le mur s'évanouit
    (c as unknown as { probe: ClimbProbe }).probe = NO_WALL;
    expect(c.update(0.016, input({ intentUp: 1 })).state).toBe("none");
  });

  it("se hisse quand le mur s'arrête au-dessus de la tête", () => {
    // Mur présent à hauteur de prise (1.2) mais absent au-dessus (2.4).
    const probe: ClimbProbe = {
      castRay: (_ox, oy) => (oy < CLIMB.topProbeHeight ? 0.5 : null),
    };
    const c = new ClimbController(probe);
    c.update(0.016, input({ doubleJump: true }));
    advance(c, CLIMB.attachDuration + 0.1, input());
    expect(c.update(0.016, input({ intentUp: 1 })).state).toBe("topping");
  });

  it("ne se hisse PAS sans intention de monter", () => {
    const probe: ClimbProbe = {
      castRay: (_ox, oy) => (oy < CLIMB.topProbeHeight ? 0.5 : null),
    };
    const c = new ClimbController(probe);
    c.update(0.016, input({ doubleJump: true }));
    advance(c, CLIMB.attachDuration + 0.1, input());
    expect(c.update(0.016, input({ intentUp: 0 })).state).toBe("climbing");
  });

  it("revient à none après le hissage", () => {
    const probe: ClimbProbe = {
      castRay: (_ox, oy) => (oy < CLIMB.topProbeHeight ? 0.5 : null),
    };
    const c = new ClimbController(probe);
    c.update(0.016, input({ doubleJump: true }));
    advance(c, CLIMB.attachDuration + 0.1, input());
    c.update(0.016, input({ intentUp: 1 }));
    const out = advance(c, CLIMB.topDuration + 0.1, input({ intentUp: 1 }));
    expect(out.state).toBe("none");
    expect(out.overridesMovement).toBe(false);
  });

  it("relâche en atteignant le sol en descendant", () => {
    const c = new ClimbController(wallProbe(0.5));
    c.update(0.016, input({ doubleJump: true }));
    advance(c, CLIMB.attachDuration + 0.1, input());
    const out = c.update(0.016, input({ intentUp: -1, grounded: true }));
    expect(out.state).toBe("none");
  });

  it("plafonne la hauteur escaladée — pas d'ascension infinie", () => {
    const c = new ClimbController(wallProbe(0.5));
    c.update(0.016, input({ doubleJump: true }));
    advance(c, CLIMB.attachDuration + 0.1, input());
    // Monte bien au-delà du plafond
    const out = advance(c, (CLIMB.maxHeight / CLIMB.climbSpeed) + 1, input({ intentUp: 1 }));
    expect(out.state).toBe("climbing");
    expect(out.deltaY).toBe(0);
  });

  it("reset ramène à l'état initial", () => {
    const c = new ClimbController(wallProbe(0.5));
    c.update(0.016, input({ doubleJump: true }));
    c.reset();
    expect(c.current).toBe("none");
  });
});
