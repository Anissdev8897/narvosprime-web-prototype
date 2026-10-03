import { describe, it, expect } from "vitest";
import { generateMap, validateGeneration, biomeOf, type MapGenConfig } from "./mapGenerator";

const CFG: MapGenConfig = {
  seed: 42,
  bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 },
  hub: { x: 0, z: 0 },
  safeRadius: 20,
  spawnY: 80,
  monsterPoints: 30,
  maxPack: 4,
  resources: 20,
  pois: 5,
  levelRange: [3, 25],
  enemyFolders: ["bandit", "golem_glace", "zombi"],
};

describe("mapGenerator", () => {
  it("déterministe : même seed = même monde", () => {
    expect(generateMap(CFG)).toEqual(generateMap(CFG));
  });

  it("seed différente = monde différent", () => {
    const a = generateMap(CFG);
    const b = generateMap({ ...CFG, seed: 43 });
    expect(JSON.stringify(a.monsters)).not.toBe(JSON.stringify(b.monsters));
  });

  it("respecte zone sûre + bornes + niveaux croissants avec la distance", () => {
    const r = generateMap(CFG);
    expect(r.monsters.length).toBeGreaterThan(10);
    for (const m of r.monsters) {
      const d = Math.hypot(m.x, m.z);
      expect(d).toBeGreaterThanOrEqual(CFG.safeRadius);
      expect(m.level).toBeGreaterThanOrEqual(3);
      expect(m.level).toBeLessThanOrEqual(25);
      expect(CFG.enemyFolders).toContain(m.folder);
    }
    // Le biome profond (2) doit porter des niveaux plus hauts que la lisière (0).
    const lvl = (b: number) => r.monsters.filter((m) => m.biome === b).map((m) => m.level);
    const near = lvl(0), far = lvl(2);
    if (near.length && far.length) {
      expect(Math.max(...far)).toBeGreaterThan(Math.min(...near));
    }
  });

  it("la validation passe sur une génération propre", () => {
    const v = validateGeneration(generateMap(CFG), CFG);
    expect(v.errors).toEqual([]);
    expect(v.ok).toBe(true);
  });

  it("la validation détecte un monstre hors bornes / en zone sûre", () => {
    const r = generateMap(CFG);
    r.monsters.push({ x: 999, z: 0, folder: "bandit", level: 5, packSize: 1, respawnSec: 45, biome: 2 });
    r.monsters.push({ x: 1, z: 1, folder: "bandit", level: 5, packSize: 1, respawnSec: 45, biome: 0 });
    const v = validateGeneration(r, CFG);
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.includes("hors bornes"))).toBe(true);
    expect(v.errors.some((e) => e.includes("zone sûre"))).toBe(true);
  });

  it("biomeOf : 3 anneaux selon la distance au hub", () => {
    expect(biomeOf({ x: 25, z: 0 }, CFG)).toBe(0);
    expect(biomeOf({ x: 95, z: 95 }, CFG)).toBe(2);
  });
});
