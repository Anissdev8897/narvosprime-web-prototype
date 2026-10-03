/**
 * forge/graph/index.ts — Point d'entrée du module Forge Graph.
 */

export { ForgeGraphPanel, type ForgeGraphPanelProps } from './ForgeGraphPanel';

export {
  type ForgeNodeType,
  type ForgeNodeData,
  type ForgeNode,
  type ForgeEdge,
  type ForgeGraph,
  type GraphOutput,
  type Position3D,
  type Vector3,
  type SpawnInstruction,
  type ChunkInstruction,
  type ChunkMeta,
  type SurfaceSamplerParams,
  type StaticMeshSpawnerParams,
  type FilterByHeightParams,
  type FilterBySlopeParams,
  type RandomScatterParams,
  type OutputParams,
  type NodeCatalogueEntry,
  type ExecContext,
  NODE_CATALOGUE,
  uid,
  emptyGraph,
  isValidGraph,
} from './types';

export {
  surfaceSamplerExecutor,
  staticMeshSpawnerExecutor,
  filterByHeightExecutor,
  filterBySlopeExecutor,
  randomScatterExecutor,
  outputExecutor,
  getExecutor,
  listExecutorTypes,
  executeNode,
  type NodeExecutor,
  type NodeInput,
} from './nodes';

export {
  executeGraph,
  topoSort,
  graphToChunkInstructions,
  getFinalSpawns,
  countTotalSpawns,
} from './executor';
