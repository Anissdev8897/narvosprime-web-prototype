// ══════════════════════════════════════════════════════════════════════════════
// runtime/coverStore.test.ts — Tests du store de points de cover
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from "vitest";
import { coverStore } from "./coverStore";

function cover(p: Partial<Omit<Parameters<typeof coverStore.add>[1], "id">> = {}) {
  return {
    pos: [0, 0, 0] as [number, number, number],
    size: [2, 2, 2] as [number, number, number],
    kind: "hard" as const,
    state: "static" as const,
    height: "high" as const,
    label: "test",
    ...p,
  };
}

beforeEach(() => coverStore.__resetForTest());

describe("coverStore — CRUD", () => {
  it("retourne un tableau vide pour une map inconnue", () => {
    expect(coverStore.list("inexistante")).toEqual([]);
  });

  it("ajoute et liste un cover", () => {
    const id = coverStore.add("forge", cover());
    expect(coverStore.list("forge")).toHaveLength(1);
    expect(coverStore.list("forge")[0].id).toBe(id);
  });

  it("modifie un cover existant", () => {
    const id = coverStore.add("forge", cover({ label: "original" }));
    coverStore.update("forge", id, { label: "modifié" });
    expect(coverStore.list("forge")[0].label).toBe("modifié");
  });

  it("supprime un cover", () => {
    const id = coverStore.add("forge", cover());
    coverStore.remove("forge", id);
    expect(coverStore.list("forge")).toHaveLength(0);
  });

  it("update/remove sur id inconnu ne casse rien", () => {
    coverStore.update("forge", "fantome", { label: "x" });
    coverStore.remove("forge", "fantome");
    expect(coverStore.list("forge")).toEqual([]);
  });
});

describe("coverStore — maps indépendantes", () => {
  it("les covers d'une map n'affectent pas une autre", () => {
    coverStore.add("donjon_furiste", cover({ pos: [10, 0, 10] }));
    coverStore.add("orbital", cover({ pos: [20, 0, 20] }));
    expect(coverStore.list("donjon_furiste")).toHaveLength(1);
    expect(coverStore.list("orbital")).toHaveLength(1);
    expect(coverStore.list("forge")).toHaveLength(0);
  });
});

describe("coverStore — seed et générés", () => {
  it("seed remplace tous les covers", () => {
    coverStore.add("donjon_furiste", cover({ label: "ancien" }));
    coverStore.seed("donjon_furiste", [
      { pos: [1, 0, 1], size: [2, 2, 2], kind: "hard", state: "static", height: "high", label: "nouveau" },
    ]);
    expect(coverStore.list("donjon_furiste")).toHaveLength(1);
    expect(coverStore.list("donjon_furiste")[0].label).toBe("nouveau");
  });

  it("removeGenerated ne supprime que les gen=true", () => {
    coverStore.add("donjon_furiste", cover({ label: "manuel" }));
    coverStore.add("donjon_furiste", cover({ label: "auto", gen: true }));
    coverStore.add("donjon_furiste", cover({ label: "auto2", gen: true }));
    expect(coverStore.removeGenerated("donjon_furiste")).toBe(2);
    expect(coverStore.list("donjon_furiste")).toHaveLength(1);
    expect(coverStore.list("donjon_furiste")[0].label).toBe("manuel");
  });
});

describe("coverStore — clear", () => {
  it("efface tous les covers d'une map", () => {
    coverStore.add("donjon_furiste", cover());
    coverStore.add("donjon_furiste", cover());
    coverStore.clear("donjon_furiste");
    expect(coverStore.list("donjon_furiste")).toHaveLength(0);
  });
});
