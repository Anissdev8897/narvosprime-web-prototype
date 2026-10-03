/**
 * ChunkStreamingBridge — pont TS pour le streaming de chunks piloté par WASM.
 *
 * Le C++ (ChunkStreamingManager) prend les décisions de chargement/déchargement
 * basées sur la distance joueur ↔ chunk et le budget VRAM.
 * Ce bridge lit les commandes et les expose au runtime (StreamingPuzzleMap).
 */
import { getEngine } from './WasmBridge';

export const enum StreamCommandType {
  Load   = 0,
  Unload = 1,
}

export interface StreamingCommand {
  type: StreamCommandType;
  chunkId: number;
}

export interface ChunkMetadata {
  id: number;
  center: [number, number, number];
  radius: number;
  estimatedMB: number;
}

const MAX_COMMANDS_PER_DRAIN = 32;
const STRIDE_U32 = 2; // [type, chunkId] par commande

let cmdBufferPtr = 0;

function ensureBuffer(): boolean {
  const engine = getEngine();
  if (!engine) return false;
  // Garde : si le build Emscripten n'exporte pas _malloc (EXPORTED_FUNCTIONS
  // manquant), on refuse proprement au lieu de crasher chaque frame.
  if (typeof engine._malloc !== "function") return false;
  if (cmdBufferPtr === 0) {
    cmdBufferPtr = engine._malloc(MAX_COMMANDS_PER_DRAIN * STRIDE_U32 * 4);
  }
  return true;
}

/** Initialise le streaming manager côté WASM. */
export function initStreaming(
  budgetMB: number,
  maxLoaded: number,
  loadRadius: number,
  unloadRadius: number,
): void {
  const engine = getEngine();
  if (!engine) return;
  engine.streamingInit(budgetMB, maxLoaded, loadRadius, unloadRadius);
}

/** Enregistre un chunk (métadonnées spatiales) dans le manager WASM. */
export function registerStreamingChunk(meta: ChunkMetadata): void {
  const engine = getEngine();
  if (!engine) return;
  engine.streamingRegisterChunk(
    meta.id,
    meta.center[0], meta.center[1], meta.center[2],
    meta.radius,
    meta.estimatedMB,
  );
}

/** Confirme au WASM qu'un chunk a fini de charger (compteur VRAM). */
export function markChunkLoaded(chunkId: number): void {
  const engine = getEngine();
  if (!engine) return;
  engine.streamingMarkLoaded(chunkId);
}

/** Confirme au WASM qu'un chunk a été déchargé. */
export function markChunkUnloaded(chunkId: number): void {
  const engine = getEngine();
  if (!engine) return;
  engine.streamingMarkUnloaded(chunkId);
}

/** Met à jour le rayon d'un chunk déjà enregistré.
 *  Utilisé après chargement pour corriger le rayon issu des métadonnées
 *  (qui incluent les coques enveloppantes → rayon gonflé à 30k+ unités
 *  sur l'orbitale) avec la vraie sphère englobante (coques exclues). */
export function updateChunkRadius(chunkId: number, newRadius: number): void {
  const engine = getEngine();
  if (!engine) return;
  engine.streamingUpdateChunkRadius(chunkId, newRadius);
}

/** Tick : donne la position joueur au WASM, qui décide load/unload. */
export function tickStreaming(px: number, py: number, pz: number): void {
  const engine = getEngine();
  if (!engine) return;
  engine.streamingTick(px, py, pz);
}

/** Draine les commandes load/unload générées par le dernier tick. */
export function drainStreamingCommands(): StreamingCommand[] {
  const engine = getEngine();
  if (!engine || !ensureBuffer()) return [];

  const count = engine.streamingDrainCommands(cmdBufferPtr, MAX_COMMANDS_PER_DRAIN);
  if (count === 0) return [];

  // Relire HEAPU32 APRÈS le drain (memory growth possible)
  const heap = engine.HEAPU32;
  const base = cmdBufferPtr >> 2;
  const cmds: StreamingCommand[] = [];
  for (let i = 0; i < count; i++) {
    cmds.push({
      type: heap[base + i * STRIDE_U32 + 0] as StreamCommandType,
      chunkId: heap[base + i * STRIDE_U32 + 1],
    });
  }
  return cmds;
}

/** Stats de streaming exposées pour le HUD debug. */
export function getStreamingStats(): {
  budgetUsedMB: number;
  loadedCount: number;
  chunkCount: number;
  pendingCount: number;
} {
  const engine = getEngine();
  if (!engine) {
    return { budgetUsedMB: 0, loadedCount: 0, chunkCount: 0, pendingCount: 0 };
  }
  return {
    budgetUsedMB: engine.streamingBudgetUsedMB(),
    loadedCount: engine.streamingLoadedCount(),
    chunkCount: engine.streamingChunkCount(),
    pendingCount: engine.streamingPendingCount(),
  };
}

/** Empreinte des métadonnées chunk enregistrées.
 *  Change quand les chunks sont re-générés (tailles différentes). */
export function getStreamingFingerprint(): number {
  const engine = getEngine();
  if (!engine) return 0;
  return engine.streamingCacheFingerprint();
}

/** Libère le buffer et reset le manager. */
export function clearStreaming(): void {
  const engine = getEngine();
  if (engine) {
    engine.streamingClear();
    if (cmdBufferPtr !== 0) {
      engine._free(cmdBufferPtr);
      cmdBufferPtr = 0;
    }
  }
}
