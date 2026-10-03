/**
 * Configuration pour une animation spécifique basée sur une spritesheet.
 */
export interface SpritesheetConfig {
    animation: string;
    frameWidth: number;
    frameHeight: number;
    columns: number;
    rows: number;
    frameCount: number;
    fps: number;
    loop: boolean;
    isFlatSpritesheet?: boolean;
    flatImageName?: string;
    assetType?: 'V4_HERO' | 'V4_MONSTER' | 'V4_NPC' | 'PROP' | 'LEGACY_NPC'; 
}

const PRE_MADE_CONFIG: Record<string, SpritesheetConfig> = {
    'Idle': { animation: 'Idle', flatImageName: 'Idle', frameWidth: 32, frameHeight: 32, columns: 4, rows: 3, frameCount: 4, fps: 3, loop: true, isFlatSpritesheet: true },
    'Run': { animation: 'Run', flatImageName: 'Run', frameWidth: 32, frameHeight: 32, columns: 8, rows: 3, frameCount: 8, fps: 12, loop: true, isFlatSpritesheet: true },
    'Walk': { animation: 'Walk', flatImageName: 'Walk', frameWidth: 32, frameHeight: 32, columns: 6, rows: 3, frameCount: 6, fps: 10, loop: true, isFlatSpritesheet: true },
    'Attack_01': { animation: 'Attack_01', flatImageName: 'Sword', frameWidth: 32, frameHeight: 32, columns: 10, rows: 3, frameCount: 10, fps: 12, loop: false, isFlatSpritesheet: true },
    'Hit': { animation: 'Hit', flatImageName: 'Damage', frameWidth: 32, frameHeight: 32, columns: 4, rows: 3, frameCount: 4, fps: 8, loop: false, isFlatSpritesheet: true },
    'Death': { animation: 'Death', flatImageName: 'Dead', frameWidth: 32, frameHeight: 32, columns: 4, rows: 3, frameCount: 4, fps: 6, loop: false, isFlatSpritesheet: true },
};

/**
 * Registre central des configurations d'animations pour le système V4 (Spritesheets).
 */
export const SPRITESHEET_ANIMATIONS: Record<string, Record<string, SpritesheetConfig>> = {
    'HalberdWarrior': {
        'Idle': { animation: 'Idle', frameWidth: 320, frameHeight: 320, columns: 5, rows: 4, frameCount: 16, fps: 12, loop: true },
        'Run': { animation: 'Run', frameWidth: 320, frameHeight: 320, columns: 5, rows: 4, frameCount: 16, fps: 20, loop: true },
        'Attack_01': { animation: 'Attack_01', frameWidth: 320, frameHeight: 320, columns: 5, rows: 4, frameCount: 20, fps: 18, loop: false },
        'Death': { animation: 'Death', frameWidth: 320, frameHeight: 320, columns: 5, rows: 4, frameCount: 20, fps: 12, loop: false },
        'Hit': { animation: 'Hit', frameWidth: 320, frameHeight: 320, columns: 5, rows: 3, frameCount: 15, fps: 15, loop: false },
    },
    'monstre': { 
        'Idle': { animation: 'Idle', frameWidth: 320, frameHeight: 320, columns: 4, rows: 1, frameCount: 4, fps: 4, loop: true },
        'Run': { animation: 'Run', frameWidth: 320, frameHeight: 320, columns: 8, rows: 1, frameCount: 8, fps: 12, loop: true },
        'Walk': { animation: 'Walk', frameWidth: 320, frameHeight: 320, columns: 8, rows: 1, frameCount: 8, fps: 10, loop: true },
        'Attack_01': { animation: 'Attack_01', frameWidth: 320, frameHeight: 320, columns: 5, rows: 4, frameCount: 20, fps: 18, loop: false },
        'Death': { animation: 'Death', frameWidth: 320, frameHeight: 320, columns: 5, rows: 4, frameCount: 20, fps: 12, loop: false },
        'Hit': { animation: 'Hit', frameWidth: 320, frameHeight: 320, columns: 5, rows: 3, frameCount: 15, fps: 15, loop: false },
    }
};

