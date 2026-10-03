/**
 * forge/graph/types.ts — Forge Graph: types de base
 *
 * Définit les types de nœuds PCG, les structures de données d'exécution,
 * et les instructions générées pour le pipeline puzzle-chunks.
 */

// ── Types de nœuds PCG ──────────────────────────────────────────────────────

/** Types de nœuds PCG disponibles dans le graphe Forge. */
export type ForgeNodeType =
  | 'surfaceSampler'      // Échantillonne une surface (terrain) → positions + normales
  | 'staticMeshSpawner'   // Fait spawner des mailles à des positions données
  | 'filterByHeight'      // Filtre les points par hauteur (min/max)
  | 'filterBySlope'       // Filtre les points par pente (min/max degrés)
  | 'randomScatter'       // Disperser aléatoirement des points dans une région
  | 'output'              // Nœud de sortie : consolide les spawns en instructions chunks
  ;

/** Paramètres par type de nœud. */
export interface SurfaceSamplerParams {
  density: number;         // points par m² (défaut: 0.5)
  seed: number;            // graine aléatoire (défaut: 42)
}

export interface StaticMeshSpawnerParams {
  model: string;           // chemin du GLB à spawner
  scaleMin: number;        // échelle min (défaut: 0.8)
  scaleMax: number;        // échelle max (défaut: 1.2)
  rotYRandom: boolean;     // rotation Y aléatoire (défaut: true)
}

export interface FilterByHeightParams {
  minHeight: number;       // hauteur min (défaut: -Infinity)
  maxHeight: number;       // hauteur max (défaut: Infinity)
}

export interface FilterBySlopeParams {
  minSlope: number;        // pente min en degrés (défaut: 0)
  maxSlope: number;        // pente max en degrés (défaut: 90)
}

export interface RandomScatterParams {
  count: number;           // nombre de points à générer (défaut: 10)
  radius: number;          // rayon de dispersion (défaut: 5)
  seed: number;            // graine aléatoire (défaut: 0)
  jitter: number;          // jitter de position (0-1, défaut: 0.3)
}

export interface OutputParams {
  chunkSize: number;       // taille de chunk recommandée (défaut: 8)
}

/** Union de tous les paramètres. */
export type NodeParams =
  | SurfaceSamplerParams
  | StaticMeshSpawnerParams
  | FilterByHeightParams
  | FilterBySlopeParams
  | RandomScatterParams
  | OutputParams;

// ── Types de nœuds pour React Flow ──────────────────────────────────────────

/** Métadonnées portées par chaque nœud React Flow. */
export interface ForgeNodeData extends Record<string, unknown> {
  label: string;
  nodeType: ForgeNodeType;
  params: Record<string, unknown>;
}

/** Nœud dans le graphe. */
export interface ForgeNode {
  id: string;
  type: string;              // 'forgeNode' (custom React Flow type)
  position: { x: number; y: number };
  data: ForgeNodeData;
}

/** Edge (connexion) entre deux nœuds. */
export interface ForgeEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

/** Graphe complet. */
export interface ForgeGraph {
  nodes: ForgeNode[];
  edges: ForgeEdge[];
}

// ── Contexte d'exécution ────────────────────────────────────────────────────

/** Résultat produit par un nœud après exécution. */
export interface GraphOutput {
  /** Positions 3D générées / filtrées. */
  positions: Position3D[];
  /** Normales de surface aux positions correspondantes. */
  normals: Vector3[];
  /** Instructions de spawn consolidées (nœud output uniquement). */
  spawnInstructions: SpawnInstruction[];
}

/** Position 3D. */
export interface Position3D {
  x: number;
  y: number;
  z: number;
}

