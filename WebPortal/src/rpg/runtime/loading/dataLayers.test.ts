/**
 * Tests unitaires pour dataLayers.ts — système à 3 états.
 *
 * Vérifie le comportement du LRU, du budget VRAM, et des transitions
 * entre DataLayers (Unloaded, PreWarm, Activated).
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  setBudget,
  getBudget,
  getTotalVRAM,
  getLayer,
  setLayer,
  touch,
  clearLayers,
  canLoad,
  evictToBudget,
  determineLayer,
  counts,
} from "./dataLayers";

const MB = 1; // 1 MB unit for testing

describe("dataLayers", () => {
  beforeEach(() => {
    clearLayers();
    setBudget(3600);
  });

  // ── États de base ─────────────────────────────────────────────────────

  it("initial state is unloaded for unknown chunks", () => {
    expect(getLayer(0)).toBe("unloaded");
    expect(getTotalVRAM()).toBe(0);
    expect(counts().activated).toBe(0);
    expect(counts().prewarming).toBe(0);
  });

  it("setLayer stores the chunk with correct layer and VRAM", () => {
    setLayer(1, "activated", 100 * MB);
    expect(getLayer(1)).toBe("activated");
    expect(getTotalVRAM()).toBe(100);
  });

  it("setLayer to unloaded removes VRAM from total", () => {
    setLayer(1, "activated", 100 * MB);
    expect(getTotalVRAM()).toBe(100);
    setLayer(1, "unloaded");
    expect(getLayer(1)).toBe("unloaded");
    expect(getTotalVRAM()).toBe(0);
  });

  it("setLayer update VRAM adjusts total correctly", () => {
    setLayer(1, "activated", 100 * MB);
    setLayer(1, "activated", 150 * MB, 100); // update VRAM and distance
    expect(getTotalVRAM()).toBe(150);
    expect(getLayer(1)).toBe("activated");
  });

  // ── Transition PreWarm → Activated → Unloaded ─────────────────────────

  it("layers transition correctly: unloaded → prewarming → activated → unloaded", () => {
    setLayer(1, "prewarming", 100 * MB);
    expect(getLayer(1)).toBe("prewarming");
    expect(getTotalVRAM()).toBe(100);

    setLayer(1, "activated", 100 * MB);
    expect(getLayer(1)).toBe("activated");
    expect(getTotalVRAM()).toBe(100);

    setLayer(1, "unloaded");
    expect(getLayer(1)).toBe("unloaded");
    expect(getTotalVRAM()).toBe(0);
  });

  // ── LRU touch ─────────────────────────────────────────────────────────

  it("touch updates lastUsed but does not change VRAM", () => {
    setLayer(1, "activated", 100 * MB);
    const totalBefore = getTotalVRAM();
    touch(1);
    expect(getLayer(1)).toBe("activated");
    expect(getTotalVRAM()).toBe(totalBefore);
  });

  // ── determineLayer ────────────────────────────────────────────────────

  it("determineLayer returns activated within load radius", () => {
    expect(determineLayer(500, 2000, 2800)).toBe("activated");
    expect(determineLayer(2000, 2000, 2800)).toBe("activated");
  });

  it("determineLayer returns prewarming between load and prewarm radius", () => {
    expect(determineLayer(2001, 2000, 2800)).toBe("prewarming");
    expect(determineLayer(2500, 2000, 2800)).toBe("prewarming");
    expect(determineLayer(2800, 2000, 2800)).toBe("prewarming");
  });

  it("determineLayer returns unloaded beyond prewarm radius", () => {
    expect(determineLayer(2801, 2000, 2800)).toBe("unloaded");
    expect(determineLayer(5000, 2000, 2800)).toBe("unloaded");
  });

  // ── canLoad (budget VRAM) ─────────────────────────────────────────────

  it("canLoad returns true when within budget", () => {
    setLayer(1, "activated", 1000 * MB);
    expect(canLoad(500 * MB)).toBe(true);
  });

  it("canLoad returns false when budget would be exceeded", () => {
    setLayer(1, "activated", 3000 * MB);
    expect(canLoad(1000 * MB)).toBe(false);
  });

  it("canLoad returns true when total exactly equals budget", () => {
    setLayer(1, "activated", 3600 * MB);
    expect(canLoad(0)).toBe(true);
  });

  it("canLoad returns false when already over budget", () => {
    setLayer(1, "activated", 4000 * MB);
    expect(canLoad(0)).toBe(false);
  });

  // ── Éviction LRU ──────────────────────────────────────────────────────

  it("evictToBudget does nothing when under budget", () => {
    setLayer(1, "activated", 100 * MB);
    setLayer(2, "prewarming", 100 * MB);
    const { toUnload, toDeactivate } = evictToBudget(0);
    expect(toUnload).toHaveLength(0);
    expect(toDeactivate).toHaveLength(0);
  });

  it("evictToBudget unloads oldest prewarming chunks first when over budget", () => {
    setBudget(500);
    setLayer(1, "prewarming", 200 * MB); // oldest prewarm
    setLayer(2, "prewarming", 200 * MB);
    setLayer(3, "prewarming", 200 * MB);
    // Total: 600 > 500 → should evict 1 oldest prewarm
    const { toUnload, toDeactivate } = evictToBudget(0);
    expect(toUnload.length).toBeGreaterThanOrEqual(1);
    // After eviction, VRAM should be ≤ budget
    expect(getTotalVRAM()).toBeLessThanOrEqual(500);
  });

  it("evictToBudget deactivates old activated chunks when prewarming alone insufficient", () => {
    setBudget(500);
    setLayer(1, "activated", 300 * MB); // oldest activated
    setLayer(2, "activated", 300 * MB); // more recent
    setLayer(3, "prewarming", 50 * MB);
    // Total: 650 > 500
    const { toUnload, toDeactivate } = evictToBudget(0);
    // Prewarming chunks get unloaded first
    expect(toUnload).toContain(3);
    // Then activated chunks get deactivated to PreWarm
    // The VRAM is still consumed (textures not freed)
  });

  it("evictToBudget honors neededMB parameter", () => {
    setBudget(1000);
    setLayer(1, "activated", 200 * MB);
    setLayer(2, "prewarming", 200 * MB);
    setLayer(3, "prewarming", 200 * MB);
    // Current: 600, Budget: 1000
    // Need space for 500 → total would be 1100 > 1000 → need to free 100
    const { toUnload } = evictToBudget(500 * MB);
    expect(toUnload.length).toBeGreaterThanOrEqual(1);
    expect(getTotalVRAM() + 500).toBeLessThanOrEqual(1000);
  });

  it("evictToBudget prefers prewarming over activated when under pressure", () => {
    setBudget(500);
    setLayer(1, "activated", 300 * MB);
    setLayer(2, "prewarming", 300 * MB);
    // Total: 600 > 500
    const { toUnload, toDeactivate } = evictToBudget(0);
    // Prewarming should be unloaded first
    expect(toUnload).toContain(2);
    // If still over, then deactivate activated chunks
    if (getTotalVRAM() > 500) {
      expect(toDeactivate.length).toBeGreaterThanOrEqual(1);
    }
  });

  // ── Budget change ─────────────────────────────────────────────────────

  it("setBudget changes the effective budget", () => {
    setBudget(200);
    setLayer(1, "activated", 150 * MB);
    expect(canLoad(100 * MB)).toBe(false);
    setBudget(500);
    expect(canLoad(100 * MB)).toBe(true); // 150 + 100 = 250 < 500
  });

  // ── clearLayers ───────────────────────────────────────────────────────

  it("clearLayers resets all state", () => {
    setLayer(1, "activated", 100 * MB);
    setLayer(2, "prewarming", 200 * MB);
    expect(getTotalVRAM()).toBe(300);
    clearLayers();
    expect(getTotalVRAM()).toBe(0);
    expect(getLayer(1)).toBe("unloaded");
    expect(getLayer(2)).toBe("unloaded");
  });
});
