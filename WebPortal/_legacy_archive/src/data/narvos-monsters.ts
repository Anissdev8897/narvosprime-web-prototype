/**
 * =============================================================================
 * NARVOS PRIME - MONSTRES DU JEU
 * =============================================================================
 * 20 monstres répartis sur 4 régions
 */

import { MonsterData, Spell, Element } from '../types/game.types';

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
    id, name, description, icon, apCost, range, damage, effectType, color, animationConfig,
    zoneShape: effectType === 'area' ? 'circle' : 'single',
    zoneSize: effectType === 'area' ? 2 : 1
});

export const NARVOS_MONSTERS: MonsterData[] = [
    // ═══════════════════════════════════════════════════════════════
    // STATION SPATIALE
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'security_bot',
        name: 'Drone de Sécurité',
        level: 2,
        stats: { hp: 40, pa: 6, pm: 3, puissance: 5, initiative: 90, critique: 5 },
        spriteUrl: '/textures/monstres/Station_Spatiale/monster_station_security_bot.png',
        isSpriteSheet: false,
        isAggressive: true,
        aggroRadius: 12,
        canTalk: false,
        spells: [createSpell('bot_1', 'Rafale Rapide', 'Tirs en série.', '/textures/spells/monsters/monster_quick_strikes.png', 3, 4, { min: 6, max: 10, element: Element.FIRE }, 'projectile', '#ef4444')]
    },
    {
        id: 'glitch_wraith',
        name: 'Spectre Erroné',
        level: 8,
        stats: { hp: 70, pa: 7, pm: 4, puissance: 15, initiative: 110, critique: 10 },
        spriteUrl: '/textures/monstres/Station_Spatiale/monster_station_glitch_wraith.png',
        isSpriteSheet: false,
        isAggressive: true,
        aggroRadius: 15,
        canTalk: true,
        dialogueId: 'aggressive_monster',
        spells: [createSpell('glitch_1', 'Vomissure Toxique', 'Décharge de données corrompues.', '/textures/spells/monsters/monster_toxic_vomit.png', 4, 3, { min: 12, max: 18, element: Element.NEUTRAL }, 'projectile', '#a855f7')]
    },
    {
        id: 'kyridon',
        name: 'Kyridon',
        level: 5,
        stats: { hp: 80, pa: 6, pm: 3, puissance: 5, initiative: 80, critique: 5 },
        spriteUrl: '/textures/monstres/Station_Spatiale/monster_station_kyridon.png',
        isSpriteSheet: false,
        isAggressive: false,
        aggroRadius: 0,
        canTalk: false,
        spells: [createSpell('kyri_1', 'Laser Éclat', 'Tir laser précis.', 'zap', 3, 5, { min: 8, max: 12, element: Element.FIRE }, 'projectile', '#06b6d4')]
    },
    {
        id: 'ombre_stellair',
        name: 'Ombre Stellair',
        level: 8,
        stats: { hp: 60, pa: 7, pm: 5, puissance: 10, initiative: 110, critique: 10 },
        spriteUrl: '/textures/monstres/Station_Spatiale/monster_station_ombre_stellair.png',
        isSpriteSheet: false,
        spells: [createSpell('omb_1', 'Vague Astrale', "Éclat d'énergie pourpre.", 'sparkles', 4, 3, { min: 12, max: 18, element: Element.AIR }, 'area', '#a855f7')]
    },

    // ═══════════════════════════════════════════════════════════════
    // AQUARYS
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'aqua_crab',
        name: 'Crabe des Abysses',
        level: 5,
        stats: { hp: 100, pa: 5, pm: 2, puissance: 10, initiative: 40, critique: 8 },
        spriteUrl: '/textures/monstres/AQUARYS/MONSTER_AQUARYS_CRAB.png',
        isSpriteSheet: false,
        spells: [createSpell('crab_1', 'Frappe Rapide', 'Coups de pinces.', '/textures/spells/monsters/monster_quick_strikes.png', 4, 1, { min: 15, max: 20, element: Element.WATER }, 'melee', '#3b82f6')]
    },
    {
        id: 'coral_golem',
        name: 'Golem de Corail',
        level: 15,
        stats: { hp: 200, pa: 6, pm: 3, puissance: 20, initiative: 30, critique: 2 },
        spriteUrl: '/textures/monstres/AQUARYS/monster_aqua_coral_golem.png',
        isSpriteSheet: false,
        spells: [createSpell('coral_1', 'Balayage Massif', 'Dégâts de zone.', '/textures/spells/monsters/monster_tail_sweep.png', 5, 2, { min: 18, max: 28, element: Element.EARTH }, 'area', '#f43f5e')]
    },
    {
        id: 'squid_bot',
        name: 'Squidbot',
        level: 10,
        stats: { hp: 85, pa: 6, pm: 4, puissance: 12, initiative: 120, critique: 15 },
        spriteUrl: '/textures/monstres/AQUARYS/monster_aqua_squidbot.png',
        isSpriteSheet: false,
        spells: [createSpell('squid_1', "Visions d'Orage", 'Invoque des petits bots.', '/textures/spells/monsters/monster_spawn_minions.png', 3, 5, { min: 10, max: 15, element: Element.WATER }, 'area', '#0ea5e9')]
    },
    {
        id: 'nebula_serpent',
        name: 'Serpent Nébulaire',
        level: 10,
        stats: { hp: 100, pa: 6, pm: 4, puissance: 12, initiative: 100, critique: 15 },
        spriteUrl: '/textures/monstres/AQUARYS/monster_aqua_nebula_serpent.png',
        isSpriteSheet: false,
        spells: [createSpell('neb_1', 'Souffle Stellaire', "Jet d'eau cosmique.", 'wind', 4, 6, { min: 14, max: 22, element: Element.WATER }, 'projectile', '#3b82f6')]
    },

    // ═══════════════════════════════════════════════════════════════
    // DÉSERTICA
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'desert_worm',
        name: 'Ver des Dunes',
        level: 12,
        stats: { hp: 130, pa: 6, pm: 2, puissance: 25, initiative: 60, critique: 10 },
        spriteUrl: '/textures/monstres/DESERTICA/MONSTER_DESERTICA_WORM.png',
        isSpriteSheet: false,
        spells: [createSpell('worm_1', 'Attaque de Queue', 'Frappe lourde.', '/textures/spells/monsters/monster_tail_sweep.png', 5, 1, { min: 25, max: 35, element: Element.EARTH }, 'melee', '#92400e')]
    },
    {
        id: 'rust_vulture',
        name: 'Vautour de Rouille',
        level: 7,
        stats: { hp: 65, pa: 6, pm: 5, puissance: 15, initiative: 130, critique: 20 },
        spriteUrl: '/textures/monstres/DÉSERTICA/monster_desert_rust_vulture.png',
        isSpriteSheet: false,
        spells: [createSpell('vulture_1', 'Frappes Aériennes', 'Coups de bec rapides.', '/textures/spells/monsters/monster_quick_strikes.png', 3, 1, { min: 12, max: 18, element: Element.AIR }, 'melee', '#f59e0b')]
    },
    {
        id: 'scrap_scorpion',
        name: 'Scorpion de Ferraille',
        level: 11,
        stats: { hp: 95, pa: 7, pm: 4, puissance: 18, initiative: 100, critique: 12 },
        spriteUrl: '/textures/monstres/DÉSERTICA/monster_desert_scrap_scorpion.png',
        isSpriteSheet: false,
        spells: [createSpell('scorp_1', 'Double Piqûre', 'Venin métallique.', '/textures/spells/monsters/monster_double_sting.png', 4, 1, { min: 14, max: 22, element: Element.FIRE }, 'melee', '#ef4444')]
    },
    {
        id: 'golem_darniar',
        name: 'Golem de Darniar',
        level: 12,
        stats: { hp: 150, pa: 5, pm: 2, puissance: 15, initiative: 50, critique: 5 },
        spriteUrl: '/textures/monstres/DESERTICA/monster_desert_golem_darniar.png',
        isSpriteSheet: false,
        spells: [createSpell('darn_1', "Choc d'Ambre", 'Explosion terrestre cristalline.', 'mountain', 5, 2, { min: 20, max: 28, element: Element.EARTH }, 'area', '#f59e0b')]
    },

    // ═══════════════════════════════════════════════════════════════
    // FUNGARIA
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'fungus_golem',
        name: 'Golem de Spores',
        level: 20,
        stats: { hp: 300, pa: 6, pm: 2, puissance: 30, initiative: 20, critique: 5 },
        spriteUrl: '/textures/monstres/FUNGARIA/MONSTER_FUNGARIA_GOLEM.png',
        isSpriteSheet: true,
        spells: [createSpell('fungolem_1', 'Libération de Spores', 'Nuage toxique.', '/textures/spells/monsters/monster_toxic_vomit.png', 6, 0, { min: 30, max: 50, element: Element.EARTH }, 'area', '#16a34a')]
    },
    {
        id: 'fungus_mantis',
        name: 'Mante des Mousses',
        level: 14,
        stats: { hp: 120, pa: 7, pm: 5, puissance: 22, initiative: 140, critique: 25 },
        spriteUrl: '/textures/monstres/FUNGARIA/monster_fungus_mantis.png',
        isSpriteSheet: false,
        spells: [createSpell('mantis_1', 'Sectionnement', 'Coups de faux.', '/textures/spells/monsters/monster_quick_strikes.png', 3, 1, { min: 15, max: 22, element: Element.AIR }, 'melee', '#4ade80')]
    },
    {
        id: 'spore_beholder',
        name: 'Observateur de Spores',
        level: 13,
        stats: { hp: 90, pa: 8, pm: 3, puissance: 18, initiative: 105, critique: 15 },
        spriteUrl: '/textures/monstres/FUNGARIA/monster_fungus_spore_beholder.png',
        isSpriteSheet: false,
        spells: [
            createSpell('behold_1', 'Invocation de Spores', 'Appelle des renforts.', '/textures/spells/monsters/monster_spawn_minions.png', 5, 6, { min: 18, max: 25, element: Element.NEUTRAL }, 'area', '#d8b4fe'),
            createSpell('behold_2', 'Vomissure Sporeuse', 'Jet de toxines.', '/textures/spells/monsters/monster_toxic_vomit.png', 3, 4, { min: 10, max: 15, element: Element.EARTH }, 'projectile', '#10b981')
        ]
    },
    {
        id: 'lyseur',
        name: 'Lyseur',
        level: 3,
        stats: { hp: 45, pa: 6, pm: 4, puissance: 5, initiative: 120, critique: 5 },
        spriteUrl: '/textures/monstres/FUNGARIA/monster_fungus_lyseur.png',
        isSpriteSheet: false,
        aiBehavior: 'coward',
        isAggressive: false,
        aggroRadius: 0,
        canTalk: true,
        dialogueId: 'lyseur_peaceful',
        spells: [createSpell('lys_1', 'Flash Aveuglant', 'Diminue la portée.', 'sun', 2, 4, { min: 0, max: 0, element: Element.NEUTRAL }, 'area', '#84cc16')]
    },

    // ═══════════════════════════════════════════════════════════════
    // BOSS
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'lysring_boss',
        name: "L'Architecte Lysring",
        level: 50,
        stats: { hp: 2500, pa: 12, pm: 6, puissance: 50, initiative: 500, critique: 25 },
        spriteUrl: '/textures/monstres/BOSS/monster_lysring_architect.png',
        isSpriteSheet: false,
        aiBehavior: 'strategic',
        spells: [
            createSpell('lys_boss_1', 'Antigravité', 'Attire tous les ennemis.', 'wind', 4, 8, { min: 40, max: 60, element: Element.AIR }, 'area', '#0ea5e9'),
            createSpell('lys_boss_2', 'Code Source', 'Inflige des dégâts neutres massifs.', 'zap', 5, 5, { min: 80, max: 120, element: Element.NEUTRAL }, 'projectile', '#f1f5f9')
        ]
    }
];

// Helper pour obtenir un monstre par ID
export const getMonsterById = (id: string): MonsterData | undefined =>
    NARVOS_MONSTERS.find(m => m.id === id);

// Helper pour obtenir les monstres par niveau
export const getMonstersByLevelRange = (minLevel: number, maxLevel: number): MonsterData[] =>
    NARVOS_MONSTERS.filter(m => m.level >= minLevel && m.level <= maxLevel);
