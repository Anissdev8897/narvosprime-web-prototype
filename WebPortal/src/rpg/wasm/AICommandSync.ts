/**
 * AICommandSync — lit les décisions de l'IA C++ depuis le buffer WASM
 * et les traduit en actions pour le runtime Three.js.
 */
import { getEngine } from './WasmBridge';

export const enum AIAction {
  None = 0,
  MoveTo = 1,
  Attack = 2,
  FindCover = 3,
  Retreat = 4,
  Die = 5,
}

export interface AICommand {
  entity: number;
  action: AIAction;
  targetX: number;
  targetY: number;
  targetZ: number;
  targetEntity: number;
  yaw: number;
}

const MAX_COMMANDS = 256;
const FLOATS_PER_COMMAND = 7;
let commandBufferPtr = 0;
let countPtr = 0;

export function initAIBuffers(): void {
  const engine = getEngine();
  if (!engine) return;

  commandBufferPtr = engine._malloc(MAX_COMMANDS * FLOATS_PER_COMMAND * 4);
  countPtr = engine._malloc(4);
}

export function freeAIBuffers(): void {
  const engine = getEngine();
  if (!engine) return;

  if (commandBufferPtr) { engine._free(commandBufferPtr); commandBufferPtr = 0; }
  if (countPtr) { engine._free(countPtr); countPtr = 0; }
}

export function readAICommands(): AICommand[] {
  const engine = getEngine();
  if (!engine || !commandBufferPtr) return [];

  // Appel C++ : AISystem::WriteCommands(buffer, &count, maxCommands)
  // Bindé désormais dans Bindings.cpp — le buffer est rempli par le WASM.
  engine.aiWriteCommands(commandBufferPtr, countPtr, MAX_COMMANDS);

  const commands: AICommand[] = [];
  const heap = engine.HEAPF32;
  const heapU = engine.HEAPU32;

  if (!heap || !heapU) return commands;

  const count = heapU[countPtr >> 2];
  const baseIdx = commandBufferPtr >> 2;

  for (let i = 0; i < count && i < MAX_COMMANDS; i++) {
    const off = baseIdx + i * FLOATS_PER_COMMAND;
    commands.push({
      entity: heap[off + 0] | 0,
      action: heap[off + 1] | 0,
      targetX: heap[off + 2],
      targetY: heap[off + 3],
      targetZ: heap[off + 4],
      targetEntity: heap[off + 5] | 0,
      yaw: heap[off + 6],
    });
  }

  return commands;
}
