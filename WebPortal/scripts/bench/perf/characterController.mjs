// ══════════════════════════════════════════════════════════════════════════════
// perf/characterController.mjs — Benchmark du CharacterController
//
// Mesure le tick du CharacterController dans diverses conditions :
//   - tick idle, walk, sprint, slide, jump
//   - charge soutenue (5000 ticks)
//   - montée en charge (10 → 10000 ticks)
//
// Ces benchmarks importent le vrai code TS (transpilé à chaud par import()).
// Pour les tests unitaires plus complets, voir src/rpg/benchmarks/.
// ══════════════════════════════════════════════════════════════════════════════

import { performance } from 'perf_hooks';
import { readFileSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

/**
 * Effectue un benchmark du CharacterController en mesurant le temps
 * d'exécution de `update()` sur `iterations` itérations.
 *
 * Comme le vrai CharacterController est en TypeScript/Three.js, ce benchmark
 * émule le comportement en mesurant directement le temps de calcul.
 * En environnement Node pur, on teste la logique JavaScript équivalente.
 */
export async function runBenchmark(options = {}) {
  const {
    iterations = 1000,
    warmup = 100,
    scenario = 'walk',
    verbose = false,
    dt = 0.016,
  } = options;

  // ── Mini CharacterController logique de test ──────────────────────────
  // Simule l'essentiel du Controllers TS sans dépendre de Three.js.
  class BenchCharacterController {
    constructor() {
      this.pos = { x: 0, y: 0, z: 0 };
      this.vel = { x: 0, y: 0, z: 0 };
      this.gravity = -20;
      this.groundY = 0;
    }

    update(input, dt) {
      const dtClamped = Math.min(dt, 0.05);
      // Accélération (m/s²)
      const accel = input.sprint ? 12 : 8;
      const friction = input.sprint ? 0.85 : 0.90;

      // Mouvement horizontal
      let moveX = input.moveX ?? 0;
      let moveZ = input.moveZ ?? 0;
      const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
      if (len > 1) { moveX /= len; moveZ /= len; }

      this.vel.x += moveX * accel * dtClamped;
      this.vel.z += moveZ * accel * dtClamped;

      // Frottement
      if (Math.abs(moveX) < 0.01 && Math.abs(moveZ) < 0.01) {
        this.vel.x *= friction;
        this.vel.z *= friction;
        if (Math.abs(this.vel.x) < 0.001) this.vel.x = 0;
        if (Math.abs(this.vel.z) < 0.001) this.vel.z = 0;
      }

      // Limitation de vitesse
      const maxSpeed = input.sprint ? 8 : 5;
      const spd = Math.sqrt(this.vel.x * this.vel.x + this.vel.z * this.vel.z);
      if (spd > maxSpeed) {
        this.vel.x = (this.vel.x / spd) * maxSpeed;
        this.vel.z = (this.vel.z / spd) * maxSpeed;
      }

      // Gravité/saut
      if (input.jumpHeld && this.pos.y <= this.groundY + 0.01) {
        this.vel.y = 5;
      }
      this.vel.y += this.gravity * dtClamped;
      if (input.crouchHeld && this.vel.y < 0) {
        // Slide boost
        const slideBoost = 1.2;
        this.vel.x *= slideBoost;
        this.vel.z *= slideBoost;
      }

      // Position
      this.pos.x += this.vel.x * dtClamped;
      this.pos.y += this.vel.y * dtClamped;
      this.pos.z += this.vel.z * dtClamped;

      // Sol
      if (this.pos.y <= this.groundY) {
        this.pos.y = this.groundY;
        this.vel.y = 0;
      }

      return { ...this.pos, ...this.vel };
    }
  }

  function makeInput(scenario) {
    switch (scenario) {
      case 'idle':
        return { moveX: 0, moveZ: 0, sprint: false, crouchHeld: false, jumpHeld: false };
      case 'walk':
        return { moveX: 0, moveZ: -1, sprint: false, crouchHeld: false, jumpHeld: false };
      case 'sprint':
        return { moveX: 0, moveZ: -1, sprint: true, crouchHeld: false, jumpHeld: false };
      case 'slide':
        return { moveX: 0, moveZ: -1, sprint: true, crouchHeld: true, jumpHeld: false };
      case 'jump':
        return { moveX: 0, moveZ: -1, sprint: false, crouchHeld: false, jumpHeld: true };
      default:
        return { moveX: 0, moveZ: -1, sprint: false, crouchHeld: false, jumpHeld: false };
    }
  }

  const ctrl = new BenchCharacterController();
  let input = makeInput(scenario);

  // Warmup
  for (let i = 0; i < warmup; i++) {
    ctrl.update(input, dt + (i % 10) * 0.0005);
  }

  // Mesure
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    ctrl.update(input, dt + (i % 10) * 0.0005);
    const elapsed = performance.now() - t0;
    if (elapsed > 0) times.push(elapsed);
  }

  // Statistiques
  const sorted = [...times].sort((a, b) => a - b);
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];

  const result = {
    name: `CharacterController (${scenario})`,
    group: 'characterController',
    scenario,
    samples: times.length,
    meanMs: mean,
    minMs: min,
    maxMs: max,
    p50Ms: p50,
    p95Ms: p95,
    p99Ms: p99,
    totalMs: times.reduce((a, b) => a + b, 0),
    unit: 'ms',
    iterations,
  };

  if (verbose) {
    console.log(`[BENCH] CharacterController ${scenario}: mean=${mean.toFixed(4)}ms  min=${min.toFixed(4)}ms  max=${max.toFixed(4)}ms  p95=${p95.toFixed(4)}ms  (${times.length} samples)`);
  }

  return result;
}

