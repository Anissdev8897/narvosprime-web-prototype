import { describe, it, expect, beforeEach } from "vitest";
import { ammoStore } from "./ammoStore";

describe("ammoStore", () => {
  beforeEach(() => { ammoStore.setCharacter("test-char"); ammoStore.set({ arrows: 2, cells: 0 }); });

  it("consume décrémente et renvoie true tant qu'il y a du stock", () => {
    expect(ammoStore.consume("arrows")).toBe(true);
    expect(ammoStore.count("arrows")).toBe(1);
  });

  it("consume renvoie false sans décrémenter si réserve insuffisante", () => {
    expect(ammoStore.consume("cells")).toBe(false); // 0 cellule
    expect(ammoStore.count("cells")).toBe(0);
  });

  it("add réapprovisionne", () => {
    ammoStore.add("cells", 30);
    expect(ammoStore.count("cells")).toBe(30);
  });

  it("vide après épuisement → ne peut plus tirer", () => {
    ammoStore.consume("arrows"); // 2→1
    ammoStore.consume("arrows"); // 1→0
    expect(ammoStore.consume("arrows")).toBe(false);
  });
});
