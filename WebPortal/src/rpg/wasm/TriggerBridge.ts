/**
 * TriggerBridge — pont TS pour les zones trigger WASM.
 * Register/remove zones, drain events enter/exit chaque frame.
 */
import { getEngine } from './WasmBridge';

export enum TriggerType {
  Generic  = 0,
  Damage   = 1,
  Heal     = 2,
  Teleport = 3,
  Quest    = 4,
}

export interface TriggerEvent {
  zoneEntity: number;
  occupantEntity: number;
  type: TriggerType;
  entered: boolean;
  value: number;
}

export interface TriggerZoneConfig {
  minX: number; minY: number; minZ: number;
  maxX: number; maxY: number; maxZ: number;
  type: TriggerType;
  value?: number;
}

const MAX_TRIGGER_EVENTS = 64;
const FLOATS_PER_EVENT = 8;
let _eventBufPtr = 0;
let _countPtr = 0;

export function initTriggerBuffers(): void {
  const engine = getEngine();
  if (!engine) return;
  if (_eventBufPtr) return;
  _eventBufPtr = engine._malloc(MAX_TRIGGER_EVENTS * FLOATS_PER_EVENT * 4);
  _countPtr = engine._malloc(4);
}

export function freeTriggerBuffers(): void {
  const engine = getEngine();
  if (!engine) return;
  if (_eventBufPtr) { engine._free(_eventBufPtr); _eventBufPtr = 0; }
  if (_countPtr) { engine._free(_countPtr); _countPtr = 0; }
}

export function registerTriggerZone(config: TriggerZoneConfig): number {
  const engine = getEngine();
  if (!engine) return -1;
  return engine.triggerRegisterZone(
    config.minX, config.minY, config.minZ,
    config.maxX, config.maxY, config.maxZ,
    config.type, config.value ?? 0,
  );
}

export function removeTriggerZone(zoneEntity: number): void {
  const engine = getEngine();
  if (!engine) return;
  engine.triggerRemoveZone(zoneEntity);
}

export function setTriggerZoneActive(zoneEntity: number, active: boolean): void {
  const engine = getEngine();
  if (!engine) return;
  engine.triggerSetActive(zoneEntity, active);
}

export function drainTriggerEvents(): TriggerEvent[] {
  const engine = getEngine();
  if (!engine || !_eventBufPtr) return [];

  engine.triggerDrainEvents(_eventBufPtr, _countPtr, MAX_TRIGGER_EVENTS);
  const count = engine.HEAPU32[_countPtr >> 2];
  if (count === 0) return [];

  const events: TriggerEvent[] = [];
  const base = _eventBufPtr >> 2;
  for (let i = 0; i < count; i++) {
    const off = base + i * FLOATS_PER_EVENT;
    const heap = engine.HEAPF32;
    events.push({
      zoneEntity: heap[off] | 0,
      occupantEntity: heap[off + 1] | 0,
      type: heap[off + 2] | 0,
      entered: (heap[off + 3] | 0) === 1,
      value: heap[off + 4],
    });
  }
  return events;
}

export function getTriggerStats(): { zoneCount: number; pendingEvents: number } {
  const engine = getEngine();
  if (!engine) return { zoneCount: 0, pendingEvents: 0 };
  return {
    zoneCount: engine.triggerZoneCount(),
    pendingEvents: engine.triggerPendingCount(),
  };
}

export function clearTriggers(): void {
  const engine = getEngine();
  if (!engine) return;
  engine.triggerClear();
}

// ── BVH helpers (exposés ici car liés à la physique étendue) ──

export function buildBVH(): void {
  const engine = getEngine();
  if (!engine) return;
  engine.buildBVH();
}

export function getBVHStats(): { nodeCount: number; built: boolean; dynamicCount: number } {
  const engine = getEngine();
  if (!engine) return { nodeCount: 0, built: false, dynamicCount: 0 };
  return {
    nodeCount: engine.bvhNodeCount(),
    built: engine.isBVHBuilt(),
    dynamicCount: engine.dynamicColliderCount(),
  };
}

export function registerDynamicCollider(
  entity: number,
  minX: number, minY: number, minZ: number,
  maxX: number, maxY: number, maxZ: number,
): void {
  const engine = getEngine();
  if (!engine) return;
  engine.registerDynamicCollider(entity, minX, minY, minZ, maxX, maxY, maxZ);
}

export function updateDynamicCollider(
  entity: number,
  posX: number, posY: number, posZ: number,
  scaleX: number, scaleY: number, scaleZ: number,
): void {
  const engine = getEngine();
  if (!engine) return;
  engine.updateDynamicCollider(entity, posX, posY, posZ, scaleX, scaleY, scaleZ);
}

export function removeDynamicCollider(entity: number): void {
  const engine = getEngine();
  if (!engine) return;
  engine.removeDynamicCollider(entity);
}
