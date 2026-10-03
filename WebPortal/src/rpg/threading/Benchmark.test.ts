/**
 * Tests pour Benchmark
 */
import { describe, it, expect } from 'vitest';
import {
  FpsBenchmark,
  ChunkLoadBenchmark,
  traceMainThread,
  clearPerformanceMeasures,
} from './Benchmark';

describe('FpsBenchmark', () => {
  it('stop retourne FpsStats même sans échantillons', () => {
    const bench = new FpsBenchmark();
    const stats = bench.stop();
    expect(stats.samples).toBe(0);
    expect(stats.fps).toBe(0);
  });

  it('collecte via onFrame callback (simulation)', async () => {
    const frames: number[] = [];
    const bench = new FpsBenchmark((fps) => frames.push(fps));
    // En environnement node, on ne peut pas utiliser rAF.
    // Le benchmark s'utilise in-browser.
    expect(bench.isRunning).toBe(false);
  });

  it('isRunning reflète l état (sans rAF)', () => {
    const bench = new FpsBenchmark();
    expect(bench.isRunning).toBe(false);
  });
});

describe('ChunkLoadBenchmark', () => {
  it('mesure les temps de chargement', async () => {
    const bench = new ChunkLoadBenchmark();
    const m = await bench.measureLoad('test', async () => ({
      loadMs: 100,
      fetchMs: 80,
    }));
    expect(m.label).toBe('test');
    expect(m.totalMs).toBe(100);
    expect(m.fetchMs).toBe(80);
    expect(m.parseMs).toBe(20);
  });

  it('génère un rapport', async () => {
    const bench = new ChunkLoadBenchmark();
    await bench.measureLoad('avec-worker', async () => ({ loadMs: 50, fetchMs: 30 }), true);
    await bench.measureLoad('sans-worker', async () => ({ loadMs: 120, fetchMs: 80 }), false);
    const report = bench.report();
    expect(report).toContain('Avec worker');
    expect(report).toContain('Sans worker');
    expect(report).toContain('Gain');
  });

  it('clear réinitialise les mesures', () => {
    const bench = new ChunkLoadBenchmark();
    bench.measureLoad('a', async () => ({ loadMs: 1, fetchMs: 1 }));
    bench.clear();
    expect(bench.report()).toContain('Aucune mesure');
  });

  it('toJSON exporte les données', async () => {
    const bench = new ChunkLoadBenchmark();
    await bench.measureLoad('test', async () => ({ loadMs: 42, fetchMs: 20 }));
    const json = bench.toJSON();
    expect(json.title).toBe('Chunk Benchmark');
    expect(json.measurements).toHaveLength(1);
    expect(json.measurements[0].totalMs).toBe(42);
  });
});

describe('traceMainThread', () => {
  it('mesure le temps d exécution', () => {
    clearPerformanceMeasures();
    const end = traceMainThread('test-op');
    // Opération simulée
    let x = 0;
    for (let i = 0; i < 1000; i++) x += i;
    end();

    const measures = performance.getEntriesByType('measure');
    const ours = measures.find((m) => m.name === 'test-op');
    expect(ours).toBeDefined();
    expect(ours!.duration).toBeGreaterThanOrEqual(0);
  });
});
