import { describe, it, expect } from "vitest";
import { cellKey, chunkObjects, activeCells } from "./chunkStream";

describe("cellKey", () => {
  it("range origine → cellule 0,0", () => {
    expect(cellKey(0, 0, 40)).toBe("0,0");
    expect(cellKey(39.9, 39.9, 40)).toBe("0,0");
  });
  it("franchit la frontière → cellule suivante", () => {
    expect(cellKey(40, 0, 40)).toBe("1,0");
    expect(cellKey(0, 40, 40)).toBe("0,1");
  });
  it("coordonnées négatives → floor (pas troncature)", () => {
    expect(cellKey(-1, -1, 40)).toBe("-1,-1");
    expect(cellKey(-40, -40, 40)).toBe("-1,-1");
    expect(cellKey(-41, 0, 40)).toBe("-2,0");
  });
});

describe("chunkObjects", () => {
  const obj = (x: number, z: number, id: string) => ({ id, pos: [x, 0, z] as [number, number, number] });

  it("regroupe par cellule selon XZ (Y ignoré)", () => {
    const m = chunkObjects([obj(5, 5, "a"), obj(10, 10, "b"), obj(50, 5, "c")], 40);
    expect(m.get("0,0")!.map((o) => o.id)).toEqual(["a", "b"]);
    expect(m.get("1,0")!.map((o) => o.id)).toEqual(["c"]);
  });
  it("liste vide → map vide", () => {
    expect(chunkObjects([], 40).size).toBe(0);
  });
  it("conserve TOUS les objets (aucune perte)", () => {
    const objs = Array.from({ length: 100 }, (_, i) => obj(i * 7, i * 3, `o${i}`));
    const total = [...chunkObjects(objs, 40).values()].reduce((n, a) => n + a.length, 0);
    expect(total).toBe(100);
  });
});

describe("activeCells", () => {
  it("joueur à l'origine, petit rayon → inclut sa cellule", () => {
    const cells = activeCells(20, 20, 40, 30);
    expect(cells.has("0,0")).toBe(true);
  });
  it("exclut les cellules hors rayon", () => {
    const cells = activeCells(20, 20, 40, 30);
    expect(cells.has("10,10")).toBe(false);
  });
  it("grand rayon → couvre plus de cellules", () => {
    const small = activeCells(0, 0, 40, 20).size;
    const big = activeCells(0, 0, 40, 120).size;
    expect(big).toBeGreaterThan(small);
  });
  it("cellule voisine partiellement dans le rayon reste chargée (marge diagonale)", () => {
    // joueur au bord droit de 0,0 (x=39) avec rayon 10 → cellule 1,0 (centre x=60) à portée via marge.
    const cells = activeCells(39, 20, 40, 10);
    expect(cells.has("1,0")).toBe(true);
  });
});
