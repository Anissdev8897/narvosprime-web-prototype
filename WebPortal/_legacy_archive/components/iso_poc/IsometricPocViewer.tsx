/**
 * IsometricPocViewer.tsx - Composant standalone POC iso 3D NARVOS PRIME (Sprint 3).
 *
 * - Charge les configs JSON via EntityRegistry
 * - Affiche un panneau pre-combat (selection perso/map/monstres)
 * - Spawn joueur + monstres sur la grille via spawn_points.json
 * - Caméra suit le joueur (follow_smooth) avec mode fixed pour combat
 * - Hooks combat tour par tour deja branches (useCombatStore)
 * - HUD overlay HP/PA/PM, spell bar, timeline
 *
 * NE CASSE PAS le moteur 2D existant. Mountable via F11.
 */

import { Canvas } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { EntityView } from "./EntityView";
import { HudOverlay } from "./HudOverlay";
import { IsometricCamera, type CameraMode } from "./IsometricCamera";
import { PreCombatPanel, type PreCombatChoice } from "./PreCombatPanel";
import { TileGrid } from "./TileGrid";
import type { CombatEntity, GridCell } from "./combat/CombatTypes";
import type {
  CharacterDefinition,
  EntityDefinition,
  EntityRegistry as RegistryShape,
  Map3DConfig,
  MonsterDefinition,
  SpawnPoint,
} from "./combat/EntityDefinition";
import { RegistryQuery, loadEntityRegistry } from "./combat/EntityRegistry";
import { useCombatStore } from "./combat/useCombatStore";

interface IsometricPocViewerProps {
  fullscreen?: boolean;
}

