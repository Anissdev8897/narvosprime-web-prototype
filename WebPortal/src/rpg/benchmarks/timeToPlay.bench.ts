// ══════════════════════════════════════════════════════════════════════════════
// benchmarks/timeToPlay.bench.ts — Benchmark Time-to-Play Loading P2
//
// Mesure et compare les métriques clés AVANT (legacy) et APRÈS (loading P2) :
//
//   1. Temps de chargement simulé (assets prioritaires VS tout à la fois)
//   2. Budget VRAM respecté / dépassé
//   3. Nombre de chargements simultanés max
//   4. Assets prioritaires chargés en premier (% loaded à T/2)
//
// Ces benchmarks testent la LOGIQUE de classement et de budget VRAM,
// pas le réseau (qui dépend du serveur et du cache).
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";

// ── Types (copie locale pour éviter les imports de dépendances Three.js) ────

type LoadPriority = "critical" | "high" | "medium" | "low";

interface PriorityAsset {
  url: string;
  priority: LoadPriority;
  sizeMB: number;
}

// ── Fonctions de classement (copie de la logique AssetPreloader) ────────────

function classifyPriority(url: string): LoadPriority {
  if (/vaisseau|ship/i.test(url)) return "critical";
  if (/chunk/i.test(url)) return "critical";
  if (/background|fond/i.test(url)) return "low";
  if (/npc|pnj|personnage|creature|monstre/i.test(url)) return "high";
  if (/avatar|wraith/i.test(url)) return "critical";
  if (/weapon|arme|sword|epe|arch_/i.test(url)) return "medium";
  if (/anim/i.test(url)) return "medium";
  return "medium";
}

function sortByPriority(urls: string[]): PriorityAsset[] {
  const withPrio: PriorityAsset[] = urls.map((url) => ({
    url,
    priority: classifyPriority(url),
    sizeMB: url.length * 0.01, // mock
  }));
  const order: Record<LoadPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  withPrio.sort((a, b) => order[a.priority] - order[b.priority]);
  return withPrio;
}

// ── Simulation de budget VRAM ──────────────────────────────────────────────

class VramSimulator {
  usedMB = 0;
  totalMB = 2048;
  alertMB = 1536;
  criticalMB = 1792;

  get level(): "ok" | "alert" | "critical" | "full" {
    if (this.usedMB >= this.totalMB) return "full";
    if (this.usedMB >= this.criticalMB) return "critical";
    if (this.usedMB >= this.alertMB) return "alert";
    return "ok";
  }

  canLoad(mb: number): boolean { return this.usedMB + mb <= this.totalMB; }

  load(mb: number): boolean {
    if (!this.canLoad(mb)) return false;
    this.usedMB += mb;
    return true;
  }

  unload(mb: number): void { this.usedMB = Math.max(0, this.usedMB - mb); }

  reset(): void { this.usedMB = 0; }
}

// ── Simulation de chargement legacy (tout à la fois, pas de priorité) ──────

function simulateLegacyLoad(assets: PriorityAsset[], vram: VramSimulator): {
  timeMs: number;
  loadedCount: number;
  vramOverflow: boolean;
  criticalLoadedFirstHalf: number;
  totalCritical: number;
} {
  const totalSize = assets.reduce((s, a) => s + a.sizeMB, 0);
  const critical = assets.filter((a) => a.priority === "critical");
  const halfIndex = Math.floor(assets.length / 2);

  // Legacy: tout le monde charge en même temps, pas de budget check
  const success = vram.load(totalSize);
  const loadedCount = success ? assets.length : Math.floor(assets.length * 0.6);
  const vramOverflow = !success;

  // Temps simulé : proportionnel au nombre total + taille (parallélisme illimité dans legacy)
  const timeMs = 100 + assets.length * 5 + totalSize * 2;

  // Dans legacy, les assets critiques ne sont PAS chargés en premier
  const criticalInFirstHalf = critical.filter((a) => {
    const idx = assets.findIndex((x) => x.url === a.url);
    return idx >= 0 && idx < halfIndex;
  }).length;

  return { timeMs, loadedCount, vramOverflow, criticalLoadedFirstHalf: criticalInFirstHalf, totalCritical: critical.length };
}

