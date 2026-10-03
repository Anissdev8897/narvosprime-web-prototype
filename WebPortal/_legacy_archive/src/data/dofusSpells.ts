/**
 * 🔮 SORTS DOFUS 2.61 - SYSTÈME COMPLET
 * Sorts de base pour les 18 classes + sorts utilitaires
 */

export type SpellElement = 'Neutral' | 'Earth' | 'Fire' | 'Water' | 'Air';
export type SpellCategory = 'Attack' | 'Support' | 'Healing' | 'Movement' | 'Summon' | 'Trap' | 'Glyph';
export type SpellTarget = 'Self' | 'Ally' | 'Enemy' | 'All' | 'EmptyCell' | 'AoE';

export interface SpellEffect {
    type: 'damage' | 'heal' | 'buff' | 'debuff' | 'push' | 'pull' | 'teleport' | 'summon' | 'steal';
    value: [number, number]; // [min, max]
    element?: SpellElement;
    duration?: number; // Tours
}

export interface DofusSpell {
    id: number;
    name: string;
    description: string;
    breedId: number; // 0 = sort commun
    paCost: number;
    range: [number, number];
    aoeSize: number; // 0 = monocible
    needsLos: boolean; // Ligne de vue requise
    modifiableRange: boolean;
    cooldown: number; // Tours
    maxCastsPerTurn: number;
    maxCastsPerTarget: number;
    category: SpellCategory;
    target: SpellTarget;
    element: SpellElement;
    effects: SpellEffect[];
    iconId: number;
    unlockLevel: number;
}

// =============================================
// SORTS DE BASE PAR CLASSE
// =============================================

