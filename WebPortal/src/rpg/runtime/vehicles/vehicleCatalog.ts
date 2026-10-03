// ══════════════════════════════════════════════════════════════════════════════
// runtime/vehicles/vehicleCatalog.ts — Catalogue des véhicules pilotables
//
// Centralise les stats de chaque véhicule (différencié du LootRegistry qui
// gère seulement les CLÉS d'invocation dans l'inventaire).
//
// Pattern :
//   • Item "clé" (consommable) dans LOOT_CATALOG → useEffect.summonVehicle = "phamtom"
//   • Stats du vaisseau invoqué → VEHICLE_CATALOG.phamtom
//   • Spawn devant le joueur → ShipController construit avec ces stats
//
// Phase A : stats statiques (path, scale, rotation, prix). Phase B ajoutera
// HP/explosion/animations/résistances.
// ══════════════════════════════════════════════════════════════════════════════

import { SHIP_FORGE, SHIP_TOWER, SHIP_LONGSWORD, SHIP_BACKGROUND } from "../SpaceEnvironment";

/** IDs canoniques des véhicules invocables. */
export type VehicleId =
  | "chasseur_avion" | "longsword" | "phamtom" | "vehicule_terrestre"
  | "wraith" | "corvette" | "mech_niko" | "interceptor"
  | "eclaireur" | "destroyer" | "corsaire" | "raptor"
  | "croiseur" | "faucon" | "sentinel" | "dreadnought" | "chasseur_tie"
  | "mech_combat"
  | "wraith_armed";

export interface VehicleDef {
  /** ID canonique (correspond au useEffect.summonVehicle des clés). */
  id: VehicleId;
  /**
   * Type de véhicule → décide du CONTRÔLEUR physique :
   *   • "air"    : ShipController (vol arcade, gravité réduite, poussée verticale).
   *   • "ground" : GroundVehicleController (roule au sol, gravité pleine, suivi
   *                de terrain, roues animées, AUCUN vol).
   * undefined = "air" (rétrocompat).
   */
  kind?: "air" | "ground";
  /** Nom affiché à l'invocation et dans le shop. */
  label: string;
  /** Path du GLB (utilise les exports SpaceEnvironment). */
  path: string;
  /** Échelle de rendu (ignorée si targetSize est défini). */
  scale: number;
  /**
   * Si défini : normalise le modèle pour que sa plus grande dimension = targetSize (m),
   * via la bounding-box au runtime. Pour les modèles convertis (FBX→GLB) dont l'échelle
   * source est inconnue → évite un vaisseau géant/minuscule sans calibrage manuel.
   */
  targetSize?: number;
  /** Correction d'axe du mesh GLB pour aligner le nez sur -Z moteur. */
  modelRotation: [number, number, number];
  /** Couleur primaire (HUD, glow, label). */
  color: string;

  // ── Stats de pilotage ────────────────────────────────────────────────────
  /** Multiplicateur de vitesse (1.0 = défaut). Phase B : appliqué au thrust. */
  speedMult: number;
  /** Multiplicateur de dégâts des sorts joueurs portés depuis ce véhicule (Phase B). */
  spellBoost: number;
  /** PV max du véhicule (Phase B : explosion à 0 HP). */
  maxHp: number;
  /** Résistance multiplicative aux dégâts élémentaires (Phase B). 0 = neutre, 0.5 = -50% dégâts. */
  elementResist: number;

  // ── Économie ──────────────────────────────────────────────────────────────
  /** Prix d'achat de la CLÉ chez le marchand de véhicules (crédits). */
  price: number;
  /** Prix de réparation à 100% (Phase B). */
  repairPrice: number;

  // ── Verdict nanos (Tâche 1, 2026-09-08 — docs/VEHICULES_NANOS.md) ─────────
  /**
   * Devenir de l'entrée côté serveur nanos :
   *   • "wheeled" : deviendra un `VehicleWheeled`. Exige un SkeletalMesh avec
   *     des os/sockets de roues (gabarit `default-vehicles-main`) — conversion
   *     ADK préalable, NON mesurée à ce jour ;
   *   • "decor"   : contrôleur nanos non intégré ; posable en décor après
   *     import/cook en StaticMesh. L'absence de classe native d'aéronef ou de
   *     mech impose de qualifier un contrôleur spécifique, pas d'abandonner le vol ;
   *   • "abandon" : écartée même en décor (VRAM injouable mesurée).
   * État historique au 2026-09-08 : aucun mesh du catalogue n'était cuit dans le pack
   * (`Server/Assets/narvos/Assets.toml`) ; seul `narvos::SKM_Mech` y existe,
   * en squelettique, sans classe pilotable.
   */
  type_nanos?: "wheeled" | "decor" | "abandon";
}

