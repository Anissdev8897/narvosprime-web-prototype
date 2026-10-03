
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  GameState, EntityType, PlayerEntity, CameraMode, SceneMode,
  GlobalSettings, AIState, Faction, Rank, PlayerClass, Gender
} from '../types';
import { GridType } from '../types';
import { INITIAL_SPAWN_POS, CAMERA_PROFILES, FACTION_COLORS, BASE_PLAYER_STATS, CLASSES_DB, DEFAULT_SPRITE_CONFIG, ITEMS_DB } from '../constants';

// UI Components
import { InGameMenu } from './InGameMenu';
import { GameUI } from './GameUI';

// Core Systems
import { WorldGenerator } from '../core/WorldGenerator';
import { InputSystem } from '../core/InputSystem';
import { PhysicsSystem } from '../core/PhysicsSystem';
import { CombatSystem } from '../core/CombatSystem';
import { AISystem } from '../core/AISystem';
import { TacticalCombatSystem } from '../core/TacticalCombatSystem'; // INTEGRATED
import { GridSystem } from '../core/GridSystem';
import { DofusRenderer } from '../core/DofusRenderer';

// Services
import { PlayerMovement } from '../services/PlayerMovement';
import { SpriteService } from '../services/spriteService';
import { reputationService } from '../services/reputationService';
import { CharacterData } from '../services/databaseService';
import { breedService } from '../services/breedService';
import { DOFUS_SPELLS } from '../data/dofusSpells';
import { DofusNpc } from '../data/dofusNpcs';

interface GameEngineProps {
  settings: GlobalSettings;
  onUpdateSettings: (s: GlobalSettings) => void;
  onExit: () => void;
  initialMapId?: string | null;
  initialFaction?: string | null;
  characterData?: CharacterData | null;
}

