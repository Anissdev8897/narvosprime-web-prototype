// ══════════════════════════════════════════════════════════════════════════════
// perf/wasm.mjs — Benchmark de la logique WASM (simulé côté JS)
//
// Mesure :
//   - AISystem tick : itération sur entités, décisions tactiques
//   - ECS iteration : queries, composants, systèmes
//   - Simulation des appels WASM sans le binaire
//
// NOTE : Ces benchmarks simulent la logique C++/WASM en JavaScript pour
// détecter les régressions algorithmiques. Le vrai WASM doit être testé
// via les bench TS avec le module chargé.
// ══════════════════════════════════════════════════════════════════════════════

import { performance } from 'perf_hooks';

// ── ECS Simulé ──────────────────────────────────────────────────────────────

class Component {
  constructor(type, data) {
    this.type = type;
    this.data = data;
  }
}

class Entity {
  constructor(id) {
    this.id = id;
    this.components = new Map();
    this.active = true;
  }
}

class ECSSim {
  constructor() {
    this.entities = [];
    this.nextId = 0;
  }

  createEntity() {
    const e = new Entity(this.nextId++);
    this.entities.push(e);
    return e;
  }

  query(...types) {
    const results = [];
    for (const e of this.entities) {
      if (!e.active) continue;
      let match = true;
      const comps = [];
      for (const t of types) {
        const c = e.components.get(t);
        if (!c) { match = false; break; }
        comps.push(c);
      }
      if (match) results.push({ entity: e, components: comps });
    }
    return results;
  }
}

// ── Systèmes AI ──────────────────────────────────────────────────────────────

class AISystem {
  constructor(ecs) {
    this.ecs = ecs;
  }

