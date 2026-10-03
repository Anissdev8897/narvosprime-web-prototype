/**
 * 🎮 NARVOS PRIME - ASSET DATABASE
 * Base de données centralisée de tous les assets du jeu
 * 
 * Cette base de données référence tous les sprites, maps, animations et ressources
 * générées pour le jeu tactique Dofus-like NARVOS PRIME.
 */

// =====================================================
// 📁 TYPES & INTERFACES
// =====================================================

export interface AssetEntry {
    id: string;
    name: string;
    path: string;
    type: AssetType;
    category: AssetCategory;
    faction?: Faction;
    biome?: Biome;
    frameCount?: number;
    dimensions?: { width: number; height: number };
    description?: string;
    tags?: string[];
}

export type AssetType = 'sprite_sheet' | 'sprite_frame' | 'map' | 'texture' | 'icon' | 'effect';

export type AssetCategory =
    | 'character'
    | 'spell'
    | 'monster'
    | 'map_ville'
    | 'map_exterieur'
    | 'map_donjon'
    | 'map_station'
    | 'ui'
    | 'launcher';

export type Faction = 'AKARLYS' | 'ZAYAN' | 'MEZALAYIS' | 'NEUTRAL';
export type Biome = 'AQUARYS' | 'FUNGARIA' | 'DESERTICA' | 'STATION_SPATIALE';

// =====================================================
// 🎨 BASE DE DONNÉES DES PERSONNAGES
// =====================================================

