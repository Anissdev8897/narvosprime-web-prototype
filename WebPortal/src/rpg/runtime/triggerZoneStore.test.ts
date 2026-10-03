// ══════════════════════════════════════════════════════════════════════════════
// runtime/triggerZoneStore.test.ts — Tests du store de zones trigger
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from "vitest";
import { triggerZoneStore } from "./triggerZoneStore";

function zone(p: Partial<Omit<Parameters<typeof triggerZoneStore.add>[1], "id">> = {}) {
  return {
    kind: "encounter" as const,
    center: [0, 0, 0] as [number, number, number],
    radius: 10,
    label: "test",
    enabled: true,
    ...p,
  };
}

beforeEach(() => triggerZoneStore.__resetForTest());

describe("triggerZoneStore — CRUD", () => {
  it("retourne un tableau vide pour une map inconnue", () => {
    expect(triggerZoneStore.list("inexistante")).toEqual([]);
  });

  it("ajoute et liste une zone", () => {
    const id = triggerZoneStore.add("donjon_furiste", zone());
    expect(triggerZoneStore.list("donjon_furiste")).toHaveLength(1);
    expect(triggerZoneStore.list("donjon_furiste")[0].id).toBe(id);
  });

  it("modifie une zone", () => {
    const id = triggerZoneStore.add("donjon_furiste", zone({ label: "original" }));
    triggerZoneStore.update("donjon_furiste", id, { label: "modifié" });
    expect(triggerZoneStore.list("donjon_furiste")[0].label).toBe("modifié");
  });

  it("supprime une zone", () => {
    const id = triggerZoneStore.add("donjon_furiste", zone());
    triggerZoneStore.remove("donjon_furiste", id);
    expect(triggerZoneStore.list("donjon_furiste")).toHaveLength(0);
  });
});

describe("triggerZoneStore — at() spatial query", () => {
  it("trouve une zone qui contient un point", () => {
    triggerZoneStore.add("orbital", {
      kind: "encounter", center: [1000, 0, 0], radius: 20, label: "anneau", enabled: true,
    });
    const hits = triggerZoneStore.at("orbital", 1005, 5);
    expect(hits).toHaveLength(1);
    expect(hits[0].label).toBe("anneau");
  });

  it("ne trouve pas si le point est hors rayon", () => {
    triggerZoneStore.add("orbital", {
      kind: "encounter", center: [1000, 0, 0], radius: 10, label: "centre", enabled: true,
    });
    expect(triggerZoneStore.at("orbital", 1100, 0)).toHaveLength(0);
  });

  it("trouve plusieurs zones qui se chevauchent", () => {
    triggerZoneStore.add("orbital", {
      kind: "encounter", center: [0, 0, 0], radius: 15, label: "A", enabled: true,
    });
    triggerZoneStore.add("orbital", {
      kind: "encounter", center: [5, 0, 5], radius: 10, label: "B", enabled: true,
    });
    expect(triggerZoneStore.at("orbital", 3, 3)).toHaveLength(2);
  });

  it("ne trouve que les zones de la bonne map", () => {
    triggerZoneStore.add("forge", zone({ center: [0, 0, 0], radius: 10 }));
    expect(triggerZoneStore.at("orbital", 0, 0)).toHaveLength(0);
  });
});

describe("triggerZoneStore — seed et générés", () => {
  it("seed remplace toutes les zones", () => {
    triggerZoneStore.add("donjon_furiste", zone({ label: "ancien" }));
    triggerZoneStore.seed("donjon_furiste", [
      { kind: "entry", center: [0, 0, 10], radius: 5, label: "nouveau", enabled: true },
    ]);
    expect(triggerZoneStore.list("donjon_furiste")).toHaveLength(1);
    expect(triggerZoneStore.list("donjon_furiste")[0].label).toBe("nouveau");
  });

  it("removeGenerated ne supprime que les gen=true", () => {
    triggerZoneStore.add("donjon_furiste", zone({ label: "manuel" }));
    triggerZoneStore.add("donjon_furiste", zone({ label: "auto", gen: true }));
    expect(triggerZoneStore.removeGenerated("donjon_furiste")).toBe(1);
    expect(triggerZoneStore.list("donjon_furiste")).toHaveLength(1);
  });
});

describe("triggerZoneStore — clear", () => {
  it("efface toutes les zones d'une map", () => {
    triggerZoneStore.add("donjon_furiste", zone());
    triggerZoneStore.add("donjon_furiste", zone());
    triggerZoneStore.clear("donjon_furiste");
    expect(triggerZoneStore.list("donjon_furiste")).toHaveLength(0);
  });
});
