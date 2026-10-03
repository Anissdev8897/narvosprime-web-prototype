// ══════════════════════════════════════════════════════════════════════════════
// spells/spellCatalog.ts — Sorts des 4 classes guerrier futuristes
//
// vfxPath = template de chemin où "#" est remplacé par le n° de frame (1..vfxFrames).
// ══════════════════════════════════════════════════════════════════════════════

import type { SpellDef } from "./SpellDef";

const PACK = {
  warrior:    (n: number) => `Pixel Art Warrior Animations - Full Version/VFX ${n}/Frames/warrior_skill${n}_frame#.png`,
  paladin:    (n: number) => `Pixel Art VFX - Paladin - FULL Version/VFX ${n}/Frames/paladin_skill${n}_frame#.png`,
  priest:     (n: number) => `Pixel Art VFX - Priest - FULL Version/VFX${n}/Frames/Priest_skill${n}_frame#.png`,
  starcaller: (n: number) => `Starcaller Spell Animations/VFX ${n}/Frames/Starcaller_spell_${n}_frame_#.png`,
  fire:       (n: number) => `Pixel Art VFX - Fire Mage - FULL Version/VFX${n}/frames/FireMage_skill${n}_frame#.png`,
};

export const SPELL_CATALOG: SpellDef[] = [
  // ── Guerrier Bruiser (Électrique → Starcaller + Warrior) ──────────────────
  { id: "bruiser_slam", classId: "warrior_bruiser", element: "electric", archetype: "basic",
    label: "Frappe Électrique", description: "Coup de mêlée chargé d'énergie",
    damage: 40, heal: 0, manaCost: 15, cooldown: 1.0, speed: 0, range: 4, aoeRadius: 0,
    vfxPath: PACK.starcaller(1), vfxFrames: 6, hotkey: "1" },
  { id: "bruiser_shockwave", classId: "warrior_bruiser", element: "electric", archetype: "aoe",
    label: "Onde de Choc", description: "Impact au sol — repousse et étourdit les ennemis proches",
    damage: 32, heal: 0, manaCost: 30, cooldown: 5, speed: 0, range: 0, aoeRadius: 6,
    vfxPath: PACK.starcaller(2), vfxFrames: 6, hotkey: "2" },
  { id: "bruiser_rage", classId: "warrior_bruiser", element: "electric", archetype: "buff",
    label: "Rage Surchargée", description: "Booste puissance +40% pendant 8s",
    damage: 0, heal: 0, manaCost: 25, cooldown: 14, speed: 0, range: 0, aoeRadius: 0,
    vfxPath: PACK.starcaller(3), vfxFrames: 6, hotkey: "3" },

  // ── Guerrier DPS (Feu → Fire Mage) ────────────────────────────────────────
  { id: "dps_fire_shot", classId: "warrior_dps", element: "fire", archetype: "projectile",
    label: "Tir Incendiaire", description: "Projectile plasma haute vélocité",
    damage: 48, heal: 0, manaCost: 18, cooldown: 0.8, speed: 30, range: 35, aoeRadius: 0,
    vfxPath: PACK.fire(1), vfxFrames: 6, hotkey: "1" },
  { id: "dps_plasma_barrage", classId: "warrior_dps", element: "fire", archetype: "aoe",
    label: "Barrage Plasma", description: "Salve d'énergie incendiaire sur la zone",
    damage: 35, heal: 0, manaCost: 35, cooldown: 5, speed: 0, range: 0, aoeRadius: 7,
    vfxPath: PACK.fire(2), vfxFrames: 6, hotkey: "2" },
  { id: "dps_evasion", classId: "warrior_dps", element: "fire", archetype: "shield",
    label: "Esquive Tactique", description: "Esquive parfaite — immunité 3s",
    damage: 0, heal: 0, manaCost: 22, cooldown: 12, speed: 0, range: 0, aoeRadius: 0,
    vfxPath: PACK.fire(3), vfxFrames: 6, hotkey: "3" },

  // ── Guerrier Tank (Terre → Warrior + Paladin) ─────────────────────────────
  { id: "tank_bash", classId: "warrior_tank", element: "earth", archetype: "basic",
    label: "Bouclier Bélier", description: "Charge bouclier — repousse et stun 2s",
    damage: 28, heal: 0, manaCost: 14, cooldown: 1.2, speed: 12, range: 6, aoeRadius: 0,
    vfxPath: PACK.warrior(1), vfxFrames: 10, hotkey: "1" },
  { id: "tank_fortress", classId: "warrior_tank", element: "earth", archetype: "aoe",
    label: "Forteresse", description: "AoE taunt — attire les ennemis proches vers soi",
    damage: 20, heal: 0, manaCost: 28, cooldown: 6, speed: 0, range: 0, aoeRadius: 8,
    vfxPath: PACK.warrior(2), vfxFrames: 10, hotkey: "2" },
  { id: "tank_iron_wall", classId: "warrior_tank", element: "earth", archetype: "shield",
    label: "Mur d'Acier", description: "Absorbe 200 dégâts pendant 10s",
    damage: 0, heal: 0, manaCost: 30, cooldown: 14, speed: 0, range: 0, aoeRadius: 0,
    vfxPath: PACK.warrior(3), vfxFrames: 10, hotkey: "3" },

  // ── Guerrier Heal (Lumière → Priest + Paladin) ────────────────────────────
  { id: "heal_nano", classId: "warrior_heal", element: "light", archetype: "buff",
    label: "Nano-Soin", description: "Régénère 60 HP instantanément",
    damage: 0, heal: 60, manaCost: 25, cooldown: 4, speed: 0, range: 0, aoeRadius: 0,
    vfxPath: PACK.priest(1), vfxFrames: 6, hotkey: "1" },
  { id: "heal_drone", classId: "warrior_heal", element: "light", archetype: "aoe",
    label: "Drone Médical", description: "Zone de soin — régénère 30 HP/s pendant 6s",
    damage: 0, heal: 30, manaCost: 35, cooldown: 8, speed: 0, range: 0, aoeRadius: 6,
    vfxPath: PACK.paladin(1), vfxFrames: 8, hotkey: "2" },
  { id: "heal_barrier", classId: "warrior_heal", element: "light", archetype: "shield",
    label: "Champ Protecteur", description: "Barrière d'équipe — absorbe 120 dégâts",
    damage: 0, heal: 0, manaCost: 30, cooldown: 12, speed: 0, range: 0, aoeRadius: 0,
    vfxPath: PACK.paladin(2), vfxFrames: 8, hotkey: "3" },
];

for (const s of SPELL_CATALOG) {
  // Même contrat pour toutes les classes : deux pouvoirs et un ultime.
  s.cooldown = s.hotkey === "1" ? 5 : s.hotkey === "2" ? 4 : s.hotkey === "3" ? 60 : s.cooldown;
  if (s.hotkey === "2") {
    s.homing = true;
    s.range  = 5;
    if (s.speed === 0) s.speed = 14;
  }
}

/** Retourne les sorts d'une classe (6 max). Fallback vers warrior_bruiser si vide. */
export function getSpellsForClass(classId: string): SpellDef[] {
  const own = SPELL_CATALOG.filter((s) => s.classId === classId);
  if (own.length >= 2) return own.slice(0, 6);
  const generic = SPELL_CATALOG.filter((s) => s.classId === "warrior_bruiser");
  return [...own, ...generic].slice(0, 6);
}
