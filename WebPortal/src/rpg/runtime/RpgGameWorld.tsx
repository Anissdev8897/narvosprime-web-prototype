// ══════════════════════════════════════════════════════════════════════════════
// runtime/RpgGameWorld.tsx — Monde de jeu RPG (R3F)
//
// Assemble : Map + Joueur animé + Caméra FPS/TPS + PNJ + HUD complet
// (HP/Mana, sorts, inventaire, boutique, butin).
//
// Voyage spatial : les vaisseaux sont des véhicules physiques pilotables.
// Le joueur approche un vaisseau → E pour embarquer → pilote jusqu'à
// l'altitude 300 m (atmosphère) → le vaisseau perce l'atmosphère → warp.
// En hub orbital, piloter vers une planète déclenche l'atterrissage.
// ══════════════════════════════════════════════════════════════════════════════

import { Component, Suspense, memo, useMemo, useRef, useState, useCallback, useEffect, useLayoutEffect } from "react";
import type { ReactNode, MutableRefObject } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { CanvasErrorBoundary } from "./CanvasErrorBoundary";
import { AdminPanel, AdminFloatingButton, isAdmin } from "./admin/AdminPanel";
import { TunableEnvironment } from "./environment/TunableEnvironment";
import { CollisionDebugOverlay } from "./debug/CollisionDebugOverlay";
import { LoadingScreen } from "./loading/LoadingScreen";
import * as THREE from "three";

import type { CharacterConfig, ClassId, ElementId } from "../types";
import { CLASSES } from "../classes/classes";
import { ELEMENTS } from "../elements/elements";
import { MAPS, getMapChunks, getMapChunkDir } from "../loaders/assetManifest";
import { qualityVariant, refreshQualityCache } from "../loaders/assetQuality";
import { mapLoaderExtend, registerRenderer } from "../loaders/sharedLoaders";
import { RendererRegistrar } from "../loaders/RendererRegistrar";
import { PuzzleMap } from "./PuzzleMap";
import { StreamingPuzzleMap } from "./StreamingPuzzleMap";
import { MonolithicMap } from "./MonolithicMap";
import { playerPositionStore } from "../wasm/playerPositionStore";
import { loadNarvosEngine } from "../wasm/WasmBridge";
import { WasmWorldTicker } from "../wasm/WasmWorldTicker";
import { StreamingDebugHud } from "./StreamingDebugHud";
import { TerrainMaterialPanel } from "../materials/TerrainMaterialPanel";
import { collisionWorld } from "./CollisionWorld";
import { mapBoundsStore } from "./mapBoundsStore";
import { streamingDiagnostics } from "./streamingDiagnostics";
import { screenShake } from "./screenShake";
import { arrowPool } from "./combat/arrowSystem";
import { createAutoAttackHandler, createUnarmedStrikeHandler } from "./combat/AutoAttackSystem";
import { noclipUi, NoclipIndicator, noclipDefault } from "./movement/noclipUi";
import { hydrateAllStores, rehydrateIfPartial } from "./loading/hydrateAll";
import { ContextLossGuard } from "./ContextLossGuard";
import { NpcMeshWarmup } from "../npc/NpcMeshWarmup";
import { AssetReloadButton } from "./loading/AssetReloadButton";
import { ArrowMutationAdmin, ArrowMutationButton } from "./combat/ArrowMutationAdmin";
import { BodyTintAdmin, BodyTintButton } from "../characters/BodyTintAdmin";
import { arrowMutationStore } from "./combat/arrowMutationStore";
import { ArrowRenderer } from "./combat/ArrowRenderer";
import { cameraRecoil } from "../camera/CameraRecoilController";
import { statusEffects } from "../combat/statusEffects";
import { createCombo, advanceCombo, unarmedDamage, CHARGE_MS } from "../combat/unarmedCombat";
import { npcHitReact, type HitReactKind } from "../combat/npcHitReact";
import { respawnManager, useRespawnVersion, DEFAULT_RESPAWN_SEC } from "../npc/respawnManager";
import { dungeonRun, useDungeonRun } from "./donjon/dungeonRun";
import { DungeonChest } from "./donjon/DungeonChest";
import { serverRules, type ServerType } from "./serverRules";
import { expeditionLedger } from "../combat/expeditionLedger";
import { hardcoreLadder, markFallen, isFallen } from "./hardcoreLadder";
import { damageEvents } from "../combat/damageEvents";
import { rollDamage } from "../combat/rollDamage";
import { DamageNumbers } from "../combat/DamageNumbers";
import { MinimapHud } from "./MinimapHud";
import { mapGenStore, useMapGen } from "../mapgen/mapGenStore";
import { SpawnPointGizmo } from "./SpawnPointGizmo";
import { MapBoundsGizmo } from "./MapBoundsGizmo";
import { MapBoundsPanel } from "./MapBoundsPanel";
import { spawnPointStore } from "./spawnPointStore";
import { gameModeStore, useGameMode, editMode } from "./gameModeStore";
import { isCustomCharacter, customCharacterStore } from "../characters/customCharacterStore";
import { worldStore } from "../world/worldStateStore";
import { WorldStatePanel } from "../world/WorldStatePanel";
import { MapGenPanel } from "../mapgen/MapGenPanel";
import { MapGenPreview } from "../mapgen/MapGenPreview";
import { ForgeBuiltMap } from "../forge/ForgeBuiltMap";
import { ammoStore } from "../combat/ammoStore";
import { equippedWeaponStore } from "../weapons/equippedWeaponStore";
import { magazineStore } from "../weapons/magazineStore";
import { weaponRegistry } from "../weapons/weaponRegistry";
import { classifyWeapon } from "../weapons/weaponClassifier";
import { archetypeCanReload, archetypeAllowsWeapon } from "../weapons/weaponClassRules";
import { cooldownStore } from "../combat/cooldownStore";
import { audioEvents } from "../audio/audioEventManager";
import { archetypeStore } from "../archetypes/archetypeStore";
import { ARCHETYPES, type ArchetypeSpell } from "../archetypes/archetypeCatalog";
import { executeArchetypeSpell } from "../archetypes/castArchetypeSpell";
import { ArchetypePanel, ArchetypeFloatingButton } from "../archetypes/ArchetypePanel";
import { ArchetypeCooldownHud } from "../archetypes/ArchetypeCooldownHud";
import { KillStreakHud } from "../audio/KillStreakHud";
import { preloadArchetypeAssetsIdle } from "../archetypes/preloadArchetypeAssets";
import { weaponOffsetStore } from "../weapons/weaponOffsetStore";
import { weaponCalibrationStore } from "../weapons/weaponCalibrationStore";
import { WeaponGizmo } from "../weapons/WeaponGizmo";
import { WeaponOffsetAdmin, WeaponOffsetAdminButton } from "../weapons/WeaponOffsetAdmin";
import { CharacterOffsetAdmin, CharacterOffsetAdminButton } from "../characters/CharacterOffsetAdmin";
import { characterOffsetStore } from "../characters/characterOffsetStore";
import { animClipStore } from "../animation/animClipStore";
import { RecoilAdminPanel, RecoilAdminButton } from "../camera/RecoilAdminPanel";
import { recoilProfileStore } from "../camera/recoilProfileStore";
import { PlayerRig } from "./movement/PlayerRig";
import { createPlayerState } from "./movement/playerState";
import { SpaceEnvironment, SHIP_FORGE, SHIP_TOWER, SHIP_LONGSWORD, SPACE_BOUNDARY_RADIUS } from "./SpaceEnvironment";
import { SpaceWarfare } from "./space/SpaceWarfare";
import { ShipController } from "./vehicles/ShipController";
import { ShipTelemetry, ShipTelemetryState, ShipAtmosphereTrigger, SpaceLandingTrigger, SpatialBoundary, SPACE_PLANETS } from "./vehicles/ShipFlightUI";
import { createVehicleController } from "./vehicles/GroundVehicleController";
import { PilotableShip, SHIP_HOVER_HEIGHT } from "./vehicles/PilotableShip";
import { VEHICLE_CATALOG, getVehicleDef, type VehicleId } from "./vehicles/vehicleCatalog";
import { ShipDestructionWatcher } from "./vehicles/ShipDestructionWatcher";
import { ExplosionVfx } from "./vehicles/ExplosionVfx";
import { PauseMenu } from "./PauseMenu";
import { CharacteristicsPanel } from "./CharacteristicsPanel";
import { InventoryPanel } from "./InventoryPanel";
import { elementDamageMult, elementResistMult } from "../stats/characteristics";
import { gameSettings, QUALITY_DPR, QUALITY_SHADOW_MAP, hydrateSettingsFromDb } from "../settings/gameSettings";
import { hydrateScaleFromDb } from "../characters/characterScale";
import { hydrateOffsetFromDb } from "../characters/cameraOffset";
import { environmentStore } from "./environment/environmentStore";
import { PostProcessingPipeline } from "./postfx/PostProcessingPipeline";
import { applyAnisotropy } from "./sceneUtils";
// HumanCharacter (Sorcerer legacy) retiré — fichiers Sorcerer supprimés.
// Fallback final = OwnAnimPlayerCharacter(WRAITH_BASE).
import { MeshyPlayerCharacter } from "../characters/MeshyPlayerCharacter";
import { OwnAnimPlayerCharacter } from "../characters/OwnAnimPlayerCharacter";
import { isMeshyAvatar, ownAnimPath, ownAnimScale, avatarSharedRig, DEFAULT_AVATAR } from "../characters/playerAvatars";
import { WRAITH_BASE } from "../characters/avatarAssets";
import { Npc } from "../npc/Npc";
import { MerchantNpc } from "../npc/MerchantNpc";
import { WeaponMasterNpc } from "../npc/WeaponMasterNpc";
import { MerchantPanel } from "./MerchantPanel";
import { MERCHANTS, getMerchant } from "../npc/merchants";
import { getNpc } from "../npc/npcCatalog";
import { reputationStore } from "../reputation/reputationStore";
import { REP_GAINS } from "../reputation/reputationCatalog";
import { eventBus } from "./core/EventBus";
import { NpcAdminPanel, NpcAdminFloatingButton } from "../npc/NpcAdminPanel";
import { NpcPlacementGizmo } from "../npc/NpcPlacementGizmo";
import { useNpcPlacements } from "../npc/useNpcPlacements";
import { installNpcDiagnostic } from "../npc/npcVisibilityDiagnostic";
import { cameraViewStore, useCameraView } from "../camera/cameraViewStore";
import { useNpcAdmin } from "../npc/useNpcAdmin";
import { npcAdminStore } from "../npc/npcAdminStore";
// ── Donjon : portail plaçable + instance séparée ────────────────────────────
import { DonjonAdminPanel, DonjonAdminFloatingButton } from "./donjon/DonjonAdminPanel";
import { PortalZone } from "./donjon/PortalZone";
import { PortalPlacementGizmo } from "./donjon/PortalPlacementGizmo";
import { DonjonLighting } from "./donjon/DonjonLighting";
import { usePortals } from "./donjon/usePortals";
import { usePortalAdmin } from "./donjon/usePortalAdmin";
import { portalAdminStore } from "./donjon/portalAdminStore";
import { mapSpawn } from "./mapConfig";
import { npcPlacementStore } from "../npc/npcPlacementStore";
import { portalStore } from "./donjon/portalStore";
import { TransformGizmo } from "./editor/TransformGizmo";
import { BossAoeZone, type BossAoe } from "../spells/BossAoeZone";
import { MonsterGate } from "./donjon/MonsterGate";
import { MonsterGateWatcher } from "./donjon/MonsterGateWatcher";
import { SpellVFX } from "../spells/SpellVFX";
import type { ActiveSpell } from "../spells/SpellVFX";
import type { SpellDef } from "../spells/SpellDef";
import { GameHUD } from "./GameHUD";
import { targetingStore } from "./targeting/targetingStore";
import { TargetHealthBar } from "../ui/TargetHealthBar";
import { LootPanel } from "../ui/LootPanel";
import type { CorpseLootData } from "../ui/LootPanel";
import { chestRegistry } from "../loot/chestRegistry";
import type { ChestHandle } from "../loot/chestRegistry";
import { MAP_CHESTS } from "../loot/chestCatalog";
import { LootChest } from "./LootChest";
import { WorldFeed } from "./feed/WorldFeed";
import { FactionsAIRunner } from "./factions-ai/FactionsAIRunner";
import { EventDirectorRunner } from "./world-events/EventDirectorRunner";
import { WorldEventsRenderer } from "./world-events/WorldEventsRenderer";
import { SpaceRadar } from "./radar/SpaceRadar";
import { createStats, addXp, regenTick, effectiveStats } from "../stats/PlayerStats";
import type { PlayerStats } from "../stats/PlayerStats";
import { loadProgression, readProgressionDb, saveProgression } from "../stats/progressionStore";
import { flushDb } from "../persistence/dbStore";
import { createInventory, createInventoryForClass, addItem, addCredits, consumeItem, findFirstHealPotion, findFirstManaPotion, STARTER_ITEMS, STARTER_CREDITS } from "../loot/Inventory";
import { LOOT_CATALOG, rollLoot } from "../loot/LootRegistry";
import { consumableSlotsStore } from "../loot/consumableSlots";
import { ConsumableBar } from "./ConsumableBar";
import { StatusEffectHud } from "../ui/StatusEffectHud";
import { StaminaBar } from "../ui/StaminaBar";
import { AnimDebugHud } from "../ui/AnimDebugHud";
import { TimeHud } from "../ui/TimeHud";
import { WeatherHud } from "../ui/WeatherHud";
import { questStore } from "../quests/questStore";
import { professionStore } from "../professions/professionStore";
import { HarvestNode } from "../professions/HarvestNode";
import { HarvestProximityTicker } from "../professions/HarvestProximityTicker";
import { StressBots } from "./debug/StressBots";
import { PerfProbe, PerfHud } from "./debug/PerfOverlay";
import { StressTestPanel } from "./debug/StressTestPanel";
import { AmmoHud } from "./AmmoHud";
import { harvestRegistry } from "../professions/harvestRegistry";
import { BucheronAxeViewmodel } from "../professions/BucheronAxeViewmodel";
import { FpsWeaponViewmodel } from "../weapons/FpsWeaponViewmodel";
import { FpsUnarmedViewmodel } from "../weapons/FpsUnarmedViewmodel";
import { GunVfxPool, gunVfx } from "../weapons/GunVfx";
import { getShotgunFps } from "../weapons/shotgunFpsRegistry";
import { PetSummon } from "../pets/PetSummon";
import { getPetSummon, type PetSummonDef, getCompanion } from "../pets/petSummons";
import { CompanionPet } from "../pets/CompanionPet";
import { petStore, usePetStore } from "../pets/petStore";
import { PetPanel } from "../ui/PetPanel";
import { AmbientAnimal } from "../ambient/AmbientAnimal";
import { ambientSpawnsForMap } from "../ambient/ambientSpawns";
import { getAmbientAnimal } from "../ambient/ambientAnimals";
import { GatherMiniGame } from "../professions/GatherMiniGame";
import { ProfessionPanel, ProfessionFloatingButton } from "../professions/ProfessionPanel";
import { CraftingPanel } from "../professions/CraftingPanel";
import { craftedLootItem } from "../professions/craftedItems";
import { getProfession } from "../professions/professionCatalog";
import { bestTierForLevel, type ProfessionId } from "../professions/professionTypes";
import { usePlacedHarvestNodes } from "../professions/useHarvestNodeStore";
import { harvestNodeStore } from "../professions/harvestNodeStore";
import { harvestNodeAdminStore, useHarvestNodeAdmin } from "../professions/harvestNodeAdminStore";
import { HarvestPlacementGizmo } from "../professions/HarvestPlacementGizmo";
import { HarvestNodeAdminPanel, HarvestNodeAdminFloatingButton } from "../professions/HarvestNodeAdminPanel";
import { QuestJournal } from "../quests/QuestJournal";
import { QuestTracker } from "../quests/QuestTracker";
import type { QuestDef } from "../quests/questCatalog";
import { TalentTreePanel } from "../talents/TalentTreePanel";
import { aggregateTalents } from "../talents/talentEffects";
import { talentRuntime } from "../talents/talentRuntime";
import type { InventoryState } from "../loot/Inventory";
import { canAdd } from "../loot/bags";
import { npcRegistry } from "../npc/npcRegistry";
import type { CorpseLoot, NpcHandle } from "../npc/npcRegistry";
import { audioManager } from "../../utils/AudioManager";
import { ChatPanel } from "../chat/ChatPanel";
import { registerAdminCommands } from "../chat/registerAdminCommands";
import { chatStore } from "../chat/chatStore";
import { PropPlacer } from "../props/PropPlacer";
import { PropAdminPanel, PropAdminFloatingButton, useInitialPropAdminState } from "../props/PropAdminPanel";
import { WorldMapOverlay } from "../ui/WorldMapOverlay";
import { EmoteMenu } from "../ui/EmoteMenu";
import { ReputationPanel } from "../ui/ReputationPanel";

// ── Définition des vaisseaux par map ─────────────────────────────────────────
// Source de vérité statique : positions/yaws calés visuellement.
// Les positions des planètes dans SpaceEnvironment doivent correspondre à
// SPACE_PLANETS ci-dessous pour que les landing triggers fonctionnent.
interface ShipDef {
  id: string;
  path: string;
  position: [number, number, number]; // centre du pad de dock
  yaw: number;                        // orientation initiale (radians)
  scale: number;
  color: string;
  label: string;
  // Correction d'axe du maillage GLB → nez aligné sur le -Z moteur.
  // Mesuré par analyse du maillage (effilement du nez) :
  //   chasseur_avion : nez en -X → rotation -90° autour de Y
  //   phamtom        : nez en +Z → rotation 180° autour de Y
  modelRotation: [number, number, number];
}

// Corrections d'axe par modèle (réutilisées entre les maps).
//
// La règle : le vaisseau dans le GLB peut être exporté avec son "nez" pointant
// dans n'importe quelle direction du repère local. Le moteur ShipController
// suppose que le forward du vaisseau est `-Z` (convention Three.js). Ces axes
// font la correction visuelle pour aligner le mesh sur cette convention.
const FORGE_AXIS:     [number, number, number] = [0, -Math.PI / 2, 0]; // chasseur, nez -X
// Phantom : test 1 (-π/2) était "presque bon mais inversé" → +π/2 = nez +X.
const TOWER_AXIS:     [number, number, number] = [0,  Math.PI / 2, 0]; // phamtom, nez +X
// Longsword : même problème que le phantom avant correction → même solution.
const LONGSWORD_AXIS: [number, number, number] = [0,  Math.PI / 2, 0];

const SHIPS_PER_MAP: Partial<Record<keyof typeof MAPS, ShipDef[]>> = {
  forge: [{
    id:       "ship_forge",
    path:     SHIP_FORGE,
    position: [-4, 0, 10],
    yaw:      Math.PI,
    scale:    1.0,
    color:    "#ff7a3c",
    label:    "Chasseur de la Forge",
    modelRotation: FORGE_AXIS,
  }],
  tower: [{
    id:       "ship_tower",
    path:     SHIP_TOWER,
    position: [4, 0, 10],
    yaw:      Math.PI,
    scale:    0.8,
    color:    "#5b9bff",
    label:    "Fantôme Azur",
    modelRotation: TOWER_AXIS,
  }],
  orbital: [
    {
      id:       "orbital_ship_forge",
      path:     SHIP_FORGE,
      position: [-14, 2, -16],
      yaw:      Math.PI * 0.18,
      scale:    1.0,
      color:    "#ff7a3c",
      label:    "Chasseur de la Forge",
      modelRotation: FORGE_AXIS,
    },
    {
      id:       "orbital_ship_tower",
      path:     SHIP_TOWER,
      position: [14, 2, -16],
      yaw:      -Math.PI * 0.18,
      scale:    0.8,
      color:    "#5b9bff",
      label:    "Fantôme Azur",
      modelRotation: TOWER_AXIS,
    },
    {
      id:       "orbital_ship_longsword",
      path:     SHIP_LONGSWORD,
      position: [0, 2, -28],  // centré, plus en retrait
      yaw:      Math.PI,       // face au joueur (entrée par devant)
      scale:    0.4,           // GLB Longsword exporté grand → réduction visuelle
      color:    "#a060ff",     // violet pour distinguer
      label:    "Longsword",
      modelRotation: LONGSWORD_AXIS,
    },
  ],
};

// ── Error boundary R3F ────────────────────────────────────────────────────────
class CharacterErrorBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  constructor(props: { children: ReactNode }) { super(props); this.state = { error: false }; }
  static getDerivedStateFromError() { return { error: true }; }
  componentDidCatch(err: unknown) { console.warn("[CharacterErrorBoundary]", err); }
  render() { return this.state.error ? null : this.props.children; }
}

// ── Map : charge GLB unique + anisotropie + collisions (fallback non-chunké) ──
const MapModel = memo(function MapModel({ path, onReady, offset }: { path: string; onReady?: () => void; offset?: [number, number, number] }) {
  // 4e arg `mapLoaderExtend` = attache le KTX2Loader (maps à textures GPU compressées).
  // Inoffensif sur les maps non encodées KTX2 (le loader est juste ignoré).
  const { scene } = useGLTF(path, true, true, mapLoaderExtend);
  const { gl } = useThree();
  registerRenderer(gl); // renderer dispo pour detectSupport() KTX2 (idempotent)
  const cloned = useMemo(() => scene.clone(), [scene]);
  useMemo(() => {
    if (offset) cloned.position.set(offset[0], offset[1], offset[2]);
    const maxAniso = gl.capabilities.getMaxAnisotropy();
    cloned.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.receiveShadow = true; });
    applyAnisotropy(cloned, maxAniso);
    collisionWorld.registerScene(cloned);
  }, [cloned, gl, offset]);
  // Signale au parent que la map est prête (chargée + indexée). Une fois par
  // instance (la `key` map change → nouvelle instance par voyage).
  const readyRef = useRef(false);
  useEffect(() => {
    if (readyRef.current) return;
    readyRef.current = true;
    onReady?.();
  }, [onReady]);
  return <primitive object={cloned} />;
});

// ── Détection "scène prête" ───────────────────────────────────────────────────
function SceneReady({ onReady }: { onReady: () => void }) {
  const { gl, scene, camera } = useThree();
  const frames = useRef(0);
  const fired  = useRef(false);
  useEffect(() => { try { gl.compile(scene, camera); } catch { /* best-effort */ } }, [gl, scene, camera]);
  useFrame(() => {
    if (fired.current) return;
    if (++frames.current >= 5) { fired.current = true; onReady(); }
  });
  return null;
}

// ── Détection cadavres pillables + ciblage ennemi ─────────────────────────────
const LOOT_RANGE = 3.0;
const AIM_RANGE  = 30;
const AIM_CONE   = Math.PI / 10;
// Tir chargé (Archer) : durée (ms) de maintien pour atteindre la pleine charge (×3).
const CHARGE_TIME_MS = 1400;

function LootProximity({ playerPosition, nearLootRef, onLabelChange }: {
  playerPosition: MutableRefObject<THREE.Vector3>;
  nearLootRef: MutableRefObject<NpcHandle | null>;
  onLabelChange: (label: string | null) => void;
}) {
  const prevLabel = useRef<string | null>(null);
  useFrame(() => {
    const corpses = npcRegistry.lootableCorpsesInRadius(playerPosition.current, LOOT_RANGE);
    const best = corpses.length > 0 ? corpses[0] : null;
    nearLootRef.current = best;
    const label = best ? (best.getLabel?.() ?? best.id) : null;
    if (label !== prevLabel.current) { prevLabel.current = label; onLabelChange(label); }
  });
  return null;
}

const CHEST_RANGE = 3.0;
function ChestProximity({ playerPosition, nearChestRef, onLabelChange }: {
  playerPosition: MutableRefObject<THREE.Vector3>;
  nearChestRef: MutableRefObject<ChestHandle | null>;
  onLabelChange: (label: string | null) => void;
}) {
  const prevLabel = useRef<string | null>(null);
  useFrame(() => {
    const chests = chestRegistry.availableInRadius(playerPosition.current, CHEST_RANGE);
    const best = chests.length > 0 ? chests[0] : null;
    nearChestRef.current = best;
    const label = best ? best.label : null;
    if (label !== prevLabel.current) { prevLabel.current = label; onLabelChange(label); }
  });
  return null;
}

const _fwd = new THREE.Vector3();
function TargetingTicker({ camState }: {
  camState: MutableRefObject<{ yaw: number; pitch: number }>;
}) {
  const { camera } = useThree();
  useFrame(() => {
    camera.getWorldDirection(_fwd);
    const aimed = npcRegistry.findAimedEnemy(camera.position, _fwd, AIM_RANGE, AIM_CONE);
    if (aimed) {
      targetingStore.setTarget({
        id:         aimed.id,
        label:      aimed.getLabel?.() ?? aimed.id,
        hpFraction: aimed.getHpFraction?.() ?? 1,
        maxHp:      aimed.getMaxHp?.() ?? 100,
        level:      aimed.getLevel?.() ?? 1,
      });
    } else {
      targetingStore.setTarget(null);
    }
  });
  return null;
}

// ── Régénération d'endurance métier ───────────────────────────────────────────
// Ticker dans le Canvas : professionStore.regen(dt) remonte l'endurance partagée
// (sans persist à chaque frame — sauvée à la prochaine dépense/XP).
function StaminaRegen() {
  useFrame((_, dt) => professionStore.regen(dt));
  return null;
}

