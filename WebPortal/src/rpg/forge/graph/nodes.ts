/**
 * forge/graph/nodes.ts — Implémentations des nœuds PCG du Forge Graph.
 *
 * Chaque nœud expose une fonction `execute` qui reçoit les entrées (inputs)
 * de ses prédécesseurs et produit un GraphOutput.
 */

import type {
  ForgeNodeType,
  ForgeNodeData,
  GraphOutput,
  Position3D,
  Vector3,
  SpawnInstruction,
  ExecContext,
  SurfaceSamplerParams,
  StaticMeshSpawnerParams,
  FilterByHeightParams,
  FilterBySlopeParams,
  RandomScatterParams,
  OutputParams,
} from './types';

// ── Générateur pseudo-aléatoire déterministe (seedable) ──────────────────────

/** Générateur LCG (Linear Congruential Generator) simple mais seedable. */
class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed & 0x7fffffff;
    if (this.state === 0) this.state = 1;
  }

  /** Retourne un flottant dans [0, 1). */
  next(): number {
    this.state = (this.state * 1664525 + 1013904223) & 0x7fffffff;
    return this.state / 0x7fffffff;
  }

  /** Retourne un entier dans [min, max]. */
  nextInt(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Retourne un flottant dans [min, max). */
  nextFloat(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}

// ── Interface commune à tous les nœuds ──────────────────────────────────────

export type NodeInput = Record<string, GraphOutput | undefined>;

export interface NodeExecutor {
  readonly type: ForgeNodeType;
  execute(
    inputs: NodeInput,
    ctx: ExecContext,
    params: Record<string, unknown>,
  ): GraphOutput;
  /** Valeur par défaut des paramètres. */
  defaultParams(): Record<string, unknown>;
}

// ── Surface Sampler ─────────────────────────────────────────────────────────

/**
 * Échantillonne une surface fictive (ou terrain) en générant une grille
 * de positions basée sur une densité. Les normales pointent vers le haut
 * (Y) par défaut.
 */
export const surfaceSamplerExecutor: NodeExecutor = {
  type: 'surfaceSampler',

  defaultParams(): Record<string, unknown> {
    return { density: 0.5, seed: 42 };
  },

  execute(inputs: NodeInput, ctx: ExecContext, params: Record<string, unknown>): GraphOutput {
    // Récupère les paramètres (priorité aux params passés, sinon défauts)
    const density = (params.density as number) ?? 0.5;
    const seed = (params.seed as number) ?? ctx.seed;
    const rng = new SeededRandom(seed);

    // Génère une grille de points sur une surface 100×100
    const size = 100;
    const step = Math.sqrt(1 / Math.max(density, 0.01)); // espacement entre points
    const positions: Position3D[] = [];
    const normals: Vector3[] = [];

    for (let x = -size / 2; x <= size / 2; x += step) {
      for (let z = -size / 2; z <= size / 2; z += step) {
        // Ajoute un jitter pour éviter l'aspect grille parfaite
        const jx = x + (rng.next() - 0.5) * step * 0.3;
        const jz = z + (rng.next() - 0.5) * step * 0.3;
        // Hauteur simulée : vague douce
        const y = Math.sin(jx * 0.05) * Math.cos(jz * 0.05) * 2;
        positions.push({ x: jx, y, z: jz });
        // Normale approximée (dérivée de la fonction de hauteur)
        const nx = -Math.cos(jx * 0.05) * 0.05 * 2;
        const nz = Math.sin(jz * 0.05) * 0.05 * 2;
        const len = Math.sqrt(1 + nx * nx + nz * nz);
        normals.push({ x: nx / len, y: 1 / len, z: nz / len });
      }
    }

    return { positions, normals, spawnInstructions: [] };
  },
};

// ── Static Mesh Spawner ────────────────────────────────────────────────────

/**
 * Prend des positions en entrée et produit des SpawnInstructions
 * (un mesh par position).
 */
export const staticMeshSpawnerExecutor: NodeExecutor = {
  type: 'staticMeshSpawner',

  defaultParams(): Record<string, unknown> {
    return { model: '', scaleMin: 0.8, scaleMax: 1.2, rotYRandom: true };
  },

  execute(inputs: NodeInput, ctx: ExecContext, params: Record<string, unknown>): GraphOutput {
    // Récupère les positions du nœud amont
    const upstream = inputs['positions'] ?? inputs['default'];
    const inputPositions = upstream?.positions ?? [];
    const model = (params.model as string) ?? '';
    const scaleMin = (params.scaleMin as number) ?? 0.8;
    const scaleMax = (params.scaleMax as number) ?? 1.2;
    const rotYRandom = (params.rotYRandom as boolean) ?? true;
    const rng = new SeededRandom(ctx.seed);

    const spawnInstructions: SpawnInstruction[] = inputPositions.map((pos) => {
      const scale = scaleMin + rng.next() * (scaleMax - scaleMin);
      const rotY = rotYRandom ? rng.next() * Math.PI * 2 : 0;
      return {
        model,
        position: [pos.x, pos.y, pos.z] as [number, number, number],
        rotation: [0, rotY, 0] as [number, number, number],
        scale: [scale, scale, scale] as [number, number, number],
      };
    });

    return { positions: inputPositions, normals: [], spawnInstructions };
  },
};

// ── Filter By Height ───────────────────────────────────────────────────────

/**
 * Filtre les positions dont la hauteur (Y) est dans [minHeight, maxHeight].
 */
export const filterByHeightExecutor: NodeExecutor = {
  type: 'filterByHeight',

  defaultParams(): Record<string, unknown> {
    return { minHeight: -Infinity, maxHeight: Infinity };
  },

  execute(inputs: NodeInput, _ctx: ExecContext, params: Record<string, unknown>): GraphOutput {
    const upstream = inputs['positions'] ?? inputs['default'];
    const inputPositions = upstream?.positions ?? [];
    const inputNormals = upstream?.normals ?? [];
    const minH = (params.minHeight as number) ?? -Infinity;
    const maxH = (params.maxHeight as number) ?? Infinity;

    const kept: Position3D[] = [];
    const keptNormals: Vector3[] = [];

    for (let i = 0; i < inputPositions.length; i++) {
      const p = inputPositions[i];
      if (p.y >= minH && p.y <= maxH) {
        kept.push(p);
        if (inputNormals[i]) keptNormals.push(inputNormals[i]);
      }
    }

    return { positions: kept, normals: keptNormals, spawnInstructions: [] };
  },
};

// ── Filter By Slope ────────────────────────────────────────────────────────

/**
 * Filtre les points dont la pente (angle en degrés entre la normale et
 * le vecteur « up ») est dans [minSlope, maxSlope].
 *
 * Nécessite des normales en entrée (produites par SurfaceSampler).
 */
export const filterBySlopeExecutor: NodeExecutor = {
  type: 'filterBySlope',

  defaultParams(): Record<string, unknown> {
    return { minSlope: 0, maxSlope: 90 };
  },

  execute(inputs: NodeInput, _ctx: ExecContext, params: Record<string, unknown>): GraphOutput {
    const upstream = inputs['positions'] ?? inputs['default'];
    const inputPositions = upstream?.positions ?? [];
    const inputNormals = upstream?.normals ?? [];
    const minS = (params.minSlope as number) ?? 0;
    const maxS = (params.maxSlope as number) ?? 90;

    const minRad = (minS * Math.PI) / 180;
    const maxRad = (maxS * Math.PI) / 180;

    const kept: Position3D[] = [];
    const keptNormals: Vector3[] = [];

    for (let i = 0; i < inputPositions.length; i++) {
      const normal = inputNormals[i];
      if (!normal) {
        // Pas de normale → conserve par défaut
        kept.push(inputPositions[i]);
        continue;
      }
      // Angle entre la normale et (0,1,0)
      const dot = Math.min(1, Math.max(-1, normal.y)); // clamp flottant
      const angle = Math.acos(dot);
      if (angle >= minRad && angle <= maxRad) {
        kept.push(inputPositions[i]);
        keptNormals.push(normal);
      }
    }

    return { positions: kept, normals: keptNormals, spawnInstructions: [] };
  },
};

// ── Random Scatter ─────────────────────────────────────────────────────────

/**
 * Génère N positions aléatoires dans un rayon donné autour de l'origine
 * (ou du premier point d'entrée s'il existe).
 */
export const randomScatterExecutor: NodeExecutor = {
  type: 'randomScatter',

  defaultParams(): Record<string, unknown> {
    return { count: 10, radius: 5, seed: 0, jitter: 0.3 };
  },

  execute(inputs: NodeInput, ctx: ExecContext, params: Record<string, unknown>): GraphOutput {
    const upstream = inputs['positions'] ?? inputs['default'];
    const inputPositions = upstream?.positions ?? [];
    const count = (params.count as number) ?? 10;
    const radius = (params.radius as number) ?? 5;
    const seed = (params.seed as number) ?? ctx.seed;
    const jitter = (params.jitter as number) ?? 0.3;
    const rng = new SeededRandom(seed);

    // Centre : origine ou barycentre des positions entrantes
    let cx = 0, cz = 0, cy = 0;
    if (inputPositions.length > 0) {
      cx = inputPositions.reduce((s, p) => s + p.x, 0) / inputPositions.length;
      cy = inputPositions.reduce((s, p) => s + p.y, 0) / inputPositions.length;
      cz = inputPositions.reduce((s, p) => s + p.z, 0) / inputPositions.length;
    }

    const positions: Position3D[] = [];
    const normals: Vector3[] = [];

    for (let i = 0; i < count; i++) {
      const angle = rng.next() * Math.PI * 2;
      const dist = rng.next() * radius;
      const x = cx + Math.cos(angle) * dist + (rng.next() - 0.5) * jitter;
      const z = cz + Math.sin(angle) * dist + (rng.next() - 0.5) * jitter;
      // Hauteur au sol simulée
      const y = cy + Math.sin(x * 0.1) * Math.cos(z * 0.1) * 0.5;
      positions.push({ x, y, z });
      normals.push({ x: 0, y: 1, z: 0 });
    }

    return { positions, normals, spawnInstructions: [] };
  },
};

// ── Output ──────────────────────────────────────────────────────────────────

/**
 * Nœud de sortie : consolide les spawns entrants en instructions chunks
 * et les transmet sans filtre.
 */
export const outputExecutor: NodeExecutor = {
  type: 'output',

  defaultParams(): Record<string, unknown> {
    return { chunkSize: 8 };
  },

  execute(inputs: NodeInput, _ctx: ExecContext, params: Record<string, unknown>): GraphOutput {
    const upstream = inputs['spawns'] ?? inputs['default'];
    const instructions = upstream?.spawnInstructions ?? [];

    return {
      positions: [],
      normals: [],
      spawnInstructions: instructions,
    };
  },
};

// ── Registry ────────────────────────────────────────────────────────────────

/** Tous les exécuteurs, indexés par type. */
const EXECUTOR_REGISTRY: Record<string, NodeExecutor> = {
  surfaceSampler: surfaceSamplerExecutor,
  staticMeshSpawner: staticMeshSpawnerExecutor,
  filterByHeight: filterByHeightExecutor,
  filterBySlope: filterBySlopeExecutor,
  randomScatter: randomScatterExecutor,
  output: outputExecutor,
};

/** Retourne l'exécuteur pour un type de nœud donné. */
export function getExecutor(type: ForgeNodeType): NodeExecutor | undefined {
  return EXECUTOR_REGISTRY[type];
}

/** Liste tous les types de nœuds disponibles. */
export function listExecutorTypes(): ForgeNodeType[] {
  return Object.keys(EXECUTOR_REGISTRY) as ForgeNodeType[];
}

/**
 * Exécute un nœud unique identifié par ses données et ses entrées.
 * Utile pour le débogage et les tests unitaires.
 */
export function executeNode(
  data: ForgeNodeData,
  inputs: NodeInput,
  ctx: ExecContext,
): GraphOutput {
  const executor = getExecutor(data.nodeType);
  if (!executor) {
    return { positions: [], normals: [], spawnInstructions: [] };
  }
  // Passe les paramètres du nœud directement
  return executor.execute(inputs, ctx, data.params);
}
