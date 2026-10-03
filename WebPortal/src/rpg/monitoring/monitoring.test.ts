// ══════════════════════════════════════════════════════════════════════════════
// rpg/monitoring/monitoring.test.ts — Tests unitaires du service de monitoring
//
// Chemins relatifs en `./` : la suite vit À CÔTÉ des modules testés. Elle portait
// des chemins en `../rpg/monitoring/…`, hérités d'un emplacement `src/tests/` où
// elle n'a jamais été déposée — le fichier ne se chargeait donc pas du tout
// (« 0 test » dans le rapport, ce qui se lit comme une suite vide, pas cassée).
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from "vitest";
import { monitoringService, type MetricsSnapshot, type CrashReport } from "./MonitoringService";
import {
  markLoadPhase,
  measureLoadPhase,
  clearPerformanceMarks,
  getAllMeasures,
  markBootStart,
  markBootEnd,
  markDbHydrateStart,
  markDbHydrateEnd,
  markAssetLoadStart,
  markAssetLoadEnd,
} from "./performanceMarks";

// ── Mock performance (User Timing API) ───────────────────────────────────────

const marks = new Map<string, number>();
const measures: { name: string; duration: number }[] = [];
let now = 1000;

beforeEach(() => {
  // Reset monitoring service
  monitoringService.clear();

  // Reset marks/measures
  marks.clear();
  measures.length = 0;
  now = 1000;

  // Mock performance
  vi.stubGlobal("performance", {
    // `now` fait partie du contrat : `MonitoringService` l'appelle pour horodater
    // ses échantillons. Le stub le remplaçait globalement sans le fournir — donc
    // en le posant, on RETIRAIT une méthode que l'environnement avait déjà.
    // Il suit le même compteur que `mark`, ce qui garde les durées déterministes.
    now: vi.fn(() => now),
    mark: vi.fn((name: string) => {
      marks.set(name, now);
      now += 1;
    }),
    measure: vi.fn((name: string, startMark: string, endMark: string) => {
      const start = marks.get(startMark);
      const end = marks.get(endMark);
      if (start !== undefined && end !== undefined) {
        measures.push({ name, duration: end - start });
      }
    }),
    getEntriesByName: vi.fn((name: string) => {
      return measures.filter((m) => m.name === name).map((m) => ({ ...m, entryType: "measure" }));
    }),
    getEntriesByType: vi.fn((type: string) => {
      return type === "measure" ? [...measures] : [];
    }),
    clearMarks: vi.fn(() => marks.clear()),
    clearMeasures: vi.fn(() => { measures.length = 0; }),
  });

  // Mock localStorage
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { store.set(key, value); }),
    removeItem: vi.fn((key: string) => { store.delete(key); }),
    clear: vi.fn(() => store.clear()),
    get length() { return store.size; },
    key: vi.fn((_: number) => null),
  });

  // Mock console.warn
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

// ── MonitoringService ─────────────────────────────────────────────────────────

