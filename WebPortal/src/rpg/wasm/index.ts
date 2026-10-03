export { loadNarvosEngine, getEngine, isEngineLoaded } from './WasmBridge';
export type { NarvosWasmModule, WasmWorldStats } from './WasmBridge';
export { wasmWorldCoordinator } from './WasmWorldCoordinator';
export {
  registerMeshCollider, wasmRaycastDown, wasmSegmentBlocked,
  wasmSegmentCastDistance, syncAllColliders, batchRegisterSceneColliders,
} from './PhysicsSync';
export { readAICommands, initAIBuffers, freeAIBuffers, AIAction } from './AICommandSync';
export type { AICommand } from './AICommandSync';

export {
  uploadSkeleton, uploadClip, createAnimGraph,
  updateAndApplyBones, destroyAnimGraph,
  addClipNode, addBlend1DEntry, finalizeBlend1D,
  setParamFloat, setParamBool, setRootNode,
} from './AnimationBridge';
export type { WasmSkeletonHandle } from './AnimationBridge';

export { initDamageBuffers, freeDamageBuffers, drainWasmDamageEvents } from './DamageEventSync';

export { pushEffectToWasm, pullEffectsFromWasm, isEntityRooted, isEntityStunned } from './StatusEffectSync';
export type { EntityNpcMap } from './StatusEffectSync';

export { useWasmWorld, useWasmAnimation } from './useWasmWorld';
export type { WasmWorldConfig, WasmAnimationConfig } from './useWasmWorld';

export { playerPositionStore } from './playerPositionStore';
export { wasmNpcBridge } from './WasmNpcBridge';
export { WasmWorldTicker } from './WasmWorldTicker';
export { useWasmNpcAI } from './useWasmNpcAI';

export {
  initStreaming, registerStreamingChunk,
  markChunkLoaded, markChunkUnloaded,
  tickStreaming, drainStreamingCommands,
  getStreamingStats, getStreamingFingerprint, clearStreaming,
  updateChunkRadius,
} from './ChunkStreamingBridge';
export type { StreamingCommand, ChunkMetadata } from './ChunkStreamingBridge';

export {
  initAssetBudget, setCategoryBudget,
  registerAsset, setAssetPosition,
  markAssetLoaded, markAssetUnloaded,
  tickAssetBudget, drainAssetCommands,
  getRecommendedTier, getAssetBudgetStats,
  clearAssetBudget, getAssetBudgetFingerprint,
} from './AssetBudgetBridge';
export { AssetCategory, QualityTier, AssetCommandType } from './AssetBudgetBridge';
export type { AssetCommand, AssetRegistration } from './AssetBudgetBridge';

export {
  initNavMesh, bakeNavMeshFromHeightmap,
  setNavCell, isNavWalkable, snapToNavMesh,
  requestPath, cancelPath, clearAllPaths,
  hasPath, isPathComplete, getNextWaypoint,
  readAllWaypoints, getNavMeshStats, clearNavMesh,
  freeNavBuffers,
} from './NavMeshBridge';
export type { NavMeshConfig, WaypointEntry } from './NavMeshBridge';

export { bakeNavMeshFromScene, clearBakedNavMesh } from './NavMeshBaker';
export type { BakeResult } from './NavMeshBaker';

export {
  initTriggerBuffers, freeTriggerBuffers,
  registerTriggerZone, removeTriggerZone, setTriggerZoneActive,
  drainTriggerEvents, getTriggerStats, clearTriggers,
  buildBVH, getBVHStats,
  registerDynamicCollider, updateDynamicCollider, removeDynamicCollider,
} from './TriggerBridge';
export { TriggerType } from './TriggerBridge';
export type { TriggerEvent, TriggerZoneConfig } from './TriggerBridge';