const MONSTERS_CONFIG: Record<string, SpritesheetConfig> = {
    'Idle': { animation: 'Idle', flatImageName: 'Idle', frameWidth: 64, frameHeight: 64, columns: 4, rows: 4, frameCount: 16, fps: 6, loop: true, isFlatSpritesheet: true },
    'Run': { animation: 'Run', flatImageName: 'Walk', frameWidth: 64, frameHeight: 64, columns: 4, rows: 4, frameCount: 16, fps: 8, loop: true, isFlatSpritesheet: true },
    'Attack_01': { animation: 'Attack_01', flatImageName: 'Attack', frameWidth: 64, frameHeight: 64, columns: 4, rows: 4, frameCount: 16, fps: 10, loop: false, isFlatSpritesheet: true },
    'Hit': { animation: 'Hit', flatImageName: 'Damage', frameWidth: 64, frameHeight: 64, columns: 4, rows: 4, frameCount: 16, fps: 8, loop: false, isFlatSpritesheet: true },
    'Death': { animation: 'Death', flatImageName: 'Death', frameWidth: 64, frameHeight: 64, columns: 4, rows: 4, frameCount: 16, fps: 6, loop: false, isFlatSpritesheet: true },
};

// Configuration pour Knight Man (11x7, 77 frames)
const KNIGHT_MAN_CONFIG: Record<string, SpritesheetConfig> = {
    'Idle': { animation: 'Idle', frameWidth: 256, frameHeight: 256, columns: 11, rows: 7, frameCount: 11, fps: 12, loop: true, assetType: 'V4_HERO' },
    'Run': { animation: 'Run', frameWidth: 256, frameHeight: 256, columns: 11, rows: 7, frameCount: 11, fps: 18, loop: true, assetType: 'V4_HERO' },
    'Slash1': { animation: 'Slash1', frameWidth: 256, frameHeight: 256, columns: 11, rows: 7, frameCount: 11, fps: 20, loop: false, assetType: 'V4_HERO' },
    'Attack_01': { animation: 'Attack_01', frameWidth: 256, frameHeight: 256, columns: 11, rows: 7, frameCount: 11, fps: 20, loop: false, assetType: 'V4_HERO' },
};

// Configuration pour Knight Girl et Thief (8x3, 24 frames)
const KNIGHT_GIRL_CONFIG: Record<string, SpritesheetConfig> = {
    'Idle': { animation: 'Idle', frameWidth: 256, frameHeight: 256, columns: 8, rows: 3, frameCount: 8, fps: 10, loop: true, assetType: 'V4_HERO' },
    'Run': { animation: 'Run', frameWidth: 256, frameHeight: 256, columns: 8, rows: 3, frameCount: 8, fps: 16, loop: true, assetType: 'V4_HERO' },
    'Slash1': { animation: 'Slash1', frameWidth: 256, frameHeight: 256, columns: 8, rows: 3, frameCount: 8, fps: 15, loop: false, assetType: 'V4_HERO' },
    'Attack_01': { animation: 'Attack_01', frameWidth: 256, frameHeight: 256, columns: 8, rows: 3, frameCount: 8, fps: 15, loop: false, assetType: 'V4_HERO' },
};

// Configuration pour Assembled Optimized (8x1, 8 frames)
const ASSEMBLED_V4_CONFIG: Record<string, SpritesheetConfig> = {
    'Idle': { animation: 'Idle', frameWidth: 320, frameHeight: 320, columns: 8, rows: 1, frameCount: 8, fps: 10, loop: true },
    'Run': { animation: 'Run', frameWidth: 320, frameHeight: 320, columns: 8, rows: 1, frameCount: 8, fps: 16, loop: true },
    'Jump': { animation: 'Jump', frameWidth: 320, frameHeight: 320, columns: 8, rows: 1, frameCount: 8, fps: 12, loop: false },
};

// Configuration spécifique Prototyping Hero (8x1, 8 frames)
const PROTOTYPING_HERO_CONFIG: Record<string, SpritesheetConfig> = {
    'Idle': { animation: 'Idle', frameWidth: 180, frameHeight: 180, columns: 8, rows: 1, frameCount: 8, fps: 10, loop: true },
    'Run': { animation: 'Run', frameWidth: 180, frameHeight: 180, columns: 8, rows: 1, frameCount: 8, fps: 16, loop: true },
    'Walk': { animation: 'Walk', frameWidth: 180, frameHeight: 180, columns: 8, rows: 1, frameCount: 8, fps: 12, loop: true },
    'Jump': { animation: 'Jump', frameWidth: 180, frameHeight: 180, columns: 8, rows: 1, frameCount: 8, fps: 12, loop: false },
};

