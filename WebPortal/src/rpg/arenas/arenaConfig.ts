// ══════════════════════════════════════════════════════════════════════════════
// arenas/arenaConfig.ts — Configurations des 3 arènes de combat
//
// Source de vérité des données tactiques pour chaque arène. Ces configurations
// sont seedées dans les stores au premier chargement ou à la réinitialisation.
//
// Arènes :
//   1. Donjon Furiste — La Fosse aux Meutes (boss fight)
//   2. Fungaria — Le Coeur de la Colonie (expédition)
//   3. Orbital — L'Anneau des Duellistes (PvP)
// ══════════════════════════════════════════════════════════════════════════════

import type { ArenaConfig } from "./arenaTypes";

export const ARENA_CONFIGS: ArenaConfig[] = [
  // ══════════════════════════════════════════════════════════════════════════
  // 1. DONJON FURISTE — La Fosse aux Meutes
  // ══════════════════════════════════════════════════════════════════════════
  // Map : donjon_furiste (4 chunks)
  // Spawn : [0, 6, 34] — face à l'arène, regard vers -Z
  // Centre arène : (0, 0, 0)
  // Type : Boss fight (Gralynis / boss_mob)
  // Inspiration : salle de boss circulaire avec piliers, fosse centrale, meutes
  //   de loups/grunts qui protègent le boss.
  //
  // Phases :
  //   1. Entrée → 2 vagues de meutes (loups + grunts)
  //   2. Boss apparaît (Gralynis) — 2 phases d'enrage 75/50%
  //   3. Renforts arrivant des flancs à 50%
  {
    mapId: "donjon_furiste",
    name: "La Fosse aux Meutes",
    description:
      "Au cœur du donjon, une vaste salle circulaire taillée dans la roche volcanique. " +
      "Des piliers de basalte ponctuent l'arène, offrant un cover précaire. " +
      "Au centre, une fosse fumante d'où émerge le Gralynis, gardien des lieux. " +
      "Des meutes de sbires montent des tunnels latéraux par vagues successives.",
    arenaType: "boss",
    faction: "zayan",
    chunkCount: 4,

    // ── Covers ─────────────────────────────────────────────────────────────
    covers: [
      // 4 piliers autour du centre
      { pos: [-12, 0, -12], size: [3, 6, 3], kind: "hard", state: "static", height: "high", label: "Pilier NE" },
      { pos: [12, 0, -12],  size: [3, 6, 3], kind: "hard", state: "static", height: "high", label: "Pilier NO" },
      { pos: [-12, 0, 12],  size: [3, 6, 3], kind: "hard", state: "static", height: "high", label: "Pilier SE" },
      { pos: [12, 0, 12],   size: [3, 6, 3], kind: "hard", state: "static", height: "high", label: "Pilier SO" },
      // 4 murets périphériques (low cover)
      { pos: [-20, 0, 0],  size: [2, 2.5, 6], kind: "hard", state: "static", height: "low", label: "Muret Ouest" },
      { pos: [20, 0, 0],   size: [2, 2.5, 6], kind: "hard", state: "static", height: "low", label: "Muret Est" },
      { pos: [0, 0, -20],  size: [6, 2.5, 2], kind: "hard", state: "static", height: "low", label: "Muret Nord" },
      { pos: [0, 0, 20],   size: [6, 2.5, 2], kind: "hard", state: "static", height: "low", label: "Muret Sud" },
      // Cover à l'entrée (safe)
      { pos: [0, 0, 30],   size: [4, 4, 1], kind: "hard", state: "static", height: "high", label: "Pilier Entrée" },
      // 2 barils explosifs (soft destructible)
      { pos: [-8, 0, -18], size: [1.5, 2, 1.5], kind: "soft", state: "dynamic", height: "low", label: "Baril Ouest" },
      { pos: [8, 0, -18],  size: [1.5, 2, 1.5], kind: "soft", state: "dynamic", height: "low", label: "Baril Est" },
    ],

    // ── Triggers ───────────────────────────────────────────────────────────
    triggers: [
      // Entrée de l'arène (depuis le spawn)
      { kind: "entry",  center: [0, 0, 25],  radius: 8,  label: "Entrée Arène", enabled: true,
        activates: ["wave1"] },
      // Première zone de combat
      { kind: "encounter", center: [0, 0, 10],  radius: 15, label: "Devant du Boss", enabled: false,
        activates: ["wave2"] },
      // Zone du boss (centre arène)
      { kind: "boss",   center: [0, 0, 0],   radius: 10, label: "Fosse du Boss", enabled: false,
        activates: ["boss_spawn"] },
      // Point de vantage à l'entrée
      { kind: "vantage", center: [0, 0, 34],  radius: 4,  label: "Vue d'Entrée", enabled: true },
      // Zone safe arrière
      { kind: "safe",   center: [0, 0, 32],  radius: 5,  label: "Zone Sûre Entrée", enabled: true },
      // Flanc gauche (renforts)
      { kind: "encounter", center: [-18, 0, -5], radius: 6,  label: "Flanc Gauche", enabled: false },
      // Flanc droit (renforts)
      { kind: "encounter", center: [18, 0, -5],  radius: 6,  label: "Flanc Droit", enabled: false },
    ],

    // ── Vagues ─────────────────────────────────────────────────────────────
    waves: [
      // Vague 1 : meute d'accueil (arrivée dans l'arène)
      {
        label: "Meute d'Accueil",
        delayMs: 1000,
        spawns: [
          { folder: "lion", count: 2, pos: [-10, 0, -5], packSize: 1 },
          { folder: "Grunt", count: 2, pos: [10, 0, -5], packSize: 1 },
          { folder: "Grunt", count: 1, pos: [0, 0, -2], packSize: 2 },
        ],
        curveballs: [],
        waitPrevious: false,
      },
      // Vague 2 : renforts des flancs
      {
        label: "Renforts des Flancs",
        delayMs: 8000,
        spawns: [
          { folder: "lion", count: 1, pos: [-15, 0, -8], fromDirection: "left", packSize: 2 },
          { folder: "venom_stalker", count: 1, pos: [15, 0, -8], fromDirection: "right" },
          { folder: "mercenaire_alien", count: 1, pos: [0, 0, -10], fromDirection: "front" },
        ],
        curveballs: ["cover_change"],
        waitPrevious: true,
      },
      // Vague 3 : le Boss (Gralynis) + gardes d'élite
      {
        label: "Le Gralynis",
        delayMs: 3000,
        spawns: [
          { folder: "gralynis_boss", count: 1, pos: [0, 0, 0], packSize: 1 },
          { folder: "gronomi_ardent", count: 2, pos: [-5, 0, 5], packSize: 1 },
          { folder: "gronomi_infaterie", count: 2, pos: [5, 0, 5], packSize: 1 },
        ],
        curveballs: [],
        waitPrevious: true,
      },
      // Vague 4 : renforts d'enrage (75% HP boss)
      {
        label: "Enrage — Renforts",
        delayMs: 1000,
        spawns: [
          { folder: "gronomi_mineur", count: 3, pos: [-12, 0, 12], fromDirection: "rear", packSize: 1 },
          { folder: "mercenaire_alien", count: 2, pos: [12, 0, 12], fromDirection: "rear", packSize: 1 },
        ],
        curveballs: ["smoke", "reinforcement"],
        waitPrevious: false,
      },
    ],

    // ── Routes tactiques ───────────────────────────────────────────────────
    routes: [
      {
        id: "route_main",
        kind: "main",
        label: "Route Principale",
        waypoints: [
          [0, 6, 34],
          [0, 0, 25],
          [0, 0, 15],
          [0, 0, 5],
        ],
        recommendedFor: ["warrior", "warrior_tank"],
      },
      {
        id: "route_flank_left",
        kind: "flank_left",
        label: "Contournement Ouest",
        waypoints: [
          [0, 0, 25],
          [-16, 0, 15],
          [-16, 0, 0],
          [-8, 0, -5],
        ],
        recommendedFor: ["ninja"],
      },
      {
        id: "route_flank_right",
        kind: "flank_right",
        label: "Contournement Est",
        waypoints: [
          [0, 0, 25],
          [16, 0, 15],
          [16, 0, 0],
          [8, 0, -5],
        ],
        recommendedFor: ["ninja"],
      },
      {
        id: "route_sniper",
        kind: "sniper_nest",
        label: "Position Surélevée",
        waypoints: [
          [0, 0, 25],
          [0, 0, 20],
        ],
        recommendedFor: ["archer", "mage"],
      },
    ],

    // ── NPCs recommandés (seed initial) ────────────────────────────────────
    recommendedNpcs: [
      // Le boss (respawn 0)
      { folder: "gralynis_boss", pos: [0, 0, 0], level: 25, rank: "boss", respawnSec: 0,
        aggroRange: 30, attackRange: 15 },
      // Gardes d'élite autour du boss
      { folder: "profhete", pos: [-8, 0, 8], level: 22, rank: "mob", packSize: 1, respawnSec: 60,
        aggroRange: 20, attackRange: 12 },
      { folder: "profhete_alien", pos: [8, 0, 8], level: 22, rank: "mob", packSize: 1, respawnSec: 60,
        aggroRange: 20, attackRange: 12 },
      // Meutes errantes (respawn 45s par défaut)
      { folder: "lion", pos: [-14, 0, -14], level: 18, rank: "mob", packSize: 2, respawnSec: 45 },
      { folder: "lion", pos: [14, 0, -14], level: 18, rank: "mob", packSize: 2, respawnSec: 45 },
      { folder: "Grunt", pos: [-10, 0, 15], level: 16, rank: "mob", packSize: 3, respawnSec: 45 },
      { folder: "Grunt", pos: [10, 0, 15], level: 16, rank: "mob", packSize: 3, respawnSec: 45 },
      // Tunnels latéraux
      { folder: "venom_stalker", pos: [-18, 0, -2], level: 20, rank: "mob", packSize: 2, respawnSec: 60 },
      { folder: "mercenaire_alien", pos: [18, 0, -2], level: 20, rank: "mob", packSize: 2, respawnSec: 60 },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 2. FUNGARIA — Le Coeur de la Colonie
  // ══════════════════════════════════════════════════════════════════════════
  // Map : fungaria (8 chunks)
  // Spawn : [-50, 0, 30] — lisière de la colonie fongique
  // Centre : (0, 0, 0) — le Cœur : un champignon géant bioluminescent
  // Type : Expédition (exploration + combat par vagues)
  // Inspiration : colonie alien de champignons géants, tunnels de mycélium,
  //   hôtes parasités, spores toxiques, prophètes de la colonie.
  //
  // Phases :
  //   1. Entrée par la lisière (vantage + safe)
  //   2. Salle des spores (premiers hôtes mycélium)
  //   3. Le Cœur de la Colonie (vagues de ennemis + boss optionnel)
  //   4. Repli et extraction
  //
  // Faction : Zayan (aliens fongiques)
  {
    mapId: "fungaria",
    name: "Le Cœur de la Colonie",
    description:
      "Au cœur de Fungaria, une colonie mycélienne gigantesque pulse d'une vie alien. " +
      "Des champignons bioluminescents violets percent le sol, projetant une lueur " +
      "malsaine. Des hôtes parasités errent entre les piliers fongiques, tandis que " +
      "des prophètes canalisent la lumière corrompue de la colonie. " +
      "Au centre, le Cœur — un champignon-titan dont les spores contrôlent toute la zone.",
    arenaType: "expedition",
    faction: "zayan",
    chunkCount: 8,

    // ── Covers ─────────────────────────────────────────────────────────────
    covers: [
      // Champignons géants (hard cover, hauts)
      { pos: [-16, 0, -16], size: [5, 8, 5], kind: "hard", state: "static", height: "high", label: "Champi Géant NE" },
      { pos: [16, 0, -16],  size: [5, 8, 5], kind: "hard", state: "static", height: "high", label: "Champi Géant NO" },
      { pos: [-16, 0, 16],  size: [5, 8, 5], kind: "hard", state: "static", height: "high", label: "Champi Géant SE" },
      { pos: [16, 0, 16],   size: [5, 8, 5], kind: "hard", state: "static", height: "high", label: "Champi Géant SO" },
      { pos: [-25, 0, 0],   size: [4, 10, 4], kind: "hard", state: "static", height: "high", label: "Pilier Fongique Ouest" },
      { pos: [25, 0, 0],    size: [4, 10, 4], kind: "hard", state: "static", height: "high", label: "Pilier Fongique Est" },
      // Champignons petits (low cover)
      { pos: [-8, 0, -24],  size: [3, 3, 3], kind: "soft", state: "static", height: "low", label: "Petit Champi N" },
      { pos: [8, 0, -24],   size: [3, 3, 3], kind: "soft", state: "static", height: "low", label: "Petit Champi N" },
      { pos: [-24, 0, 8],   size: [3, 3, 3], kind: "soft", state: "static", height: "low", label: "Petit Champi O" },
      { pos: [24, 0, 8],    size: [3, 3, 3], kind: "soft", state: "static", height: "low", label: "Petit Champi E" },
      // Spores explosives (soft destructible)
      { pos: [-5, 0, -30],  size: [2, 3, 2], kind: "soft", state: "dynamic", height: "low", label: "Spore Explosive 1" },
      { pos: [5, 0, -30],   size: [2, 3, 2], kind: "soft", state: "dynamic", height: "low", label: "Spore Explosive 2" },
      // Bouclier corrompu (hybrid — vision passe, dégâts bloqués)
      { pos: [0, 0, -10],   size: [6, 5, 0.5], kind: "hybrid", state: "static", height: "high", label: "Voile Mycélien" },
    ],

    // ── Triggers ───────────────────────────────────────────────────────────
    triggers: [
      // Entrée de la colonie
      { kind: "entry",  center: [-50, 0, 30], radius: 8,  label: "Lisière de la Colonie", enabled: true,
        activates: ["zone_spores"] },
      // Zone de vantage à l'entrée
      { kind: "vantage", center: [-50, 0, 30], radius: 5,  label: "Vue sur la Colonie", enabled: true },
      // Zone safe à l'entrée
      { kind: "safe",   center: [-50, 0, 30], radius: 6,  label: "Zone Sûre Lisière", enabled: true },
      // Salle des spores (premier combat)
      { kind: "encounter", center: [-25, 0, 15], radius: 12, label: "Salle des Spores", enabled: false,
        activates: ["coeur_colonie"] },
      // Le Cœur de la Colonie (boss/combat principal)
      { kind: "boss",   center: [0, 0, 0],   radius: 18, label: "Le Cœur", enabled: false,
        activates: ["vague_coeur1", "vague_coeur2"] },
      // No man's land entre l'entrée et la salle des spores
      { kind: "no_mans_land", center: [-38, 0, 22], radius: 10, label: "Zone Dangereuse", enabled: false },
      // Arrière (repli)
      { kind: "safe",   center: [-55, 0, 35], radius: 6,  label: "Repli Lisière", enabled: true },
      // Flanc gauche
      { kind: "encounter", center: [-20, 0, -10], radius: 8, label: "Nid Ouest", enabled: false },
      // Flanc droit
      { kind: "encounter", center: [20, 0, -10], radius: 8, label: "Nid Est", enabled: false },
    ],

    // ── Vagues ─────────────────────────────────────────────────────────────
    waves: [
      // Vague 1 : éclaireurs fongiques (salle des spores)
      {
        label: "Éclaireurs Fongiques",
        delayMs: 2000,
        spawns: [
          { folder: "mycelium_host_female", count: 2, pos: [-20, 0, 12], packSize: 1 },
          { folder: "mycelium_host_male", count: 1, pos: [-25, 0, 18], packSize: 1 },
          { folder: "parasite_sower_female", count: 1, pos: [-30, 0, 15] },
        ],
        curveballs: [],
        waitPrevious: false,
      },
      // Vague 2 : infestation (salle des spores + renforts)
      {
        label: "Infestation",
        delayMs: 10000,
        spawns: [
          { folder: "mycelium_host_male", count: 2, pos: [-22, 0, 10], packSize: 1 },
          { folder: "parasite_sower_male", count: 2, pos: [-28, 0, 20], packSize: 1 },
          { folder: "gronomi_ardent", count: 1, pos: [-18, 0, 18] },
        ],
        curveballs: ["smoke"],
        waitPrevious: true,
      },
      // Vague 3 : le Cœur de la Colonie (entrée dans la zone centrale)
      {
        label: "Défenseurs du Cœur",
        delayMs: 2000,
        spawns: [
          { folder: "profhete", count: 2, pos: [-8, 0, -5], packSize: 1 },
          { folder: "canopy_prophet_female", count: 1, pos: [0, 0, 0] },
          { folder: "canopy_prophet_male", count: 1, pos: [8, 0, 5] },
          { folder: "gronomi_infaterie", count: 3, pos: [-5, 0, -8], packSize: 1 },
        ],
        curveballs: [],
        waitPrevious: true,
      },
      // Vague 4 : renforts des nids
      {
        label: "Renforts des Nids",
        delayMs: 12000,
        spawns: [
          { folder: "mycelium_host_female", count: 2, pos: [-20, 0, -10], fromDirection: "left", packSize: 2 },
          { folder: "mycelium_host_male", count: 2, pos: [20, 0, -10], fromDirection: "right", packSize: 2 },
        ],
        curveballs: ["reinforcement"],
        waitPrevious: true,
      },
      // Vague 5 : la Prophétesse (mini-boss)
      {
        label: "La Prophétesse",
        delayMs: 5000,
        spawns: [
          { folder: "canopy_prophet_female", count: 1, pos: [0, 0, 5] },
          { folder: "profhete_alien", count: 2, pos: [-6, 0, 8], packSize: 1 },
          { folder: "venom_stalker", count: 2, pos: [6, 0, 8], packSize: 1 },
        ],
        curveballs: ["darkness"],
        waitPrevious: true,
      },
    ],

    // ── Routes tactiques ───────────────────────────────────────────────────
    routes: [
      {
        id: "route_main",
        kind: "main",
        label: "Route Principale",
        waypoints: [
          [-50, 0, 30],
          [-40, 0, 22],
          [-25, 0, 15],
          [-10, 0, 5],
          [0, 0, 0],
        ],
        recommendedFor: ["warrior", "warrior_tank"],
      },
      {
        id: "route_flank_left",
        kind: "flank_left",
        label: "Contournement Ouest (Nid)",
        waypoints: [
          [-40, 0, 22],
          [-30, 0, 10],
          [-25, 0, -5],
          [-20, 0, -10],
        ],
        recommendedFor: ["ninja"],
      },
      {
        id: "route_flank_right",
        kind: "flank_right",
        label: "Contournement Est (Nid)",
        waypoints: [
          [-40, 0, 22],
          [-15, 0, 20],
          [10, 0, 15],
          [20, 0, -10],
        ],
        recommendedFor: ["ninja"],
      },
      {
        id: "route_sniper",
        kind: "sniper_nest",
        label: "Position Élevée (Lisière)",
        waypoints: [
          [-50, 0, 30],
          [-45, 0, 25],
        ],
        recommendedFor: ["archer", "mage"],
      },
      {
        id: "route_retreat",
        kind: "retreat",
        label: "Repli Extraction",
        waypoints: [
          [0, 0, 0],
          [-25, 0, 15],
          [-40, 0, 22],
          [-55, 0, 35],
        ],
        recommendedFor: ["warrior", "archer", "mage", "ninja"],
      },
    ],

    // ── NPCs recommandés ───────────────────────────────────────────────────
    recommendedNpcs: [
      // Salle des spores
      { folder: "mycelium_host_female", pos: [-20, 0, 12], level: 18, rank: "mob", packSize: 2, respawnSec: 45 },
      { folder: "mycelium_host_male", pos: [-25, 0, 18], level: 20, rank: "mob", packSize: 1, respawnSec: 45 },
      { folder: "parasite_sower_female", pos: [-28, 0, 15], level: 16, rank: "mob", packSize: 1, respawnSec: 45 },
      // Cœur de la Colonie
      { folder: "canopy_prophet_female", pos: [0, 0, 0], level: 24, rank: "boss", respawnSec: 120,
        aggroRange: 30, attackRange: 20 },
      { folder: "canopy_prophet_male", pos: [8, 0, 5], level: 22, rank: "mob", respawnSec: 60,
        aggroRange: 25, attackRange: 15 },
      { folder: "profhete", pos: [-8, 0, -5], level: 20, rank: "mob", packSize: 2, respawnSec: 45 },
      { folder: "profhete_alien", pos: [10, 0, -5], level: 20, rank: "mob", packSize: 1, respawnSec: 45 },
      // Errants
      { folder: "gronomi_infaterie", pos: [-15, 0, 0], level: 18, rank: "mob", packSize: 3, respawnSec: 45 },
      { folder: "gronomi_ardent", pos: [15, 0, 0], level: 18, rank: "mob", packSize: 2, respawnSec: 45 },
      { folder: "venom_stalker", pos: [-5, 0, 15], level: 20, rank: "mob", packSize: 1, respawnSec: 45 },
      // Nid Ouest
      { folder: "parasite_sower_male", pos: [-20, 0, -10], level: 18, rank: "mob", packSize: 2, respawnSec: 60 },
      // Nid Est
      { folder: "mycelium_host_female", pos: [20, 0, -10], level: 18, rank: "mob", packSize: 2, respawnSec: 60 },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 3. ORBITAL — L'Anneau des Duellistes
  // ══════════════════════════════════════════════════════════════════════════
  // Map : orbital (8 chunks, très vaste)
  // Spawn : [1000, 50, 0] — accès à l'anneau principal
  // Centre anneau : (1000, 0, 0) — arène principale
  // Type : PvP (duel / arène ouverte)
  // Inspiration : station spatiale orbitale avec anneau de combat zéro-G partiel,
  //   plates-formes métalliques, couloirs pressurisés, baies vitrées sur le vide.
  //
  // L'arène PvP occupe une zone dédiée de la map massive : l'anneau principal
  // centré sur x≈1000. Le reste de la map (x:-449 à x:7364) est libre pour
  // exploration / autres activités.
  //
  // Structure de l'anneau :
  //   • Plate-forme centrale (1000, 0, 0) — le ring
  //   • 4 plates-formes satellites aux points cardinaux
  //   • Passerelles reliant les plates-formes
  //   • Cover : piliers métalliques, caisses de fret, consoles
  //   • Zones : spawn, ring, safe, spectateur
  {
    mapId: "orbital",
    name: "L'Anneau des Duellistes",
    description:
      "Suspendu dans le vide spatial, l'Anneau des Duellistes est une arène PvP " +
      "implantée dans la station orbitale. Une plate-forme centrale circulaire " +
      "de 30 mètres de diamètre, entourée de quatre plates-formes satellites " +
      "reliées par des passerelles énergétiques. Des piliers de soutien offrent " +
      "un cover stratégique, tandis que les baies vitrées laissent voir les étoiles. " +
      "Le vide spatial est la seule limite — tomber, c'est mourir.",
    arenaType: "pvp",
    faction: "mezalayis",
    chunkCount: 8,

    // ── Covers ─────────────────────────────────────────────────────────────
    covers: [
      // Anneau principal — 4 piliers cardinaux
      { pos: [1000, 0, -10], size: [2, 5, 2], kind: "hard", state: "static", height: "high", label: "Pilier Centre N" },
      { pos: [1000, 0, 10],  size: [2, 5, 2], kind: "hard", state: "static", height: "high", label: "Pilier Centre S" },
      { pos: [990, 0, 0],    size: [2, 5, 2], kind: "hard", state: "static", height: "high", label: "Pilier Centre O" },
      { pos: [1010, 0, 0],   size: [2, 5, 2], kind: "hard", state: "static", height: "high", label: "Pilier Centre E" },
      // Caisses de fret (low cover)
      { pos: [1005, 0, -15], size: [3, 2, 3], kind: "hard", state: "dynamic", height: "low", label: "Caisse Fret NE" },
      { pos: [995, 0, -15],  size: [3, 2, 3], kind: "hard", state: "dynamic", height: "low", label: "Caisse Fret NO" },
      { pos: [1005, 0, 15],  size: [3, 2, 3], kind: "hard", state: "dynamic", height: "low", label: "Caisse Fret SE" },
      { pos: [995, 0, 15],   size: [3, 2, 3], kind: "hard", state: "dynamic", height: "low", label: "Caisse Fret SO" },
      // Plates-formes satellites — covers
      { pos: [1000, 0, -35], size: [2, 4, 2], kind: "hard", state: "static", height: "high", label: "Pilier Sat Nord" },
      { pos: [1000, 0, 35],  size: [2, 4, 2], kind: "hard", state: "static", height: "high", label: "Pilier Sat Sud" },
      { pos: [965, 0, 0],    size: [2, 4, 2], kind: "hard", state: "static", height: "high", label: "Pilier Sat Ouest" },
      { pos: [1035, 0, 0],   size: [2, 4, 2], kind: "hard", state: "static", height: "high", label: "Pilier Sat Est" },
      // Barrière énergétique (hybrid cover — vision traverse)
      { pos: [1000, 0, -22], size: [8, 3, 0.5], kind: "hybrid", state: "static", height: "high", label: "Barrière Nord" },
      { pos: [1000, 0, 22],  size: [8, 3, 0.5], kind: "hybrid", state: "static", height: "high", label: "Barrière Sud" },
      // Console centrale (spawn)
      { pos: [1000, 0, 0],   size: [1.5, 1.5, 1.5], kind: "hard", state: "static", height: "low", label: "Console Ring" },
    ],

    // ── Triggers ───────────────────────────────────────────────────────────
    triggers: [
      // Zone d'entrée / spawn
      { kind: "entry",  center: [1000, 50, 0], radius: 8,  label: "Spawn Orbital", enabled: true,
        activates: ["arena_main", "safe_spawn"] },
      // Arène principale (anneau)
      { kind: "arena",  center: [1000, 0, 0],  radius: 25, label: "Anneau Principal", enabled: true },
      // Zone safe au spawn
      { kind: "safe",   center: [1000, 50, 0], radius: 10, label: "Zone Sûre Spawn", enabled: true },
      // Point de vantage sur l'anneau
      { kind: "vantage", center: [1000, 50, 0], radius: 5,  label: "Vue sur l'Anneau", enabled: true },
      // Plate-forme satellite Nord
      { kind: "encounter", center: [1000, 0, -35], radius: 8, label: "Satellite Nord", enabled: true },
      // Plate-forme satellite Sud
      { kind: "encounter", center: [1000, 0, 35],  radius: 8, label: "Satellite Sud", enabled: true },
      // Plate-forme satellite Ouest
      { kind: "encounter", center: [965, 0, 0],    radius: 8, label: "Satellite Ouest", enabled: true },
      // Plate-forme satellite Est
      { kind: "encounter", center: [1035, 0, 0],   radius: 8, label: "Satellite Est", enabled: true },
      // Vide spatial (limite — pas de retour)
      { kind: "no_mans_land", center: [1000, 0, 45], radius: 5,  label: "Vide Spatial", enabled: true },
    ],

    // ── Vagues ─────────────────────────────────────────────────────────────
    // Orbital est PvP — les vagues représentent des rounds / phases de duel
    waves: [
      // Round 1 : warm-up (ennemis faibles)
      {
        label: "Round 1 — Échauffement",
        delayMs: 3000,
        spawns: [
          { folder: "Grunt", count: 2, pos: [995, 0, -5], packSize: 1 },
          { folder: "Grunt", count: 2, pos: [1005, 0, 5], packSize: 1 },
        ],
        curveballs: [],
        waitPrevious: false,
      },
      // Round 2 : renforts des plates-formes satellites
      {
        label: "Round 2 — Assaut des Satellites",
        delayMs: 10000,
        spawns: [
          { folder: "mercenaire_alien", count: 1, pos: [1000, 0, -35], fromDirection: "front", packSize: 2 },
          { folder: "mercenaire_alien", count: 1, pos: [1000, 0, 35], fromDirection: "rear", packSize: 2 },
          { folder: "twinblast", count: 1, pos: [965, 0, 0], fromDirection: "left" },
          { folder: "twinblast", count: 1, pos: [1035, 0, 0], fromDirection: "right" },
        ],
        curveballs: ["reinforcement"],
        waitPrevious: true,
      },
      // Round 3 : duel final (boss mob + élites)
      {
        label: "Round 3 — Duel Final",
        delayMs: 5000,
        spawns: [
          { folder: "boss_mob", count: 1, pos: [1000, 0, 0], packSize: 1 },
          { folder: "gronomi_infaterie", count: 2, pos: [990, 0, -10] },
          { folder: "gronomi_ardent", count: 2, pos: [1010, 0, 10] },
        ],
        curveballs: ["quake", "darkness"],
        waitPrevious: true,
      },
    ],

    // ── Routes tactiques ───────────────────────────────────────────────────
    routes: [
      {
        id: "route_main",
        kind: "main",
        label: "Descente sur l'Anneau",
        waypoints: [
          [1000, 50, 0],
          [1000, 25, 0],
          [1000, 0, 0],
        ],
        recommendedFor: ["warrior", "warrior_tank", "warrior_bruiser"],
      },
      {
        id: "route_flank_north",
        kind: "flank_left",
        label: "Passerelle Nord",
        waypoints: [
          [1000, 0, 0],
          [1000, 0, -15],
          [1000, 0, -35],
        ],
        recommendedFor: ["ninja"],
      },
      {
        id: "route_flank_south",
        kind: "flank_right",
        label: "Passerelle Sud",
        waypoints: [
          [1000, 0, 0],
          [1000, 0, 15],
          [1000, 0, 35],
        ],
        recommendedFor: ["ninja"],
      },
      {
        id: "route_sniper_spawn",
        kind: "sniper_nest",
        label: "Position Haute Spawn",
        waypoints: [
          [1000, 50, 0],
          [1000, 25, 0],
        ],
        recommendedFor: ["archer", "mage"],
      },
      {
        id: "route_flank_west",
        kind: "flank_left",
        label: "Passerelle Ouest",
        waypoints: [
          [1000, 0, 0],
          [985, 0, 5],
          [965, 0, 0],
        ],
        recommendedFor: ["ninja", "archer"],
      },
      {
        id: "route_flank_east",
        kind: "flank_right",
        label: "Passerelle Est",
        waypoints: [
          [1000, 0, 0],
          [1015, 0, -5],
          [1035, 0, 0],
        ],
        recommendedFor: ["ninja", "archer"],
      },
    ],

    // ── NPCs recommandés ───────────────────────────────────────────────────
    recommendedNpcs: [
      // Gardes de l'anneau
      { folder: "Grunt", pos: [995, 0, -10], level: 20, rank: "mob", packSize: 2, respawnSec: 45 },
      { folder: "Grunt", pos: [1005, 0, 10], level: 20, rank: "mob", packSize: 2, respawnSec: 45 },
      { folder: "mercenaire_alien", pos: [980, 0, -5], level: 22, rank: "mob", packSize: 1, respawnSec: 45 },
      { folder: "mercenaire_alien", pos: [1020, 0, 5], level: 22, rank: "mob", packSize: 1, respawnSec: 45 },
      // Plates-formes satellites
      { folder: "twinblast", pos: [965, 0, 0], level: 24, rank: "mob", packSize: 1, respawnSec: 60,
        aggroRange: 35, attackRange: 20 },
      { folder: "twinblast", pos: [1035, 0, 0], level: 24, rank: "mob", packSize: 1, respawnSec: 60,
        aggroRange: 35, attackRange: 20 },
      { folder: "gronomi_infaterie", pos: [1000, 0, -35], level: 20, rank: "mob", packSize: 2, respawnSec: 45 },
      { folder: "gronomi_ardent", pos: [1000, 0, 35], level: 20, rank: "mob", packSize: 2, respawnSec: 45 },
      // Boss (Champion de l'Anneau)
      { folder: "boss_mob", pos: [1000, 0, 0], level: 28, rank: "boss", respawnSec: 120,
        aggroRange: 40, attackRange: 15 },
      // Élite
      { folder: "rampage_brute", pos: [990, 0, 15], level: 26, rank: "mob", packSize: 1, respawnSec: 90,
        aggroRange: 25, attackRange: 10 },
    ],
  },
];

/** Trouve la config d'une arène par mapId */
export function getArenaConfig(mapId: string): ArenaConfig | undefined {
  return ARENA_CONFIGS.find((a) => a.mapId === mapId);
}

/**
 * Seed les stores avec les configs d'arènes (appelée au premier boot).
 *
 * Version synchrone — utilise les imports directs. Le seed est un one-shot
 * bootstrapping : on ne fait que remplir les stores si vides.
 */
export function seedArenaConfigs(
  coverStore: { list: (id: string) => unknown[]; seed: (id: string, data: unknown[]) => void },
  triggerStore: { list: (id: string) => unknown[]; seed: (id: string, data: unknown[]) => void },
  waveStore: { list: (id: string) => unknown[]; seed: (id: string, data: unknown[]) => void },
): void {
  for (const arena of ARENA_CONFIGS) {
    if (coverStore.list(arena.mapId).length === 0 && arena.covers.length > 0) {
      coverStore.seed(arena.mapId, arena.covers);
    }
    if (triggerStore.list(arena.mapId).length === 0 && arena.triggers.length > 0) {
      triggerStore.seed(arena.mapId, arena.triggers);
    }
    if (waveStore.list(arena.mapId).length === 0 && arena.waves.length > 0) {
      waveStore.seed(arena.mapId, arena.waves);
    }
  }
}
