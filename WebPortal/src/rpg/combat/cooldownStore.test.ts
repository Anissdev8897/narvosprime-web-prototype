import { describe, it, expect, beforeEach } from "vitest";
import { cooldownStore, ULTIMATE_BASE_CD } from "./cooldownStore";

describe("cooldownStore", () => {
  beforeEach(() => cooldownStore.reset());

  it("prêt par défaut, occupé après trigger", () => {
    expect(cooldownStore.isReady("ult")).toBe(true);
    cooldownStore.trigger("ult"); // 60s par défaut
    expect(cooldownStore.isReady("ult")).toBe(false);
    expect(cooldownStore.remaining("ult")).toBeCloseTo(ULTIMATE_BASE_CD);
  });

  it("la réduction d'équipement raccourcit le CD (plafonnée à 80%)", () => {
    cooldownStore.trigger("a", 60, 0.5);
    expect(cooldownStore.remaining("a")).toBeCloseTo(30);
    cooldownStore.trigger("b", 60, 0.95); // plafonné à 0.8
    expect(cooldownStore.remaining("b")).toBeCloseTo(12);
  });

  it("tick décrémente puis libère", () => {
    cooldownStore.trigger("ult", 2);
    cooldownStore.tick(1);
    expect(cooldownStore.remaining("ult")).toBeCloseTo(1);
    expect(cooldownStore.isReady("ult")).toBe(false);
    cooldownStore.tick(1.1);
    expect(cooldownStore.isReady("ult")).toBe(true);
  });

  it("fraction 0..1 pour le HUD radial", () => {
    cooldownStore.trigger("ult", 10);
    cooldownStore.tick(5);
    expect(cooldownStore.fraction("ult", 10)).toBeCloseTo(0.5);
  });
});