// Ticker combat (effets de statut DoT/root/invis + cooldowns d'ultimes) — horloge centrale.
function StatusEffectTicker() {
  useFrame((_, dt) => { statusEffects.tick(dt); cooldownStore.tick(dt); audioEvents.tick(dt); });
  return null;
}

// ── Surveillance des objectifs "reach" des quêtes ─────────────────────────────
// Sonde ~2×/s la position du joueur ; questStore.recordReach() complète les
// objectifs de zone et retourne les quêtes terminées → onComplete (octroi).
function QuestReachWatcher({ playerPosition, mapId, onComplete }: {
  playerPosition: MutableRefObject<THREE.Vector3>;
  mapId: string;
  onComplete: (defs: QuestDef[]) => void;
}) {
  const tick = useRef(0);
  useFrame(() => {
    if (++tick.current % 30 !== 0) return; // ~2 fps à 60 fps
    const p = playerPosition.current;
    const done = questStore.recordReach(mapId, p.x, p.z);
    if (done.length) onComplete(done);
  });
  return null;
}

// ── Props du monde ────────────────────────────────────────────────────────────
interface RpgGameWorldProps {
  classId: ClassId;
  mapId?: keyof typeof MAPS;
  tint?: string;
  modelId?: string;
  characterId?: string;
  /** Nom affiché (ladder mort définitive). */
  characterName?: string;
  /** Type de serveur choisi : NORMAL (paradisiaque) | HEROIC (mort définitive). */
  serverType?: ServerType;
  /** Ignore la map/position sauvegardée → impose `mapId` (test Forge). */
  forceMap?: boolean;
  onExit?: () => void;
  onReady?: () => void;
}