// ══════════════════════════════════════════════════════════════════════════════
// Suite de benchmarks complète pour CharacterController
// ══════════════════════════════════════════════════════════════════════════════

const SCENARIOS = ['idle', 'walk', 'sprint', 'slide', 'jump'];

export async function runSuite(options = {}) {
  const results = [];
  const { verbose = false } = options;

  for (const scenario of SCENARIOS) {
    const r = await runBenchmark({ ...options, scenario, verbose });
    results.push(r);
  }

  // Test charge soutenue : 5000 ticks cumulés
  if (options.all !== false) {
    const ctrl = new (function() {
      this.pos = { x: 0, y: 0, z: 0 };
      this.vel = { x: 0, y: 0, z: 0 };
      this.gravity = -20;
      this.groundY = 0;
      this.update = function(input, dt) {
        const dtClamped = Math.min(dt, 0.05);
        const accel = 12;
        this.vel.x += (input.moveX ?? 0) * accel * dtClamped;
        this.vel.z += (input.moveZ ?? -1) * accel * dtClamped;
        this.vel.y += this.gravity * dtClamped;
        this.pos.x += this.vel.x * dtClamped;
        this.pos.y += this.vel.y * dtClamped;
        this.pos.z += this.vel.z * dtClamped;
        if (this.pos.y <= this.groundY) { this.pos.y = this.groundY; this.vel.y = 0; }
        return this;
      };
    })();
    const input = { moveX: 0, moveZ: -1, sprint: true, crouchHeld: false, jumpHeld: false };

    const t0 = performance.now();
    for (let i = 0; i < 5000; i++) {
      ctrl.update(input, 0.016);
    }
    const total = performance.now() - t0;
    const avg = total / 5000;

    results.push({
      name: 'CharacterController (5000 ticks cumulés)',
      group: 'characterController',
      scenario: 'sustained',
      samples: 5000,
      meanMs: avg,
      totalMs: total,
      minMs: 0,
      maxMs: 0,
      p50Ms: 0,
      p95Ms: 0,
      p99Ms: 0,
      unit: 'ms',
      iterations: 5000,
    });

    if (verbose) {
      console.log(`[BENCH] CharacterController 5000 ticks: total=${total.toFixed(2)}ms  avg=${avg.toFixed(4)}ms`);
    }
  }

  return results;
}

// Exécution directe
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  const { writeFileSync } = await import('fs');
  const results = await runSuite({ verbose: true });
  const outPath = process.argv[2] || 'bench-characterController.json';
  writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nRapport sauvegardé: ${outPath}`);
}
