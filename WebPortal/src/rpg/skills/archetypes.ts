// ══════════════════════════════════════════════════════════════════════════════
// skills/archetypes.ts — Les 10 archétypes de compétences
//
// Plutôt que d'écrire 100 sorts à la main, on définit 10 ARCHÉTYPES (templates).
// Le générateur (skillGenerator.ts) combine : archétype × classe × élément
// → 10 classes × 10 archétypes = 100 compétences uniques et thématisées.
// ══════════════════════════════════════════════════════════════════════════════

import type { ActionId, SkillArchetype } from "../types";

export interface ArchetypeTemplate {
  archetype: SkillArchetype;
  /** Suffixe de nom (préfixé par le thème élémentaire de la classe) */
  nameSuffix: string;
  /** Multiplicateur de dégâts (× attackPower de la classe). 0 = support */
  damageMult: number;
  /** Multiplicateur de soin (× 10). 0 = offensif */
  healMult: number;
  manaCost: number;
  cooldown: number;     // secondes
  animation: ActionId;
  /** Description générique (le {element} sera remplacé) */
  descTemplate: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// ⚙️  ZONE D'ÉQUILIBRAGE — ces valeurs définissent le "feel" de chaque archétype.
//     C'est ICI qu'un game designer ajuste damage/cooldown/mana sans toucher
//     au code de génération. Modifier une ligne rééquilibre les 10 classes.
// ══════════════════════════════════════════════════════════════════════════════
export const ARCHETYPES: Record<SkillArchetype, ArchetypeTemplate> = {
  basic: {
    archetype: "basic",
    nameSuffix: "Frappe",
    damageMult: 1.0,
    healMult: 0,
    manaCost: 0,          // attaque de base = gratuite
    cooldown: 0.5,
    animation: "attack",
    descTemplate: "Attaque de base {element}. Rapide, sans coût de mana.",
  },
  projectile: {
    archetype: "projectile",
    nameSuffix: "Trait",
    damageMult: 1.8,
    healMult: 0,
    manaCost: 12,
    cooldown: 0.9,
    animation: "cast",
    descTemplate: "Projectile {element} à tête chercheuse. Dégâts directs élevés.",
  },
  aoe: {
    archetype: "aoe",
    nameSuffix: "Tempête",
    damageMult: 2.2,
    healMult: 0,
    manaCost: 25,
    cooldown: 2.5,
    animation: "ultimate",  // utilise l'anim Area Attack
    descTemplate: "Zone d'effet {element}. Frappe tous les ennemis alentour.",
  },
  shield: {
    archetype: "shield",
    nameSuffix: "Égide",
    damageMult: 0,
    healMult: 4.0,          // absorbe = soin temporaire
    manaCost: 20,
    cooldown: 8.0,
    animation: "channeling",
    descTemplate: "Bouclier {element} qui absorbe les dégâts pendant 6s.",
  },
  dash: {
    archetype: "dash",
    nameSuffix: "Élan",
    damageMult: 0.8,
    healMult: 0,
    manaCost: 10,
    cooldown: 4.0,
    animation: "dodge",
    descTemplate: "Déplacement rapide {element}. Inflige des dégâts sur le passage.",
  },
  summon: {
    archetype: "summon",
    nameSuffix: "Invocation",
    damageMult: 1.5,        // dégâts du familier sur la durée
    healMult: 0,
    manaCost: 30,
    cooldown: 12.0,
    animation: "channeling",
    descTemplate: "Invoque une entité {element} qui combat à vos côtés 15s.",
  },
  ultimate: {
    archetype: "ultimate",
    nameSuffix: "Apocalypse",
    damageMult: 5.0,
    healMult: 0,
    manaCost: 60,
    cooldown: 30.0,
    animation: "ultimate",
    descTemplate: "Capacité ultime {element}. Dégâts dévastateurs sur large zone.",
  },
  cc: {
    archetype: "cc",
    nameSuffix: "Emprise",
    damageMult: 0.5,
    healMult: 0,
    manaCost: 18,
    cooldown: 6.0,
    animation: "cast",
    descTemplate: "Contrôle {element} : immobilise/étourdit l'ennemi 3s.",
  },
  buff: {
    archetype: "buff",
    nameSuffix: "Bénédiction",
    damageMult: 0,
    healMult: 2.0,
    manaCost: 22,
    cooldown: 15.0,
    animation: "channeling",
    descTemplate: "Améliore les alliés : +30% dégâts {element} pendant 10s.",
  },
  debuff: {
    archetype: "debuff",
    nameSuffix: "Affliction",
    damageMult: 0.6,
    healMult: 0,
    manaCost: 16,
    cooldown: 7.0,
    animation: "cast",
    descTemplate: "Affaiblit l'ennemi : -30% résistance {element} pendant 8s.",
  },
};

export const ARCHETYPE_IDS = Object.keys(ARCHETYPES) as SkillArchetype[];