/**
 * Stats canoniques des véhicules — paramétrage validé avec l'utilisateur :
 *   • Chasseur Avion : standard, équilibré
 *   • Longsword       : 3000 cr, +50% vitesse
 *   • Phantom         : 6000 cr, +20% résistance, +20% dégâts des sorts
 *   • Véhicule terrestre : économique, résistance équilibrée à tous les éléments
 */
export const VEHICLE_CATALOG: Record<VehicleId, VehicleDef> = {
  chasseur_avion: {
    id:            "chasseur_avion",
    label:         "Chasseur Avion",
    path:          SHIP_FORGE,
    scale:         1.0,
    modelRotation: [0, -Math.PI / 2, 0],
    color:         "#ff7a3c",
    speedMult:     1.0,
    spellBoost:    0,
    maxHp:         200,
    elementResist: 0,
    price:         1500,
    repairPrice:   1000,
    type_nanos:    "decor",   // aéronef : aucune classe nanos ; GLB en KTX2 (import gris sans rebranchement)
  },
  longsword: {
    id:            "longsword",
    label:         "Longsword",
    path:          SHIP_LONGSWORD,
    scale:         0.4,
    modelRotation: [0, Math.PI / 2, 0],
    color:         "#a060ff",
    speedMult:     1.5,            // +50% — explorateur rapide
    spellBoost:    0,
    maxHp:         180,
    elementResist: 0,
    price:         3000,
    repairPrice:   1000,
    type_nanos:    "decor",   // aéronef : aucune classe nanos ; GLB en KTX2
  },
  phamtom: {
    id:            "phamtom",
    label:         "Fantôme Azur",
    path:          SHIP_TOWER,
    scale:         0.8,
    modelRotation: [0, Math.PI / 2, 0],
    color:         "#5b9bff",
    speedMult:     1.0,
    spellBoost:    0.2,            // +20% dégâts sorts
    maxHp:         320,            // plus résistant
    elementResist: 0.2,
    price:         6000,
    repairPrice:   1000,
    type_nanos:    "decor",   // aéronef : aucune classe nanos ; GLB en KTX2
  },
  vehicule_terrestre: {
    id:            "vehicule_terrestre",
    kind:          "ground",            // ← roule au sol, système séparé des vaisseaux
    label:         "Véhicule Terrestre",
    path:          SHIP_BACKGROUND,
    scale:         1.0,
    // Front du modèle = -X (roues avant à X≈-0.65) → rotation -90° Y pour
    // aligner le nez sur le -Z moteur (sinon le véhicule roule de travers).
    modelRotation: [0, -Math.PI / 2, 0],
    color:         "#94a3b8",
    speedMult:     0.85,           // un peu plus lent (terrestre)
    spellBoost:    0,
    maxHp:         400,            // tanky
    elementResist: 0.3,             // résistant à tous les éléments
    price:         800,             // économique, accessible à tous
    repairPrice:   1000,
    // SEULE entrée roulable en principe (kind ground). ⚠ Le GLB est un STATIC
    // mesh : VehicleWheeled exige un SkeletalMeshPath avec os de roues
    // (VehicleWheeled.json, constructeur). Conversion ADK non mesurée ; le
    // mesh n'est pas cuit dans le pack au 2026-09-08.
    type_nanos:    "wheeled",
  },

  // ── Nouveaux véhicules (FBX→GLB ; échelle auto via targetSize, couleur par défaut) ──
  wraith: {
    id: "wraith", label: "Wraith", path: "/models/vehicule/wraith/wraith.glb",
    scale: 1, targetSize: 7, modelRotation: [0, 0, 0], color: "#a855f7",
    speedMult: 1.15, spellBoost: 0.1, maxHp: 300, elementResist: 0.15,
    price: 4500, repairPrice: 1200,
    // 832 Mo VRAM mesurés (docs/SELECTION_ASSETS.md §1) : injouable même posé.
    type_nanos: "abandon",
  },
  corvette: {
    id: "corvette", label: "Corvette", path: "/models/vehicule/Ship/Ship.glb",
    scale: 1, targetSize: 8, modelRotation: [0, 0, 0], color: "#22d3ee",
    speedMult: 1.25, spellBoost: 0, maxHp: 220, elementResist: 0,
    price: 2800, repairPrice: 1000,
    // Vaisseau (static « Cube », KTX2) : VehicleWater exige aussi un
    // SkeletalMeshPath (VehicleWater.json) — décor posé au mieux, après cook.
    type_nanos: "decor",
  },
  mech_niko: {
    id: "mech_niko", label: "Mécha Niko", path: "/models/vehicule/robot_niko.glb",
    scale: 1, targetSize: 4.5, modelRotation: [0, 0, 0], color: "#f59e0b",
    speedMult: 0.9, spellBoost: 0, maxHp: 380, elementResist: 0.25,
    price: 5500, repairPrice: 1500,
    // Mech squelettique (Blender, 8 Mo) : aucune classe mech dans nanos —
    // décor posé au mieux, après cook.
    type_nanos: "decor",
  },
  interceptor: {
    id: "interceptor", label: "Intercepteur", path: "/models/vehicule/packship/ship8.glb",
    scale: 1, targetSize: 6, modelRotation: [0, 0, 0], color: "#34d399",
    speedMult: 1.4, spellBoost: 0, maxHp: 160, elementResist: 0,
    price: 3500, repairPrice: 1000,
    type_nanos: "decor",   // vaisseau spatial : aucune classe nanos
  },

  // ── Flotte PackShip (FBX→GLB) ───────────────────────────────────────────────
  eclaireur: {
    id: "eclaireur", label: "Éclaireur", path: "/models/vehicule/packship/ship1.glb",
    scale: 1, targetSize: 5, modelRotation: [0, 0, 0], color: "#60a5fa",
    speedMult: 1.3, spellBoost: 0, maxHp: 150, elementResist: 0,
    price: 2000, repairPrice: 800,
    type_nanos: "decor",   // vaisseau spatial : aucune classe nanos
  },
  destroyer: {
    id: "destroyer", label: "Destroyer", path: "/models/vehicule/packship/fbx/ship2.glb",
    scale: 1, targetSize: 9, modelRotation: [0, 0, 0], color: "#dc2626",
    speedMult: 0.8, spellBoost: 0.15, maxHp: 450, elementResist: 0.3,
    price: 7000, repairPrice: 2000,
    type_nanos: "decor",   // vaisseau spatial : aucune classe nanos
  },
  corsaire: {
    id: "corsaire", label: "Corsaire", path: "/models/vehicule/packship/fbx/ship3.glb",
    scale: 1, targetSize: 6, modelRotation: [0, 0, 0], color: "#f59e0b",
    speedMult: 1.1, spellBoost: 0.2, maxHp: 250, elementResist: 0.1,
    price: 4000, repairPrice: 1200,
    type_nanos: "decor",   // vaisseau spatial : aucune classe nanos
  },
  raptor: {
    id: "raptor", label: "Raptor", path: "/models/vehicule/packship/fbx/ship4.glb",
    scale: 1, targetSize: 5.5, modelRotation: [0, 0, 0], color: "#84cc16",
    speedMult: 1.35, spellBoost: 0, maxHp: 170, elementResist: 0,
    price: 2500, repairPrice: 900,
    type_nanos: "decor",   // vaisseau spatial : aucune classe nanos
  },
  croiseur: {
    id: "croiseur", label: "Croiseur", path: "/models/vehicule/packship/ship5.glb",
    scale: 1, targetSize: 7.5, modelRotation: [0, 0, 0], color: "#8b5cf6",
    speedMult: 0.95, spellBoost: 0.1, maxHp: 350, elementResist: 0.2,
    price: 5500, repairPrice: 1500,
    type_nanos: "decor",   // vaisseau spatial : aucune classe nanos
  },
  faucon: {
    id: "faucon", label: "Faucon", path: "/models/vehicule/packship/fbx/ship6.glb",
    scale: 1, targetSize: 5, modelRotation: [0, 0, 0], color: "#06b6d4",
    speedMult: 1.2, spellBoost: 0.05, maxHp: 200, elementResist: 0.05,
    price: 3000, repairPrice: 1000,
    type_nanos: "decor",   // vaisseau spatial : aucune classe nanos
  },
  sentinel: {
    id: "sentinel", label: "Sentinelle", path: "/models/vehicule/packship/fbx/ship7.glb",
    scale: 1, targetSize: 6.5, modelRotation: [0, 0, 0], color: "#e879f9",
    speedMult: 1.0, spellBoost: 0.15, maxHp: 280, elementResist: 0.15,
    price: 4500, repairPrice: 1200,
    type_nanos: "decor",   // vaisseau spatial : aucune classe nanos
  },
  dreadnought: {
    id: "dreadnought", label: "Dreadnought", path: "/models/vehicule/packship/fbx/ship9.glb",
    scale: 1, targetSize: 10, modelRotation: [0, 0, 0], color: "#b91c1c",
    speedMult: 0.7, spellBoost: 0.25, maxHp: 500, elementResist: 0.35,
    price: 9000, repairPrice: 2500,
    type_nanos: "decor",   // vaisseau spatial : aucune classe nanos
  },
  chasseur_tie: {
    id: "chasseur_tie", label: "Chasseur TIE", path: "/models/vehicule/packship/fbx/tie-fighter.glb",
    scale: 1, targetSize: 6, modelRotation: [0, 0, 0], color: "#374151",
    speedMult: 1.5, spellBoost: 0, maxHp: 120, elementResist: 0,
    price: 3200, repairPrice: 800,
    type_nanos: "decor",   // vaisseau spatial : aucune classe nanos
  },

  // ── Wraith armé (variante avec tourelle) ─────────────────────────────────────
  wraith_armed: {
    id: "wraith_armed", label: "Wraith Armé", path: "/models/vehicule/wraith/wraith_with_small_gun.glb",
    scale: 1, targetSize: 7, modelRotation: [0, 0, 0], color: "#7c3aed",
    speedMult: 1.0, spellBoost: 0.15, maxHp: 340, elementResist: 0.2,
    price: 5500, repairPrice: 1500,
    // Même famille que wraith (832 Mo VRAM mesurés sur wraith.glb) :
    // VRAM de cette variante non mesurée, supposée du même ordre — injouable.
    type_nanos: "abandon",
  },

  // ── Mécha de combat (GameAnimationSample) ───────────────────────────────────
  mech_combat: {
    id: "mech_combat", kind: "ground", label: "Mécha de Combat",
    path: "/models/personnages/GameAnimationSample/Locomotor/Mech/Meshes/SKM_Mech.glb",
    scale: 1, targetSize: 5, modelRotation: [0, 0, 0], color: "#78716c",
    speedMult: 0.75, spellBoost: 0, maxHp: 500, elementResist: 0.3,
    price: 6000, repairPrice: 1800,
    // Mech : aucune classe mech dans nanos malgré kind "ground". Cas UNIQUE du
    // catalogue : son mesh EST cuit — narvos::SKM_Mech, [assets.skeletal_meshes]
    // de Server/Assets/narvos/Assets.toml — mais Prop exige un StaticMeshPath
    // (Prop.json) : le décor passerait par CharacterSimple (pose de liaison,
    // aucune animation mech cuite) ou BP_Walker (contenu non vérifié).
    type_nanos: "decor",
  },
};

