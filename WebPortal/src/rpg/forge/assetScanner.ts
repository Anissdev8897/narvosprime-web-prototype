/**
 * forge/assetScanner.ts — Scan automatique des modèles GLB disponibles
 *
 * Parcourt récursivement public/models/ et indexe TOUS les sous-dossiers contenant
 * des fichiers .glb (hors dossiers d'animations pures). Génère une liste de catégories
 * avec vignettes et chemins exploitables par l'éditeur Forge.
 *
 * Utilisé par AssetBrowser.tsx — les résultats sont mis en cache via localStorage
 * pour éviter un re-scan à chaque ouverture.
 */

export interface AssetEntry {
  /** Identifiant unique basé sur le chemin relatif */
  id: string;
  /** Nom lisible (dernier segment du dossier + nom du fichier) */
  label: string;
  /** Chemin relatif depuis public/ */
  path: string;
  /** Dossier parent (catégorie) */
  category: string;
  /**
   * Sous-catégorie = dossier FEUILLE d'origine (`trees`, `Aegis`, `2 Models`…).
   *
   * C'est ce que `inferCategory` renvoyait AVANT correction, et qui produisait
   * des centaines de catégories de premier niveau. L'information reste utile —
   * elle sert de second niveau de regroupement DANS une catégorie — mais elle
   * n'a rien à faire au sommet.
   *
   * Optionnelle : les listes construites à la main (équipement, repli statique)
   * n'ont pas de dossier feuille à exposer.
   */
  subCategory?: string;
}

export interface AssetCategory {
  /** Nom de la catégorie (dossier racine : nature, pnj, vehicule, Maps, pet...) */
  name: string;
  /** Label lisible pour l'UI */
  label: string;
  /** Entrées de cette catégorie */
  assets: AssetEntry[];
}

// Dossiers à exclure du scan (animations, bruits, etc.)
const EXCLUDED_FOLDERS = new Set([
  'animation_archer',
  'animation_magie',
  'animation_meelee',
  'animation_shooter',
  'animation_sword_and_shield',
  'animation_punch',
  'creature_animation_melee',
  'animation_adeventure',
  'Pro Magic Pack',
  'Pro Sword and Shield Pack',
  'Weapons',
  '_orig_chunks',
  'audio',
  'launcher',
  'voice_characters',
  'spells',
  'assets_character',
]);

// Extensions autorisées
const VALID_EXT = '.glb';

// Carte de traduction des noms de dossiers en labels français
// ── Taxonomie de PREMIER NIVEAU ───────────────────────────────────────────────
//
// Les 20 dossiers réellement présents sous `public/models/` (recensés sur 9 123
// modèles). C'est la seule taxonomie stable du projet : `CLAUDE.md` interdit de
// renommer ces dossiers, 87 chemins étant codés en dur dans `src/`.
//
// Deux paires singulier/pluriel coexistent sur le disque (`vehicule`/`vehicules`,
// `pnj`/`personnages`). On ne renomme RIEN — on les fusionne à l'affichage via
// CATEGORY_ALIASES, ce qui laisse le disque intact.
const CATEGORY_LABELS: Record<string, string> = {
  personnages:      '🎭 Personnages',
  creatures:        '👹 Créatures & Monstres',
  pet:              '🐾 Animaux & Familiers',
  nature:           '🌿 Nature & Végétation',
  environnements:   '🏞️ Environnements',
  batiments:        '🏛️ Bâtiments & Structures',
  Maps:             '🗺️ Cartes complètes',
  armes:            '⚔️ Armes & Équipement',
  vehicules:        '🚀 Véhicules & Vaisseaux',
  systemes:         '⚙️ Systèmes & Modules',
  vfx:              '✨ Effets visuels',
  materials:        '🎨 Matériaux',
  interface:        '🖥️ Interface',
  animations:       '🏃 Animations (non plaçables)',
  assets_character: '🧍 Pièces de personnage',
  export:           '📤 Exports',
  divers:           '📦 Divers',
};

/** Dossiers distincts sur le disque, mais qui désignent la même famille. */
const CATEGORY_ALIASES: Record<string, string> = {
  vehicule: 'vehicules',
  pnj: 'personnages',
  pnj_monstre: 'creatures',
};

/**
 * Ordre d'affichage de la colonne de catégories.
 *
 * Un tri alphabétique mettrait « Animations » en tête et « Personnages » au
 * milieu : l'ordre le plus utile en édition de map n'est pas alphabétique, il va
 * du vivant au décor puis au technique. Les catégories absentes de cette liste
 * sont ajoutées à la fin, par ordre alphabétique.
 */
const CATEGORY_ORDER: string[] = [
  'personnages', 'creatures', 'pet',
  'nature', 'environnements', 'batiments', 'Maps',
  'armes', 'vehicules', 'systemes',
  'vfx', 'materials', 'interface',
  'assets_character', 'animations', 'export', 'divers',
];

