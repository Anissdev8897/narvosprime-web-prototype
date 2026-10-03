// ══════════════════════════════════════════════════════════════════════════════
// loaders/launcherAssets.ts — Catalogue CENTRAL des assets UI (public/models/launcher)
//
// Source unique pour : vidéos (menu/classes), logo, icônes de sorts par élément,
// icônes de ressources/équipement (3D renders + sprites découpés).
//
// Nommage sur le disque irrégulier (espaces, accents, double-extension) →
// on encode/cible ici ; les composants restent propres.
// ══════════════════════════════════════════════════════════════════════════════

import type { ClassId, ElementId } from "../types";

const L    = "/models/launcher";
const R    = `${L}/resource`;   // 3D renders individuels
const ITEM = `${L}/item`;       // renders équipement + planches
const CUT  = `${ITEM}/cut`;     // sprites découpés (PIL)

// Encode uniquement les caractères spéciaux dans un chemin (espaces, accents…).
const enc = (s: string) => s.replace(/ /g, "%20");

// ── Vidéos UI ─────────────────────────────────────────────────────────────────
export const MENU_VIDEO     = `${L}/Menuprincipal.mp4`;
export const INTRO_VIDEO    = `${L}/NARVOSPRIME.mp4`;
export const HERO_CINEMATIC = `${L}/cinematiqueheros.mp4`;
export const LOADING_VIDEO  = `${L}/ecran_dechargement.mp4`;
export const LOGIN_VIDEO    = `${L}/ecrande_connection.mp4`;

// ── Images UI ─────────────────────────────────────────────────────────────────
export const GAME_LOGO      = `${L}/logod_jeux.png`;
export const ICON_INVENTORY = `${L}/iconeinventaire.png`;
export const HUD_FRAME      = `${L}/hud.png`;

// ── Vidéos de classe ──────────────────────────────────────────────────────────
export const CLASS_VIDEOS: Partial<Record<ClassId, string>> = {};

export function classVideo(classId: ClassId): string | null {
  return CLASS_VIDEOS[classId] ?? null;
}

// ── Icônes de sorts par élément ───────────────────────────────────────────────
export const SPELL_ICONS: Partial<Record<ElementId, string[]>> = {
  fire:     [`${L}/feu/spell1.png`,     `${L}/feu/spell2.png`,     `${L}/feu/spell3.png`,     `${L}/feu/spell4.png`],
  electric: [`${L}/elec/spell1.png`,    `${L}/elec/spell2.png`,    `${L}/elec/spell3.png`,    `${L}/elec/spell4.png`],
  light:    [`${L}/lumiere/spell1.png`, `${L}/lumiere/spell2.png`, `${L}/lumiere/spell3.png`, `${L}/lumiere/spell4.png`],
  earth:    [`${L}/terre/spell1.png`,   `${L}/terre/spell2.png`,   `${L}/terre/spell3.png`,   `${L}/terre/spell4.png`],
  water:    [enc(`${L}/eau/spell1 (1).png`),    `${L}/eau/spell2.png`,    `${L}/eau/spell3.png`,    `${L}/eau/spell4.png`],
  poison:   [enc(`${L}/poison/spell1 (1).png`), `${L}/poison/spell2.png`, `${L}/poison/spell3.png`, `${L}/poison/spell4.png`],
  wind:     [enc(`${L}/air/spell1 (1).png`),    `${L}/air/spell2.png`,    `${L}/air/spell3.png`,    `${L}/air/spell4.png`],
  dark:     [enc(`${L}/ombre/spell1 (1).png`),  `${L}/ombre/spell2.png`,  `${L}/ombre/spell3.png`,  `${L}/ombre/spell4.png`],
  void:     [enc(`${L}/ombre/spell1 (1).png`),  `${L}/ombre/spell2.png`,  `${L}/ombre/spell3.png`,  `${L}/ombre/spell4.png`],
  ice:      [`${L}/glace/spellun.jpg`,  `${L}/glace/spelldeux.jpg`, `${L}/glace/spell3.jpg`,  `${L}/glace/spellquatre.jpg`],
};

