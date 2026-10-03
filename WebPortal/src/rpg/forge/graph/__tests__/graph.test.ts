/**
 * forge/graph/__tests__/graph.test.ts — Tests unitaires du Forge Graph.
 */

import { describe, it, expect } from 'vitest';
import {
  emptyGraph,
  isValidGraph,
  uid,
  NODE_CATALOGUE,
} from '../types';

import {
  topoSort,
  executeGraph,
  graphToChunkInstructions,
  countTotalSpawns,
} from '../executor';

import {
  surfaceSamplerExecutor,
  staticMeshSpawnerExecutor,
  filterByHeightExecutor,
  filterBySlopeExecutor,
  randomScatterExecutor,
  outputExecutor,
  executeNode,
  type NodeInput,
} from '../nodes';

import type {
  ForgeNode,
  ForgeEdge,
  ForgeGraph,
  ForgeNodeData,
  ExecContext,
  GraphOutput,
} from '../types';

// ── Fixtures ────────────────────────────────────────────────────────────────

const DEFAULT_CTX: ExecContext = { seed: 42, iteration: 0 };

function makeNode(
  id: string,
  nodeType: ForgeNodeData['nodeType'],
  params: Record<string, unknown> = {},
  label?: string,
): ForgeNode {
  const entry = NODE_CATALOGUE.find((e) => e.type === nodeType);
  return {
    id,
    type: 'forgeNode',
    position: { x: 0, y: 0 },
    data: {
      label: label ?? entry?.label ?? nodeType,
      nodeType,
      params: { ...entry?.defaultParams, ...params } as Record<string, unknown>,
    },
  };
}

function makeEdge(id: string, source: string, target: string): ForgeEdge {
  return { id, source, target };
}

// ── Types ───────────────────────────────────────────────────────────────────

describe('types', () => {
  it('emptyGraph produit un graphe vide', () => {
    const g = emptyGraph();
    expect(g.nodes).toEqual([]);
    expect(g.edges).toEqual([]);
  });

  it('isValidGraph valide un graphe correct', () => {
    const g: ForgeGraph = {
      nodes: [makeNode('a', 'surfaceSampler')],
      edges: [],
    };
    expect(isValidGraph(g)).toBe(true);
  });

  it('isValidGraph rejette un null/undefined', () => {
    expect(isValidGraph(null)).toBe(false);
    expect(isValidGraph(undefined)).toBe(false);
  });

  it('isValidGraph rejette un objet non-array', () => {
    expect(isValidGraph({})).toBe(false);
  });

  it('uid génère des IDs uniques', () => {
    const a = uid();
    const b = uid();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^node_/);
  });

  it('NODE_CATALOGUE contient tous les types', () => {
    const types = NODE_CATALOGUE.map((e) => e.type).sort();
    expect(types).toEqual([
      'filterByHeight',
      'filterBySlope',
      'output',
      'randomScatter',
      'staticMeshSpawner',
      'surfaceSampler',
    ]);
  });
});

// ── Topological sort ────────────────────────────────────────────────────────

describe('topoSort', () => {
  it('tri simple à 2 nœuds', () => {
    const nodes = [
      makeNode('a', 'surfaceSampler'),
      makeNode('b', 'staticMeshSpawner'),
    ];
    const edges = [makeEdge('e1', 'a', 'b')];
    const sorted = topoSort(nodes, edges);
    expect(sorted[0].id).toBe('a');
    expect(sorted[1].id).toBe('b');
  });

  it('tri linéaire à 3 nœuds', () => {
    const nodes = [
      makeNode('a', 'surfaceSampler'),
      makeNode('b', 'filterByHeight'),
      makeNode('c', 'staticMeshSpawner'),
    ];
    const edges = [
      makeEdge('e1', 'a', 'b'),
      makeEdge('e2', 'b', 'c'),
    ];
    const sorted = topoSort(nodes, edges);
    expect(sorted.map((n) => n.id)).toEqual(['a', 'b', 'c']);
  });

  it('tri avec branchement (2 prédécesseurs)', () => {
    const nodes = [
      makeNode('a', 'surfaceSampler'),
      makeNode('b', 'randomScatter'),
      makeNode('c', 'staticMeshSpawner'),
    ];
    const edges = [
      makeEdge('e1', 'a', 'c'),
      makeEdge('e2', 'b', 'c'),
    ];
    // a et b n'ont pas de dépendances entre eux → ordre indéterminé
    const sorted = topoSort(nodes, edges);
    expect(sorted.length).toBe(3);
    expect(sorted[2].id).toBe('c'); // c est dernier (dépend de a et b)
  });

  it('détecte un cycle et utilise l\'ordre d\'insertion', () => {
    const nodes = [
      makeNode('a', 'surfaceSampler'),
      makeNode('b', 'filterByHeight'),
    ];
    const edges = [
      makeEdge('e1', 'a', 'b'),
      makeEdge('e2', 'b', 'a'), // cycle
    ];
    // Doit retourner l'ordre d'insertion (fallback safe)
    const sorted = topoSort(nodes, edges);
    expect(sorted.length).toBe(2);
  });

  it('tri nœud unique sans arêtes', () => {
    const nodes = [makeNode('a', 'output')];
    const sorted = topoSort(nodes, []);
    expect(sorted.length).toBe(1);
    expect(sorted[0].id).toBe('a');
  });
});