/**
 * Extrait une catégorie lisible depuis un chemin de dossier.
 * Ex: "public/models/nature/retro_nature_pack/models/glTF/trees" → "trees"
 */
/** Segments purement techniques — jamais une catégorie. */
const SEGMENTS_TECHNIQUES = new Set([
  'models', 'glTF', 'gltf', 'Meshes', 'Mesh', 'Low Res', 'Super Low Res', 'GLB', 'FBX', 'public',
]);

/**
 * Catégorie de PREMIER NIVEAU : le dossier juste sous `models/`.
 *
 * ⚠️ C'ÉTAIT LE DERNIER SEGMENT, et c'était la cause du désordre.
 * `/models/nature/retro_nature_pack/models/glTF/trees` renvoyait `trees`. Sur
 * 9 123 modèles répartis dans une arborescence profonde, ça produisait des
 * CENTAINES de catégories de premier niveau (`Aegis`, `Agora`, `Aim`, `AIM`,
 * `0 Island`…), la plupart avec 1 à 3 entrées — d'où une barre de catégories
 * défilant à l'infini vers la droite.
 *
 * Pire : `CATEGORY_LABELS` mappe des noms de PREMIER niveau (`nature`, `pnj`,
 * `vehicule`…). En renvoyant la feuille, la table n'était donc quasiment jamais
 * consultée, et les labels français ne s'affichaient pas.
 *
 * Le premier segment donne 20 catégories stables, celles-là mêmes que
 * `CLAUDE.md` interdit de renommer.
 */
function inferCategory(folder: string): string {
  const parts = folder.replace(/\\/g, '/').split('/').filter(Boolean);
  const i = parts.lastIndexOf('models');
  const brut = (i >= 0 ? parts[i + 1] : parts.find(p => !SEGMENTS_TECHNIQUES.has(p))) ?? 'divers';
  return CATEGORY_ALIASES[brut] ?? brut;
}

/**
 * Sous-catégorie : dossier FEUILLE significatif.
 *
 * C'est l'ancienne valeur de `inferCategory`. Elle garde toute sa valeur comme
 * SECOND niveau de regroupement — « Nature ▸ trees » est lisible, « trees » seul
 * ne l'était pas.
 */
function inferSubCategory(folder: string): string {
  const parts = folder.replace(/\\/g, '/').split('/').filter(Boolean);
  const utiles = parts.filter(p => !SEGMENTS_TECHNIQUES.has(p));
  return utiles[utiles.length - 1] ?? '';
}

/**
 * Formate un label lisible en remplaçant les tirets/underscores par des espaces
 * et en mettant la première lettre en majuscule.
 */
function formatLabel(name: string): string {
  return name
    .replace(/\.glb$/i, '')
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Vérifie si un dossier doit être exclu du scan.
 */
function isExcluded(folderPath: string): boolean {
  const parts = folderPath.replace(/\\/g, '/').split('/');
  return parts.some(p => EXCLUDED_FOLDERS.has(p));
}

/** Racine des ÉQUIPEMENTS (casques/capes/armes…) — déposer les GLB ici pour la bibliothèque. */
export const EQUIPMENT_ROOT = '/models/assets_character/equipe';

/**
 * Scan dédié des ÉQUIPEMENTS (assets_character/equipe). Le scan principal (scanAssets)
 * exclut assets_character (packs d'anim) ; ici on cible UNIQUEMENT le dossier équipement.
 * Renvoie une liste plate d'AssetEntry (label, path) — vide tant qu'aucun GLB n'y est.
 */
export async function scanEquipment(): Promise<AssetEntry[]> {
  try {
    const resp = await fetch('/models_index.json');
    if (!resp.ok) return [];
    const { models } = (await resp.json()) as { models: Array<{ path: string; name: string; folder: string }> };
    return models
      .filter((m) => m.path.toLowerCase().includes('/assets_character/equipe/') && m.path.toLowerCase().endsWith('.glb'))
      .map((m) => ({ id: `eq_${m.path.replace(/[^a-zA-Z0-9]/g, '_')}`, label: formatLabel(m.name), path: m.path.startsWith('/') ? m.path : `/${m.path}`, category: 'equipement' }))
      .sort((a, b) => a.label.localeCompare(b.label));
  } catch { return []; }
}

/**
 * Scanne un dossier pour trouver tous les fichiers GLB.
 * @param basePath Chemin de base (relatif à public/)
 */
export async function scanAssets(basePath = '/models'): Promise<AssetCategory[]> {
  const cacheKey = `forge_asset_scan_${basePath}`;
  const cached = localStorage.getItem(cacheKey);

  // Cache localStorage (5 minutes)
  if (cached) {
    try {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < 300000) {
        return data;
      }
    } catch { /* ignore */ }
  }

  try {
    // SCAN AUTO : index généré par scripts/build-model-index.mjs (TOUS les .glb, 300+).
    // Forme : { models: [{ path, name, folder, sizeKb }] }.
    const response = await fetch(`/models_index.json`);
    if (!response.ok) throw new Error('No index');

    const { models } = (await response.json()) as { models: Array<{ path: string; name: string; folder: string }> };
    const categories = organizeByCategory(models);

    // Mise en cache
    localStorage.setItem(cacheKey, JSON.stringify({ data: categories, timestamp: Date.now() }));
    return categories;
  } catch {
    // Fallback : scan à partir d'une liste pré-générée (static)
    return getStaticAssetList();
  }
}

