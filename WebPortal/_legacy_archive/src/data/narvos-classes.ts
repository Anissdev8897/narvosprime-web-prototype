/**
 * =============================================================================
 * NARVOS PRIME - CLASSES DU JEU
 * =============================================================================
 * 10 classes réparties en 3 factions
 */

import { ClassData, Spell, Faction, Element } from '../types/game.types';

// Helper pour créer un sort
const createSpell = (
    id: string,
    name: string,
    description: string,
    icon: string,
    apCost: number,
    range: number,
    damage: { min: number; max: number; element: Element },
    effectType: 'projectile' | 'area' | 'self' | 'melee',
    color: string,
    animationConfig?: { folder: string; prefix: string; frameCount: number }
): Spell => ({
    id,
    name,
    description,
    icon,
    apCost,
    range,
    damage,
    effectType,
    color,
    animationConfig,
    zoneShape: (effectType === 'area' ? 'circle' : 'single') as any,
    zoneSize: (effectType === 'area' ? 1 : 0)
});

export const NARVOS_CLASSES: ClassData[] = [
    // ═══════════════════════════════════════════════════════════════
    // AKARLYS (Faction Humaine)
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'bio_scout',
        name: 'ÉCLAIREUR BIO',
        roleTitle: "Éclaireur d'Akar'lys",
        faction: Faction.AKARLYS,
        description: "Maîtres de la reconnaissance.",
        colors: { primary: '#0ea5e9', secondary: '#38bdf8', skin: '#f1f5f9' },
        stats: { hp: 160, pa: 6, pm: 5, puissance: 15, initiative: 120, critique: 15 },
        spells: [
            createSpell('bio_1', 'Marquage Laser', 'Marque une cible.', 'target', 3, 7, { min: 10, max: 15, element: Element.AIR }, 'projectile', '#0ea5e9'),
            createSpell('bio_2', 'Flèche Aquatique', "Un trait d'énergie bleutée.", '/textures/spells/DESERTICA/SPELL_AQUA_BOLT.png', 4, 6, { min: 14, max: 20, element: Element.WATER }, 'projectile', '#38bdf8')
        ],
        roles: [{ title: 'Reconnaissance', description: 'Excelle pour trouver les failles.', iconType: 'damage' }],
        spriteConfig: {
            useSplitSprites: true,
            maleSpritesFolder: '/textures/personnage/bio_scout/H_bio_scout',
            femaleSpritesFolder: '/textures/personnage/bio_scout/F_bio_scout',
            spriteCount: 8,
            rows: 4, cols: 4, bgToRemove: '#FFFFFF'
        },
        model3D: {
            basePath: '/models/iso_poc/bio_scout/bio_scout_idle.glb',
            animations: {
                idle: '/models/iso_poc/bio_scout/bio_scout_idle.glb',
                walking: '/models/iso_poc/bio_scout/bio_scout_walking.glb',
                running: '/models/iso_poc/bio_scout/bio_scout_running.glb'
            },
            scale: 1,
            rotationY: Math.PI
        }
    },
    {
        id: 'current_breaker',
        name: 'BRISEUR DE FLUX',
        roleTitle: "Briseur d'Akar'lys",
        faction: Faction.AKARLYS,
        description: "Combat rapproché énergétique.",
        colors: { primary: '#ef4444', secondary: '#f87171', skin: '#fef2f2' },
        stats: { hp: 190, pa: 6, pm: 4, puissance: 20, initiative: 100, critique: 10 },
        spells: [
            createSpell('cur_1', 'Choc Électrique', 'Décharge puissante.', 'zap', 4, 1, { min: 20, max: 30, element: Element.FIRE }, 'melee', '#ef4444')
        ],
        roles: [{ title: 'Dégâts', description: 'Force brute énergétique.', iconType: 'damage' }],
        spriteConfig: {
            useSplitSprites: true,
            maleSpritesFolder: '/textures/personnage/current_breaker/H_current_breaker',
            femaleSpritesFolder: '/textures/personnage/current_breaker/F_current_breaker',
            spriteCount: 8,
            rows: 4, cols: 4, bgToRemove: '#FFFFFF'
        },
        model3D: {
            basePath: '/models/iso_poc/current_breaker/current_breaker_idle.glb',
            animations: {
                idle: '/models/iso_poc/current_breaker/current_breaker_idle.glb',
                walking: '/models/iso_poc/current_breaker/current_breaker_walking.glb'
            },
            scale: 1,
            rotationY: Math.PI
        }
    },
    {
        id: 'aquarys_shadow',
        name: "OMBRE D'AQUARYS",
        roleTitle: "Infiltrateur d'Akar'lys",
        faction: Faction.AKARLYS,
        description: "Assassin furtif aquatique.",
        colors: { primary: '#2563eb', secondary: '#60a5fa', skin: '#dbeafe' },
        stats: { hp: 150, pa: 6, pm: 6, puissance: 25, initiative: 130, critique: 20 },
        spells: [
            createSpell('aqua_1', "Lame d'Eau", 'Attaque furtive.', 'dagger', 3, 1, { min: 15, max: 22, element: Element.WATER }, 'melee', '#2563eb')
        ],
        roles: [{ title: 'Assassin', description: 'Discret et mortel.', iconType: 'damage' }],
        spriteConfig: {
            useSplitSprites: true,
            maleSpritesFolder: '/textures/personnage/aquarys_shadow/H_aquarys_shadow',
            femaleSpritesFolder: '/textures/personnage/aquarys_shadow/F_aquarys_shadow',
            spriteCount: 8,
            rows: 4, cols: 4, bgToRemove: '#FFFFFF'
        },
        model3D: {
            basePath: '/models/iso_poc/aquarys_shadow/aquarys_shadow_idle.glb',
            animations: {
                idle: '/models/iso_poc/aquarys_shadow/aquarys_shadow_idle.glb',
                walking: '/models/iso_poc/aquarys_shadow/aquarys_shadow_walking.glb',
                running: '/models/iso_poc/aquarys_shadow/aquarys_shadow_running.glb'
            },
            scale: 1,
            rotationY: Math.PI
        }
    },
    // ═══════════════════════════════════════════════════════════════
    // MEZALAYIS (Faction Mercenaire)
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'desert_mirage',
        name: 'MIRAGE DES SABLES',
        roleTitle: 'Illusionniste Mezalayis',
        faction: Faction.MEZALAYIS,
        description: "Crée des doubles.",
        colors: { primary: '#f59e0b', secondary: '#fbbf24', skin: '#fffbeb' },
        stats: { hp: 165, pa: 6, pm: 5, puissance: 18, initiative: 110, critique: 12 },
        spells: [
            createSpell('mir_1', 'Double Illusoire', 'Invoque un miroir.', 'copy', 4, 3, { min: 0, max: 0, element: Element.NEUTRAL }, 'self', '#f59e0b'),
            createSpell('mir_2', 'Manteau de Sable', 'Invisibilité temporaire.', '/textures/spells/mezalayis/sand_cloak.png', 3, 0, { min: 0, max: 0, element: Element.NEUTRAL }, 'self', '#fbbf24')
        ],
        roles: [{ title: 'Illusion', description: 'Dupe ses ennemis.', iconType: 'support' }],
        spriteConfig: {
            useSplitSprites: true,
            maleSpritesFolder: '/textures/personnage/desert_mirage/H_desert_mirage',
            femaleSpritesFolder: '/textures/personnage/desert_mirage/F_desert_mirage',
            spriteCount: 8,
            rows: 4, cols: 4, bgToRemove: '#FFFFFF'
        },
        model3D: {
            basePath: '/models/iso_poc/desert_mirage/desert_mirage_idle.glb',
            animations: {
                idle: '/models/iso_poc/desert_mirage/desert_mirage_idle.glb',
                walking: '/models/iso_poc/desert_mirage/desert_mirage_walking.glb'
            },
            scale: 1,
            rotationY: Math.PI
        }
    },
    {
        id: 'dust_juggernaut',
        name: 'COLOSSE DE POUSSIÈRE',
        roleTitle: 'Champion Mezalayis',
        faction: Faction.MEZALAYIS,
        description: "Guerrier massif.",
        colors: { primary: '#92400e', secondary: '#b45309', skin: '#fff7ed' },
        stats: { hp: 230, pa: 6, pm: 4, puissance: 22, initiative: 80, critique: 8 },
        spells: [
            createSpell('dust_1', 'Frappe Sismique', 'Blessure en zone.', 'hammer', 5, 2, { min: 18, max: 28, element: Element.EARTH }, 'area', '#92400e')
        ],
        roles: [{ title: 'Brute', description: 'Contrôle le terrain par la force.', iconType: 'damage' }],
        spriteConfig: {
            useSplitSprites: true,
            maleSpritesFolder: '/textures/personnage/dust_juggernaut/H_dust_juggernaut',
            femaleSpritesFolder: '/textures/personnage/dust_juggernaut/F_dust_juggernaut',
            spriteCount: 8,
            rows: 4, cols: 4, bgToRemove: '#FFFFFF'
        },
        model3D: {
            basePath: '/models/iso_poc/dust_juggernaut/dust_juggernaut_idle.glb',
            animations: {
                idle: '/models/iso_poc/dust_juggernaut/dust_juggernaut_idle.glb',
                walking: '/models/iso_poc/dust_juggernaut/dust_juggernaut_walking.glb'
            },
            scale: 1,
            rotationY: Math.PI
        }
    },
    {
        id: 'flux_scavenger',
        name: 'CHAROGNARD DE FLUX',
        roleTitle: 'Récupérateur Mezalayis',
        faction: Faction.MEZALAYIS,
        description: "Recycle l'énergie.",
        colors: { primary: '#4b5563', secondary: '#6b7280', skin: '#f3f4f6' },
        stats: { hp: 180, pa: 7, pm: 4, puissance: 12, initiative: 90, critique: 10 },
        spells: [
            createSpell('flux_1', "Recyclage d'Âme", 'Vole des PA.', 'refresh-cw', 3, 4, { min: 8, max: 12, element: Element.NEUTRAL }, 'projectile', '#4b5563'),
            createSpell('flux_2', 'Recyclage de Combat', 'Transforme les débris en vie.', '/textures/spells/mezalayis/combat_recycling.png', 4, 3, { min: 10, max: 15, element: Element.HEAL }, 'projectile', '#6b7280')
        ],
        roles: [{ title: 'Soutien', description: "Manipule l'énergie résiduelle.", iconType: 'support' }],
        spriteConfig: {
            useSplitSprites: true,
            maleSpritesFolder: '/textures/personnage/flux_scavenger/H_flux_scavenger',
            femaleSpritesFolder: '/textures/personnage/flux_scavenger/F_flux_scavenger',
            spriteCount: 8,
            rows: 4, cols: 4, bgToRemove: '#FFFFFF'
        },
        model3D: {
            basePath: '/models/iso_poc/flux_scavenger/flux_scavenger_idle.glb',
            animations: {
                idle: '/models/iso_poc/flux_scavenger/flux_scavenger_idle.glb',
                walking: '/models/iso_poc/flux_scavenger/flux_scavenger_walking.glb'
            },
            scale: 1,
            rotationY: Math.PI
        }
    },
    // ═══════════════════════════════════════════════════════════════
    // ZAYAN (Faction Alien)
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'canopy_prophet',
        name: 'PROPHÈTE DE LA CANOPÉE',
        roleTitle: 'Mentor Zayan',
        faction: Faction.ZAYAN,
        description: "Sage de la forêt.",
        colors: { primary: '#166534', secondary: '#22c55e', skin: '#f0fdf4' },
        stats: { hp: 175, pa: 7, pm: 3, puissance: 10, initiative: 105, critique: 5 },
        spells: [
            createSpell('can_1', 'Souffle de Vie', 'Soins puissants.', 'leaf', 4, 4, { min: 25, max: 40, element: Element.HEAL }, 'area', '#166534'),
            createSpell('can_2', 'Bio-Régénération', 'Régénération cellulaire continue.', '/textures/spells/zayan/bio_regen.png', 3, 5, { min: 15, max: 20, element: Element.HEAL }, 'projectile', '#22c55e')
        ],
        roles: [{ title: 'Soin', description: 'Intercesseur de la nature.', iconType: 'support' }],
        spriteConfig: {
            useSplitSprites: true,
            maleSpritesFolder: '/textures/personnage/canopy_prophet/H_canopy_prophet',
            femaleSpritesFolder: '/textures/personnage/canopy_prophet/F_canopy_prophet',
            spriteCount: 8,
            rows: 4, cols: 4, bgToRemove: '#FFFFFF'
        },
        model3D: {
            basePath: '/models/iso_poc/canopy_prophet/canopy_prophet_idle.glb',
            animations: {
                idle: '/models/iso_poc/canopy_prophet/canopy_prophet_idle.glb',
                walking: '/models/iso_poc/canopy_prophet/canopy_prophet_walking.glb'
            },
            scale: 1,
            rotationY: Math.PI
        }
    },
    {
        id: 'mycelium_host',
        name: 'HÔTE DU MYCÉLIUM',
        roleTitle: 'Vecteur Zayan',
        faction: Faction.ZAYAN,
        description: "Répand spores et fléaux.",
        colors: { primary: '#701a75', secondary: '#a21caf', skin: '#fdf4ff' },
        stats: { hp: 210, pa: 6, pm: 4, puissance: 18, initiative: 85, critique: 8 },
        spells: [
            createSpell('myc_1', 'Infection', 'Poison durable.', 'skull', 3, 5, { min: 12, max: 18, element: Element.EARTH }, 'projectile', '#701a75'),
            createSpell('myc_2', 'Piège de Mycélium', "Zone d'entrave fongique.", '/textures/spells/zayan/mycelium_trap.png', 4, 3, { min: 10, max: 15, element: Element.EARTH }, 'area', '#a21caf')
        ],
        roles: [{ title: 'Entrave', description: 'Le poison est son allié.', iconType: 'damage' }],
        spriteConfig: {
            useSplitSprites: true,
            maleSpritesFolder: '/textures/personnage/mycelium_host/H_mycelium_host',
            femaleSpritesFolder: '/textures/personnage/mycelium_host/F_mycelium_host',
            spriteCount: 8,
            rows: 4, cols: 4, bgToRemove: '#FFFFFF'
        },
        model3D: {
            basePath: '/models/iso_poc/mycelium_host/mycelium_host_idle.glb',
            animations: {
                idle: '/models/iso_poc/mycelium_host/mycelium_host_idle.glb',
                walking: '/models/iso_poc/mycelium_host/mycelium_host_walking.glb'
            },
            scale: 1,
            rotationY: Math.PI
        }
    },
    {
        id: 'parasite_sower',
        name: 'SEMEUR DE PARASITES',
        roleTitle: 'Druide Zayan',
        faction: Faction.ZAYAN,
        description: "Guerrier aux ronces.",
        colors: { primary: '#3f6212', secondary: '#65a30d', skin: '#f7fee7' },
        stats: { hp: 200, pa: 6, pm: 3, puissance: 15, initiative: 80, critique: 10 },
        spells: [
            createSpell('par_1', 'Ronces Mobiles', 'Retrait PM.', 'sprout', 4, 6, { min: 14, max: 20, element: Element.EARTH }, 'projectile', '#3f6212'),
            createSpell('par_2', 'Semeur de Spores', 'Nuage de spores toxiques.', '/textures/spells/DESERTICA/SPELL_FUNGAL_SPORE.png', 4, 4, { min: 16, max: 22, element: Element.EARTH }, 'area', '#65a30d')
        ],
        roles: [{ title: 'Contrôle', description: 'Dresse la nature contre ses ennemis.', iconType: 'damage' }],
        spriteConfig: {
            useSplitSprites: true,
            maleSpritesFolder: '/textures/personnage/parasite_sower/H_parasite_sower',
            femaleSpritesFolder: '/textures/personnage/parasite_sower/F_parasite_sower',
            spriteCount: 8,
            rows: 4, cols: 4, bgToRemove: '#FFFFFF'
        },
        model3D: {
            basePath: '/models/iso_poc/parasite_sower/parasite_sower_idle.glb',
            animations: {
                idle: '/models/iso_poc/parasite_sower/parasite_sower_idle.glb',
                walking: '/models/iso_poc/parasite_sower/parasite_sower_walking.glb'
            },
            scale: 1,
            rotationY: Math.PI
        }
    },
    {
        id: 'venom_stalker',
        name: 'RÔDEUR DE VENIN',
        roleTitle: 'Assassin Zayan',
        faction: Faction.ZAYAN,
        description: "Chasseur toxique.",
        colors: { primary: '#115e59', secondary: '#14b8a6', skin: '#f0fdfa' },
        stats: { hp: 155, pa: 6, pm: 5, puissance: 22, initiative: 125, critique: 25 },
        spells: [
            createSpell('ven_1', 'Dague de Venin', 'Coup empoisonné.', 'droplet', 3, 1, { min: 10, max: 15, element: Element.AIR }, 'melee', '#115e59')
        ],
        roles: [{ title: 'Dégâts', description: 'Frappe chirurgicale toxique.', iconType: 'damage' }],
        spriteConfig: {
            useSplitSprites: true,
            maleSpritesFolder: '/textures/personnage/venom_stalker/H_venom_stalker',
            femaleSpritesFolder: '/textures/personnage/venom_stalker/F_venom_stalker',
            spriteCount: 8,
            rows: 4, cols: 4, bgToRemove: '#FFFFFF'
        },
        model3D: {
            basePath: '/models/iso_poc/venom_stalker/venom_stalker_idle.glb',
            animations: {
                idle: '/models/iso_poc/venom_stalker/venom_stalker_idle.glb',
                walking: '/models/iso_poc/venom_stalker/venom_stalker_walking.glb'
            },
            scale: 1,
            rotationY: Math.PI
        }
    }
];

// Helper pour obtenir une classe par ID
export const getClassById = (id: string): ClassData | undefined =>
    NARVOS_CLASSES.find(c => c.id === id);

// Helper pour obtenir les classes d'une faction
export const getClassesByFaction = (faction: Faction): ClassData[] =>
    NARVOS_CLASSES.filter(c => c.faction === faction);
