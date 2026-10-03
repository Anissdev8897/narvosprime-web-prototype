// WebPortal/src/rpg/runtime/radar/projection.test.ts
import { describe, it, expect } from 'vitest';
import { worldToRadar } from './projection';

describe('worldToRadar', () => {
  it('origine monde (0,0) → centre du canvas', () => {
    const p = worldToRadar(0, 0, 220, 180);
    expect(p.x).toBe(90);
    expect(p.y).toBe(90);
    expect(p.inBounds).toBe(true);
  });

  it('bord positif X (radius, 0) → droite du canvas', () => {
    const p = worldToRadar(220, 0, 220, 180);
    expect(p.x).toBe(180);
    expect(p.y).toBe(90);
    expect(p.inBounds).toBe(true);
  });

  it('bord négatif Z (0, -radius) → haut du canvas', () => {
    const p = worldToRadar(0, -220, 220, 180);
    expect(p.x).toBe(90);
    expect(p.y).toBe(0);
    expect(p.inBounds).toBe(true);
  });

  it('au-delà de l\'arène → inBounds=false', () => {
    const p = worldToRadar(300, 0, 220, 180);
    expect(p.inBounds).toBe(false);
  });

  it('position arbitraire (110, 110) reste dans le cercle (hypot=155.6 < 220)', () => {
    const p = worldToRadar(110, 110, 220, 180);
    expect(p.x).toBe(135);
    expect(p.y).toBe(135);
    expect(p.inBounds).toBe(true);
  });
});