export const CHARACTER_ASSETS: AssetEntry[] = [
    // === FACTION AKARLYS (Humains - Aquatique) ===
    {
        id: 'akarlys_tank',
        name: 'Rempart (Tank)',
        path: '/textures/personnage/akarlys_tank_sprite_sheet_1767469854642.png',
        type: 'sprite_sheet',
        category: 'character',
        faction: 'AKARLYS',
        frameCount: 16,
        description: 'Gardien des cités sous-marines avec boucliers énergétiques',
        tags: ['tank', 'humain', 'aquatique', 'défensif']
    },
    {
        id: 'akarlys_bioscout',
        name: 'Éclaireur (Support)',
        path: '/textures/personnage/akarlys_bioscout_sprite_sheet_1767469962520.png',
        type: 'sprite_sheet',
        category: 'character',
        faction: 'AKARLYS',
        frameCount: 16,
        description: 'Spécialiste de la bioluminescence, guide et soigneur',
        tags: ['support', 'humain', 'aquatique', 'soin']
    },
    {
        id: 'akarlys_currentbreaker',
        name: 'Briseur de Courant (DPS)',
        path: '/textures/personnage/akarlys_currentbreaker_sprite_sheet_1767469977067.png',
        type: 'sprite_sheet',
        category: 'character',
        faction: 'AKARLYS',
        frameCount: 16,
        description: 'Maître de la vélocité aquatique, paralyseur',
        tags: ['dps', 'humain', 'aquatique', 'rapide']
    },
    {
        id: 'rempart_custom',
        name: 'Rempart Custom',
        path: '/textures/personnage/rempart_custom_sprite_sheet_1767470655489.png',
        type: 'sprite_sheet',
        category: 'character',
        faction: 'AKARLYS',
        frameCount: 16,
        tags: ['tank', 'custom']
    },
    {
        id: 'eclaireur_custom',
        name: 'Éclaireur Custom',
        path: '/textures/personnage/eclaireur_custom_sprite_sheet_1767470671637.png',
        type: 'sprite_sheet',
        category: 'character',
        faction: 'AKARLYS',
        frameCount: 16,
        tags: ['support', 'custom']
    },
    {
        id: 'briseur_custom',
        name: 'Briseur Custom',
        path: '/textures/personnage/briseur_custom_sprite_sheet_1767470686763.png',
        type: 'sprite_sheet',
        category: 'character',
        faction: 'AKARLYS',
        frameCount: 16,
        tags: ['dps', 'custom']
    },

    // === FACTION ZAYAN (Aliens - Fongique) ===
    {
        id: 'zayan_parasitesower',
        name: 'Semeur (DPS)',
        path: '/textures/personnage/zayan_parasitesower_sprite_sheet_1767469993290.png',
        type: 'sprite_sheet',
        category: 'character',
        faction: 'ZAYAN',
        frameCount: 16,
        description: 'Corrompt la biomasse ennemie avec des parasites',
        tags: ['dps', 'alien', 'fongique', 'poison']
    },
    {
        id: 'zayan_canopyprophet',
        name: 'Prophète (Support)',
        path: '/textures/personnage/zayan_canopyprophet_sprite_sheet_1767470009237.png',
        type: 'sprite_sheet',
        category: 'character',
        faction: 'ZAYAN',
        frameCount: 16,
        description: 'Communique avec le Grand Mycélium pour lier les consciences',
        tags: ['support', 'alien', 'fongique', 'lien']
    },
    {
        id: 'zayan_myceliumhost',
        name: 'Hôte du Mycélium (Tank)',
        path: '/textures/personnage/zayan_myceliumhost_sprite_sheet_1767470025237.png',
        type: 'sprite_sheet',
        category: 'character',
        faction: 'ZAYAN',
        frameCount: 16,
        description: 'Fusionné avec des structures fongiques lourdes',
        tags: ['tank', 'alien', 'fongique', 'résistant']
    },
    {
        id: 'semeur_custom',
        name: 'Semeur Custom',
        path: '/textures/personnage/semeur_custom_sprite_sheet_1767470702829.png',
        type: 'sprite_sheet',
        category: 'character',
        faction: 'ZAYAN',
        frameCount: 16,
        tags: ['dps', 'custom']
    },
    {
        id: 'prophete_custom',
        name: 'Prophète Custom',
        path: '/textures/personnage/prophete_custom_sprite_sheet_1767470718255.png',
        type: 'sprite_sheet',
        category: 'character',
        faction: 'ZAYAN',
        frameCount: 16,
        tags: ['support', 'custom']
    },
    {
        id: 'hote_custom',
        name: 'Hôte Custom',
        path: '/textures/personnage/hote_custom_sprite_sheet_1767470735349.png',
        type: 'sprite_sheet',
        category: 'character',
        faction: 'ZAYAN',
        frameCount: 16,
        tags: ['tank', 'custom']
    },

    // === FACTION MEZALAYIS (Mercenaires - Désert) ===
    {
        id: 'mezalayis_pyroalchemist',
        name: 'Alchimiste (DPS)',
        path: '/textures/personnage/mezalayis_pyroalchemist_sprite_sheet_1767470040816.png',
        type: 'sprite_sheet',
        category: 'character',
        faction: 'MEZALAYIS',
        frameCount: 16,
        description: 'Transmute le sable en éclats de verre en fusion',
        tags: ['dps', 'mercenaire', 'désert', 'feu']
    },
    {
        id: 'mezalayis_fluxscavenger',
        name: 'Charognard de Flux (Support)',
        path: '/textures/personnage/mezalayis_fluxscavenger_sprite_sheet_1767470056407.png',
        type: 'sprite_sheet',
        category: 'character',
        faction: 'MEZALAYIS',
        frameCount: 16,
        description: 'Recycle l\'énergie résiduelle des combats',
        tags: ['support', 'mercenaire', 'désert', 'ressources']
    },
    {
        id: 'mezalayis_desertmirage',
        name: 'Mirage (Assassin)',
        path: '/textures/personnage/mezalayis_desertmirage_sprite_sheet_1767470072430.png',
        type: 'sprite_sheet',
        category: 'character',
        faction: 'MEZALAYIS',
        frameCount: 16,
        description: 'Crée des reflets trompeurs et frappe dans l\'ombre',
        tags: ['assassin', 'mercenaire', 'désert', 'furtif']
    },
    {
        id: 'mezalayis_dustjuggernaut',
        name: 'Juggernaut (Tank)',
        path: '/textures/personnage/mezalayis_dustjuggernaut_sprite_sheet_1767470088346.png',
        type: 'sprite_sheet',
        category: 'character',
        faction: 'MEZALAYIS',
        frameCount: 16,
        description: 'Attire les débris métalliques pour s\'armer',
        tags: ['tank', 'mercenaire', 'désert', 'armure']
    },
    {
        id: 'alchimiste_custom',
        name: 'Alchimiste Custom',
        path: '/textures/personnage/alchimiste_custom_sprite_sheet_1767470750451.png',
        type: 'sprite_sheet',
        category: 'character',
        faction: 'MEZALAYIS',
        frameCount: 16,
        tags: ['dps', 'custom']
    },
    {
        id: 'charognard_custom',
        name: 'Charognard Custom',
        path: '/textures/personnage/charognard_custom_sprite_sheet_1767470768196.png',
        type: 'sprite_sheet',
        category: 'character',
        faction: 'MEZALAYIS',
        frameCount: 16,
        tags: ['support', 'custom']
    },
    {
        id: 'mirage_custom',
        name: 'Mirage Custom',
        path: '/textures/personnage/mirage_custom_sprite_sheet_1767470781221.png',
        type: 'sprite_sheet',
        category: 'character',
        faction: 'MEZALAYIS',
        frameCount: 16,
        tags: ['assassin', 'custom']
    }
];

