/**
 * forge/graph/ForgeGraphPanel.tsx — Panneau d'édition du graphe Forge (React Flow).
 *
 * Interface de type « blueprint » pour connecter visuellement des nœuds
 * PCG (SurfaceSampler → Filter → Spawner → Output) et prévisualiser
 * les instructions chunks générées.
 *
 * Intégration : utiliser <ForgeGraphPanel /> dans un panneau latéral
 * de l'éditeur Forge (ForgeEditor.tsx).
 */

import { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
  type ForgeNodeType,
  type ForgeGraph,
  type ForgeNodeData,
  type GraphOutput,
  type ChunkMeta,
  type SurfaceSamplerParams,
  type StaticMeshSpawnerParams,
  type FilterByHeightParams,
  type FilterBySlopeParams,
  type RandomScatterParams,
  type OutputParams,
  NODE_CATALOGUE,
  uid,
  emptyGraph,
} from './types';

import { executeGraph, graphToChunkInstructions } from './executor';

// ── Styles ──────────────────────────────────────────────────────────────────

const PANEL_STYLES: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: '#0f172a',
    borderRadius: '8px',
    overflow: 'hidden',
    border: '1px solid #1e293b',
    fontFamily: 'JetBrains Mono, monospace',
  },
  toolbar: {
    display: 'flex',
    gap: '6px',
    padding: '8px 12px',
    background: '#1e293b',
    borderBottom: '1px solid #334155',
    flexWrap: 'wrap' as const,
    alignItems: 'center',
  },
  toolbarBtn: {
    background: '#334155',
    color: '#e2e8f0',
    border: 'none',
    padding: '4px 10px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '11px',
    fontFamily: 'inherit',
  },
  flowContainer: {
    flex: 1,
    position: 'relative' as const,
  },
  outputPanel: {
    background: '#1e293b',
    borderTop: '1px solid #334155',
    padding: '8px 12px',
    maxHeight: '150px',
    overflowY: 'auto' as const,
    fontSize: '11px',
    color: '#94a3b8',
    fontFamily: 'monospace',
  },
};

// ── Nœud React Flow personnalisé ────────────────────────────────────────────

const NODE_COLORS: Record<string, string> = {
  surfaceSampler: '#10b981',
  staticMeshSpawner: '#f59e0b',
  filterByHeight: '#6366f1',
  filterBySlope: '#8b5cf6',
  randomScatter: '#ec4899',
  output: '#64748b',
};

function ForgeNode({ data, selected }: NodeProps<Node<ForgeNodeData>>) {
  const color = NODE_COLORS[data.nodeType] ?? '#64748b';
  return (
    <div
      style={{
        background: '#1e293b',
        border: `2px solid ${selected ? color : '#334155'}`,
        borderRadius: '8px',
        padding: '10px 14px',
        minWidth: '160px',
        color: '#e2e8f0',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '12px',
        boxShadow: selected ? `0 0 12px ${color}40` : 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: color, width: 8, height: 8 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', background: color,
          flexShrink: 0,
        }} />
        <strong style={{ fontSize: '11px', color }}>{data.label}</strong>
      </div>
      <div style={{ fontSize: '10px', color: '#94a3b8', lineHeight: '1.5' }}>
        {renderParamsSummary(data.nodeType, data.params)}
      </div>
      {data.nodeType !== 'output' && (
        <Handle type="source" position={Position.Right} style={{ background: color, width: 8, height: 8 }} />
      )}
    </div>
  );
}

function renderParamsSummary(nodeType: ForgeNodeType, params: Record<string, unknown>): string {
  switch (nodeType) {
    case 'surfaceSampler':
      return `densité: ${params.density ?? 0.5} · seed: ${params.seed ?? 42}`;
    case 'staticMeshSpawner': {
      const model = (params.model as string) || '(aucun)';
      return `mesh: ${model.split('/').pop() ?? model}`;
    }
    case 'filterByHeight':
      return `Y: ${params.minHeight ?? -Infinity} ~ ${params.maxHeight ?? Infinity}`;
    case 'filterBySlope':
      return `pente: ${params.minSlope ?? 0}° ~ ${params.maxSlope ?? 90}°`;
    case 'randomScatter':
      return `N: ${params.count ?? 10} · rayon: ${params.radius ?? 5}m`;
    case 'output':
      return `chunk: ${params.chunkSize ?? 8} · sortie finale`;
    default:
      return '';
  }
}