export function IsometricPocViewer({ fullscreen = true }: IsometricPocViewerProps) {
  // 1. Registry (configs JSON)
  const [registry, setRegistry] = useState<RegistryShape | null>(null);
  const [registryError, setRegistryError] = useState<string | null>(null);
  const [registryLoading, setRegistryLoading] = useState(true);

  useEffect(() => {
    loadEntityRegistry()
      .then((r) => {
        setRegistry(r);
        setRegistryLoading(false);
      })
      .catch((err) => {
        setRegistryError(String(err));
        setRegistryLoading(false);
      });
  }, []);

  // 2. Choix pre-combat (perso + map + monstres)
  const [choice, setChoice] = useState<PreCombatChoice | null>(null);

  // 3. Combat store (entites + tour par tour)
  const combat = useCombatStore();

  // 4. Definitions des entites pour le rendu (id -> EntityDefinition)
  const [defs, setDefs] = useState<Record<string, EntityDefinition>>({});

  // 5. Mesh refs pour suivi camera (joueur).
  // On utilise des refs pour eviter le stale closure quand Character3D appelle onRootReady.
  const playerRootRef = useRef<THREE.Object3D | null>(null);
  const entitiesRef = useRef<Record<string, CombatEntity>>({});
  useEffect(() => {
    entitiesRef.current = combat.state.entities;
  }, [combat.state.entities]);

  const setEntityRoot = useCallback((id: string, obj: THREE.Object3D) => {
    if (entitiesRef.current[id]?.isPlayer) {
      playerRootRef.current = obj;
    }
  }, []);

  // 6. Camera
  const [cameraMode, setCameraMode] = useState<CameraMode>("follow_smooth");

  // 7. Selection
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<GridCell | null>(null);

  // 8. Map active
  const activeMap: Map3DConfig | null = useMemo(() => {
    if (!registry || !choice) return null;
    return registry.maps[choice.mapId] || null;
  }, [registry, choice]);

  // 9. Quand choice change, spawn les entites
  useEffect(() => {
    if (!registry || !choice) return;

    const newDefs: Record<string, EntityDefinition> = {};
    const entities: CombatEntity[] = [];

    // Player
    const playerDef = registry.characters[choice.characterId];
    if (playerDef) {
      const playerSpawn = RegistryQuery.findSpawnFor(
        registry,
        choice.mapId,
        "player",
        playerDef.faction,
        "player_start"
      ) || RegistryQuery.findSpawnFor(registry, choice.mapId, "player", playerDef.faction);
      const playerCell = playerSpawn?.cell || playerDef.startCell;

      newDefs[playerDef.id] = playerDef;
      entities.push(buildCombatEntity(playerDef, playerCell, registry));
    }

    // Monstres
    const enemySpawns = registry.spawnPoints
      .filter((s) => s.mapId === choice.mapId && s.acceptKinds?.some((k) => k !== "player"))
      .slice(0, choice.monsterIds.length);

    choice.monsterIds.forEach((mid, i) => {
      const mdef = registry.monsters[mid];
      if (!mdef) return;
      const sp = enemySpawns[i];
      const cell = sp?.cell || { x: 10 + i, y: 5 + i };
      // ID unique au cas où le même monstre est spawn plusieurs fois (extension future)
      const uniqueDef: MonsterDefinition = { ...mdef, id: `${mdef.id}_${i}` };
      newDefs[uniqueDef.id] = uniqueDef;
      entities.push(buildCombatEntity(uniqueDef, cell, registry));
    });

    setDefs(newDefs);
    combat.initCombat(entities);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registry, choice]);

  // 10. Handlers HUD
  const playerEntity = useMemo<CombatEntity | null>(() => {
    return Object.values(combat.state.entities).find((e) => e.isPlayer) || null;
  }, [combat.state.entities]);

  const handleCellClick = useCallback(
    (cell: GridCell) => {
      console.log("[IsoPOC] Cell clicked:", cell);
      // Sprint 4 : si player_turn + selectedSpell -> cast ; sinon move
    },
    []
  );

  const handleStartCombat = useCallback(() => {
    // initCombat met deja phase = player_turn. Ce handler reste pour
    // les futurs cas (rejouer un combat, restart) ou la phase serait idle.
  }, []);

  // Reset (revenir au menu pre-combat)
  const handleResetChoice = useCallback(() => {
    combat.reset();
    setChoice(null);
    setDefs({});
    setSelectedEntityId(null);
    playerRootRef.current = null;
  }, [combat]);

  // Container styles
  const containerStyle: React.CSSProperties = fullscreen
    ? { position: "fixed", inset: 0, background: "#0b0f15", zIndex: 9999 }
    : { width: "100%", height: "100%", background: "#0b0f15" };

  // Pre-combat panel modal (avant choix)
  if (!choice) {
    return (
      <div style={containerStyle}>
        <PreCombatPanel
          registry={registry}
          loading={registryLoading}
          error={registryError}
          onReady={setChoice}
        />
      </div>
    );
  }

  // En jeu
  return (
    <div style={containerStyle}>
      <Canvas
        shadows
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 2]}
        camera={{ position: [0, 30, 0], near: 0.1, far: 1000 }}
        onCreated={({ scene }) => {
          // Defensive: ne pas crash si bgColor est "transparent" ou invalide
          const raw = (activeMap?.bgColor || "#1a2030").toLowerCase().trim();
          if (raw === "transparent" || raw === "none" || !raw) {
            scene.background = null;
          } else {
            try {
              scene.background = new THREE.Color(raw);
            } catch (_) {
              scene.background = new THREE.Color("#1a2030");
            }
          }
        }}
      >
        <IsometricCamera
          target={playerRootRef.current}
          mode={cameraMode}
          elevationDeg={30}
          azimuthDeg={45}
          distance={32}
          frustumSize={20}
          smoothing={0.08}
        />

        {/* Lighting iso 3-tons soft */}
        <ambientLight intensity={0.55} />
        <directionalLight
          position={[10, 18, 8]}
          intensity={1.6}
          color="#fff8e7"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <directionalLight position={[-8, 10, -6]} intensity={0.45} color="#a8c5ff" />

        {/* Sol (test_arena = plane simple, sinon GLB Sprint 4) */}
        {!activeMap?.glbPath && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[
              (activeMap?.grid.width || 14) * (activeMap?.grid.cellSize || 1) * 1.5,
              (activeMap?.grid.height || 14) * (activeMap?.grid.cellSize || 1) * 1.5,
            ]} />
            <meshStandardMaterial color={activeMap?.groundColor || "#2a3848"} roughness={0.95} />
          </mesh>
        )}

        {/* Grille tactique */}
        {activeMap && (
          <TileGrid
            width={activeMap.grid.width}
            height={activeMap.grid.height}
            cellSize={activeMap.grid.cellSize}
            reachable={combat.state.reachableCells}
            attackable={combat.state.attackableCells}
            aoe={combat.state.aoeCells}
            hovered={hoveredCell}
            onCellHover={setHoveredCell}
            onCellClick={handleCellClick}
          />
        )}

        {/* Entites (joueur + monstres) */}
        {activeMap && Object.values(combat.state.entities).map((entity) => {
          const def = defs[entity.id];
          if (!def) return null;
          return (
            <EntityView
              key={entity.id}
              entity={entity}
              definition={def}
              grid={activeMap.grid}
              selected={selectedEntityId === entity.id}
              onSelect={setSelectedEntityId}
              onRootReady={setEntityRoot}
            />
          );
        })}
      </Canvas>

      {/* HUD overlay 2D */}
      <HudOverlay
        state={combat.state}
        playerEntityId={playerEntity?.id || null}
        spellsById={registry?.spells || {}}
        onSelectSpell={combat.selectSpell}
        onEndTurn={combat.endTurn}
        onStartCombat={handleStartCombat}
      />

      {/* Top-right controls */}
      <div style={{ position: "absolute", top: 12, right: 12, zIndex: 50, display: "flex", gap: 8 }}>
        <button
          onClick={() => setCameraMode((m) => (m === "follow_smooth" ? "fixed" : "follow_smooth"))}
          style={btnStyle}
        >
          Cam: {cameraMode}
        </button>
        <button onClick={handleResetChoice} style={btnStyle}>
          Changer combat
        </button>
      </div>

      {/* Bottom-left help */}
      <div style={{ ...helpStyle }}>
        Click entité: selection | Click cellule: log | M: cam mode
      </div>
    </div>
  );
}

