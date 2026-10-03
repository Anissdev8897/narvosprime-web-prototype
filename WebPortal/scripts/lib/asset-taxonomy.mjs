// ══════════════════════════════════════════════════════════════════════════════
// lib/asset-taxonomy.mjs — Vocabulaire unique des catégories d'assets.
//
// POURQUOI « UN DOMICILE PHYSIQUE, PLUSIEURS TAGS » :
// Les catégories demandées mélangent deux axes qui ne se rangent pas pareil.
//   • des TYPES    : bâtiments, props, armes, personnages, végétation, animations…
//   • des THÈMES   : sci-fi, médiéval, fantasy…
// `ModularMedievalVillage` est à la fois « bâtiments » ET « médiéval ». Lui donner
// un dossier par étiquette obligerait à le dupliquer — 26 Go de nouveaux packs,
// 285 Go au total : impensable. Et un lien symbolique ne survit pas à un `git
// clone` ni au build Vite.
//
// Donc : chaque pack vit dans UN SEUL dossier, choisi sur son type DOMINANT, et
// porte autant de tags qu'il le mérite dans le catalogue. La navigation par thème
// se fait par l'index, pas par l'arborescence.
//
// CONTRAINTE MESURÉE — ne pas renommer les dossiers existants :
// 87 chemins sont codés en dur dans `src/` et visent 20 dossiers de premier
// niveau (`/models/vehicule/` ×29, `/models/Maps/` ×15, `/models/nature/` ×14…).
// Renommer `nature/` en `vegetation/` casserait 14 chargements d'assets sans que
// `tsc` ne dise quoi que ce soit — ce sont des chaînes de caractères. Les noms
// physiques restent donc tels quels ; le libellé français vit dans `label`.
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Catégories PHYSIQUES = dossiers de premier niveau dans `public/models/`.
 *
 * `dir` est le nom réel sur le disque (jamais traduit, cf. les 87 chemins en dur).
 * `label` est ce que l'utilisateur lit dans le catalogue.
 */
export const CATEGORIES = {
  personnages:      { dir: "personnages",      label: "Personnages",      desc: "Avatars jouables, PNJ humanoïdes, skins" },
  pnj:              { dir: "pnj",              label: "PNJ",              desc: "Personnages non joueurs (marchands, quêtes)" },
  pnj_monstre:      { dir: "pnj_monstre",      label: "PNJ — Monstres",   desc: "PNJ hostiles" },
  creatures:        { dir: "creatures",        label: "Créatures",        desc: "Bestiaire, animaux, montures" },
  pet:              { dir: "pet",              label: "Familiers",        desc: "Compagnons" },
  assets_character: { dir: "assets_character", label: "Pièces de perso",  desc: "Éléments modulaires : têtes, tenues, accessoires" },
  armes:            { dir: "armes",            label: "Armes",            desc: "Armes de mêlée, à distance, boucliers" },
  animations:       { dir: "animations",       label: "Animations",       desc: "Clips, packs de locomotion, émotes" },
  batiments:        { dir: "batiments",        label: "Bâtiments",        desc: "Architecture, donjons, villages, kits modulaires", isNew: true },
  environnements:   { dir: "environnements",   label: "Environnements",   desc: "Décors complets, scènes, niveaux" },
  nature:           { dir: "nature",           label: "Végétation & Nature", desc: "Arbres, plantes, roches, terrain" },
  Maps:             { dir: "Maps",             label: "Cartes",           desc: "Maps de jeu (forge, orbital…) et leurs chunks" },
  vfx:              { dir: "vfx",              label: "Effets",           desc: "VFX, traînées, impacts, particules" },
  spells:           { dir: "spells",           label: "Sorts",            desc: "Effets de sorts" },
  materials:        { dir: "materials",        label: "Matériaux",        desc: "Matériaux runtime (auto-material paysage…)" },
  textures:         { dir: "textures",         label: "Textures & HDRI",  desc: "Textures autonomes, HDRI, ciels", isNew: true },
  vehicules:        { dir: "vehicules",        label: "Véhicules",        desc: "Vaisseaux, engins pilotables" },
  vehicule:         { dir: "vehicule",         label: "Véhicules (runtime)", desc: "Véhicules câblés au runtime — 29 chemins en dur, NE PAS RENOMMER" },
  systemes:         { dir: "systemes",         label: "Systèmes",         desc: "Packs de gameplay UE (combat, IA, RPG) — à porter, pas à charger" },
  plugins_cpp:      { dir: "plugins_cpp",      label: "Plugins C++",      desc: "Sources C++ Unreal à étudier et porter dans NarvosEngine", isNew: true },
  interface:        { dir: "interface",        label: "Interface",        desc: "UI, HUD, icônes" },
  HUD_:             { dir: "HUD_",             label: "HUD",              desc: "Éléments de HUD" },
  audio:            { dir: "audio",            label: "Audio",            desc: "Sons, musiques, bruitages" },
  voice_characters: { dir: "voice_characters", label: "Voix",             desc: "Voix de personnages" },
  launcher:         { dir: "launcher",         label: "Launcher",         desc: "Écrans d'accueil, intro, sélection" },
  divers:           { dir: "divers",           label: "Objets divers",    desc: "Props et objets non classés ailleurs" },
  export:           { dir: "export",           label: "Export brut",      desc: "Sorties d'export Unreal — source, pas runtime" },
};