/**
 * Organise les assets par catégorie depuis l'index auto-généré.
 */
function organizeByCategory(models: Array<{ path: string; name: string; folder: string }>): AssetCategory[] {
  const categoriesMap = new Map<string, AssetEntry[]>();

  for (const m of models) {
    const path = m.path;
    if (!path.toLowerCase().endsWith(VALID_EXT)) continue;
    if (isExcluded(path)) continue;

    const relativePath = path.startsWith('/') ? path : `/${path}`;
    const category = inferCategory(m.folder);

    if (!categoriesMap.has(category)) {
      categoriesMap.set(category, []);
    }

    categoriesMap.get(category)!.push({
      id: `asset_${relativePath.replace(/[^a-zA-Z0-9]/g, '_')}`, // browser-safe (pas de Buffer)
      label: formatLabel(m.name),
      path: relativePath,
      category,
      subCategory: formatLabel(inferSubCategory(m.folder)),
    });
  }

  // TRIER SUR CE QUI EST AFFICHÉ, pas sur la clé interne.
  //
  // C'était `.sort((a, b) => a.name.localeCompare(b.name))` — donc un tri sur la
  // clé de dossier (`nature`, `armes`…) alors que l'interface affiche `label`
  // (« 🌿 Nature & Végétation »). L'ordre visible ne correspondait à aucun ordre
  // lisible : c'est ce qui donnait l'impression d'une bibliothèque en vrac.
  //
  // L'emoji de tête est retiré pour la comparaison, sinon le tri se ferait sur
  // son point de code — ce qui est tout aussi arbitraire que la clé.
  const cleDeTri = (label: string) =>
    label.replace(/^[^\p{L}\p{N}]+/u, '').trim();

  // Ordre MÉTIER puis alphabétique pour le reste — cf. CATEGORY_ORDER.
  const rang = (name: string) => {
    const i = CATEGORY_ORDER.indexOf(name);
    return i === -1 ? CATEGORY_ORDER.length : i;
  };

  return Array.from(categoriesMap.entries())
    .map(([name, assets]) => ({
      name,
      label: CATEGORY_LABELS[name] || formatLabel(name),
      assets: assets.sort((a, b) =>
        // À sous-catégorie égale, tri par nom ; sinon les sous-catégories
        // restent groupées, ce dont l'affichage en colonnes a besoin.
        (a.subCategory ?? '') === (b.subCategory ?? '')
          ? a.label.localeCompare(b.label, 'fr', { sensitivity: 'base', numeric: true })
          : (a.subCategory ?? '').localeCompare(b.subCategory ?? '', 'fr', { sensitivity: 'base' })),
    }))
    .sort((a, b) => {
      const ra = rang(a.name), rb = rang(b.name);
      if (ra !== rb) return ra - rb;
      return cleDeTri(a.label).localeCompare(cleDeTri(b.label), 'fr', { sensitivity: 'base' });
    });
}

/**
 * Liste statique des assets (fallback — générée à partir de la structure connue).
 */
