// ══════════════════════════════════════════════════════════════════════════════
// types.ts — Types partagés du système RPG/MMORPG futuriste fantasy
// ══════════════════════════════════════════════════════════════════════════════

// ── Genre ─────────────────────────────────────────────────────────────────────
export type Gender = "male" | "female";

// ── Éléments magiques (10) ────────────────────────────────────────────────────
export type ElementId =
  | "fire"
  | "water"
  | "ice"
  | "electric"
  | "poison"
  | "earth"
  | "wind"
  | "light"
  | "dark"
  | "void";

// ── Classes jouables (4 guerriers futuristes) ────────────────────────────────
export type ClassId =
  | "warrior_bruiser"
  | "warrior_dps"
  | "warrior_tank"
  | "warrior_heal";

// ── Rôles gameplay ────────────────────────────────────────────────────────────
export type CombatRole = "dps" | "tank" | "support" | "control" | "hybrid";

// ── Actions d'animation (mapping universel) ──────────────────────────────────
export type ActionId =
  | "idle"
  | "walk"
  | "run"
  | "sprint"
  | "jump"
  | "crouch"
  | "attack"
  | "cast"
  | "channeling"
  | "hit"
  | "death"
  | "dodge"
  | "ultimate"
  | "punch1"
  | "punch2"
  | "punch3"
  | "punch_charged"
  | "kick"
  | "kick_charged"
  | "bighit"
  | "block"
  | "stun"
  | "fall"
  | "landing"
  | "ability_e"
  | "ability_e_recovery"
  | "ability_e_targeting_loop"
  | "ability_e_targeting_start"
  | "ability_q"
  | "slide"
  // Escalade de mur (double appui sur Espace). Ce sont de VRAIS états de
  // personnage, contrairement aux 16 variantes directionnelles de locomotion
  // qui vivent hors de ce type — elles ne se pilotent pas par play() mais par
  // poids simultanés, et les déclarer ici imposerait 16 listes de candidats.
  | "climb_start" | "climb_idle" | "climb_up_l" | "climb_up_r" | "climb_top";

// ── Archétypes de compétences (10 → génèrent 100+ skills) ────────────────────
export type SkillArchetype =
  | "basic"       // attaque de base
  | "projectile"  // tir directionnel
  | "aoe"         // zone d'effet
  | "shield"      // bouclier / défense
  | "dash"        // déplacement rapide
  | "summon"      // invocation
  | "ultimate"    // capacité ultime
  | "cc"          // contrôle de foule
  | "buff"        // amélioration alliée
  | "debuff";     // affaiblissement ennemi

// ── Styles de tenue (Quaternius Modular Character Outfits - Fantasy) ─────────
// 6 tenues disponibles × 2 genres = 12 combinaisons visuelles.
// Toutes partagent le même squelette Quaternius → animations universelles.
export type OutfitStyle =
  | "Knight"       // Chevalier (armure complète)
  | "Knight_Cloth" // Chevalier (tenue légère, sans armure lourde)
  | "Noble"        // Noble (tenue de cour)
  | "Peasant"      // Paysan (tenue de base)
  | "Ranger"       // Rôdeur (capuche, équipement de voyage)
  | "Wizard";      // Sorcier (robe de mage)

// ── Slots de personnalisation modulaire ──────────────────────────────────────
export type EquipmentSlot =
  | "head"
  | "face"
  | "hair"
  | "eyes"
  | "body"     // torse / armure principale
  | "arms"
  | "legs"
  | "feet"     // bottes
  | "gloves"
  | "shoulders" // pauldrons / accessoires épaule
  | "cape"
  | "accessory"
  | "weapon";

// ── Raretés d'objet ───────────────────────────────────────────────────────────
export type Rarity =
  | "common"
  | "rare"
  | "epic"
  | "legendary"
  | "mythic"
  | "alien"
  | "divine";

// ══════════════════════════════════════════════════════════════════════════════
// Définitions de données
// ══════════════════════════════════════════════════════════════════════════════

export interface ElementDef {
  id: ElementId;
  label: string;
  /** Couleur principale (hex) pour UI + albedo */
  color: string;
  /** Couleur d'émission (glow futuriste) */
  emissive: string;
  /** Couleur des particules VFX */
  particleColor: string;
  /** Effet de statut infligé */
  statusEffect: string;
  /** Éléments contre lesquels cet élément est fort (×1.5 dégâts) */
  strongVs: ElementId[];
  /** Éléments qui résistent à cet élément (×0.5 dégâts) */
  weakVs: ElementId[];
  description: string;
}

export interface BaseStats {
  hp: number;
  mana: number;
  defense: number;
  attackPower: number;
  critChance: number; // 0..1
  moveSpeed: number;
}

export interface ClassDef {
  id: ClassId;
  label: string;
  element: ElementId;
  role: CombatRole;
  /** Clé d'arme dans le WeaponRegistry */
  weaponKey: string;
  /** Thème visuel de la tenue (recoloration PBR) */
  outfitColor: string;
  outfitEmissive: string;
  baseStats: BaseStats;
  description: string;
}

export interface SkillDef {
  id: string;
  classId: ClassId;
  archetype: SkillArchetype;
  element: ElementId;
  label: string;
  damage: number;     // 0 pour les sorts de support
  heal: number;       // 0 pour les sorts offensifs
  manaCost: number;
  cooldown: number;   // secondes
  /** Action d'animation jouée au cast */
  animation: ActionId;
  /** Clé VFX (élément + archétype) */
  vfx: string;
  description: string;
}

// ── Configuration d'un personnage assemblé ───────────────────────────────────
export interface CharacterConfig {
  gender: Gender;
  classId: ClassId;
  /** Style de tenue Quaternius (remplace l'ancien "theme"). Défaut : "Ranger". */
  outfitStyle: OutfitStyle;
  /** Parties équipées : slot → clé de mesh modulaire ("" = vide). Réservé v2. */
  parts: Partial<Record<EquipmentSlot, string>>;
  /** Couleur de peau (hex) */
  skinColor: string;
  /** Teinte de la tenue (override de la couleur de classe). "#ffffff" = inchangé. */
  tint?: string;
  /** Avatar/modèle 3D du joueur : "wraith" (défaut) ou un Bullet character. */
  modelId?: string;
}

// ── Entrée du mapping d'animation ─────────────────────────────────────────────
export interface AnimationMapEntry {
  action: ActionId;
  /** Nom du clip source (Mixamo) sans extension */
  clip: string;
  /** Actions de repli si le clip est absent (ordre de priorité) */
  fallbacks: ActionId[];
}
