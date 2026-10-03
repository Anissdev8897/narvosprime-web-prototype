import { describe, it, expect } from "vitest";
import {
  movementAngle, angleDelta, blendWeightsForAngle,
  quantizeDirection, solveLocomotion, DIR_ANGLES,
} from "./locomotionBlend";

/** Convention du projet : moveZ = -1 pour W (avant), +1 pour S (arrière). */
const FWD = { x: 0, z: -1 };
const BACK = { x: 0, z: 1 };
const RIGHT = { x: 1, z: 0 };
const LEFT = { x: -1, z: 0 };

describe("movementAngle", () => {
  it("place l'avant à 0° et la droite à +90°", () => {
    expect(movementAngle(FWD.x, FWD.z)).toBeCloseTo(0);
    expect(movementAngle(RIGHT.x, RIGHT.z)).toBeCloseTo(90);
    expect(movementAngle(LEFT.x, LEFT.z)).toBeCloseTo(-90);
    expect(Math.abs(movementAngle(BACK.x, BACK.z))).toBeCloseTo(180);
  });

  it("place les diagonales à ±45° et ±135°", () => {
    expect(movementAngle(1, -1)).toBeCloseTo(45);   // avant-droite
    expect(movementAngle(-1, -1)).toBeCloseTo(-45); // avant-gauche
    expect(movementAngle(1, 1)).toBeCloseTo(135);   // arrière-droite
  });
});

describe("angleDelta", () => {
  it("prend toujours le chemin le plus court", () => {
    expect(angleDelta(170, -170)).toBeCloseTo(-20);
    expect(angleDelta(-170, 170)).toBeCloseTo(20);
    expect(angleDelta(10, 350)).toBeCloseTo(20);
  });
});

describe("blendWeightsForAngle", () => {
  it("ne mélange JAMAIS plus de deux clips", () => {
    // Mélanger les 8 ferait s'annuler les directions opposées : le personnage
    // marcherait sur place.
    for (let a = -180; a <= 180; a += 7) {
      expect(blendWeightsForAngle(a).length).toBeLessThanOrEqual(2);
    }
  });

  it("somme des poids toujours égale à 1", () => {
    for (let a = -180; a <= 180; a += 3) {
      const total = blendWeightsForAngle(a).reduce((s, w) => s + w.weight, 0);
      expect(total).toBeCloseTo(1, 6);
    }
  });

  it("donne un poids unique sur une cardinale exacte", () => {
    for (const [dir, angle] of Object.entries(DIR_ANGLES)) {
      const w = blendWeightsForAngle(angle);
      expect(w).toHaveLength(1);
      expect(w[0].dir).toBe(dir);
    }
  });

  it("répartit à parts égales au milieu de deux cardinales", () => {
    const w = blendWeightsForAngle(22.5); // entre forward (0) et forwardRight (45)
    expect(w).toHaveLength(2);
    expect(w[0].weight).toBeCloseTo(0.5, 3);
    expect(w[1].weight).toBeCloseTo(0.5, 3);
    expect(w.map((x) => x.dir).sort()).toEqual(["forward", "forwardRight"]);
  });

  it("n'émet aucun poids nul ou négatif", () => {
    for (let a = -180; a <= 180; a += 1) {
      for (const w of blendWeightsForAngle(a)) expect(w.weight).toBeGreaterThan(0);
    }
  });
});

describe("quantizeDirection", () => {
  it("retourne la cardinale la plus proche sans état antérieur", () => {
    expect(quantizeDirection(0, null)).toBe("forward");
    expect(quantizeDirection(88, null)).toBe("right");
    expect(quantizeDirection(-44, null)).toBe("forwardLeft");
  });

  it("garde la direction courante dans la marge d'hystérésis", () => {
    // 24° est plus proche de forwardRight (45) que de forward (0) — mais avec
    // 12° d'hystérésis, rester sur forward doit l'emporter.
    expect(quantizeDirection(24, "forward")).toBe("forward");
    expect(quantizeDirection(24, null)).toBe("forwardRight");
  });

  it("finit par basculer quand l'écart dépasse la marge", () => {
    expect(quantizeDirection(40, "forward")).toBe("forwardRight");
  });

  it("gère la discontinuité à ±180° sans osciller", () => {
    expect(quantizeDirection(179, "back")).toBe("back");
    expect(quantizeDirection(-179, "back")).toBe("back");
  });
});

describe("solveLocomotion", () => {
  const base = { walkSpeed: 3.2, runSpeed: 6.0 };

  it("renvoie idle sans intention, même si la vitesse résiduelle est élevée", () => {
    // Cas réel : le joueur relâche les touches, la décélération laisse de la
    // vitesse pendant quelques frames. Sans le test d'intention, le personnage
    // continuerait de « marcher » en glissant.
    const r = solveLocomotion({ localX: 0, localZ: 0, speed: 4, ...base });
    expect(r.gait).toBe("idle");
    expect(r.weights).toHaveLength(0);
  });

  it("renvoie idle sous le seuil de vitesse", () => {
    expect(solveLocomotion({ localX: 0, localZ: -1, speed: 0.1, ...base }).gait).toBe("idle");
  });

  it("choisit walk à vitesse de marche et run à vitesse de course", () => {
    expect(solveLocomotion({ localX: 0, localZ: -1, speed: 3.2, ...base }).gait).toBe("walk");
    expect(solveLocomotion({ localX: 0, localZ: -1, speed: 6.0, ...base }).gait).toBe("run");
  });

  it("suit la VITESSE et non la touche — la transition est progressive", () => {
    // Le contrôleur lisse la vitesse ; l'allure doit suivre cette décroissance
    // au lieu de sauter dès que Maj est relâché.
    const mid = solveLocomotion({ localX: 0, localZ: -1, speed: 4.6, ...base });
    expect(mid.runBlend).toBeGreaterThan(0);
    expect(mid.runBlend).toBeLessThan(1);
  });

  it("borne la vitesse de lecture pour éviter les animations grotesques", () => {
    const slow = solveLocomotion({ localX: 0, localZ: -1, speed: 0.4, ...base });
    const fast = solveLocomotion({ localX: 0, localZ: -1, speed: 30, ...base });
    expect(slow.timeScale).toBeGreaterThanOrEqual(0.6);
    expect(fast.timeScale).toBeLessThanOrEqual(1.8);
  });

  it("mélange bien deux clips en diagonale", () => {
    const r = solveLocomotion({ localX: 0.707, localZ: -0.707, speed: 3.2, ...base });
    expect(r.weights).toHaveLength(1); // 45° pile = forwardRight seul
    expect(r.weights[0].dir).toBe("forwardRight");
  });

  it("distingue marche avant et marche arrière — le point du blend directionnel", () => {
    const fwd = solveLocomotion({ localX: 0, localZ: -1, speed: 3.2, ...base });
    const bwd = solveLocomotion({ localX: 0, localZ: 1, speed: 3.2, ...base });
    expect(fwd.weights[0].dir).toBe("forward");
    expect(bwd.weights[0].dir).toBe("back");
  });
});
