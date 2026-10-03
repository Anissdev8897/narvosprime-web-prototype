// WebPortal/src/rpg/runtime/space/SpaceWarfareDirector.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpaceWarfareDirector } from './SpaceWarfareDirector';
import { worldEntities } from '../core/worldEntities';
import { eventBus } from '../core/EventBus';

describe('SpaceWarfareDirector', () => {
  beforeEach(() => { worldEntities.clear(); eventBus.clear(); });

  it('spawn shipsPerFaction × factions et émet ship:spawned', () => {
    const spawned = vi.fn(); eventBus.on('ship:spawned', spawned);
    const d = new SpaceWarfareDirector({ factions: ['akarlys', 'mezalayis'], shipsPerFaction: 3, arenaRadius: 100, respawnDelay: 2 });
    expect(d.fleetCount).toBe(6);
    expect(spawned).toHaveBeenCalledTimes(6);
    expect(worldEntities.all()).toHaveLength(6);
    d.dispose();
  });

  it('émet ship:destroyed quand un vaisseau meurt', () => {
    const destroyed = vi.fn(); eventBus.on('ship:destroyed', destroyed);
    const d = new SpaceWarfareDirector({ factions: ['akarlys', 'mezalayis'], shipsPerFaction: 1, arenaRadius: 50, respawnDelay: 99 });
    worldEntities.all()[0].applyDamage(99999);
    d.update(0.016);
    expect(destroyed).toHaveBeenCalledTimes(1);
    d.dispose();
  });
});
