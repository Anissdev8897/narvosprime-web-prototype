/**
 * DamageEventSync — draine les DamageEvents du ring buffer WASM
 * et les injecte dans le bus JS existant (damageEvents).
 *
 * Appelé chaque frame par useWasmWorld. Le WASM produit des events
 * via StatusEffects.Tick (burn DoT) et le combat IA ; le JS
 * les affiche via DamageNumbers.
 */
import { getEngine } from './WasmBridge';
import { damageEvents } from '../combat/damageEvents';
import type { DamageKind } from '../combat/damageEvents';

const MAX_DRAIN = 64;
const FLOATS_PER_EVENT = 5;

let bufferPtr = 0;
let countPtr = 0;

const KIND_MAP: DamageKind[] = ['hit', 'crit', 'player_hurt', 'heal'];

export function initDamageBuffers(): void {
  const engine = getEngine();
  if (!engine) return;
  bufferPtr = engine._malloc(MAX_DRAIN * FLOATS_PER_EVENT * 4);
  countPtr = engine._malloc(4);
}

export function freeDamageBuffers(): void {
  const engine = getEngine();
  if (!engine) return;
  if (bufferPtr) { engine._free(bufferPtr); bufferPtr = 0; }
  if (countPtr) { engine._free(countPtr); countPtr = 0; }
}

/**
 * Draine les events WASM et les forward vers le bus JS.
 * HOT PATH — appelé chaque frame.
 */
export function drainWasmDamageEvents(): void {
  const engine = getEngine();
  if (!engine || !bufferPtr) return;

  if (engine.pendingDamageCount() === 0) return;

  engine.drainDamageEvents(bufferPtr, countPtr, MAX_DRAIN);

  const count = engine.HEAPU32[countPtr >> 2];
  if (count === 0) return;

  const heap = engine.HEAPF32;
  const base = bufferPtr >> 2;

  for (let i = 0; i < count; i++) {
    const off = base + i * FLOATS_PER_EVENT;
    const kindIdx = (heap[off + 4] | 0);
    damageEvents.emit(
      heap[off + 0],
      heap[off + 1],
      heap[off + 2],
      heap[off + 3],
      KIND_MAP[kindIdx] ?? 'hit',
    );
  }
}
