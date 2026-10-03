// WebPortal/src/rpg/factions/factions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { relation, areEnemies, setRelation, FACTIONS } from './factions';
import { eventBus } from '../runtime/core/EventBus';

describe('factions', () => {
  beforeEach(() => {
    eventBus.clear();
    // remet la matrice par défaut (setRelation mute l'état global)
    setRelation('mezalayis', 'zayan', 'neutral');
  });

  it('matrice par défaut', () => {
    expect(areEnemies('akarlys', 'mezalayis')).toBe(true);
    expect(areEnemies('akarlys', 'zayan')).toBe(true);
    expect(relation('mezalayis', 'zayan')).toBe('neutral');
    expect(relation('akarlys', 'akarlys')).toBe('ally');
  });

  it('relation symétrique', () => {
    expect(relation('mezalayis', 'akarlys')).toBe('enemy');
  });

  it('setRelation met à jour ET émet faction:relationChanged', () => {
    const fn = vi.fn();
    eventBus.on('faction:relationChanged', fn);
    setRelation('mezalayis', 'zayan', 'enemy');
    expect(areEnemies('mezalayis', 'zayan')).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('FACTIONS contient les 3 factions avec couleur', () => {
    expect(Object.keys(FACTIONS).sort()).toEqual(['akarlys', 'mezalayis', 'zayan']);
    expect(FACTIONS.akarlys.color).toMatch(/^#/);
  });
});