/* ===========================================================================
 * Helpers
 * =========================================================================== */

function buildCombatEntity(
  def: EntityDefinition,
  cell: GridCell,
  registry: RegistryShape
): CombatEntity {
  const spells = (def.spellIds || [])
    .map((id) => registry.spells[id])
    .filter(Boolean);

  return {
    id: def.id,
    name: def.name,
    faction: def.faction,
    modelPath: def.model.basePath,
    cell: { ...cell },
    stats: def.stats || {
      hp: 1, hpMax: 1, pa: 0, paMax: 0, pm: 0, pmMax: 0, initiative: 0,
    },
    spells,
    isPlayer: def.kind === "player",
    isDead: false,
  };
}

const btnStyle: React.CSSProperties = {
  padding: "6px 12px",
  background: "rgba(11, 15, 21, 0.85)",
  color: "#cfe8ff",
  border: "1px solid #2a3848",
  borderRadius: 6,
  fontFamily: "ui-monospace, monospace",
  fontSize: 11,
  cursor: "pointer",
  backdropFilter: "blur(6px)",
};

const helpStyle: React.CSSProperties = {
  position: "absolute",
  bottom: 12,
  left: 12,
  padding: "6px 10px",
  background: "rgba(11, 15, 21, 0.78)",
  color: "#9ab8d4",
  border: "1px solid #2a3848",
  borderRadius: 6,
  fontFamily: "ui-monospace, monospace",
  fontSize: 10,
  pointerEvents: "none",
  backdropFilter: "blur(6px)",
  zIndex: 40,
};