export function spellIcon(element: ElementId, index: number): string | null {
  const set = SPELL_ICONS[element];
  if (!set || set.length === 0) return null;
  return set[index % set.length] ?? set[0];
}

// ── Icônes de RESSOURCES / MATÉRIAUX (non équipables) ───────────────────────
// clés = id exact du LootItem dans LootRegistry.ts
export const RESOURCE_ICONS: Record<string, string> = {
  // 3D renders nommés (petite résolution, fond transparent/neutre)
  cristal_energie:  `${R}/cristal_brut.png`,
  fragment_vie:     `${R}/fragement_source.png`,
  nano_composant:   `${R}/nano-composant.png`,
  noyau_plasma:     `${R}/noyaud%C3%A9nergie.png`,    // é → %C3%A9
  metal_rare:       `${R}/engrenage.png`,

  // Consommables (générés et enregistrés)
  potion_soin_mineure:   `${R}/potion_soin_mineure.png`,
  potion_soin_majeure:   `${R}/potion_soin_majeure.png`,
  potion_soin_supreme:   `${R}/potion_soin_supreme.png`,
  potion_mana_mineure:   `${R}/potion_mana_mineure.png`,
  potion_mana_majeure:   `${R}/potion_mana_majeure.png`,
  elixir_vital:          `${R}/elixir_vital.png`,
  key_chasseur_avion:    `${R}/key_chasseur_avion.png`,
  key_longsword:         `${R}/key_longsword.png`,
  key_phamtom:           `${R}/key_phamtom.png`,
  key_vehicule_terrestre:`${R}/key_vehicule_terrestre.png`,
  repair_kit:            `${R}/repair_kit.png`,

  // 3D renders IA (2048×2048, fond sombre/coloré)
  adn_alien:        `${R}/00018-2399215671.png`, // cristaux violets dans dôme cuivré
  powernax:         `${R}/00041-2399215671.png`, // capteur vortex doré (légendaire)
  powertox:         `${R}/00188-2399215672.png`, // réacteur bio-organique rose (toxique)
  voidcore:         `${R}/00012-2399215672.png`, // cristal magenta flottant (vide)
  cryon_x:          `${R}/00044-2399215672.png`, // orbe teal cristal (glace légendaire)
};

// ── Icônes d'ÉQUIPEMENT (équipables, slot défini) ────────────────────────────
// Clés corrigées : correspondent aux `id` exacts du LootRegistry.
export const ITEM_ICONS: Record<string, string> = {
  // Renders 3D dédiés (1024×1024, fond blanc/neutre)
  combat_helmet:  `${ITEM}/casquedecombat.png`,
  combat_gloves:  `${ITEM}/ganteletdecombat.png`,
  combat_boots:   `${ITEM}/bottesdecombat.png`,

  // Sprites pixel-art découpés de la planche (fond transparent)
  plasma_blade:   `${CUT}/weapons2/r00_c02.png`, // lame plasma violette flamboyante
  void_saber:     `${CUT}/weapons2/r00_c06.png`, // sabre cyan void
  plasma_shield:  `${CUT}/weapons2/r00_c05.png`, // bouclier/conteneur énergie

  // 3D renders IA — accessoires
  cyber_armor:    `${R}/00056-2399215671.png`, // machine tech orange LED
  guard_belt:     `${R}/00045-2399215672.png`, // cylindre mécanique multicolore
  tactical_cape:  `${R}/00211-2399215671.png`, // boîte tactique orange/rust
  void_amulet:    `${R}/00165-2399215671.png`, // médaillon bouclier éclair cyan
  power_ring:     `${R}/00120-2399215672.png`, // conteneur anneau énergie rose
  ward_ring:      `${R}/00060-2399215672.png`, // pyramide alien tentacules bleue
};

/** Icône d'un objet (ressource ou équipement) → URL ou null si aucune. */
export function lootIcon(itemId: string): string | null {
  return RESOURCE_ICONS[itemId] ?? ITEM_ICONS[itemId] ?? null;
}
