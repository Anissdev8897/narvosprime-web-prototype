/**
 * StatusEffectSync — pont bidirectionnel entre les statuts WASM (Entity u32)
 * et le singleton JS (npcId string).
 *
 * Direction JS→WASM : quand un sort JS applique un effet, on mirror vers WASM
 *   pour que l'IA C++ voie l'état (isRooted/isStunned).
 * Direction WASM→JS : quand le combat WASM applique un effet (futur),
 *   on mirror vers JS pour le rendu et l'animation.
 *
 * Le mapping npcId↔Entity est maintenu par le caller (runtime).
 */
import { getEngine } from './WasmBridge';
import { statusEffects } from '../combat/statusEffects';

export type EntityNpcMap = Map<number, string>;

/**
 * Pousse les effets JS vers WASM pour un set d'entités.
 * Appelé quand un sort JS vient d'appliquer un effet.
 */
export function pushEffectToWasm(entity: number, kind: 'burn' | 'root' | 'stun', dps: number, duration: number): void {
  const engine = getEngine();
  if (!engine) return;

  switch (kind) {
    case 'burn': engine.applyBurn(entity, dps, duration); break;
    case 'root': engine.applyRoot(entity, duration); break;
    case 'stun': engine.applyStun(entity, duration); break;
  }
}

/**
 * Lit l'état WASM et synchronise vers JS pour les entités données.
 * Utile quand l'IA WASM applique des effets que JS doit refléter.
 */
export function pullEffectsFromWasm(entityMap: EntityNpcMap): void {
  const engine = getEngine();
  if (!engine) return;

  for (const [entity, npcId] of entityMap) {
    if (engine.isRooted(entity) && !statusEffects.isRooted(npcId)) {
      statusEffects.applyRoot(npcId, 0.5);
    }
    if (engine.isStunned(entity) && !statusEffects.isStunned(npcId)) {
      statusEffects.applyStun(npcId, 0.5);
    }
  }
}

/**
 * Vérifie si un entity est rooted/stunned côté WASM.
 * Raccourci pour les systèmes qui n'ont que l'entity ID.
 */
export function isEntityRooted(entity: number): boolean {
  return getEngine()?.isRooted(entity) ?? false;
}

export function isEntityStunned(entity: number): boolean {
  return getEngine()?.isStunned(entity) ?? false;
}