  tick(dt) {
    // Itère sur les entités avec AIComponent et Transform
    const agents = this.ecs.query('AIComponent', 'Transform', 'Health');
    const commands = [];

    for (const { entity, components } of agents) {
      const [ai, transform, health] = components;
      const aiData = ai.data;
      const healthData = health.data;
      const tData = transform.data;

      // Décision AI basée sur l'état
      let action = 'idle';
      let target = null;

      if (healthData.current < healthData.max * 0.3) {
        action = 'retreat';
        // Cherche le point d'origine comme refuge
        target = { x: aiData.originX, y: 0, z: aiData.originZ };
      } else if (aiData.detectedEnemy !== null) {
        action = 'attack';
        target = aiData.targetPos;
      } else if (aiData.patrolPath && aiData.patrolPath.length > 0) {
        action = 'patrol';
        aiData.patrolIndex = ((aiData.patrolIndex ?? 0) + 1) % aiData.patrolPath.length;
        target = aiData.patrolPath[aiData.patrolIndex];
      } else {
        action = 'wander';
        target = { x: tData.x + (Math.random() - 0.5) * 10, y: 0, z: tData.z + (Math.random() - 0.5) * 10 };
      }

      commands.push({ entityId: entity.id, action, target, timestamp: Date.now() });
    }

    return commands;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function setupECS(entityCount) {
  const ecs = new ECSSim();
  for (let i = 0; i < entityCount; i++) {
    const e = ecs.createEntity();
    e.components.set('Transform', new Component('Transform', {
      x: (Math.random() - 0.5) * 200,
      y: 0,
      z: (Math.random() - 0.5) * 200,
    }));
    if (i < entityCount * 0.4) {
      // 40% sont des agents AI
      e.components.set('AIComponent', new Component('AIComponent', {
        originX: (Math.random() - 0.5) * 200,
        originZ: (Math.random() - 0.5) * 200,
        detectedEnemy: Math.random() > 0.3 ? { entityId: 0 } : null,
        targetPos: { x: (Math.random() - 0.5) * 200, y: 0, z: (Math.random() - 0.5) * 200 },
        patrolPath: Array.from({ length: 4 }, () => ({ x: (Math.random() - 0.5) * 200, y: 0, z: (Math.random() - 0.5) * 200 })),
        patrolIndex: 0,
      }));
      e.components.set('Health', new Component('Health', {
        current: 50 + Math.random() * 50,
        max: 100,
      }));
    }
    if (i >= entityCount * 0.4 && i < entityCount * 0.7) {
      // 30% sont des projectiles/dynamiques
      e.components.set('Physics', new Component('Physics', {
        vx: (Math.random() - 0.5) * 20,
        vy: 0,
        vz: (Math.random() - 0.5) * 20,
        mass: 1 + Math.random() * 10,
      }));
    }
    // Le reste (30%) sont des décorations sans composants particuliers
  }
  return ecs;
}

// ══════════════════════════════════════════════════════════════════════════════
// Benchmarks
// ══════════════════════════════════════════════════════════════════════════════

export async function runBenchmark(options = {}) {
  const { verbose = false } = options;
  const results = [];

  // 1. ECS Query simple — 10000 entités, query 2 composants
  {
    const ecs = setupECS(10000);
    const times = [];

    for (let i = 0; i < 200; i++) {
      const t0 = performance.now();
      const results_q = ecs.query('Transform', 'AIComponent');
      times.push(performance.now() - t0);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    results.push({
      name: 'ECS query (10k entities, 2 components)',
      group: 'wasm',
      scenario: 'ecsQuery',
      samples: 200,
      meanMs: avg,
      minMs: Math.min(...times),
      maxMs: Math.max(...times),
      unit: 'ms',
      iterations: 200,
    });
    if (verbose) console.log(`[BENCH] ECS query (10k) : ${avg.toFixed(4)}ms`);
  }

  // 2. ECS Query 3 composants — 10000 entités
  {
    const ecs = setupECS(10000);
    const times = [];

    for (let i = 0; i < 200; i++) {
      const t0 = performance.now();
      const results_q = ecs.query('Transform', 'AIComponent', 'Health');
      times.push(performance.now() - t0);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    results.push({
      name: 'ECS query (10k entities, 3 components)',
      group: 'wasm',
      scenario: 'ecsQuery3',
      samples: 200,
      meanMs: avg,
      minMs: Math.min(...times),
      maxMs: Math.max(...times),
      unit: 'ms',
      iterations: 200,
    });
    if (verbose) console.log(`[BENCH] ECS query 3 comps (10k) : ${avg.toFixed(4)}ms`);
  }

  // 3. AI System tick — 4000 agents AI sur 10000 entités
  {
    const ecs = setupECS(10000);
    const ai = new AISystem(ecs);
    const times = [];

    for (let i = 0; i < 100; i++) {
      const t0 = performance.now();
      const commands = ai.tick(0.016);
      times.push(performance.now() - t0);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    results.push({
      name: 'AISystem tick (10k entities, ~4k agents)',
      group: 'wasm',
      scenario: 'aiTick',
      samples: 100,
      meanMs: avg,
      minMs: Math.min(...times),
      maxMs: Math.max(...times),
      unit: 'ms',
      iterations: 100,
    });
    if (verbose) console.log(`[BENCH] AI tick (10k) : ${avg.toFixed(4)}ms`);
  }

  // 4. AI System tick — grande échelle (50000 entités)
  {
    const ecs = setupECS(50000);
    const ai = new AISystem(ecs);
    const times = [];

    for (let i = 0; i < 20; i++) {
      const t0 = performance.now();
      const commands = ai.tick(0.016);
      times.push(performance.now() - t0);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    results.push({
      name: 'AISystem tick (50k entities, ~20k agents)',
      group: 'wasm',
      scenario: 'aiTickLarge',
      samples: 20,
      meanMs: avg,
      minMs: Math.min(...times),
      maxMs: Math.max(...times),
      unit: 'ms',
      iterations: 20,
    });
    if (verbose) console.log(`[BENCH] AI tick (50k) : ${avg.toFixed(2)}ms`);
  }

  // 5. Création d'entités (burst) — 10000 entities
  {
    const times = [];
    for (let b = 0; b < 50; b++) {
      const ecs = new ECSSim();
      const t0 = performance.now();
      for (let i = 0; i < 1000; i++) {
        const e = ecs.createEntity();
        e.components.set('Transform', new Component('Transform', { x: 0, y: 0, z: 0 }));
        e.components.set('Physics', new Component('Physics', { vx: 0, vy: 0, vz: 0, mass: 1 }));
      }
      times.push(performance.now() - t0);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length / 1000;
    results.push({
      name: 'ECS entity creation (1000 burst)',
      group: 'wasm',
      scenario: 'entityCreate',
      samples: 50000,
      meanMs: avg,
      minMs: Math.min(...times) / 1000,
      maxMs: Math.max(...times) / 1000,
      unit: 'ms',
      iterations: 50000,
    });
    if (verbose) console.log(`[BENCH] Entity creation : ${(avg * 1000).toFixed(3)}μs/entity`);
  }

  // 6. Itération complète d'un tick système (tous les systèmes)
  {
    const ecs = setupECS(20000);
    const ai = new AISystem(ecs);
    const times = [];

    for (let i = 0; i < 50; i++) {
      const t0 = performance.now();

      // Simule un tick complet : plusieurs systèmes
      // System 1: AI
      const aiCommands = ai.tick(0.016);

      // System 2: Physique (mouvement simple)
      const physEntities = ecs.query('Transform', 'Physics');
      for (const { entity, components } of physEntities) {
        const [transform, physics] = components;
        const p = physics.data;
        const t = transform.data;
        t.x += p.vx * 0.016;
        t.z += p.vz * 0.016;
      }

      // System 3: Nettoyage des morts
      const deadEntities = ecs.query('Health');
      for (const { entity, components } of deadEntities) {
        const [health] = components;
        if (health.data.current <= 0) {
          entity.active = false;
        }
      }

      // System 4: Update status effects (tick de dégâts)
      // Simulé comme une itération sur toutes les entités

      times.push(performance.now() - t0);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    results.push({
      name: 'ECS full system tick (20k entities)',
      group: 'wasm',
      scenario: 'fullTick',
      samples: 50,
      meanMs: avg,
      minMs: Math.min(...times),
      maxMs: Math.max(...times),
      unit: 'ms',
      iterations: 50,
    });
    if (verbose) console.log(`[BENCH] Full system tick (20k) : ${avg.toFixed(2)}ms`);
  }

  return results;
}

export async function runSuite(options = {}) {
  return await runBenchmark(options);
}

// Exécution directe
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  const { writeFileSync } = await import('fs');
  const results = await runSuite({ verbose: true });
  const outPath = process.argv[2] || 'bench-wasm.json';
  writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nRapport sauvegardé: ${outPath}`);
}
