// WebPortal/src/rpg/runtime/core/EventBus.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { eventBus } from './EventBus';

describe('EventBus', () => {
  beforeEach(() => eventBus.clear());

  it('appelle les handlers abonnés', () => {
    const fn = vi.fn();
    eventBus.on('ship:destroyed', fn);
    eventBus.emit('ship:destroyed', { id: 'a', faction: 'akarlys', pos: new THREE.Vector3() });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0][0].id).toBe('a');
  });

  it('la fonction de désabonnement retournée par on() coupe la réception', () => {
    const fn = vi.fn();
    const off = eventBus.on('ship:destroyed', fn);
    off();
    eventBus.emit('ship:destroyed', { id: 'b', faction: 'zayan', pos: new THREE.Vector3() });
    expect(fn).not.toHaveBeenCalled();
  });
});
