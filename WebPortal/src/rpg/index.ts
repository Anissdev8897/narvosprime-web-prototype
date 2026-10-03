// ══════════════════════════════════════════════════════════════════════════════
// rpg/index.ts — Point d'entrée public du système RPG/MMORPG futuriste fantasy
//
// Import unique : import { CharacterCreator, ELEMENTS, getAllSkills } from "@/rpg"
// ══════════════════════════════════════════════════════════════════════════════

// Types
export type * from "./types";

// Éléments
export { ELEMENTS, ELEMENT_IDS, getElement, elementMultiplier } from "./elements/elements";

// Classes
export { CLASSES, CLASS_IDS, getClass } from "./classes/classes";

// Compétences
export { ARCHETYPES, ARCHETYPE_IDS } from "./skills/archetypes";
export {
  generateSkillsForClass,
  getAllSkills,
  getSkill,
  getSkillCatalogStats,
} from "./skills/skillGenerator";

// Animations
export {
  ANIMATION_MAP,
  CAST_VARIANTS,
  AOE_CAST_VARIANTS,
  IDLE_VARIANTS,
  resolveAnimation,
  MIXAMO_BONE_MAP,
  ANIMATION_SOURCE_DIR,
} from "./animations/animationMap";

// Loaders / Manifeste d'assets
export {
  RPG_ASSET_ROOT,
  WEAPONS,
  TEXTURES,
  SKIN_TEXTURES,
  getModularPartPath,
  getOutfitPath,
  getWeaponPath,
  OUTFIT_CATALOG,
  OUTFIT_STYLE_IDS,
} from "./loaders/assetManifest";
export type { OutfitTheme, OutfitDef } from "./loaders/assetManifest";

// Composants 3D (création / preview)
export { ModularCharacter, preloadCommonParts } from "./characters/ModularCharacter";
export { AnimatedModularCharacter } from "./characters/AnimatedModularCharacter";

// Runtime (jeu)
export { collisionWorld } from "./runtime/CollisionWorld";
// Système de locomotion modulaire (input / mouvement / caméra séparés)
export { PlayerRig } from "./runtime/movement/PlayerRig";
export { createPlayerState } from "./runtime/movement/playerState";
export type { PlayerState, CameraView, MoveState } from "./runtime/movement/playerState";
export { CharacterController } from "./runtime/movement/CharacterController";
export { FpsCamera } from "./runtime/movement/FpsCamera";
export { InputManager } from "./runtime/movement/InputManager";
export { PLAYER_CONFIG, KEYBINDINGS } from "./runtime/movement/playerConfig";
export { RpgGameWorld } from "./runtime/RpgGameWorld";

// Animation
export { AnimationController } from "./animation/AnimationController";

// PNJ
export { Npc } from "./npc/Npc";
export { NPC_CATALOG, getNpc, getNpcsByRole } from "./npc/npcCatalog";
export type { NpcDef, NpcRole } from "./npc/npcCatalog";

// Manifeste PNJ / Maps
export { NPC_FOLDERS, getNpcModelPath, MAPS } from "./loaders/assetManifest";

// UI
export { CharacterCreator } from "./ui/CharacterCreator";

// Nouveaux systèmes RPG
export { getSpellsForClass }     from "./spells/spellCatalog";
export type { SpellDef }         from "./spells/SpellDef";
export { createStats, applyDamage, applyHeal, spendMana, regenMana, isCrit } from "./stats/PlayerStats";
export type { PlayerStats }      from "./stats/PlayerStats";
export { rollLoot, LOOT_CATALOG, RARITY_COLOR } from "./loot/LootRegistry";
export type { LootItem }         from "./loot/LootRegistry";
export { createInventory, addItem, addCredits, sellItem, buyItem, SHOP_CATALOG } from "./loot/Inventory";
export type { InventoryState, ShopItem } from "./loot/Inventory";