// =====================================================
// 🔮 BASE DE DONNÉES DES SORTS
// =====================================================

export const SPELL_ASSETS: AssetEntry[] = [
    // === SORTS AKARLYS ===
    {
        id: 'compression_sphere',
        name: 'Sphère de Compression',
        path: '/textures/spells/compression_sphere.png',
        type: 'sprite_sheet',
        category: 'spell',
        faction: 'AKARLYS',
        frameCount: 16,
        description: 'Ralentit les projectiles de 80% et inflige des dégâts continus',
        tags: ['défensif', 'eau', 'zone']
    },
    {
        id: 'aqua_bolt',
        name: 'Aqua Bolt',
        path: '/textures/spells/aqua_bolt.png',
        type: 'sprite_sheet',
        category: 'spell',
        faction: 'AKARLYS',
        frameCount: 8,
        description: 'Éclair d\'énergie aquatique',
        tags: ['offensif', 'eau', 'projectile']
    },
    {
        id: 'restoration_flash',
        name: 'Flash de Restauration',
        path: '/textures/spells/restoration_flash.png',
        type: 'sprite_sheet',
        category: 'spell',
        faction: 'AKARLYS',
        frameCount: 10,
        description: 'Aveugle les ennemis et soigne les alliés',
        tags: ['soin', 'lumière', 'zone']
    },
    {
        id: 'hydro_shield',
        name: 'Bouclier Hydro',
        path: '/textures/spells/hydro_shield.png',
        type: 'sprite_sheet',
        category: 'spell',
        faction: 'AKARLYS',
        frameCount: 8,
        description: 'Protection plasma-aquatique',
        tags: ['défensif', 'eau', 'bouclier']
    },

    // === SORTS ZAYAN ===
    {
        id: 'infestation',
        name: 'Infestation',
        path: '/textures/spells/infestation.png',
        type: 'sprite_sheet',
        category: 'spell',
        faction: 'ZAYAN',
        frameCount: 16,
        description: 'Lance une spore qui libère des créatures à la mort de la cible',
        tags: ['offensif', 'poison', 'invocation']
    },
    {
        id: 'fungal_spore',
        name: 'Spore Putride',
        path: '/textures/spells/fungal_spore.png',
        type: 'sprite_sheet',
        category: 'spell',
        faction: 'ZAYAN',
        frameCount: 10,
        description: 'Dégâts fongiques en zone',
        tags: ['offensif', 'poison', 'zone']
    },
    {
        id: 'nervous_symbiosis',
        name: 'Symbiose Nerveuse',
        path: '/textures/spells/nervous_symbiosis.png',
        type: 'sprite_sheet',
        category: 'spell',
        faction: 'ZAYAN',
        frameCount: 12,
        description: 'Transfère 50% des dégâts d\'un allié vers soi',
        tags: ['défensif', 'lien', 'support']
    },
    {
        id: 'transplantation',
        name: 'Transplantation',
        path: '/textures/spells/transplantation.png',
        type: 'sprite_sheet',
        category: 'spell',
        faction: 'ZAYAN',
        frameCount: 16,
        description: 'S\'enterre et ressort sous un ennemi pour l\'immobiliser',
        tags: ['offensif', 'mouvement', 'contrôle']
    },

    // === SORTS MEZALAYIS ===
    {
        id: 'glass_storm',
        name: 'Tempête de Verre',
        path: '/textures/spells/glass_storm.png',
        type: 'sprite_sheet',
        category: 'spell',
        faction: 'MEZALAYIS',
        frameCount: 14,
        description: 'Le sable devient des éclats de verre brûlants',
        tags: ['offensif', 'feu', 'zone']
    },
    {
        id: 'scrap_shot',
        name: 'Tir de Ferraille',
        path: '/textures/spells/scrap_shot.png',
        type: 'sprite_sheet',
        category: 'spell',
        faction: 'MEZALAYIS',
        frameCount: 8,
        description: 'Tir puissant de récupération',
        tags: ['offensif', 'physique', 'projectile']
    },
    {
        id: 'thermal_distortion',
        name: 'Distorsion Thermique',
        path: '/textures/spells/thermal_distortion.png',
        type: 'sprite_sheet',
        category: 'spell',
        faction: 'MEZALAYIS',
        frameCount: 14,
        description: 'Crée deux clones thermiques et devient invisible',
        tags: ['utilitaire', 'illusion', 'furtif']
    },
    {
        id: 'magnetite_plating',
        name: 'Blindage de Magnétite',
        path: '/textures/spells/magnetite_plating.png',
        type: 'sprite_sheet',
        category: 'spell',
        faction: 'MEZALAYIS',
        frameCount: 12,
        description: 'Attire les débris pour tripler ses PV temporairement',
        tags: ['défensif', 'armure', 'buff']
    },

    // === ATTAQUES MONSTRES ===
    {
        id: 'monster_toxic_ray',
        name: 'Rayon Toxique',
        path: '/textures/spells/monster_toxic_ray.png',
        type: 'sprite_sheet',
        category: 'monster',
        faction: 'NEUTRAL',
        frameCount: 16,
        description: 'Attaque de boss - Rayon de poison continu',
        tags: ['boss', 'poison', 'rayon']
    },
    {
        id: 'monster_massive_leap',
        name: 'Saut Massif',
        path: '/textures/spells/monster_massive_leap.png',
        type: 'sprite_sheet',
        category: 'monster',
        faction: 'NEUTRAL',
        frameCount: 14,
        description: 'Attaque de boss - Écrasement en zone',
        tags: ['boss', 'physique', 'zone']
    }
];