function getStaticAssetList(): AssetCategory[] {
  return [
    {
      name: 'nature',
      label: '🌿 Nature & Végétation',
      assets: [
        { id: 'tree01', label: 'Arbre 01', path: '/models/nature/retro_nature_pack/models/glTF/trees/tree01.glb', category: 'nature' },
        { id: 'tree02', label: 'Arbre 02', path: '/models/nature/retro_nature_pack/models/glTF/trees/tree02.glb', category: 'nature' },
        { id: 'tree03', label: 'Arbre 03', path: '/models/nature/retro_nature_pack/models/glTF/trees/tree03.glb', category: 'nature' },
        { id: 'bush01', label: 'Buisson 01', path: '/models/nature/retro_nature_pack/models/glTF/bushes/bush01.glb', category: 'nature' },
        { id: 'bush02', label: 'Buisson 02', path: '/models/nature/retro_nature_pack/models/glTF/bushes/bush02.glb', category: 'nature' },
        { id: 'grass01', label: 'Herbe 01', path: '/models/nature/retro_nature_pack/models/glTF/grass/grass01.glb', category: 'nature' },
        { id: 'dead_tree01', label: 'Arbre Mort 01', path: '/models/nature/nature_pack2/Models/Low Res/GLB/dead_tree_rt_1.glb', category: 'nature' },
      ],
    },
    {
      name: 'pnj',
      label: '👥 PNJ & Personnages',
      assets: [
        { id: 'general', label: 'PNJ Général', path: '/models/pnj/general/Meshy_AI_biped_Character_output.glb', category: 'pnj' },
        { id: 'soldat', label: 'Soldat', path: '/models/pnj/soldat_humain/Meshy_AI_biped_Character_output.glb', category: 'pnj' },
        { id: 'mercenaire', label: 'Mercenaire', path: '/models/pnj/mercenaire_alien/Meshy_AI_biped_Character_output.glb', category: 'pnj' },
      ],
    },
    {
      name: 'pnj_monstre',
      label: '👹 Monstres & Créatures',
      assets: [
        { id: 'bandit', label: 'Bandit', path: '/models/pnj_monstre/bandit/bandit.glb', category: 'pnj_monstre' },
        { id: 'zombie', label: 'Zombie', path: '/models/pnj_monstre/zombi/zombie.glb', category: 'pnj_monstre' },
        { id: 'lizard', label: 'Lézard', path: '/models/pnj_monstre/lizard/lizard.glb', category: 'pnj_monstre' },
        { id: 'golem_glace', label: 'Golem de Glace', path: '/models/pnj_monstre/golem_glace/golem_glace.glb', category: 'pnj_monstre' },
        { id: 'boss_mob', label: 'Boss Mob', path: '/models/pnj_monstre/boss_mob/boss_mob.glb', category: 'pnj_monstre' },
      ],
    },
    {
      name: 'pet',
      label: '🐾 Animaux & Familiers',
      assets: [
        { id: 'dog', label: 'Chien', path: '/models/pet/dog.glb', category: 'pet' },
        { id: 'cat', label: 'Chat', path: '/models/pet/cat.glb', category: 'pet' },
        { id: 'cow', label: 'Vache', path: '/models/pet/Cow.glb', category: 'pet' },
        { id: 'chicken', label: 'Poule', path: '/models/pet/chichen.glb', category: 'pet' },
        { id: 'lion', label: 'Lion', path: '/models/pet/lion/PSX_lion.glb', category: 'pet' },
      ],
    },
    {
      name: 'vehicule',
      label: '🚀 Véhicules & Vaisseaux',
      assets: [
        { id: 'avion', label: 'Chasseur', path: '/models/vehicule/chasseur_avion.glb', category: 'vehicule' },
        { id: 'terrestre', label: 'Véhicule Terrestre', path: '/models/vehicule/vehicule_terrestre.glb', category: 'vehicule' },
        { id: 'robot', label: 'Robot Niko', path: '/models/vehicule/robot_niko.glb', category: 'vehicule' },
        { id: 'ship1', label: 'Vaisseau 1', path: '/models/vehicule/packship/ship1.glb', category: 'vehicule' },
        { id: 'wraith', label: 'Wraith', path: '/models/vehicule/wraith/wraith.glb', category: 'vehicule' },
      ],
    },
    {
      name: 'Maps',
      label: '🗺️ Décors & Architectures',
      assets: [
        // Le monolithe de la Forge s'appelle `halo_map.glb`, pas `forge_map.glb` :
        // `forge_map` est le nom du DOSSIER. L'entrée pointait un fichier qui
        // n'a jamais existé, et le fallback SPA de Vite répond 200 `text/html`
        // au lieu d'un 404 — donc l'éditeur affichait une entrée morte en silence.
        { id: 'forge_world', label: 'Monde Forge', path: '/models/Maps/forge_map/halo_map.glb', category: 'Maps' },
        { id: 'orbital_hub', label: 'Hub Orbital', path: '/models/Maps/Orbital/Orbital_map.gltf', category: 'Maps' },
        { id: 'tower', label: 'Tour', path: '/models/Maps/tower_map/tower_map.gltf', category: 'Maps' },
        // Le donjon n'existe QUE découpé (`Maps/donjon/chunk_01..04.glb`) : il n'y
        // a plus de monolithe. L'aperçu de l'éditeur charge un GLB unique, donc il
        // montre le premier morceau — et le libellé le dit, plutôt que de laisser
        // croire à une map tronquée.
        { id: 'donjon', label: 'Donjon (chunk 1/4)', path: '/models/Maps/donjon/chunk_01.glb', category: 'Maps' },
      ],
    },
  ];
}

// L'index est généré par scripts/build-model-index.mjs (node) → public/models_index.json.
// Relancer après tout ajout de modèles :  node scripts/build-model-index.mjs