/** Tableau des entrées (pratique pour map dans le shop). */
export const VEHICLE_LIST: VehicleDef[] = Object.values(VEHICLE_CATALOG);

// ══════════════════════════════════════════════════════════════════════════════
// VOITURES NANOS — les 12 voitures City_Traffic_Pro CUITES (2026-09-10).
//
// Distinct de VEHICLE_CATALOG : celui-ci décrit les véhicules du RUNTIME WEB
// (GLB sous /models, contrôleurs TS). Les 12 voitures n'existent QUE côté
// serveur nanos — SkeletalMeshes cuits, aucun GLB web. Les mélanger ferait
// apparaître dans le shop web des véhicules sans mesh affichable.
//
// Mesures (2026-09-10, sonde sur les .uasset cuits — docs/VEHICULE_ROULANT_20260910.md) :
//   · les 12 SK_ partagent Car_Skeleton : os Wheel_FL/FR/RL/RR, plus Body,
//     HeadlightL/R, RegPlateF/R ; AUCUN socket VisWheel_* — les roues sont
//     skinnées dans le mesh squelettique (patron Sedan du gabarit officiel) ;
//   · chaque `asset` est déclaré dans Server/Assets/narvos/Assets.toml,
//     section [assets.skeletal_meshes] ; les plaques SM_RegPlate01-04 dans
//     [assets.static_meshes] ; S_Car_Engine_2K/3K/4K/5K et S_Horn dans
//     [assets.sounds].
//
// ⚠ Généré vers Lua par narvos-catalogs-to-lua.mjs AVEC GARDE : une entrée
// dont le mesh est absent d'Assets.toml NE SORT PAS du générateur (et
// l'exclusion est dite). Aujourd'hui les 12 passent — elles sont cuites.
// ⚠ son_moteur (4 variantes pour 12 voitures) et plaque sont des choix
// PROVISOIRES de répartition, pas des données du pack.
// ══════════════════════════════════════════════════════════════════════════════

