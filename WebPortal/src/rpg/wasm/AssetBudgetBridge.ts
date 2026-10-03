/**
 * AssetBudgetBridge — pont TS pour le gestionnaire de budget VRAM global (C++/WASM).
 *
 * Étend ChunkStreamingBridge : au lieu de ne gérer que les chunks de map, ce
 * système track TOUS les assets (persos, armes, PNJ, véhicules, animations)
 * avec un budget VRAM unifié et des décisions LOD par distance + priorité.
 */
import { getEngine } from './WasmBridge';

// ── Enums miroir du C++ ─────────────────────────────────────────────────────────

export const enum AssetCategory {
  Chunk     = 0,
  Player    = 1,
  Npc       = 2,
  Weapon    = 3,
  Vehicle   = 4,
  Animation = 5,
  Ui        = 6,
}

export const enum QualityTier {
  Low    = 0,
  Medium = 1,
  High   = 2,
}

export const enum AssetCommandType {
  Preload   = 0,
  Upgrade   = 1,
  Downgrade = 2,
  Evict     = 3,
}

export interface AssetCommand {
  type: AssetCommandType;
  assetId: number;
  tier: QualityTier;
}

export interface AssetRegistration {
  id: number;
  category: AssetCategory;
  spatial: boolean;
  position: [number, number, number];
  sizeMB: { low: number; med: number; high: number };
  essential: boolean;
}

// ── Buffer pour drain des commandes ─────────────────────────────────────────────

const MAX_COMMANDS = 64;
const STRIDE_U32 = 3; // [cmd, assetId, tier]

let cmdBufferPtr = 0;

function ensureBuffer(): boolean {
  const engine = getEngine();
  if (!engine) return false;
  if (typeof engine._malloc !== "function") return false;
  if (cmdBufferPtr === 0) {
    cmdBufferPtr = engine._malloc(MAX_COMMANDS * STRIDE_U32 * 4);
  }
  return true;
}

// ── API publique ────────────────────────────────────────────────────────────────

/** Initialise le budget manager WASM avec un budget VRAM total (MB). */
export function initAssetBudget(totalBudgetMB: number): void {
  const engine = getEngine();
  if (!engine) return;
  engine.budgetInit(totalBudgetMB);
}

/** Définit un budget max pour une catégorie d'assets. */
export function setCategoryBudget(cat: AssetCategory, budgetMB: number): void {
  const engine = getEngine();
  if (!engine) return;
  engine.budgetSetCategoryBudget(cat, budgetMB);
}

/** Enregistre un asset dans le budget manager WASM. */
export function registerAsset(reg: AssetRegistration): void {
  const engine = getEngine();
  if (!engine) return;
  engine.budgetRegisterAsset(
    reg.id, reg.category, reg.spatial,
    reg.position[0], reg.position[1], reg.position[2],
    reg.sizeMB.low, reg.sizeMB.med, reg.sizeMB.high,
    reg.essential,
  );
}

/** Met à jour la position d'un asset spatial (PNJ qui bouge, etc.). */
export function setAssetPosition(id: number, x: number, y: number, z: number): void {
  const engine = getEngine();
  if (!engine) return;
  engine.budgetSetAssetPosition(id, x, y, z);
}

/** Confirme qu'un asset a été chargé à un tier donné. */
export function markAssetLoaded(id: number, tier: QualityTier): void {
  const engine = getEngine();
  if (!engine) return;
  engine.budgetMarkLoaded(id, tier);
}

/** Confirme qu'un asset a été déchargé. */
export function markAssetUnloaded(id: number): void {
  const engine = getEngine();
  if (!engine) return;
  engine.budgetMarkUnloaded(id);
}

/** Tick : le C++ évalue distances + budget et génère des commandes. */
export function tickAssetBudget(
  px: number, py: number, pz: number,
  loadRadius: number, unloadRadius: number,
): void {
  const engine = getEngine();
  if (!engine) return;
  engine.budgetTick(px, py, pz, loadRadius, unloadRadius);
}

/** Draine les commandes (Preload/Upgrade/Downgrade/Evict) du dernier tick. */
export function drainAssetCommands(): AssetCommand[] {
  const engine = getEngine();
  if (!engine || !ensureBuffer()) return [];

  const count = engine.budgetDrainCommands(cmdBufferPtr, MAX_COMMANDS);
  if (count === 0) return [];

  const heap = engine.HEAPU32;
  const base = cmdBufferPtr >> 2;
  const cmds: AssetCommand[] = [];
  for (let i = 0; i < count; i++) {
    cmds.push({
      type: heap[base + i * STRIDE_U32 + 0] as AssetCommandType,
      assetId: heap[base + i * STRIDE_U32 + 1],
      tier: heap[base + i * STRIDE_U32 + 2] as QualityTier,
    });
  }
  return cmds;
}

/** Qualité recommandée par le WASM pour un asset donné. */
export function getRecommendedTier(
  id: number, px: number, py: number, pz: number,
): QualityTier {
  const engine = getEngine();
  if (!engine) return QualityTier.High;
  return engine.budgetRecommendedTier(id, px, py, pz) as QualityTier;
}

/** Stats globales du budget manager. */
export function getAssetBudgetStats(): {
  totalUsedMB: number;
  totalBudgetMB: number;
  loadedCount: number;
  assetCount: number;
  pendingCount: number;
  categoryUsedMB: Record<string, number>;
} {
  const engine = getEngine();
  if (!engine) {
    return {
      totalUsedMB: 0, totalBudgetMB: 0,
      loadedCount: 0, assetCount: 0, pendingCount: 0,
      categoryUsedMB: {},
    };
  }
  return {
    totalUsedMB: engine.budgetTotalUsedMB(),
    totalBudgetMB: engine.budgetTotalBudgetMB(),
    loadedCount: engine.budgetLoadedCount(),
    assetCount: engine.budgetAssetCount(),
    pendingCount: engine.budgetPendingCount(),
    categoryUsedMB: {
      chunk: engine.budgetCategoryUsedMB(AssetCategory.Chunk),
      player: engine.budgetCategoryUsedMB(AssetCategory.Player),
      npc: engine.budgetCategoryUsedMB(AssetCategory.Npc),
      weapon: engine.budgetCategoryUsedMB(AssetCategory.Weapon),
      vehicle: engine.budgetCategoryUsedMB(AssetCategory.Vehicle),
      animation: engine.budgetCategoryUsedMB(AssetCategory.Animation),
    },
  };
}

/** Empreinte des assets enregistrés. Change quand les modèles sont re-exportés. */
export function getAssetBudgetFingerprint(): number {
  const engine = getEngine();
  if (!engine) return 0;
  return engine.budgetCacheFingerprint();
}

/** Libère le buffer et reset le manager. */
export function clearAssetBudget(): void {
  const engine = getEngine();
  if (engine) {
    engine.budgetClear();
    if (cmdBufferPtr !== 0) {
      engine._free(cmdBufferPtr);
      cmdBufferPtr = 0;
    }
  }
}