// Configuration pour HalberdWarrior (5x4, 20 frames)
const HALBERD_V4_CONFIG: Record<string, SpritesheetConfig> = {
    'Idle': { animation: 'Idle', frameWidth: 320, frameHeight: 320, columns: 5, rows: 4, frameCount: 20, fps: 12, loop: true },
    'Run': { animation: 'Run', frameWidth: 320, frameHeight: 320, columns: 5, rows: 4, frameCount: 16, fps: 20, loop: true },
};

// Configuration générique pour les Héros V4 (320x320)
const HERO_V4_CONFIG: Record<string, SpritesheetConfig> = {
    'Idle': { animation: 'Idle', frameWidth: 320, frameHeight: 320, columns: 5, rows: 4, frameCount: 16, fps: 12, loop: true },
    'Run': { animation: 'Run', frameWidth: 320, frameHeight: 320, columns: 5, rows: 4, frameCount: 16, fps: 20, loop: true },
    'Walk': { animation: 'Walk', frameWidth: 320, frameHeight: 320, columns: 5, rows: 4, frameCount: 16, fps: 12, loop: true },
    'Attack_01': { animation: 'Attack_01', frameWidth: 320, frameHeight: 320, columns: 5, rows: 4, frameCount: 20, fps: 18, loop: false },
    'Death': { animation: 'Death', frameWidth: 320, frameHeight: 320, columns: 5, rows: 4, frameCount: 20, fps: 12, loop: false },
    'Hit': { animation: 'Hit', frameWidth: 320, frameHeight: 320, columns: 5, rows: 3, frameCount: 15, fps: 15, loop: false },
};

/**
 * Retourne la config d'animation pour une entité et une action donnée.
 * Système unifié robuste par type d'asset avec Fallbacks.
 */
export const getSpritesheetConfig = (classId: string, animation: string, providedAssetType?: any): SpritesheetConfig => {
    const id = classId.toLowerCase();

    // Determine final configuration
    let config: SpritesheetConfig;
    let assetType = providedAssetType;

    // 1. Chercher d'abord dans les configs V4 explicites (Casing insensible)
    const exactMatch = Object.keys(SPRITESHEET_ANIMATIONS).find(k => k.toLowerCase() === id);
    if (exactMatch) {
        config = SPRITESHEET_ANIMATIONS[exactMatch][animation] || SPRITESHEET_ANIMATIONS[exactMatch]['Idle'];
        assetType = assetType || 'V4_HERO';
    } else {
        // 2. Déterminer si c'est un Monstre ou un Pre-made ou un Héros V4 générique
        const isMonster = id.includes('monstre') || id.startsWith('monster_') || id.toLowerCase().includes('araignee') || id.toLowerCase().includes('myconid');
        const isLegacy = ['alex', 'josh', 'lyria', 'manu', 'tori'].includes(id);

        if (id.includes('knight_man')) {
            config = KNIGHT_MAN_CONFIG[animation] || KNIGHT_MAN_CONFIG['Idle'];
            assetType = assetType || 'V4_HERO';
        } else if (id.includes('knight_girl') || id.includes('thief')) {
            config = KNIGHT_GIRL_CONFIG[animation] || KNIGHT_GIRL_CONFIG['Idle'];
            assetType = assetType || 'V4_HERO';
        } else if (id.includes('assembled')) {
            config = ASSEMBLED_V4_CONFIG[animation] || ASSEMBLED_V4_CONFIG['Idle'];
            assetType = assetType || 'V4_HERO';
        } else if (id.includes('hero') || id.includes('prototyping')) {
            config = PROTOTYPING_HERO_CONFIG[animation] || PROTOTYPING_HERO_CONFIG['Idle'];
            assetType = assetType || 'V4_HERO';
        } else if (id.includes('halberd')) {
            config = HALBERD_V4_CONFIG[animation] || HALBERD_V4_CONFIG['Idle'];
            assetType = assetType || 'V4_HERO';
        } else if (isMonster) {
            config = MONSTERS_CONFIG[animation] || MONSTERS_CONFIG['Idle'];
            assetType = assetType || 'V4_MONSTER';
        } else if (isLegacy) {
            config = PRE_MADE_CONFIG[animation] || PRE_MADE_CONFIG['Idle'];
            assetType = assetType || 'LEGACY_NPC';
        } else {
            config = HERO_V4_CONFIG[animation] || HERO_V4_CONFIG['Idle'];
            assetType = assetType || 'V4_HERO';
        }
    }

    return { ...config, assetType };
};
