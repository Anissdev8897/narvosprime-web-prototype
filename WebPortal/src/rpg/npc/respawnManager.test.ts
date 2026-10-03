import { describe, it, expect, beforeEach } from "vitest";
import { respawnManager } from "./respawnManager";

const FAR = { x: 1000, z: 1000 };
const ON_POINT = { x: 0, z: 0 };

describe("respawnManager", () => {
  beforeEach(() => respawnManager.reset());

  it("mort → pas de respawn avant le délai → respawn après (epoch +1)", () => {
    respawnManager.configure("p1", 45, [0, 0, 0]);
    respawnManager.notifyDeath("p1", "p1#0", 0);
    expect(respawnManager.isDead("p1", "p1#0")).toBe(true);
    respawnManager.tick(44_000, FAR);
    expect(respawnManager.isDead("p1", "p1#0")).toBe(true);   // trop tôt
    respawnManager.tick(45_500, FAR);
    expect(respawnManager.isDead("p1", "p1#0")).toBe(false);  // réapparu
    expect(respawnManager.epochOf("p1", "p1#0")).toBe(1);
  });

  it("respawnSec 0 → ne réapparaît JAMAIS (boss scriptés)", () => {
    respawnManager.configure("boss", 0, [0, 0, 0]);
    respawnManager.notifyDeath("boss", "boss#0", 0);
    // notifyDeath no-op (respawn désactivé) → jamais marqué mort en attente
    expect(respawnManager.isDead("boss", "boss#0")).toBe(false);
    respawnManager.tick(999_000, FAR);
    expect(respawnManager.epochOf("boss", "boss#0")).toBe(0);
  });

  it("anti-camping : le joueur sur le point retarde la réapparition", () => {
    respawnManager.configure("p2", 10, [0, 0, 0]);
    respawnManager.notifyDeath("p2", "p2#0", 0);
    respawnManager.tick(11_000, ON_POINT);                    // joueur < 8 m → attend
    expect(respawnManager.isDead("p2", "p2#0")).toBe(true);
    respawnManager.tick(12_000, FAR);                         // joueur parti → respawn
    expect(respawnManager.isDead("p2", "p2#0")).toBe(false);
  });

  it("copies d'une meute indépendantes (epoch par copie)", () => {
    respawnManager.configure("p3", 10, [50, 0, 50]);
    respawnManager.notifyDeath("p3", "p3#0", 0);
    respawnManager.notifyDeath("p3", "p3#1", 5_000);
    respawnManager.tick(10_500, FAR);                         // seule #0 échue
    expect(respawnManager.epochOf("p3", "p3#0")).toBe(1);
    expect(respawnManager.isDead("p3", "p3#1")).toBe(true);
    respawnManager.tick(15_500, FAR);
    expect(respawnManager.epochOf("p3", "p3#1")).toBe(1);
  });
});
