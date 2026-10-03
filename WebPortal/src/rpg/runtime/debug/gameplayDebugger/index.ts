// ══════════════════════════════════════════════════════════════════════════════
// runtime/debug/gameplayDebugger/index.ts — Point d'entrée du GameplayDebugger
//
// Exporte :
//   • gameplayDebugger (instance singleton du core)
//   • Toutes les catégories pré-enregistrées
//   • Fonction installGameplayDebugger() pour l'intégration dans RpgGameWorld
//   • Helpers 3D (DebugLine, DebugSphere, DebugText)
//   • Composants React (GameplayDebuggerOverlay, Debug3DScene, DebugTextLayer)
// ══════════════════════════════════════════════════════════════════════════════

// ── Imports LOCAUX ───────────────────────────────────────────────────────────
// `export { X } from "./y"` est une ré-exportation PURE : elle republie le
// symbole pour les consommateurs du module mais ne l'introduit PAS dans la
// portée locale. `registerBuiltinCategories()` plus bas fait `new NpcDebugCategory()`
// et appelle `gameplayDebugger.register(...)` : sans ces imports, ces six noms
// n'existent nulle part ici (14 erreurs TS2304).
import { gameplayDebugger } from "./core";
import { NpcDebugCategory } from "./categories/npcCategory";
import { PerfDebugCategory } from "./categories/perfCategory";
import { QuestDebugCategory } from "./categories/questCategory";
import { CombatDebugCategory } from "./categories/combatCategory";
import { ReseauDebugCategory } from "./categories/reseauCategory";

// Core
export { gameplayDebugger } from "./core";
export type { GameplayDebuggerCategory, DebugDrawCall, DebugLineCall, DebugSphereCall, DebugTextCall } from "./core";

// Helpers 3D
export { DebugLine, DebugSphere, DebugText } from "./Debug3DHelpers";

// Composants React
export { GameplayDebuggerOverlay } from "./GameplayDebuggerOverlay";
export { Debug3DScene, DebugTextLayer } from "./Debug3DScene";

// Catégories
export { NpcDebugCategory } from "./categories/npcCategory";
export { PerfDebugCategory, updatePerfData, getPerfData } from "./categories/perfCategory";
export type { PerfData } from "./categories/perfCategory";
export { QuestDebugCategory } from "./categories/questCategory";
export { CombatDebugCategory, updateCombatDebugData, pushDamageEvent, getCombatDebugData } from "./categories/combatCategory";
export type { DamageEvent, ComboState, CombatDebugData } from "./categories/combatCategory";
export { ReseauDebugCategory, updateReseauData, getReseauData } from "./categories/reseauCategory";
export type { ReseauData } from "./categories/reseauCategory";

/**
 * Crée et enregistre toutes les catégories intégrées.
 * À appeler une fois au démarrage du jeu (dans RpgGameWorld ou App).
 *
 * @returns Un objet contenant les références aux catégories (pour injection).
 */
export function registerBuiltinCategories(): {
  npc: NpcDebugCategory;
  perf: PerfDebugCategory;
  quests: QuestDebugCategory;
  combat: CombatDebugCategory;
  reseau: ReseauDebugCategory;
} {
  const npc = new NpcDebugCategory();
  const perf = new PerfDebugCategory();
  const quests = new QuestDebugCategory();
  const combat = new CombatDebugCategory();
  const reseau = new ReseauDebugCategory();

  gameplayDebugger.register(npc);
  gameplayDebugger.register(perf);
  gameplayDebugger.register(quests);
  gameplayDebugger.register(combat);
  gameplayDebugger.register(reseau);

  return { npc, perf, quests, combat, reseau };
}
