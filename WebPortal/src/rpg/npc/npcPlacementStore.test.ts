import { describe, it, expect } from "vitest";
import { npcPlacementStore } from "./npcPlacementStore";

const base = { folder: "Grunt", pos: [0, 0, 0] as [number, number, number], level: 1, rank: "mob" as const, scaleMult: 1, hpMult: 1, resistMult: 0 };

describe("npcPlacementStore", () => {
  it("add crée des ids uniques ; list filtre par map", () => {
    npcPlacementStore.clear("forge");
    npcPlacementStore.add("forge", { ...base, pos: [1, 0, 2] });
    npcPlacementStore.add("forge", { ...base, pos: [3, 0, 4] });
    const l = npcPlacementStore.list("forge");
    expect(l.length).toBe(2);
    expect(l[0].id).not.toBe(l[1].id);
    expect(npcPlacementStore.list("tower").length).toBe(0);
    npcPlacementStore.clear("forge");
  });
  it("update (toggle boss) puis remove", () => {
    npcPlacementStore.clear("forge");
    npcPlacementStore.add("forge", base);
    const id = npcPlacementStore.list("forge")[0].id;
    npcPlacementStore.update("forge", id, { rank: "boss", hpMult: 4 });
    expect(npcPlacementStore.list("forge")[0].rank).toBe("boss");
    expect(npcPlacementStore.list("forge")[0].hpMult).toBe(4);
    npcPlacementStore.remove("forge", id);
    expect(npcPlacementStore.list("forge").length).toBe(0);
  });
  it("resnapToGround corrige l'altitude et ignore les PNJ sans sol", () => {
    npcPlacementStore.clear("forge");
    npcPlacementStore.add("forge", { ...base, pos: [10, 0, 0] });  // sol à 7 → corrigé
    npcPlacementStore.add("forge", { ...base, pos: [20, 0, 0] });  // pas de sol → intact
    npcPlacementStore.add("forge", { ...base, pos: [30, 5, 0] });  // déjà au sol → ignoré
    const ground = (x: number): number | null => (x === 10 ? 7 : x === 30 ? 5 : null);

    const fixed = npcPlacementStore.resnapToGround("forge", (x) => ground(x));

    expect(fixed).toBe(1);
    const l = npcPlacementStore.list("forge");
    expect(l.find((n) => n.pos[0] === 10)!.pos[1]).toBe(7);
    expect(l.find((n) => n.pos[0] === 20)!.pos[1]).toBe(0);
    expect(l.find((n) => n.pos[0] === 30)!.pos[1]).toBe(5);
    npcPlacementStore.clear("forge");
  });
  it("resnapToGround ne notifie pas quand rien ne change", () => {
    npcPlacementStore.clear("forge");
    npcPlacementStore.add("forge", { ...base, pos: [0, 3, 0] });
    const v0 = npcPlacementStore.getVersion();
    expect(npcPlacementStore.resnapToGround("forge", () => 3)).toBe(0);
    expect(npcPlacementStore.getVersion()).toBe(v0);
    npcPlacementStore.clear("forge");
  });
  it("subscribe + getVersion notifiés sur add", () => {
    npcPlacementStore.clear("tower");
    let calls = 0;
    const unsub = npcPlacementStore.subscribe(() => { calls++; });
    const v0 = npcPlacementStore.getVersion();
    npcPlacementStore.add("tower", base);
    expect(calls).toBe(1);
    expect(npcPlacementStore.getVersion()).toBe(v0 + 1);
    npcPlacementStore.clear("tower"); unsub();
  });
});