// =====================================================
// 🗺️ BASE DE DONNÉES DES MAPS
// =====================================================

export const MAP_ASSETS: AssetEntry[] = [
    // === AQUARYS - VILLES ===
    ...Array.from({ length: 10 }, (_, i) => ({
        id: `aquarys_ville_${i + 1}`,
        name: `Aquarys Ville ${i + 1}`,
        path: `/textures/dofus_maps/AQUARYS/ville/aquarys_ville_${i + 1}.png`,
        type: 'map' as AssetType,
        category: 'map_ville' as AssetCategory,
        faction: 'AKARLYS' as Faction,
        biome: 'AQUARYS' as Biome,
        dimensions: { width: 1024, height: 1024 },
        description: 'Cité sous-marine avec architecture bioluminescente',
        tags: ['ville', 'aquatique', 'sécurisé']
    })),

    // === AQUARYS - EXTÉRIEURS ===
    ...Array.from({ length: 10 }, (_, i) => ({
        id: `aquarys_exterior_${i + 1}`,
        name: `Aquarys Extérieur ${i + 1}`,
        path: `/textures/dofus_maps/AQUARYS/exterieur_ville/aquarys_exterior_${i + 1}.png`,
        type: 'map' as AssetType,
        category: 'map_exterieur' as AssetCategory,
        faction: 'AKARLYS' as Faction,
        biome: 'AQUARYS' as Biome,
        dimensions: { width: 1024, height: 1024 },
        description: 'Fonds marins avec récifs coralliens',
        tags: ['extérieur', 'aquatique', 'combat']
    })),

    // === AQUARYS - DONJON ===
    ...Array.from({ length: 5 }, (_, i) => ({
        id: `aquarys_donjon_${i + 1}`,
        name: `Aquarys Donjon Salle ${i + 1}`,
        path: `/textures/dofus_maps/AQUARYS/donjon/aquarys_donjon_${i + 1}.png`,
        type: 'map' as AssetType,
        category: 'map_donjon' as AssetCategory,
        faction: 'AKARLYS' as Faction,
        biome: 'AQUARYS' as Biome,
        dimensions: { width: 1024, height: 1024 },
        description: i === 4 ? 'Salle de boss' : `Salle de combat ${i + 1}`,
        tags: ['donjon', 'aquatique', i === 4 ? 'boss' : 'combat']
    })),

    // === FUNGARIA - VILLES ===
    ...Array.from({ length: 10 }, (_, i) => ({
        id: `fungaria_ville_${i + 1}`,
        name: `Fungaria Ville ${i + 1}`,
        path: `/textures/dofus_maps/FUNGARIA/ville/fungaria_ville_${i + 1}.png`,
        type: 'map' as AssetType,
        category: 'map_ville' as AssetCategory,
        faction: 'ZAYAN' as Faction,
        biome: 'FUNGARIA' as Biome,
        dimensions: { width: 1024, height: 1024 },
        description: 'Cité fongique avec architecture organique',
        tags: ['ville', 'fongique', 'sécurisé']
    })),

    // === FUNGARIA - EXTÉRIEURS ===
    ...Array.from({ length: 10 }, (_, i) => ({
        id: `fungaria_exterior_${i + 1}`,
        name: `Fungaria Extérieur ${i + 1}`,
        path: `/textures/dofus_maps/FUNGARIA/exterieur_ville/fungaria_exterior_${i + 1}.png`,
        type: 'map' as AssetType,
        category: 'map_exterieur' as AssetCategory,
        faction: 'ZAYAN' as Faction,
        biome: 'FUNGARIA' as Biome,
        dimensions: { width: 1024, height: 1024 },
        description: 'Forêt de champignons géants',
        tags: ['extérieur', 'fongique', 'combat']
    })),

    // === FUNGARIA - DONJON ===
    ...Array.from({ length: 5 }, (_, i) => ({
        id: `fungaria_donjon_${i + 1}`,
        name: `Fungaria Donjon Salle ${i + 1}`,
        path: `/textures/dofus_maps/FUNGARIA/donjon/fungaria_donjon_${i + 1}.png`,
        type: 'map' as AssetType,
        category: 'map_donjon' as AssetCategory,
        faction: 'ZAYAN' as Faction,
        biome: 'FUNGARIA' as Biome,
        dimensions: { width: 1024, height: 1024 },
        description: i === 4 ? 'Chambre de la Reine' : `Salle de combat ${i + 1}`,
        tags: ['donjon', 'fongique', i === 4 ? 'boss' : 'combat']
    })),

    // === DÉSERTICA - VILLES ===
    ...Array.from({ length: 10 }, (_, i) => ({
        id: `desertica_ville_${i + 1}`,
        name: `Désertica Ville ${i + 1}`,
        path: `/textures/dofus_maps/DÉSERTICA/ville/desertica_ville_${i + 1}.png`,
        type: 'map' as AssetType,
        category: 'map_ville' as AssetCategory,
        faction: 'MEZALAYIS' as Faction,
        biome: 'DESERTICA' as Biome,
        dimensions: { width: 1024, height: 1024 },
        description: 'Avant-poste mercenaire dans le désert',
        tags: ['ville', 'désert', 'sécurisé']
    })),

    // === DÉSERTICA - EXTÉRIEURS ===
    ...Array.from({ length: 10 }, (_, i) => ({
        id: `desertica_exterior_${i + 1}`,
        name: `Désertica Extérieur ${i + 1}`,
        path: `/textures/dofus_maps/DÉSERTICA/exterieur_ville/desertica_exterior_${i + 1}.png`,
        type: 'map' as AssetType,
        category: 'map_exterieur' as AssetCategory,
        faction: 'MEZALAYIS' as Faction,
        biome: 'DESERTICA' as Biome,
        dimensions: { width: 1024, height: 1024 },
        description: 'Terres arides et ruines',
        tags: ['extérieur', 'désert', 'combat']
    })),

    // === DÉSERTICA - DONJON ===
    ...Array.from({ length: 5 }, (_, i) => ({
        id: `desertica_donjon_${i + 1}`,
        name: `Désertica Donjon Salle ${i + 1}`,
        path: `/textures/dofus_maps/DÉSERTICA/donjon/desertica_donjon_${i + 1}.png`,
        type: 'map' as AssetType,
        category: 'map_donjon' as AssetCategory,
        faction: 'MEZALAYIS' as Faction,
        biome: 'DESERTICA' as Biome,
        dimensions: { width: 1024, height: 1024 },
        description: i === 4 ? 'Caveau du trésor' : `Salle de combat ${i + 1}`,
        tags: ['donjon', 'désert', i === 4 ? 'boss' : 'combat']
    })),

    // === STATION SPATIALE ===
    ...Array.from({ length: 5 }, (_, i) => ({
        id: `station_spatiale_${i + 1}`,
        name: `Station Spatiale ${i + 1}`,
        path: `/textures/dofus_maps/Station_Spatiale/station/station_spatiale_${i + 1}.png`,
        type: 'map' as AssetType,
        category: 'map_station' as AssetCategory,
        faction: 'NEUTRAL' as Faction,
        biome: 'STATION_SPATIALE' as Biome,
        dimensions: { width: 1024, height: 1024 },
        description: ['Baie d\'amarrage', 'Centre de commande', 'Quartiers', 'Ingénierie', 'Observatoire'][i],
        tags: ['station', 'espace', 'neutre']
    }))
];

