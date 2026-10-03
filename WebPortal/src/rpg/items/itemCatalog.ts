// ══════════════════════════════════════════════════════════════════════════════
// items/itemCatalog.ts — Catalogue central des définitions d'items
//
// Tous les items du jeu sont définis ici. ITEM_DB[id] → ItemDefinition.
// ══════════════════════════════════════════════════════════════════════════════

import type { ItemDefinition } from "./ItemDefinition";

/**
 * Catalogue central. Les items sont indexés par leur id.
 */
export const ITEM_DB: Record<string, ItemDefinition> = {
  // ── ARMES ─────────────────────────────────────────────────────────────────
  arch_sword: {
    id: "arch_sword", label: "Épée de Combat", type: "weapon",
    rarity: "common", description: "Épée droite standard, fiable au combat.",
    gridW: 2, gridH: 3, stackable: false, maxStack: 1,
    stats: { attackPower: 5, puissance: 3 }, level: 1,
    equipSlot: "weapon", icon: "⚔️", color: "#aaaaaa", iconFile: "tex_bone_06",
    value: 30, weight: 3, category: "equipment",
  },
  arch_shield: {
    id: "arch_shield", label: "Bouclier Tactique", type: "weapon",
    rarity: "common", description: "Bouclier léger en alliage composite.",
    gridW: 2, gridH: 3, stackable: false, maxStack: 1,
    stats: { defense: 6, maxHp: 10 }, level: 1,
    equipSlot: "offhand", icon: "🛡️", color: "#aaaaaa", iconFile: "tex_spare_parts_06",
    value: 30, weight: 4, category: "equipment",
  },
  arch_gun: {
    id: "arch_gun", label: "Pistolet Standard", type: "weapon",
    rarity: "common", description: "Pistolet semi-automatique à projectiles énergétiques.",
    gridW: 2, gridH: 2, stackable: false, maxStack: 1,
    stats: { attackPower: 6, critique: 2 }, level: 1,
    equipSlot: "weapon", icon: "🔫", color: "#aaaaaa", iconFile: "tex_tools_08",
    value: 30, weight: 2, category: "equipment",
  },
  plasma_blade: {
    id: "plasma_blade", label: "Lame Plasma", type: "weapon",
    rarity: "rare", description: "Lame incandescente qui traverse les armures.",
    gridW: 2, gridH: 3, stackable: false, maxStack: 1,
    stats: { attackPower: 12, puissance: 8, critique: 3 }, level: 5,
    equipSlot: "weapon", icon: "🗡️", color: "#4a9eff", iconFile: "tex_gemstone_10",
    value: 120, weight: 2.5, category: "equipment",
  },
  void_saber: {
    id: "void_saber", label: "Sabre du Vide", type: "weapon",
    rarity: "legendary", description: "Lame tissée dans le vide spatial.",
    gridW: 2, gridH: 3, stackable: false, maxStack: 1,
    stats: { attackPower: 38, puissance: 25, critique: 6 }, level: 15,
    equipSlot: "weapon", icon: "⚔️", color: "#c084fc", iconFile: "tex_gemstone_07",
    value: 700, weight: 2, category: "equipment",
  },
  plasma_shield: {
    id: "plasma_shield", label: "Bouclier Plasma", type: "weapon",
    rarity: "epic", description: "Champ plasma déflecteur.",
    gridW: 2, gridH: 3, stackable: false, maxStack: 1,
    stats: { defense: 18, maxHp: 25 }, level: 10,
    equipSlot: "offhand", icon: "🛡️", color: "#a855f7", iconFile: "tex_spare_parts_05",
    value: 200, weight: 3, category: "equipment",
  },

  // ── ARMURES ───────────────────────────────────────────────────────────────
  cyber_armor: {
    id: "cyber_armor", label: "Armure Cybernétique", type: "armor",
    rarity: "epic", description: "Exosquelette à fibres neuromusculaires.",
    gridW: 3, gridH: 3, stackable: false, maxStack: 1,
    stats: { defense: 20, maxHp: 30 }, level: 8,
    equipSlot: "armor", icon: "🛡️", color: "#a855f7", iconFile: "tex_spare_parts_02",
    value: 300, weight: 8, category: "equipment",
  },
  combat_helmet: {
    id: "combat_helmet", label: "Casque de Combat", type: "helmet",
    rarity: "rare", description: "Casque tactique avec visière HUD.",
    gridW: 2, gridH: 2, stackable: false, maxStack: 1,
    stats: { defense: 8, maxHp: 15 }, level: 3,
    equipSlot: "helmet", icon: "⛑️", color: "#4a9eff", iconFile: "tex_spare_parts_03",
    value: 90, weight: 2, category: "equipment",
  },
  combat_gloves: {
    id: "combat_gloves", label: "Gantelets de Combat", type: "armor",
    rarity: "rare", description: "Gantelets renforcés en nanofibres.",
    gridW: 2, gridH: 1, stackable: false, maxStack: 1,
    stats: { puissance: 6, critique: 3 }, level: 3,
    icon: "🧤", color: "#4a9eff", iconFile: "tex_leather_11",
    value: 80, weight: 1.5, category: "equipment",
  },
  combat_boots: {
    id: "combat_boots", label: "Bottes de Combat", type: "boots",
    rarity: "common", description: "Bottes tactiques à semelles renforcées.",
    gridW: 2, gridH: 1, stackable: false, maxStack: 1,
    stats: { defense: 4, vitesse: 5 }, level: 1,
    equipSlot: "legs", icon: "🥾", color: "#aaaaaa", iconFile: "tex_leather_09",
    value: 45, weight: 2, category: "equipment",
  },
  tactical_cape: {
    id: "tactical_cape", label: "Cape Tactique", type: "armor",
    rarity: "epic", description: "Cape furtive en matière synthétique.",
    gridW: 2, gridH: 3, stackable: false, maxStack: 1,
    stats: { defense: 8, maxMana: 20 }, level: 7,
    icon: "🧥", color: "#a855f7", iconFile: "tex_cloth_11",
    value: 160, weight: 1, category: "equipment",
  },

  // ── ACCESSOIRES ───────────────────────────────────────────────────────────
  void_amulet: {
    id: "void_amulet", label: "Amulette du Vide", type: "accessory",
    rarity: "epic", description: "Pierre du vide qui amplifie l'énergie.",
    gridW: 1, gridH: 1, stackable: false, maxStack: 1,
    stats: { maxMana: 30, puissance: 8 }, level: 8,
    equipSlot: "accessory", icon: "📿", color: "#a855f7", iconFile: "tex_gemstone_02",
    value: 220, weight: 0.5, category: "equipment",
  },
  power_ring: {
    id: "power_ring", label: "Anneau de Puissance", type: "accessory",
    rarity: "rare", description: "Bague qui confère une force accrue.",
    gridW: 1, gridH: 1, stackable: false, maxStack: 1,
    stats: { puissance: 7 }, level: 4,
    equipSlot: "accessory", icon: "💍", color: "#4a9eff", iconFile: "tex_gemstone_01",
    value: 110, weight: 0.2, category: "equipment",
  },
  ward_ring: {
    id: "ward_ring", label: "Anneau de Protection", type: "accessory",
    rarity: "rare", description: "Bague protectrice en acier lunaire.",
    gridW: 1, gridH: 1, stackable: false, maxStack: 1,
    stats: { defense: 7, maxHp: 10 }, level: 4,
    equipSlot: "accessory", icon: "💍", color: "#4a9eff", iconFile: "tex_gemstone_04",
    value: 110, weight: 0.2, category: "equipment",
  },

  // ── CONSOMMABLES ──────────────────────────────────────────────────────────
  potion_soin_mineure: {
    id: "potion_soin_mineure", label: "Potion de Soin Mineure", type: "consumable",
    rarity: "common", description: "Restaure 40 PV.",
    gridW: 1, gridH: 1, stackable: true, maxStack: 10,
    stats: {}, level: 1,
    icon: "🧪", color: "#aaaaaa", iconFile: "tex_reagent_12",
    value: 25, weight: 0.3, category: "consumable",
    useEffect: { heal: 40, description: "Restaure 40 PV" },
  },
  potion_soin_majeure: {
    id: "potion_soin_majeure", label: "Potion de Soin Majeure", type: "consumable",
    rarity: "rare", description: "Restaure 120 PV.",
    gridW: 1, gridH: 1, stackable: true, maxStack: 10,
    stats: {}, level: 5,
    icon: "🩸", color: "#4a9eff", iconFile: "tex_reagent_10",
    value: 80, weight: 0.3, category: "consumable",
    useEffect: { heal: 120, description: "Restaure 120 PV" },
  },
  potion_mana_mineure: {
    id: "potion_mana_mineure", label: "Potion de Mana Mineure", type: "consumable",
    rarity: "common", description: "Restaure 40 Mana.",
    gridW: 1, gridH: 1, stackable: true, maxStack: 10,
    stats: {}, level: 1,
    icon: "💧", color: "#aaaaaa", iconFile: "tex_container_08",
    value: 25, weight: 0.3, category: "consumable",
    useEffect: { mana: 40, description: "Restaure 40 Mana" },
  },

  // ── RESSOURCES / MATÉRIAUX ───────────────────────────────────────────────
  fragment_vie: {
    id: "fragment_vie", label: "Fragment de Vie", type: "material",
    rarity: "common", description: "Fragment d'énergie vitale cristallisée.",
    gridW: 1, gridH: 1, stackable: true, maxStack: 99,
    stats: {}, level: 1,
    icon: "💚", color: "#aaaaaa", iconFile: "tex_gemstone_08",
    value: 5, weight: 0.1, category: "material",
  },
  cristal_energie: {
    id: "cristal_energie", label: "Cristal d'Énergie", type: "material",
    rarity: "common", description: "Cristal d'énergie brute.",
    gridW: 1, gridH: 1, stackable: true, maxStack: 99,
    stats: {}, level: 1,
    icon: "💠", color: "#aaaaaa", iconFile: "tex_gemstone_11",
    value: 8, weight: 0.2, category: "material",
  },
  metal_rare: {
    id: "metal_rare", label: "Métal Rare", type: "material",
    rarity: "rare", description: "Alliage extraterrestre ultra-résistant.",
    gridW: 1, gridH: 1, stackable: true, maxStack: 50,
    stats: {}, level: 3,
    icon: "⚙️", color: "#4a9eff", iconFile: "tex_ingots_03",
    value: 60, weight: 1, category: "material",
  },
  adn_alien: {
    id: "adn_alien", label: "ADN Alien", type: "material",
    rarity: "rare", description: "Séquence génétique d'origine inconnue.",
    gridW: 1, gridH: 1, stackable: true, maxStack: 50,
    stats: {}, level: 3,
    icon: "🧬", color: "#4a9eff", iconFile: "tex_reagent_01",
    value: 50, weight: 0.5, category: "material",
  },
  noyau_plasma: {
    id: "noyau_plasma", label: "Noyau Plasma", type: "material",
    rarity: "epic", description: "Cœur énergétique instable et puissant.",
    gridW: 1, gridH: 1, stackable: true, maxStack: 25,
    stats: {}, level: 8,
    icon: "🔥", color: "#a855f7", iconFile: "tex_gemstone_09",
    value: 200, weight: 2, category: "material",
  },
  powernax: {
    id: "powernax", label: "POWERNAX", type: "resource",
    rarity: "legendary", description: "Amplificateur de puissance légendaire.",
    gridW: 1, gridH: 1, stackable: true, maxStack: 10,
    stats: {}, level: 12,
    icon: "⚡", color: "#f59e0b", iconFile: "tex_spare_parts_01",
    value: 800, weight: 1, category: "resource",
  },

  // ── MUNITIONS (stackables) ────────────────────────────────────────────────
  ammo_arrows: {
    id: "ammo_arrows", label: "Flèches", type: "ammo",
    rarity: "common", description: "Munitions pour arc.",
    gridW: 1, gridH: 1, stackable: true, maxStack: 999,
    stats: {}, level: 1,
    icon: "🏹", color: "#aaaaaa", iconFile: "tex_strings_01",
    value: 1, weight: 0.05, category: "ammo",
  },
  ammo_cells: {
    id: "ammo_cells", label: "Cellules d'Énergie", type: "ammo",
    rarity: "common", description: "Chargeurs pour armes énergétiques.",
    gridW: 1, gridH: 1, stackable: true, maxStack: 999,
    stats: {}, level: 1,
    icon: "🔋", color: "#aaaaaa", iconFile: "tex_spare_parts_10",
    value: 1, weight: 0.05, category: "ammo",
  },

  // ── QUÊTE ─────────────────────────────────────────────────────────────────
  key_donjon_furiste: {
    id: "key_donjon_furiste", label: "Clé du Donjon Furiste", type: "quest",
    rarity: "rare", description: "Clé ouvrant l'accès au Donjon Furiste.",
    gridW: 1, gridH: 1, stackable: false, maxStack: 1,
    stats: {}, level: 1,
    icon: "🗝️", color: "#4a9eff", iconFile: "tex_bone_01",
    value: 0, weight: 0.1, category: "quest",
  },

// ── ── FUSION C — ressources récoltables + sorties de craft ── ──
  bois_use: {
    id: "bois_use", label: "Bois usé", type: "material",
    rarity: "common", description: "Ressource / objet de craft NARVOS (fusion C).",
    gridW: 1, gridH: 1, stackable: true, maxStack: 50,
    stats: {}, level: 1,
    icon: "🪓", color: "#aaaaaa", iconFile: "tex_wood_01",
    value: 2, weight: 0.2, category: "material",
  },
  chene_solide: {
    id: "chene_solide", label: "Chêne solide", type: "material",
    rarity: "common", description: "Ressource / objet de craft NARVOS (fusion C).",
    gridW: 1, gridH: 1, stackable: true, maxStack: 50,
    stats: {}, level: 1,
    icon: "🪓", color: "#aaaaaa", iconFile: "tex_wood_08",
    value: 8, weight: 0.2, category: "material",
  },
  bois_ancien: {
    id: "bois_ancien", label: "Bois ancien", type: "material",
    rarity: "rare", description: "Ressource / objet de craft NARVOS (fusion C).",
    gridW: 1, gridH: 1, stackable: true, maxStack: 50,
    stats: {}, level: 1,
    icon: "🪓", color: "#4a9eff", iconFile: "tex_wood_05",
    value: 20, weight: 0.2, category: "material",
  },
  bois_spectral: {
    id: "bois_spectral", label: "Bois spectral", type: "material",
    rarity: "epic", description: "Ressource / objet de craft NARVOS (fusion C).",
    gridW: 1, gridH: 1, stackable: true, maxStack: 50,
    stats: {}, level: 1,
    icon: "🪓", color: "#a855f7", iconFile: "tex_wood_09",
    value: 55, weight: 0.2, category: "material",
  },
  bois_lunaire: {
    id: "bois_lunaire", label: "Bois lunaire", type: "material",
    rarity: "epic", description: "Ressource / objet de craft NARVOS (fusion C).",
    gridW: 1, gridH: 1, stackable: true, maxStack: 50,
    stats: {}, level: 1,
    icon: "🪓", color: "#a855f7", iconFile: "tex_wood_03",
    value: 130, weight: 0.2, category: "material",
  },
  bois_legendaire: {
    id: "bois_legendaire", label: "Bois légendaire", type: "material",
    rarity: "legendary", description: "Ressource / objet de craft NARVOS (fusion C).",
    gridW: 1, gridH: 1, stackable: true, maxStack: 50,
    stats: {}, level: 1,
    icon: "🪓", color: "#f59e0b", iconFile: "tex_wood_12",
    value: 320, weight: 0.2, category: "material",
  },
  pierre_fragile: {
    id: "pierre_fragile", label: "Pierre fragile", type: "material",
    rarity: "common", description: "Ressource / objet de craft NARVOS (fusion C).",
    gridW: 1, gridH: 1, stackable: true, maxStack: 50,
    stats: {}, level: 1,
    icon: "⛏️", color: "#aaaaaa", iconFile: "tex_stone_01",
    value: 2, weight: 0.2, category: "material",
  },
  fer: {
    id: "fer", label: "Fer", type: "material",
    rarity: "common", description: "Ressource / objet de craft NARVOS (fusion C).",
    gridW: 1, gridH: 1, stackable: true, maxStack: 50,
    stats: {}, level: 1,
    icon: "⛏️", color: "#aaaaaa", iconFile: "tex_ingots_06",
    value: 9, weight: 0.2, category: "material",
  },
  acier: {
    id: "acier", label: "Acier", type: "material",
    rarity: "rare", description: "Ressource / objet de craft NARVOS (fusion C).",
    gridW: 1, gridH: 1, stackable: true, maxStack: 50,
    stats: {}, level: 1,
    icon: "⛏️", color: "#4a9eff", iconFile: "tex_ingots_04",
    value: 24, weight: 0.2, category: "material",
  },
  cristal_magique: {
    id: "cristal_magique", label: "Cristal magique", type: "material",
    rarity: "epic", description: "Ressource / objet de craft NARVOS (fusion C).",
    gridW: 1, gridH: 1, stackable: true, maxStack: 50,
    stats: {}, level: 1,
    icon: "⛏️", color: "#a855f7", iconFile: "tex_stone_06",
    value: 60, weight: 0.2, category: "material",
  },
  minerai_lunaire: {
    id: "minerai_lunaire", label: "Minerai lunaire", type: "material",
    rarity: "epic", description: "Ressource / objet de craft NARVOS (fusion C).",
    gridW: 1, gridH: 1, stackable: true, maxStack: 50,
    stats: {}, level: 1,
    icon: "⛏️", color: "#a855f7", iconFile: "tex_stone_09",
    value: 140, weight: 0.2, category: "material",
  },
  adamantite: {
    id: "adamantite", label: "Adamantite", type: "material",
    rarity: "legendary", description: "Ressource / objet de craft NARVOS (fusion C).",
    gridW: 1, gridH: 1, stackable: true, maxStack: 50,
    stats: {}, level: 1,
    icon: "⛏️", color: "#f59e0b", iconFile: "tex_ingots_12",
    value: 340, weight: 0.2, category: "material",
  },
  herbe_commune: {
    id: "herbe_commune", label: "Herbe commune", type: "material",
    rarity: "common", description: "Ressource / objet de craft NARVOS (fusion C).",
    gridW: 1, gridH: 1, stackable: true, maxStack: 50,
    stats: {}, level: 1,
    icon: "🌿", color: "#aaaaaa", iconFile: "tex_herbs_04",
    value: 2, weight: 0.2, category: "material",
  },
  racine_robuste: {
    id: "racine_robuste", label: "Racine robuste", type: "material",
    rarity: "common", description: "Ressource / objet de craft NARVOS (fusion C).",
    gridW: 1, gridH: 1, stackable: true, maxStack: 50,
    stats: {}, level: 1,
    icon: "🌿", color: "#aaaaaa", iconFile: "tex_seeds_04",
    value: 7, weight: 0.2, category: "material",
  },
  fleur_de_givre: {
    id: "fleur_de_givre", label: "Fleur de givre", type: "material",
    rarity: "rare", description: "Ressource / objet de craft NARVOS (fusion C).",
    gridW: 1, gridH: 1, stackable: true, maxStack: 50,
    stats: {}, level: 1,
    icon: "🌿", color: "#4a9eff", iconFile: "tex_herbs_01",
    value: 22, weight: 0.2, category: "material",
  },
  lichen_arcanique: {
    id: "lichen_arcanique", label: "Lichen arcanique", type: "material",
    rarity: "epic", description: "Ressource / objet de craft NARVOS (fusion C).",
    gridW: 1, gridH: 1, stackable: true, maxStack: 50,
    stats: {}, level: 1,
    icon: "🌿", color: "#a855f7", iconFile: "tex_mushrooms_10",
    value: 58, weight: 0.2, category: "material",
  },
  essence_lunaire: {
    id: "essence_lunaire", label: "Essence lunaire", type: "material",
    rarity: "epic", description: "Ressource / objet de craft NARVOS (fusion C).",
    gridW: 1, gridH: 1, stackable: true, maxStack: 50,
    stats: {}, level: 1,
    icon: "🌿", color: "#a855f7", iconFile: "tex_reagent_08",
    value: 135, weight: 0.2, category: "material",
  },
  fleur_eternelle: {
    id: "fleur_eternelle", label: "Fleur éternelle", type: "material",
    rarity: "legendary", description: "Ressource / objet de craft NARVOS (fusion C).",
    gridW: 1, gridH: 1, stackable: true, maxStack: 50,
    stats: {}, level: 1,
    icon: "🌿", color: "#f59e0b", iconFile: "tex_herbs_09",
    value: 330, weight: 0.2, category: "material",
  },

  dague_fer: {
    id: "dague_fer", label: "Dague de fer", type: "weapon",
    rarity: "common", description: "Ressource / objet de craft NARVOS (fusion C).",
    gridW: 1, gridH: 1, stackable: true, maxStack: 1,
    stats: {}, level: 1,
    icon: "🗡️", color: "#aaaaaa", iconFile: "tex_tools_05",
    value: 18, weight: 2.5, category: "equipment",
  },
  epee_acier: {
    id: "epee_acier", label: "Épée d'acier", type: "weapon",
    rarity: "common", description: "Ressource / objet de craft NARVOS (fusion C).",
    gridW: 1, gridH: 1, stackable: true, maxStack: 1,
    stats: {}, level: 1,
    icon: "🗡️", color: "#aaaaaa", iconFile: "tex_stone_10",
    value: 65, weight: 2.5, category: "equipment",
  },
  hache_raffinee: {
    id: "hache_raffinee", label: "Hache raffinée", type: "weapon",
    rarity: "rare", description: "Ressource / objet de craft NARVOS (fusion C).",
    gridW: 1, gridH: 1, stackable: true, maxStack: 1,
    stats: {}, level: 1,
    icon: "🗡️", color: "#4a9eff", iconFile: "tex_tools_10",
    value: 150, weight: 2.5, category: "equipment",
  },
  lame_magique: {
    id: "lame_magique", label: "Lame magique", type: "weapon",
    rarity: "epic", description: "Ressource / objet de craft NARVOS (fusion C).",
    gridW: 1, gridH: 1, stackable: true, maxStack: 1,
    stats: {}, level: 1,
    icon: "🗡️", color: "#a855f7", iconFile: "tex_gemstone_05",
    value: 340, weight: 2.5, category: "equipment",
  },
  egide_lunaire: {
    id: "egide_lunaire", label: "Égide lunaire", type: "weapon",
    rarity: "epic", description: "Ressource / objet de craft NARVOS (fusion C).",
    gridW: 1, gridH: 1, stackable: true, maxStack: 1,
    stats: {}, level: 1,
    icon: "🗡️", color: "#a855f7", iconFile: "tex_spare_parts_08",
    value: 740, weight: 2.5, category: "equipment",
  },
  lame_adamantite: {
    id: "lame_adamantite", label: "Lame d'adamantite", type: "weapon",
    rarity: "legendary", description: "Ressource / objet de craft NARVOS (fusion C).",
    gridW: 1, gridH: 1, stackable: true, maxStack: 1,
    stats: {}, level: 1,
    icon: "🗡️", color: "#f59e0b", iconFile: "tex_stone_12",
    value: 1650, weight: 2.5, category: "equipment",
  },
  potion_soin_min: {
    id: "potion_soin_min", label: "Potion de soin mineure", type: "consumable",
    rarity: "common", description: "Ressource / objet de craft NARVOS (fusion C).",
    gridW: 1, gridH: 1, stackable: true, maxStack: 50,
    stats: {}, level: 1,
    icon: "🧪", color: "#aaaaaa", iconFile: "tex_container_12",
    value: 14, weight: 0.3, category: "consumable",
  },
  elixir_vigueur: {
    id: "elixir_vigueur", label: "Élixir de vigueur", type: "consumable",
    rarity: "common", description: "Ressource / objet de craft NARVOS (fusion C).",
    gridW: 1, gridH: 1, stackable: true, maxStack: 50,
    stats: {}, level: 1,
    icon: "🧪", color: "#aaaaaa", iconFile: "tex_reagent_06",
    value: 50, weight: 0.3, category: "consumable",
  },
  philtre_givre: {
    id: "philtre_givre", label: "Philtre de givre", type: "consumable",
    rarity: "rare", description: "Ressource / objet de craft NARVOS (fusion C).",
    gridW: 1, gridH: 1, stackable: true, maxStack: 50,
    stats: {}, level: 1,
    icon: "🧪", color: "#4a9eff", iconFile: "tex_reagent_05",
    value: 125, weight: 0.3, category: "consumable",
  },
  decoction_arcanique: {
    id: "decoction_arcanique", label: "Décoction arcanique", type: "consumable",
    rarity: "epic", description: "Ressource / objet de craft NARVOS (fusion C).",
    gridW: 1, gridH: 1, stackable: true, maxStack: 50,
    stats: {}, level: 1,
    icon: "🧪", color: "#a855f7", iconFile: "tex_reagent_07",
    value: 300, weight: 0.3, category: "consumable",
  },
  essence_concentree: {
    id: "essence_concentree", label: "Essence concentrée", type: "consumable",
    rarity: "epic", description: "Ressource / objet de craft NARVOS (fusion C).",
    gridW: 1, gridH: 1, stackable: true, maxStack: 50,
    stats: {}, level: 1,
    icon: "🧪", color: "#a855f7", iconFile: "tex_reagent_02",
    value: 690, weight: 0.3, category: "consumable",
  },
  panacee_eternelle: {
    id: "panacee_eternelle", label: "Panacée éternelle", type: "consumable",
    rarity: "legendary", description: "Ressource / objet de craft NARVOS (fusion C).",
    gridW: 1, gridH: 1, stackable: true, maxStack: 50,
    stats: {}, level: 1,
    icon: "🧪", color: "#f59e0b", iconFile: "tex_container_10",
    value: 1550, weight: 0.3, category: "consumable",
  },
  anneau_fer: {
    id: "anneau_fer", label: "Anneau de fer", type: "accessory",
    rarity: "common", description: "Ressource / objet de craft NARVOS (fusion C).",
    gridW: 1, gridH: 1, stackable: true, maxStack: 50,
    stats: {}, level: 1,
    icon: "💍", color: "#aaaaaa", iconFile: "tex_spare_parts_11",
    value: 16, weight: 0.3, category: "equipment", equipSlot: "accessory",
  },
  pendentif_acier: {
    id: "pendentif_acier", label: "Pendentif d'acier", type: "accessory",
    rarity: "common", description: "Ressource / objet de craft NARVOS (fusion C).",
    gridW: 1, gridH: 1, stackable: true, maxStack: 50,
    stats: {}, level: 1,
    icon: "💍", color: "#aaaaaa", iconFile: "tex_gemstone_12",
    value: 54, weight: 0.3, category: "equipment", equipSlot: "accessory",
  },
  bague_givre: {
    id: "bague_givre", label: "Bague de givre", type: "accessory",
    rarity: "rare", description: "Ressource / objet de craft NARVOS (fusion C).",
    gridW: 1, gridH: 1, stackable: true, maxStack: 50,
    stats: {}, level: 1,
    icon: "💍", color: "#4a9eff", iconFile: "tex_gemstone_03",
    value: 135, weight: 0.3, category: "equipment", equipSlot: "accessory",
  },
  talisman_magique: {
    id: "talisman_magique", label: "Talisman magique", type: "accessory",
    rarity: "epic", description: "Ressource / objet de craft NARVOS (fusion C).",
    gridW: 1, gridH: 1, stackable: true, maxStack: 50,
    stats: {}, level: 1,
    icon: "💍", color: "#a855f7", iconFile: "tex_spare_parts_04",
    value: 310, weight: 0.3, category: "equipment", equipSlot: "accessory",
  },
  diademe_lunaire: {
    id: "diademe_lunaire", label: "Diadème lunaire", type: "accessory",
    rarity: "epic", description: "Ressource / objet de craft NARVOS (fusion C).",
    gridW: 1, gridH: 1, stackable: true, maxStack: 50,
    stats: {}, level: 1,
    icon: "💍", color: "#a855f7", iconFile: "tex_gemstone_06",
    value: 710, weight: 0.3, category: "equipment", equipSlot: "accessory",
  },
  couronne_eternelle: {
    id: "couronne_eternelle", label: "Couronne éternelle", type: "accessory",
    rarity: "legendary", description: "Ressource / objet de craft NARVOS (fusion C).",
    gridW: 1, gridH: 1, stackable: true, maxStack: 50,
    stats: {}, level: 1,
    icon: "💍", color: "#f59e0b", iconFile: "tex_spare_parts_09",
    value: 1560, weight: 0.3, category: "equipment", equipSlot: "accessory",
  },
  // ── OUTILS DE COLLECTE ─ référencés par Catalogs/Gisements.lua (champ outil) ──
  // Le serveur les détecte dans l'inventaire pour Recolte.Peut (il te faut une pioche).
  pioche: { id: "pioche", label: "Pioche", type: "material", rarity: "common",
    description: "Outil de mineur : récolte les filons et cristaux.",
    gridW: 1, gridH: 1, stackable: false, maxStack: 1, stats: {}, level: 1,
    icon: "⛏️", iconFile: "tex_tools_07", color: "#aaaaaa", value: 10, weight: 1.5, category: "material" },
  foreuse: { id: "foreuse", label: "Foreuse", type: "material", rarity: "rare",
    description: "Outil de minage : récolte les gisements profonds.",
    gridW: 1, gridH: 1, stackable: false, maxStack: 1, stats: {}, level: 1,
    icon: "🛠️", iconFile: "tex_spare_parts_07", color: "#4a9eff", value: 25, weight: 2.5, category: "material" },
  collecteur: { id: "collecteur", label: "Collecteur", type: "material", rarity: "common",
    description: "Outil de récolte : cueille les herbes et les plantes.",
    gridW: 1, gridH: 1, stackable: false, maxStack: 1, stats: {}, level: 1,
    icon: "🌿", iconFile: "tex_tools_06", color: "#aaaaaa", value: 8, weight: 0.5, category: "material" },

  // ── OBJETS DE SYSTÈME ─ détectés dans le sac par un exécutant serveur nanos ──
  // `menottes` : Logic/Menottes.lua exige que l'agent PORTE l'objet
  // (`exige_menottes`), et Server/Menottes.lua le compte dans le sac — même
  // mécanique que les outils de collecte ci-dessus, d'où le même type.
  // Aucun marchand ne le vend encore : c'est une décision d'économie.
  menottes: { id: "menottes", label: "Menottes", type: "material", rarity: "common",
    description: "Paire de menottes en acier : immobilise les mains d'une cible à portée.",
    gridW: 1, gridH: 1, stackable: false, maxStack: 1, stats: {}, level: 1,
    icon: "⛓️", color: "#aaaaaa", value: 40, weight: 0.4, category: "material" },
  // Les trois objets de `asset_game/a_trier/` (GLB Sketchfab retaillés le
  // 2026-09-10), branchés le 2026-09-13 sur demande de Hanibes :
  //   talkie_walkie → Logic/Radio.lua      (commande /radio, canaux)
  //   smartphone    → Logic/Telephone.lua  (carte, messages, contacts)
  //   digicode      → Logic/Digicode.lua   (porte à code posée dans une zone)
  talkie_walkie: { id: "talkie_walkie", label: "Talkie-walkie", type: "material", rarity: "common",
    description: "Radio portative : parle et écoute sur un canal (/radio), à toute distance.",
    gridW: 1, gridH: 2, stackable: false, maxStack: 1, stats: {}, level: 1,
    icon: "📻", color: "#aaaaaa", value: 60, weight: 0.5, category: "material" },
  smartphone: { id: "smartphone", label: "Smartphone", type: "material", rarity: "common",
    description: "Téléphone : carte, messages privés et contacts des joueurs connectés.",
    gridW: 1, gridH: 1, stackable: false, maxStack: 1, stats: {}, level: 1,
    icon: "📱", color: "#aaaaaa", value: 120, weight: 0.2, category: "material" },
  digicode: { id: "digicode", label: "Digicode", type: "material", rarity: "rare",
    description: "Clavier de porte à code, à poser dans une zone où l'on a le droit de construire.",
    gridW: 1, gridH: 1, stackable: true, maxStack: 5, stats: {}, level: 1,
    icon: "🔢", color: "#4a9eff", value: 250, weight: 0.8, category: "material" },

  // ── PIÈCES DE VÉHICULE — consommées par les plans d'assemblage (Catalogs/Plans.lua) ──
  // Chantier assemblage 2026-09-10. AUCUNE de ces pièces ne nomme un mesh : les
  // seules pièces détachées du dépôt (Sci-Fi Modular Hover Vehicles, docs/
  // AUDIT_A_TRIER_LOT3.md) sont NON cuites — leur donner un modelPath serait
  // une référence morte. Icônes choisies à vue sur docs/planche_icones_craft.png,
  // approximations signalées (le pack n'a ni roue ni moteur littéraux).
  piece_roue: { id: "piece_roue", label: "Roue de véhicule", type: "piece", rarity: "common",
    description: "Roue complète, prête à monter. Il en faut quatre.",
    gridW: 2, gridH: 2, stackable: true, maxStack: 8, stats: {}, level: 1,
    icon: "🛞", iconFile: "tex_strings_02", color: "#aaaaaa", value: 45, weight: 12, category: "vehicule" },
  piece_moteur: { id: "piece_moteur", label: "Moteur de véhicule", type: "piece", rarity: "rare",
    description: "Bloc moteur thermique, testé au banc.",
    gridW: 3, gridH: 2, stackable: false, maxStack: 1, stats: {}, level: 1,
    icon: "🔧", iconFile: "tex_spare_parts_12", color: "#4a9eff", value: 260, weight: 80, category: "vehicule" },
  piece_carrosserie: { id: "piece_carrosserie", label: "Carrosserie de véhicule", type: "piece", rarity: "rare",
    description: "Coque nue d'un véhicule, tous modèles confondus.",
    gridW: 4, gridH: 3, stackable: false, maxStack: 1, stats: {}, level: 1,
    icon: "🚗", iconFile: "tex_container_06", color: "#4a9eff", value: 420, weight: 250, category: "vehicule" },
  piece_plaque: { id: "piece_plaque", label: "Plaque d'immatriculation", type: "piece", rarity: "common",
    description: "Plaque réglementaire. Facultative à l'assemblage, obligatoire en ville.",
    gridW: 2, gridH: 1, stackable: true, maxStack: 5, stats: {}, level: 1,
    icon: "🪪", iconFile: "tex_ingots_05", color: "#aaaaaa", value: 15, weight: 1, category: "vehicule" },

  // ── VÉHICULES ASSEMBLÉS — le RÉSULTAT des plans véhicules ──
  // Un item « titre de propriété » façon caisse (cf. docs/ASSEMBLAGE_MODELE_20260910.md
  // §4.2) : l'exécutant serveur l'échangera contre le spawn du modèle
  // correspondant de VOITURES_NANOS (même suffixe d'id : vehicule_<id voiture>).
  // Icônes : la famille tex_recipes (plans/blueprints) — aucune n'était utilisée,
  // et l'item EST le plan du véhicule fini. Douze icônes distinctes, une par modèle.
  vehicule_executive_sedan: { id: "vehicule_executive_sedan", label: "Berline Exécutive (assemblée)", type: "vehicle", rarity: "rare",
    description: "Véhicule assemblé — à échanger contre la clé du modèle.",
    gridW: 4, gridH: 3, stackable: false, maxStack: 1, stats: {}, level: 1,
    icon: "🚗", iconFile: "tex_recipes_01", color: "#4a9eff", value: 1500, weight: 1200, category: "vehicule" },
  vehicule_luxury_car: { id: "vehicule_luxury_car", label: "Voiture de Luxe (assemblée)", type: "vehicle", rarity: "rare",
    description: "Véhicule assemblé — à échanger contre la clé du modèle.",
    gridW: 4, gridH: 3, stackable: false, maxStack: 1, stats: {}, level: 1,
    icon: "🚗", iconFile: "tex_recipes_02", color: "#4a9eff", value: 1500, weight: 1200, category: "vehicule" },
  vehicule_sport_wagon: { id: "vehicule_sport_wagon", label: "Break Sport (assemblé)", type: "vehicle", rarity: "rare",
    description: "Véhicule assemblé — à échanger contre la clé du modèle.",
    gridW: 4, gridH: 3, stackable: false, maxStack: 1, stats: {}, level: 1,
    icon: "🚗", iconFile: "tex_recipes_03", color: "#4a9eff", value: 1500, weight: 1200, category: "vehicule" },
  vehicule_station_wagon: { id: "vehicule_station_wagon", label: "Break Familial (assemblé)", type: "vehicle", rarity: "rare",
    description: "Véhicule assemblé — à échanger contre la clé du modèle.",
    gridW: 4, gridH: 3, stackable: false, maxStack: 1, stats: {}, level: 1,
    icon: "🚗", iconFile: "tex_recipes_04", color: "#4a9eff", value: 1500, weight: 1200, category: "vehicule" },
  vehicule_family_hatchback: { id: "vehicule_family_hatchback", label: "Compacte Familiale (assemblée)", type: "vehicle", rarity: "rare",
    description: "Véhicule assemblé — à échanger contre la clé du modèle.",
    gridW: 4, gridH: 3, stackable: false, maxStack: 1, stats: {}, level: 1,
    icon: "🚗", iconFile: "tex_recipes_05", color: "#4a9eff", value: 1500, weight: 1200, category: "vehicule" },
  vehicule_hatchback1: { id: "vehicule_hatchback1", label: "Hatchback (assemblée)", type: "vehicle", rarity: "rare",
    description: "Véhicule assemblé — à échanger contre la clé du modèle.",
    gridW: 4, gridH: 3, stackable: false, maxStack: 1, stats: {}, level: 1,
    icon: "🚗", iconFile: "tex_recipes_06", color: "#4a9eff", value: 1500, weight: 1200, category: "vehicule" },
  vehicule_sporty_compact_hatchback: { id: "vehicule_sporty_compact_hatchback", label: "Compacte Sportive (assemblée)", type: "vehicle", rarity: "rare",
    description: "Véhicule assemblé — à échanger contre la clé du modèle.",
    gridW: 4, gridH: 3, stackable: false, maxStack: 1, stats: {}, level: 1,
    icon: "🏎️", iconFile: "tex_recipes_07", color: "#4a9eff", value: 1500, weight: 1200, category: "vehicule" },
  vehicule_compact_crossover: { id: "vehicule_compact_crossover", label: "Crossover Compact (assemblé)", type: "vehicle", rarity: "rare",
    description: "Véhicule assemblé — à échanger contre la clé du modèle.",
    gridW: 4, gridH: 3, stackable: false, maxStack: 1, stats: {}, level: 1,
    icon: "🚙", iconFile: "tex_recipes_08", color: "#4a9eff", value: 1500, weight: 1200, category: "vehicule" },
  vehicule_fullsize_suv: { id: "vehicule_fullsize_suv", label: "SUV Grand Format (assemblé)", type: "vehicle", rarity: "rare",
    description: "Véhicule assemblé — à échanger contre la clé du modèle.",
    gridW: 4, gridH: 3, stackable: false, maxStack: 1, stats: {}, level: 1,
    icon: "🚙", iconFile: "tex_recipes_09", color: "#4a9eff", value: 1500, weight: 1200, category: "vehicule" },
  vehicule_minivan: { id: "vehicule_minivan", label: "Minivan (assemblé)", type: "vehicle", rarity: "rare",
    description: "Véhicule assemblé — à échanger contre la clé du modèle.",
    gridW: 4, gridH: 3, stackable: false, maxStack: 1, stats: {}, level: 1,
    icon: "🚐", iconFile: "tex_recipes_10", color: "#4a9eff", value: 1500, weight: 1200, category: "vehicule" },
  vehicule_compact_panel_van: { id: "vehicule_compact_panel_van", label: "Fourgonnette Compacte (assemblée)", type: "vehicle", rarity: "rare",
    description: "Véhicule assemblé — à échanger contre la clé du modèle.",
    gridW: 4, gridH: 3, stackable: false, maxStack: 1, stats: {}, level: 1,
    icon: "🚐", iconFile: "tex_recipes_11", color: "#4a9eff", value: 1500, weight: 1200, category: "vehicule" },
  vehicule_pickup: { id: "vehicule_pickup", label: "Pickup (assemblé)", type: "vehicle", rarity: "rare",
    description: "Véhicule assemblé — à échanger contre la clé du modèle.",
    gridW: 4, gridH: 3, stackable: false, maxStack: 1, stats: {}, level: 1,
    icon: "🛻", iconFile: "tex_recipes_12", color: "#4a9eff", value: 1500, weight: 1200, category: "vehicule" },
};

/**
 * Récupère une définition par son id.
 */
export function getItemDef(id: string): ItemDefinition | undefined {
  return ITEM_DB[id];
}

/**
 * Filtre les items par type.
 */
export function getItemsByType(type: string): ItemDefinition[] {
  return Object.values(ITEM_DB).filter((item) => item.type === type);
}

/**
 * Filtre les items par rareté.
 */
export function getItemsByRarity(rarity: string): ItemDefinition[] {
  return Object.values(ITEM_DB).filter((item) => item.rarity === rarity);
}
