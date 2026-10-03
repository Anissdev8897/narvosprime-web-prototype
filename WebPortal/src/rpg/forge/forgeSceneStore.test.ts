import { describe, it, expect } from "vitest";
import { EditHistory, snap, newWater, type SceneSnapshot } from "./forgeSceneStore";

const snapOf = (n: number): SceneSnapshot => ({
  objects: [{ id: `o${n}`, model: "m.glb", pos: [n, 0, 0], rot: [0, 0, 0], scale: [1, 1, 1] }],
  waters: [],
});

describe("EditHistory (undo/redo)", () => {
  it("undo restaure l'état précédent, redo le ré-applique", () => {
    const h = new EditHistory();
    h.push(snapOf(1));            // état 1 empilé avant mutation → état courant = 2
    const undone = h.undo(snapOf(2));
    expect(undone?.objects[0].pos[0]).toBe(1);
    const redone = h.redo(snapOf(1));
    expect(redone?.objects[0].pos[0]).toBe(2);
  });

  it("nouvelle mutation après undo → la branche futur est vidée", () => {
    const h = new EditHistory();
    h.push(snapOf(1));
    h.undo(snapOf(2));            // futur = [2]
    h.push(snapOf(1));            // nouvelle branche
    expect(h.canRedo).toBe(false);
  });

  it("undo sur historique vide → null", () => {
    expect(new EditHistory().undo(snapOf(0))).toBeNull();
  });
});

describe("snap (aimantation grille)", () => {
  it("arrondit au pas", () => {
    expect(snap(3.4, 1)).toBe(3);
    expect(snap(3.6, 0.5)).toBe(3.5);
  });
  it("pas 0 = désactivé", () => {
    expect(snap(3.456, 0)).toBe(3.456);
  });
});

describe("newWater", () => {
  it("tailles par défaut cohérentes (rivière étroite, océan vaste)", () => {
    expect(newWater("riviere").size[1]).toBeGreaterThan(newWater("riviere").size[0]);
    expect(newWater("ocean").size[0]).toBeGreaterThan(newWater("lac").size[0]);
  });
});
