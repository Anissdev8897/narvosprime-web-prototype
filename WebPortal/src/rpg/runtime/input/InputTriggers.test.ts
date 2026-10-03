import { describe, it, expect } from "vitest";
import {
  createTriggerState,
  updateTriggerState,
  evaluateTrigger,
} from "./InputTriggers";
import { ETriggerType, type TriggerConfig } from "./types";

/** Helper : simule une séquence press→release et évalue le trigger juste après. */
function pressAndEval(
  trigger: TriggerConfig,
  pressDuration: number,
): { triggered: boolean; value: unknown; elapsed: number; intensity: number } {
  const s = createTriggerState();
  const base = 1000;

  // Press
  updateTriggerState(s, base, true);
  // Release après pressDuration
  updateTriggerState(s, base + pressDuration, false);

  // Évaluer IMMÉDIATEMENT après relâchement (s.wasPressed est encore true)
  return evaluateTrigger(s, trigger, base + pressDuration, true);
}

describe("InputTriggers", () => {
  describe("Pressed", () => {
    it("se déclenche au front montant", () => {
      const s = createTriggerState();
      updateTriggerState(s, 1000, false);

      // Front montant
      updateTriggerState(s, 1001, true);
      const r1 = evaluateTrigger(s, { type: ETriggerType.Pressed }, 1001, true);
      expect(r1.triggered).toBe(true);
      expect(r1.value).toBe(true);
      expect(r1.intensity).toBe(1);

      // Toujours pressé → plus de déclenchement
      updateTriggerState(s, 1002, true);
      const r2 = evaluateTrigger(s, { type: ETriggerType.Pressed }, 1002, true);
      expect(r2.triggered).toBe(false);

      // Relâchement
      updateTriggerState(s, 1003, false);
      const r3 = evaluateTrigger(s, { type: ETriggerType.Pressed }, 1003, false);
      expect(r3.triggered).toBe(false);
    });

    it("retourne false si jamais pressé", () => {
      const s = createTriggerState();
      const r = evaluateTrigger(s, { type: ETriggerType.Pressed }, 1000, false);
      expect(r.triggered).toBe(false);
    });
  });

  describe("Released", () => {
    it("se déclenche au relâchement", () => {
      const s = createTriggerState();
      updateTriggerState(s, 1000, true);
      updateTriggerState(s, 1100, true);
      // Relâchement
      updateTriggerState(s, 1101, false);
      const r = evaluateTrigger(s, { type: ETriggerType.Released }, 1101, true);
      expect(r.triggered).toBe(true);
    });

    it("ne se déclenche pas si jamais pressé", () => {
      const s = createTriggerState();
      updateTriggerState(s, 1000, false);
      const r = evaluateTrigger(s, { type: ETriggerType.Released }, 1000, false);
      expect(r.triggered).toBe(false);
    });
  });

  describe("Hold", () => {
    it("se déclenche après le temps de maintien", () => {
      const s = createTriggerState();
      updateTriggerState(s, 1000, true);

      // Avant le hold
      const r1 = evaluateTrigger(s, { type: ETriggerType.Hold, holdTimeMs: 500 }, 1100, true);
      expect(r1.triggered).toBe(false);
      expect(r1.intensity).toBeCloseTo(100 / 500, 3); // 0.2

      // Au moment du hold
      const r2 = evaluateTrigger(s, { type: ETriggerType.Hold, holdTimeMs: 500 }, 1500, true);
      expect(r2.triggered).toBe(true);
      expect(r2.intensity).toBe(1);

      // Toujours maintenu
      const r3 = evaluateTrigger(s, { type: ETriggerType.Hold, holdTimeMs: 500 }, 1600, true);
      expect(r3.triggered).toBe(true);
    });

    it("ne se déclenche pas si relâché avant", () => {
      const s = createTriggerState();
      updateTriggerState(s, 1000, true);
      updateTriggerState(s, 1200, false); // relâché après 200ms

      const r = evaluateTrigger(s, { type: ETriggerType.Hold, holdTimeMs: 500 }, 1200, false);
      expect(r.triggered).toBe(false);
    });

    it("utilise holdTimeMs par défaut 500", () => {
      const s = createTriggerState();
      updateTriggerState(s, 1000, true);
      // 400 ms < 500 par défaut
      const r = evaluateTrigger(s, { type: ETriggerType.Hold }, 1400, true);
      expect(r.triggered).toBe(false);
    });
  });

  describe("Tap", () => {
    it("se déclenche sur un appui court", () => {
      // Press 50ms → release → dans la fenêtre de 300ms
      const r = pressAndEval({ type: ETriggerType.Tap, tapWindowMs: 300 }, 50);
      expect(r.triggered).toBe(true);
    });

    it("ne se déclenche pas si l'appui est trop long", () => {
      // `pressAndEval` prend 2 arguments. Le 3ᵉ (`1`) ne correspondait à aucun
      // paramètre : 500 ms d'appui contre une fenêtre de 300 ms suffisent à
      // décrire le cas testé.
      const r = pressAndEval({ type: ETriggerType.Tap, tapWindowMs: 300 }, 500);
      expect(r.triggered).toBe(false);
    });

    it("ne se déclenche pas si la touche est encore pressée", () => {
      const s = createTriggerState();
      updateTriggerState(s, 1000, true);
      // Pas de relâchement
      updateTriggerState(s, 1100, true);
      const r = evaluateTrigger(s, { type: ETriggerType.Tap, tapWindowMs: 300 }, 1100, true);
      expect(r.triggered).toBe(false);
    });

    it("utilise tapWindowMs par défaut 300", () => {
      const r = pressAndEval({ type: ETriggerType.Tap }, 50);
      expect(r.triggered).toBe(true);

      const r2 = pressAndEval({ type: ETriggerType.Tap }, 400);
      expect(r2.triggered).toBe(false);
    });
  });

  describe("DoubleTap", () => {
    it("se déclenche sur deux appuis rapides", () => {
      const s = createTriggerState();
      let now = 1000;

      // Premier appui
      updateTriggerState(s, now, true);
      now += 50;
      // Premier relâchement
      updateTriggerState(s, now, false);
      now += 100;

      // Deuxième appui
      updateTriggerState(s, now, true);
      now += 50;
      // Deuxième relâchement
      updateTriggerState(s, now, false);

      // Évaluer après le 2e relâchement
      const r = evaluateTrigger(s, { type: ETriggerType.DoubleTap, tapWindowMs: 300 }, now, true);
      expect(r.triggered).toBe(true);
    });

    it("ne se déclenche pas si les appuis sont trop espacés", () => {
      const s = createTriggerState();
      let now = 1000;

      // Premier appui
      updateTriggerState(s, now, true);
      now += 50;
      updateTriggerState(s, now, false);
      now += 500; // trop long entre les deux appuis

      // Deuxième appui
      updateTriggerState(s, now, true);
      now += 50;
      updateTriggerState(s, now, false);

      const r = evaluateTrigger(s, { type: ETriggerType.DoubleTap, tapWindowMs: 300 }, now, true);
      expect(r.triggered).toBe(false);
    });

    it("ne se déclenche pas avec un seul appui", () => {
      const s = createTriggerState();
      let now = 1000;

      updateTriggerState(s, now, true);
      now += 50;
      updateTriggerState(s, now, false);

      const r = evaluateTrigger(s, { type: ETriggerType.DoubleTap, tapWindowMs: 300 }, now, true);
      expect(r.triggered).toBe(false);
    });
  });

  describe("Pulse", () => {
    it("se déclenche immédiatement au front montant", () => {
      const s = createTriggerState();

      updateTriggerState(s, 1000, false);
      updateTriggerState(s, 1001, true); // front montant

      const r = evaluateTrigger(s, { type: ETriggerType.Pulse, pulseIntervalMs: 200 }, 1001, true);
      expect(r.triggered).toBe(true);
    });

    it("pulse périodiquement tant que maintenu", () => {
      const s = createTriggerState();

      // Press
      updateTriggerState(s, 1000, true);
      const r1 = evaluateTrigger(s, { type: ETriggerType.Pulse, pulseIntervalMs: 200 }, 1000, true);
      expect(r1.triggered).toBe(true);

      // Après 200ms
      updateTriggerState(s, 1200, true);
      const r2 = evaluateTrigger(s, { type: ETriggerType.Pulse, pulseIntervalMs: 200 }, 1200, true);
      expect(r2.triggered).toBe(true);

      // Après 150ms (pas encore)
      updateTriggerState(s, 1350, true);
      const r3 = evaluateTrigger(s, { type: ETriggerType.Pulse, pulseIntervalMs: 200 }, 1350, true);
      expect(r3.triggered).toBe(false);
    });

    it("arrête de pulser au relâchement", () => {
      const s = createTriggerState();

      updateTriggerState(s, 1000, true);
      evaluateTrigger(s, { type: ETriggerType.Pulse, pulseIntervalMs: 200 }, 1000, true);

      updateTriggerState(s, 1001, false);
      const r = evaluateTrigger(s, { type: ETriggerType.Pulse, pulseIntervalMs: 200 }, 1001, false);
      expect(r.triggered).toBe(false);
    });
  });
});