const nodeTypes: NodeTypes = { forgeNode: ForgeNode };

// ── Composant principal ─────────────────────────────────────────────────────

export interface ForgeGraphPanelProps {
  /** Graphe initial (optionnel). */
  initialGraph?: ForgeGraph;
  /** Callback appelé à chaque modification du graphe. */
  onGraphChange?: (graph: ForgeGraph) => void;
  /** Hauteur du panneau (défaut: '100%'). */
  height?: string;
}

export function ForgeGraphPanel({
  initialGraph,
  onGraphChange,
  height = '100%',
}: ForgeGraphPanelProps) {
  const graphKey = useRef(0);

  const [nodes, setNodes, onNodesChange] = useNodesState(
    initialGraph?.nodes?.map(fromForgeNode) ?? [],
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    initialGraph?.edges?.map(fromForgeEdge) ?? [],
  );
  const [outputLog, setOutputLog] = useState<string[]>([]);
  const [execResult, setExecResult] = useState<ChunkMeta[] | null>(null);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, animated: true }, eds));
    },
    [setEdges],
  );

  const addLog = useCallback((msg: string) => {
    setOutputLog((prev) => [...prev.slice(-99), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  // ── Ajout d'un nœud ─────────────────────────────────────────────────────

  const addNode = useCallback(
    (nodeType: ForgeNodeType) => {
      const entry = NODE_CATALOGUE.find((e) => e.type === nodeType);
      if (!entry) return;

      const id = uid('forge');
      const rn: Node<ForgeNodeData> = {
        id,
        type: 'forgeNode',
        position: {
          x: 40 + ((nodes.length % 5) * 200),
          y: 40 + Math.floor(nodes.length / 5) * 140,
        },
        data: {
          label: entry.label,
          nodeType: entry.type,
          params: { ...entry.defaultParams } as Record<string, unknown>,
        },
      };
      setNodes((nds) => [...nds, rn]);
      addLog(`➕ Ajouté ${entry.label} (${id})`);
    },
    [nodes.length, setNodes, addLog],
  );

  // ── Exécution du graphe ─────────────────────────────────────────────────

  const handleExecute = useCallback(() => {
    const graph = toForgeGraph(nodes, edges);
    if (graph.nodes.length === 0) {
      addLog('⚠️ Graphe vide — rien à exécuter');
      return;
    }

    addLog(`▶️ Exécution du graphe (${graph.nodes.length} nœuds, ${graph.edges.length} connexions)...`);
    const start = performance.now();

    try {
      const results = executeGraph(graph, { seed: 42, iteration: 0 });
      const chunks = graphToChunkInstructions(graph, results);

      // Log du résultat
      let totalSpawns = 0;
      let totalPositions = 0;
      for (const output of results.values()) {
        totalSpawns += output.spawnInstructions.length;
        totalPositions += output.positions.length;
      }

      const elapsed = (performance.now() - start).toFixed(1);
      addLog(`✅ Terminé en ${elapsed}ms — ${totalPositions} positions, ${totalSpawns} spawns`);
      addLog(`📦 ${chunks.length} chunk(s) généré(s)`);
      setExecResult(chunks);

      // Affiche le détail de chaque instruction
      for (const chunk of chunks) {
        for (const inst of chunk.instructions) {
          const nodeLabel = graph.nodes.find((n) => n.id === inst.sourceNodeId)?.data.label ?? inst.sourceNodeId;
          addLog(`  ├ ${inst.type}: ${nodeLabel} (${JSON.stringify(inst.params).slice(0, 80)})`);
        }
      }
    } catch (err) {
      addLog(`❌ Erreur d'exécution: ${err instanceof Error ? err.message : String(err)}`);
    }

    graphKey.current++;
    onGraphChange?.(graph);
  }, [nodes, edges, addLog, onGraphChange]);

  // ── Notification des changements ────────────────────────────────────────

  const handleNodesChange = useCallback(
    (changes: any) => {
      onNodesChange(changes);
    },
    [onNodesChange],
  );

  const handleEdgesChange = useCallback(
    (changes: any) => {
      onEdgesChange(changes);
    },
    [onEdgesChange],
  );

  // ── Rendu ────────────────────────────────────────────────────────────────

  return (
    <div style={{ ...PANEL_STYLES.container, height }}>
      {/* Toolbar */}
      <div style={PANEL_STYLES.toolbar}>
        <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 600, marginRight: '4px' }}>
          🎛️ Forge Graph
        </span>
        <div style={{ flex: 1 }} />
        <button style={PANEL_STYLES.toolbarBtn} onClick={() => addNode('surfaceSampler')} title="Échantillonneur de surface">
          🌱 Surface
        </button>
        <button style={PANEL_STYLES.toolbarBtn} onClick={() => addNode('staticMeshSpawner')} title="Spawner de maillage">
          📦 Spawner
        </button>
        <button style={PANEL_STYLES.toolbarBtn} onClick={() => addNode('filterByHeight')} title="Filtre par hauteur">
          📏 Filtre Y
        </button>
        <button style={PANEL_STYLES.toolbarBtn} onClick={() => addNode('filterBySlope')} title="Filtre par pente">
          ⛰️ Filtre Pente
        </button>
        <button style={PANEL_STYLES.toolbarBtn} onClick={() => addNode('randomScatter')} title="Dispersion aléatoire">
          🎲 Scatter
        </button>
        <button style={PANEL_STYLES.toolbarBtn} onClick={() => addNode('output')} title="Sortie (consolidation chunks)">
          🏁 Output
        </button>
        <div style={{ width: '1px', height: '20px', background: '#334155' }} />
        <button
          style={{ ...PANEL_STYLES.toolbarBtn, background: '#059669', color: '#fff' }}
          onClick={handleExecute}
        >
          ▶️ Exec
        </button>
      </div>

      {/* Canvas React Flow */}
      <div style={PANEL_STYLES.flowContainer}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          colorMode="dark"
          style={{ background: '#0f172a' }}
        >
          <Controls style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '6px' }} />
          <MiniMap
            style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '6px' }}
            nodeColor={(n) => NODE_COLORS[(n.data as ForgeNodeData)?.nodeType] ?? '#64748b'}
            maskColor="rgba(15,23,42,0.7)"
          />
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#334155" />
        </ReactFlow>
      </div>

      {/* Output log */}
      <div style={PANEL_STYLES.outputPanel}>
        <div style={{ color: '#64748b', marginBottom: '4px', fontSize: '10px', fontWeight: 600 }}>
          📋 EXECUTION LOG
        </div>
        {outputLog.length === 0 ? (
          <div style={{ color: '#475569', fontStyle: 'italic' }}>Ajoutez des nœuds et cliquez Exec.</div>
        ) : (
          outputLog.map((line, i) => (
            <div key={i} style={{ lineHeight: '1.6' }}>
              {line.startsWith('[') ? line : `  ${line}`}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Convertisseurs entre ForgeGraph et React Flow ───────────────────────────

function fromForgeNode(fn: import('./types').ForgeNode): Node<ForgeNodeData> {
  return {
    id: fn.id,
    type: 'forgeNode',
    position: fn.position,
    data: fn.data,
  };
}

function fromForgeEdge(fe: import('./types').ForgeEdge): Edge {
  return {
    id: fe.id,
    source: fe.source,
    target: fe.target,
    sourceHandle: fe.sourceHandle,
    targetHandle: fe.targetHandle,
    animated: true,
  };
}

/** Convertit l'état React Flow en ForgeGraph pour l'exécution. */
function toForgeGraph(
  reactFlowNodes: Node<ForgeNodeData>[],
  reactFlowEdges: Edge[],
): ForgeGraph {
  return {
    nodes: reactFlowNodes.map((n) => ({
      id: n.id,
      type: n.type ?? 'forgeNode',
      position: n.position,
      data: n.data,
    })),
    edges: reactFlowEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
    })),
  };
}
