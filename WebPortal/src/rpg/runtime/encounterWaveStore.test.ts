// ══════════════════════════════════════════════════════════════════════════════
// runtime/encounterWaveStore.test.ts — Tests du store de vagues d'ennemis
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from "vitest";
import { encounterWaveStore } from "./encounterWaveStore";

function wave(p: Partial<Omit<Parameters<typeof encounterWaveStore.add>[1], "id">> = {}) {
  return {
    label: "test",
    delayMs: 1000,
    spawns: [{ folder: "Grunt", count: 1, pos: [0, 0, 0] as [number, number, number] }],
    ...p,
  };
}

beforeEach(() => encounterWaveStore.__resetForTest());

describe("encounterWaveStore — CRUD", () => {
  it("retourne un tableau vide pour une map inconnue", () => {
    expect(encounterWaveStore.list("inexistante")).toEqual([]);
  });

  it("ajoute et liste une vague", () => {
    const id = encounterWaveStore.add("donjon_furiste", wave());
    expect(encounterWaveStore.list("donjon_furiste")).toHaveLength(1);
    expect(encounterWaveStore.list("donjon_furiste")[0].id).toBe(id);
  });

  it("modifie une vague", () => {
    const id = encounterWaveStore.add("donjon_furiste", wave({ label: "original" }));
    encounterWaveStore.update("donjon_furiste", id, { label: "modifié" });
    expect(encounterWaveStore.list("donjon_furiste")[0].label).toBe("modifié");
  });

  it("supprime une vague", () => {
    const id = encounterWaveStore.add("donjon_furiste", wave());
    encounterWaveStore.remove("donjon_furiste", id);
    expect(encounterWaveStore.list("donjon_furiste")).toHaveLength(0);
  });

  it("modifie les spawns d'une vague", () => {
    const id = encounterWaveStore.add("donjon_furiste", wave({
      spawns: [{ folder: "Grunt", count: 1, pos: [0, 0, 0] }],
    }));
    encounterWaveStore.update("donjon_furiste", id, {
      spawns: [{ folder: "lion", count: 2, pos: [10, 0, 10] }],
    });
    expect(encounterWaveStore.list("donjon_furiste")[0].spawns[0].folder).toBe("lion");
    expect(encounterWaveStore.list("donjon_furiste")[0].spawns[0].count).toBe(2);
  });
});

describe("encounterWaveStore — seed", () => {
  it("seed remplace toutes les vagues", () => {
    encounterWaveStore.add("fungaria", wave({ label: "ancien" }));
    encounterWaveStore.seed("fungaria", [
      { label: "nouveau", delayMs: 2000, spawns: [{ folder: "lion", count: 2, pos: [5, 0, 5] }] },
    ]);
    expect(encounterWaveStore.list("fungaria")).toHaveLength(1);
    expect(encounterWaveStore.list("fungaria")[0].label).toBe("nouveau");
    expect(encounterWaveStore.list("fungaria")[0].delayMs).toBe(2000);
  });

  it("seed avec courbes optionnelles", () => {
    encounterWaveStore.seed("orbital", [
      {
        label: "vague curveball",
        delayMs: 500,
        spawns: [{ folder: "Grunt", count: 1, pos: [0, 0, 0] }],
        curveballs: ["smoke", "reinforcement"],
        waitPrevious: true,
      },
    ]);
    const w = encounterWaveStore.list("orbital")[0];
    expect(w.curveballs).toEqual(["smoke", "reinforcement"]);
    expect(w.waitPrevious).toBe(true);
  });
});

describe("encounterWaveStore — maps indépendantes", () => {
  it("les vagues d'une map sont isolées", () => {
    encounterWaveStore.add("donjon_furiste", wave());
    encounterWaveStore.add("orbital", wave());
    expect(encounterWaveStore.list("donjon_furiste")).toHaveLength(1);
    expect(encounterWaveStore.list("orbital")).toHaveLength(1);
    expect(encounterWaveStore.list("fungaria")).toHaveLength(0);
  });
});

describe("encounterWaveStore — clear", () => {
  it("efface toutes les vagues d'une map", () => {
    encounterWaveStore.add("donjon_furiste", wave());
    encounterWaveStore.add("donjon_furiste", wave());
    encounterWaveStore.clear("donjon_furiste");
    expect(encounterWaveStore.list("donjon_furiste")).toHaveLength(0);
  });
});