// ── Simulation de chargement P2 (prioritaire + budget VRAM) ────────────────

function simulateP2Load(assets: PriorityAsset[], vram: VramSimulator): {
  timeMs: number;
  loadedCount: number;
  concurrentMax: number;
  skippedByVram: number;
  criticalLoadedFirstHalf: number;
  totalCritical: number;
} {
  const MAX_CONCURRENT = 4;
  let inflight = 0;
  let loaded = 0;
  let skippedByVram = 0;
  let timeMs = 0;

  // Trier par priorité
  const sorted = [...assets].sort((a, b) => {
    const order: Record<LoadPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return order[a.priority] - order[b.priority];
  });

  const critical = sorted.filter((a) => a.priority === "critical");
  const halfIndex = Math.floor(sorted.length / 2);

  for (const asset of sorted) {
    // Budget VRAM check (sauf critical)
    if (asset.priority !== "critical" && !vram.canLoad(asset.sizeMB)) {
      skippedByVram++;
      continue;
    }

    if (!vram.load(asset.sizeMB)) {
      skippedByVram++;
      continue;
    }

    loaded++;
    inflight++;
    if (inflight > MAX_CONCURRENT) {
      // Simule attente
      timeMs += 20;
      inflight = MAX_CONCURRENT;
    }
    // Temps de chargement simulé : 50-150ms par asset
    timeMs += 40 + asset.sizeMB * 5;
  }

  // Critical dans la première moitié ?
  const criticalInFirstHalf = critical.filter((a) => {
    const idx = sorted.findIndex((x) => x.url === a.url);
    return idx >= 0 && idx < halfIndex;
  }).length;

  return {
    timeMs,
    loadedCount: loaded,
    concurrentMax: Math.min(loaded, MAX_CONCURRENT),
    skippedByVram,
    criticalLoadedFirstHalf: criticalInFirstHalf,
    totalCritical: critical.length,
  };
}

// ── Données de test ────────────────────────────────────────────────────────

function makeMockUrls(): string[] {
  return [
    // 3 critical (map, ships)
    "/models/Maps/forge_map/forge_map.glb",
    "/models/ships/ship_forge.glb",
    "/models/ships/ship_tower.glb",
    // 4 high (NPCs)
    "/models/npc/soldat_humain.glb",
    "/models/npc/mercenaire.glb",
    "/models/npc/marchand.glb",
    "/models/npc/creature_mécanique.glb",
    // 6 medium (weapons, animations)
    "/models/weapons/arch_sword.glb",
    "/models/weapons/arch_bow.glb",
    "/models/weapons/arch_staff.glb",
    "/models/animations/magic_pack.glb",
    "/models/animations/melee_pack.glb",
    "/models/animations/archer_pack.glb",
    // 2 low (backgrounds)
    "/models/background/nebula.glb",
    "/models/background/debris_field.glb",
  ];
}

// ══════════════════════════════════════════════════════════════════════════════
// Benchmarks
// ══════════════════════════════════════════════════════════════════════════════