export interface VoitureNanosDef {
  /** Identifiant canonique (clé de /vehicule et de Voitures.Modele). */
  id: string;
  /** Nom affiché. */
  label: string;
  /** SkeletalMesh cuit, préfixe inclus : "narvos::SK_…". */
  asset: string;
  /** Son moteur cuit, préfixe inclus (provisoire : 4 variantes pour 12). */
  son_moteur: string;
  /** Klaxon cuit du pack (S_Horn). */
  son_klaxon: string;
  /** Plaque d'immatriculation cuite, posée sur RegPlateF/R (provisoire). */
  plaque: string;
}

export const VOITURES_NANOS: VoitureNanosDef[] = [
  { id: "executive_sedan",            label: "Berline Exécutive",        asset: "narvos::SK_Executive_Sedan",            son_moteur: "narvos::S_Car_Engine_3K", son_klaxon: "narvos::S_Horn", plaque: "narvos::SM_RegPlate01" },
  { id: "luxury_car",                 label: "Voiture de Luxe",          asset: "narvos::SK_Luxury_Car",                 son_moteur: "narvos::S_Car_Engine_4K", son_klaxon: "narvos::S_Horn", plaque: "narvos::SM_RegPlate02" },
  { id: "sport_wagon",                label: "Break Sport",              asset: "narvos::SK_Sport_Wagon",                son_moteur: "narvos::S_Car_Engine_4K", son_klaxon: "narvos::S_Horn", plaque: "narvos::SM_RegPlate03" },
  { id: "station_wagon",              label: "Break Familial",           asset: "narvos::SK_Station_Wagon",              son_moteur: "narvos::S_Car_Engine_2K", son_klaxon: "narvos::S_Horn", plaque: "narvos::SM_RegPlate04" },
  { id: "family_hatchback",           label: "Compacte Familiale",       asset: "narvos::SK_Family_Hatchback",           son_moteur: "narvos::S_Car_Engine_2K", son_klaxon: "narvos::S_Horn", plaque: "narvos::SM_RegPlate01" },
  { id: "hatchback1",                 label: "Hatchback",                asset: "narvos::SK_Hatchback1",                 son_moteur: "narvos::S_Car_Engine_2K", son_klaxon: "narvos::S_Horn", plaque: "narvos::SM_RegPlate02" },
  { id: "sporty_compact_hatchback",   label: "Compacte Sportive",        asset: "narvos::SK_Sporty_Compact_Hatchback",   son_moteur: "narvos::S_Car_Engine_5K", son_klaxon: "narvos::S_Horn", plaque: "narvos::SM_RegPlate03" },
  { id: "compact_crossover",          label: "Crossover Compact",        asset: "narvos::SK_Compact_Crossover",          son_moteur: "narvos::S_Car_Engine_3K", son_klaxon: "narvos::S_Horn", plaque: "narvos::SM_RegPlate04" },
  { id: "fullsize_suv",               label: "SUV Grand Format",         asset: "narvos::SK_Full-size_SUV",              son_moteur: "narvos::S_Car_Engine_4K", son_klaxon: "narvos::S_Horn", plaque: "narvos::SM_RegPlate01" },
  { id: "minivan",                    label: "Minivan",                  asset: "narvos::SK_Minivan",                    son_moteur: "narvos::S_Car_Engine_2K", son_klaxon: "narvos::S_Horn", plaque: "narvos::SM_RegPlate02" },
  { id: "compact_panel_van",          label: "Fourgonnette Compacte",    asset: "narvos::SK_Compact_Panel_Van",          son_moteur: "narvos::S_Car_Engine_3K", son_klaxon: "narvos::S_Horn", plaque: "narvos::SM_RegPlate03" },
  { id: "pickup",                     label: "Pickup",                   asset: "narvos::SK_Pickup",                     son_moteur: "narvos::S_Car_Engine_5K", son_klaxon: "narvos::S_Horn", plaque: "narvos::SM_RegPlate04" },
];

