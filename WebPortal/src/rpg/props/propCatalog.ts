// props/propCatalog.ts — catalogue statique des props (décors) plaçables par l'admin.
// Chaque entrée référence un GLB dans public/ avec ses métadonnées d'affichage.

/** Définition d'un prop plaçable dans le catalogue. */
export interface PropDef {
  /** Identifiant unique du prop (slug). */
  id: string;
  /** Nom affiché dans l'éditeur. */
  label: string;
  /** Chemin relatif à public/ vers le fichier GLB. */
  path: string;
  /** Échelle par défaut à l'ajout (1 = taille d'origine). */
  defaultScale: number;
  /** Catégorie pour le regroupement dans l'UI. */
  category: string;
}

// ⚠ Ces chemins pointaient vers /models/export/bullet/content/new/… — dossier
// restructuré lors d'un import d'assets : les 6 sous-dossiers avaient migré vers
// /models/environnements/ et /models/divers/. TOUT le catalogue renvoyait donc
// des 404 silencieux (Vite sert du text/html en 200 sur un fichier manquant, cf.
// le piège documenté dans assetExists). Vérifié fichier par fichier après correction.
// Note: les sources C++ payantes (scriptC++) ont été déplacées hors de public/ vers
// src/rpg/_vendor_sources/ pour éviter leur exposition publique.
const MODELS = "/models";
const HTB    = `${MODELS}/environnements/High_Tech_Base/Models`;
const SFW    = `${MODELS}/environnements/SciFiWorld/Meshes`;
const SFH    = `${MODELS}/environnements/ScifiHallway/Props`;
const SSS    = `${MODELS}/environnements/SciFi_Space_Station/Models`;
const PA     = `${MODELS}/environnements/Post_Apocalyptic/Meshes`;
const CHEST  = `${MODELS}/divers/chest`;

// ── Décor spatial (pack SpaceScenes) — destiné à la map ORBITAL ─────────────
const SPACE  = `${MODELS}/export/bullet/content/new/unreal/SpaceScenes/Scenery`;
const SPACEFX = `${MODELS}/export/bullet/content/new/unreal/SpaceScenes/Effects/Meshes`;

/**
 * Catalogue des props disponibles.
 * Ajouter ici toute nouvelle entrée — le panneau admin le reflétera automatiquement.
 */