/** Vecteur 3D (normale, direction…). */
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/** Instruction unique de placement d'objet. */
export interface SpawnInstruction {
  model: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

/** Contexte partagé entre les exécutions de nœuds. */
export interface ExecContext {
  seed: number;
  iteration: number;
}

// ── Instructions pour le pipeline puzzle-chunks ────────────────────────────

/**
 * Instruction de haut niveau générée par le graphe, consommable par
 * `puzzle-chunks.mjs` ou un orchestrateur équivalent.
 */
export interface ChunkInstruction {
  type: 'scatter' | 'spawn' | 'filter_height' | 'filter_slope' | 'output';
  /** Paramètres spécifiques à l'instruction. */
  params: Record<string, unknown>;
  /** UID du nœud source (traçabilité). */
  sourceNodeId: string;
}

/** Métadonnées d'un chunk généré. */
export interface ChunkMeta {
  index: number;
  instructions: ChunkInstruction[];
  estimatedVertexCount: number;
  modelRefs: string[];
}

// ── Catalogue des nœuds (pour l'UI) ────────────────────────────────────────

export interface NodeCatalogueEntry {
  type: ForgeNodeType;
  label: string;
  description: string;
  color: string;
  defaultParams: NodeParams;
  inputs: string[];   // types de données acceptés en entrée
  outputs: string[];  // types de données produits en sortie
}

export const NODE_CATALOGUE: NodeCatalogueEntry[] = [
  {
    type: 'surfaceSampler',
    label: 'Surface Sampler',
    description: 'Échantillonne une surface (terrain) pour produire des positions + normales',
    color: '#10b981',
    defaultParams: { density: 0.5, seed: 42 } satisfies SurfaceSamplerParams,
    inputs: [],
    outputs: ['positions', 'normals'],
  },
  {
    type: 'staticMeshSpawner',
    label: 'Static Mesh Spawner',
    description: 'Instancie un maillage statique à chaque position reçue',
    color: '#f59e0b',
    defaultParams: { model: '', scaleMin: 0.8, scaleMax: 1.2, rotYRandom: true } satisfies StaticMeshSpawnerParams,
    inputs: ['positions'],
    outputs: ['spawns'],
  },
  {
    type: 'filterByHeight',
    label: 'Filter By Height',
    description: 'Conserve uniquement les points dans une plage de hauteur',
    color: '#6366f1',
    defaultParams: { minHeight: -Infinity, maxHeight: Infinity } satisfies FilterByHeightParams,
    inputs: ['positions', 'normals'],
    outputs: ['positions', 'normals'],
  },
  {
    type: 'filterBySlope',
    label: 'Filter By Slope',
    description: 'Conserve uniquement les points dont la pente est dans une plage donnée',
    color: '#8b5cf6',
    defaultParams: { minSlope: 0, maxSlope: 90 } satisfies FilterBySlopeParams,
    inputs: ['positions', 'normals'],
    outputs: ['positions', 'normals'],
  },
  {
    type: 'randomScatter',
    label: 'Random Scatter',
    description: 'Disperse aléatoirement N points dans un rayon autour d\'un centre',
    color: '#ec4899',
    defaultParams: { count: 10, radius: 5, seed: 0, jitter: 0.3 } satisfies RandomScatterParams,
    inputs: [],
    outputs: ['positions'],
  },
  {
    type: 'output',
    label: 'Output',
    description: 'Consolide les spawns en instructions chunks pour le pipeline',
    color: '#64748b',
    defaultParams: { chunkSize: 8 } satisfies OutputParams,
    inputs: ['spawns'],
    outputs: [],
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Type guard : vérifie qu'un objet est un ForgeGraph valide. */
export function isValidGraph(g: unknown): g is ForgeGraph {
  if (!g || typeof g !== 'object') return false;
  const graph = g as Record<string, unknown>;
  if (!Array.isArray(graph.nodes)) return false;
  if (!Array.isArray(graph.edges)) return false;
  return graph.nodes.every(
    (n) =>
      typeof n === 'object' && n !== null &&
      typeof (n as ForgeNode).id === 'string' &&
      typeof (n as ForgeNode).type === 'string' &&
      (n as ForgeNode).data &&
      typeof (n as ForgeNode).data.label === 'string',
  );
}

/** Génère un ID unique pour un nœud. */
export function uid(prefix = 'node'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/** Crée un graphe vide. */
export function emptyGraph(): ForgeGraph {
  return { nodes: [], edges: [] };
}