// ── Exécuteurs individuels ──────────────────────────────────────────────────

describe('surfaceSampler', () => {
  it('génère des positions pour une densité donnée', () => {
    const data: ForgeNodeData = {
      label: 'Surface Sampler',
      nodeType: 'surfaceSampler',
      params: { density: 0.1, seed: 42 },
    };
    const result = executeNode(data, {}, DEFAULT_CTX);
    expect(result.positions.length).toBeGreaterThan(0);
    expect(result.normals.length).toBe(result.positions.length);
    expect(result.spawnInstructions).toEqual([]);
  });

  it('des seeds différents produisent des positions différentes', () => {
    const data: ForgeNodeData = {
      label: 'Surface Sampler',
      nodeType: 'surfaceSampler',
      params: { density: 1 },  // pas de seed fixe → utilise ctx.seed
    };
    const r1 = executeNode(data, {}, { ...DEFAULT_CTX, seed: 1 });
    const r2 = executeNode(data, {}, { ...DEFAULT_CTX, seed: 2 });
    // Au moins une position différente (grille avec jitter seed-dépendant)
    const same = r1.positions.every(
      (p, i) => p.x === r2.positions[i]?.x && p.y === r2.positions[i]?.y && p.z === r2.positions[i]?.z,
    );
    expect(same).toBe(false);
  });
});

describe('staticMeshSpawner', () => {
  it('produit des spawns à partir de positions entrantes', () => {
    const input: GraphOutput = {
      positions: [{ x: 0, y: 0, z: 0 }, { x: 10, y: 5, z: 10 }],
      normals: [],
      spawnInstructions: [],
    };
    const data: ForgeNodeData = {
      label: 'Spawner',
      nodeType: 'staticMeshSpawner',
      params: { model: 'tree.glb', scaleMin: 1, scaleMax: 1, rotYRandom: false },
    };
    const result = executeNode(data, { default: input }, DEFAULT_CTX);
    expect(result.spawnInstructions.length).toBe(2);
    expect(result.spawnInstructions[0].model).toBe('tree.glb');
    expect(result.spawnInstructions[0].position).toEqual([0, 0, 0]);
    expect(result.spawnInstructions[1].position).toEqual([10, 5, 10]);
  });

  it('retourne [] si aucune position en entrée', () => {
    const data: ForgeNodeData = {
      label: 'Spawner',
      nodeType: 'staticMeshSpawner',
      params: { model: 'tree.glb' },
    };
    const result = executeNode(data, {}, DEFAULT_CTX);
    expect(result.spawnInstructions).toEqual([]);
  });
});

describe('filterByHeight', () => {
  it('conserve les positions dans la plage', () => {
    const input: GraphOutput = {
      positions: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 5, z: 1 }, { x: 2, y: 15, z: 2 }],
      normals: [],
      spawnInstructions: [],
    };
    const data: ForgeNodeData = {
      label: 'Filter Y',
      nodeType: 'filterByHeight',
      params: { minHeight: 2, maxHeight: 10 },
    };
    const result = executeNode(data, { default: input }, DEFAULT_CTX);
    expect(result.positions.length).toBe(1);
    expect(result.positions[0].y).toBe(5);
  });

  it('conserve tout si min=-Infinity, max=Infinity', () => {
    const input: GraphOutput = {
      positions: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 100, z: 1 }],
      normals: [],
      spawnInstructions: [],
    };
    const data: ForgeNodeData = {
      label: 'Filter Y',
      nodeType: 'filterByHeight',
      params: { minHeight: -Infinity, maxHeight: Infinity },
    };
    const result = executeNode(data, { default: input }, DEFAULT_CTX);
    expect(result.positions.length).toBe(2);
  });
});