describe("MonitoringService", () => {
  it("démarre sans erreur", () => {
    expect(() => monitoringService.start()).not.toThrow();
    monitoringService.stop();
  });

  it("clear efface toutes les données", () => {
    // Simuler des métriques
    const snapshot: MetricsSnapshot = {
      timestamp: Date.now(),
      fps: 60,
      memoryMB: 500,
      memoryPercent: 50,
      vramMB: 0,
      drawCalls: 100,
      triangles: 50000,
      textures: 20,
      geometries: 15,
      loadDurationMs: 2000,
      jsErrors: 0,
    };

    // Inject via export (écriture directe dans localStorage)
    monitoringService["_metrics"] = [snapshot];
    monitoringService["_alerts"] = [{
      timestamp: Date.now(),
      type: "memory_high",
      severity: "warning",
      value: 95,
      threshold: 90,
      message: "test",
    }];
    monitoringService["_crashes"] = [{
      timestamp: Date.now(),
      message: "test error",
      stack: "",
      context: { stage: "test" },
    }];

    expect(monitoringService.getMetrics().length).toBeGreaterThan(0);
    expect(monitoringService.getAlerts().length).toBeGreaterThan(0);
    expect(monitoringService.getCrashes().length).toBeGreaterThan(0);

    monitoringService.clear();
    expect(monitoringService.getMetrics().length).toBe(0);
    expect(monitoringService.getAlerts().length).toBe(0);
    expect(monitoringService.getCrashes().length).toBe(0);
  });

  it("reportCrash capture les erreurs avec contexte", () => {
    monitoringService.updateContext({ stage: "game", characterId: "test_char", mapId: "forge" });

    const error = new Error("Mon erreur de test");
    monitoringService.reportCrash(error);

    const crashes = monitoringService.getCrashes();
    expect(crashes.length).toBe(1);
    expect(crashes[0].message).toBe("Mon erreur de test");
    expect(crashes[0].context.stage).toBe("game");
    expect(crashes[0].context.characterId).toBe("test_char");
    expect(crashes[0].context.mapId).toBe("forge");
  });

  it("getTopErrors agrège les crashs par message", () => {
    for (let i = 0; i < 3; i++) {
      monitoringService.reportCrash(new Error("Erreur fréquente"));
    }
    monitoringService.reportCrash(new Error("Erreur rare"));

    const top = monitoringService.getTopErrors(2);
    expect(top.length).toBe(2);
    expect(top[0].message).toBe("Erreur fréquente");
    expect(top[0].count).toBe(3);
    expect(top[1].message).toBe("Erreur rare");
    expect(top[1].count).toBe(1);
  });

  it("updateContext ne remplace que les champs fournis", () => {
    monitoringService.updateContext({ stage: "menu" });
    expect(monitoringService.getContext().stage).toBe("menu");

    monitoringService.updateContext({ characterId: "char_1" });
    expect(monitoringService.getContext().characterId).toBe("char_1");
    expect(monitoringService.getContext().stage).toBe("menu"); // conservé
  });

  it("getLatestMetrics retourne null si aucune métrique", () => {
    expect(monitoringService.getLatestMetrics()).toBeNull();
  });

  it("persiste et restaure depuis localStorage", () => {
    // Simuler qu'il y avait des données persistées
    const snapshot: MetricsSnapshot = {
      timestamp: 1000,
      fps: 60,
      memoryMB: 256,
      memoryPercent: 30,
      vramMB: 0,
      drawCalls: 50,
      triangles: 20000,
      textures: 10,
      geometries: 8,
      loadDurationMs: 1500,
      jsErrors: 0,
    };
    localStorage.setItem("narvos:monitoring:metrics", JSON.stringify([snapshot]));

    monitoringService.loadPersisted();
    const metrics = monitoringService.getMetrics();
    expect(metrics.length).toBe(1);
    expect(metrics[0].fps).toBe(60);
    expect(metrics[0].memoryMB).toBe(256);
  });
});

// ── Performance Marks ─────────────────────────────────────────────────────────

describe("performanceMarks", () => {
  it("markLoadPhase et measureLoadPhase mesurent les durées", () => {
    markLoadPhase("start");
    markLoadPhase("end");

    const duration = measureLoadPhase("start", "end", "test_measure");
    expect(duration).toBeGreaterThan(0);
  });

  it("getAllMeasures retourne les mesures enregistrées", () => {
    markBootStart();
    markBootEnd();

    const ms = getAllMeasures();
    expect(ms.length).toBeGreaterThan(0);
    expect(ms.some((m) => m.name === "boot_total")).toBe(true);
  });

  it("clearPerformanceMarks vide tout", () => {
    markBootStart();
    markBootEnd();
    expect(getAllMeasures().length).toBeGreaterThan(0);

    clearPerformanceMarks();
    expect(getAllMeasures().length).toBe(0);
  });

  it("markDbHydrate et markAssetLoad fonctionnent sans erreur", () => {
    expect(() => {
      markDbHydrateStart();
      markDbHydrateEnd();
      markAssetLoadStart();
      markAssetLoadEnd();
    }).not.toThrow();
  });
});