/**
 * Tags TRANSVERSAUX — l'axe que l'arborescence ne peut pas porter.
 *
 * Un pack en cumule autant qu'il en mérite. C'est ce qui rend « montre-moi tout
 * le médiéval » possible sans déplacer un octet.
 */
export const TAGS = {
  // Thèmes
  scifi:     "Sci-fi",
  medieval:  "Médiéval",
  fantasy:   "Fantasy",
  moderne:   "Moderne / contemporain",
  post_apo:  "Post-apocalyptique",
  spatial:   "Spatial / orbital",
  // Types transverses
  props:     "Props",
  objets:    "Objets",
  modulaire: "Kit modulaire",
  // Nature technique
  code:      "Code / système (pas de mesh exploitable)",
  audio:     "Audio",
  texture:   "Texture / HDRI",
};

/**
 * Placement des 22 nouveaux packs de `export/bullet/content/new/`.
 *
 * `to` = catégorie physique (clé de CATEGORIES). `tags` = facettes du catalogue.
 * `note` explique un choix quand il n'est pas évident — c'est ce qui évite qu'on
 * le « corrige » plus tard sans savoir pourquoi il était comme ça.
 */
export const NEW_PACKS = [
  // ── Bâtiments (nouveau dossier : 6 packs, aucun équivalent existant) ────────
  { from: "unreal/DwarvenDungeons_ThroneRoom", to: "batiments", tags: ["medieval", "fantasy", "modulaire"] },
  { from: "unreal/ModularDungeonKit",          to: "batiments", tags: ["medieval", "fantasy", "modulaire"] },
  { from: "unreal/ModularMedievalVillage",     to: "batiments", tags: ["medieval", "modulaire", "props"] },
  { from: "unreal/MysticDungeonEnvironmen",    to: "batiments", tags: ["medieval", "fantasy"] },
  { from: "unreal/StylizedFantasyTown",        to: "batiments", tags: ["medieval", "fantasy", "modulaire"] },
  { from: "unreal/RootCellar",                 to: "batiments", tags: ["medieval", "props"],
    note: "Cave/cellier : intérieur habillé, plus proche d'un bâtiment que d'un décor complet" },

  // ── Environnements (décors complets, pas des kits) ─────────────────────────
  { from: "unreal/SpaceScenes",                to: "environnements", tags: ["scifi", "spatial"] },
  { from: "unreal/TropicalAlienWorld",         to: "environnements", tags: ["scifi", "props"] },

  // ── Personnages ────────────────────────────────────────────────────────────
  { from: "unreal/CyberpunkSamurai",           to: "personnages", tags: ["scifi"] },
  { from: "unreal/Valkiria",                   to: "personnages", tags: ["fantasy"] },
  { from: "unreal/Unreal_Engine_–_SciFi_Trooper_Set_for_Stylized_Male_and_Fema",
    to: "assets_character", tags: ["scifi", "modulaire"],
    rename: "SciFi_Trooper_Set",
    note: "Set modulaire homme/femme → assets_character, pas personnages : ce sont des PIÈCES (tenues, casques), la brique du créateur de perso" },
  { from: "non_unreal_character",              to: "personnages", tags: [],
    rename: "non_unreal_character",
    note: "Seul pack avec des .fbx source (13) — conservés pour le retargeting" },

  // ── Animations ─────────────────────────────────────────────────────────────
  { from: "unreal/StealthLocomotion",          to: "animations", tags: ["moderne"],
    note: "125 GLB d'animation — candidat direct pour le blend de locomotion accroupie" },

  // ── Effets ─────────────────────────────────────────────────────────────────
  { from: "unreal/CartoonyImpactFX",           to: "vfx", tags: [] },
  { from: "unreal/SlashTrail_SoftTofu",        to: "vfx", tags: ["audio"],
    note: "Traînées d'arme + 29 wav d'impact" },

  // ── Végétation ─────────────────────────────────────────────────────────────
  { from: "unreal/StylizedSwampForest",        to: "nature", tags: ["fantasy"] },

  // ── Matériaux ──────────────────────────────────────────────────────────────
  { from: "unreal/MWLandscapeAutoMaterial",    to: "materials", tags: ["texture"],
    note: "SOURCE de l'auto-material paysage déjà porté dans src/rpg/materials/ — à garder à côté de materials/mwam/" },

  // ── Textures & HDRI (nouveau dossier) ──────────────────────────────────────
  { from: "unreal/HDRI_TropicalBeach_8k",      to: "textures", tags: ["texture"] },

  // ── Audio ──────────────────────────────────────────────────────────────────
  { from: "unreal/Footsteps_Sound_Effects_Pro", to: "audio", tags: ["audio"],
    note: "490 wav de pas — à brancher sur le type de surface renvoyé par le raycast sol" },

  // ── Systèmes (code UE : à porter, jamais à charger au runtime) ─────────────
  { from: "unreal/ACF_UltimateFullSampleUE57", to: "systemes", tags: ["code", "audio"],
    note: "Ascent Combat Framework : 132 GLB + 485 wav noyés dans du Blueprint. Valeur = l'architecture de combat, pas les meshes" },
  { from: "unreal/Match3RPGTemplate",          to: "systemes", tags: ["code"] },

  // ── Plugins C++ (nouveau dossier) ──────────────────────────────────────────
  { from: "unreal/AutoTexture to material",    to: "plugins_cpp", tags: ["code"],
    rename: "AutoTextureMaterialSetup",
    note: "Détection de rôle de texture par suffixe + channel packing. Le concept est déjà à moitié dans scripts/textures-to-ktx2.mjs — voir docs/PLUGINS_CPP.md" },
];

