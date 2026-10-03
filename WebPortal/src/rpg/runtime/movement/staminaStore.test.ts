import { describe, it, expect, beforeEach } from "vitest";
import { staminaStore, STAMINA } from "./staminaStore";

/** Avance le store par pas fixes — évite qu'un gros dt fausse les seuils. */
function run(seconds: number, running: boolean, step = 1 / 60): void {
  for (let t = 0; t < seconds; t += step) staminaStore.tick(step, running);
}

describe("staminaStore", () => {
  beforeEach(() => staminaStore.reset());

  it("démarre plein et autorise la course", () => {
    expect(staminaStore.ratio).toBe(1);
    expect(staminaStore.canRun()).toBe(true);
  });

  it("se vide en courant", () => {
    run(3, true);
    expect(staminaStore.ratio).toBeLessThan(1);
    expect(staminaStore.ratio).toBeGreaterThan(0);
  });

  it("interdit la course une fois épuisé", () => {
    run(20, true);
    expect(staminaStore.ratio).toBe(0);
    expect(staminaStore.canRun()).toBe(false);
  });

  it("ne rouvre la course qu'au-dessus du seuil de récupération", () => {
    // Sans ce seuil, à 0 le joueur récupérerait une miette et repartirait pour
    // une frame, en boucle — un scintillement course/marche à chaque frame.
    run(20, true);
    expect(staminaStore.canRun()).toBe(false);
    run(STAMINA.regenDelay + 0.5, false); // un peu de régénération, pas assez
    expect(staminaStore.value).toBeGreaterThan(0);
    expect(staminaStore.value).toBeLessThan(STAMINA.exhaustedRecovery);
    expect(staminaStore.canRun()).toBe(false);
    run(4, false);
    expect(staminaStore.canRun()).toBe(true);
  });

  it("attend le délai avant de régénérer", () => {
    run(3, true);
    const after = staminaStore.value;
    run(STAMINA.regenDelay * 0.5, false);
    expect(staminaStore.value).toBeCloseTo(after, 1); // rien récupéré encore
    run(2, false);
    expect(staminaStore.value).toBeGreaterThan(after);
  });

  it("régénère jusqu'au maximum sans le dépasser", () => {
    run(3, true);
    run(30, false);
    expect(staminaStore.value).toBe(STAMINA.max);
  });

  it("consomme un coût fixe au saut", () => {
    const before = staminaStore.value;
    expect(staminaStore.spendJump()).toBe(true);
    expect(staminaStore.value).toBeCloseTo(before - STAMINA.jumpCost, 5);
  });

  it("refuse le saut sans endurance suffisante, sans passer en négatif", () => {
    run(20, true);
    expect(staminaStore.spendJump()).toBe(false);
    expect(staminaStore.value).toBeGreaterThanOrEqual(0);
  });

  it("ne notifie pas à chaque frame — sinon 60 re-renders par seconde", () => {
    let calls = 0;
    const off = staminaStore.subscribe(() => { calls++; });
    run(1, true); // 60 ticks
    off();
    expect(calls).toBeGreaterThan(0);
    expect(calls).toBeLessThan(30); // arrondi au centième → bien moins de 60
  });

  it("reset remet à plein et lève l'épuisement", () => {
    run(20, true);
    staminaStore.reset();
    expect(staminaStore.ratio).toBe(1);
    expect(staminaStore.canRun()).toBe(true);
  });
});