// ══════════════════════════════════════════════════════════════════════════════
// MOTOS NANOS — les trois motos du pack Ridable MotorBikes (UE 4.26), 2026-09-13.
//
// Même statut que VOITURES_NANOS : n'existent QUE côté serveur nanos.
//
// Mesures (2026-09-13, tables de noms des .uasset source) :
//   · les trois corps `SK_<Moto>_Body_LOD0` sont skinnés sur `SKL_Bike_base` :
//     Root, Front_Left_Wheel, Front_Right_Wheel, Front_Visible_Wheel,
//     Rear_Left_Wheel, Rear_Right_Wheel, Steering_Wheel, SuspensionBottom,
//     SuspensionFront, SuspensionTop, Swingarm — la convention
//     `digital_dive_moto` de Logic/OsVehicules.lua ;
//   · leurs PhysicsAssets n'ont de corps que sur Root et Steering_Wheel, AUCUN
//     sur un os de roue (l'interdit nanos est respecté) ;
//   · les pièces (garde-boue, phare, pot) sont sur UN AUTRE squelette
//     (`SKL_<Moto>_MorphRef`) : elles ne sont PAS posées — la moto roule sans.
//
// ⚠ Généré vers Lua AVEC GARDE (narvos-catalogs-to-lua.mjs) : une moto dont le
// corps n'est pas dans Assets.toml ne sort pas du générateur.
// ⚠ son_moteur : la boucle de ralenti de chaque moto, faute de mieux.
// ══════════════════════════════════════════════════════════════════════════════

