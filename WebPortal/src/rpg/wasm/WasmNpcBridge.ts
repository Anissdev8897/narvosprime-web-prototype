/**
 * WasmNpcBridge — pont entre npcRegistry (JS, string IDs) et ECS WASM (Entity u32).
 *
 * Responsabilités :
 *   1. Créer/détruire des entités WASM quand des PNJ s'enregistrent/se désinscrivent
 *   2. Synchroniser les positions JS → WASM chaque frame
 *   3. Dispatcher les commandes IA WASM vers les PNJ JS
 *   4. Maintenir l'EntityNpcMap pour StatusEffectSync
 *
 * Singleton hors-React (comme npcRegistry, collisionWorld).
 */
import { getEngine } from './WasmBridge';
import type { AICommand } from './AICommandSync';
import type { EntityNpcMap } from './StatusEffectSync';

const enum WasmSquadRole {
  Grunt = 0,
  Leader = 1,
  Sniper = 2,
  Brute = 3,
}

type JsNpcRole = 'ally' | 'enemy' | 'merchant' | 'quest';

function roleToSquadRole(role: JsNpcRole, rank?: string): WasmSquadRole {
  if (rank === 'boss') return WasmSquadRole.Brute;
  switch (role) {
    case 'enemy': return WasmSquadRole.Grunt;
    default: return WasmSquadRole.Grunt;
  }
}

interface WasmNpcEntry {
  jsId: string;
  entity: number;
  role: JsNpcRole;
}

class WasmNpcBridgeImpl {
  private jsToEntity = new Map<string, number>();
  private entityToJs = new Map<number, string>();
  private entries = new Map<string, WasmNpcEntry>();
  private commands = new Map<string, AICommand>();
  private playerEntity = 0;

  registerPlayer(x: number, y: number, z: number): number {
    const engine = getEngine();
    if (!engine) return 0;

    if (this.playerEntity && engine.isEntityValid(this.playerEntity)) return this.playerEntity;
    this.playerEntity = engine.createPlayer(x, y, z);
    return this.playerEntity;
  }

  getPlayerEntity(): number {
    return this.playerEntity;
  }

  registerNpc(jsId: string, x: number, y: number, z: number, role: JsNpcRole, health: number, rank?: string): number {
    const engine = getEngine();
    if (!engine) return 0;

    if (this.jsToEntity.has(jsId)) return this.jsToEntity.get(jsId)!;

    const squadRole = roleToSquadRole(role, rank);
    const entity = engine.createNPC(x, y, z, squadRole, health);

    this.jsToEntity.set(jsId, entity);
    this.entityToJs.set(entity, jsId);
    this.entries.set(jsId, { jsId, entity, role });

    return entity;
  }

  unregisterNpc(jsId: string): void {
    const entity = this.jsToEntity.get(jsId);
    if (entity === undefined) return;

    this.jsToEntity.delete(jsId);
    this.entityToJs.delete(entity);
    this.entries.delete(jsId);
    this.commands.delete(jsId);
  }

  hasNpc(jsId: string): boolean {
    return this.jsToEntity.has(jsId);
  }

  getEntity(jsId: string): number {
    return this.jsToEntity.get(jsId) ?? 0;
  }

  getNpcId(entity: number): string | undefined {
    return this.entityToJs.get(entity);
  }

  syncNpcPosition(jsId: string, x: number, y: number, z: number): void {
    const engine = getEngine();
    const entity = this.jsToEntity.get(jsId);
    if (!engine || entity === undefined) return;
    engine.setEntityPosition(entity, x, y, z);
  }

  syncPlayerPosition(x: number, y: number, z: number): void {
    const engine = getEngine();
    if (!engine || !this.playerEntity) return;
    engine.setEntityPosition(this.playerEntity, x, y, z);
  }

  syncNpcRotation(jsId: string, yaw: number): void {
    const engine = getEngine();
    const entity = this.jsToEntity.get(jsId);
    if (!engine || entity === undefined) return;
    engine.setEntityRotation(entity, 0, yaw, 0);
  }

  /**
   * Reçoit les commandes IA du WASM et les dispatch par npcId.
   * Appelé par WasmWorldTicker après tickWorld.
   */
  dispatchCommands(cmds: AICommand[]): void {
    this.commands.clear();
    for (const cmd of cmds) {
      const jsId = this.entityToJs.get(cmd.entity);
      if (jsId) this.commands.set(jsId, cmd);
    }
  }

  getCommand(jsId: string): AICommand | undefined {
    return this.commands.get(jsId);
  }

  getEntityMap(): EntityNpcMap {
    return this.entityToJs;
  }

  get npcCount(): number {
    return this.jsToEntity.size;
  }

  clear(): void {
    this.jsToEntity.clear();
    this.entityToJs.clear();
    this.entries.clear();
    this.commands.clear();
    this.playerEntity = 0;
  }
}

export const wasmNpcBridge = new WasmNpcBridgeImpl();