describe('filterBySlope', () => {
  it('conserve les positions avec pente dans la plage', () => {
    const input: GraphOutput = {
      positions: [
        { x: 0, y: 0, z: 0 },  // pente 0° (normale = 0,1,0) → conservé
        { x: 0, y: 0, z: 0 },  // pente 45° → filtré si maxSlope=30
      ],
      normals: [
        { x: 0, y: 1, z: 0 },     // angle 0° (up)
        { x: 0.707, y: 0.707, z: 0 }, // angle ~45°
      ],
      spawnInstructions: [],
    };
    const data: ForgeNodeData = {
      label: 'Filter Slope',
      nodeType: 'filterBySlope',
      params: { minSlope: 0, maxSlope: 30 },
    };
    const result = executeNode(data, { default: input }, DEFAULT_CTX);
    expect(result.positions.length).toBe(1);
  });

  it('conserve tout si pas de normales', () => {
    const input: GraphOutput = {
      positions: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }],
      normals: [],
      spawnInstructions: [],
    };
    const data: ForgeNodeData = {
      label: 'Filter Slope',
      nodeType: 'filterBySlope',
      params: {},
    };
    const result = executeNode(data, { default: input }, DEFAULT_CTX);
    expect(result.positions.length).toBe(2);
  });
});

describe('randomScatter', () => {
  it('génère le nombre demandé de positions', () => {
    const data: ForgeNodeData = {
      label: 'Scatter',
      nodeType: 'randomScatter',
      params: { count: 20, radius: 10, seed: 0, jitter: 0.5 },
    };
    const result = executeNode(data, {}, DEFAULT_CTX);
    expect(result.positions.length).toBe(20);
  });

  it('des seeds différents donnent des positions différentes', () => {
    const data: ForgeNodeData = {
      label: 'Scatter',
      nodeType: 'randomScatter',
      params: { count: 5, radius: 10 },
    };
    const r1 = executeNode(data, {}, { ...DEFAULT_CTX, seed: 1 });
    const r2 = executeNode(data, {}, { ...DEFAULT_CTX, seed: 999 });
    const same = r1.positions.every(
      (p, i) => p.x === r2.positions[i]?.x && p.y === r2.positions[i]?.y && p.z === r2.positions[i]?.z,
    );
    expect(same).toBe(false);
  });

  it('seed fixe = résultat déterministe', () => {
    const data: ForgeNodeData = {
      label: 'Scatter',
      nodeType: 'randomScatter',
      params: { count: 10, radius: 5, seed: 42 },
    };
    const r1 = executeNode(data, {}, DEFAULT_CTX);
    const r2 = executeNode(data, {}, DEFAULT_CTX);
    expect(r1.positions).toEqual(r2.positions);
  });
});