// =====================================================
// 🖼️ BASE DE DONNÉES UI & LAUNCHER
// =====================================================

export const UI_ASSETS: AssetEntry[] = [
    {
        id: 'launcher_bg_1',
        name: 'Launcher Background 1',
        path: '/textures/launcher/uploaded_image_0_1767472596705.jpg',
        type: 'texture',
        category: 'launcher',
        description: 'Image de fond principale du launcher',
        tags: ['launcher', 'background', 'sci-fi']
    },
    {
        id: 'launcher_bg_2',
        name: 'Launcher Background 2',
        path: '/textures/launcher/uploaded_image_1_1767472596705.jpg',
        type: 'texture',
        category: 'launcher',
        description: 'Image de fond secondaire du launcher',
        tags: ['launcher', 'background', 'overlay']
    }
];

// =====================================================
// 📊 STATISTIQUES & HELPERS
// =====================================================

export const ASSET_DATABASE = {
    characters: CHARACTER_ASSETS,
    spells: SPELL_ASSETS,
    maps: MAP_ASSETS,
    ui: UI_ASSETS,

    // Méthodes utilitaires
    getAll(): AssetEntry[] {
        return [...CHARACTER_ASSETS, ...SPELL_ASSETS, ...MAP_ASSETS, ...UI_ASSETS];
    },

    getById(id: string): AssetEntry | undefined {
        return this.getAll().find(a => a.id === id);
    },

    getByFaction(faction: Faction): AssetEntry[] {
        return this.getAll().filter(a => a.faction === faction);
    },

    getByCategory(category: AssetCategory): AssetEntry[] {
        return this.getAll().filter(a => a.category === category);
    },

    getByBiome(biome: Biome): AssetEntry[] {
        return this.getAll().filter(a => a.biome === biome);
    },

    getStats() {
        const all = this.getAll();
        return {
            total: all.length,
            characters: CHARACTER_ASSETS.length,
            spells: SPELL_ASSETS.length,
            maps: MAP_ASSETS.length,
            ui: UI_ASSETS.length,
            byFaction: {
                AKARLYS: this.getByFaction('AKARLYS').length,
                ZAYAN: this.getByFaction('ZAYAN').length,
                MEZALAYIS: this.getByFaction('MEZALAYIS').length,
                NEUTRAL: this.getByFaction('NEUTRAL').length
            },
            byBiome: {
                AQUARYS: this.getByBiome('AQUARYS').length,
                FUNGARIA: this.getByBiome('FUNGARIA').length,
                DESERTICA: this.getByBiome('DESERTICA').length,
                STATION_SPATIALE: this.getByBiome('STATION_SPATIALE').length
            }
        };
    }
};

// Export par défaut
export default ASSET_DATABASE;
