/**
 * forge/graph/executor.ts — Exécution d'un graphe Forge complet.
 *
 * Parcourt le graphe dans l'ordre topologique (tri par dépendances),
 * exécute chaque nœud, propage les sorties vers les nœuds aval,
 * et consolide le résultat final en instructions pour puzzle-chunks.
 */

import type {
  ForgeGraph,
  ForgeNode,
  ForgeEdge,
  ForgeNodeData,
  ExecContext,
  GraphOutput,
  ChunkInstruction,
  ChunkMeta,
} from './types';

import { getExecutor } from './nodes';

// ── Topological sort ────────────────────────────────────────────────────────

/**
 * Trie les nœuds du graphe par ordre topologique (Kahn).
 * Les nœuds sans dépendances (sources) arrivent en premier.
 */
export function topoSort(nodes: ForgeNode[], edges: ForgeEdge[]): ForgeNode[] {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  // Initialise tous les nœuds
  for (const n of nodes) {
    inDegree.set(n.id, 0);
    adjacency.set(n.id, []);
  }

  // Construit le graphe orienté
  for (const e of edges) {
    const neighbors = adjacency.get(e.source);
    if (neighbors) {
      neighbors.push(e.target);
    }
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
  }

  // File des nœuds sans dépendance
  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: ForgeNode[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const node = nodes.find((n) => n.id === id);
    if (node) sorted.push(node);

    for (const neighbor of adjacency.get(id) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  // Détection de cycle : si tous les nœuds n'ont pas été triés, on retourne
  // simplement les nœuds dans l'ordre original (fallback safe).
  if (sorted.length !== nodes.length) {
    console.warn('[ForgeGraph] Cycle detected in graph — falling back to insertion order');
    return [...nodes];
  }

  return sorted;
}

// ── Exécution du graphe ────────────────────────────────────────────────────

/** Cache de résultats pour la propagation. */
type OutputCache = Map<string, GraphOutput>;

/**
 * Exécute un graphe Forge complet.
 *
 * @param graph   Le graphe à exécuter.
 * @param ctx     Contexte d'exécution (seed, itération).
 * @returns       Les sorties de tous les nœuds, indexées par id.
 */
export function executeGraph(
  graph: ForgeGraph,
  ctx: ExecContext = { seed: 42, iteration: 0 },
): Map<string, GraphOutput> {
  const sorted = topoSort(graph.nodes, graph.edges);
  const cache: OutputCache = new Map();

  // Construit une carte des prédécesseurs par nœud
  const predecessors = new Map<string, string[]>();
  for (const n of graph.nodes) {
    predecessors.set(n.id, []);
  }
  for (const e of graph.edges) {
    const preds = predecessors.get(e.target);
    if (preds) preds.push(e.source);
  }

  for (const node of sorted) {
    const executor = getExecutor(node.data.nodeType);
    if (!executor) {
      cache.set(node.id, { positions: [], normals: [], spawnInstructions: [] });
      continue;
    }

    // Rassemble les sorties des prédécesseurs
    const inputs: Record<string, GraphOutput | undefined> = {};
    const predIds = predecessors.get(node.id) ?? [];
    for (const predId of predIds) {
      const output = cache.get(predId);
      if (output) {
        // Détermine le type de connexion : positions, normals, ou spawns
        if (output.spawnInstructions.length > 0) {
          inputs['spawns'] = output;
        }
        if (output.positions.length > 0) {
          inputs['positions'] = output;
        }
        if (output.normals.length > 0) {
          inputs['normals'] = output;
        }
        // Fallback
        inputs['default'] = output;
      }
    }

    // Exécute le nœud en passant ses paramètres
    const result = executor.execute(inputs, ctx, node.data.params);
    cache.set(node.id, result);
  }

  return cache;
}

// ── Consolidation en instructions puzzle-chunks ────────────────────────────

/**
 * Convertit le résultat d'exécution du graphe en instructions pour
 * le pipeline puzzle-chunks.mjs.
 *
 * @param graph     Le graphe exécuté.
 * @param results   Les sorties de executeGraph().
 * @returns         Métadonnées des chunks incluant les instructions.
 */
export function graphToChunkInstructions(
  graph: ForgeGraph,
  results: Map<string, GraphOutput>,
): ChunkMeta[] {
  const allInstructions: ChunkInstruction[] = [];
  const modelRefs = new Set<string>();

  for (const node of graph.nodes) {
    const output = results.get(node.id);
    if (!output) continue;

    // Chaque nœud produit une instruction
    const instruction: ChunkInstruction = {
      type: mapNodeTypeToChunkType(node.data.nodeType),
      params: { ...node.data.params } as Record<string, unknown>,
      sourceNodeId: node.id,
    };

    // Enrichit avec les infos de spawn si présentes
    if (output.spawnInstructions.length > 0) {
      instruction.params.spawnCount = output.spawnInstructions.length;
      // Échantillonne les 5 premiers spawns pour l'aperçu
      instruction.params.sampleSpawns = output.spawnInstructions.slice(0, 5);
      // Collecte les chemins de modèles uniques
      for (const s of output.spawnInstructions) {
        if (s.model) modelRefs.add(s.model);
      }
    }

    if (output.positions.length > 0) {
      instruction.params.pointCount = output.positions.length;
    }

    allInstructions.push(instruction);
  }

  return [{
    index: 0,
    instructions: allInstructions,
    estimatedVertexCount: estimateVertexCount(allInstructions),
    modelRefs: [...modelRefs],
  }];
}

function mapNodeTypeToChunkType(nodeType: string): ChunkInstruction['type'] {
  switch (nodeType) {
    case 'surfaceSampler': return 'scatter';
    case 'staticMeshSpawner': return 'spawn';
    case 'filterByHeight': return 'filter_height';
    case 'filterBySlope': return 'filter_slope';
    case 'randomScatter': return 'scatter';
    case 'output': return 'output';
    default: return 'spawn';
  }
}

function estimateVertexCount(instructions: ChunkInstruction[]): number {
  let total = 0;
  for (const inst of instructions) {
    if (inst.type === 'spawn') {
      total += (inst.params.spawnCount as number ?? 0) * 100; // ~100 verts par spawn
    }
    if (inst.params.pointCount) {
      total += (inst.params.pointCount as number) * 10;
    }
  }
  return total;
}

// ── Output helpers ──────────────────────────────────────────────────────────

/** Récupère les spawn instructions consolidées du nœud Output. */
export function getFinalSpawns(
  results: Map<string, GraphOutput>,
): GraphOutput['spawnInstructions'] {
  // Cherche le nœud output
  for (const output of results.values()) {
    if (output.spawnInstructions.length > 0) {
      return output.spawnInstructions;
    }
  }
  return [];
}

/** Compte le nombre total de spawns dans le graphe. */
export function countTotalSpawns(results: Map<string, GraphOutput>): number {
  let total = 0;
  for (const output of results.values()) {
    total += output.spawnInstructions.length;
  }
  return total;
}
