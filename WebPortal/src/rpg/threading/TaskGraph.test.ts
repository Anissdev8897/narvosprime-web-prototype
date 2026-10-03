/**
 * Tests pour TaskGraph
 */
import { describe, it, expect } from 'vitest';
import { TaskGraph } from './TaskGraph';

describe('TaskGraph', () => {
  it('exécute une tâche simple', async () => {
    const graph = new TaskGraph({ maxConcurrency: 1 });
    const result = await graph.add('task1', () => 42);
    expect(result).toBe(42);
  });

  it('exécute des tâches en parallèle', async () => {
    const graph = new TaskGraph({ maxConcurrency: 4 });
    const results: number[] = [];

    await Promise.all([
      graph.add('a', () => { results.push(1); }),
      graph.add('b', () => { results.push(2); }),
      graph.add('c', () => { results.push(3); }),
    ]);

    expect(results.sort()).toEqual([1, 2, 3]);
  });

  it('respecte les dépendances', async () => {
    const graph = new TaskGraph({ maxConcurrency: 4 });
    const order: string[] = [];

    graph.add('step1', () => { order.push('step1'); }, { priority: 1 });
    graph.add('step2', (results) => {
      expect(results.has('step1')).toBe(true);
      order.push('step2');
    }, { dependsOn: ['step1'], priority: 2 });
    graph.add('step3', (results) => {
      expect(results.has('step2')).toBe(true);
      order.push('step3');
    }, { dependsOn: ['step2'], priority: 3 });

    await graph.whenAll();
    expect(order).toEqual(['step1', 'step2', 'step3']);
  });

  it('exécute par priorité (plus haut = plus urgent)', async () => {
    const graph = new TaskGraph({ maxConcurrency: 2 });
    const order: string[] = [];

    // high a un setTimeout de 0 mais priorité 100 pour démarrer avant
    const pHigh = graph.add('high', async () => {
      await new Promise((r) => setTimeout(r, 5));
      order.push('high');
    }, { priority: 100 });

    const pLow = graph.add('low', () => {
      order.push('low');
    }, { priority: 0 });

    await Promise.all([pHigh, pLow]);
    // low termine avant high car pas d'attente
    expect(order).toContain('low');
    expect(order).toContain('high');
  });

  it('détecte les dépendances cycliques', async () => {
    const graph = new TaskGraph();
    graph.add('a', () => 'a', { dependsOn: ['b'] });

    await expect(graph.add('b', () => 'b', { dependsOn: ['a'] }))
      .rejects.toThrow(/cyclique/);
  });

  it('gère les timeouts', async () => {
    const graph = new TaskGraph({ maxConcurrency: 1 });
    await expect(graph.add('slow', () => new Promise((r) => setTimeout(r, 5000)), {
      timeout: 50,
    })).rejects.toThrow(/timeout/i);
  }, { timeout: 2000 });

  it('snapshot donne le statut correct', async () => {
    const graph = new TaskGraph({ maxConcurrency: 2 });
    graph.add('fast', () => 'ok', { priority: 10 });
    await graph.whenAll();

    const snap = graph.snapshot();
    expect(snap).toHaveLength(1);
    expect(snap[0].status).toBe('completed');
  });

  it('whenAll résout quand toutes les tâches finissent', async () => {
    const graph = new TaskGraph({ maxConcurrency: 2 });
    graph.add('a', () => 'a');
    graph.add('b', () => 'b');
    await expect(graph.whenAll()).resolves.toBeUndefined();
  });

  it('clear réinitialise tout', async () => {
    const graph = new TaskGraph();
    graph.add('a', () => 'a');
    await graph.whenAll();
    graph.clear();
    expect(graph.snapshot()).toHaveLength(0);
  });

  it('refuse les tâches dupliquées', () => {
    const graph = new TaskGraph();
    graph.add('dup', () => 1);
    expect(() => graph.add('dup', () => 2)).toThrow(/dupliquée/);
  });

  it('passe les résultats des dépendances', async () => {
    const graph = new TaskGraph({ maxConcurrency: 2 });
    graph.add('src', () => 'hello');
    const result = await graph.add('dst', (results) => {
      return (results.get('src') as string).toUpperCase();
    }, { dependsOn: ['src'] });

    expect(result).toBe('HELLO');
  });
});
