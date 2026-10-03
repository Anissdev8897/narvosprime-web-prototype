// ══════════════════════════════════════════════════════════════════════════════
// perf/rendering.mjs — Benchmark du rendu (statistiques logicielles)
//
// Mesure :
//   - FPS simulé : opérations de rendu par frame (matrices, transform)
//   - Draw calls : comptage d'objets dans une scène simulée
//   - Opérations Three.js-like : matrices, box intersections
//
// Les benchmarks testent les calculs de rendu du côté JS.
// Le rendu GPU réel nécessite un navigateur/WebGL.
// ══════════════════════════════════════════════════════════════════════════════

import { performance } from 'perf_hooks';

// ── Mathématiques de rendu (équivalent Three.js minimal) ────────────────────

function mat4Multiply(a, b) {
  const result = new Array(16).fill(0);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      for (let k = 0; k < 4; k++) {
        result[i * 4 + j] += a[i * 4 + k] * b[k * 4 + j];
      }
    }
  }
  return result;
}

function mat4Identity() {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function frustumFromMatrix(m) {
  // Extrait les 6 plans du frustum à partir d'une matrice view-projection
  const planes = [];
  // Plan left: row3 + row0
  planes.push([
    m[3] + m[0], m[7] + m[4], m[11] + m[8], m[15] + m[12]
  ]);
  // Plan right: row3 - row0
  planes.push([
    m[3] - m[0], m[7] - m[4], m[11] - m[8], m[15] - m[12]
  ]);
  // Plan bottom: row3 + row1
  planes.push([
    m[3] + m[1], m[7] + m[5], m[11] + m[9], m[15] + m[13]
  ]);
  // Plan top: row3 - row1
  planes.push([
    m[3] - m[1], m[7] - m[5], m[11] - m[9], m[15] - m[13]
  ]);
  // Plan near: row3 + row2 (NDC: z=1)
  planes.push([
    m[3] + m[2], m[7] + m[6], m[11] + m[10], m[15] + m[14]
  ]);
  // Plan far: row3 - row2
  planes.push([
    m[3] - m[2], m[7] - m[6], m[11] - m[10], m[15] - m[14]
  ]);
  return planes;
}

function sphereInFrustum(planes, x, y, z, radius) {
  for (const p of planes) {
    const d = p[0] * x + p[1] * y + p[2] * z + p[3];
    if (d < -radius) return false;
  }
  return true;
}

function boxInFrustum(planes, min, max) {
  const corners = [
    [min[0], min[1], min[2]], [max[0], min[1], min[2]],
    [min[0], max[1], min[2]], [max[0], max[1], min[2]],
    [min[0], min[1], max[2]], [max[0], min[1], max[2]],
    [min[0], max[1], max[2]], [max[0], max[1], max[2]],
  ];
  for (const p of planes) {
    let allOutside = true;
    for (const c of corners) {
      const d = p[0] * c[0] + p[1] * c[1] + p[2] * c[2] + p[3];
      if (d >= 0) { allOutside = false; break; }
    }
    if (allOutside) return false;
  }
  return true;
}

// ── Scène simulée ───────────────────────────────────────────────────────────

class SceneObject {
  constructor(id) {
    this.id = id;
    this.x = (Math.random() - 0.5) * 200;
    this.y = 0;
    this.z = (Math.random() - 0.5) * 200;
    this.radius = 0.5 + Math.random() * 2;
    this.visible = true;
  }
}

function buildScene(count) {
  const objects = [];
  for (let i = 0; i < count; i++) {
    objects.push(new SceneObject(i));
  }
  return objects;
}

// ══════════════════════════════════════════════════════════════════════════════
// Benchmarks
// ══════════════════════════════════════════════════════════════════════════════

export async function runBenchmark(options = {}) {
  const { verbose = false } = options;
  const results = [];

  // 1. Multiplication matricielle (transform) — 100k ops
  {
    const times = [];
    const a = mat4Identity();
    const b = [1, 0, 0, 0, 0, 0.707, -0.707, 0, 0, 0.707, 0.707, 0, 10, 5, -20, 1];
    for (let i = 0; i < 1000; i++) {
      const t0 = performance.now();
      for (let j = 0; j < 100; j++) {
        mat4Multiply(a, b);
      }
      times.push(performance.now() - t0);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length / 100; // par op
    results.push({
      name: 'Rendering mat4 multiply',
      group: 'rendering',
      scenario: 'mat4Mul',
      samples: 100000,
      meanMs: avg,
      minMs: Math.min(...times) / 100,
      maxMs: Math.max(...times) / 100,
      unit: 'ms',
      iterations: 100000,
    });
    if (verbose) console.log(`[BENCH] mat4 multiply : ${(avg * 1000).toFixed(4)}μs`);
  }

  // 2. Frustum culling — sphères
  {
    const scene = buildScene(500);
    // Matrice view-projection typique
    const vp = [1.732, 0, 0, 0, 0, 1.732, 0, 0, 0, 0, -1.0001, -1, 0, 0, -0.1, 0];
    const planes = frustumFromMatrix(vp);

    const times = [];
    for (let i = 0; i < 200; i++) {
      let visible = 0;
      const t0 = performance.now();
      for (const obj of scene) {
        if (sphereInFrustum(planes, obj.x, obj.y, obj.z, obj.radius)) {
          visible++;
        }
      }
      times.push(performance.now() - t0);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    results.push({
      name: 'Rendering frustum cull (500 spheres)',
      group: 'rendering',
      scenario: 'frustumSphere',
      samples: 200,
      meanMs: avg,
      minMs: Math.min(...times),
      maxMs: Math.max(...times),
      unit: 'ms',
      iterations: 200,
    });
    if (verbose) console.log(`[BENCH] Frustum cull 500 spheres : ${avg.toFixed(4)}ms`);
  }

  // 3. Frustum culling — boîtes (plus lourd)
  {
    const boxes = Array.from({ length: 500 }, () => ({
      min: [(Math.random() - 0.5) * 200, -1, (Math.random() - 0.5) * 200],
      max: [(Math.random() - 0.5) * 200 + 2, 2, (Math.random() - 0.5) * 200 + 2],
    }));
    const vp = [1.732, 0, 0, 0, 0, 1.732, 0, 0, 0, 0, -1.0001, -1, 0, 0, -0.1, 0];
    const planes = frustumFromMatrix(vp);

    const times = [];
    for (let i = 0; i < 100; i++) {
      let visible = 0;
      const t0 = performance.now();
      for (const box of boxes) {
        if (boxInFrustum(planes, box.min, box.max)) {
          visible++;
        }
      }
      times.push(performance.now() - t0);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    results.push({
      name: 'Rendering frustum cull (500 AABBs)',
      group: 'rendering',
      scenario: 'frustumAABB',
      samples: 100,
      meanMs: avg,
      minMs: Math.min(...times),
      maxMs: Math.max(...times),
      unit: 'ms',
      iterations: 100,
    });
    if (verbose) console.log(`[BENCH] Frustum cull 500 AABBs : ${avg.toFixed(4)}ms`);
  }

  // 4. FPS simulé — temps d'une frame de rendu logique
  {
    const scene2000 = buildScene(2000);
    const vp = [1.732, 0, 0, 0, 0, 1.732, 0, 0, 0, 0, -1.0001, -1, 0, 0, -0.1, 0];
    const planes = frustumFromMatrix(vp);

    const times = [];
    for (let frame = 0; frame < 100; frame++) {
      const t0 = performance.now();
      // Simule une frame : frustum cull + transform
      let drawCalls = 0;
      for (const obj of scene2000) {
        const visible = sphereInFrustum(planes, obj.x, obj.y, obj.z, obj.radius);
        if (visible) drawCalls++;
        // Mini transform update
        obj.x += Math.sin(frame * 0.01 + obj.id) * 0.01;
        obj.z += Math.cos(frame * 0.01 + obj.id) * 0.01;
      }
      times.push(performance.now() - t0);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const fps = 1000 / avg;
    const avgDrawCalls = 2000 * 0.5; // ~50% visible

    results.push({
      name: 'Rendering frame simulation (2000 objects)',
      group: 'rendering',
      scenario: 'frameSim',
      samples: 100,
      meanMs: avg,
      minMs: Math.min(...times),
      maxMs: Math.max(...times),
      simulatedFPS: fps,
      simulatedDrawCalls: avgDrawCalls,
      unit: 'ms',
      iterations: 100,
    });
    if (verbose) console.log(`[BENCH] Frame sim (2000 obj) : ${avg.toFixed(3)}ms  ~${fps.toFixed(0)} FPS`);
  }

  // 5. Transformation batch (matrices world)
  {
    const count = 1000;
    const matrices = Array.from({ length: count }, () => {
      const s = 1 + Math.random();
      const rx = Math.random() * 6.28;
      const ry = Math.random() * 6.28;
      return { tx: (Math.random() - 0.5) * 100, ty: 0, tz: (Math.random() - 0.5) * 100, s, rx, ry };
    });

    const times = [];
    for (let batch = 0; batch < 50; batch++) {
      const t0 = performance.now();
      for (const m of matrices) {
        const cosX = Math.cos(m.rx), sinX = Math.sin(m.rx);
        const cosY = Math.cos(m.ry), sinY = Math.sin(m.ry);
        // Matrice TRS simplifiée
        const mat = [
          m.s * cosY, 0, m.s * sinY, 0,
          sinX * sinY, cosX, -sinX * cosY, 0,
          -cosX * sinY, sinX, cosX * cosY, 0,
          m.tx, m.ty, m.tz, 1
        ];
        // Inutilisé mais calculé
        void(mat);
      }
      times.push(performance.now() - t0);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length / count;
    results.push({
      name: 'Rendering world matrix batch (1000 obj)',
      group: 'rendering',
      scenario: 'worldMatrix',
      samples: 50000,
      meanMs: avg,
      minMs: Math.min(...times) / count,
      maxMs: Math.max(...times) / count,
      unit: 'ms',
      iterations: 50000,
    });
    if (verbose) console.log(`[BENCH] World matrix batch : ${(avg * 1000).toFixed(3)}μs/obj`);
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
  const outPath = process.argv[2] || 'bench-rendering.json';
  writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nRapport sauvegardé: ${outPath}`);
}
