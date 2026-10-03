/**
 * WasmWorldTicker — composant R3F monté dans le Canvas de RpgGameWorld.
 *
 * Chaque frame :
 *   1. Sync position joueur → WASM
 *   2. coordinator.tick(dt) → AI + StatusEffects + Health + DeathCleanup
 *   3. Drain damage events WASM → bus JS
 *   4. Lire commandes AI → dispatcher vers NPCs via wasmNpcBridge
 *   5. Sync status effects WASM → JS
 *
 * Ce composant ne rend rien (null). Il est le seul point d'entrée
 * du WASM dans le render loop R3F.
 */
import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { isEngineLoaded } from './WasmBridge';
import { wasmWorldCoordinator } from './WasmWorldCoordinator';
import { wasmNpcBridge } from './WasmNpcBridge';
import { playerPositionStore } from './playerPositionStore';
import { initDamageBuffers, freeDamageBuffers, drainWasmDamageEvents } from './DamageEventSync';
import { initAIBuffers, freeAIBuffers, readAICommands } from './AICommandSync';
import { pullEffectsFromWasm } from './StatusEffectSync';
import { collisionWorld } from '../runtime/CollisionWorld';
import {
  initAssetBudget, tickAssetBudget, drainAssetCommands,
  clearAssetBudget, AssetCommandType,
} from './AssetBudgetBridge';
import { bakeNavMeshFromScene, clearBakedNavMesh } from './NavMeshBaker';
import { freeNavBuffers } from './NavMeshBridge';

const ASSET_BUDGET_MB = 512;
const ASSET_LOAD_RADIUS = 200;
const ASSET_UNLOAD_RADIUS = 350;

interface WasmWorldTickerProps {
  enabled?: boolean;
  onAssetCommand?: (type: AssetCommandType, assetId: number, tier: number) => void;
}

export function WasmWorldTicker({ enabled = true, onAssetCommand }: WasmWorldTickerProps) {
  const initializedRef = useRef(false);
  const onAssetCmdRef = useRef(onAssetCommand);
  onAssetCmdRef.current = onAssetCommand;

  useEffect(() => {
    if (!enabled || !isEngineLoaded()) return;

    wasmWorldCoordinator.init();
    collisionWorld.enableWasm();
    initDamageBuffers();
    initAIBuffers();
    initAssetBudget(ASSET_BUDGET_MB);

    const pp = playerPositionStore.getPosition();
    wasmNpcBridge.registerPlayer(pp.x, pp.y, pp.z);

    initializedRef.current = true;

    // Fire-and-forget : le bake est asynchrone et NE DOIT PAS retarder
    // l'affichage. Les PNJ retombent sur leur IA directe tant qu'il n'est pas prêt.
    void bakeNavMeshFromScene();

    return () => {
      clearBakedNavMesh();
      freeNavBuffers();
      collisionWorld.disableWasm();
      freeDamageBuffers();
      freeAIBuffers();
      clearAssetBudget();
      wasmNpcBridge.clear();
      wasmWorldCoordinator.reset();
      initializedRef.current = false;
    };
  }, [enabled]);

  useFrame((_, dt) => {
    if (!enabled || !initializedRef.current) return;

    const pp = playerPositionStore.getPosition();
    wasmNpcBridge.syncPlayerPosition(pp.x, pp.y, pp.z);

    wasmWorldCoordinator.tick(dt);

    drainWasmDamageEvents();

    const commands = readAICommands();
    if (commands.length > 0) {
      wasmNpcBridge.dispatchCommands(commands);
    }

    pullEffectsFromWasm(wasmNpcBridge.getEntityMap());

    tickAssetBudget(pp.x, pp.y, pp.z, ASSET_LOAD_RADIUS, ASSET_UNLOAD_RADIUS);
    const assetCmds = drainAssetCommands();
    if (assetCmds.length > 0 && onAssetCmdRef.current) {
      for (const cmd of assetCmds) onAssetCmdRef.current(cmd.type, cmd.assetId, cmd.tier);
    }
  });

  return null;
}