export function RpgGameWorld({ classId, mapId = "forge", tint, modelId, characterId, characterName, serverType = "NORMAL", forceMap = false, onExit, onReady }: RpgGameWorldProps) {
  // forceMap : ignore la map/position SAUVEGARDÉE (test Forge → on impose la map demandée,
  // sinon la dernière map jouée du perso écrasait le choix → "test forge ouvre donjon").
  const saved = useMemo(() => {
    if (forceMap) return null;
    const p = characterId ? loadProgression(characterId) : null;
    return p && p.classId === classId ? p : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId, forceMap]);

  const playerPos = useRef(
    saved?.position
      ? new THREE.Vector3(saved.position.x, saved.position.y, saved.position.z)
      : new THREE.Vector3(...mapSpawn(mapId)) // spawn de la map demandée (test/forge)
  );
  const camState  = useRef(createPlayerState());

  // Expose la position joueur au streaming WASM (ChunkStreamingManager lit
  // cette ref chaque frame — sans setRef, il tick avec le fallback (0,0,0)
  // et ne charge jamais les chunks éloignés de l'origine).
  useEffect(() => {
    playerPositionStore.setRef(playerPos);
    return () => playerPositionStore.clear();
  }, []);

  const cls     = CLASSES[classId];
  const element = ELEMENTS[cls.element];

  const config: CharacterConfig = useMemo(
    () => ({ gender: "male", classId, outfitStyle: "Ranger", parts: {}, skinColor: "#e0ac69", tint, modelId }),
    [classId, tint, modelId]
  );

  const [stats, setStats] = useState<PlayerStats>(() => saved?.stats ?? createStats(classId));
  const [inventory, setInventory] = useState<InventoryState>(() => {
    const base = saved?.inventory ?? createInventoryForClass(classId);
    // Sauvegarde ANCIENNE au sac vide (antérieure aux objets de départ) : on
    // réinjecte les starters.
    //
    // ⚠ Le plancher de crédits suit `STARTER_CREDITS` et n'est plus écrit en
    // dur. Avec un `200` figé ici, baisser les crédits de départ dans
    // `Inventory.ts` était annulé au premier chargement — sans erreur, sans
    // trace, et seulement pour les sacs vides.
    if (base.items.length === 0) {
      return { ...base, items: [...STARTER_ITEMS], credits: Math.max(base.credits, STARTER_CREDITS) };
    }
    return base;
  });
  const effective = useMemo(() => effectiveStats(stats, inventory.equipped), [stats, inventory.equipped]);
  const effRef    = useRef(effective);
  effRef.current  = effective;

  // ── Carte courante ────────────────────────────────────────────────────────
  const [currentMap, setCurrentMap] = useState<keyof typeof MAPS>(
    () => (saved && saved.mapId in MAPS ? (saved.mapId as keyof typeof MAPS) : mapId)
  );
  const mapRef   = useRef(currentMap);
  mapRef.current = currentMap;
  const isSpace  = currentMap === "orbital";

  const [warp, setWarp] = useState<{ active: boolean; color: string; label: string }>(
    { active: false, color: "#5bd6ff", label: "" }
  );

  // ── Vaisseau piloté ───────────────────────────────────────────────────────
  const [pilotedShipId, setPilotedShipId] = useState<string | null>(null);
  const [nearShipId,    setNearShipId]    = useState<string | null>(null);
  /** Véhicule INVOQUÉ via une clé (consommable). Spawn dynamique en plus des SHIPS_PER_MAP. */
  const [summonedVehicleId, setSummonedVehicleId] = useState<VehicleId | null>(null);
  /**
   * État du véhicule invoqué quand il est ABANDONNÉ (non piloté, posé au sol).
   * - `null` quand le véhicule est piloté (position vient du shipControllerRef)
   * - rempli quand on appuie E (laisser) → le ship reste visible à cette position
   * - vidé quand on ré-embarque ou ramasse avec Shift+E
   */
  const [abandonedShipState, setAbandonedShipState] = useState<{
    pos: [number, number, number];
    yaw: number;
  } | null>(null);
  const [shipTelemetry, setShipTelemetry] = useState<ShipTelemetryState>(
    { speed: 0, altitude: 0, canExit: false, nearGround: false, inSpace: false, stabilized: false, hpRatio: 1, hasHp: false }
  );
  const [boundaryHit, setBoundaryHit] = useState(0);
  const shipControllerRef = useRef<ShipController | null>(null);
  const pilotedShipIdRef  = useRef<string | null>(null);
  const nearShipRef       = useRef<string | null>(null);
  pilotedShipIdRef.current = pilotedShipId;
  nearShipRef.current      = nearShipId;

  // ── Menus modaux ──────────────────────────────────────────────────────────
  const [paused,       setPaused]       = useState(false);
  const [invOpen,      setInvOpen]      = useState(false);
  const [charMenu,     setCharMenu]     = useState(false);
  const [questOpen,    setQuestOpen]    = useState(false);
  const [talentOpen,   setTalentOpen]   = useState(false);
  const [nearMerchant, setNearMerchant] = useState<string | null>(null);
  const [openMerchant, setOpenMerchant] = useState<string | null>(null);
  const [nearWeaponMaster, setNearWeaponMaster] = useState(false); // proximité PNJ Maître d'Armes
  /** Flag pour afficher l'invite de réparation quand on est près du garagiste avec un véhicule endommagé */
  const [showRepairPrompt, setShowRepairPrompt] = useState(false);
  const [videoVer,     setVideoVer]     = useState(0);
  // Génération du cache de variantes de qualité. Distincte de `videoVer` :
  // elle n'avance qu'une fois les HEAD checks refaits, et pilote le remount
  // de la map pour qu'il lise les bons chemins (voir onVideoChange).
  const [assetQualityVer, setAssetQualityVer] = useState(0);
  // Basculement de qualité EN COURS : la map est démontée, on attend que sa
  // mémoire soit rendue avant de remonter la variante suivante.
  const [qualitySwap, setQualitySwap] = useState(false);
  const lastQualityRef = useRef(gameSettings.video.quality);
  // Les deux conditions à réunir avant de remonter : chemins re-résolus (HEAD
  // checks) ET ancienne map libérée. Elles arrivent dans un ordre non garanti.
  const swapPathsReady = useRef(false);
  const swapDisposed = useRef(false);
  // (état noclip UI déplacé dans noclipUi : évite de re-render tout RpgGameWorld au F4)

  // ── Fouille de cadavre ─────────────────────────────────────────────────────
  const nearLootRef = useRef<NpcHandle | null>(null);
  const [nearLootLabel, setNearLootLabel] = useState<string | null>(null);
  const [lootTarget, setLootTarget] = useState<{ data: CorpseLootData } | null>(null);

  // ── Fouille de coffre ──────────────────────────────────────────────────────
  const nearChestRef = useRef<ChestHandle | null>(null);
  const [nearChestLabel, setNearChestLabel] = useState<string | null>(null);

  // ── Mort / Respawn ────────────────────────────────────────────────────────
  // Latch sur la transition currentHp ≤ 0 → écran de mort + blocage input.
  // Le respawn restaure 50% PV / 30% Mana, téléporte au point d'entrée de la
  // map, et purge le combat timer. On expulse le vaisseau si en pilotage.
  const [isDead, setIsDead] = useState(false);
  // ── Mort à ENJEU (P1.3) : règles serveur + ledger d'expédition + ladder hardcore ──
  const [hardcoreDead, setHardcoreDead] = useState(false);
  const lastAttackerRef = useRef("les dangers du monde");
  const sessionStartRef = useRef(performance.now());
  useEffect(() => { serverRules.set(serverType); }, [serverType]);
  useEffect(() => { expeditionLedger.reset(); }, [characterId]);
  // ── Hardcore fallen guard: block replay of permanently dead characters ──
  useEffect(() => {
    if (serverType === "HEROIC" && characterId && isFallen(characterId)) {
      setHardcoreDead(true);
    }
  }, [characterId, serverType]);
  // Au HUB (orbital), TOUT l'état courant est SÉCURISÉ en continu : revenir au hub =
  // sécuriser son butin (la boucle d'extraction). En expédition, le diff est en jeu.
  useEffect(() => {
    if (currentMap === "orbital") expeditionLedger.secure(inventory.items, inventory.credits);
  }, [currentMap, inventory]);

  // ── Panneau Admin (F12 toggle) ────────────────────────────────────────────
  // Réservé aux comptes admin (flag localStorage 'narvos:admin'='1').
  // Phase 1 = slider CHARACTER_SCALE. Phases ultérieures = éditeur PNJ, gizmos…
  const [adminOpen, setAdminOpen] = useState(false);
  const [npcAdminOpen, setNpcAdminOpen] = useState(false);
  const [stressOpen, setStressOpen] = useState(false); // harnais de stress-test (F7, admin)
  const [streamHudOpen, setStreamHudOpen] = useState(false); // diagnostics streaming (F3)
  const [terrainPanelOpen, setTerrainPanelOpen] = useState(false);
  const [minimapOn, setMinimapOn] = useState(true);     // minimap (touche M, rebindable)
  const [spawnEdit, setSpawnEdit] = useState(false);    // édition du point de spawn (admin)
  const [boundsEdit, setBoundsEdit] = useState(false);  // édition des murs invisibles (admin)
  const [boundsSel, setBoundsSel] = useState<string | null>(null); // mur sélectionné
  const [galaxyOpen, setGalaxyOpen] = useState(false);  // moniteur univers vivant (touche N)
  const [propAdminOpen, setPropAdminOpen] = useState(false);
  const [propAdminState, updatePropAdminState] = useInitialPropAdminState();
  const [worldMapOpen, setWorldMapOpen] = useState(false);
  const [emoteMenuOpen, setEmoteMenuOpen] = useState(false);
  const [repPanelOpen, setRepPanelOpen] = useState(false);
  const [petPanelOpen, setPetPanelOpen] = useState(false);
  const petState = usePetStore();
  const gameMode = useGameMode();                        // normal | edit (outils gatés sur edit)
  const edit = isAdmin() && gameMode === "edit";        // outils d'édition visibles ?
  const editRef = useRef(edit); editRef.current = edit;  // pour les handlers clavier (hors render)
  const mapGen = useMapGen();                            // générateur de carte (F6, admin)
  const placedNpcs = useNpcPlacements(currentMap);
  // Diagnostic `__narvosNpcDiag()` — dit, pour chaque PNJ placé, POURQUOI il
  // n'est pas visible. Un PNJ peut attaquer sans apparaître : la logique vit
  // dans npcRegistry, le mesh dans la scène, et rien ne signale l'écart.
  const currentMapRef = useRef(currentMap);
  currentMapRef.current = currentMap;
  useEffect(() => installNpcDiagnostic(() => currentMapRef.current), []);
  const npcAdminCfg = useNpcAdmin();
  useRespawnVersion(); // re-render quand une copie réapparaît (clé epoch + isDead)
  // Configure les points de spawn (délai + position anti-camping). Boss : défaut 0 = ne
  // respawn JAMAIS (le donjon le contrôle) ; mobs : défaut 45 s. Override par placement.
  useEffect(() => {
    for (const p of placedNpcs) {
      respawnManager.configure(p.id, p.respawnSec ?? (p.rank === "boss" ? 0 : DEFAULT_RESPAWN_SEC), p.pos);
    }
  }, [placedNpcs]);
  // Tick de réapparition : 1×/s (léger), anti-camping via la position live du joueur.
  useEffect(() => {
    const iv = window.setInterval(() => {
      respawnManager.tick(performance.now(), { x: playerPos.current.x, z: playerPos.current.z });
    }, 1000);
    return () => window.clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Changement de map → tout le monde revit (les placements de la nouvelle map repartent vivants).
  useEffect(() => { respawnManager.reset(); }, [currentMap]);

  // Déclare la map active aux limites de map. `CharacterController` est du TS
  // pur et ne connaît aucune map : c'est le store qui sait de laquelle il parle,
  // exactement comme `collisionWorld` connaît la scène active. Doit être posé
  // AVANT le premier `useFrame` du rig, sinon la première frame teste les murs
  // de la map précédente.
  useLayoutEffect(() => { mapBoundsStore.setActiveMap(currentMap); }, [currentMap]);

  // ── Chat : commandes admin (/adminmode, /noclip, /tp, /clear, /help) ─────
  useEffect(() => {
    registerAdminCommands(
      (x, y, z) => {
        playerPos.current.set(x, y, z);
      },
      // /respawn — délogue un personnage dont la sauvegarde est empoisonnée.
      // `mapRef` (et non `currentMap`) : cet effet a un tableau de dépendances
      // VIDE, donc lire la variable capturerait la map du premier rendu.
      () => {
        const [sx, sy, sz] = mapSpawn(mapRef.current);
        playerPos.current.set(sx, sy, sz);
        // On relâche le gel physique : le joueur sera reposé au sol par
        // PlayerRig si le point d'apparition flotte au-dessus du terrain.
        camState.current.velocity.set(0, 0, 0);
      },
    );
  }, []);

  // ── Donjon : portails plaçables + éditeur (F10) ───────────────────────────
  const [donjonAdminOpen, setDonjonAdminOpen] = useState(false);
  const [arrowMutOpen, setArrowMutOpen] = useState(false);
  const [bodyTintOpen, setBodyTintOpen] = useState(false);
  const placedPortals = usePortals(currentMap);
  const portalCfg = usePortalAdmin();
  const [nearPortal, setNearPortal] = useState<string | null>(null);
  const nearPortalRef = useRef<string | null>(null);
  nearPortalRef.current = nearPortal;
  const placedPortalsRef = useRef(placedPortals);
  placedPortalsRef.current = placedPortals;
  const dungeonOriginRef = useRef<keyof typeof MAPS>("forge");
  const dungeonReturnPosRef = useRef<[number, number, number] | null>(null); // position d'entrée → retour pile-poil
  const dungeonReturnYawRef = useRef<number | null>(null);                     // rotation d'entrée → restaurée au retour
  const pendingSpawnRef = useRef<[number, number, number] | null>(null);       // spawn forcé (prime sur MAP_SPAWN)
  const pendingYawRef = useRef<number | null>(null);                           // yaw forcé appliqué à l'arrivée
  const enterPortalRef = useRef<(id: string) => void>(() => {});
  const handlePortalProximity = useCallback((id: string, near: boolean) => {
    setNearPortal((prev) => (near ? id : prev === id ? null : prev));
  }, []);
  // Gizmo de transformation : écrit la transform éditée dans le store du PNJ / portail sélectionné.
  const commitNpcTransform = useCallback((pos: [number, number, number], rot: [number, number, number]) => {
    const id = npcAdminStore.get().selectedId;
    if (id) npcPlacementStore.update(currentMap, id, { pos, rot });
  }, [currentMap]);
  const commitPortalTransform = useCallback((pos: [number, number, number], rot: [number, number, number]) => {
    const id = portalAdminStore.get().selectedId;
    if (id) portalStore.update(currentMap, id, { pos, rot });
  }, [currentMap]);

  // ── Métiers / récolte (Bûcheron) ──────────────────────────────────────────
  const [professionPanelOpen, setProfessionPanelOpen] = useState(false);
  // ── Archétypes (classes joueur) : panneau de sélection + cast des sorts ────
  const [archetypeOpen, setArchetypeOpen] = useState(false);
  const [weaponAdminOpen, setWeaponAdminOpen] = useState(false);
  const [charOffsetOpen, setCharOffsetOpen] = useState(false);
  const [recoilAdminOpen, setRecoilAdminOpen] = useState(false);
  const castArchetypeRef = useRef<(spell: ArchetypeSpell, charge?: number) => void>(() => {});
  const autoAttackRef = useRef<() => void>(() => {}); // auto-attaque clic gauche (ref-closure)
  // Combat mains nues : frappe générique (combo / chargé / kick) + détection de maintien.
  const unarmedStrikeRef = useRef<(kind: "combo" | "punch_charged" | "kick" | "kick_charged") => void>(() => {});
  const comboRef = useRef(createCombo());               // état du combo mains nues
  const punchDownAtRef = useRef(0);                      // clic gauche enfoncé à (ms) — charge punch
  const kickDownAtRef = useRef(0);                       // F enfoncé à (ms) — charge kick
  const dodgeUntilRef = useRef(0);                       // fin des i-frames d'esquive (ms)
  const parryUntilRef = useRef(0);                        // fin de la fenêtre de PARADE (ms)
  const parryCooldownRef = useRef(0);                     // anti-spam parade (ms)
  const guardRef = useRef({ active: false, hitsLeft: 0 }); // garde Guerrier (3 coups bloqués)
  const guardPendingRef = useRef(0); // timer tap-vs-maintien du clic gauche Guerrier
  // ── Tir chargé (Archer) : maintien de touche → charge 0..1, relâche → tir ──
  const chargeStartRef = useRef<number | null>(null);  // ms du début de charge (null = pas de charge)
  const chargeSpellRef = useRef<ArchetypeSpell | null>(null);
  const chargeKeyRef   = useRef<string | null>(null);  // code touche maintenue
  const [chargeProgress, setChargeProgress] = useState<number | null>(null); // bar HUD 0..1
  const [nearHarvest, setNearHarvest] = useState<string | null>(null);
  const nearHarvestRef = useRef<string | null>(null);
  nearHarvestRef.current = nearHarvest;
  const [gatherNodeId, setGatherNodeId] = useState<string | null>(null);
  const gatherNodeIdRef = useRef<string | null>(null);
  gatherNodeIdRef.current = gatherNodeId;
  // Bûcheron : jeton de frappe (anim de coupe) + qualité en attente d'impact.
  const [chopSwingToken, setChopSwingToken] = useState(0);
  const chopQualityRef = useRef(0);
  // Invocation de combat active (un seul pet à la fois).
  const [activeSummon, setActiveSummon] = useState<{ def: PetSummonDef; pos: [number, number, number]; key: number } | null>(null);
  const summonKeyRef = useRef(0);
  // Arme dégainée (F) : pilote l'anim (combat vs idle) + la visibilité de l'arme.
  // Vue caméra RÉACTIVE. `camState.current.view` est un ref muté dans useFrame :
  // le lire pendant le rendu ne notifie jamais React (cf. cameraViewStore).
  const cameraView = useCameraView();
  const [weaponDrawn, setWeaponDrawn] = useState(false);
  useEffect(() => { camState.current.weaponDrawn = weaponDrawn; }, [weaponDrawn]);
  // Coupe en cours sur un arbre (bûcheron) → viewmodel FPS + vue forcée.
  const gatheringBucheron = !!gatherNodeId && harvestRegistry.get(gatherNodeId)?.profession === "bucheron";
  // Vue forcée en 1ʳᵉ personne pendant la coupe, restaurée à la fin.
  const prevViewRef = useRef<"fps" | "tps" | null>(null);
  useEffect(() => {
    if (gatheringBucheron) {
      prevViewRef.current = camState.current.view;
      camState.current.view = "fps";
      cameraViewStore.set("fps");      // le miroir suit, sinon React ignore la bascule
      return () => {
        if (prevViewRef.current) {
          camState.current.view = prevViewRef.current;
          cameraViewStore.set(prevViewRef.current);
        }
        prevViewRef.current = null;
      };
    }
  }, [gatheringBucheron]);
  const gatherActiveRef = useRef(false);
  gatherActiveRef.current = gatherNodeId !== null;
  const startGatherRef = useRef<(id: string) => void>(() => {});
  const handleHarvestProximity = useCallback((id: string, near: boolean) => {
    setNearHarvest((prev) => (near ? id : prev === id ? null : prev));
  }, []);
  // Profession + verbe/teinte du nœud en cours de récolte (pour le mini-jeu).
  const gatherProf = gatherNodeId ? harvestRegistry.get(gatherNodeId)?.profession : null;
  const gatherDef = gatherProf ? getProfession(gatherProf) : null;
  // Éditeur de nœuds plaçables (F11) : nœuds de la map + config outil + gizmo.
  const [harvestAdminOpen, setHarvestAdminOpen] = useState(false);
  const placedHarvestNodes = usePlacedHarvestNodes(currentMap);
  const harvestCfg = useHarvestNodeAdmin();
  const commitHarvestTransform = useCallback((pos: [number, number, number], rot: [number, number, number]) => {
    const id = harvestNodeAdminStore.get().selectedId;
    if (id) harvestNodeStore.update(currentMap, id, { pos, rot });
  }, [currentMap]);
  // Atelier d'artisanat ouvert (Forgeron/Alchimiste/Joaillier) ou null.
  const [craftOpen, setCraftOpen] = useState<ProfessionId | null>(null);
  // L'objet fabriqué entre dans l'inventaire principal (équipable / buvable / vendable).
  const handleCraftOutput = useCallback((itemId: string, qty: number) => {
    const def = craftedLootItem(itemId);
    if (!def) return;
    setInventory((inv) => {
      let next = inv;
      for (let i = 0; i < qty; i++) { const fresh = craftedLootItem(itemId); if (fresh) next = addItem(next, fresh); }
      return next;
    });
  }, []);

  // ── AoE de boss (zones télégraphiées violet/rouge) ────────────────────────
  const [activeBossAoes, setActiveBossAoes] = useState<BossAoe[]>([]);
  const lastBossAoeAtRef = useRef(0);   // dernière AoE boss (ms) → musique "boss"
  const lastCombatAtRef  = useRef(0);   // dernier coup reçu (ms) → musique "combat"
  const archAoeSeq = useRef(0);         // compteur d'ID pour les AoE esquivables du joueur
  const handleBossAoe = useCallback((aoe: BossAoe) => {
    if (!aoe.targetEnemies) {
      lastBossAoeAtRef.current = performance.now();
      audioEvents.bossEngaged(aoe.id);
    }
    setActiveBossAoes((prev) => [...prev, aoe].slice(-32));
  }, []);
  const handleBossAoeExpire = useCallback((aoeId: string) => {
    setActiveBossAoes((prev) => prev.filter((a) => a.id !== aoeId));
  }, []);
  useEffect(() => { setActiveBossAoes([]); }, [currentMap]); // purge au changement de map
  // Purge l'état de récolte au changement de map (nœuds démontés → handles purgés).
  useEffect(() => { setNearHarvest(null); setGatherNodeId(null); }, [currentMap]);
  // Purge la proximité du Maître d'Armes au changement de map (PNJ démonté).
  useEffect(() => { setNearWeaponMaster(false); }, [currentMap]);
  // L'invocation ne traverse pas les maps (ennemis démontés → registre purgé).
  useEffect(() => { setActiveSummon(null); }, [currentMap]);
  const announcedMapRef = useRef<string | null>(null); // dernière map annoncée (audio)

  // ── Mur du boss (donjon) : scellé tant que les ennemis ne sont pas tués ────
  const [aliveMobs, setAliveMobs] = useState(0);
  const [gateOpen, setGateOpen]   = useState(true);
  // Run de donjon (clé → boss → coffre). Quitter la map ou mourir pendant le run = run perdu.
  const run = useDungeonRun();
  useEffect(() => { if (currentMap !== "donjon_furiste") dungeonRun.abandon(); }, [currentMap]);
  useEffect(() => { if (isDead && currentMap === "donjon_furiste") dungeonRun.abandon(); }, [isDead, currentMap]);
  const bossIdsRef = useRef<Set<string>>(new Set());
  bossIdsRef.current = new Set(placedNpcs.filter((p) => p.rank === "boss").map((p) => p.id));
  const placedNpcsRef = useRef(placedNpcs);
  placedNpcsRef.current = placedNpcs;
  // npcEpoch++ → remonte TOUS les PNJ placés (ressuscite les ennemis au respawn donjon).
  const [npcEpoch, setNpcEpoch] = useState(0);
  // À l'entrée du donjon : scellé s'il y a des mobs ennemis placés.
  useEffect(() => {
    const hasMobs = currentMap === "donjon_furiste" &&
      placedNpcs.some((p) => p.rank !== "boss" && getNpc(p.folder)?.role === "enemy");
    setGateOpen(!hasMobs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMap]);
  const handleGateCleared = useCallback(() => setGateOpen(true), []);
  // Musique adaptative : donjon (boss/combat/explore phases) + overworld (combat/exploration theme).
  const combatMusicActive = useRef(false);
  useEffect(() => {
    const iv = setInterval(() => {
      const now = performance.now();
      if (currentMap === "donjon_furiste") {
        const phase = now - lastBossAoeAtRef.current < 14000 ? "boss"
                    : now - lastCombatAtRef.current  < 6000  ? "combat"
                    : "explore";
        audioManager.setDungeonPhase(phase);
      } else {
        const inCombat = now - lastCombatAtRef.current < 6000;
        if (inCombat && !combatMusicActive.current) {
          combatMusicActive.current = true;
          audioManager.playMusic("combat");
        } else if (!inCombat && combatMusicActive.current) {
          combatMusicActive.current = false;
          audioManager.playMusic("exploration");
        }
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [currentMap]);

  // ── Explosion VFX (position figée au moment de la destruction) ──────────
  // Quand un véhicule est détruit, on affiche un VFX 3D à sa position pendant
  // 1.5s puis on l'efface. État capturé pour que le VFX reste visible même
  // après que le ship soit unmount.
  const [explosionVfx, setExplosionVfx] = useState<{ pos: [number, number, number]; color: string; key: number } | null>(null);

  // Refs vers les callbacks de potions rapides — résout le TDZ.
  // Le listener clavier (déclaré avant les useCallback handleQuickHeal/Mana)
  // ne peut pas référencer ces callbacks directement. On utilise des refs
  // qu'on remplit dans un useEffect plus bas (juste après leur déclaration).
  const quickHealRef = useRef<(() => void) | null>(null);
  const quickManaRef = useRef<(() => void) | null>(null);
  /** Ref vers handleQuickRepair pour la touche R près du garagiste. */
  const quickRepairRef = useRef<(() => void) | null>(null);
  /** Ref vers handleUseSlot pour les touches 4/5/6 (slots consommables). */
  const useSlotRef   = useRef<((idx: 0 | 1 | 2) => void) | null>(null);
  /** Ref vers pushToast — utilisée par les callbacks (exitShip notamment) qui
   *  sont déclarés AVANT pushToast dans le fichier. Évite le TDZ. */
  const pushToastRef = useRef<((text: string, color: string) => void) | null>(null);

  // ── Charge les slots consommables + quêtes du perso (par charId) ─────────
  useEffect(() => {
    if (characterId) {
      consumableSlotsStore.setCharacter(characterId);
      questStore.setCharacter(characterId);
      professionStore.setCharacter(characterId);
      archetypeStore.setCharacter(characterId);
      reputationStore.init(characterId);
      petStore.init(characterId);
      if (petStore.get().owned.length === 0) petStore.adopt("loup", "Loup");
    }
  }, [characterId]);

  // ── Réputation : gain sur destruction de vaisseau ennemi ────────────────────
  useEffect(() => {
    const unsub = eventBus.on("ship:destroyed", (e) => {
      reputationStore.gain(e.faction, REP_GAINS.SHIP_DESTROYED);
      for (const def of questStore.recordKill("space_ship")) grantQuestReward(def);
    });
    return unsub;
  }, []);

  // ── Hydrate les stores MONDE depuis la base (placements partagés) une fois ──
  // Portails / PNJ / nœuds de récolte : données globales (par map), pas par perso.
  // En Electron, la base fait foi ; sinon ces appels sont des no-op (localStorage).
  useEffect(() => {
    // Hydratation UNIFIÉE + mémoïsée de tous les stores éditables (placements, offsets,
    // calibrages, comportements, env, mutations, réglages, audio). Même promesse partagée
    // avec le préchargeur (LoadingScreen) → une seule passe DB, modifs prêtes avant l'entrée.
    void hydrateAllStores();
  }, []);

  // ── Hydrate la PROGRESSION (inventaire/stats/crédits) depuis la base ────────
  // last-write-wins : on n'écrase l'état local que si la base est STRICTEMENT plus
  // récente (savedAt) → restaure une sauvegarde cloud sans clobber une partie en
  // cours. Map non forcée à chaud (resync au prochain lancement). No-op hors Electron.
  const progressionHydratedRef = useRef(false);

  /**
   * La lecture de progression a-t-elle ABOUTI (succès ou absence confirmée) ?
   *
   * ── POURQUOI L'AUTOSAVE EN DÉPEND ────────────────────────────────────────
   *
   * Tant que la restauration n'a pas eu lieu, l'état monté est un personnage
   * NIVEAU 1 avec l'inventaire de départ. L'autosave part à 800 ms, la lecture
   * expire à 1500 ms : l'ordre garantissait l'écriture du niveau 1 AVANT même
   * de savoir s'il existait une sauvegarde — donc son écrasement, sans
   * historique ni message.
   *
   * Le verrou d'écriture de `dbStore` ne suffit pas ici : il ne s'arme qu'APRÈS
   * l'échec de la lecture, donc à 1500 ms. Entre 800 et 1500 ms, la fenêtre
   * reste ouverte. Ce drapeau la ferme.
   *
   * `false` quand une lecture est en cours ; `true` dès qu'elle est retombée,
   * quelle que soit son issue — une panne confirmée n'est plus une inconnue, et
   * le verrou de `dbStore` prend alors le relais.
   */
  const progressionReadSettledRef = useRef(false);
  const [progressionReadSettled, setProgressionReadSettled] = useState(false);

  useEffect(() => {
    // Test Forge : pas de personnage persisté, donc rien à restaurer ni à
    // écraser. On ouvre l'autosave immédiatement.
    if (!characterId || forceMap) {
      progressionReadSettledRef.current = true;
      setProgressionReadSettled(true);
      return;
    }
    if (progressionHydratedRef.current) return;

    let cancelled = false;
    readProgressionDb(characterId).then((res) => {
      if (cancelled) return;

      if (res.status === "unavailable") {
        console.warn(`[RpgGameWorld] progression illisible (${res.reason}) — sauvegarde en base suspendue`);
      } else if (res.value) {
        const localAt = saved?.savedAt ?? 0;
        if (res.value.savedAt > localAt) {
          progressionHydratedRef.current = true;
          if (res.value.stats) setStats(res.value.stats);
          if (res.value.inventory) setInventory(res.value.inventory);
        }
      }

      progressionReadSettledRef.current = true;
      setProgressionReadSettled(true);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId, forceMap]);

  // ── Talents : pousse le mult de vitesse vers le runtime hot-path ─────────
  // CharacterController (60 fps, hors React) lit talentRuntime.moveSpeedMult.
  // On le recalcule à chaque changement de talents. Reset au démontage.
  useEffect(() => {
    talentRuntime.setMoveSpeedMult(aggregateTalents(stats.talents).moveSpeedMult);
  }, [stats.talents]);
  useEffect(() => () => { talentRuntime.reset(); screenShake.reset(); cameraRecoil.reset(); statusEffects.reset(); cooldownStore.reset(); arrowPool.clear(); noclipUi.set(false); }, []);
  // Quitter le mode EDIT → ferme TOUS les outils (mode normal = jeu propre, zéro engrenage).
  useEffect(() => {
    if (edit) return;
    setAdminOpen(false); setStressOpen(false); setNpcAdminOpen(false); setDonjonAdminOpen(false);
    setHarvestAdminOpen(false); setWeaponAdminOpen(false); setCharOffsetOpen(false); setRecoilAdminOpen(false);
    setSpawnEdit(false);
    // Ces quatre-là manquaient : leurs panneaux restaient ouverts en mode jeu.
    setArrowMutOpen(false); setBodyTintOpen(false); setPropAdminOpen(false); setStreamHudOpen(false);
    mapGenStore.set({ open: false });
  }, [edit]);
  // Univers vivant : démarre la simulation (rattrapage hors-ligne + tick live). Arrêt au démontage.
  useEffect(() => { worldStore.start(); return () => worldStore.stop(); }, []);
  // Noclip PAR DÉFAUT (réglé à la création de perso) → entrée en vol libre (F4 coupe).
  useEffect(() => {
    if (noclipDefault.get()) { camState.current.noclip = true; noclipUi.set(true); }
  }, []);

  // Désengagement des PNJ quand le joueur meurt (lu hors-React par chaque PNJ).
  // Au respawn, isDead repasse false → les PNJ peuvent ré-engager.
  useEffect(() => { npcRegistry.playerAlive = !isDead; }, [isDead]);

  // ── Chargement de map en DEUX phases (anti-freeze + map complète au spawn) ─
  // Phase 1  preloadDone   : préchargement HTTP terminé (octets en cache).
  // Phase 2  mapAssembled  : PuzzleMap a parsé + uploadé GPU TOUS les chunks.
  // On ne révèle le jeu (`revealed`) que lorsque les DEUX sont vrais → la map
  // est intégralement assemblée derrière l'overlay, donc aucun freeze ni map
  // partielle au spawn. `loadingVisible` garde l'overlay monté le temps du fade.
  const [preloadDone,    setPreloadDone]    = useState(false);
  const [mapAssembled,   setMapAssembled]   = useState(false);
  const [characterReady, setCharacterReady] = useState(false);
  const [mapProgress,    setMapProgress]    = useState<{ loaded: number; total: number }>({ loaded: 0, total: 0 });
  const [loadingVisible, setLoadingVisible] = useState(true);
  const [wasmReady, setWasmReady] = useState(false);
  const revealed = preloadDone && mapAssembled;

  // Quand le joueur pilote un vaisseau, le composant personnage ne monte pas
  // → forcer characterReady pour ne pas bloquer le loading screen.
  useEffect(() => {
    if (pilotedShipId) setCharacterReady(true);
  }, [pilotedShipId]);

  // ── WASM engine : chargement non-bloquant en parallèle du preload ──
  useEffect(() => {
    let cancelled = false;
    loadNarvosEngine()
      .then(() => { if (!cancelled) setWasmReady(true); })
      .catch((err) => console.warn("[RpgGameWorld] WASM non disponible, fallback JS :", err));
    return () => { cancelled = true; };
  }, []);

  // ── Diagnostic chargement ──
  useEffect(() => { console.info(`[RpgGameWorld] preloadDone=${preloadDone} mapAssembled=${mapAssembled} characterReady=${characterReady} → revealed=${preloadDone && mapAssembled}`); }, [preloadDone, mapAssembled, characterReady]);
  // Filet de sécurité 180 s : force la révélation si le gate reste bloqué
  // (maps lourdes = 32 chunks × ~15s de décodage Draco = 4 min max)
  useEffect(() => {
    if (preloadDone && mapAssembled && characterReady) return;
    const t = window.setTimeout(() => {
      console.error("[RpgGameWorld] SAFETY: 180 s écoulées sans reveal — forçage. preloadDone=", preloadDone, "mapAssembled=", mapAssembled, "characterReady=", characterReady);
      if (!preloadDone) setPreloadDone(true);
      if (!mapAssembled) setMapAssembled(true);
      if (!characterReady) setCharacterReady(true);
    }, 180000);
    return () => window.clearTimeout(t);
  }, [preloadDone, mapAssembled, characterReady]);
  // Montage des PNJ ÉTAGÉ PAR LOTS après la révélation : chaque PNJ = clone squelette + parse
  // GLB (textures 4K lourdes). Les monter TOUS d'un coup = un gros freeze. On les monte par
  // petits lots sur plusieurs ticks → le travail est étalé (pas de pic VRAM ni de gel unique).
  const [npcStagedCount, setNpcStagedCount] = useState(0);
  useEffect(() => {
    if (!revealed) { setNpcStagedCount(0); return; }
    // `target` = nb réel de PNJ placés. CRITIQUE : les placements hydratent de façon
    // ASYNCHRONE (DB/localStorage) et PEUVENT arriver APRÈS la révélation de la map. Si
    // on lit target=0 au reveal, l'ancien code coupait l'interval au 1er tick (2>=0) →
    // npcStagedCount gelé à 2 → seuls 2 PNJ montaient pour toujours = "map pas chargée
    // entière". On dépend donc de `placedNpcs.length` : tant que 0, on attend (re-arme
    // quand l'hydratation peuple la liste) ; on ne reset pas le compteur → pas de flash
    // en édition live (ajouter 1 PNJ reprend l'étagement depuis le compte courant).
    const target = placedNpcs.length;
    if (target <= 0) return; // pas encore hydraté → l'effet se relance quand length change
    const BATCH = 2, INTERVAL = 90; // 2 PNJ tous les 90 ms
    let iv = 0;
    const start = window.setTimeout(() => {
      iv = window.setInterval(() => {
        setNpcStagedCount((n) => {
          if (n >= target) { window.clearInterval(iv); return n; }
          const next = n + BATCH;
          if (next >= target) window.clearInterval(iv);
          return next;
        });
      }, INTERVAL);
    }, 500); // laisse la map s'installer avant de peupler
    return () => { window.clearTimeout(start); window.clearInterval(iv); };
  }, [revealed, placedNpcs.length]);
  // Extras (marchands + Maître d'Armes) montés ~400 ms APRÈS le reveal : ~8 SkeletonUtils.clone
  // d'un coup à la frame de révélation = gros hitch. On les sort de la frame critique (la map +
  // les PNJ étagés ont la priorité ; les marchands ne sont pas requis instantanément).
  const [extrasReady, setExtrasReady] = useState(false);
  useEffect(() => {
    if (!revealed) { setExtrasReady(false); return; }
    const t = window.setTimeout(() => setExtrasReady(true), 400);
    return () => window.clearTimeout(t);
  }, [revealed]);
  // Si l'hydratation initiale était PARTIELLE (timeout pendant que le main thread chargeait la
  // map), re-tente au calme ~3 s après le reveal → les PNJ/portails manquants poppent, le
  // staging se ré-arme via placedNpcs.length. No-op si la passe initiale était complète.
  useEffect(() => {
    if (!revealed) return;
    const t = window.setTimeout(() => { void rehydrateIfPartial(); }, 3000);
    return () => window.clearTimeout(t);
  }, [revealed]);
  useEffect(() => {
    // Reset complet à chaque changement de map → relance le chargement 2 phases.
    setPreloadDone(false);
    setMapAssembled(false);
    setMapProgress({ loaded: 0, total: 0 });
    setLoadingVisible(true);
  }, [currentMap]);

  // ── Récupération contexte GPU perdu (WebGL context lost) ────────────────────
  // ContextLossGuard appelle preventDefault() sur webglcontextlost → le contexte
  // EST restaurable, mais rien ne garantit que le navigateur/pilote le restaure
  // réellement (crash dur du process GPU Electron = jamais de webglcontextrestored).
  // Sans ce handler, la scène reste figée indéfiniment (canvas noir, aucun bouton).
  // Stratégie : à la perte, ré-affiche l'écran de chargement (masque le rendu cassé)
  // + arme un délai de sécurité qui recharge la fenêtre si la restauration ne
  // vient pas. À la restauration effective, force le REMONTAGE COMPLET de la map
  // (bump restoreEpoch dans la key) — les objets GPU de l'ancien contexte sont
  // invalides, il faut réinitialiser loader/refs/WASM streaming à zéro plutôt
  // que de tenter de reprendre les chargements en vol (promesses désormais mortes).
  const [restoreEpoch, setRestoreEpoch] = useState(0);
  const [gpuLost, setGpuLost] = useState(false);
  const gpuLostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleGpuLost = useCallback(() => {
    setGpuLost(true);
    setMapAssembled(false);
    setLoadingVisible(true);
    if (gpuLostTimerRef.current) clearTimeout(gpuLostTimerRef.current);
    gpuLostTimerRef.current = setTimeout(() => {
      console.error("[RpgGameWorld] Contexte GPU non restauré après 8 s — rechargement forcé (state localStorage préservé)");
      window.location.reload();
    }, 8000);
  }, []);

  const handleGpuRestored = useCallback(() => {
    if (gpuLostTimerRef.current) { clearTimeout(gpuLostTimerRef.current); gpuLostTimerRef.current = null; }
    setGpuLost(false);
    setRestoreEpoch((e) => e + 1);
  }, []);

  useEffect(() => () => { if (gpuLostTimerRef.current) clearTimeout(gpuLostTimerRef.current); }, []);
  // Pont équipement → store d'arme : l'arme/offhand équipée dans l'inventaire pilote le modèle
  // 3D + le pack d'anim du perso (via equippedWeaponStore, lu par HumanCharacter sans props).
  useEffect(() => {
    const arch = archetypeStore.get();
    // Type d'arme d'un id de profil : on classifie le CHEMIN du profil (source de vérité),
    // repli sur l'id si le profil est introuvable.
    const typeOf = (id: string | null | undefined) => {
      if (!id) return null;
      const prof = weaponRegistry.get(id);
      return classifyWeapon(prof?.path ?? id);
    };
    // LOGIQUE DE CLASSE : refuse une arme hors du répertoire de l'archétype (archer ≠ feu…).
    // L'arme reste dans l'inventaire mais n'est PAS portée (modèle/anim) → pas de triche.
    const gate = (id: string | null | undefined, label: string): string | null => {
      const t = typeOf(id);
      if (!id || !t) return id ?? null;
      if (arch && !archetypeAllowsWeapon(arch, t)) {
        pushToastRef.current?.(`${ARCHETYPES[arch].label} ne peut pas équiper : ${label}`, "#ffae6b");
        return null;
      }
      return id;
    };
    equippedWeaponStore.set({
      primary: gate(inventory.equipped.weapon?.id, inventory.equipped.weapon?.label ?? "cette arme"),
      secondary: gate(inventory.equipped.offhand?.id, inventory.equipped.offhand?.label ?? "cet objet"),
    });
  }, [inventory.equipped.weapon, inventory.equipped.offhand]);

  // Snap de secours : à la révélation de la map, raycast vers le bas et replace
  // le joueur sur le sol — corrige le cas "tombé sous la map" si on a traversé le
  // plancher pendant le chargement (collision pas encore prête).
  useEffect(() => {
    if (!revealed) return;
    const p = playerPos.current;
    const gy = collisionWorld.getGroundY(p.x, p.z, 300);
    if (gy !== null) p.y = gy + 1.0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed]);

  const nearMerchantRef = useRef<string | null>(null);
  nearMerchantRef.current = nearMerchant;
  const nearWeaponMasterRef = useRef(false);
  nearWeaponMasterRef.current = nearWeaponMaster;

  const uiOpen = paused || invOpen || charMenu || questOpen || talentOpen || !!openMerchant || adminOpen || npcAdminOpen || donjonAdminOpen || harvestAdminOpen || professionPanelOpen || archetypeOpen || weaponAdminOpen || charOffsetOpen || recoilAdminOpen || craftOpen !== null || gatherNodeId !== null || !!lootTarget;

  // ── Réglages vidéo ────────────────────────────────────────────────────────
  // La qualité ne pilote pas que le DPR et les ombres : elle change les CHEMINS
  // d'assets (`<map>.glb` / `.med.glb` / `.low.glb`). Ces chemins viennent d'un
  // cache alimenté par des HEAD checks au chargement — il faut donc le re-résoudre
  // avant de remonter la map, sinon elle recharge la variante précédente.
  // `assetQualityVer` n'avance qu'APRÈS la re-résolution et entre dans la clé de
  // remount : la map ne se reconstruit qu'une fois les bons chemins disponibles.
  const finishQualitySwap = useCallback(() => {
    if (!swapPathsReady.current || !swapDisposed.current) return;
    setAssetQualityVer((n) => n + 1); // remonte la map sur la nouvelle variante
    setQualitySwap(false);
  }, []);

  const onVideoChange = useCallback(() => {
    setVideoVer((n) => n + 1);

    // Seule la QUALITÉ change les chemins d'assets. DPR, ombres et post-traitement
    // s'appliquent à chaud : les recharger serait une attente gratuite.
    const q = gameSettings.video.quality;
    if (q === lastQualityRef.current) return;
    lastQualityRef.current = q;

    // Repasse par l'ÉCRAN DE CHARGEMENT plutôt que de troquer les textures sous
    // les yeux du joueur : passer de 512 à 2048 fait redescendre, reparser et
    // ré-uploader ~40 à 116 Mo par chunk. Fait en jeu, c'est un gel de plusieurs
    // secondes ; l'ancienne map resterait en plus en mémoire pendant que la
    // nouvelle arrive, ce qui saturait l'allocateur.
    setMapAssembled(false);
    setMapProgress({ loaded: 0, total: 0 });
    setLoadingVisible(true);
    swapPathsReady.current = false;
    swapDisposed.current = false;
    setQualitySwap(true);

    refreshQualityCache().finally(() => {
      swapPathsReady.current = true;
      finishQualitySwap();
    });
  }, [finishQualitySwap]);

  // Filet : si `onDisposed` ne remonte jamais (map jamais montée, erreur en vol),
  // on débloque quand même — mieux vaut un remontage un peu tôt qu'un écran de
  // chargement infini.
  useEffect(() => {
    if (!qualitySwap) return;
    const t = window.setTimeout(() => {
      if (!swapDisposed.current) {
        console.warn("[RpgGameWorld] libération de la map non signalée en 3 s — remontage forcé");
        swapDisposed.current = true;
        finishQualitySwap();
      }
    }, 3000);
    return () => window.clearTimeout(t);
  }, [qualitySwap, finishQualitySwap]);
  const dpr            = useMemo(() => QUALITY_DPR[gameSettings.video.quality],       [videoVer]);
  const shadows        = useMemo(() => gameSettings.video.shadows,                     [videoVer]);
  const shadowMapSize  = useMemo(() => QUALITY_SHADOW_MAP[gameSettings.video.quality], [videoVer]);

  // ── Proximité marchands ───────────────────────────────────────────────────
  const handleMerchantProximity = useCallback((id: string, near: boolean) => {
    setNearMerchant((cur) => (near ? id : cur === id ? null : cur));
    // Détection garagiste + véhicule endommagé → invite réparation
    if (id === "mer_vehicles" && near) {
      const ctrl = shipControllerRef.current;
      const hasDamaged = pilotedShipIdRef.current && ctrl && ctrl.hasHp && ctrl.hpRatio < 1;
      setShowRepairPrompt(!!hasDamaged);
    } else if (!near) {
      setShowRepairPrompt(false);
    }
  }, []);

  // ── Proximité Maître d'Armes (sélection de classe) ─────────────────────────
  const handleWeaponMasterProximity = useCallback((_id: string, near: boolean) => {
    setNearWeaponMaster(near);
  }, []);

  // ── Proximité vaisseaux ───────────────────────────────────────────────────
  const handleShipBoardZone = useCallback((id: string, near: boolean) => {
    setNearShipId((cur) => (near ? id : cur === id ? null : cur));
  }, []);

  // ── Embarquement dans un vaisseau ─────────────────────────────────────────
  // 2 chemins :
  //   A) Ship statique (SHIPS_PER_MAP) → comme avant
  //   B) Ship invoqué ABANDONNÉ (id = "summoned_<vehicleId>") → ré-embarque à
  //      la position d'abandon + applique le VehicleDef pour récupérer PV/stats.
  const boardShip = useCallback((id: string) => {
    // Cas B : ship invoqué abandonné
    if (id.startsWith("summoned_") && summonedVehicleId && abandonedShipState) {
      const def = VEHICLE_CATALOG[summonedVehicleId];
      const startPos = new THREE.Vector3(
        abandonedShipState.pos[0],
        abandonedShipState.pos[1] + SHIP_HOVER_HEIGHT,
        abandonedShipState.pos[2],
      );
      // Factory : Ground vs Ship selon def.kind (ré-embarquement sur véhicule abandonné).
      const ctrl = createVehicleController(def, startPos, abandonedShipState.yaw);
      shipControllerRef.current = ctrl;
      setPilotedShipId(id);
      setAbandonedShipState(null); // plus abandonné → en pilotage
      setNearShipId(null);
      pushToastRef.current?.(`${def.label} — pilotage repris`, "#a3e635");
      return;
    }
    // Cas A : ship statique
    const ships = SHIPS_PER_MAP[mapRef.current];
    const def   = ships?.find((s) => s.id === id);
    if (!def) return;
    const startPos = new THREE.Vector3(
      def.position[0],
      def.position[1] + SHIP_HOVER_HEIGHT, // hauteur de vol stationnaire
      def.position[2],
    );
    const ctrl = new ShipController(startPos, def.yaw);
    shipControllerRef.current = ctrl;
    setPilotedShipId(id);
    setNearShipId(null);
  }, [summonedVehicleId, abandonedShipState]);

  // ── Débarquement du vaisseau ──────────────────────────────────────────────
  // E = sortir, le véhicule reste sur place (Phase B : retour au spawn)
  // Shift+E = sortir + RAMASSER une clé `key_<vehicleId>` dans l'inventaire.
  //   Utile pour récupérer son véhicule après un atterrissage (l'invoquer
  //   ailleurs ensuite). Ne s'applique qu'aux véhicules INVOQUÉS (les ships
  //   statiques de SHIPS_PER_MAP restent ancrés à leur dock).
  const exitShip = useCallback((pickUp: boolean = false) => {
    const ctrl = shipControllerRef.current;
    if (!ctrl) return;
    const groundY = collisionWorld.getGroundY(
      ctrl.position.x, ctrl.position.z,
      ctrl.position.y + 2,
    );
    let spawnY: number;
    if (groundY !== null && (ctrl.position.y - groundY) < 30) {
      spawnY = groundY;
    } else {
      spawnY = ctrl.position.y;
    }
    playerPos.current.set(ctrl.position.x, spawnY, ctrl.position.z);

    // ── 3 chemins selon contexte ─────────────────────────────────────────
    //   A) Véhicule INVOQUÉ + Shift+E (pickUp=true) → clé en inventaire + ship disparaît
    //   B) Véhicule INVOQUÉ + E (pickUp=false)       → ship RESTE posé (abandonedShipState)
    //   C) Ship statique (SHIPS_PER_MAP)             → comme avant, juste déconnecter
    const isSummoned = summonedVehicleId !== null;

    if (isSummoned && pickUp) {
      // A) Ramasser : génère une clé et démontage complet du ship invoqué
      const keyId = `key_${summonedVehicleId}`;
      const keyItem = LOOT_CATALOG[keyId];
      if (keyItem) {
        setInventory((inv) => addItem(inv, keyItem));
        pushToastRef.current?.(`🔑 ${VEHICLE_CATALOG[summonedVehicleId].label} récupéré`, "#a3e635");
      }
      shipControllerRef.current = null;
      setPilotedShipId(null);
      setSummonedVehicleId(null);
      setAbandonedShipState(null);
    } else if (isSummoned) {
      // B) Laisser sur place : on capture la position d'abandon et on déconnecte
      //    le pilotage SANS vider summonedVehicleId → le composant PilotableShip
      //    reste monté et bascule en mode dock à cette position.
      setAbandonedShipState({
        pos: [ctrl.position.x, ctrl.position.y, ctrl.position.z],
        yaw: 0, // yaw du dock — pas critique, on capture l'orientation actuelle plus tard si besoin
      });
      shipControllerRef.current = null;
      setPilotedShipId(null);
      pushToastRef.current?.(
        `${VEHICLE_CATALOG[summonedVehicleId].label} laissé sur place — reviens pour ré-embarquer`,
        "#94a3b8",
      );
    } else {
      // C) Ship statique : déconnexion simple (le PilotableShip retourne à son dock)
      shipControllerRef.current = null;
      setPilotedShipId(null);
    }
    // Si le joueur sort du véhicule, l'invite de réparation disparaît
    setShowRepairPrompt(false);
  }, [summonedVehicleId]);

  // ── Touches de menu (rebindables) ────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const K = gameSettings.keys;

      // Pendant le mini-jeu de récolte, GatherMiniGame possède les entrées
      // (E/Espace/Échap en capture). On court-circuite le routage global pour
      // éviter de relancer une récolte ou d'ouvrir un menu pendant la frappe.
      if (gatherActiveRef.current) return;

      // F8 = Panneau Admin (réservé admin). F12 ne marche PAS car Electron le
      // capture nativement (DevTools) avant que le renderer voie l'event. F8
      // est libre dans la plupart des contextes navigateur/Electron.
      // Alternative : bouton flottant en HUD (cf. AdminFloatingButton), ou
      // commande console `window.NarvosAdmin.toggle()`.
      if (e.code === "F3") {
        // Outil de diagnostic → mode admin uniquement (comme F6-F11). Sans ce
        // garde, n'importe quel joueur ouvrait le HUD de streaming.
        if (!editRef.current) return;
        e.preventDefault();
        setStreamHudOpen((o) => !o); // diagnostics streaming chunks/textures
        return;
      }

      if (e.code === "F6") {
        if (editRef.current) {
          e.preventDefault();
          mapGenStore.set({ open: !mapGenStore.get().open }); // générateur de carte
        }
        return;
      }

      if (e.code === "F7") {
        if (editRef.current) {
          e.preventDefault();
          setStressOpen((o) => !o); // harnais de stress-test (bots + overlay perfs)
        }
        return;
      }

      if (e.code === "F8") {
        if (editRef.current) {
          e.preventDefault();
          setAdminOpen((o) => !o);
        }
        return;
      }

      if (e.code === "F9") {
        if (editRef.current) {
          e.preventDefault();
          setNpcAdminOpen((o) => !o);
        }
        return;
      }

      if (e.code === "F10") {
        if (editRef.current) {
          e.preventDefault();
          setDonjonAdminOpen((o) => !o);
        }
        return;
      }

      if (e.code === "F11") {
        if (editRef.current) {
          e.preventDefault();
          setHarvestAdminOpen((o) => !o);
        }
        return;
      }

      // R = potion de soin rapide (1ère trouvée dans le sac)
      // T = potion de mana rapide
      // 4/5/6 = slots consommables assignables (cf. ConsumableBar)
      // Ne fonctionnent pas pendant qu'un menu modal est ouvert.
      // Note : on lit via refs pour éviter le TDZ (les useCallback sont
      // déclarés PLUS BAS dans le fichier).
      if (!uiOpen) {
        // Sorts d'archétype (classe joueur) : C = sort 1 · V = sort 2 · B = sort 3.
        if (!e.repeat && (e.code === "KeyC" || e.code === "KeyV" || e.code === "KeyB")) {
          e.preventDefault();
          const arch = archetypeStore.get();
          if (arch) {
            const spells = ARCHETYPES[arch].spells;
            const idx = e.code === "KeyC" ? 0 : e.code === "KeyV" ? 1 : 2;
            const spell = spells[idx];
            if (spell) {
              if (spell.effect === "charged") {
                // Tir chargé : on DÉMARRE la charge au keydown (tir au relâchement).
                if (chargeStartRef.current === null) {
                  chargeStartRef.current = performance.now();
                  chargeSpellRef.current = spell;
                  chargeKeyRef.current = e.code;
                  setChargeProgress(0);
                }
              } else {
                castArchetypeRef.current(spell); // sorts normaux : tir instantané
              }
            }
          }
          return;
        }
        if (gameSettings.keys.dodge?.includes(e.code) && !e.repeat && document.pointerLockElement && npcRegistry.playerAlive) {
          // ESQUIVE (rebindable) : joue le clip dodge + fenêtre d'i-frames (invulnérabilité) 0,4 s.
          e.preventDefault();
          const now = performance.now();
          if (now >= dodgeUntilRef.current) {            // pas déjà en esquive
            dodgeUntilRef.current = now + 400;            // i-frames 0,4 s
            camState.current.oneShotAction = "dodge";
            camState.current.oneShotToken += 1;
          }
          return;
        }
        if (e.code === "KeyR" && !e.repeat) {
          e.preventDefault();
          // Priorité : réparation rapide si près du garagiste avec véhicule endommagé
          if (nearMerchantRef.current === "mer_vehicles" && pilotedShipIdRef.current) {
            const ctrl = shipControllerRef.current;
            if (ctrl && ctrl.hasHp && ctrl.hpRatio < 1) {
              quickRepairRef.current?.();
              return;
            }
          }
          const arch = archetypeStore.get();
          if (camState.current.weaponDrawn && arch && archetypeCanReload(arch)) {
            if (!magazineStore.reload()) {
              // P0 fix : stock épuisé → click à vide, pas de rechargement
              pushToastRef.current?.("Click — plus de cellules en réserve !", "#f87171");
            } else {
              camState.current.reloadToken += 1;
              pushToastRef.current?.("Rechargement…", "#a8d4ff");
            }
          }
          return;
        }
        if (e.code === "KeyX" && !e.repeat) {
          // X = potion de soin rapide (déplacée depuis R).
          e.preventDefault();
          quickHealRef.current?.();
          return;
        }
        // ── Touches de COMBAT (toutes REBINDABLES — Réglages → Touches → Combat) ────
        if (gameSettings.keys.drawWeapon?.includes(e.code) && !e.repeat) {
          // Dégainer / rengainer : position de combat (avec arme équipée OU poings levés).
          e.preventDefault();
          const next = !camState.current.weaponDrawn;
          camState.current.weaponDrawn = next;   // source instantanée
          setWeaponDrawn(next);                  // mirror React (re-dispatch perso)
          const unarmed = !equippedWeaponStore.get().primary;
          pushToastRef.current?.(
            next ? (unarmed ? "🥊 Position de combat" : "Arme dégainée") : (unarmed ? "Garde baissée" : "Arme rangée"),
            "#ffd24d",
          );
          return;
        }
        // ── Switch d'arme 1/2 ────────────────────────────────────────────────
        if (e.code === "Digit1" && !e.repeat) {
          e.preventDefault(); magazineStore.cancelReload(); equippedWeaponStore.setActiveSlot("primary"); return;
        }
        if (e.code === "Digit2" && !e.repeat) {
          e.preventDefault(); magazineStore.cancelReload(); equippedWeaponStore.setActiveSlot("secondary"); return;
        }
        if (gameSettings.keys.kick?.includes(e.code) && !e.repeat) {
          // COUP DE PIED (mains nues) : tap = kick · maintien ≥350 ms = kick CHARGÉ (au relâché).
          e.preventDefault();
          if (!equippedWeaponStore.get().primary && npcRegistry.playerAlive && document.pointerLockElement) {
            kickDownAtRef.current = performance.now();
          }
          return;
        }
        if (gameSettings.keys.minimap?.includes(e.code) && !e.repeat) {
          e.preventDefault();
          setMinimapOn((v) => !v);
          return;
        }
        if (gameSettings.keys.galaxy?.includes(e.code) && !e.repeat) {
          e.preventDefault();
          setGalaxyOpen((v) => !v);
          return;
        }
        if (gameSettings.keys.worldmap?.includes(e.code) && !e.repeat) {
          e.preventDefault();
          setWorldMapOpen((v) => !v);
          return;
        }
        if (e.code === "KeyG" && !e.repeat) {
          e.preventDefault();
          setEmoteMenuOpen((v) => !v);
          return;
        }
        if (e.code === "KeyK" && !e.repeat) {
          e.preventDefault();
          setRepPanelOpen((v) => !v);
          return;
        }
        if (e.code === "KeyP" && !e.repeat) {
          e.preventDefault();
          setPetPanelOpen((v) => !v);
          return;
        }
        if (gameSettings.keys.parry?.includes(e.code) && !e.repeat) {
          // PARADE : anim de défense + fenêtre d'annulation des coups MÊLÉE (0,45 s).
          e.preventDefault();
          const now = performance.now();
          if (npcRegistry.playerAlive && document.pointerLockElement && now >= parryCooldownRef.current) {
            parryUntilRef.current = now + 450;
            parryCooldownRef.current = now + 900; // anti-spam
            camState.current.oneShotAction = "block";
            camState.current.oneShotToken += 1;
          }
          return;
        }
        if (e.code === "KeyT" && !e.repeat) {
          e.preventDefault();
          quickManaRef.current?.();
          return;
        }
        // Slots consommables 4/5/6 (Digit4/5/6 = touches numériques top row,
        // Numpad4/5/6 = pavé numérique)
        if (!e.repeat) {
          if (e.code === "Digit4" || e.code === "Numpad4") {
            e.preventDefault(); useSlotRef.current?.(0); return;
          }
          if (e.code === "Digit5" || e.code === "Numpad5") {
            e.preventDefault(); useSlotRef.current?.(1); return;
          }
          if (e.code === "Digit6" || e.code === "Numpad6") {
            e.preventDefault(); useSlotRef.current?.(2); return;
          }
        }
      }

      if (K.pause?.includes(e.code)) {
        setPaused((p) => !p);
      } else if (K.inventory?.includes(e.code)) {
        setInvOpen((o) => !o);
      } else if (K.characteristics?.includes(e.code)) {
        setCharMenu((c) => !c);
      } else if (e.code === "KeyJ" && !e.repeat) {
        setQuestOpen((o) => !o);
      } else if (e.code === "KeyL" && !e.repeat) {
        setTalentOpen((o) => !o);
      } else if (K.noclip?.includes(e.code)) {
        const v = !camState.current.noclip;
        camState.current.noclip = v;
        noclipUi.set(v); // store isolé → seul l'indicateur re-render (plus de freeze RpgGameWorld)

      } else if (K.interact?.includes(e.code)) {
        if (pilotedShipIdRef.current) {
          // Tentative de sortie du vaisseau
          // Shift+E (interact + shift) = ramasser la clé en sortant
          // E seul = laisser le véhicule sur place
          const ctrl = shipControllerRef.current;
          if (ctrl?.canExit) {
            exitShip(e.shiftKey);
          } else if (ctrl) {
            pushToast("Ralentissez et descendez pour quitter le vaisseau", "#ff8040");
          }
        } else if (nearShipRef.current) {
          // Embarquer dans le vaisseau proche
          boardShip(nearShipRef.current);
        } else if (nearPortalRef.current) {
          // Franchir un portail de donjon (verrou vérifié dans enterPortalRef)
          enterPortalRef.current?.(nearPortalRef.current);
        } else if (nearHarvestRef.current) {
          // Démarrer la récolte d'un nœud proche (arbre / minerai…)
          startGatherRef.current?.(nearHarvestRef.current);
        } else if (nearWeaponMasterRef.current) {
          // Maître d'Armes proche → ouvre le panneau de sélection d'archétype.
          setArchetypeOpen(true);
        } else if (openMerchant) {
          setOpenMerchant(null);
        } else if (nearMerchantRef.current) {
          setOpenMerchant(nearMerchantRef.current);
        } else if (nearLootRef.current) {
          const h = nearLootRef.current;
          const corpse = h.takeLoot();
          if (corpse) {
            setLootTarget({
              data: { label: h.getLabel?.() ?? h.id, items: corpse.items, credits: corpse.credits },
            });
          }
        } else if (nearChestRef.current) {
          const ch = nearChestRef.current;
          const chest = ch.takeLoot();
          if (chest) {
            setLootTarget({
              data: { label: ch.label, items: chest.items, credits: chest.credits },
            });
          }
        }
      }
    };
    // Relâchement d'une touche de tir chargé → tire avec la charge accumulée.
    const onKeyUp = (e: KeyboardEvent) => {
      // Relâchement de la touche KICK (mains nues) → coup de pied (tap) ou CHARGÉ (maintien).
      if (gameSettings.keys.kick?.includes(e.code) && kickDownAtRef.current > 0) {
        const held = performance.now() - kickDownAtRef.current;
        kickDownAtRef.current = 0;
        if (!camState.current.weaponDrawn && npcRegistry.playerAlive && document.pointerLockElement) {
          unarmedStrikeRef.current(held >= CHARGE_MS ? "kick_charged" : "kick");
        }
        return;
      }
      if (!chargeKeyRef.current || e.code !== chargeKeyRef.current) return;
      const start = chargeStartRef.current;
      const spell = chargeSpellRef.current;
      chargeStartRef.current = null;
      chargeSpellRef.current = null;
      chargeKeyRef.current = null;
      setChargeProgress(null);
      if (start !== null && spell) {
        const charge = Math.max(0, Math.min(1, (performance.now() - start) / CHARGE_TIME_MS));
        castArchetypeRef.current(spell, charge);
      }
    };
    // Clic gauche → auto-attaque (uniquement en jeu : pointeur verrouillé, arme
    // dégainée, joueur vivant). Le 1er clic verrouille le pointeur (InputManager),
    // les suivants attaquent.
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (!document.pointerLockElement) return;     // menu ouvert / pas en jeu
      if (!npcRegistry.playerAlive) return;
      const hasWeapon = !!equippedWeaponStore.get().primary;
      if (camState.current.weaponDrawn && hasWeapon) {
        if (archetypeStore.get() === "guerrier") {
          // GUERRIER (arme en main) : tap = attaque · MAINTIEN ≥150 ms = garde levée (3 coups).
          if (guardPendingRef.current) window.clearTimeout(guardPendingRef.current);
          guardPendingRef.current = window.setTimeout(() => {
            guardPendingRef.current = 0;
            guardRef.current.active = true;
            guardRef.current.hitsLeft = 3;
            pushToastRef.current?.("🛡️ Garde levée", "#9bd1ff");
          }, 150);
        } else {
          autoAttackRef.current();                   // arme dégainée → attaque d'arme
        }
      } else {
        // AUCUNE arme équipée (position de combat ou non) → MAINS NUES : détection de
        // maintien ; le coup part au RELÂCHEMENT (tap = combo · maintien ≥350 ms = chargé).
        punchDownAtRef.current = performance.now();
      }
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (guardPendingRef.current) {
        // Relâché AVANT le seuil → c'était un TAP → attaque d'arme du Guerrier.
        window.clearTimeout(guardPendingRef.current);
        guardPendingRef.current = 0;
        autoAttackRef.current();
      }
      if (guardRef.current.active) guardRef.current.active = false; // relâche la garde
      if (punchDownAtRef.current > 0) {
        const held = performance.now() - punchDownAtRef.current;
        punchDownAtRef.current = 0;
        // Mains nues = AUCUNE arme équipée (que la position de combat soit levée ou non).
        if (!equippedWeaponStore.get().primary && npcRegistry.playerAlive && document.pointerLockElement) {
          unarmedStrikeRef.current(held >= CHARGE_MS ? "punch_charged" : "combo");
        }
      }
    };
    // Sécurité : sortie du pointer lock (Échap, alt-tab) avale le mouseup → sans ceci la
    // garde resterait levée en permanence (−60 % mêlée gratuit).
    const onLockChange = () => {
      if (!document.pointerLockElement) {
        if (guardPendingRef.current) { window.clearTimeout(guardPendingRef.current); guardPendingRef.current = 0; }
        guardRef.current.active = false;
      }
    };
    document.addEventListener("pointerlockchange", onLockChange);
    const onWheel = (e: WheelEvent) => {
      if (!document.pointerLockElement) return;
      equippedWeaponStore.toggleSlot();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("wheel", onWheel);
      document.removeEventListener("pointerlockchange", onLockChange);
      if (guardPendingRef.current) { window.clearTimeout(guardPendingRef.current); guardPendingRef.current = 0; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openMerchant, exitShip, boardShip, uiOpen]);

  // Anime la barre de charge (rAF) tant qu'une charge est en cours, puis l'arrête.
  useEffect(() => {
    if (chargeProgress === null) return;
    let raf = 0;
    const loop = () => {
      const start = chargeStartRef.current;
      if (start === null) return; // relâché → l'effet keyup a déjà nettoyé
      setChargeProgress(Math.min(1, (performance.now() - start) / CHARGE_TIME_MS));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // déclenché au passage de null→0 (début de charge) ; se relance une seule fois.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargeProgress === null]);

  // Annule une charge en cours si un menu s'ouvre (évite un tir fantôme au relâchement).
  useEffect(() => {
    if (uiOpen && chargeStartRef.current !== null) {
      chargeStartRef.current = null;
      chargeSpellRef.current = null;
      chargeKeyRef.current = null;
      setChargeProgress(null);
    }
  }, [uiOpen]);

  // Libère le pointer-lock quand un menu est ouvert
  useEffect(() => {
    if (uiOpen && document.pointerLockElement) document.exitPointerLock?.();
  }, [uiOpen]);

  // Reset du prompt vaisseau au changement de carte
  useEffect(() => { setNearShipId(null); }, [currentMap]);

  // ── Combat & régénération PV/Mana ──────────────────────────────────────────
  const combatUntil = useRef(0);
  const markCombat  = useCallback(() => { combatUntil.current = performance.now() + 4000; }, []);
  const pausedRef   = useRef(uiOpen);
  pausedRef.current = uiOpen;

  useEffect(() => {
    let last = performance.now();
    const iv = setInterval(() => {
      const now = performance.now();
      const dt  = (now - last) / 1000;
      last = now;
      if (pausedRef.current) return;
      const eff = effRef.current;
      setStats((s) => regenTick(s, dt, now < combatUntil.current, eff.maxHp, eff.maxMana, aggregateTalents(s.talents).manaRegenMult));
    }, 250);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sauvegarde de progression ─────────────────────────────────────────────
  const statsRef = useRef(stats);     statsRef.current = stats;
  const invRef   = useRef(inventory); invRef.current   = inventory;

  // DERNIÈRE POSITION SAINE — mise à jour uniquement quand le joueur est au sol.
  //
  // La position sauvegardée est celle qui sera RESTAURÉE à la prochaine
  // connexion (cf. l'initialisation de `playerPos`). Sauvegarder pendant une
  // chute grave donc un point invalide, et le personnage y renaît, retombe, et
  // s'y re-sauvegarde : la sauvegarde est empoisonnée définitivement. C'est ce
  // qui rendait un serveur injouable pendant qu'un autre fonctionnait avec le
  // même build — la différence était dans les données, pas dans le code.
  const lastGoodPos = useRef<[number, number, number] | null>(null);

  const saveNow = useCallback(() => {
    if (!characterId) return;

    // Au sol → la position courante fait référence.
    if (camState.current.grounded) {
      lastGoodPos.current = [playerPos.current.x, playerPos.current.y, playerPos.current.z];
    }

    // En l'air (saut, chute, chargement) → on persiste le dernier point au sol.
    // À défaut (jamais touché terre depuis l'entrée), on retombe sur le point
    // d'apparition de la map plutôt que d'écrire une position en chute libre.
    const pos = lastGoodPos.current ?? mapSpawn(mapRef.current);

    saveProgression(characterId, {
      classId,
      stats:     statsRef.current,
      inventory: invRef.current,
      mapId:     mapRef.current,
      position:  { x: pos[0], y: pos[1], z: pos[2] },
      savedAt:   Date.now(),
    });
  }, [characterId, classId]);

  // ⚠ `progressionReadSettled` en garde ET en dépendance : sans lui, cet effet
  // planifiait une écriture à 800 ms alors que la lecture court encore jusqu'à
  // 1500 ms — l'état monté étant un personnage niveau 1.
  useEffect(() => {
    if (!characterId || !progressionReadSettled) return;
    const t = setTimeout(saveNow, 800);
    return () => clearTimeout(t);
  }, [characterId, stats, inventory, currentMap, saveNow, progressionReadSettled]);

  useEffect(() => {
    if (!characterId || !progressionReadSettled) return;
    const iv = setInterval(saveNow, 15000);
    // La sortie force une écriture même hors intervalle — mais seulement une
    // fois la lecture retombée, sinon quitter le jeu dans la première seconde
    // écraserait la sauvegarde.
    const flushOnExit = () => { saveNow(); flushDb(); };
    const onVisChange = () => { if (document.visibilityState === "hidden") flushOnExit(); };
    window.addEventListener("beforeunload", flushOnExit);
    document.addEventListener("visibilitychange", onVisChange);

    // Electron before-quit : main process envoie 'app:flush-before-quit',
    // on flush puis on signale 'flush-done' pour qu'il ferme proprement la DB.
    const eApi = (window as any).electronAPI;
    const onElectronFlush = async () => {
      try { saveNow(); await flushDb(); } catch { /* best-effort */ }
      eApi?.sendFlushDone?.();
    };
    eApi?.on?.("app:flush-before-quit", onElectronFlush);

    return () => {
      clearInterval(iv);
      window.removeEventListener("beforeunload", flushOnExit);
      document.removeEventListener("visibilitychange", onVisChange);
      eApi?.removeListener?.("app:flush-before-quit", onElectronFlush);
      saveNow();
      flushDb();
    };
  }, [characterId, saveNow, progressionReadSettled]);

  // ── Feedback visuel ───────────────────────────────────────────────────────
  const [dmgFlash, setDmgFlash] = useState(0);
  const [lvlFlash, setLvlFlash] = useState(0);
  const prevHpRef = useRef(stats.currentHp);
  useEffect(() => {
    if (stats.currentHp < prevHpRef.current - 0.5) setDmgFlash((n) => n + 1);
    prevHpRef.current = stats.currentHp;
  }, [stats.currentHp]);

  // ── Détection de la mort (transition currentHp → 0) ──────────────────────
  // Latch unique : on n'entre qu'une fois en état "mort" tant qu'on n'a pas
  // respawn. La régen est déjà gardée par regenTick (s'arrête à HP ≤ 0).
  useEffect(() => {
    if (stats.currentHp > 0 || isDead) return;
    setIsDead(true);
    audioEvents.reset(); // mort → coupe la série de kills en cours

    // ── MORT À ENJEU (P1.3) — selon le serveur choisi ──────────────────────────
    if (serverRules.isHardcore()) {
      // MORT DÉFINITIVE : entrée au ladder + personnage verrouillé + écran dédié.
      hardcoreLadder.add({
        name: characterName ?? "Inconnu",
        level: statsRef.current.level,
        killedBy: lastAttackerRef.current,
        diedAt: Date.now(),
        playSec: Math.round((performance.now() - sessionStartRef.current) / 1000),
      });
      if (characterId) markFallen(characterId);
      setHardcoreDead(true);
    } else {
      // PARADISIAQUE : perte du butin NON SÉCURISÉ (diff depuis le dernier passage au hub).
      const loss = expeditionLedger.computeLoss(invRef.current.items, invRef.current.credits);
      if (loss.lostCount > 0 || loss.lostCredits > 0) {
        setInventory((inv) => {
          const drop = new Set(loss.lostItemIndices);
          return {
            ...inv,
            items: inv.items.filter((_, i) => !drop.has(i)),
            credits: Math.max(0, inv.credits - loss.lostCredits),
          };
        });
        pushToastRef.current?.(
          `💀 Butin non sécurisé perdu : ${loss.lostCount} objet(s), ${loss.lostCredits} cr`,
          "#ff7a7a",
        );
      }
    }
    // Ferme tous les menus / dialogues pour libérer l'overlay
    setPaused(false);
    setInvOpen(false);
    setCharMenu(false);
    setOpenMerchant(null);
    setNearMerchant(null);
    setNearWeaponMaster(false);
    setNearShipId(null);
    // Si en pilotage : ejecter sans dépendre des conditions normales d'exit
    if (pilotedShipIdRef.current) {
      shipControllerRef.current = null;
      setPilotedShipId(null);
    }
  }, [stats.currentHp, isDead]);

  // ── Voyage spatial — ARRIVÉE EN VOL si on était en pilotage ──────────────
  // Comportement :
  //   • À pied au moment du voyage  → arrive à pied à (0, 5, 0)
  //   • En pilotage au moment du voyage → arrive EN VOL avec un vaisseau actif
  //     à une altitude qui permet l'atterrissage manuel (planète) ou rejoindre
  //     la station orbitale (espace). Le joueur sort du vaisseau avec E quand
  //     `canExit` (lent + bas) — comme partout ailleurs.
  //
  // Hauteurs choisies pour ressentir le décollage/atterrissage :
  //   • Planète (forge/tower)  : 150 m → vol descendu confortable
  //   • Orbital                : 80 m  → hub spatial accessible
  const travelTo = useCallback((target: keyof typeof MAPS) => {
    setCurrentMap((cur) => {
      if (target === cur) return cur;
      // GARDE anti-crash : un portail peut pointer vers une map ABSENTE du manifest
      // (custom non enregistrée, supprimée, slug erroné) → MAPS[target] undefined → .label crash.
      if (!MAPS[target]) {
        console.warn(`[travelTo] map inconnue : ${target}`);
        pushToastRef.current?.(`Destination introuvable : ${String(target)}`, "#ff7a7a");
        return cur;
      }
      const color = target === "forge" ? "#ff7a3c" : target === "tower" ? "#5b9bff" : "#5bd6ff";
      setWarp({ active: true, color, label: `Voyage vers ${MAPS[target].label}…` });
      // Maps chunkées (forge = 8 chunks séquentiels) : PuzzleMap charge via son propre
      // loader. Ne PAS précharger le whole-GLB ici — fuite VRAM.
      if (!getMapChunks(target)) {
        useGLTF.preload(qualityVariant(MAPS[target].path), true, true, mapLoaderExtend);
      }

      const wasInShip = !!pilotedShipIdRef.current;

      // ANTI CONTEXT-LOST : libère le GLB de la map QUITTÉE du cache useGLTF (drei garde
      // les textures en VRAM indéfiniment → accumulation à chaque voyage). Les maps chunkées
      // sont disposées par PuzzleMap à son démontage (on ne touche qu'aux GLB uniques ici).
      const prevDef = MAPS[cur];
      if (prevDef && !prevDef.path.startsWith("editor://") && !getMapChunks(cur)) {
        try { useGLTF.clear(qualityVariant(prevDef.path)); } catch { /* déjà libéré */ }
      }

      // PURGE DES COLLIDERS — SYNCHRONE, surtout pas dans le setTimeout.
      //
      // Les maps chunkées enregistrent leurs colliders AU FIL du chargement, de
      // façon asynchrone sur plusieurs secondes. Un `clear()` différé tombait donc
      // au milieu de cette montée et effaçait tout ce qui était déjà enregistré :
      // les chunks arrivés avant le timeout perdaient leurs collisions, ceux
      // d'après les gardaient. D'où des murs solides par endroits et traversables
      // ailleurs, sans logique apparente.
      //
      // La purge doit précéder le montage de la nouvelle map, pas le suivre.
      collisionWorld.clear();

      window.setTimeout(() => {
        npcRegistry.clear();
        chestRegistry.clear();
        chatStore.clear();
        camState.current.horizontalSpeed = 0;
        setNearShipId(null);

        if (wasInShip) {
          // ── Arrivée EN VOL ─────────────────────────────────────────────
          // On continue de piloter le 1er vaisseau dispo sur la nouvelle map
          // (la flotte est définie dans SHIPS_PER_MAP).
          const newShipDef = SHIPS_PER_MAP[target]?.[0];
          if (newShipDef) {
            const altitude = target === "orbital" ? 80 : 150;
            const spawnPos = new THREE.Vector3(0, altitude, 0);
            // Nouveau ShipController positionné à l'arrivée. yaw=Math.PI :
            // le vaisseau regarde vers -Z (= avant logique) au moment du spawn.
            shipControllerRef.current = new ShipController(spawnPos, Math.PI);
            playerPos.current.copy(spawnPos);
            setPilotedShipId(newShipDef.id);
            pushToast(
              target === "orbital"
                ? "Décollage réussi — Hub orbital"
                : `Arrivée en vol — descends et appuie sur E pour atterrir`,
              "#5bd6ff",
            );
          } else {
            // Aucun ship sur la nouvelle map : fallback à pied
            shipControllerRef.current = null;
            setPilotedShipId(null);
            { const sp = pendingSpawnRef.current ?? mapSpawn(target); pendingSpawnRef.current = null; playerPos.current.set(sp[0], sp[1], sp[2]); if (pendingYawRef.current !== null) { camState.current.yaw = pendingYawRef.current; pendingYawRef.current = null; } }
          }
        } else {
          // ── Arrivée à pied (voyage non-vaisseau, ex: redémarrage) ──────
          { const sp = pendingSpawnRef.current ?? mapSpawn(target); pendingSpawnRef.current = null; playerPos.current.set(sp[0], sp[1], sp[2]); if (pendingYawRef.current !== null) { camState.current.yaw = pendingYawRef.current; pendingYawRef.current = null; } }
          shipControllerRef.current = null;
          setPilotedShipId(null);
        }

        setCurrentMap(target);
        window.setTimeout(() => setWarp((w) => ({ ...w, active: false })), 1500);
      }, 900);
      return cur;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Entrée dans un portail : vérifie le verrou (override / quête) puis voyage.
  // Assigné via ref pour que le key handler (déclaré plus haut) l'appelle sans TDZ.
  enterPortalRef.current = (portalId: string) => {
    if (portalId === "__return__") {
      // Retour : on réapparaît EXACTEMENT là où on est entré (position + rotation).
      pendingSpawnRef.current = dungeonReturnPosRef.current;
      pendingYawRef.current = dungeonReturnYawRef.current;
      travelTo(dungeonOriginRef.current);
      return;
    }
    const portal = placedPortalsRef.current.find((p) => p.id === portalId);
    if (!portal) return;
    const cfg = portalAdminStore.get();
    const open =
      cfg.adminUnlock ||
      (portal.unlockQuest !== "" &&
        (portal.lockMode === "completed"
          ? questStore.isCompleted(portal.unlockQuest)
          : questStore.isActive(portal.unlockQuest)));
    if (!open) {
      pushToast("🔒 Accès verrouillé — quête requise", "#ff6a6a");
      return;
    }
    // DONJON FURISTE : l'entrée CONSOMME une Clé (achat Oracle Vesh / drop 5 % niv 15+).
    // La clé EST le cooldown du donjon ; sortir/mourir en cours de run = clé perdue.
    if (portal.target === "donjon_furiste") {
      const idx = invRef.current.items.findIndex((i) => i.id === "key_donjon_furiste");
      if (idx < 0) {
        pushToast("🗝️ Il vous faut une Clé du Donjon Furiste (Oracle Vesh, ou drop niv 15+)", "#ff9a3c");
        return;
      }
      setInventory((inv) => {
        const i = inv.items.findIndex((it) => it.id === "key_donjon_furiste");
        if (i < 0) return inv;
        const items = inv.items.slice(); items.splice(i, 1);
        return { ...inv, items };
      });
      dungeonRun.start();
      pushToast("🗝️ Clé consommée — le Donjon Furiste s'ouvre. Tuez le boss !", "#c9a8ff");
    }
    // Mémorise la position + rotation d'entrée (devant le portail) pour ressortir pile au même endroit.
    const pp = playerPos.current;
    dungeonReturnPosRef.current = [pp.x, pp.y, pp.z];
    dungeonReturnYawRef.current = camState.current.yaw;
    dungeonOriginRef.current = currentMap;
    travelTo(portal.target as keyof typeof MAPS);
  };

  // ── Sorts VFX ─────────────────────────────────────────────────────────────
  const [activeSpells, setActiveSpells] = useState<ActiveSpell[]>([]);
  const spellCounter = useRef(0);

  const handleCastSpell = useCallback((spell: SpellDef) => {
    if (npcAdminStore.get().placementActive) return; // mode placement PNJ → le clic place, ne lance pas
    if (spell.damage > 0) markCombat();
    camState.current.castToken += 1;
    camState.current.castAction = spell.archetype === "aoe" ? "ultimate" : "cast";
    const origin = playerPos.current.clone().add(new THREE.Vector3(0, 1.4, 0));
    const yaw    = camState.current.yaw;
    const pitch  = camState.current.pitch;
    const id     = `spell_${spellCounter.current++}`;
    const horiz  = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)).normalize();

    // Multiplicateurs de dégâts communs (véhicule + talents + élément + puissance).
    const boostMult     = 1 + (shipControllerRef.current?.spellBoost ?? 0);
    const talentDmgMult = aggregateTalents(effRef.current.talents).damageMult;
    const elemMult      = elementDamageMult(effRef.current.elements, spell.element);
    const dmgOf = (base: number) =>
      base * (1 + effRef.current.puissance / 100) * elemMult * boostMult * talentDmgMult;

    // ── Sort CIBLÉ "point & click" (homing, portée courte) ───────────────────
    // Verrouille l'ennemi le plus proche DEVANT dans `range`. Le projectile vole
    // jusqu'à lui (SpellVFX suit sa position live) ; les dégâts s'appliquent à
    // l'IMPACT via handleSpellImpact (modèle différé, pas instantané).
    if (spell.homing) {
      let best: NpcHandle | null = null;
      let bestDist = Infinity;
      for (const e of npcRegistry.queryEnemiesInRadius(playerPos.current, spell.range)) {
        const to = e.getPosition().clone().sub(playerPos.current);
        to.y = 0;
        const d = to.length();
        if (d < 0.01) { best = e; break; }
        if (to.normalize().dot(horiz) > 0 && d < bestDist) { best = e; bestDist = d; }
      }
      // Verrouillage UNIQUEMENT si une cible est à proximité (= point & click).
      if (best) {
        const target = best; // const → le narrowing tient dans la closure ci-dessous
        // Dégâts IMMÉDIATS et fiables au point de la cible (AoE conservée si le
        // sort en a une). Découplé de la VFX → marche même si les sprites manquent.
        const radius = spell.aoeRadius > 0 ? spell.aoeRadius : 1.8;
        let hitAny = false;
        for (const e of npcRegistry.queryEnemiesInRadius(target.getPosition(), radius)) {
          e.applyDamage(dmgOf(spell.damage));
          hitAny = true;
        }
        if (hitAny) screenShake.add(spell.aoeRadius > 0 ? 0.3 : 0.15);
        // Projectile VISUEL qui vole jusqu'à la cible (sans dégâts différés).
        setActiveSpells((prev) => [
          ...prev,
          { id, spell, origin, direction: horiz.clone(), elapsed: 0, hit: false, targetId: target.id },
        ].slice(-16));
        return;
      }
      // Pas de cible à portée → feedback clair, le sort ne se lance pas.
      pushToastRef.current?.("Aucune cible à portée", "#94a3b8");
      return;
    }

    // ── Sort DIRECTIONNEL / instantané ───────────────────────────────────────
    // Projectile (speed>0) : direction 3D yaw+pitch → part où pointe le viseur.
    // Zone/contact (speed=0) : direction horizontale (centré joueur).
    const cp  = Math.cos(pitch);
    const dir = spell.speed > 0
      ? new THREE.Vector3(-Math.sin(yaw) * cp, -Math.sin(pitch), -Math.cos(yaw) * cp).normalize()
      : horiz.clone();
    setActiveSpells((prev) => [
      ...prev,
      { id, spell, origin, direction: dir, elapsed: 0, hit: false },
    ].slice(-16));
    const ground = playerPos.current;
    const reach  = spell.speed > 0 ? spell.range : Math.max(spell.aoeRadius, 10);
    let hitAny = false;
    for (const e of npcRegistry.queryEnemiesInRadius(ground, reach)) {
      const to = e.getPosition().clone().sub(ground);
      to.y = 0;
      const inFront = spell.speed === 0 || to.length() < 0.001 || to.normalize().dot(dir) > 0;
      if (inFront) { e.applyDamage(dmgOf(spell.damage)); hitAny = true; }
    }
    // Game juice : un coup qui PORTE secoue la caméra (AoE/ultime = plus fort).
    if (hitAny) screenShake.add(spell.archetype === "aoe" ? 0.3 : 0.1);
  }, [markCombat]);

  // ── Impact d'un sort CIBLÉ : dégâts différés au point d'arrivée ────────────
  // Appelé par SpellVFX quand le projectile homing atteint la cible. Applique
  // les dégâts dans le rayon AoE (ou 1.2 m pour un mono-cible) → "le sort arrive
  // sur la cible et explose dessus".
  const handleSpellImpact = useCallback((pos: THREE.Vector3, damage: number, aoeRadius: number) => {
    if (damage <= 0) return; // projectile purement visuel (dégâts déjà appliqués au lancer)
    markCombat();
    const radius = aoeRadius > 0 ? aoeRadius : 1.2;
    let hitAny = false;
    for (const e of npcRegistry.queryEnemiesInRadius(pos, radius)) { e.applyDamage(damage); hitAny = true; }
    if (hitAny) screenShake.add(aoeRadius > 0 ? 0.3 : 0.15);
  }, [markCombat]);

  const handleSpellExpire = useCallback((id: string) => {
    setActiveSpells((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleNpcHitPlayer = useCallback((dmg: number, element?: ElementId, attackerLabel?: string) => {
    if (attackerLabel) lastAttackerRef.current = attackerLabel; // ladder mort définitive
    // Joueur déjà MORT (course même-frame avant le démontage des PNJ) : ignorer — sinon
    // markCombat retarde la régén post-respawn et l'anim "hit" écrase l'anim de mort.
    if (!npcRegistry.playerAlive) return;
    // Esquive (i-frames) : annule entièrement le coup (0 dégât, pas de flash).
    if (performance.now() < dodgeUntilRef.current) return;
    // PARADE réussie : un coup de MÊLÉE (element absent) dans la fenêtre → annulé.
    // La magie (element défini) traverse la parade (on ne pare pas un sort à mains nues).
    if (!element && performance.now() < parryUntilRef.current) {
      pushToastRef.current?.("⚔️ Parade !", "#9be8ff");
      screenShake.add(0.04);
      return;
    }
    markCombat();
    lastCombatAtRef.current = performance.now();
    const def     = effRef.current.defense;
    const resist  = element ? elementResistMult(effRef.current.elements, element) : 1;
    let mitigated = Math.max(1, dmg * (1 - def / (def + 80)) * resist);

    // GARDE Guerrier : tant que la garde est levée et qu'il reste des coups à encaisser,
    // réduit les dégâts (mêlée −60% / magie −20%) et décrémente. element défini = magie ;
    // element absent = mêlée. Au 3e coup bloqué → la garde se brise (doit la relever).
    const guard = guardRef.current;
    if (guard.active && guard.hitsLeft > 0) {
      mitigated *= element ? 0.8 : 0.4;
      guard.hitsLeft -= 1;
      if (guard.hitsLeft <= 0) {
        guard.active = false;
        pushToastRef.current?.("🛡️ Garde brisée !", "#ff9a3c");
      }
    }

    // Game juice : encaisser un coup secoue la caméra, proportionnel aux dégâts.
    screenShake.add(Math.min(0.5, mitigated / 70));

    // Redirection vers le véhicule si en pilotage (et que le véhicule a des PV).
    // C'est le pattern "véhicule = bouclier du pilote" — GTA/Halo style.
    // Si le véhicule explose, l'extérieur gère l'auto-exit (cf. useEffect ship destroyed).
    const ctrl = shipControllerRef.current;
    if (ctrl?.hasHp && !ctrl.destroyed) {
      ctrl.takeDamage(mitigated);
      return; // dégâts absorbés par le véhicule — le joueur ne perd PAS de PV
    }

    camState.current.oneShotAction = "hit";
    camState.current.oneShotToken += 1; // réaction d'impact (brève, non interruptive de la mort)
    // Chiffre flottant ROUGE des dégâts subis (au-dessus du joueur).
    damageEvents.emit(playerPos.current.x, playerPos.current.y, playerPos.current.z, mitigated, "player_hurt");
    setStats((s) => ({ ...s, currentHp: Math.max(0, s.currentHp - mitigated) }));
  }, [markCombat]);

  const handleStatsFromHud = useCallback((next: PlayerStats) => {
    setStats((s) => ({ ...s, currentHp: next.currentHp, currentMana: next.currentMana }));
  }, []);

  const handleNpcCast = useCallback((spell: SpellDef, origin: THREE.Vector3, dir: THREE.Vector3) => {
    const id = `npc_spell_${spellCounter.current++}`;
    setActiveSpells((prev) => [
      ...prev,
      { id, spell, origin, direction: dir, elapsed: 0, hit: false },
    ].slice(-16));
  }, []);

  // ── Toasts ────────────────────────────────────────────────────────────────
  const [toasts, setToasts] = useState<{ id: number; text: string; color: string }[]>([]);
  const toastId = useRef(0);
  const pushToast = useCallback((text: string, color: string) => {
    const id = toastId.current++;
    setToasts((t) => [...t, { id, text, color }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);

  // ── Audio gameplay : toast de palier de série + annonce d'entrée de map ───────
  // Le toast « DOUBLE KILL »… accompagne l'annonce vocale (feedback visuel + sonore).
  useEffect(() => {
    audioEvents.onStreakLabel = (label) => pushToast(`🔥 ${label} !`, "#ff8a3c");
    return () => { audioEvents.onStreakLabel = undefined; };
  }, [pushToast]);
  // Annonce d'entrée (entrée + niveau conseillé / donjon) quand la map est RÉVÉLÉE.
  // Reset des événements audio (série + alertes boss) au changement de map.
  useEffect(() => {
    if (revealed && announcedMapRef.current !== currentMap) {
      announcedMapRef.current = currentMap;
      audioEvents.reset();
      audioEvents.enterMap(currentMap);
    }
  }, [revealed, currentMap]);
  // Préchauffe les FBX d'archétype en temps idle → choix de maîtrise d'arme sans freeze.
  useEffect(() => { if (revealed) preloadArchetypeAssetsIdle(); }, [revealed]);
  // Maintient la ref à jour pour les callbacks déclarés AVANT pushToast
  // (ex: exitShip ligne ~497). Évite le TDZ "Cannot access 'pushToast' before init".
  pushToastRef.current = pushToast;

  // Ouverture du COFFRE de donjon : 1 objet RARE+ GARANTI (reroll pity) + 2 rolls + 150-300 cr.
  const handleChestOpen = useCallback(() => {
    const lvl = Math.max(15, statsRef.current.level);
    const RANK: Record<string, number> = { common: 0, rare: 1, epic: 2, alien: 2, legendary: 3, mythic: 4, divine: 5 };
    let prize = rollLoot("donjon_furiste", lvl, 1)[0];
    for (let i = 0; i < 15 && (RANK[prize?.rarity ?? "common"] ?? 0) < 1; i++) {
      prize = rollLoot("donjon_furiste", lvl, 1)[0];
    }
    const extra = rollLoot("donjon_furiste", lvl, 2);
    const credits = 150 + Math.floor(Math.random() * 151);
    setInventory((inv) => {
      let v = addCredits(inv, credits);
      for (const it of [prize, ...extra]) if (it) v = addItem(v, it);
      return v;
    });
    dungeonRun.chestOpened();
    screenShake.add(0.1);
    pushToast(`🏆 Donjon vaincu ! ${prize?.label ?? "Butin"} + ${extra.length} objets + ${credits} cr`, "#ffd24d");
  }, [pushToast]);

  // ── Récolte : démarrage + résolution d'un coup (mini-jeu) ──────────────────
  const STRIKE_STAMINA = 6;
  const startGather = useCallback((id: string) => {
    const node = harvestRegistry.get(id);
    if (!node || !node.available()) return;
    if (professionStore.stamina() < STRIKE_STAMINA) {
      pushToast("Endurance épuisée — repose-toi avant de récolter", "#ff8a3c");
      return;
    }
    setGatherNodeId(id);
  }, [pushToast]);
  startGatherRef.current = startGather;

  const handleGatherCancel = useCallback(() => setGatherNodeId(null), []);

  // ── Cast d'un sort d'archétype (touches C/V/B) ─────────────────────────────
  // Ref-closure (comme enterPortalRef) : capture les refs live (playerPos/camState/
  // effRef) et pushToast. Relie l'exécuteur au runtime (dégâts %PV, effets, cooldown).
  castArchetypeRef.current = (spell: ArchetypeSpell, charge?: number) => {
    const yaw = camState.current.yaw;
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)); // avant du joueur
    const res = executeArchetypeSpell(spell, {
      playerPos: playerPos.current,
      playerMaxHp: effRef.current.maxHp,
      playerAtk: effRef.current.puissance,
      cdReduction: effRef.current.cdReduction ?? 0,
      facing: forward,
      charge,
      onTeleport: (t) => { playerPos.current.set(t.x, t.y, t.z); },
      onAoe: (center, radius, damage, windup) => {
        // AoE ESQUIVABLE du joueur : réutilise BossAoeZone en mode targetEnemies.
        // Teinte cyan-vert pour la distinguer du violet/rouge des AoE de boss.
        handleBossAoe({
          id: `paoe_${archAoeSeq.current++}`,
          pos: [center.x, center.y, center.z],
          radius, kind: "ultimate", windup, damage,
          targetEnemies: true, color: "#5cff8a",
        });
      },
    });
    if (!res.ok) {
      if (res.reason === "cooldown") pushToast(`${spell.label} — récupération ${Math.ceil(cooldownStore.remaining(spell.id))}s`, "#f87171");
      return;
    }
    camState.current.castToken += 1;
    camState.current.castAction = spell.isUltimate ? "ultimate" : "cast";
    pushToast(`${spell.label}${res.hits ? ` — ${res.hits} touché(s)` : ""}`, spell.isUltimate ? "#ffb547" : "#a3e635");
  };

  autoAttackRef.current = createAutoAttackHandler({ camState, effRef, playerPos, pushToastRef });

  unarmedStrikeRef.current = createUnarmedStrikeHandler({ effRef, camState, comboRef, playerPos });

  // IMPACT effectif d'un coup (chop + son + récolte). Appelé soit immédiatement
  // (mineur/récolteur), soit À LA FRAME D'IMPACT de la hache (bûcheron, via le viewmodel).
  const applyChopImpact = useCallback((quality: number) => {
    const id = gatherNodeIdRef.current;
    if (!id) return;
    const node = harvestRegistry.get(id);
    if (!node || !node.available()) { setGatherNodeId(null); return; }
    const res = node.chop(quality);
    const prof = node.profession;
    if (res.struck) {
      // Le dossier `recolte/` n'a jamais existé sur disque : chaque coup de hache
      // partait chercher un fichier absent, et le fallback SPA de Vite renvoyait
      // index.html en 200 — d'où « no supported source was found » à répétition.
      // On utilise l'échantillon d'arbre réellement présent dans le pack.
      audioManager.playSfx("SFX_Take_Trees_001.WAV", 0.6);
      screenShake.add(0.07);
      professionStore.addXp(prof, quality >= 0.6 ? 4 : 2);
    }
    if (res.depleted) {
      const def = getProfession(prof);
      const tier = bestTierForLevel(def, professionStore.level(prof));
      if (tier) {
        const amount = 1 + (quality >= 0.6 ? 1 : 0); // bonus si le coup final est dans le cœur de zone
        professionStore.addResource(tier.id, amount);
        const gained = professionStore.addXp(prof, tier.baseXp);
        pushToast(
          `🪵 +${amount} ${tier.label} · +${tier.baseXp} XP ${def.label}` +
          (gained ? ` — Niveau ${professionStore.level(prof)} !` : ""),
          def.color,
        );
      }
      setGatherNodeId(null);
    }
  }, [pushToast]);

  const handleGatherStrike = useCallback((quality: number) => {
    const id = gatherNodeIdRef.current;
    if (!id) return;
    const node = harvestRegistry.get(id);
    if (!node || !node.available()) { setGatherNodeId(null); return; }
    // Chaque frappe coûte de l'endurance (réussie ou non). Plus d'endurance → on arrête.
    if (!professionStore.spendStamina(STRIKE_STAMINA)) {
      pushToast("Endurance épuisée — repose-toi", "#ff8a3c");
      setGatherNodeId(null);
      return;
    }
    if (node.profession === "bucheron") {
      // Bûcheron : on déclenche l'anim de coupe ; l'impact (son + récolte) se joue
      // à la FRAME (hit) de la hache (cf. BucheronAxeViewmodel.onImpact).
      chopQualityRef.current = quality;
      setChopSwingToken((t) => t + 1);
    } else {
      applyChopImpact(quality); // mineur / récolteur : impact immédiat
    }
  }, [pushToast, applyChopImpact]);

  const handleBoundaryHit = useCallback(() => {
    pushToast("Limite spatiale — zone de vol dépassée", "#ff8040");
    setBoundaryHit((n) => n + 1);
  }, [pushToast]);

  // Octroi de récompense de quête (XP / crédits / items) + feedback toast.
  // Pur côté React : déclenché par les record*() du questStore qui retournent
  // les QuestDef tout juste terminées.
  const grantQuestReward = useCallback((def: QuestDef) => {
    const r = def.reward;
    if (r.xp)      setStats((s) => addXp(s, r.xp!));
    if (r.credits) setInventory((inv) => addCredits(inv, r.credits!));
    for (const id of r.items ?? []) {
      const it = LOOT_CATALOG[id];
      if (it) setInventory((inv) => addItem(inv, it));
    }
    if (def.factionId) reputationStore.gain(def.factionId, REP_GAINS.QUEST_COMPLETE);
    pushToast(`✓ Quête terminée : ${def.title}`, "#4ade80");
  }, [pushToast]);

  const handleNpcDeath = useCallback((xp: number, folder?: string, factionOverride?: string) => {
    setStats((s) => addXp(s, xp));
    pushToast(`+${xp} XP`, "#a3e635");
    audioEvents.registerKill();
    for (const def of questStore.recordKill()) grantQuestReward(def);
    if (folder) {
      const npcDef = getNpc(folder);
      const fid = (factionOverride as import("../runtime/core/worldTypes").FactionId | undefined) ?? npcDef?.factionId;
      if (fid) {
        const isEnemy = npcDef?.role === "enemy";
        if (isEnemy) {
          reputationStore.gain(fid, REP_GAINS.KILL_ENEMY);
        } else {
          reputationStore.lose(fid, REP_GAINS.KILL_ALLY_PENALTY);
        }
      }
    }
    const activeComp = petStore.getActiveCompanion();
    if (activeComp) petStore.grantXp(activeComp.id, Math.ceil(xp * 0.3));
  }, [pushToast, grantQuestReward]);

  // ── Respawn ───────────────────────────────────────────────────────────────
  // Restaure 50% PV / 30% Mana, téléporte au point d'entrée de la map, purge
  // le combat timer. On ne perd PAS le niveau / l'inventaire / l'XP — le
  // respawn est gratuit pour l'instant (pénalité ajoutable plus tard).
  const handleRespawn = useCallback(() => {
    setStats((s) => ({
      ...s,
      currentHp:   Math.max(1, Math.round(s.maxHp   * 0.5)),
      currentMana: Math.max(0, Math.round(s.maxMana * 0.3)),
    }));
    const map = mapRef.current;
    if (map === "donjon_furiste") {
      // Donjon : on RECOMMENCE la salle → spawn dans l'Entrée + ennemis ressuscités
      // (remontage via npcEpoch) + mur du boss re-scellé s'il reste des mobs.
      const sp = mapSpawn("donjon_furiste");
      playerPos.current.set(sp[0], sp[1], sp[2]);
      setNpcEpoch((e) => e + 1);
      const hasMobs = placedNpcsRef.current.some((p) => p.rank !== "boss" && getNpc(p.folder)?.role === "enemy");
      setGateOpen(!hasMobs);
      pushToast("Vous renaissez — la salle se réinitialise", "#c040ff");
    } else {
      // Point de spawn éditable de la map (sinon réglage statique / repli).
      const sp = mapSpawn(map);
      playerPos.current.set(sp[0], sp[1], sp[2]);
      pushToast("Vous renaissez au point d'entrée", "#a3e635");
    }
    camState.current.horizontalSpeed = 0;
    combatUntil.current = 0;
    prevHpRef.current = 1; // évite un dmgFlash parasite au prochain render
    setIsDead(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pushToast]);

  const handleLoot = useCallback((loot: CorpseLoot) => {
    let sim = invRef.current;
    const added: typeof loot.items = [];
    let blocked = false;
    for (const it of loot.items) {
      if (canAdd(sim, it)) { sim = addItem(sim, it); added.push(it); }
      else blocked = true;
    }
    setInventory((inv) => {
      let next = inv;
      for (const it of added) next = addItem(next, it);
      if (loot.credits) next = addCredits(next, loot.credits);
      return next;
    });
    if (added.length)  pushToast(`Pillé : ${added.map((i) => i.label).join(", ")}${loot.credits ? `  +${loot.credits} cr` : ""}`, "#fbbf24");
    else if (loot.credits) pushToast(`+${loot.credits} cr`, "#fbbf24");
    if (blocked) pushToast("Inventaire plein / surchargé", "#f87171");
  }, [pushToast]);

  // ── Destruction véhicule : explosion + éjection + dégâts résiduels ──────
  const handleVehicleDestroyed = useCallback((pos: [number, number, number]) => {
    // Couleur d'explosion = couleur du véhicule (capturée avant unmount)
    const vehicleColor = summonedVehicleId
      ? VEHICLE_CATALOG[summonedVehicleId].color
      : "#ff7a3c";
    setExplosionVfx({ pos, color: vehicleColor, key: Date.now() });
    screenShake.add(0.7); // game juice : grosse secousse à l'explosion
    setTimeout(() => setExplosionVfx(null), 1500);

    // Éjection forcée — pas de check canExit (urgence)
    shipControllerRef.current = null;
    setPilotedShipId(null);
    setSummonedVehicleId(null);
    playerPos.current.set(pos[0], pos[1] + 1, pos[2]);

    // Dégâts résiduels au joueur (40% des PV courants — sévère mais survivable)
    setStats((s) => ({
      ...s,
      currentHp: Math.max(1, Math.floor(s.currentHp * 0.6)),
    }));

    pushToast("💥 Véhicule détruit — éjection d'urgence !", "#ef4444");
  }, [summonedVehicleId, pushToast]);

  // ── Invocation d'un véhicule (clé) — spawn devant le joueur + embarque ───
  const summonVehicle = useCallback((vehicleId: VehicleId) => {
    if (pilotedShipIdRef.current) {
      pushToast("Tu pilotes déjà un véhicule", "#fbbf24");
      return false;
    }
    const def = getVehicleDef(vehicleId);
    // Spawn 5m devant le joueur, dans la direction où la caméra regarde
    const yaw = camState.current.yaw;
    const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const spawnPos = playerPos.current.clone()
      .addScaledVector(fwd, 5)
      .add(new THREE.Vector3(0, SHIP_HOVER_HEIGHT, 0));
    // Factory : crée le bon contrôleur selon def.kind (terrestre → roule au sol,
    // aérien → vole) et applique ses stats (PV, speedMult, résistances…).
    const ctrl = createVehicleController(def, spawnPos, yaw + Math.PI);
    shipControllerRef.current = ctrl;
    setSummonedVehicleId(vehicleId);
    setPilotedShipId(`summoned_${vehicleId}`);
    pushToast(`${def.label} invoqué — Appuie E pour quitter`, def.color);
    return true;
  }, [pushToast]);

  // ── Consommation d'item (potions / clés de véhicule) ──────────────────────
  // Invoque un pet de combat devant le joueur (remplace l'invocation active).
  const summonPet = useCallback((petId: string): boolean => {
    const def = getPetSummon(petId);
    if (!def) return false;
    const p = playerPos.current;
    const yaw = camState.current.yaw;
    // Spawn ~2 m devant le joueur.
    const pos: [number, number, number] = [p.x - Math.sin(yaw) * 2, p.y, p.z - Math.cos(yaw) * 2];
    setActiveSummon({ def, pos, key: summonKeyRef.current++ });
    pushToast(`${def.label} invoqué ! (${def.lifetime}s)`, "#a3e635");
    return true;
  }, [pushToast]);

  // Applique useEffect.heal / .mana / .summonVehicle / .summonPet, retire l'item du sac.
  const handleUseItem = useCallback((itemId: string) => {
    const item = invRef.current.items.find((i) => i.id === itemId);
    if (!item?.useEffect) return;

    // ── Cas 0 : invocation de pet de combat ───────────────────────────────
    if (item.useEffect.summonPet) {
      if (summonPet(item.useEffect.summonPet)) {
        setInventory((inv) => consumeItem(inv, itemId) ?? inv);
      }
      return;
    }

    // ── Cas 1 : invocation de véhicule ────────────────────────────────────
    if (item.useEffect.summonVehicle) {
      const success = summonVehicle(item.useEffect.summonVehicle as VehicleId);
      if (success) {
        setInventory((inv) => consumeItem(inv, itemId) ?? inv);
      }
      return;
    }

    // ── Cas 2 : kit de réparation véhicule ────────────────────────────────
    if (item.useEffect.repairVehicle) {
      const ctrl = shipControllerRef.current;
      if (!ctrl || !ctrl.hasHp) {
        pushToast("Aucun véhicule à réparer", "#f87171");
        return;
      }
      if (ctrl.hpRatio >= 1) {
        pushToast("Véhicule déjà à 100 % PV", "#94a3b8");
        return;
      }
      ctrl.fullRepair();
      setInventory((inv) => consumeItem(inv, itemId) ?? inv);
      pushToast(`🔧 Véhicule réparé à 100 % PV`, "#86efac");
      return;
    }

    // ── Cas munitions : recharge la réserve (flèches / cellules) ──────────
    if (item.useEffect.addAmmo) {
      const { kind, count } = item.useEffect.addAmmo;
      ammoStore.add(kind, count);
      setInventory((inv) => consumeItem(inv, itemId) ?? inv);
      pushToast(`+${count} ${kind === "arrows" ? "flèches" : "cellules"}`, "#a8d4ff");
      return;
    }

    // ── Cas 2 : potion (heal / mana) ──────────────────────────────────────
    const heal = item.useEffect.heal ?? 0;
    const mana = item.useEffect.mana ?? 0;
    const s = statsRef.current;
    const eff = effRef.current;

    const wouldHelp =
      (heal > 0 && s.currentHp < eff.maxHp) ||
      (mana > 0 && s.currentMana < eff.maxMana);
    if (!wouldHelp) {
      pushToast(`${item.label} : déjà au max`, "#94a3b8");
      return;
    }

    setStats((cur) => ({
      ...cur,
      currentHp:   Math.min(eff.maxHp,   cur.currentHp   + heal),
      currentMana: Math.min(eff.maxMana, cur.currentMana + mana),
    }));
    setInventory((inv) => consumeItem(inv, itemId) ?? inv);

    const color = heal >= mana ? "#86efac" : "#a8d4ff";
    const parts: string[] = [];
    if (heal > 0) parts.push(`+${heal} PV`);
    if (mana > 0) parts.push(`+${mana} MP`);
    pushToast(`${item.icon} ${item.label} — ${parts.join(" / ")}`, color);
  }, [pushToast, summonVehicle, summonPet]);

  // ── Raccourcis rapides : R = potion de soin, T = potion de mana ──────────
  // Utilise la première potion correspondante dans l'inventaire (FIFO).
  const handleQuickHeal = useCallback(() => {
    const potion = findFirstHealPotion(invRef.current);
    if (!potion) {
      pushToast("Aucune potion de soin disponible", "#f87171");
      return;
    }
    handleUseItem(potion.id);
  }, [handleUseItem, pushToast]);

  const handleQuickMana = useCallback(() => {
    const potion = findFirstManaPotion(invRef.current);
    if (!potion) {
      pushToast("Aucune potion de mana disponible", "#f87171");
      return;
    }
    handleUseItem(potion.id);
  }, [handleUseItem, pushToast]);

  // ── Réparation rapide (R près du garagiste) ──────────────────────────────
  const handleQuickRepair = useCallback(() => {
    const ctrl = shipControllerRef.current;
    if (!ctrl || !ctrl.hasHp) {
      pushToast("Aucun véhicule à réparer", "#f87171");
      return;
    }
    if (ctrl.hpRatio >= 1) {
      pushToast("Véhicule déjà à 100 % PV", "#94a3b8");
      return;
    }
    const kit = invRef.current.items.find((i) => i.id === "repair_kit");
    if (!kit) {
      pushToast("🔧 Aucun kit de réparation dans l'inventaire — achetez-en chez le garagiste", "#fbbf24");
      return;
    }
    handleUseItem(kit.id);
  }, [handleUseItem, pushToast]);

  // ── Utilisation d'un slot consommable (4/5/6) ─────────────────────────────
  // Lit le store puis tente d'utiliser l'item du slot. Si l'inventaire ne
  // contient plus l'item assigné (consommé), toast d'avertissement.
  const handleUseSlot = useCallback((slotIdx: 0 | 1 | 2) => {
    const itemId = consumableSlotsStore.getSlot(slotIdx);
    if (!itemId) {
      pushToast(`Slot ${slotIdx + 4} vide`, "#94a3b8");
      return;
    }
    const hasIt = invRef.current.items.some((i) => i.id === itemId);
    if (!hasIt) {
      const def = LOOT_CATALOG[itemId];
      pushToast(`Plus de ${def?.label ?? "consommable"} en stock`, "#f87171");
      return;
    }
    handleUseItem(itemId);
  }, [handleUseItem, pushToast]);

  // Maintient les refs à jour avec les dernières versions des callbacks.
  // Comme ça le listener clavier (déclaré PLUS HAUT) lit toujours la version
  // courante, sans avoir à se remonter à chaque changement de dépendance.
  quickHealRef.current = handleQuickHeal;
  quickManaRef.current = handleQuickMana;
  quickRepairRef.current = handleQuickRepair;
  useSlotRef.current   = handleUseSlot;

  // Ambiance + musique
  useEffect(() => { audioManager.setMap(currentMap); }, [currentMap]);

  // Montée de niveau
  const prevLevel = useRef(stats.level);
  useEffect(() => {
    if (stats.level > prevLevel.current) {
      pushToast(`NIVEAU ${stats.level} !`, "#f59e0b");
      setLvlFlash((n) => n + 1);
      audioManager.playSfxKey("levelUp");
    }
    prevLevel.current = stats.level;
  }, [stats.level, pushToast]);

  // Purge du registre PNJ au démontage
  useEffect(() => () => npcRegistry.clear(), []);

  // ── PNJ ───────────────────────────────────────────────────────────────────
  // Auto-spawn d'ennemis SUPPRIMÉ : TOUS les PNJ sont placés à la main via l'éditeur
  // PNJ (F9). Plus aucun ennemi ne pop automatiquement sur les maps.
  const npcs = useMemo<{ folder: string; pos: [number, number, number]; level: number }[]>(
    () => [],
    [],
  );

  const merchantPlacements = useMemo(() => {
    // ── Orbital : station spatiale vivante avec plusieurs services ──────────
    // Garagiste (véhicules + réparations), marchand de ressources, apothicaire,
    // et à terme un hangar de réparation dédié (interaction directe).
    if (currentMap === "orbital") {
      const garagist = MERCHANTS.find((m) => m.type === "vehicles");
      const resources = MERCHANTS.find((m) => m.type === "resources");
      const potions   = MERCHANTS.find((m) => m.type === "potions");
      return [
        ...(garagist  ? [{ def: garagist,  pos: [0, 0, 6]    as [number, number, number] }] : []),
        ...(resources ? [{ def: resources, pos: [8, 0, 5]    as [number, number, number] }] : []),
        ...(potions   ? [{ def: potions,   pos: [-8, 0, 5]   as [number, number, number] }] : []),
      ];
    }
    // ── Planètes (forge/tower) : tous les marchands en ligne ───────────────
    // Le Garagiste y est aussi présent (le joueur peut acheter une clé au
    // sol pour décoller immédiatement avec son véhicule sans retourner en orbital).
    return MERCHANTS.map((m, i) => ({
      def: m,
      pos: [-12.5 + i * 5, 0, 14 + (i % 2) * 2.5] as [number, number, number],
    }));
  }, [currentMap]);

  // Maître d'Armes (sélection de classe) : sur les planètes uniquement, à l'écart
  // de la rangée de marchands. Absent de l'orbital (station = garagiste seul).
  const weaponMasterPos = useMemo<[number, number, number] | null>(
    () => (currentMap === "orbital" ? null : [14, 0, 8]),
    [currentMap],
  );

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ position: "fixed", inset: 0, background: "#05060a" }}>
      {/* Loading screen 2 phases : préchargement HTTP + assemblage GPU complet
          de la map. Le Canvas est monté (masqué) DERRIÈRE l'overlay → PuzzleMap
          assemble toute la map pendant le chargement. On ne révèle qu'à 100 %
          → map complète au spawn, aucun freeze en jeu. */}
      {loadingVisible && (
        <LoadingScreen
          mapId={currentMap}
          mapProgress={mapProgress}
          onPreloadDone={() => setPreloadDone(true)}
          /* L'overlay ne se ferme que quand TOUT est chargé : map assemblée + préchargement
             + TOUS les PNJ placés montés (l'étagement tourne DERRIÈRE l'overlay — la scène
             est rendue dessous). Exigence : ne pas sortir du chargement avant complétion. */
          done={revealed && characterReady && (placedNpcs.length === 0 || npcStagedCount >= placedNpcs.length)}
          onHidden={() => setLoadingVisible(false)}
        />
      )}
      {gpuLost && (
        <div style={{
          position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
          zIndex: 400, display: "flex", alignItems: "center", gap: 12,
          background: "rgba(20, 8, 8, 0.95)", border: "1px solid #7f1d1d",
          borderRadius: 8, padding: "10px 16px", color: "#fca5a5",
          fontFamily: "monospace", fontSize: 12,
        }}>
          <span>⚠ Contexte GPU perdu — tentative de restauration…</span>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "4px 12px", fontSize: 11, fontWeight: 700,
              background: "#ef4444", color: "#fff", border: "none",
              borderRadius: 4, cursor: "pointer",
            }}
          >
            Recharger maintenant
          </button>
        </div>
      )}
      <CanvasErrorBoundary onExit={onExit}>
      <Canvas
        shadows={shadows} dpr={dpr} camera={{ position: [0, 3, 6], fov: 60, near: 0.3, far: 2000 }}
        gl={{ powerPreference: "high-performance", failIfMajorPerformanceCaveat: false, antialias: true }}
        style={{ visibility: revealed ? "visible" : "hidden" }}
      >
        <RendererRegistrar />
        {/* Récupération du contexte WebGL : un pic VRAM ne tue plus la map définitivement */}
        <ContextLossGuard onLost={handleGpuLost} onRestored={handleGpuRestored} />
        {/* ── Tick WASM (AI, physique broadphase, santé, status effects) ── */}
        <WasmWorldTicker enabled={wasmReady && revealed} />
        {/* ── Éclairage + environnement (pas de Suspense — composants purs) ── */}
          {isSpace ? (
            <>
              <ambientLight intensity={0.2} />
              <directionalLight
                position={[10, 20, 8]} intensity={1.3} castShadow
                shadow-mapSize={[shadowMapSize, shadowMapSize]}
                shadow-camera-near={0.5}  shadow-camera-far={200}
                shadow-camera-left={-60}  shadow-camera-right={60}
                shadow-camera-top={60}    shadow-camera-bottom={-60}
              />
              <Suspense fallback={null}>
                <SpaceEnvironment />
                <SpaceWarfare />
                <WorldEventsRenderer />
              </Suspense>
            </>
          ) : (
            <>
              <TunableEnvironment mapId={currentMap} shadowMapSize={shadowMapSize} />
              <pointLight position={[0, 4, 0]} color={element.emissive} intensity={1.5} distance={20} />
              {currentMap === "donjon_furiste" && <DonjonLighting />}
            </>
          )}

          {/* ── Carte 3D (Suspense ISOLÉE — un PilotableShip/Personnage qui
               suspend ne doit JAMAIS démonter PuzzleMap → sinon le chargement
               séquentiel des chunks redémarre de zéro) ───────────────────── */}
          {(() => {
            const chunks = getMapChunks(currentMap);
            const chunkDir = getMapChunkDir(currentMap);
            // restoreEpoch force un remount COMPLET après une perte de contexte GPU :
            // les objets GPU de l'ancien contexte sont invalides, reprendre les
            // chargements en vol est impossible (promesses mortes, sync WASM désynchro).
            const key = `${currentMap}-${gameSettings.video.quality}-${assetQualityVer}-${restoreEpoch}`;
            const mapPath = MAPS[currentMap]?.path ?? "";
            if (mapPath.startsWith("editor://")) {
              return <ForgeBuiltMap key={key} sceneId={mapPath.slice("editor://".length)} onReady={() => setMapAssembled(true)} playerPosition={playerPos} />;
            }
            if (MAPS[currentMap]?.monolithic) {
              return <MonolithicMap
                key={key}
                url={mapPath}
                offset={MAPS[currentMap]?.offset}
                onChunkProgress={(loaded, total) => setMapProgress({ loaded, total })}
                onComplete={() => setMapAssembled(true)}
              />;
            }
            if (chunkDir) {
              // Pendant un basculement de qualité on ne rend RIEN : c'est ce qui
              // déclenche le démontage de l'instance précédente, donc la libération
              // de sa mémoire, avant que la suivante ne commence à télécharger.
              if (qualitySwap) return null;
              return <StreamingPuzzleMap
                key={key}
                chunkDir={chunkDir}
                offset={MAPS[currentMap]?.offset}
                onChunkProgress={(loaded, total) => setMapProgress({ loaded, total })}
                onComplete={() => setMapAssembled(true)}
                onDisposed={() => { swapDisposed.current = true; finishQualitySwap(); }}
              />;
            }
            return chunks
              ? <PuzzleMap
                  key={key}
                  chunks={chunks}
                  onChunkProgress={(loaded, total) => setMapProgress({ loaded, total })}
                  onComplete={() => setMapAssembled(true)}
                />
              : <Suspense fallback={null}><MapModel
                  key={key}
                  path={qualityVariant(MAPS[currentMap].path)}
                  offset={MAPS[currentMap]?.offset}
                  onReady={() => setMapAssembled(true)}
                /></Suspense>;
          })()}
          {onReady && revealed && <SceneReady onReady={onReady} />}

        <Suspense fallback={null}>

          {/* ── Vaisseaux pilotables (pour la carte courante) ─────────────── */}
          {(SHIPS_PER_MAP[currentMap] ?? []).map((def) => (
            <PilotableShip
              key={`${currentMap}-${def.id}`}
              id={def.id}
              shipPath={def.path}
              dockPosition={def.position}
              dockYaw={def.yaw}
              modelRotation={def.modelRotation}
              scale={def.scale}
              color={def.color}
              label={def.label}
              controller={shipControllerRef}
              isPiloted={pilotedShipId === def.id}
              playerPosition={playerPos}
              onBoardZone={handleShipBoardZone}
            />
          ))}

          {/* Watcher destruction véhicule — déclenche explosion + éjection joueur */}
          <ShipDestructionWatcher
            shipControllerRef={shipControllerRef}
            onDestroyed={handleVehicleDestroyed}
          />

          {/* VFX explosion (~1.5s) — position figée au moment de la destruction */}
          {explosionVfx && (
            <ExplosionVfx
              key={explosionVfx.key}
              position={explosionVfx.pos}
              color={explosionVfx.color}
            />
          )}

          {/* ── Véhicule INVOQUÉ (via clé consommable) ───────────────────── */}
          {/* Spawn dynamique : présent uniquement quand summonedVehicleId !== null.
              dockPosition à l'origine — masqué de toute façon car isPiloted=true.
              Sortie du ship → setSummonedVehicleId(null) → le composant disparaît. */}
          {summonedVehicleId && (() => {
            const def = VEHICLE_CATALOG[summonedVehicleId];
            // Si véhicule abandonné → dock à la position d'abandon (PilotableShip
            // mode dock hover quand isPiloted=false). Sinon dockPosition origin
            // (sans effet visuel car isPiloted=true masque toutes les déco dock).
            const dockPos = abandonedShipState?.pos ?? ([0, 0, 0] as [number, number, number]);
            const dockYaw = abandonedShipState?.yaw ?? 0;
            return (
              <PilotableShip
                key={`summoned-${summonedVehicleId}`}
                id={`summoned_${summonedVehicleId}`}
                shipPath={def.path}
                dockPosition={dockPos}
                dockYaw={dockYaw}
                modelRotation={def.modelRotation}
                scale={def.scale}
                targetSize={def.targetSize}
                color={def.color}
                label={def.label}
                controller={shipControllerRef}
                isPiloted={pilotedShipId === `summoned_${summonedVehicleId}`}
                playerPosition={playerPos}
                onBoardZone={handleShipBoardZone}
              />
            );
          })()}

          {/* ── Transitions spatiales (en vol) ────────────────────────────── */}
          {/* Surface → orbital : perce l'atmosphère à 300 m d'altitude */}
          <ShipAtmosphereTrigger
            shipControllerRef={shipControllerRef}
            isPiloting={!!pilotedShipId}
            isSpaceMap={isSpace}
            onLaunch={() => travelTo("orbital")}
          />
          {/* Orbital → planète : approche d'une planète décorativeère */}
          <SpaceLandingTrigger
            shipControllerRef={shipControllerRef}
            isPiloting={!!pilotedShipId}
            isSpaceMap={isSpace}
            onLand={travelTo}
          />
          {/* Télémetrie vaisseau (mise à jour ~5×/s pour le HUD) */}
          <ShipTelemetry
            shipControllerRef={shipControllerRef}
            isPiloting={!!pilotedShipId}
            onUpdate={setShipTelemetry}
          />

          {/* Limite spatiale invisible — bloque joueur + vaisseau en hub orbital */}
          {isSpace && (
            <SpatialBoundary
              playerPosition={playerPos}
              shipControllerRef={shipControllerRef}
              onHit={handleBoundaryHit}
            />
          )}

          {/* Rig joueur (caméra + mouvement pied OU pilotage vaisseau) */}
          <PlayerRig
            playerPosition={playerPos}
            state={camState}
            inputEnabled={!uiOpen && !isDead}
            // Gouverne la PHYSIQUE (pas l'input) : tant que les 8 chunks ne sont
            // pas assemblés, la gravité reste gelée. Sinon le joueur est posé sur
            // le premier sol venu — mesuré à −228,8 pour un spawn à −26.
            worldReady={revealed}
            shipController={shipControllerRef}
            isPiloting={!!pilotedShipId}
            onJump={() => { camState.current.jumpToken += 1; }} // front montant du saut → anim jump
          />
          {/* Debug visuel collisions (admin) — visible uniquement si toggle activé */}
          <CollisionDebugOverlay playerPosition={playerPos} state={camState} />
          <LootProximity playerPosition={playerPos} nearLootRef={nearLootRef} onLabelChange={setNearLootLabel} />
          <ChestProximity playerPosition={playerPos} nearChestRef={nearChestRef} onLabelChange={setNearChestLabel} />
          <TargetingTicker camState={camState} />
          <QuestReachWatcher
            playerPosition={playerPos}
            mapId={currentMap}
            onComplete={(defs) => defs.forEach(grantQuestReward)}
          />

          {/* Personnage joueur masqué pendant le pilotage */}
          {!pilotedShipId && (
            <CharacterErrorBoundary>
              {isCustomCharacter(config.modelId) ? (
                // Perso COMPOSÉ (Forge Personnages) : corps = avatar de base + attachements + teinte + échelle.
                (() => {
                  const cc = customCharacterStore.get(config.modelId!)!;
                  const body = cc.baseAvatar;
                  const k = `cc-${cc.id}-${cc.attachments.length}`;
                  if (ownAnimPath(body)) {
                    return <OwnAnimPlayerCharacter key={k} path={ownAnimPath(body)!} playerPosition={playerPos} cameraState={camState}
                      dead={isDead} scaleMul={ownAnimScale(body) * cc.scaleMult} sharedRig={avatarSharedRig(body)}
                      weaponDrawn={weaponDrawn} offsetKey={body} attachments={cc.attachments} onCharacterReady={() => setCharacterReady(true)} />;
                  }
                  if (isMeshyAvatar(body)) {
                    return <MeshyPlayerCharacter key={k} modelId={body} playerPosition={playerPos} cameraState={camState}
                      dead={isDead} weaponDrawn={weaponDrawn} attachments={cc.attachments} scaleMult={cc.scaleMult} onCharacterReady={() => setCharacterReady(true)} />;
                  }
                  return <OwnAnimPlayerCharacter key={k} path={WRAITH_BASE} playerPosition={playerPos} cameraState={camState}
                    dead={isDead} weaponDrawn={weaponDrawn} offsetKey={DEFAULT_AVATAR} attachments={cc.attachments} scaleMul={cc.scaleMult} onCharacterReady={() => setCharacterReady(true)} />;
                })()
              ) : ownAnimPath(config.modelId) ? (
                <OwnAnimPlayerCharacter
                  key={`ownanim-${config.modelId}`}
                  path={ownAnimPath(config.modelId)!}
                  playerPosition={playerPos}
                  cameraState={camState}
                  dead={isDead}
                  scaleMul={ownAnimScale(config.modelId)}
                  sharedRig={avatarSharedRig(config.modelId)}
                  weaponDrawn={weaponDrawn}
                  offsetKey={config.modelId ?? "ninja"}
                  onCharacterReady={() => setCharacterReady(true)}
                />
              ) : isMeshyAvatar(config.modelId) ? (
                <MeshyPlayerCharacter
                  key={`meshy-${config.modelId}`}
                  modelId={config.modelId!}
                  playerPosition={playerPos}
                  cameraState={camState}
                  dead={isDead}
                  weaponDrawn={weaponDrawn}
                  onCharacterReady={() => setCharacterReady(true)}
                />
              ) : (
                <OwnAnimPlayerCharacter
                  key={`fallback-${classId}`}
                  path={WRAITH_BASE}
                  playerPosition={playerPos}
                  cameraState={camState}
                  dead={isDead}
                  weaponDrawn={weaponDrawn}
                  offsetKey={DEFAULT_AVATAR}
                  onCharacterReady={() => setCharacterReady(true)}
                />
              )}
            </CharacterErrorBoundary>
          )}

          {/* Gizmo d'arme (éditeur in-game) — null tant que le mode gizmo est off */}
          <WeaponGizmo />

          {/* PNJ */}
          {npcs.map((n, i) => (
            // Clé + id incluant la map → remontage propre à chaque voyage (évite les
            // PNJ "fantômes" qui survivent au npcRegistry.clear() et attaquent hors-registre).
            <CharacterErrorBoundary key={`${currentMap}-${n.folder}-${i}`}>
              <Npc
                id={`${currentMap}_npc_${i}_${n.folder}`}
                folder={n.folder}
                position={n.pos}
                level={n.level}
                playerPosition={playerPos}
                onHitPlayer={handleNpcHitPlayer}
                onNpcCast={handleNpcCast}
                zoneId={currentMap}
                onDeath={handleNpcDeath}
              />
            </CharacterErrorBoundary>
          ))}

          {/* PNJ placés par l'admin — montés par LOTS après la map (étalement anti-freeze).
              RESPAWN : chaque placement = point de spawn (copies de meute `${id}#k`) ; une
              copie morte est dé-rendue le temps du délai, puis re-keyée (epoch) = remount
              frais. Le butin du cadavre reste pillable jusqu'à la réapparition. */}
          {placedNpcs.slice(0, npcStagedCount).flatMap((p) => {
            if (!getNpc(p.folder)) return [];
            // Boss masqué tant que le mur du donjon est scellé (apparaît à l'ouverture).
            if (currentMap === "donjon_furiste" && p.rank === "boss" && !gateOpen) return [];
            const pack = Math.min(5, Math.max(1, p.packSize ?? 1));
            return Array.from({ length: pack }, (_, k) => {
              const copyId = pack === 1 ? p.id : `${p.id}#${k}`;
              if (respawnManager.isDead(p.id, copyId)) return null; // attend sa réapparition
              const ang = (Math.PI * 2 * k) / pack;
              const pos: [number, number, number] = pack === 1
                ? p.pos
                : [p.pos[0] + Math.cos(ang) * 2.5, p.pos[1], p.pos[2] + Math.sin(ang) * 2.5];
              return (
                <CharacterErrorBoundary key={`${copyId}-${npcEpoch}-r${respawnManager.epochOf(p.id, copyId)}`}>
                  <Npc
                    id={copyId}
                    folder={p.folder}
                    position={pos}
                    rotation={p.rot}
                    level={p.level}
                    scaleMult={p.scaleMult}
                    hpMult={p.hpMult}
                    resistMult={p.resistMult}
                    boss={p.rank === "boss"}
                    factionOverride={p.factionOverride}
                    classIdOverride={p.classIdOverride}
                    aggroRange={p.aggroRange}
                    attackRange={p.attackRange}
                    onBossAoe={handleBossAoe}
                    playerPosition={playerPos}
                    onHitPlayer={handleNpcHitPlayer}
                    onNpcCast={handleNpcCast}
                    zoneId={currentMap}
                    onDeath={handleNpcDeath}
                  />
                </CharacterErrorBoundary>
              );
            });
          })}
          {edit && npcAdminCfg.placementActive && <NpcPlacementGizmo mapId={currentMap} />}
          {spawnEdit && <SpawnPointGizmo key={currentMap} mapId={currentMap} />}
          {boundsEdit && <MapBoundsGizmo mapId={currentMap} selectedId={boundsSel} />}
          {/* Warmup GPU du PNJ sélectionné (éditeur ouvert) → upload textures hors-champ →
              placement sans freeze (les clones <Npc/> réutilisent les ressources uploadées). */}
          {npcAdminOpen && (
            <Suspense fallback={null}>
              <NpcMeshWarmup key={npcAdminCfg.folder} folder={npcAdminCfg.folder} />
            </Suspense>
          )}

          {/* ── Portails de donjon ────────────────────────────────────────── */}
          {placedPortals.map((p) => {
            const locked = !(
              portalCfg.adminUnlock ||
              (p.unlockQuest !== "" &&
                (p.lockMode === "completed"
                  ? questStore.isCompleted(p.unlockQuest)
                  : questStore.isActive(p.unlockQuest)))
            );
            return (
              <PortalZone key={p.id} id={p.id} position={p.pos} rotation={p.rot} locked={locked}
                playerPosition={playerPos} onProximity={handlePortalProximity} />
            );
          })}
          {/* Portail de retour (dans le donjon) → map d'origine, toujours ouvert */}
          {currentMap === "donjon_furiste" && (
            <PortalZone id="__return__" position={[5, 0, 34]} locked={false}
              playerPosition={playerPos} onProximity={handlePortalProximity} />
          )}
          {edit && portalCfg.placementActive && <PortalPlacementGizmo mapId={currentMap} />}

          {/* ── Nœuds de récolte plaçables + régénération d'endurance ──────── */}
          <StaminaRegen />
          <StatusEffectTicker />
          {mapAssembled && placedHarvestNodes.map((n) => (
            <HarvestNode key={n.id} id={n.id} position={n.pos} rotation={n.rot} profession={n.profession}
              playerPosition={playerPos} onProximity={handleHarvestProximity} />
          ))}
          {/* Proximité de TOUS les nœuds en 1 seul tick (au lieu d'un useFrame par nœud). */}
          <HarvestProximityTicker playerPosition={playerPos} />
          {edit && harvestCfg.placementActive && <HarvestPlacementGizmo mapId={currentMap} />}

          {/* Stress-test (F7 admin) : N NPC-bots + capteur de perfs (dans le Canvas). */}
          <StressBots
            playerPosition={playerPos}
            origin={[playerPos.current.x, playerPos.current.y, playerPos.current.z]}
            onHitPlayer={handleNpcHitPlayer}
            onNpcCast={handleNpcCast}
            onDeath={handleNpcDeath}
            onBossAoe={handleBossAoe}
          />
          {stressOpen && <PerfProbe />}

          {/* Animaux ambiants (décor vivant, pas de combat) */}
          {ambientSpawnsForMap(currentMap).map((sp) => {
            const aDef = getAmbientAnimal(sp.animal);
            if (!aDef) return null;
            return (
              <CharacterErrorBoundary key={sp.id}>
                <AmbientAnimal def={aDef} home={sp.pos} />
              </CharacterErrorBoundary>
            );
          })}

          {/* Invocation de combat active (pet allié temporaire) */}
          {activeSummon && (
            <CharacterErrorBoundary key={`summon-${activeSummon.key}`}>
              <PetSummon
                def={activeSummon.def}
                spawnPos={activeSummon.pos}
                playerPosition={playerPos}
                onExpire={() => setActiveSummon(null)}
              />
            </CharacterErrorBoundary>
          )}

          {/* Compagnon permanent (pets/) */}
          {petState.activeCompanionId && getCompanion(petState.activeCompanionId) && (
            <CharacterErrorBoundary key={`companion-${petState.activeCompanionId}`}>
              <CompanionPet
                def={getCompanion(petState.activeCompanionId)!}
                level={petStore.getOwned(petState.activeCompanionId)?.level ?? 1}
                spawnPos={[playerPos.current.x + 2, playerPos.current.y, playerPos.current.z + 2]}
                playerPosition={playerPos}
                onKill={(xp) => petStore.grantXp(petState.activeCompanionId!, xp)}
              />
            </CharacterErrorBoundary>
          )}

          {/* Viewmodel FPS bras+hache pendant la coupe d'un arbre (impact à la frame hit) */}
          {gatheringBucheron && (
            <BucheronAxeViewmodel
              swingToken={chopSwingToken}
              onImpact={() => applyChopImpact(chopQualityRef.current)}
            />
          )}

          {/* VFX pool armes à feu (muzzle flash, tracers, impacts) */}
          <GunVfxPool />

          {/* Viewmodel FPS arme ou mains nues — affiché en FPS quand arme dégainée avec une arme équipée,
              ou bras nus quand le joueur est à mains nues / arme rangée. */ }
          {cameraView === "fps" && !gatheringBucheron && (() => {
            const wid = equippedWeaponStore.activeWeaponId();
            const wp = wid ? weaponRegistry.get(wid) : undefined;
            // Arme dégainée ET équipée → viewmodel arme
            if (weaponDrawn && wp) {
              const shotgun = getShotgunFps(wp.path);
              return (
                <FpsWeaponViewmodel
                  weaponPath={wp.path}
                  fireToken={camState.current.attackToken}
                  onFireImpact={autoAttackRef.current ?? undefined}
                  externalIdleGlb={shotgun?.weapon.idleHip}
                  externalFireGlb={shotgun?.weapon.hipFire}
                />
              );
            }
            // Mains nues (arme rangée OU dégainée sans arme équipée) → bras FPS
            return (
              <FpsUnarmedViewmodel
                fireToken={camState.current.attackToken}
                onFireImpact={autoAttackRef.current ?? undefined}
              />
            );
          })()}

          {harvestAdminOpen && harvestCfg.selectedId && (() => {
            const sel = placedHarvestNodes.find((n) => n.id === harvestCfg.selectedId);
            return sel ? (
              <TransformGizmo key={`node-${sel.id}`} position={sel.pos} rotation={sel.rot ?? [0, 0, 0]}
                mode={harvestCfg.gizmoMode} color="#7ce08a" onCommit={commitHarvestTransform} />
            ) : null;
          })()}

          {/* Zones AoE de boss (télégraphes violet/rouge à esquiver) */}
          {activeBossAoes.map((aoe) => (
            <BossAoeZone key={aoe.id} aoe={aoe} playerPosition={playerPos}
              onDamage={handleNpcHitPlayer} onExpire={handleBossAoeExpire} />
          ))}

          {/* Mur du boss + surveillance des ennemis (donjon) */}
          {currentMap === "donjon_furiste" && (
            <MonsterGateWatcher key={`${currentMap}-${npcEpoch}`} bossIds={bossIdsRef}
              onAliveMobs={setAliveMobs} onCleared={handleGateCleared} />
          )}
          {currentMap === "donjon_furiste" && !gateOpen && mapAssembled && <MonsterGate />}
          {/* Coffre de fin de donjon : apparaît à la mort du boss, s'ouvre par proximité. */}
          {currentMap === "donjon_furiste" && run.state === "bossDown" && run.chestPos && (
            <DungeonChest position={run.chestPos} playerPosition={playerPos} onOpen={handleChestOpen} />
          )}
          {/* Chiffres de dégâts flottants (pool, drainé du bus damageEvents). */}
          <DamageNumbers />
          {/* Coffres de butin répartis sur la map (catalogue chestCatalog). */}
          {(MAP_CHESTS[currentMap] ?? []).map((def) => (
            <LootChest key={def.id} {...def} />
          ))}
          {/* Props (décors) placés via l'éditeur admin. */}
          <PropPlacer mapId={currentMap} adminState={propAdminState} />
          {/* Prévisualisation du générateur de carte (marqueurs, avant application). */}
          <MapGenPreview />

          {/* Flèches du joueur (archer) — projectiles droits + mutations, tick interne */}
          <ArrowRenderer />

          {/* Gizmos de transformation (PNJ / portail sélectionné via ✥ dans un éditeur) */}
          {npcAdminOpen && npcAdminCfg.selectedId && (() => {
            const sel = placedNpcs.find((n) => n.id === npcAdminCfg.selectedId);
            return sel ? (
              <TransformGizmo key={`npc-${sel.id}`} position={sel.pos} rotation={sel.rot ?? [0, 0, 0]}
                mode={npcAdminCfg.gizmoMode} color="#ff7a7a" onCommit={commitNpcTransform} />
            ) : null;
          })()}
          {donjonAdminOpen && portalCfg.selectedId && (() => {
            const sel = placedPortals.find((p) => p.id === portalCfg.selectedId);
            return sel ? (
              <TransformGizmo key={`portal-${sel.id}`} position={sel.pos} rotation={sel.rot ?? [0, 0, 0]}
                mode={portalCfg.gizmoMode} color="#c89aff" onCommit={commitPortalTransform} />
            ) : null;
          })()}

          {/* Marchands — montés après le reveal (anti-burst de clones, cf. extrasReady) */}
          {extrasReady && merchantPlacements.map((m) => (
            <CharacterErrorBoundary key={`${currentMap}-${m.def.id}`}>
              <MerchantNpc
                def={m.def}
                position={m.pos}
                playerPosition={playerPos}
                onProximity={handleMerchantProximity}
              />
            </CharacterErrorBoundary>
          ))}

          {/* PNJ Maître d'Armes (sélection de classe) — planètes uniquement */}
          {extrasReady && weaponMasterPos && (
            <CharacterErrorBoundary key={`${currentMap}-weaponmaster`}>
              <WeaponMasterNpc
                id="weapon_master"
                position={weaponMasterPos}
                playerPosition={playerPos}
                onProximity={handleWeaponMasterProximity}
              />
            </CharacterErrorBoundary>
          )}

          {/* VFX de sorts actifs */}
          {activeSpells.map((as) => (
            <SpellVFX key={as.id} active={as} onExpire={handleSpellExpire} onImpact={handleSpellImpact} />
          ))}
        </Suspense>
        {gameSettings.video.postProcessing && (
          <PostProcessingPipeline quality={gameSettings.video.quality} />
        )}
      </Canvas>
      </CanvasErrorBoundary>

      {/* ── HUD 2D ─────────────────────────────────────────────────────────── */}
      <GameHUD
        stats={effective}
        onStatsChange={handleStatsFromHud}
        inventory={inventory}
        zoneId={currentMap}
        onCastSpell={handleCastSpell}
        paused={uiOpen}
      />

      {/* Barre de vie cible ennemie (haut-centre) */}
      <TargetHealthBar />

      {/* Panneau de fouille de cadavre */}
      {lootTarget && (
        <LootPanel
          corpse={lootTarget.data}
          inventory={inventory}
          onInventoryChange={setInventory}
          onCreditsAdd={(n) => setInventory((inv) => addCredits(inv, n))}
          onClose={() => setLootTarget(null)}
        />
      )}

      {/* Barre consommables (slots 4/5/6) — assignables, touches Digit4/5/6 */}
      {!uiOpen && !isDead && <ConsumableBar inventory={inventory} onUseSlot={handleUseSlot} />}

      {/* Indicateurs buffs/debuffs joueur (sous la barre de vie, centre) */}
      {!isDead && <StatusEffectHud />}
      {!isDead && <StaminaBar />}
      <AnimDebugHud state={camState} />

      {/* Suivi des quêtes actives (haut-droite) — masqué quand un menu est ouvert */}
      {!uiOpen && !isDead && <QuestTracker />}

      {/* Boutons d'ouverture Journal / Talents (découvrabilité + accès souris) */}
      {!uiOpen && !isDead && (
        <div style={{ position: "fixed", top: 56, right: 14, zIndex: 41, display: "flex", gap: 6 }}>
          <button
            onClick={() => setTalentOpen(true)}
            style={hudPillBtn("#38bdf8")}
            title="Ouvrir l'arbre de talents (L)"
          >
            🌿 Talents <span style={{ opacity: 0.6, fontSize: 11 }}>L</span>
          </button>
          <button
            onClick={() => setQuestOpen(true)}
            style={hudPillBtn("#fbbf24")}
            title="Ouvrir le journal de quêtes (J)"
          >
            📜 Quêtes <span style={{ opacity: 0.6, fontSize: 11 }}>J</span>
          </button>
        </div>
      )}

      {/* Feed du monde vivant (événements de l'EventBus : batailles, factions…) */}
      <WorldFeed />

      {/* Factions IA évolutives — actives uniquement en orbital (là où la guerre produit des pertes) */}
      {isSpace && <FactionsAIRunner />}

      {/* Événements procéduraux du monde — actifs partout (le monde vit en permanence) */}
      <EventDirectorRunner />

      {/* Radar spatial — bas-gauche, en orbital uniquement (lecture worldEntities + joueur) */}
      {isSpace && <SpaceRadar playerPosition={playerPos} />}

      {invOpen  && <InventoryPanel inventory={inventory} onChange={setInventory} onClose={() => setInvOpen(false)} onUseItem={handleUseItem} />}
      {paused   && <PauseMenu onResume={() => setPaused(false)} onExit={() => { setPaused(false); onExit?.(); }} onVideoChange={onVideoChange} />}
      {charMenu && <CharacteristicsPanel stats={stats} effective={effective} onChange={setStats} onClose={() => setCharMenu(false)} />}
      {questOpen && <QuestJournal mapId={currentMap} onClose={() => setQuestOpen(false)} onAccept={(d) => { audioEvents.questAccepted(); pushToast(`Quête acceptée : ${d.title}`, "#5bd6ff"); }} />}
      {talentOpen && <TalentTreePanel stats={stats} onChange={setStats} onClose={() => setTalentOpen(false)} />}

      {/* Panneau Admin — F8 ou clic sur la pastille ⚙ ou window.NarvosAdmin.toggle() */}
      <AdminPanel
        open={adminOpen && edit}
        onClose={() => setAdminOpen(false)}
        onToggle={() => setAdminOpen((o) => !o)}
        currentMap={currentMap}
      />
      {/* Bascule du mode admin : commande de staff `/adminmode` dans le chat.
          L'ancien bouton cadenas a été retiré — en mode jeu, AUCUN élément
          d'administration ne doit être visible, pas même son interrupteur.
          Bandeau discret pour ne pas oublier qu'on est en édition. */}
      {edit && (
        <div
          style={{ position: "fixed", bottom: 14, left: "50%", transform: "translateX(-50%)",
            zIndex: 245, padding: "5px 14px", fontSize: 11, fontWeight: 900,
            fontFamily: "monospace", letterSpacing: "0.1em", pointerEvents: "none",
            background: "rgba(245,158,11,0.92)", color: "#1a1004",
            border: "1px solid #f59e0b", borderRadius: 8 }}>
          🛠️ MODE ADMIN — /adminmode pour quitter
        </div>
      )}

      {/* Pastille flottante ⚙ — uniquement en mode ÉDITION */}
      {edit && !adminOpen && <AdminFloatingButton onClick={() => setAdminOpen(true)} />}

      {/* Édition du POINT DE SPAWN (admin) : glisse le marqueur 🚩, persiste par map. */}
      {edit && (
        <div style={{ position: "fixed", top: 110, right: 14, zIndex: 240, display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
          <button onClick={() => setSpawnEdit((v) => !v)}
            style={{ padding: "6px 12px", fontSize: 11, fontWeight: 800, fontFamily: "monospace", cursor: "pointer",
              background: spawnEdit ? "#a3e635" : "rgba(10,20,5,0.85)", color: spawnEdit ? "#0a1405" : "#a3e635",
              border: "1px solid #a3e63577", borderRadius: 8 }}>
            🚩 Spawn {spawnEdit ? "ON" : "OFF"}
          </button>
          <button onClick={() => setBoundsEdit((v) => !v)}
            style={{ padding: "6px 12px", fontSize: 11, fontWeight: 800, fontFamily: "monospace", cursor: "pointer",
              background: boundsEdit ? "#7dd3fc" : "rgba(6,16,26,0.85)", color: boundsEdit ? "#04121f" : "#7dd3fc",
              border: "1px solid #7dd3fc77", borderRadius: 8 }}>
            ⬛ Limites {boundsEdit ? "ON" : "OFF"}
          </button>
          {spawnEdit && (
            <button onClick={() => { spawnPointStore.clear(currentMap); setSpawnEdit(false); setTimeout(() => setSpawnEdit(true), 0); }}
              style={{ padding: "4px 10px", fontSize: 10, fontFamily: "monospace", cursor: "pointer",
                background: "transparent", color: "#ff8a8a", border: "1px solid #ff8a8a55", borderRadius: 6 }}>
              ↺ Réinitialiser ({currentMap})
            </button>
          )}
        </div>
      )}

      {/* Admin : murs invisibles / limites de map (ajout, déplacement, ajustement) */}
      {edit && boundsEdit && (
        <MapBoundsPanel
          mapId={currentMap}
          playerPos={playerPos}
          selectedId={boundsSel}
          onSelect={setBoundsSel}
          onClose={() => setBoundsEdit(false)}
        />
      )}

      {/* Admin : « Appliquer & recharger » — re-précharge tous les assets éditables après modifs */}
      <AssetReloadButton mapId={currentMap} />

      {/* Générateur de carte (F6 admin) : seed → aperçu → validation → application */}
      <MapGenPanel open={mapGen.open} onClose={() => mapGenStore.set({ open: false })} currentMap={currentMap} />

      {/* Diagnostics streaming chunks/textures (F3) */}
      {streamHudOpen && <StreamingDebugHud onOpenTerrain={() => setTerrainPanelOpen(true)} />}

      {/* Éditeur de matière du terrain — ouvert depuis le HUD F3, PAS par une
          touche : F6 et F7 sont déjà pris (générateur de carte, stress-test), et
          les handlers ajoutés après eux étaient du code mort. */}
      {terrainPanelOpen && edit && (
        <TerrainMaterialPanel onClose={() => setTerrainPanelOpen(false)} />
      )}

      {/* Stress-test (F7 admin) : overlay perfs + panneau de contrôle des bots */}
      {stressOpen && <PerfHud />}
      <StressTestPanel open={stressOpen && edit} onClose={() => setStressOpen(false)} />
      <AmmoHud />{/* munitions archer / guerrier spatial */}
      <TimeHud />
      <WeatherHud />
      {/* Minimap (M) — ennemis/récolte/portails, canvas 2D zéro coût GPU. */}
      {minimapOn && !uiOpen && !isDead && (
        <MinimapHud playerPosition={playerPos} cameraState={camState} mapId={currentMap} />
      )}
      {/* Butin NON SÉCURISÉ (hors du hub) — la tension d'expédition rendue visible. */}
      {currentMap !== "orbital" && !isDead && (() => {
        const u = expeditionLedger.unsecured(inventory.items, inventory.credits);
        if (u.items === 0 && u.credits === 0) return null;
        return (
          <div style={{
            position: "fixed", bottom: 130, right: 18, zIndex: 60, font: "12px monospace",
            background: "rgba(30,16,4,0.85)", color: "#ffb547", padding: "6px 12px",
            borderRadius: 8, border: "1px solid #ffb54766", pointerEvents: "none",
          }}>
            ⚠ Non sécurisé : {u.items} objet(s) · {u.credits} cr
          </div>
        );
      })()}

      {/* Éditeur PNJ — F9 ou pastille ⚙ rouge */}
      <NpcAdminPanel open={npcAdminOpen && edit} onClose={() => setNpcAdminOpen(false)} currentMap={currentMap} />
      {!npcAdminOpen && <NpcAdminFloatingButton onClick={() => setNpcAdminOpen(true)} />}

      {/* Éditeur Portails Donjon — F10 ou pastille ⚙ violette */}
      <DonjonAdminPanel open={donjonAdminOpen && edit} onClose={() => setDonjonAdminOpen(false)} currentMap={currentMap} />
      {!donjonAdminOpen && <DonjonAdminFloatingButton onClick={() => setDonjonAdminOpen(true)} />}

      {/* Mutations de flèche (archer) — pastille 🏹 verte */}
      <ArrowMutationAdmin open={arrowMutOpen} onClose={() => setArrowMutOpen(false)} />
      {!arrowMutOpen && <ArrowMutationButton onClick={() => setArrowMutOpen(true)} />}

      {/* Couleur par partie du corps — pastille 🎨 rose */}
      <BodyTintAdmin open={bodyTintOpen} onClose={() => setBodyTintOpen(false)} />
      {!bodyTintOpen && <BodyTintButton onClick={() => setBodyTintOpen(true)} />}

      {/* Éditeur Nœuds de récolte — F11 ou pastille 🌱 verte */}
      <HarvestNodeAdminPanel open={harvestAdminOpen && edit} onClose={() => setHarvestAdminOpen(false)} currentMap={currentMap} />
      {!harvestAdminOpen && <HarvestNodeAdminFloatingButton onClick={() => setHarvestAdminOpen(true)} />}

      {/* Éditeur Props (décors) — pastille ⬡ cyan */}
      <PropAdminPanel open={propAdminOpen && edit} onClose={() => setPropAdminOpen(false)} currentMap={currentMap}
        adminState={propAdminState} onAdminStateChange={updatePropAdminState} />
      {!propAdminOpen && <PropAdminFloatingButton onClick={() => setPropAdminOpen(true)} />}

      {/* ── Métiers : panneau HUD + pastille flottante 🪓 ───────────────────── */}
      <ProfessionPanel open={professionPanelOpen} onClose={() => setProfessionPanelOpen(false)}
        onCraft={(p) => { setProfessionPanelOpen(false); setCraftOpen(p); }} />
      {!uiOpen && !isDead && <ProfessionFloatingButton open={professionPanelOpen} onClick={() => setProfessionPanelOpen((o) => !o)} />}

      {/* Atelier d'artisanat (Forgeron / Alchimiste / Joaillier) + mini-jeu de forge */}
      {craftOpen && <CraftingPanel profession={craftOpen} pushToast={pushToast} onCrafted={handleCraftOutput} onClose={() => setCraftOpen(null)} />}

      {/* ── Archétypes (classes joueur) : Maître d'Armes + pastille ⚔️ ──────── */}
      <ArchetypePanel open={archetypeOpen} onClose={() => setArchetypeOpen(false)} />
      {!uiOpen && !isDead && <ArchetypeFloatingButton open={archetypeOpen} onClick={() => setArchetypeOpen((o) => !o)} />}
      {/* HUD sorts d'archétype + cooldown radial des ultimes (C/V/B) */}
      {!uiOpen && !isDead && <ArchetypeCooldownHud />}
      {/* Compteur de combo (killstreak) — accompagne les annonces audio */}
      {!isDead && <KillStreakHud />}

      {/* Jauge de TIR CHARGÉ (Archer) — visible pendant le maintien de la touche */}
      {chargeProgress !== null && !isDead && (
        <div style={{
          position: "fixed", left: "50%", bottom: 196, transform: "translateX(-50%)",
          zIndex: 42, pointerEvents: "none", width: 220,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
        }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#ffe0a8", textShadow: "0 1px 3px #000" }}>
            Tir Chargé ×{(1 + 2 * chargeProgress).toFixed(1)}
          </div>
          <div style={{
            width: "100%", height: 12, borderRadius: 6, overflow: "hidden",
            background: "rgba(0,0,0,0.6)", border: "1px solid #ffffff33",
          }}>
            <div style={{
              width: `${chargeProgress * 100}%`, height: "100%",
              background: chargeProgress >= 0.99
                ? "linear-gradient(90deg,#ff5a3c,#ffd24d)"
                : "linear-gradient(90deg,#5cb85c,#ffd24d)",
              transition: "width 0.05s linear",
            }} />
          </div>
        </div>
      )}

      {/* ── Réglage d'arme (admin) : aligne le modèle FBX en main, live + persisté ── */}
      <WeaponOffsetAdmin open={weaponAdminOpen && edit} onClose={() => setWeaponAdminOpen(false)} />
      {!weaponAdminOpen && <WeaponOffsetAdminButton onClick={() => setWeaponAdminOpen(true)} />}
      <CharacterOffsetAdmin open={charOffsetOpen && edit} onClose={() => setCharOffsetOpen(false)} />
      {!charOffsetOpen && <CharacterOffsetAdminButton onClick={() => setCharOffsetOpen(true)} />}
      <RecoilAdminPanel open={recoilAdminOpen && edit} onClose={() => setRecoilAdminOpen(false)} />
      {!recoilAdminOpen && <RecoilAdminButton onClick={() => setRecoilAdminOpen(true)} />}

      {/* Mini-jeu de récolte (timing) — possède les entrées E/Espace/clic/Échap */}
      {gatherNodeId && gatherDef && (
        <GatherMiniGame
          verb={gatherDef.gatherVerb}
          color={gatherDef.color}
          onStrike={handleGatherStrike}
          onCancel={handleGatherCancel}
        />
      )}

      {/* Invite de proximité d'un nœud de récolte */}
      {nearHarvest && !uiOpen && !isDead && (() => {
        const prof = harvestRegistry.get(nearHarvest)?.profession;
        const def = prof ? getProfession(prof) : null;
        return (
          <div style={{ position: "fixed", bottom: 120, left: "50%", transform: "translateX(-50%)", zIndex: 180,
            background: "rgba(10,16,10,0.85)", border: "1px solid #5cb85c66", borderRadius: 8, padding: "8px 16px",
            color: "#d8f0d8", fontFamily: "monospace", fontSize: 13, fontWeight: 700, pointerEvents: "none" }}>
            E — {def ? `${def.gatherVerb} (${def.label})` : "Récolter"}
          </div>
        );
      })()}

      {/* Salle du boss scellée (donjon) — compteur d'ennemis restants */}
      {currentMap === "donjon_furiste" && !gateOpen && !uiOpen && !isDead && (
        <div style={{ position: "fixed", top: 70, left: "50%", transform: "translateX(-50%)", zIndex: 180,
          background: "rgba(20,8,30,0.85)", border: "1px solid #c040ff66", borderRadius: 8, padding: "7px 16px",
          color: "#e8c8ff", fontFamily: "monospace", fontSize: 13, fontWeight: 700, pointerEvents: "none" }}>
          🟣 Salle du boss scellée — Ennemis restants : {aliveMobs}
        </div>
      )}

      {/* Invite de proximité d'un portail */}
      {nearPortal && !uiOpen && !isDead && (
        <div style={{ position: "fixed", bottom: 120, left: "50%", transform: "translateX(-50%)", zIndex: 180,
          background: "rgba(10,8,18,0.85)", border: "1px solid #36e0ff66", borderRadius: 8, padding: "8px 16px",
          color: "#cdeeff", fontFamily: "monospace", fontSize: 13, fontWeight: 700, pointerEvents: "none" }}>
          {(() => {
            if (nearPortal === "__return__") return "E — Sortir du donjon";
            const p = placedPortals.find((pp) => pp.id === nearPortal);
            if (!p) return "E — Entrer";
            const open = portalCfg.adminUnlock || (p.unlockQuest !== "" &&
              (p.lockMode === "completed" ? questStore.isCompleted(p.unlockQuest) : questStore.isActive(p.unlockQuest)));
            return open ? `E — Entrer : ${MAPS[p.target]?.label ?? p.target}` : "🔒 Verrouillé — quête requise";
          })()}
        </div>
      )}

      {/* ── ÉCRAN DE MORT (overlay plein écran, bloque tous les inputs) ─── */}
      {isDead && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "radial-gradient(circle at center, rgba(60,0,0,0.78) 0%, rgba(0,0,0,0.94) 70%)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 28, backdropFilter: "blur(4px)",
          animation: "fadeIn 0.6s ease-out",
        }}>
          <div style={{
            fontSize: 72, fontWeight: 900, letterSpacing: "0.3em",
            color: "#ff4444", textTransform: "uppercase",
            textShadow: "0 0 40px rgba(255,40,40,0.6), 0 0 80px rgba(255,40,40,0.3)",
            fontFamily: "monospace",
          }}>
            {hardcoreDead ? "Mort définitive" : "Vous êtes tombé"}
          </div>
          <div style={{ color: "#fca5a5", fontSize: 16, letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 700, textAlign: "center", lineHeight: 1.8 }}>
            {hardcoreDead
              ? <>{characterName ?? "Votre héros"} est tombé au niveau {statsRef.current.level},
                  tué par {lastAttackerRef.current}.<br />Son nom rejoint le Tableau des Morts.</>
              : "Le souffle vous quitte… mais l'histoire n'est pas terminée."}
          </div>
          <button
            onClick={hardcoreDead ? () => onExit?.() : handleRespawn}
            style={{
              marginTop: 24,
              padding: "16px 42px",
              fontSize: 18, fontWeight: 900, letterSpacing: "0.25em",
              textTransform: "uppercase",
              background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
              color: "#fff", border: "2px solid #fca5a5",
              borderRadius: 10, cursor: "pointer",
              boxShadow: "0 0 30px rgba(239,68,68,0.5)",
              transition: "transform 120ms ease, box-shadow 120ms ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.04)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
          >
            {hardcoreDead ? "Retour à la sélection" : "Réapparaître"}
          </button>
          <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 12, fontFamily: "monospace" }}>
            50 % PV · 30 % Mana · Téléportation au point d'entrée
          </div>
        </div>
      )}

      {/* Invite de proximité : parler à un marchand */}
      {nearMerchant && !openMerchant && !pilotedShipId && (() => {
        const m = getMerchant(nearMerchant);
        return m ? (
          <div style={{
            position: "fixed", left: "50%", bottom: 130, transform: "translateX(-50%)",
            zIndex: 42, pointerEvents: "none",
            background: "rgba(7,6,3,0.85)", border: "1px solid #fbbf2466",
            borderRadius: 10, padding: "8px 16px",
            color: "#fde9c8", fontWeight: 700, fontSize: 13,
          }}>
            Appuyez sur <kbd style={{ color: "#fbbf24", fontWeight: 900 }}>E</kbd> pour parler à {m.name}
          </div>
        ) : null;
      })()}

      {/* Invite de réparation : garagiste + véhicule endommagé */}
      {showRepairPrompt && pilotedShipId && shipTelemetry.hpRatio < 1 && shipTelemetry.hasHp && (() => {
        const hasKit = inventory.items.some((i) => i.id === "repair_kit");
        return (
          <div style={{
            position: "fixed", left: "50%", bottom: 165, transform: "translateX(-50%)",
            zIndex: 42,
            background: "rgba(3,8,14,0.92)", border: "1px solid #86efac88",
            borderRadius: 12, padding: "10px 20px",
            color: "#bbf7d0", fontWeight: 700, fontSize: 13,
            display: "flex", alignItems: "center", gap: 10,
            boxShadow: "0 0 20px rgba(134,239,172,0.15)",
          }}>
            <span style={{ fontSize: 18 }}>🛠️</span>
            <kbd style={{
              color: "#86efac", fontWeight: 900,
              background: "rgba(134,239,172,0.15)", padding: "2px 8px", borderRadius: 5,
              border: "1px solid #86efac77",
            }}>R</kbd>
            <span>Réparer le véhicule</span>
            {hasKit ? (
              <span style={{ color: "#86efac", fontSize: 11, background: "rgba(134,239,172,0.1)", padding: "2px 8px", borderRadius: 4 }}>
                🔧 kit disponible
              </span>
            ) : (
              <span style={{ color: "#fbbf24", fontSize: 11, background: "rgba(251,191,36,0.1)", padding: "2px 8px", borderRadius: 4 }}>
                kit requis — achetez-en ici
              </span>
            )}
          </div>
        );
      })()}

      {/* Invite de proximité : Maître d'Armes (sélection de classe) */}
      {nearWeaponMaster && !uiOpen && !pilotedShipId && (
        <div style={{
          position: "fixed", left: "50%", bottom: 130, transform: "translateX(-50%)",
          zIndex: 42, pointerEvents: "none",
          background: "rgba(14,7,3,0.85)", border: "1px solid #ff7a3c66",
          borderRadius: 10, padding: "8px 16px",
          color: "#ffe0cc", fontWeight: 700, fontSize: 13,
        }}>
          Appuyez sur <kbd style={{ color: "#ff7a3c", fontWeight: 900 }}>E</kbd> pour choisir ta classe ⚔️
        </div>
      )}

      {/* Invite de proximité : fouiller un cadavre */}
      {nearLootLabel && !lootTarget && !uiOpen && !pilotedShipId && (
        <div style={{
          position: "fixed", left: "50%", bottom: 130, transform: "translateX(-50%)",
          zIndex: 42, pointerEvents: "none",
          background: "rgba(6,10,18,0.88)", border: "1px solid #a855f766",
          borderRadius: 10, padding: "10px 20px",
          color: "#e0d0ff", fontWeight: 700, fontSize: 13,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          Appuyez sur
          <kbd style={{
            color: "#c084fc", fontWeight: 900,
            background: "rgba(168,85,247,0.12)",
            padding: "1px 7px", borderRadius: 5,
            border: "1px solid #a855f755",
          }}>E</kbd>
          pour fouiller {nearLootLabel}
        </div>
      )}

      {/* Invite de proximité : ouvrir un coffre */}
      {nearChestLabel && !nearLootLabel && !lootTarget && !uiOpen && !pilotedShipId && (
        <div style={{
          position: "fixed", left: "50%", bottom: 130, transform: "translateX(-50%)",
          zIndex: 42, pointerEvents: "none",
          background: "rgba(6,10,18,0.88)", border: "1px solid #38bdf866",
          borderRadius: 10, padding: "10px 20px",
          color: "#bae6fd", fontWeight: 700, fontSize: 13,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          Appuyez sur
          <kbd style={{
            color: "#38bdf8", fontWeight: 900,
            background: "rgba(56,189,248,0.12)",
            padding: "1px 7px", borderRadius: 5,
            border: "1px solid #38bdf855",
          }}>E</kbd>
          pour fouiller {nearChestLabel}
        </div>
      )}

      {/* Invite de proximité : embarquer dans un vaisseau */}
      {nearShipId && !pilotedShipId && !openMerchant && (
        <div style={{
          position: "fixed", left: "50%", bottom: 130, transform: "translateX(-50%)",
          zIndex: 42, pointerEvents: "none",
          background: "rgba(2,8,20,0.88)", border: "1px solid #5b9bff66",
          borderRadius: 10, padding: "10px 20px",
          color: "#c0ddff", fontWeight: 700, fontSize: 13,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          Appuyez sur
          <kbd style={{
            color: "#5bd6ff", fontWeight: 900,
            background: "rgba(91,214,255,0.12)",
            padding: "1px 7px", borderRadius: 5,
            border: "1px solid #5bd6ff55",
          }}>E</kbd>
          pour piloter le vaisseau
        </div>
      )}

      {/* HUD pilotage (vitesse, altitude, statut atmosphérique) */}
      {!!pilotedShipId && (
        <div style={{
          position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)",
          zIndex: 42, pointerEvents: "none",
          background: "rgba(2,8,20,0.82)", border: "1px solid #5bd6ff33",
          borderRadius: 10, padding: "10px 28px",
          color: "#c0e8ff", fontFamily: "monospace", fontSize: 12,
          display: "flex", gap: 28, alignItems: "center",
          boxShadow: "0 0 20px rgba(91,214,255,0.12)",
        }}>
          <span style={{ color: shipTelemetry.inSpace ? "#5bd6ff" : "#88c8ff", fontWeight: 700 }}>
            {shipTelemetry.inSpace ? "ESPACE" : "ATMOSPHÈRE"}
          </span>
          <span>Vitesse <strong style={{ color: "#e0f0ff" }}>{shipTelemetry.speed} m/s</strong></span>
          <span>Altitude <strong style={{ color: "#e0f0ff" }}>{shipTelemetry.altitude} m</strong></span>
          {/* Barre PV véhicule — visible uniquement pour véhicules destructibles (clés invoquées) */}
          {shipTelemetry.hasHp && (
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: "#94a3b8" }}>PV</span>
              <span style={{
                width: 80, height: 6, borderRadius: 3,
                background: "rgba(91, 214, 255, 0.15)",
                border: "1px solid rgba(91, 214, 255, 0.35)",
                overflow: "hidden",
              }}>
                <span style={{
                  display: "block",
                  width: `${Math.round(shipTelemetry.hpRatio * 100)}%`,
                  height: "100%",
                  background: shipTelemetry.hpRatio > 0.5 ? "#a3e635"
                    : shipTelemetry.hpRatio > 0.25 ? "#fbbf24" : "#ef4444",
                  transition: "width 200ms ease, background 200ms ease",
                }} />
              </span>
              <strong style={{ color: shipTelemetry.hpRatio > 0.25 ? "#e0f0ff" : "#ef4444" }}>
                {Math.round(shipTelemetry.hpRatio * 100)}%
              </strong>
            </span>
          )}
          {/* Indicateur STAB (vert pulsant) si stabilisation active */}
          {shipTelemetry.stabilized && (
            <span style={{
              color: "#0a0a0a",
              background: "#a3e635",
              padding: "2px 8px",
              borderRadius: 4,
              fontWeight: 900,
              letterSpacing: "0.18em",
              fontSize: 11,
              animation: "stabPulse 1.4s ease-in-out infinite",
            }}>
              ⚓ STAB
            </span>
          )}
          {shipTelemetry.canExit ? (
            <span style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-end" }}>
              {shipTelemetry.nearGround ? (
                <span style={{ color: "#a3e635", fontWeight: 700 }}>
                  E — Atterrir (laisser sur place)
                </span>
              ) : (
                <span style={{ color: "#fbbf24", fontWeight: 700 }}>
                  E — Sauter (chute libre)
                </span>
              )}
              {summonedVehicleId && (
                <span style={{ color: "#5bd6ff", fontSize: 10, opacity: 0.85 }}>
                  Shift+E — Ramasser la clé
                </span>
              )}
            </span>
          ) : (
            <span style={{ color: "#94a3b8" }}>
              H stabiliser · Ralentir pour pouvoir sortir
            </span>
          )}
        </div>
      )}

      {/* Marchand : panneau d'achat/vente */}
      {openMerchant && getMerchant(openMerchant) && (
        <MerchantPanel
          merchant={getMerchant(openMerchant)!}
          inventory={inventory}
          onChange={setInventory}
          onClose={() => setOpenMerchant(null)}
        />
      )}

      {/* Univers vivant : moniteur galactique (touche N) — factions, territoires, économie, dépêches. */}
      {galaxyOpen && !isDead && <WorldStatePanel onClose={() => setGalaxyOpen(false)} />}

      {/* Indicateur NOCLIP — composant isolé (store noclipUi), ne re-render que lui-même */}
      <NoclipIndicator />

      {/* Chat in-game (global, commandes admin) — fixé en bas à gauche */}
      {!isDead && <ChatPanel playerName={characterName ?? "Joueur"} />}

      {/* Carte du monde plein écran (touche U) */}
      {worldMapOpen && (
        <WorldMapOverlay
          currentMap={currentMap}
          playerPosition={{ x: playerPos.current.x, z: playerPos.current.z }}
          onClose={() => setWorldMapOpen(false)}
          onTeleport={(mapId) => {
            setWorldMapOpen(false);
            if (mapId !== currentMap) travelTo(mapId as keyof typeof MAPS);
          }}
        />
      )}

      {/* Menu d'émotes (touche G) */}
      {emoteMenuOpen && <EmoteMenu onClose={() => setEmoteMenuOpen(false)} />}

      {/* Panneau de réputation (touche K) */}
      {repPanelOpen && <ReputationPanel onClose={() => setRepPanelOpen(false)} />}
      {petPanelOpen && <PetPanel onClose={() => setPetPanelOpen(false)} />}

      {/* Toasts XP / niveau / butin */}
      <div style={{
        position: "fixed", right: 20, bottom: 96,
        display: "flex", flexDirection: "column", gap: 6,
        alignItems: "flex-end", pointerEvents: "none", zIndex: 40,
      }}>
        {toasts.map((t) => (
          <div key={t.id} style={{
            background: "rgba(5,7,12,0.82)",
            border: `1px solid ${t.color}`,
            color: t.color,
            padding: "6px 12px",
            borderRadius: 8,
            fontWeight: 800,
            fontSize: 13,
            letterSpacing: "0.04em",
            textShadow: "0 1px 2px #000",
            boxShadow: `0 0 14px ${t.color}55`,
          }}>
            {t.text}
          </div>
        ))}
      </div>

      {/* Vignette rouge aux dégâts */}
      {dmgFlash > 0 && (
        <div key={`dmg-${dmgFlash}`} style={{
          position: "fixed", inset: 0, pointerEvents: "none", zIndex: 45,
          boxShadow: "inset 0 0 140px 45px rgba(220,30,30,0.55)",
          animation: "narvosDmgFlash 0.5s ease-out forwards",
        }} />
      )}
      {/* Vignette orange à la limite spatiale */}
      {boundaryHit > 0 && (
        <div key={`boundary-${boundaryHit}`} style={{
          position: "fixed", inset: 0, pointerEvents: "none", zIndex: 45,
          boxShadow: "inset 0 0 160px 60px rgba(255,128,40,0.60)",
          animation: "narvosDmgFlash 0.7s ease-out forwards",
        }} />
      )}
      {/* Flash doré au level-up */}
      {lvlFlash > 0 && (
        <div key={`lvl-${lvlFlash}`} style={{
          position: "fixed", inset: 0, pointerEvents: "none", zIndex: 45,
          background: "radial-gradient(ellipse at center, rgba(245,200,80,0.35), transparent 62%)",
          animation: "narvosLvlFlash 0.9s ease-out forwards",
        }} />
      )}
      <style>{`
        @keyframes narvosDmgFlash { 0% { opacity: 1; } 100% { opacity: 0; } }
        @keyframes narvosLvlFlash { 0% { opacity: 0; } 30% { opacity: 1; } 100% { opacity: 0; } }
      `}</style>

      {/* Transition de voyage spatial (warp) */}
      {warp.active && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 60, pointerEvents: "none",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: `radial-gradient(ellipse at center, ${warp.color}22 0%, #02030a 70%)`,
          animation: "narvosWarpFade 0.4s ease-out",
        }}>
          <div style={{
            position: "absolute", inset: 0,
            background: `repeating-radial-gradient(circle at 50% 50%, transparent 0, transparent 6px, ${warp.color}18 7px, transparent 8px)`,
            animation: "narvosWarpZoom 1.6s linear infinite",
            opacity: 0.5,
          }} />
          <div style={{ position: "relative", textAlign: "center" }}>
            <div style={{
              width: 64, height: 64, margin: "0 auto 18px",
              border: `3px solid ${warp.color}`, borderTopColor: "transparent",
              borderRadius: "50%", animation: "narvosWarpSpin 0.9s linear infinite",
              boxShadow: `0 0 24px ${warp.color}`,
            }} />
            <div style={{
              color: warp.color, fontWeight: 900, letterSpacing: "0.3em",
              textTransform: "uppercase", fontSize: 15,
              textShadow: `0 0 12px ${warp.color}`,
            }}>
              {warp.label}
            </div>
          </div>
          <style>{`
            @keyframes narvosWarpSpin { to { transform: rotate(360deg); } }
            @keyframes narvosWarpZoom { from { transform: scale(0.6); opacity: 0.5; } to { transform: scale(2.2); opacity: 0; } }
            @keyframes narvosWarpFade { from { opacity: 0; } to { opacity: 1; } }
          `}</style>
        </div>
      )}
    </div>
  );
}

// Style d'un bouton-pilule du HUD (Quêtes / Talents) — couleur d'accent param.
function hudPillBtn(color: string): React.CSSProperties {
  return {
    padding: "5px 11px", borderRadius: 8, cursor: "pointer",
    border: `1px solid ${color}55`, background: "rgba(8,12,20,0.8)",
    color, fontWeight: 800, fontSize: 12,
    display: "flex", alignItems: "center", gap: 6,
  };
}

// Préchargement des assets fréquents (cache drei partagé).
// forge = 8 chunks séquentiels, orbital/tower = monolithiques GLTF — chargés par
// PuzzleMap ou MapModel respectivement. Ne pas précharger ici.
useGLTF.preload(SHIP_FORGE);
useGLTF.preload(SHIP_TOWER);