export interface MotoNanosDef {
  /** Identifiant canonique (clé de /vehicule et de Voitures.Modele). */
  id: string;
  /** Nom affiché. */
  label: string;
  /** Corps cuit, préfixe inclus : "narvos::SK_<Moto>_Body_LOD0". */
  asset: string;
  /** Son moteur cuit, préfixe inclus. */
  son_moteur: string;
  /** Marque affichée par le menu des véhicules (Client/UI/ateliers.js). */
  categorie: "moto";
}

export const MOTOS_NANOS: MotoNanosDef[] = [
  { id: "moto_naked",  label: "Moto Roadster", asset: "narvos::SK_Naked_Body_LOD0",  son_moteur: "narvos::S_NakedIdle", categorie: "moto" },
  { id: "moto_enduro", label: "Moto Enduro",   asset: "narvos::SK_Enduro_Body_LOD0", son_moteur: "narvos::S_Enduro_Idle", categorie: "moto" },
  { id: "moto_custom", label: "Moto Custom",   asset: "narvos::SK_Custom_Body_LOD0", son_moteur: "narvos::S_CustomIdle", categorie: "moto" },
];

/** Helper : retourne la def d'un véhicule par id (avec fallback chasseur). */
export function getVehicleDef(id: string): VehicleDef {
  return (VEHICLE_CATALOG as Record<string, VehicleDef | undefined>)[id]
    ?? VEHICLE_CATALOG.chasseur_avion;
}