export const GameEngine = ({ settings, onUpdateSettings, onExit, initialMapId = 'station', initialFaction, characterData }: GameEngineProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef(new THREE.Clock());

  // Tactical & Dofus State
  const [selectedSpellId, setSelectedSpellId] = useState<string | null>(null);
  const [isFightActive, setIsFightActive] = useState(false);
  const [currentTurnTime, setCurrentTurnTime] = useState(30);

  // Dofus Class Config
  const breed = characterData?.breedId ? breedService.getBreedById(characterData.breedId) : null;
  const initialStats = breed ? breedService.calculateStats(breed, characterData?.level || 1) : BASE_PLAYER_STATS;
  const spriteConfig = DEFAULT_SPRITE_CONFIG; // TODO: Custom per breed

  // AP/MP State
  const [currentAp, setCurrentAp] = useState(initialStats.ap || 6);
  const [currentMp, setCurrentMp] = useState(initialStats.mp || 3);

  // Engine States
  const [sceneMode, setSceneMode] = useState<SceneMode>(SceneMode.PLANET);
  const [activePlanetId, setActivePlanetId] = useState<string | null>(initialMapId || 'hub');
  const [isPaused, setIsPaused] = useState(false);
  const [showFullSettings, setShowFullSettings] = useState(false);
  const [isBackupMenuOpen, setIsBackupMenuOpen] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>(CameraMode.DOFUS_2D); // Default Dofus Mode
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Inventory logic
  const [showInventory, setShowInventory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Dialogue
  const [selectedNpc, setSelectedNpc] = useState<DofusNpc | null>(null);
  const [isDialogueOpen, setIsDialogueOpen] = useState(false);

  // THREE Refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const dofusCameraRef = useRef<THREE.OrthographicCamera | null>(null); // For Dofus Mode
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const playerMeshRef = useRef<THREE.Mesh | null>(null);
  const selectionRaycaster = useRef(new THREE.Raycaster());

  // Systems Refs
  const worldGeneratorRef = useRef<WorldGenerator | null>(null);
  const playerMovementRef = useRef<PlayerMovement>(new PlayerMovement(new THREE.Vector3(INITIAL_SPAWN_POS.x, INITIAL_SPAWN_POS.y, INITIAL_SPAWN_POS.z)));
  const physicsSystemRef = useRef<PhysicsSystem | null>(null);
  const combatSystemRef = useRef<CombatSystem | null>(null);
  const tacticalSystemRef = useRef<TacticalCombatSystem | null>(null);
  const aiSystemRef = useRef<AISystem | null>(null);
  const inputSystemRef = useRef<InputSystem | null>(null);
  const gridSystemRef = useRef<GridSystem>(new GridSystem(20, 6.4, new THREE.Vector3(0, 0, 0), 'ISOMETRIC' as GridType));
  const dofusRendererRef = useRef<DofusRenderer | null>(null);

  // Lists
  const interactablesRef = useRef<THREE.Object3D[]>([]);

  // Player Ref
  const playerRef = useRef<PlayerEntity>({
    id: 1,
    name: characterData?.name || 'Ame Neuve',
    gender: characterData?.customization?.gender || Gender.MALE,
    type: EntityType.HUMANOID,
    position: { ...INITIAL_SPAWN_POS },
    velocity: { x: 0, y: 0, z: 0 },
    rotation: 0,
    pitch: 0,
    color: '#ffffff',
    speed: 0.12,
    size: 1,
    stats: {
      armor: 0,
      maxArmor: 100,
      oxygen: 100,
      maxOxygen: 100,
      range: 0,
      ...initialStats // Merge Dofus stats
    },
    faction: characterData?.faction || Faction.HUMAN,
    class: characterData?.class || PlayerClass.PRESSURE_MANIPULATOR,
    customization: characterData?.customization,
    spriteConfig: spriteConfig,
    animation: { current: 'IDLE', frame: 0, direction: 0, lastUpdate: 0 },
    isDead: false,
    inventory: [],
    rank: Rank.SOLDIER,
    level: characterData?.level || 1,
    experience: characterData?.experience || 0,
    equippedItems: {},
    reputation: {},
    currentAp: initialStats.ap || 6,
    currentMp: initialStats.mp || 3,
    userData: { breedId: characterData?.breedId || 1 }
  });

  // INITIALIZATION
  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1e293b);
    sceneRef.current = scene;

    const aspect = window.innerWidth / window.innerHeight;
    const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 10000);
    cameraRef.current = camera;

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x1e293b, 1.0);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 3. Dofus Renderer Logic (Hidden container for math/grid)
    const dummyDiv = document.createElement('div'); // Offscreen
    dofusRendererRef.current = new DofusRenderer(dummyDiv);

    // 4. Systems
    physicsSystemRef.current = new PhysicsSystem(cameraRef.current!, playerMovementRef.current);
    combatSystemRef.current = new CombatSystem(sceneRef.current!);
    worldGeneratorRef.current = new WorldGenerator(sceneRef.current!);

    // Init Tactical System
    tacticalSystemRef.current = new TacticalCombatSystem(sceneRef.current!, dofusRendererRef.current);

    // 5. Load Map
    worldGeneratorRef.current.loadPlanetScene(initialMapId || 'hub', (newAspect) => {
      if (gridSystemRef.current) gridSystemRef.current.setAspectRatio(newAspect);
    }, initialFaction).then((mapName) => {
      console.log(`🗺️ Map Loaded: ${mapName}`);
      // spawn player
      const spawn = gridSystemRef.current.gridToWorld(8, 8);
      playerMovementRef.current.setPosition(spawn);
    });

    // 6. Lights
    const ambient = new THREE.AmbientLight(0xffffff, 2.0);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(50, 100, 50);
    scene.add(sun);

    // 7. Player Sprite
    const playerSprite = SpriteService.createSprite(spriteConfig, characterData?.customization);
    playerSprite.position.copy(playerMovementRef.current.getPosition());
    scene.add(playerSprite);
    playerMeshRef.current = playerSprite;

    // 8. Event Listeners
    const handleResize = () => {
      if (!camera || !renderer) return;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') setCameraMode(CameraMode.TACTICAL_ISO);
      if (e.key === 'F2') setCameraMode(CameraMode.DOFUS_2D);
      if (e.key === 'Escape') {
        setIsPaused(p => !p);
        setShowFullSettings(prev => !prev);
      }
      if (e.key.toLowerCase() === 'i') setShowInventory(p => !p);
      if (e.key.toLowerCase() === 'm') setIsMapOpen(p => !p);
    };
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      renderer.dispose();
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, []); // Run once

  // GAME LOOP
  useEffect(() => {
    let reqId: number;
    let lastUiUpdate = 0;

    const animate = () => {
      const delta = clockRef.current.getDelta();
      const now = Date.now();

      if (!isPaused && rendererRef.current && sceneRef.current && cameraRef.current) {

        // Tactical Update
        if (tacticalSystemRef.current) {
          tacticalSystemRef.current.update(delta);

          // UI Sync (10Hz is enough)
          if (now - lastUiUpdate > 100) {
            setIsFightActive(tacticalSystemRef.current.isFightActive());
            setCurrentTurnTime(tacticalSystemRef.current.getCurrentTurnTimeRemaining());
            lastUiUpdate = now;
          }
        }

        // Normal Movement Update (Only if NOT fighting)
        if (physicsSystemRef.current && playerMeshRef.current && !isFightActive) { // STOP movement if fighting
          physicsSystemRef.current.updateGroundMovement(
            playerRef.current, playerMeshRef.current, cameraRef.current,
            new Set(), delta, [], cameraMode
          );
        }

        // Always update camera
        if (physicsSystemRef.current && playerMeshRef.current) {
          physicsSystemRef.current.applyCamera(cameraRef.current, playerMeshRef.current.position, cameraMode);

          // Animation update
          if (playerRef.current.animation && playerMeshRef.current instanceof THREE.Mesh) {
            SpriteService.updateSprite(playerMeshRef.current, playerRef.current.animation, delta);
          }
          // Billboard
          playerMeshRef.current.quaternion.copy(cameraRef.current.quaternion);
        }

        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
      reqId = requestAnimationFrame(animate);
    };
    reqId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(reqId);
  }, [isPaused, cameraMode, isFightActive]); // Re-bind if isFightActive changes


  // MOUSE INPUT (Tactical / Click-to-move)
  const handleMouseDown = (e: React.MouseEvent) => {
    // 1. TACTICAL FIGHT START (Click on Monster)
    if (cameraMode === CameraMode.DOFUS_2D && !isFightActive && sceneRef.current) {
      // Simple Raycast
      const rect = rendererRef.current?.domElement.getBoundingClientRect();
      if (!rect) return;
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      selectionRaycaster.current.setFromCamera(mouse, cameraRef.current!);

      // Check Monsters
      const monsters = sceneRef.current.children.filter(o => o.userData?.type === EntityType.MONSTER);
      const intersects = selectionRaycaster.current.intersectObjects(monsters);

      if (intersects.length > 0) {
        console.log("⚔️ COMBAT LANCÉ !");
        // Start Fight
        // We need actual monster entities, create dummy for now if missing
        const dummyMonster = {
          id: 1, name: 'Bouftou', level: 5,
          mesh: intersects[0].object,
          userData: {
            stats: { hp: 50, ap: 4, mp: 3 }
          }
        };
        tacticalSystemRef.current?.startFight(playerRef.current, [dummyMonster as any]);
      }
    }

    // Logic for clicking on grid
    if (cameraMode === CameraMode.DOFUS_2D || cameraMode === CameraMode.TACTICAL_ISO) {
      // Raycast logic here
      // Use gridSystemRef.current.findPath for MP usage
      // Use combatSystem/tacticalSystem for spells
    }
  };

  // HANDLERS
  const handleEndTurn = () => {
    tacticalSystemRef.current?.nextTurn();
  };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden select-none" onMouseDown={handleMouseDown}>
      {/* 3D Viewport */}
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {/* REACT UI */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <div className="pointer-events-auto">
          <GameUI
            player={playerRef.current}
            activePlanetId={activePlanetId || 'hub'}
            isPaused={isPaused}
            showFullSettings={showFullSettings}
            showSettingsMenu={showSettings}
            setShowSettingsMenu={setShowSettings}
            showInventory={showInventory}
            setShowInventory={setShowInventory}
            isTransitioning={isTransitioning}
            sceneMode={sceneMode}
            cameraMode={cameraMode}
            isEditMode={false}
            selectedSpellId={selectedSpellId}
            onSelectSpell={setSelectedSpellId}
            currentAp={currentAp}
            currentMp={currentMp}
            isBackupMenuOpen={isBackupMenuOpen}
            setIsBackupMenuOpen={setIsBackupMenuOpen}
            onExit={onExit}
            onOpenBackups={() => setIsBackupMenuOpen(true)}
            settings={settings}
            selectedNpc={selectedNpc}
            isDialogueOpen={isDialogueOpen}
            onCloseDialogue={() => setIsDialogueOpen(false)}
            onUpdateSettings={onUpdateSettings}
            isMapOpen={isMapOpen}
            onCloseMap={() => setIsMapOpen(false)}
            onEquip={() => { }} // TODO
            isFightActive={isFightActive}
            currentTurnTime={currentTurnTime}
            onEndTurn={handleEndTurn}
          />
        </div>

        {isPaused && (
          <div className="pointer-events-auto">
            <InGameMenu
              settings={settings}
              onUpdate={onUpdateSettings}
              onResume={() => setIsPaused(false)}
              onExit={onExit}
              onOpenBackups={() => setIsBackupMenuOpen(true)}
            />
          </div>
        )}
      </div>
    </div>
  );
};