export const PROP_CATALOG: PropDef[] = [
  // ── Conteneurs / Caisses ────────────────────────────────────────────────────
  // `modular_sci-_fi_crate.glb` est RETIRÉ du catalogue, pour deux raisons
  // mesurées — le fichier reste sur disque si tu veux le retravailler :
  //   1. Il déclare extensionsRequired: ["KHR_materials_pbrSpecularGlossiness"],
  //      que ni three 0.181 ni three-stdlib n'implémentent. GLTFLoader se contente
  //      d'un console.warn : le maillage se charge SANS son matériau et apparaît
  //      blanc/gris — d'où « ne s'affiche pas correctement ».
  //   2. Il embarque 12 textures 4096², soit ~1 Go de VRAM POUR UNE CAISSE.
  //      À lui seul il peut provoquer la perte de contexte WebGL.
  // Le réintégrer suppose de convertir son matériau en metallic-roughness ET de
  // réduire ses textures.
  { id: "scifi_crate",          label: "Caisse Sci-Fi",            path: `${CHEST}/sci-fi_crate.glb`,          defaultScale: 1, category: "conteneur" },
  { id: "scifi_crate_alt",      label: "Caisse Sci-Fi (Alt)",      path: `${CHEST}/sci-fi_crate (1).glb`,      defaultScale: 1, category: "conteneur" },
  { id: "pa_barrel",            label: "Baril Post-Apo",           path: `${PA}/SM_barrel.glb`,                 defaultScale: 1, category: "conteneur" },
  { id: "pa_shipping_container",label: "Container Maritime",       path: `${PA}/SM_shipping_container.glb`,     defaultScale: 0.5, category: "conteneur" },
  { id: "pa_jerrycan_metal",    label: "Jerrycan Métal",           path: `${PA}/SM_jerrycan_metal.glb`,         defaultScale: 1, category: "conteneur" },

  // ── SciFiWorld — Barils & Labos ─────────────────────────────────────────────
  { id: "sfw_barrel_01",        label: "Baril Sci-Fi 01",          path: `${SFW}/SM_Barrel01.glb`,              defaultScale: 1, category: "conteneur" },
  { id: "sfw_barrel_02",        label: "Baril Sci-Fi 02",          path: `${SFW}/SM_Barrel02.glb`,              defaultScale: 1, category: "conteneur" },
  { id: "sfw_barrel_03",        label: "Baril Sci-Fi 03",          path: `${SFW}/SM_Barrel03.glb`,              defaultScale: 1, category: "conteneur" },
  { id: "sfw_lab_capsule",      label: "Capsule Labo",             path: `${SFW}/SM_LabCapsule08_1_Capsule.glb`,defaultScale: 1, category: "labo" },
  { id: "sfw_lab_chair",        label: "Chaise Labo",              path: `${SFW}/SM_LabChair02.glb`,            defaultScale: 1, category: "mobilier" },
  { id: "sfw_lab_desk",         label: "Bureau Labo",              path: `${SFW}/SM_LabDesk03_1.glb`,           defaultScale: 1, category: "mobilier" },
  { id: "sfw_lab_display",      label: "Écran Labo",               path: `${SFW}/SM_LabDisplay01_1.glb`,        defaultScale: 1, category: "tech" },
  { id: "sfw_display",          label: "Écran Holographique",      path: `${SFW}/SM_Display02_1.glb`,           defaultScale: 1, category: "tech" },
  { id: "sfw_key_panel",        label: "Panneau Clavier",          path: `${SFW}/SM_KeyPanel01.glb`,            defaultScale: 1, category: "tech" },

  // ── High-Tech Base ──────────────────────────────────────────────────────────
  { id: "htb_chair",            label: "Chaise High-Tech",         path: `${HTB}/SM_Chair_01.glb`,              defaultScale: 1, category: "mobilier" },
  { id: "htb_control_room",     label: "Salle de Contrôle",        path: `${HTB}/SM_Control_Room.glb`,          defaultScale: 0.5, category: "structure" },
  { id: "htb_door_01",          label: "Porte Blindée 01",         path: `${HTB}/SM_Door_01.glb`,               defaultScale: 1, category: "structure" },
  { id: "htb_door_02",          label: "Porte Blindée 02",         path: `${HTB}/SM_Door_02.glb`,               defaultScale: 1, category: "structure" },
  { id: "htb_hangar_door",      label: "Porte Hangar",             path: `${HTB}/SM_Hangar_Door_01.glb`,        defaultScale: 0.5, category: "structure" },
  { id: "htb_panel",            label: "Panneau Mural",            path: `${HTB}/SM_Panel_01.glb`,              defaultScale: 1, category: "tech" },
  { id: "htb_panel_pipes",      label: "Panneau avec Tuyaux",      path: `${HTB}/SM_Panel_Pipes_01.glb`,        defaultScale: 1, category: "tech" },
  { id: "htb_pipe_01",          label: "Tuyau 01",                 path: `${HTB}/SM_Pipe_01.glb`,               defaultScale: 1, category: "structure" },
  { id: "htb_pipe_02",          label: "Tuyau 02",                 path: `${HTB}/SM_Pipe_02.glb`,               defaultScale: 1, category: "structure" },
  { id: "htb_prop_01",          label: "Prop High-Tech 01",        path: `${HTB}/SM_Prop_01.glb`,               defaultScale: 1, category: "décor" },
  { id: "htb_prop_02",          label: "Prop High-Tech 02",        path: `${HTB}/SM_Prop_02.glb`,               defaultScale: 1, category: "décor" },
  { id: "htb_prop_03",          label: "Prop High-Tech 03",        path: `${HTB}/SM_Prop_03.glb`,               defaultScale: 1, category: "décor" },
  { id: "htb_railing_01",       label: "Rambarde 01",              path: `${HTB}/SM_Railing_01.glb`,            defaultScale: 1, category: "structure" },
  { id: "htb_railing_02",       label: "Rambarde 02",              path: `${HTB}/SM_Railing_02.glb`,            defaultScale: 1, category: "structure" },
  { id: "htb_bridge",           label: "Passerelle",               path: `${HTB}/SM_Bridge_01.glb`,             defaultScale: 0.5, category: "structure" },
  { id: "htb_hero_prop",        label: "Prop Héroïque",            path: `${HTB}/SM_Base_Hero_Prop_01.glb`,     defaultScale: 1, category: "décor" },
  { id: "htb_lighting",         label: "Éclairage Plafond",        path: `${HTB}/SM_Lighting_Ceiling_01.glb`,   defaultScale: 1, category: "éclairage" },

  // ── SciFi Hallway ───────────────────────────────────────────────────────────
  { id: "sfh_bench",            label: "Banc Sci-Fi",              path: `${SFH}/Bench_01_Low.glb`,             defaultScale: 1, category: "mobilier" },
  { id: "sfh_chair",            label: "Chaise Sci-Fi",            path: `${SFH}/Chair_02.glb`,                 defaultScale: 1, category: "mobilier" },
  { id: "sfh_monitor",          label: "Moniteur",                 path: `${SFH}/Monitor_01.glb`,               defaultScale: 1, category: "tech" },
  { id: "sfh_server",           label: "Serveur Informatique",     path: `${SFH}/Server_01.glb`,                defaultScale: 1, category: "tech" },
  { id: "sfh_door_01",          label: "Porte Couloir",            path: `${SFH}/Door_01.glb`,                  defaultScale: 1, category: "structure" },
  { id: "sfh_door_02",          label: "Porte Couloir 02",         path: `${SFH}/Door_02.glb`,                  defaultScale: 1, category: "structure" },
  { id: "sfh_fire_ext",         label: "Extincteur",               path: `${SFH}/Prop_FireExtinguisher_01.glb`,  defaultScale: 1, category: "décor" },
  { id: "sfh_plant",            label: "Plante Intérieure",        path: `${SFH}/Plant_01.glb`,                 defaultScale: 1, category: "décor" },
  { id: "sfh_led_sign",         label: "Enseigne LED",             path: `${SFH}/LEDSign_01.glb`,               defaultScale: 1, category: "tech" },
  { id: "sfh_robot",            label: "Robot Animé",              path: `${SFH}/Robot_Animated.glb`,            defaultScale: 1, category: "décor" },
  { id: "sfh_bin",              label: "Poubelle",                 path: `${SFH}/Bin_01.glb`,                   defaultScale: 1, category: "décor" },

  // ── Station Spatiale ────────────────────────────────────────────────────────
  { id: "sss_column",           label: "Colonne Station",          path: `${SSS}/SM_Space_Station_column.glb`,        defaultScale: 1, category: "structure" },
  { id: "sss_column_02",        label: "Colonne Station 02",       path: `${SSS}/SM_Space_Station_column_02.glb`,     defaultScale: 1, category: "structure" },
  { id: "sss_door",             label: "Porte Station",            path: `${SSS}/SM_Space_Station_door1_2x2.glb`,     defaultScale: 1, category: "structure" },
  { id: "sss_electric",         label: "Boîtier Électrique",       path: `${SSS}/SM_Space_Station_electric.glb`,      defaultScale: 1, category: "tech" },
  { id: "sss_prop_01",          label: "Prop Station 01",          path: `${SSS}/SM_Space_Station_prop_01.glb`,       defaultScale: 1, category: "décor" },
  { id: "sss_prop_02",          label: "Prop Station 02",          path: `${SSS}/SM_Space_Station_prop_02.glb`,       defaultScale: 1, category: "décor" },
  { id: "sss_stair",            label: "Escalier Station",         path: `${SSS}/SM_Space_Station_stair_01.glb`,      defaultScale: 1, category: "structure" },
  { id: "sss_grate_wall",       label: "Grille Murale",            path: `${SSS}/SM_Space_Station_Grate_Wall.glb`,    defaultScale: 1, category: "structure" },

  // ── Post-Apocalyptique ──────────────────────────────────────────────────────
  { id: "pa_workbench",         label: "Établi",                   path: `${PA}/SM_workbench.glb`,              defaultScale: 1, category: "mobilier" },
  { id: "pa_shelf",             label: "Étagère",                  path: `${PA}/SM_shelf_l.glb`,                defaultScale: 1, category: "mobilier" },
  { id: "pa_solar_panel",       label: "Panneau Solaire",          path: `${PA}/SM_solar_panel.glb`,            defaultScale: 1, category: "tech" },
  { id: "pa_engine",            label: "Moteur",                   path: `${PA}/SM_engine.glb`,                 defaultScale: 1, category: "tech" },
  { id: "pa_concrete_block",    label: "Bloc Béton",               path: `${PA}/SM_concrete_block.glb`,         defaultScale: 1, category: "structure" },
  { id: "pa_antenna",           label: "Antenne",                  path: `${PA}/SM_antenna.glb`,                defaultScale: 0.5, category: "tech" },
  { id: "pa_satellite_dish",    label: "Parabole",                 path: `${PA}/SM_satellite_dish.glb`,         defaultScale: 0.5, category: "tech" },

  // ══════════════════════════════════════════════════════════════════════════
  // DÉCOR SPATIAL (pack SpaceScenes) — pensé pour la map ORBITAL
  //
  // Échelles : ces meshes sont autorés à l'échelle « décor de fond » Unreal.
  // Les structures massives (station, vaisseau-mère, planète) sont volontairement
  // laissées à 1 pour servir de silhouette LOINTAINE ; les rapprocher demande de
  // les redimensionner à la main dans l'éditeur. Les props d'intérieur et les
  // petits astéroïdes sont ramenés à une échelle de proximité.
  // ══════════════════════════════════════════════════════════════════════════

  // ── Astéroïdes ────────────────────────────────────────────────────────────
  { id: "sp_asteroid_01",       label: "Astéroïde 01",             path: `${SPACE}/Asteroids/NormalAsteroids/Meshes/SM_Asteroid_01.glb`,      defaultScale: 1, category: "spatial" },
  { id: "sp_asteroid_02",       label: "Astéroïde 02",             path: `${SPACE}/Asteroids/NormalAsteroids/Meshes/SM_Asteroid_02.glb`,      defaultScale: 1, category: "spatial" },
  { id: "sp_asteroid_pillar_1", label: "Astéroïde Pilier 1",       path: `${SPACE}/Asteroids/PillarAsteroids/Meshes/SM_Astroid_Pillar_1.glb`, defaultScale: 1, category: "spatial" },
  { id: "sp_asteroid_pillar_2", label: "Astéroïde Pilier 2",       path: `${SPACE}/Asteroids/PillarAsteroids/Meshes/SM_Astroid_Pillar_2.glb`, defaultScale: 1, category: "spatial" },
  { id: "sp_asteroid_pillar_3", label: "Astéroïde Pilier 3",       path: `${SPACE}/Asteroids/PillarAsteroids/Meshes/SM_Astroid_Pillar_3.glb`, defaultScale: 1, category: "spatial" },
  { id: "sp_small_asteroid",    label: "Petit Astéroïde",          path: `${SPACEFX}/SM_Small_Astroid_1.glb`,                                 defaultScale: 1, category: "spatial" },
  { id: "sp_rock",              label: "Rocher Spatial",           path: `${SPACEFX}/SM_Rock_01.glb`,                                         defaultScale: 1, category: "spatial" },

  // ── Corps célestes (silhouettes de fond — NE PAS rapprocher) ──────────────
  { id: "sp_planet_sphere",     label: "Planète (sphère)",         path: `${SPACE}/Planets/Meshes/SM_PlanetSphere.glb`,                       defaultScale: 1, category: "spatial_fond" },
  { id: "sp_planet_half",       label: "Planète (demi)",           path: `${SPACE}/Planets/Meshes/SM_Planet_Half.glb`,                        defaultScale: 1, category: "spatial_fond" },
  { id: "sp_dying_star",        label: "Étoile Mourante",          path: `${SPACE}/DyingStar/Mesh/SM_dyingstar_astroid.glb`,                  defaultScale: 1, category: "spatial_fond" },
  { id: "sp_godray",            label: "Voile de Lumière",         path: `${SPACE}/GodRay/Mesh/SM_GodRay_Plane.glb`,                          defaultScale: 1, category: "spatial_fond" },
  { id: "sp_mothership",        label: "Vaisseau-Mère",            path: `${SPACE}/MotherShip/Meshes/SM_MotherShip_Base.glb`,                 defaultScale: 1, category: "spatial_fond" },
  { id: "sp_mothership_lp",     label: "Vaisseau-Mère (LOD bas)",  path: `${SPACE}/MotherShip/Meshes/SM_MotherShip_Base_LP.glb`,              defaultScale: 1, category: "spatial_fond" },

  // ── Stations orbitales ────────────────────────────────────────────────────
  { id: "sp_station_01",        label: "Station Orbitale 01",      path: `${SPACE}/SpaceStations/SpaceStation_1/Mesh/SM_SpaceStation_01.glb`,               defaultScale: 1, category: "spatial_structure" },
  { id: "sp_energy_collector",  label: "Collecteur d'Énergie",     path: `${SPACE}/SpaceStations/SpaceStation_1/Mesh/SM_SpaceStation_1_EnergyCollector.glb`, defaultScale: 1, category: "spatial_structure" },
  { id: "sp_hangar_platform",   label: "Plateforme de Hangar",     path: `${SPACE}/SpaceStations/Spacestation_2/Meshes/SM_Hangar_Platform_1.glb`,           defaultScale: 1, category: "spatial_structure" },
  { id: "sp_landing_base",      label: "Base d'Atterrissage",      path: `${SPACE}/SpaceStations/Spacestation_2/Meshes/SM_Spacestation_anding_base_SM_Spacestation_anding_base.glb`, defaultScale: 1, category: "spatial_structure" },
  // Les rotateurs et roues vont par PAIRE inner/outer — les placer ensemble,
  // au même point, sinon la structure paraît tronquée.
  { id: "sp_rotator_inner",     label: "Rotateur (intérieur)",     path: `${SPACE}/SpaceStations/Spacestation_2/Meshes/SM_big_rotator_inner.glb`,           defaultScale: 1, category: "spatial_structure" },
  { id: "sp_rotator_outer",     label: "Rotateur (extérieur)",     path: `${SPACE}/SpaceStations/Spacestation_2/Meshes/SM_big_rotator_outer.glb`,           defaultScale: 1, category: "spatial_structure" },
  { id: "sp_wheel_inner",       label: "Roue Centrale (int.)",     path: `${SPACE}/SpaceStations/Spacestation_2/Meshes/SM_center_wheel_inner.glb`,          defaultScale: 1, category: "spatial_structure" },
  { id: "sp_wheel_outer",       label: "Roue Centrale (ext.)",     path: `${SPACE}/SpaceStations/Spacestation_2/Meshes/SM_center_wheel_outer.glb`,          defaultScale: 1, category: "spatial_structure" },
  { id: "sp_energy_catcher",    label: "Capteur d'Énergie",        path: `${SPACE}/SpaceStations/Spacestation_2/Meshes/SM_energy_catcher.glb`,              defaultScale: 1, category: "spatial_structure" },
  { id: "sp_wreck_front",       label: "Épave (avant)",            path: `${SPACE}/SpaceStations/Broken_Spaceship/Meshes/SM_Spaceship_broken_front.glb`,    defaultScale: 1, category: "spatial_structure" },
  { id: "sp_wreck_back",        label: "Épave (arrière)",          path: `${SPACE}/SpaceStations/Broken_Spaceship/Meshes/SM_Spaceship_broken_back.glb`,     defaultScale: 1, category: "spatial_structure" },

  // ── Équipement de station ─────────────────────────────────────────────────
  { id: "sp_antenna",           label: "Antenne Orbitale",         path: `${SPACE}/SpaceStations/PowerboxAndAntenna/Meshes/SM_Antenna.glb`,   defaultScale: 1, category: "tech" },
  { id: "sp_powerbox",          label: "Boîtier d'Alimentation",   path: `${SPACE}/SpaceStations/PowerboxAndAntenna/Meshes/SM_powerbox.glb`,  defaultScale: 1, category: "tech" },
  { id: "sp_tesla_bottom",      label: "Bobine Tesla (bas)",       path: `${SPACE}/SpaceStations/TeslaCoil/Meshes/SM_Tesla_Coil_Bottom.glb`,  defaultScale: 1, category: "tech" },
  { id: "sp_tesla_top",         label: "Bobine Tesla (haut)",      path: `${SPACE}/SpaceStations/TeslaCoil/Meshes/SM_Tesla_Coil_Top.glb`,     defaultScale: 1, category: "tech" },
  { id: "sp_energy_pillar",     label: "Pilier d'Énergie",         path: `${SPACE}/Planets/EnergyPillar/SM_Pillar.glb`,                       defaultScale: 1, category: "tech" },
  { id: "sp_lightning",         label: "Arc Électrique",           path: `${SPACEFX}/SM_lightning.glb`,                                       defaultScale: 1, category: "tech" },

  // ── Aménagement intérieur de station ──────────────────────────────────────
  { id: "sp_door_bunk",         label: "Porte Courbe",             path: `${SPACE}/Props/Meshes/SM_door_bunk_a_curved.glb`,          defaultScale: 1, category: "structure" },
  { id: "sp_door_bunk_frame",   label: "Cadre de Porte Courbe",    path: `${SPACE}/Props/Meshes/SM_door_bunk_frame_a_curved.glb`,    defaultScale: 1, category: "structure" },
  { id: "sp_handrail",          label: "Garde-corps",              path: `${SPACE}/Props/Meshes/SM_prop_handrail_b.glb`,             defaultScale: 1, category: "structure" },
  { id: "sp_scaffold",          label: "Échafaudage",              path: `${SPACE}/Props/Meshes/SM_Scaffold_Support_01.glb`,         defaultScale: 1, category: "structure" },
  { id: "sp_drawers",           label: "Casiers de Couchette",     path: `${SPACE}/Props/Meshes/SM_drawers_bunk_medium_a.glb`,       defaultScale: 1, category: "mobilier" },
  { id: "sp_ac_unit",           label: "Climatiseur",              path: `${SPACE}/Props/Meshes/SM_0096_AC_01.glb`,                  defaultScale: 1, category: "tech" },
  { id: "sp_trashcan",          label: "Poubelle",                 path: `${SPACE}/Props/Meshes/SM_HU_Deco_SM_Trashcan.glb`,         defaultScale: 1, category: "divers" },
  { id: "sp_trashbag_02",       label: "Sac Poubelle 02",          path: `${SPACE}/Props/Meshes/SM_TrashBag_02_High.glb`,            defaultScale: 1, category: "divers" },
  { id: "sp_trashbag_06",       label: "Sac Poubelle 06",          path: `${SPACE}/Props/Meshes/SM_TrashBag_06.glb`,                 defaultScale: 1, category: "divers" },
  { id: "sp_newsbox",           label: "Distributeur",             path: `${SPACE}/Props/Meshes/SM_NYC_Deco_Exterior_Newsbox_High.glb`, defaultScale: 1, category: "divers" },

  // ── Débris (habillage de zone endommagée) ────────────────────────────────
  { id: "sp_chunk_1",           label: "Débris 1",                 path: `${SPACE}/Props/Meshes/SM_Chunk_1.glb`, defaultScale: 1, category: "debris" },
  { id: "sp_chunk_2",           label: "Débris 2",                 path: `${SPACE}/Props/Meshes/SM_Chunk_2.glb`, defaultScale: 1, category: "debris" },
  { id: "sp_chunk_3",           label: "Débris 3",                 path: `${SPACE}/Props/Meshes/SM_Chunk_3.glb`, defaultScale: 1, category: "debris" },
  { id: "sp_chunk_4",           label: "Débris 4",                 path: `${SPACE}/Props/Meshes/SM_Chunk_4.glb`, defaultScale: 1, category: "debris" },
  { id: "sp_chunk_5",           label: "Débris 5",                 path: `${SPACE}/Props/Meshes/SM_Chunk_5.glb`, defaultScale: 1, category: "debris" },
  { id: "sp_chunk_6",           label: "Débris 6",                 path: `${SPACE}/Props/Meshes/SM_Chunk_6.glb`, defaultScale: 1, category: "debris" },
];

/** Retourne la définition d'un prop par son id, ou undefined si absent. */
export function getPropDef(id: string): PropDef | undefined {
  return PROP_CATALOG.find((p) => p.id === id);
}