describe('output', () => {
  it('passe les spawns sans modification', () => {
    const input: GraphOutput = {
      positions: [],
      normals: [],
      spawnInstructions: [
        { model: 'a.glb', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
        { model: 'b.glb', position: [1, 1, 1], rotation: [0, 0, 0], scale: [1, 1, 1] },
      ],
    };
    const data: ForgeNodeData = {
      label: 'Output',
      nodeType: 'output',
      params: { chunkSize: 4 },
    };
    const result = executeNode(data, { default: input }, DEFAULT_CTX);
    expect(result.spawnInstructions.length).toBe(2);
  });
});

// ── Exécution intégrée ──────────────────────────────────────────────────────

describe('executeGraph', () => {
  it('graphe vide → aucun résultat', () => {
    const graph = emptyGraph();
    const results = executeGraph(graph, DEFAULT_CTX);
    expect(results.size).toBe(0);
  });

  it('graphe simple : SurfaceSampler → FilterByHeight', () => {
    const graph: ForgeGraph = {
      nodes: [
        makeNode('sampler', 'surfaceSampler', { density: 0.05, seed: 1 }),
        makeNode('filter', 'filterByHeight', { minHeight: -1, maxHeight: 1 }),
      ],
      edges: [makeEdge('e1', 'sampler', 'filter')],
    };
    const results = executeGraph(graph, DEFAULT_CTX);
    expect(results.size).toBe(2);
    const samplerOut = results.get('sampler')!;
    const filterOut = results.get('filter')!;
    expect(samplerOut.positions.length).toBeGreaterThan(0);
    expect(filterOut.positions.length).toBeLessThanOrEqual(samplerOut.positions.length);
  });

  it('graphe complet : Sampler → Filter → Spawner → Output', () => {
    const graph: ForgeGraph = {
      nodes: [
        makeNode('s', 'surfaceSampler', { density: 0.02, seed: 1 }),
        makeNode('f', 'filterByHeight', { minHeight: -0.5, maxHeight: 0.5 }),
        makeNode('sp', 'staticMeshSpawner', { model: 'rock.glb' }),
        makeNode('o', 'output', {}),
      ],
      edges: [
        makeEdge('e1', 's', 'f'),
        makeEdge('e2', 'f', 'sp'),
        makeEdge('e3', 'sp', 'o'),
      ],
    };
    const results = executeGraph(graph, DEFAULT_CTX);
    expect(results.size).toBe(4);

    const output = results.get('o')!;
    // Spawner produit des instructions depuis les positions filtrées
    expect(output.spawnInstructions.length).toBeGreaterThan(0);
    output.spawnInstructions.forEach((inst) => {
      expect(inst.model).toBe('rock.glb');
    });
  });

  it('graphe avec nœud inconnu → output vide (safe)', () => {
    const graph: ForgeGraph = {
      nodes: [
        { id: 'x', type: 'forgeNode', position: { x: 0, y: 0 }, data: { label: 'Unknown', nodeType: 'unknownType' as any, params: {} } },
      ],
      edges: [],
    };
    const results = executeGraph(graph, DEFAULT_CTX);
    expect(results.size).toBe(1);
    expect(results.get('x')!.positions).toEqual([]);
  });
});

// ── Conversion en instructions chunks ───────────────────────────────────────

describe('graphToChunkInstructions', () => {
  it('génère des instructions pour chaque nœud', () => {
    const graph: ForgeGraph = {
      nodes: [
        makeNode('a', 'surfaceSampler', { density: 0.1 }),
        makeNode('b', 'staticMeshSpawner', { model: 'tree.glb' }),
        makeNode('c', 'output', {}),
      ],
      edges: [
        makeEdge('e1', 'a', 'b'),
        makeEdge('e2', 'b', 'c'),
      ],
    };
    const results = executeGraph(graph, DEFAULT_CTX);
    const chunks = graphToChunkInstructions(graph, results);
    expect(chunks.length).toBe(1);
    expect(chunks[0].instructions.length).toBe(3);

    // Vérifie les types d'instructions
    const types = chunks[0].instructions.map((i) => i.type);
    expect(types).toContain('scatter');
    expect(types).toContain('spawn');
    expect(types).toContain('output');
  });

  it('inclut les références de modèles', () => {
    const graph: ForgeGraph = {
      nodes: [
        makeNode('a', 'randomScatter', { count: 3 }),
        makeNode('b', 'staticMeshSpawner', { model: 'pine.glb' }),
        makeNode('c', 'output', {}),
      ],
      edges: [
        makeEdge('e1', 'a', 'b'),
        makeEdge('e2', 'b', 'c'),
      ],
    };
    const results = executeGraph(graph, DEFAULT_CTX);
    const chunks = graphToChunkInstructions(graph, results);
    expect(chunks[0].modelRefs).toContain('pine.glb');
  });
});

describe('countTotalSpawns', () => {
  it('compte les spawns dans tous les résultats (intermédiaires inclus)', () => {
    const graph: ForgeGraph = {
      nodes: [
        makeNode('a', 'randomScatter', { count: 5 }),
        makeNode('b', 'staticMeshSpawner', { model: 'bush.glb' }),
        makeNode('c', 'output', {}),
      ],
      edges: [
        makeEdge('e1', 'a', 'b'),
        makeEdge('e2', 'b', 'c'),
      ],
    };
    const results = executeGraph(graph, DEFAULT_CTX);
    // Le spawner produit 5 spawns, le nœud output les transmet → 10 au total
    // (chaque nœud downstream stocke sa propre copie dans le cache)
    const total = countTotalSpawns(results);
    expect(total).toBeGreaterThanOrEqual(5);
  });
});
