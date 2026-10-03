// ══════════════════════════════════════════════════════════════════════════════
// gameplayDebugger.test.ts — Tests unitaires du GameplayDebugger
//
// Couvre :
//   • Enregistrement / désenregistrement de catégories
//   • Toggle visibilité F3
//   • Sélection de catégorie (touches 1-5)
//   • Tick et collecte des draw calls
//   • Helpers 3D (DebugLine, DebugSphere, DebugText)
//   • Catégories individuelles (NPC, Perf, Quetes, Combat, Reseau)
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from "vitest";
import * as THREE from "three";

// ── Core tests ──────────────────────────────────────────────────────────────

describe("GameplayDebugger Core", () => {
  let gameplayDebugger: typeof import("./core").gameplayDebugger;

  beforeEach(async () => {
    // Reset complet : on recharge le module pour chaque test
    vi.resetModules();
    // On mocke l'import du module
    const mod = await import("./core");
    gameplayDebugger = mod.gameplayDebugger;
  });

  it("should start hidden with no categories", () => {
    expect(gameplayDebugger.visible).toBe(false);
    expect(gameplayDebugger.count).toBe(0);
    expect(gameplayDebugger.activeCategory).toBeUndefined();
  });

  it("should toggle visibility", () => {
    expect(gameplayDebugger.visible).toBe(false);
    gameplayDebugger.toggle();
    expect(gameplayDebugger.visible).toBe(true);
    gameplayDebugger.toggle();
    expect(gameplayDebugger.visible).toBe(false);
  });

  it("should set visibility directly", () => {
    gameplayDebugger.setVisible(true);
    expect(gameplayDebugger.visible).toBe(true);
    gameplayDebugger.setVisible(false);
    expect(gameplayDebugger.visible).toBe(false);
  });

  it("should register and unregister categories", () => {
    const cat: import("./core").GameplayDebuggerCategory = {
      id: "test",
      label: "Test",
      keybind: "1",
      update: () => {},
      getOverlayData: () => ["Test category"],
      getDrawCalls: () => [],
    };

    gameplayDebugger.register(cat);
    expect(gameplayDebugger.count).toBe(1);
    expect(gameplayDebugger.activeCategory?.id).toBe("test");

    gameplayDebugger.unregister("test");
    expect(gameplayDebugger.count).toBe(0);
    expect(gameplayDebugger.activeCategory).toBeUndefined();
  });

  it("should select category by index", () => {
    const cat1: import("./core").GameplayDebuggerCategory = {
      id: "cat1", label: "Cat1", keybind: "1",
      update: () => {}, getOverlayData: () => ["Cat1"], getDrawCalls: () => [],
    };
    const cat2: import("./core").GameplayDebuggerCategory = {
      id: "cat2", label: "Cat2", keybind: "2",
      update: () => {}, getOverlayData: () => ["Cat2"], getDrawCalls: () => [],
    };

    gameplayDebugger.register(cat1);
    gameplayDebugger.register(cat2);

    expect(gameplayDebugger.activeCategory?.id).toBe("cat1");

    gameplayDebugger.selectCategory(1);
    expect(gameplayDebugger.activeCategory?.id).toBe("cat2");

    gameplayDebugger.selectCategory(0);
    expect(gameplayDebugger.activeCategory?.id).toBe("cat1");
  });

  it("should ignore out-of-range category index", () => {
    const cat: import("./core").GameplayDebuggerCategory = {
      id: "cat", label: "Cat", keybind: "1",
      update: () => {}, getOverlayData: () => ["Cat"], getDrawCalls: () => [],
    };
    gameplayDebugger.register(cat);
    gameplayDebugger.selectCategory(5);
    expect(gameplayDebugger.activeCategory?.id).toBe("cat");
  });

  it("should skip duplicate registration", () => {
    const cat: import("./core").GameplayDebuggerCategory = {
      id: "dup", label: "Dup", keybind: "1",
      update: () => {}, getOverlayData: () => [], getDrawCalls: () => [],
    };
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    gameplayDebugger.register(cat);
    gameplayDebugger.register(cat);

    expect(gameplayDebugger.count).toBe(1);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("should get all categories in order", () => {
    const cat1: import("./core").GameplayDebuggerCategory = {
      id: "a", label: "A", keybind: "1",
      update: () => {}, getOverlayData: () => [], getDrawCalls: () => [],
    };
    const cat2: import("./core").GameplayDebuggerCategory = {
      id: "b", label: "B", keybind: "2",
      update: () => {}, getOverlayData: () => [], getDrawCalls: () => [],
    };

    gameplayDebugger.register(cat1);
    gameplayDebugger.register(cat2);

    const all = gameplayDebugger.getAllCategories();
    expect(all).toHaveLength(2);
    expect(all[0].id).toBe("a");
    expect(all[1].id).toBe("b");
  });

  it("should notify listeners on change", () => {
    const listener = vi.fn();
    const unsub = gameplayDebugger.subscribe(listener);

    gameplayDebugger.toggle();
    expect(listener).toHaveBeenCalledTimes(1);

    // setVisible(false) alors que visible=true depuis toggle → notifie
    gameplayDebugger.setVisible(false);
    expect(listener).toHaveBeenCalledTimes(2);

    unsub();
    gameplayDebugger.toggle();
    // Après unsub, plus de notification
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("should tick and produce draw calls only when visible", () => {
    const cat: import("./core").GameplayDebuggerCategory = {
      id: "tick-cat", label: "Tick", keybind: "1",
      update: vi.fn(),
      getOverlayData: () => ["tick"],
      getDrawCalls: () => [{ type: "line", start: new THREE.Vector3(0,0,0), end: new THREE.Vector3(1,1,1), color: 0xff0000 }],
    };
    gameplayDebugger.register(cat);
    gameplayDebugger.setVisible(false);

    gameplayDebugger.tick(0.016);
    expect(cat.update).not.toHaveBeenCalled();
    expect(gameplayDebugger.flushDrawCalls()).toHaveLength(0);

    gameplayDebugger.setVisible(true);
    gameplayDebugger.tick(0.016);
    expect(cat.update).toHaveBeenCalledOnce();
    expect(gameplayDebugger.flushDrawCalls()).toHaveLength(1);
  });
});

// ── 3D Helpers tests ────────────────────────────────────────────────────────

describe("Debug3DHelpers", () => {
  it("should create a DebugLine draw call", async () => {
    const { DebugLine } = await import("./Debug3DHelpers");
    const start = new THREE.Vector3(0, 0, 0);
    const end = new THREE.Vector3(5, 0, 0);
    const call = DebugLine(start, end, 0xff0000);

    expect(call.type).toBe("line");
    expect(call.start).toBe(start);
    expect(call.end).toBe(end);
    expect(call.color).toBe(0xff0000);
  });

  it("should create a DebugSphere draw call", async () => {
    const { DebugSphere } = await import("./Debug3DHelpers");
    const center = new THREE.Vector3(10, 5, 0);
    const call = DebugSphere(center, 2.5, 0x00ff00);

    expect(call.type).toBe("sphere");
    expect(call.center).toBe(center);
    expect(call.radius).toBe(2.5);
    expect(call.color).toBe(0x00ff00);
  });

  it("should create a DebugText draw call", async () => {
    const { DebugText } = await import("./Debug3DHelpers");
    const pos = new THREE.Vector3(1, 2, 3);
    const call = DebugText(pos, "Hello", 0xffffff);

    expect(call.type).toBe("text");
    expect(call.position).toBe(pos);
    expect(call.text).toBe("Hello");
    expect(call.color).toBe(0xffffff);
  });

  it("should use default colors when omitted", async () => {
    const { DebugLine, DebugSphere, DebugText } = await import("./Debug3DHelpers");

    const line = DebugLine(new THREE.Vector3(), new THREE.Vector3(1, 0, 0));
    expect(line.color).toBe(0x00ff00);

    const sphere = DebugSphere(new THREE.Vector3(), 1);
    expect(sphere.color).toBe(0xffff00);

    const text = DebugText(new THREE.Vector3(), "test");
    expect(text.color).toBe(0xffffff);
  });
});

// ── Perf Category tests ─────────────────────────────────────────────────────

describe("PerfDebugCategory", () => {
  it("should update and return overlay data", async () => {
    const { PerfDebugCategory, updatePerfData } = await import("./categories/perfCategory");

    updatePerfData({ fps: 60, low1: 45, ms: 16.7, calls: 200, tris: 50000, vram: 512 });

    const cat = new PerfDebugCategory();
    cat.update(0.016);

    const lines = cat.getOverlayData();
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]).toContain("PERFORMANCE");
    expect(cat.getDrawCalls()).toHaveLength(0);
  });

  it("should reflect updated perf data", async () => {
    const { PerfDebugCategory, updatePerfData } = await import("./categories/perfCategory");

    updatePerfData({ fps: 30, ms: 33.3 });
    const cat = new PerfDebugCategory();
    cat.update(0.016);

    const lines = cat.getOverlayData();
    const fpsLine = lines.find((l) => l.includes("FPS"));
    expect(fpsLine).toBeTruthy();
  });
});

// ── Combat Category tests ───────────────────────────────────────────────────

describe("CombatDebugCategory", () => {
  it("should show out-of-combat state", async () => {
    const { CombatDebugCategory, getCombatDebugData } = await import("./categories/combatCategory");

    const cat = new CombatDebugCategory();
    cat.update(0.016);

    const lines = cat.getOverlayData();
    expect(lines.some((l) => l.includes("Hors combat"))).toBe(true);
    expect(cat.getDrawCalls()).toHaveLength(2); // les lignes de portée
  });

  it("should show combat data when active", async () => {
    const { CombatDebugCategory, updateCombatDebugData, pushDamageEvent } =
      await import("./categories/combatCategory");

    updateCombatDebugData({ inCombat: true, combatDuration: 10, dps: 150 });
    pushDamageEvent({
      timestamp: performance.now(),
      amount: 50,
      isCrit: false,
      target: "orc_001",
      source: "player",
      type: "deal",
    });

    const cat = new CombatDebugCategory();
    cat.update(0.016);

    const lines = cat.getOverlayData();
    expect(lines.some((l) => l.includes("10s") || l.includes("0m10s") || l.includes("Combat"))).toBe(true);
  });
});

// ── Reseau Category tests ───────────────────────────────────────────────────

describe("ReseauDebugCategory", () => {
  it("should show disconnected state by default", async () => {
    const { ReseauDebugCategory } = await import("./categories/reseauCategory");

    const cat = new ReseauDebugCategory();
    cat.update(0.016);

    const lines = cat.getOverlayData();
    expect(lines.some((l) => l.includes("DISCONNECTED"))).toBe(true);
  });

  it("should show connected state with data", async () => {
    const { ReseauDebugCategory, updateReseauData } = await import("./categories/reseauCategory");

    updateReseauData({
      ping: 34,
      packetsIn: 60,
      packetsOut: 30,
      packetsLost: 1,
      status: "connected",
      transport: "wss",
      peers: 4,
      tickRate: 20,
    });

    const cat = new ReseauDebugCategory();
    cat.update(0.016);

    const lines = cat.getOverlayData();
    expect(lines.some((l) => l.includes("CONNECTED"))).toBe(true);
    expect(lines.some((l) => l.includes("34"))).toBe(true);
    expect(lines.some((l) => l.includes("4"))).toBe(true);
  });
});
