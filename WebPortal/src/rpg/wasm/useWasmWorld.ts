/**
 * useWasmWorld — hook R3F qui tick le monde WASM chaque frame.
 *
 * Orchestrateur central : AI → StatusEffects → Damage drain → sync JS.
 * Monte un seul useFrame qui fait tourner tous les systèmes C++.
 *
 * Usage dans RpgGameWorld :
 *   <WasmWorldTicker entityMap={entityMap} />
 *
 * L'animation (bone matrices) est gérée séparément par useWasmAnimation
 * pour chaque SkinnedMesh individuellement.
 */
import { useRef, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { getEngine, isEngineLoaded } from './WasmBridge';
import { initDamageBuffers, freeDamageBuffers, drainWasmDamageEvents } from './DamageEventSync';
import { initAIBuffers, freeAIBuffers, readAICommands } from './AICommandSync';
import { pullEffectsFromWasm } from './StatusEffectSync';
import type { EntityNpcMap } from './StatusEffectSync';
import type { AICommand } from './AICommandSync';

export interface WasmWorldConfig {
  entityMap: EntityNpcMap;
  onAICommands?: (commands: AICommand[]) => void;
  enabled?: boolean;
}

export function useWasmWorld(config: WasmWorldConfig): void {
  const { entityMap, onAICommands, enabled = true } = config;
  const initializedRef = useRef(false);
  const entityMapRef = useRef(entityMap);
  const onAICommandsRef = useRef(onAICommands);
  entityMapRef.current = entityMap;
  onAICommandsRef.current = onAICommands;

  useEffect(() => {
    if (!enabled || !isEngineLoaded()) return;

    initDamageBuffers();
    initAIBuffers();
    initializedRef.current = true;

    return () => {
      freeDamageBuffers();
      freeAIBuffers();
      initializedRef.current = false;
    };
  }, [enabled]);

  useFrame((_, dt) => {
    if (!enabled || !initializedRef.current) return;

    const engine = getEngine();
    if (!engine) return;

    const clampedDt = Math.min(dt, 0.05);

    engine.tickWorld(clampedDt);

    drainWasmDamageEvents();

    if (onAICommandsRef.current) {
      const commands = readAICommands();
      if (commands.length > 0) onAICommandsRef.current(commands);
    }

    pullEffectsFromWasm(entityMapRef.current);
  });
}

/**
 * Hook pour piloter un AnimationGraph WASM sur un SkinnedMesh.
 * Chaque mesh animé par WASM a son propre useWasmAnimation.
 */
import * as THREE from 'three';
import {
  uploadSkeleton,
  uploadClip,
  createAnimGraph,
  updateAndApplyBones,
  destroyAnimGraph,
  type WasmSkeletonHandle,
} from './AnimationBridge';

export interface WasmAnimationConfig {
  mesh: THREE.SkinnedMesh | null;
  clips: THREE.AnimationClip[];
  setupGraph?: (graphId: number) => void;
  enabled?: boolean;
}

export function useWasmAnimation(config: WasmAnimationConfig): void {
  const { mesh, clips, setupGraph, enabled = true } = config;
  const handleRef = useRef<WasmSkeletonHandle | null>(null);
  const setupDone = useRef(false);
  const meshRef = useRef(mesh);
  meshRef.current = mesh;

  useEffect(() => {
    if (!enabled || !mesh || !isEngineLoaded() || clips.length === 0) return;

    const skelId = uploadSkeleton(mesh);
    if (skelId < 0) return;

    for (const clip of clips) uploadClip(skelId, clip);

    const handle = createAnimGraph(skelId);
    if (!handle) return;

    if (setupGraph) setupGraph(handle.graphId);

    handleRef.current = handle;
    setupDone.current = true;

    return () => {
      if (handleRef.current) {
        destroyAnimGraph(handleRef.current);
        handleRef.current = null;
      }
      setupDone.current = false;
    };
  }, [mesh, clips, enabled, setupGraph]);

  useFrame((_, dt) => {
    if (!enabled || !setupDone.current || !handleRef.current || !meshRef.current) return;
    updateAndApplyBones(handleRef.current, Math.min(dt, 0.05), meshRef.current.skeleton);
  });
}