export const DOFUS_SPELLS: DofusSpell[] = [
    // === IOP (ID: 8) ===
    {
        id: 1, name: "Pression", description: "Inflige des dégâts Terre au corps à corps.",
        breedId: 8, paCost: 3, range: [1, 1], aoeSize: 0, needsLos: true, modifiableRange: false,
        cooldown: 0, maxCastsPerTurn: 3, maxCastsPerTarget: 2,
        category: 'Attack', target: 'Enemy', element: 'Earth',
        effects: [{ type: 'damage', value: [18, 22], element: 'Earth' }],
        iconId: 1040, unlockLevel: 1
    },
    {
        id: 3, name: "Bond", description: "Téléporte le Iop sur une case vide.",
        breedId: 8, paCost: 3, range: [1, 6], aoeSize: 0, needsLos: true, modifiableRange: true,
        cooldown: 3, maxCastsPerTurn: 1, maxCastsPerTarget: 0,
        category: 'Movement', target: 'EmptyCell', element: 'Neutral',
        effects: [{ type: 'teleport', value: [0, 0] }],
        iconId: 1042, unlockLevel: 1
    },
    {
        id: 5, name: "Épée Divine", description: "Attaque de feu en ligne devant le Iop.",
        breedId: 8, paCost: 4, range: [1, 3], aoeSize: 0, needsLos: true, modifiableRange: false,
        cooldown: 0, maxCastsPerTurn: 2, maxCastsPerTarget: 2,
        category: 'Attack', target: 'Enemy', element: 'Fire',
        effects: [{ type: 'damage', value: [25, 29], element: 'Fire' }],
        iconId: 1044, unlockLevel: 1
    },
    {
        id: 7, name: "Intimidation", description: "Retire des PM à la cible.",
        breedId: 8, paCost: 2, range: [1, 1], aoeSize: 0, needsLos: true, modifiableRange: false,
        cooldown: 0, maxCastsPerTurn: 2, maxCastsPerTarget: 1,
        category: 'Support', target: 'Enemy', element: 'Neutral',
        effects: [{ type: 'debuff', value: [2, 2], duration: 1 }],
        iconId: 1046, unlockLevel: 3
    },
    {
        id: 9, name: "Couper", description: "Inflige des dégâts Feu et retire des PM.",
        breedId: 8, paCost: 3, range: [1, 4], aoeSize: 0, needsLos: true, modifiableRange: false,
        cooldown: 0, maxCastsPerTurn: 3, maxCastsPerTarget: 2,
        category: 'Attack', target: 'Enemy', element: 'Fire',
        effects: [
            { type: 'damage', value: [15, 17], element: 'Fire' },
            { type: 'debuff', value: [1, 1], duration: 1 }
        ],
        iconId: 1048, unlockLevel: 6
    },
    {
        id: 11, name: "Concentration", description: "Augmente les dégâts du prochain sort.",
        breedId: 8, paCost: 2, range: [0, 0], aoeSize: 0, needsLos: false, modifiableRange: false,
        cooldown: 2, maxCastsPerTurn: 1, maxCastsPerTarget: 0,
        category: 'Support', target: 'Self', element: 'Neutral',
        effects: [{ type: 'buff', value: [30, 30], duration: 1 }],
        iconId: 1050, unlockLevel: 9
    },
    {
        id: 13, name: "Épée du Destin", description: "Dégâts Feu massifs en zone.",
        breedId: 8, paCost: 5, range: [1, 3], aoeSize: 2, needsLos: true, modifiableRange: false,
        cooldown: 3, maxCastsPerTurn: 1, maxCastsPerTarget: 1,
        category: 'Attack', target: 'AoE', element: 'Fire',
        effects: [{ type: 'damage', value: [40, 48], element: 'Fire' }],
        iconId: 1052, unlockLevel: 21
    },

    // === CRA (ID: 9) ===
    {
        id: 121, name: "Flèche Magique", description: "Dégâts Air à longue portée.",
        breedId: 9, paCost: 4, range: [2, 10], aoeSize: 0, needsLos: true, modifiableRange: true,
        cooldown: 0, maxCastsPerTurn: 2, maxCastsPerTarget: 2,
        category: 'Attack', target: 'Enemy', element: 'Air',
        effects: [{ type: 'damage', value: [20, 24], element: 'Air' }],
        iconId: 1070, unlockLevel: 1
    },
    {
        id: 122, name: "Flèche de Recul", description: "Repousse la cible et inflige des dégâts.",
        breedId: 9, paCost: 3, range: [2, 8], aoeSize: 0, needsLos: true, modifiableRange: true,
        cooldown: 0, maxCastsPerTurn: 2, maxCastsPerTarget: 1,
        category: 'Attack', target: 'Enemy', element: 'Air',
        effects: [
            { type: 'damage', value: [12, 14], element: 'Air' },
            { type: 'push', value: [3, 3] }
        ],
        iconId: 1071, unlockLevel: 1
    },
    {
        id: 123, name: "Flèche Punitive", description: "Dégâts Terre puissants.",
        breedId: 9, paCost: 4, range: [2, 9], aoeSize: 0, needsLos: true, modifiableRange: true,
        cooldown: 0, maxCastsPerTurn: 2, maxCastsPerTarget: 2,
        category: 'Attack', target: 'Enemy', element: 'Earth',
        effects: [{ type: 'damage', value: [22, 26], element: 'Earth' }],
        iconId: 1072, unlockLevel: 3
    },
    {
        id: 124, name: "Flèche Glacée", description: "Dégâts Eau et retrait de PM.",
        breedId: 9, paCost: 3, range: [2, 7], aoeSize: 0, needsLos: true, modifiableRange: true,
        cooldown: 0, maxCastsPerTurn: 2, maxCastsPerTarget: 2,
        category: 'Attack', target: 'Enemy', element: 'Water',
        effects: [
            { type: 'damage', value: [14, 16], element: 'Water' },
            { type: 'debuff', value: [1, 1], duration: 1 }
        ],
        iconId: 1073, unlockLevel: 6
    },
    {
        id: 125, name: "Flèche Persécutrice", description: "Dégâts Air et Feu.",
        breedId: 9, paCost: 4, range: [2, 12], aoeSize: 0, needsLos: true, modifiableRange: true,
        cooldown: 0, maxCastsPerTurn: 2, maxCastsPerTarget: 2,
        category: 'Attack', target: 'Enemy', element: 'Fire',
        effects: [{ type: 'damage', value: [18, 22], element: 'Fire' }],
        iconId: 1074, unlockLevel: 9
    },

    // === ENIRIPSA (ID: 7) ===
    {
        id: 101, name: "Mot Curatif", description: "Soigne un allié.",
        breedId: 7, paCost: 3, range: [0, 6], aoeSize: 0, needsLos: true, modifiableRange: true,
        cooldown: 0, maxCastsPerTurn: 3, maxCastsPerTarget: 2,
        category: 'Healing', target: 'Ally', element: 'Neutral',
        effects: [{ type: 'heal', value: [25, 30] }],
        iconId: 1060, unlockLevel: 1
    },
    {
        id: 102, name: "Mot Revitalisant", description: "Soigne en zone autour de la cible.",
        breedId: 7, paCost: 4, range: [0, 5], aoeSize: 2, needsLos: true, modifiableRange: false,
        cooldown: 2, maxCastsPerTurn: 1, maxCastsPerTarget: 1,
        category: 'Healing', target: 'AoE', element: 'Neutral',
        effects: [{ type: 'heal', value: [18, 22] }],
        iconId: 1061, unlockLevel: 3
    },
    {
        id: 103, name: "Mot Stimulant", description: "Donne des PA à un allié.",
        breedId: 7, paCost: 3, range: [0, 6], aoeSize: 0, needsLos: true, modifiableRange: true,
        cooldown: 3, maxCastsPerTurn: 1, maxCastsPerTarget: 1,
        category: 'Support', target: 'Ally', element: 'Neutral',
        effects: [{ type: 'buff', value: [2, 2], duration: 1 }],
        iconId: 1062, unlockLevel: 6
    },
    {
        id: 104, name: "Mot Blessant", description: "Inflige des dégâts Air.",
        breedId: 7, paCost: 3, range: [1, 7], aoeSize: 0, needsLos: true, modifiableRange: true,
        cooldown: 0, maxCastsPerTurn: 2, maxCastsPerTarget: 2,
        category: 'Attack', target: 'Enemy', element: 'Air',
        effects: [{ type: 'damage', value: [16, 20], element: 'Air' }],
        iconId: 1063, unlockLevel: 1
    },

    // === FECA (ID: 1) ===
    {
        id: 1001, name: "Armure Incandescente", description: "Réduit les dégâts Feu reçus.",
        breedId: 1, paCost: 4, range: [0, 6], aoeSize: 0, needsLos: true, modifiableRange: true,
        cooldown: 3, maxCastsPerTurn: 1, maxCastsPerTarget: 1,
        category: 'Support', target: 'Ally', element: 'Fire',
        effects: [{ type: 'buff', value: [30, 30], duration: 3 }],
        iconId: 1010, unlockLevel: 1
    },
    {
        id: 1002, name: "Attaque Naturelle", description: "Attaque de base Terre.",
        breedId: 1, paCost: 3, range: [1, 1], aoeSize: 0, needsLos: true, modifiableRange: false,
        cooldown: 0, maxCastsPerTurn: 3, maxCastsPerTarget: 2,
        category: 'Attack', target: 'Enemy', element: 'Earth',
        effects: [{ type: 'damage', value: [14, 18], element: 'Earth' }],
        iconId: 1011, unlockLevel: 1
    },
    {
        id: 1003, name: "Glyphe Agressif", description: "Crée un glyphe qui inflige des dégâts.",
        breedId: 1, paCost: 4, range: [1, 5], aoeSize: 2, needsLos: true, modifiableRange: false,
        cooldown: 3, maxCastsPerTurn: 1, maxCastsPerTarget: 0,
        category: 'Glyph', target: 'EmptyCell', element: 'Neutral',
        effects: [{ type: 'damage', value: [15, 20], duration: 3 }],
        iconId: 1012, unlockLevel: 6
    },

    // === SRAM (ID: 4) ===
    {
        id: 61, name: "Piège Sournois", description: "Pose un piège invisible.",
        breedId: 4, paCost: 3, range: [1, 5], aoeSize: 0, needsLos: true, modifiableRange: false,
        cooldown: 2, maxCastsPerTurn: 2, maxCastsPerTarget: 0,
        category: 'Trap', target: 'EmptyCell', element: 'Neutral',
        effects: [{ type: 'damage', value: [20, 25] }],
        iconId: 1030, unlockLevel: 1
    },
    {
        id: 62, name: "Invisibilité", description: "Rend le Sram invisible.",
        breedId: 4, paCost: 5, range: [0, 0], aoeSize: 0, needsLos: false, modifiableRange: false,
        cooldown: 4, maxCastsPerTurn: 1, maxCastsPerTarget: 0,
        category: 'Support', target: 'Self', element: 'Neutral',
        effects: [{ type: 'buff', value: [1, 1], duration: 2 }],
        iconId: 1031, unlockLevel: 3
    },
    {
        id: 63, name: "Fourvoiement", description: "Échange de position avec la cible.",
        breedId: 4, paCost: 3, range: [1, 6], aoeSize: 0, needsLos: true, modifiableRange: false,
        cooldown: 2, maxCastsPerTurn: 1, maxCastsPerTarget: 1,
        category: 'Movement', target: 'All', element: 'Neutral',
        effects: [{ type: 'teleport', value: [0, 0] }],
        iconId: 1032, unlockLevel: 6
    },
    {
        id: 64, name: "Coup Sournois", description: "Dégâts augmentés par derrière.",
        breedId: 4, paCost: 4, range: [1, 1], aoeSize: 0, needsLos: true, modifiableRange: false,
        cooldown: 0, maxCastsPerTurn: 2, maxCastsPerTarget: 2,
        category: 'Attack', target: 'Enemy', element: 'Air',
        effects: [{ type: 'damage', value: [22, 28], element: 'Air' }],
        iconId: 1033, unlockLevel: 1
    },

    // === SACRIEUR (ID: 11) ===
    {
        id: 432, name: "Châtiment Forcé", description: "Dégâts proportionnels aux HP perdus.",
        breedId: 11, paCost: 4, range: [1, 1], aoeSize: 0, needsLos: true, modifiableRange: false,
        cooldown: 0, maxCastsPerTurn: 2, maxCastsPerTarget: 2,
        category: 'Attack', target: 'Enemy', element: 'Earth',
        effects: [{ type: 'damage', value: [20, 30], element: 'Earth' }],
        iconId: 1110, unlockLevel: 1
    },
    {
        id: 433, name: "Punition", description: "Attaque Feu qui soigne le Sacrieur.",
        breedId: 11, paCost: 3, range: [1, 1], aoeSize: 0, needsLos: true, modifiableRange: false,
        cooldown: 0, maxCastsPerTurn: 3, maxCastsPerTarget: 2,
        category: 'Attack', target: 'Enemy', element: 'Fire',
        effects: [
            { type: 'damage', value: [18, 22], element: 'Fire' },
            { type: 'steal', value: [10, 12] }
        ],
        iconId: 1111, unlockLevel: 1
    },
    {
        id: 434, name: "Attirance", description: "Attire un ennemi vers le Sacrieur.",
        breedId: 11, paCost: 2, range: [2, 6], aoeSize: 0, needsLos: true, modifiableRange: false,
        cooldown: 0, maxCastsPerTurn: 2, maxCastsPerTarget: 1,
        category: 'Movement', target: 'Enemy', element: 'Neutral',
        effects: [{ type: 'pull', value: [5, 5] }],
        iconId: 1112, unlockLevel: 3
    },

    // === OSAMODAS (ID: 2) ===
    {
        id: 21, name: "Invocation Tofu", description: "Invoque un Tofu pour combattre.",
        breedId: 2, paCost: 3, range: [1, 4], aoeSize: 0, needsLos: true, modifiableRange: false,
        cooldown: 4, maxCastsPerTurn: 1, maxCastsPerTarget: 0,
        category: 'Summon', target: 'EmptyCell', element: 'Neutral',
        effects: [{ type: 'summon', value: [1, 1] }],
        iconId: 1020, unlockLevel: 1
    },
    {
        id: 22, name: "Griffe Spectrale", description: "Attaque Air à distance.",
        breedId: 2, paCost: 3, range: [1, 6], aoeSize: 0, needsLos: true, modifiableRange: true,
        cooldown: 0, maxCastsPerTurn: 3, maxCastsPerTarget: 2,
        category: 'Attack', target: 'Enemy', element: 'Air',
        effects: [{ type: 'damage', value: [16, 20], element: 'Air' }],
        iconId: 1021, unlockLevel: 1
    },

    // === ENUTROF (ID: 3) ===
    {
        id: 41, name: "Lancer de Pelle", description: "Lance une pelle sur l'ennemi.",
        breedId: 3, paCost: 3, range: [1, 6], aoeSize: 0, needsLos: true, modifiableRange: true,
        cooldown: 0, maxCastsPerTurn: 3, maxCastsPerTarget: 2,
        category: 'Attack', target: 'Enemy', element: 'Water',
        effects: [{ type: 'damage', value: [16, 20], element: 'Water' }],
        iconId: 1025, unlockLevel: 1
    },
    {
        id: 42, name: "Coffre", description: "Invoque un coffre pour bloquer.",
        breedId: 3, paCost: 2, range: [1, 4], aoeSize: 0, needsLos: true, modifiableRange: false,
        cooldown: 3, maxCastsPerTurn: 1, maxCastsPerTarget: 0,
        category: 'Summon', target: 'EmptyCell', element: 'Neutral',
        effects: [{ type: 'summon', value: [1, 1] }],
        iconId: 1026, unlockLevel: 3
    },

    // === XELOR (ID: 5) ===
    {
        id: 81, name: "Ralentissement", description: "Retire des PA à la cible.",
        breedId: 5, paCost: 4, range: [1, 6], aoeSize: 0, needsLos: true, modifiableRange: true,
        cooldown: 2, maxCastsPerTurn: 1, maxCastsPerTarget: 1,
        category: 'Support', target: 'Enemy', element: 'Neutral',
        effects: [{ type: 'debuff', value: [2, 2], duration: 1 }],
        iconId: 1040, unlockLevel: 1
    },
    {
        id: 82, name: "Aiguille", description: "Dégâts Air perforants.",
        breedId: 5, paCost: 3, range: [1, 8], aoeSize: 0, needsLos: true, modifiableRange: true,
        cooldown: 0, maxCastsPerTurn: 3, maxCastsPerTarget: 2,
        category: 'Attack', target: 'Enemy', element: 'Air',
        effects: [{ type: 'damage', value: [14, 18], element: 'Air' }],
        iconId: 1041, unlockLevel: 1
    },
    {
        id: 83, name: "Téléportation", description: "Téléporte une cible.",
        breedId: 5, paCost: 3, range: [1, 6], aoeSize: 0, needsLos: true, modifiableRange: false,
        cooldown: 2, maxCastsPerTurn: 1, maxCastsPerTarget: 1,
        category: 'Movement', target: 'All', element: 'Neutral',
        effects: [{ type: 'teleport', value: [0, 0] }],
        iconId: 1042, unlockLevel: 6
    },

    // === ECAFLIP (ID: 6) ===
    {
        id: 91, name: "Pile ou Face", description: "Inflige des dégâts ou soigne aléatoirement.",
        breedId: 6, paCost: 3, range: [1, 6], aoeSize: 0, needsLos: true, modifiableRange: true,
        cooldown: 0, maxCastsPerTurn: 3, maxCastsPerTarget: 2,
        category: 'Attack', target: 'All', element: 'Fire',
        effects: [{ type: 'damage', value: [10, 40], element: 'Fire' }],
        iconId: 1050, unlockLevel: 1
    },
    {
        id: 92, name: "Bluff", description: "Boost les dégâts du prochain sort (aléatoire).",
        breedId: 6, paCost: 2, range: [0, 0], aoeSize: 0, needsLos: false, modifiableRange: false,
        cooldown: 2, maxCastsPerTurn: 1, maxCastsPerTarget: 0,
        category: 'Support', target: 'Self', element: 'Neutral',
        effects: [{ type: 'buff', value: [20, 50], duration: 1 }],
        iconId: 1051, unlockLevel: 3
    },

    // === SADIDA (ID: 10) ===
    {
        id: 141, name: "Poupée Sacrifiée", description: "Invoque une poupée explosive.",
        breedId: 10, paCost: 3, range: [1, 5], aoeSize: 0, needsLos: true, modifiableRange: false,
        cooldown: 3, maxCastsPerTurn: 2, maxCastsPerTarget: 0,
        category: 'Summon', target: 'EmptyCell', element: 'Neutral',
        effects: [{ type: 'summon', value: [1, 1] }],
        iconId: 1080, unlockLevel: 1
    },
    {
        id: 142, name: "Ronces", description: "Inflige des dégâts Terre en ligne.",
        breedId: 10, paCost: 3, range: [1, 6], aoeSize: 0, needsLos: true, modifiableRange: true,
        cooldown: 0, maxCastsPerTurn: 3, maxCastsPerTarget: 2,
        category: 'Attack', target: 'Enemy', element: 'Earth',
        effects: [{ type: 'damage', value: [14, 18], element: 'Earth' }],
        iconId: 1081, unlockLevel: 1
    },

    // === PANDAWA (ID: 12) ===
    {
        id: 161, name: "Karcham", description: "Porte un allié ou ennemi.",
        breedId: 12, paCost: 3, range: [1, 1], aoeSize: 0, needsLos: true, modifiableRange: false,
        cooldown: 0, maxCastsPerTurn: 1, maxCastsPerTarget: 1,
        category: 'Movement', target: 'All', element: 'Neutral',
        effects: [{ type: 'teleport', value: [0, 0] }],
        iconId: 1090, unlockLevel: 1
    },
    {
        id: 162, name: "Chamrak", description: "Lance l'entité portée.",
        breedId: 12, paCost: 3, range: [1, 6], aoeSize: 0, needsLos: true, modifiableRange: false,
        cooldown: 0, maxCastsPerTurn: 1, maxCastsPerTarget: 1,
        category: 'Movement', target: 'EmptyCell', element: 'Neutral',
        effects: [{ type: 'teleport', value: [0, 0] }],
        iconId: 1091, unlockLevel: 1
    },
    {
        id: 163, name: "Gueule de Bois", description: "Dégâts Eau en zone devant.",
        breedId: 12, paCost: 4, range: [1, 3], aoeSize: 2, needsLos: true, modifiableRange: false,
        cooldown: 0, maxCastsPerTurn: 2, maxCastsPerTarget: 2,
        category: 'Attack', target: 'AoE', element: 'Water',
        effects: [{ type: 'damage', value: [18, 24], element: 'Water' }],
        iconId: 1092, unlockLevel: 3
    }
];

// Fonctions utilitaires
export function getSpellById(id: number): DofusSpell | undefined {
    return DOFUS_SPELLS.find(s => s.id === id);
}

export function getSpellsByBreed(breedId: number): DofusSpell[] {
    return DOFUS_SPELLS.filter(s => s.breedId === breedId);
}

export function getSpellsByElement(element: SpellElement): DofusSpell[] {
    return DOFUS_SPELLS.filter(s => s.element === element);
}

export function getSpellsByCategory(category: SpellCategory): DofusSpell[] {
    return DOFUS_SPELLS.filter(s => s.category === category);
}

export default DOFUS_SPELLS;
