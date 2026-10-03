import { describe, it, expect, beforeEach } from "vitest";
import * as THREE from "three";
import { npcRegistry, type NpcHandle } from "./npcRegistry";

function handle(id: string, x: number, z: number, role: "enemy" | "ally" = "enemy", alive = true): NpcHandle {
  const p = new THREE.Vector3(x, 0, z);
  return {
    id, role, getPosition: () => p, isAlive: () => alive,
    applyDamage: () => {}, getLoot: () => null, takeLoot: () => null,
  };
}

// Référence brute (l'ancienne implémentation) pour comparer.
function brute(center: THREE.Vector3, radius: number, all: NpcHandle[]): Set<string> {
  const r2 = radius * radius; const out = new Set<string>();
  for (const h of all) {
    if (h.role !== "enemy" || !h.isAlive()) continue;
    if (h.getPosition().distanceToSquared(center) <= r2) out.add(h.id);
  }
  return out;
}

describe("npcRegistry broadphase", () => {
  beforeEach(() => npcRegistry.clear());

  it("queryEnemiesInRadius == scan brut sur un nuage aléatoire", () => {
    const all: NpcHandle[] = [];
    for (let i = 0; i < 200; i++) {
      const h = handle(`n${i}`, (i * 37) % 100 - 50, (i * 53) % 100 - 50, i % 5 === 0 ? "ally" : "enemy", i % 7 !== 0);
      all.push(h); npcRegistry.register(h);
    }
    const center = new THREE.Vector3(3, 0, -4);
    for (const radius of [2, 8, 25, 80]) {
      const got = new Set(npcRegistry.queryEnemiesInRadius(center, radius).map((h) => h.id));
      expect(got).toEqual(brute(center, radius, all));
    }
  });

  it("forEachEnemyInRadius n'alloue pas et visite les mêmes handles", () => {
    const a = handle("a", 0, 0), b = handle("b", 1, 0), c = handle("c", 40, 0);
    [a, b, c].forEach((h) => npcRegistry.register(h));
    const seen: string[] = [];
    npcRegistry.forEachEnemyInRadius(new THREE.Vector3(0, 0, 0), 3, (h) => seen.push(h.id));
    expect(seen.sort()).toEqual(["a", "b"]);
  });

  it("réindexe quand un PNJ bouge (refreshPosition)", () => {
    const a = handle("a", 0, 0);
    npcRegistry.register(a);
    // a bouge loin : son vecteur est muté en place comme en jeu.
    a.getPosition().set(90, 0, 90);
    npcRegistry.refreshPosition("a");
    const near = npcRegistry.queryEnemiesInRadius(new THREE.Vector3(0, 0, 0), 5);
    expect(near.map((h) => h.id)).toEqual([]);
  });
});
