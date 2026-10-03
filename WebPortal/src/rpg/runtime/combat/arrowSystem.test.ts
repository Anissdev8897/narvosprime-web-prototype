import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { ArrowPool } from "./arrowSystem";

const FROM = new THREE.Vector3(0, 1.4, 0);
const DIR = new THREE.Vector3(0, 0, 1);

describe("ArrowPool free-list", () => {
  it("spawn réutilise les slots libérés (pas de croissance illimitée)", () => {
    const p = new ArrowPool();
    p.spawn(FROM, DIR, 10);
    p.spawn(FROM, DIR, 10);
    expect(p.size()).toBe(2);
    expect(p.activeCount()).toBe(2);
    p.clear();                  // libère tout → free-list repeuplée
    expect(p.activeCount()).toBe(0);
    p.spawn(FROM, DIR, 10);     // réutilise un slot existant
    expect(p.size()).toBe(2);   // PAS 3 → pas de nouvelle alloc
    expect(p.activeCount()).toBe(1);
  });

  it("forEachActive ne visite que les flèches actives, sans allouer", () => {
    const p = new ArrowPool();
    p.spawn(FROM, DIR, 10);
    p.spawn(FROM, DIR, 10);
    p.clear();
    p.spawn(FROM, DIR, 10);
    let n = 0;
    p.forEachActive(() => n++);
    expect(n).toBe(1);
  });
});
