import { describe, it, expect } from "vitest";
import { createWorld, stepWorld, advanceWorld, SIM_FACTIONS } from "./worldSim";

describe("worldSim", () => {
  it("createWorld : 3 factions à 50, 5 régions contrôlées, prix 1", () => {
    const w = createWorld(42);
    expect(Object.keys(w.factions).sort()).toEqual([...SIM_FACTIONS].sort());
    expect(Object.keys(w.regions)).toHaveLength(5);
    expect(Object.values(w.regions).every((r) => r.price === 1 && r.contest === 0)).toBe(true);
  });

  it("déterministe : même seed+epoch = même tick", () => {
    const a = stepWorld(createWorld(7)).state;
    const b = stepWorld(createWorld(7)).state;
    expect(a).toEqual(b);
  });

  it("seed différent → évolution différente", () => {
    const a = advanceWorld(createWorld(1), 20).state;
    const b = advanceWorld(createWorld(2), 20).state;
    expect(JSON.stringify(a.regions)).not.toBe(JSON.stringify(b.regions));
  });

  it("bornes : puissance 5..100, prix 0.5..1.6, contest 0..1.2 sur 200 ticks", () => {
    const { state } = advanceWorld(createWorld(3), 200);
    for (const f of SIM_FACTIONS) { expect(state.factions[f].power).toBeGreaterThanOrEqual(5); expect(state.factions[f].power).toBeLessThanOrEqual(100); }
    for (const r of Object.values(state.regions)) {
      expect(r.price).toBeGreaterThanOrEqual(0.5); expect(r.price).toBeLessThanOrEqual(1.6);
      expect(r.contest).toBeGreaterThanOrEqual(0); expect(r.contest).toBeLessThanOrEqual(1.2);
      expect(SIM_FACTIONS).toContain(r.controller);
    }
    expect(state.epoch).toBe(200);
  });

  it("événements : des conquêtes/essors surviennent sur le long terme + TTL expire", () => {
    const { newEvents } = advanceWorld(createWorld(9), 300);
    expect(newEvents.length).toBeGreaterThan(0);
    // L'état final ne garde que des événements à TTL>0 (les expirés sont retirés).
    const final = advanceWorld(createWorld(9), 300).state;
    expect(final.events.every((e) => e.ttl > 0)).toBe(true);
  });

  it("advanceWorld(0) = no-op", () => {
    const w = createWorld(5);
    expect(advanceWorld(w, 0).state).toEqual(w);
  });
});