/**
 * Classement AUTOMATIQUE des packs préexistants.
 *
 * Le dossier parent porte déjà le type (c'est le classement physique). Ces règles
 * n'ajoutent que les TAGS, déduits du nom. Volontairement conservatrices : un tag
 * absent est un désagrément, un tag faux envoie sur une fausse piste.
 *
 * Ordre indifférent — toutes les règles qui matchent s'appliquent (cumul).
 */
export const TAG_RULES = [
  { tag: "scifi",    re: /sci[-_ ]?fi|space|star|cyber|tech|trooper|alien|robot|mech|orbital|planet|nasa|astro/i },
  { tag: "medieval", re: /medieval|dungeon|castle|knight|dwarv|village|tavern|forge|blacksmith|throne|cellar/i },
  { tag: "fantasy",  re: /fantasy|dragon|magic|mystic|elf|orc|valkir|swamp|rpg/i },
  { tag: "post_apo", re: /post[-_ ]?apo|apocalyp|wasteland|ruin|zombie/i },
  { tag: "spatial",  re: /space|orbital|station|planet|voyager|sparrow|galax|cosmos/i },
  { tag: "moderne",  re: /modern|city|urban|garage|parking|biker|tactical|stealth/i },
  { tag: "modulaire", re: /modular|kit|pack|set|bundle|vol\d/i },
  { tag: "props",    re: /prop|furniture|decor|clutter|barrel|crate/i },
  { tag: "audio",    re: /sound|audio|sfx|voice|music|footstep|foley/i },
  { tag: "texture",  re: /texture|hdri|material|sky|skies|pbr/i },
  { tag: "code",     re: /system|toolkit|framework|template|engine|ai$|gas|combat|multiplayer|traversal|behavior/i },
];

/** Tags déduits d'un nom de pack (+ sa catégorie, qui affine certains cas). */
export function tagsForPack(packName, categoryKey) {
  const tags = new Set();
  for (const { tag, re } of TAG_RULES) {
    if (re.test(packName)) tags.add(tag);
  }
  // `systemes/` ne contient QUE du code par définition du dossier — la règle par
  // nom rate les packs au nom neutre (« UTA », « GWOPRO »).
  if (categoryKey === "systemes" || categoryKey === "plugins_cpp") tags.add("code");
  if (categoryKey === "audio" || categoryKey === "voice_characters") tags.add("audio");
  if (categoryKey === "textures" || categoryKey === "materials") tags.add("texture");
  return [...tags];
}

/** Extensions considérées comme de la géométrie exploitable au runtime. */
export const MESH_EXT = new Set([".glb", ".gltf", ".fbx", ".obj"]);
export const TEX_EXT = new Set([".png", ".jpg", ".jpeg", ".ktx2", ".webp", ".hdr", ".exr", ".tga"]);
export const AUDIO_EXT = new Set([".wav", ".mp3", ".ogg"]);
export const CODE_EXT = new Set([".cpp", ".h", ".cs", ".uplugin", ".uasset"]);
