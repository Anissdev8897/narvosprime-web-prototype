/**
 * useWasmNpcAI — hook per-NPC qui lit la commande IA WASM
 * et la convertit en NpcFrameResult (drop-in pour NpcController.update).
 *
 * Usage dans Npc.tsx :
 *   const wasmResult = useWasmNpcAI(id);
 *   // si wasmResult != null, utiliser à la place de ctrl.update()
 */
import { useRef, useEffect, useCallback } from 'react';
import { wasmNpcBridge } from './WasmNpcBridge';
import { AIAction } from './AICommandSync';
import type { AICommand } from './AICommandSync';
import type { NpcFrameResult } from '../npc/NpcController';
import type { ActionId } from '../types';

interface UseWasmNpcAIOptions {
  id: string;
  x: number;
  y: number;
  z: number;
  role: 'ally' | 'enemy' | 'merchant' | 'quest';
  health: number;
  rank?: string;
  enabled?: boolean;
}

const IDLE_RESULT: NpcFrameResult = { action: 'idle', moving: false, attackFired: false };

function commandToFrameResult(cmd: AICommand | undefined, lastAction: ActionId): NpcFrameResult {
  if (!cmd) return IDLE_RESULT;

  switch (cmd.action) {
    case AIAction.None:
      return IDLE_RESULT;

    case AIAction.MoveTo:
      return { action: 'run', moving: true, attackFired: false };

    case AIAction.Attack:
      return { action: 'attack', moving: false, attackFired: true };

    case AIAction.FindCover:
      return { action: 'run', moving: true, attackFired: false };

    case AIAction.Retreat:
      return { action: 'run', moving: true, attackFired: false };

    case AIAction.Die:
      return { action: 'death', moving: false, attackFired: false };

    default:
      return { action: lastAction, moving: false, attackFired: false };
  }
}

export function useWasmNpcAI(opts: UseWasmNpcAIOptions) {
  const { id, x, y, z, role, health, rank, enabled = true } = opts;
  const registeredRef = useRef(false);
  const lastActionRef = useRef<ActionId>('idle');

  useEffect(() => {
    if (!enabled) return;

    wasmNpcBridge.registerNpc(id, x, y, z, role, health, rank);
    registeredRef.current = true;

    return () => {
      wasmNpcBridge.unregisterNpc(id);
      registeredRef.current = false;
    };
  }, [id, x, y, z, role, health, rank, enabled]);

  const getResult = useCallback((): NpcFrameResult => {
    if (!enabled || !registeredRef.current) return IDLE_RESULT;

    const cmd = wasmNpcBridge.getCommand(id);
    const result = commandToFrameResult(cmd, lastActionRef.current);
    lastActionRef.current = result.action;
    return result;
  }, [id, enabled]);

  const syncPosition = useCallback((px: number, py: number, pz: number) => {
    if (!enabled || !registeredRef.current) return;
    wasmNpcBridge.syncNpcPosition(id, px, py, pz);
  }, [id, enabled]);

  const syncRotation = useCallback((yaw: number) => {
    if (!enabled || !registeredRef.current) return;
    wasmNpcBridge.syncNpcRotation(id, yaw);
  }, [id, enabled]);

  const getTargetPosition = useCallback((): [number, number, number] | null => {
    if (!enabled || !registeredRef.current) return null;
    const cmd = wasmNpcBridge.getCommand(id);
    if (!cmd || cmd.action === AIAction.None) return null;
    return [cmd.targetX, cmd.targetY, cmd.targetZ];
  }, [id, enabled]);

  const getTargetYaw = useCallback((): number | null => {
    if (!enabled || !registeredRef.current) return null;
    const cmd = wasmNpcBridge.getCommand(id);
    if (!cmd) return null;
    return cmd.yaw;
  }, [id, enabled]);

  return {
    getResult,
    syncPosition,
    syncRotation,
    getTargetPosition,
    getTargetYaw,
    isRegistered: registeredRef.current,
  };
}
