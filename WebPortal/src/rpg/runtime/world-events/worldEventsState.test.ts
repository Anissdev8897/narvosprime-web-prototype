// WebPortal/src/rpg/runtime/world-events/worldEventsState.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { worldEventsState } from './worldEventsState';
import type { WorldEvents } from '../core/worldTypes';

// Helper : crée un payload valide avec pos + durationMs
function makePayload(overrides?: Partial<WorldEvents['world:eventStarted']>): WorldEvents['world:eventStarted'] {
  return {
    kind: 'convoy',
    title: 'Test convoy',
    color: '#c0d4e0',
    pos: new THREE.Vector3(10, 40, 20),
    durationMs: 20_000,
    ...overrides,
  };
}

describe('worldEventsState', () => {
  beforeEach(() => {
    worldEventsState.clear();
  });

  it('add puis active retourne 1 événement', () => {
    const now = 1000;
    worldEventsState.add(makePayload(), now);
    expect(worldEventsState.active(now + 100)).toHaveLength(1);
  });

  it('après la durée, active retourne 0 (purge)', () => {
    const now = 1000;
    worldEventsState.add(makePayload({ durationMs: 20_000 }), now);
    // Juste avant expiration : encore présent
    expect(worldEventsState.active(now + 19_999)).toHaveLength(1);
    // À l'expiration exacte : purgé (âge >= durationMs)
    expect(worldEventsState.active(now + 20_000)).toHaveLength(0);
  });

  it('clear() vide le registre', () => {
    worldEventsState.add(makePayload(), 0);
    worldEventsState.add(makePayload({ kind: 'anomaly', color: '#c084fc' }), 0);
    worldEventsState.clear();
    expect(worldEventsState.active(100)).toHaveLength(0);
  });

  it('add ignore un payload sans pos', () => {
    const payload = makePayload();
    delete (payload as Partial<typeof payload>).pos;
    worldEventsState.add(payload, 0);
    expect(worldEventsState.active(100)).toHaveLength(0);
  });

  it('add ignore un payload sans durationMs', () => {
    const payload = makePayload();
    delete (payload as Partial<typeof payload>).durationMs;
    worldEventsState.add(payload, 0);
    expect(worldEventsState.active(100)).toHaveLength(0);
  });

  it('plusieurs événements simultanés : seuls les actifs sont retournés', () => {
    const t0 = 0;
    worldEventsState.add(makePayload({ durationMs: 5_000 }), t0);       // expire à 5000
    worldEventsState.add(makePayload({ durationMs: 15_000 }), t0);      // expire à 15000
    worldEventsState.add(makePayload({ kind: 'anomaly', color: '#c084fc', durationMs: 25_000 }), t0); // expire à 25000

    expect(worldEventsState.active(4_999)).toHaveLength(3);
    expect(worldEventsState.active(5_001)).toHaveLength(2);
    expect(worldEventsState.active(15_001)).toHaveLength(1);
    expect(worldEventsState.active(25_001)).toHaveLength(0);
  });
});
