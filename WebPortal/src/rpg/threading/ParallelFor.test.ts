/**
 * Tests pour ParallelFor
 */
import { describe, it, expect } from 'vitest';
import { ParallelFor } from './ParallelFor';

describe('ParallelFor', () => {
  it('each exécute la fonction sur chaque élément', async () => {
    const items: number[] = [];
    await ParallelFor.each([1, 2, 3, 4, 5], (x) => { items.push(x); }, { strategy: 'sync' });
    expect(items.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('each sur tableau vide', async () => {
    await ParallelFor.each([], () => { throw new Error('should not run'); });
    expect(true).toBe(true);
  });

  it('map transforme chaque élément', async () => {
    const result = await ParallelFor.map([1, 2, 3, 4, 5], (x) => x * 2, { strategy: 'sync' });
    expect(result).toEqual([2, 4, 6, 8, 10]);
  });

  it('map avec stratégie sync', async () => {
    const result = await ParallelFor.map([1, 2, 3], (x) => x + 1, { strategy: 'sync' });
    expect(result).toEqual([2, 3, 4]);
  });

  it('reduce en parallèle', async () => {
    const result = await ParallelFor.reduce(
      [1, 2, 3, 4, 5],
      (acc, x) => acc + x,
      0,
      { strategy: 'sync' },
    );
    expect(result).toBe(15);
  });

  it('reduce sur tableau vide', async () => {
    const result = await ParallelFor.reduce([], (acc: number, x: number) => acc + x, 42);
    expect(result).toBe(42);
  });

  it('eachSync synchrone', () => {
    const items: number[] = [];
    ParallelFor.eachSync([1, 2, 3], (x) => { items.push(x); });
    expect(items).toEqual([1, 2, 3]);
  });

  it('gère les promesses dans les callbacks', async () => {
    const result = await ParallelFor.map([1, 2, 3], async (x) => {
      await new Promise((r) => setTimeout(r, 5));
      return x * 10;
    }, { strategy: 'sync' });
    expect(result).toEqual([10, 20, 30]);
  });

  it('gère de grands tableaux', async () => {
    const size = 1000;
    const input = Array.from({ length: size }, (_, i) => i);
    const result = await ParallelFor.map(input, (x) => x * 2, { strategy: 'sync' });
    expect(result).toHaveLength(size);
    expect(result[0]).toBe(0);
    expect(result[size - 1]).toBe((size - 1) * 2);
  });
});