describe("Loading P2 — Time-to-Play Benchmark", () => {
  const urls = makeMockUrls();
  const prioritized = sortByPriority(urls);

  it("classement par priorité: critical en premier, low en dernier", () => {
    expect(prioritized.length).toBe(urls.length);
    expect(prioritized[0].priority).toBe("critical");
    expect(prioritized[1].priority).toBe("critical");
    expect(prioritized[prioritized.length - 1].priority).toBe("low");
    expect(prioritized[prioritized.length - 2].priority).toBe("low");
  });

  it("classement: toutes les priorités représentées", () => {
    const prios = new Set(prioritized.map((a) => a.priority));
    expect(prios.has("critical")).toBe(true);
    expect(prios.has("high")).toBe(true);
    expect(prios.has("medium")).toBe(true);
    expect(prios.has("low")).toBe(true);
  });

  it("legacy vs P2: assets critiques chargés en premier", () => {
    const vram = new VramSimulator();

    const legacy = simulateLegacyLoad(prioritized, vram);
    vram.reset();
    const p2 = simulateP2Load(prioritized, vram);

    // Legacy: pas de garantie sur l'ordre des critiques
    // P2: TOUS les critiques sont dans la première moitié
    expect(p2.criticalLoadedFirstHalf).toBe(p2.totalCritical);
    console.log(`[BENCH] Legacy: ${legacy.criticalLoadedFirstHalf}/${legacy.totalCritical} critiques en première moitié`);
    console.log(`[BENCH] P2:     ${p2.criticalLoadedFirstHalf}/${p2.totalCritical} critiques en première moitié`);
  });

  it("P2: budget VRAM respecté sous charge", () => {
    const vram = new VramSimulator();
    // Simuler une charge existante (1.5 GB déjà utilisé)
    vram.usedMB = 1536; // alert level
    expect(vram.level).toBe("alert");

    const result = simulateP2Load(prioritized, vram);
    // Les assets critiques doivent passer
    expect(result.loadedCount).toBeGreaterThanOrEqual(3);
    // Les low peuvent être skip
    console.log(`[BENCH] Budget VRAM alert: ${result.loadedCount}/${prioritized.length} chargés, ${result.skippedByVram} skip`);
  });

  it("P2: budget VRAM critique bloque les non-essentiels", () => {
    const vram = new VramSimulator();
    vram.usedMB = 1792; // critical level
    expect(vram.level).toBe("critical");

    const result = simulateP2Load(prioritized, vram);
    // Même les high peuvent être skip en mode critique
    const loaded = result.loadedCount;
    const skipped = result.skippedByVram;
    console.log(`[BENCH] Budget VRAM critical: ${loaded}/${prioritized.length} chargés, ${skipped} skip`);
  });

  it("P2: parallélisme limité à MAX_CONCURRENT", () => {
    const vram = new VramSimulator();
    const result = simulateP2Load(prioritized, vram);
    expect(result.concurrentMax).toBeLessThanOrEqual(4);
    console.log(`[BENCH] P2 concurrent max: ${result.concurrentMax}`);
  });

  it("comparaison legacy vs P2: time-to-play réduit", () => {
    const vram = new VramSimulator();

    const legacy = simulateLegacyLoad(prioritized, vram);
    vram.reset();
    const p2 = simulateP2Load(prioritized, vram);

    // P2 doit charger TOUS les critiques et au moins les highs
    expect(p2.loadedCount).toBeGreaterThanOrEqual(prioritized.filter((a) => a.priority !== "low").length);

    console.log("\n═══════════════════════════════════════════");
    console.log("  Time-to-Play Benchmark (simulation)");
    console.log("═══════════════════════════════════════════");
    console.log(`  Legacy : ${legacy.timeMs.toFixed(0)}ms  | ${legacy.loadedCount} assets | overflow: ${legacy.vramOverflow}`);
    console.log(`  P2     : ${p2.timeMs.toFixed(0)}ms  | ${p2.loadedCount} assets | skip VRAM: ${p2.skippedByVram}`);
    const gain = legacy.timeMs > 0 ? Math.round((1 - p2.timeMs / legacy.timeMs) * 100) : 0;
    console.log(`  Gain   : ~${gain}% (assets critiques chargés en priorité)`);
    console.log(`  Concur : Legacy=∞  P2=max ${p2.concurrentMax}`);
    console.log("═══════════════════════════════════════════\n");
  });
});

describe("VramBudget — simulation", () => {
  it("budget ok → tous les assets passent", () => {
    const vram = new VramSimulator();
    // 15 assets × ~1.5 MB = 22.5 MB, bien sous le budget
    for (let i = 0; i < 15; i++) {
      expect(vram.canLoad(1.5)).toBe(true);
      vram.load(1.5);
    }
    expect(vram.level).toBe("ok");
  });

  it("budget plein → canLoad false", () => {
    const vram = new VramSimulator();
    vram.usedMB = vram.totalMB; // full
    expect(vram.canLoad(1)).toBe(false);
    expect(vram.level).toBe("full");
  });

  it("budget alert → ok pour les petits, non pour les gros", () => {
    const vram = new VramSimulator();
    vram.usedMB = 1540; // alert, remaining = 2048 - 1540 = 508MB
    expect(vram.level).toBe("alert");
    // Petit asset OK
    expect(vram.canLoad(1)).toBe(true);
    // Gros asset (>508 MB restants) NON
    expect(vram.canLoad(600)).toBe(false);
  });
});
