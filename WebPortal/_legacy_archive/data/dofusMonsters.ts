/**
 * 👾 MONSTRES DOFUS 2.61 - SYSTÈME COMPLET
 * Données des monstres avec stats, sorts, zones et drops
 */

export type MonsterAI = 'Aggressive' | 'Cowardly' | 'Tactical' | 'Healer' | 'Summoner' | 'Passive';
export type MonsterRace = 'Animal' | 'Humanoid' | 'Undead' | 'Demon' | 'Plant' | 'Elemental' | 'Boss';

export interface MonsterDrop {
    itemId: number;
    itemName: string;
    rate: number; // 0-100%
    quantity: [number, number];
}

export interface DofusMonster {
    id: number;
    name: string;
    race: MonsterRace;
    level: number;
    hp: number;
    ap: number;
    mp: number;
    initiative: number;
    resistances: {
        neutral: number;
        earth: number;
        fire: number;
        water: number;
        air: number;
    };
    spells: number[];
    aiType: MonsterAI;
    isBoss: boolean;
    minKamas: number;
    maxKamas: number;
    xp: number;
    drops: MonsterDrop[];
    zones: string[]; // Zones où on peut le trouver
    iconId: number;
}

// =============================================
// BASE DE DONNÉES DES MONSTRES
// =============================================

export const DOFUS_MONSTERS: DofusMonster[] = [
    // === ZONE DÉBUTANT: INCARNAM / ASTRUB ===
    {
        id: 36, name: "Piou Rouge", race: 'Animal', level: 1,
        hp: 22, ap: 3, mp: 3, initiative: 10,
        resistances: { neutral: 0, earth: 0, fire: 5, water: -5, air: 0 },
        spells: [1], aiType: 'Passive', isBoss: false,
        minKamas: 1, maxKamas: 5, xp: 10,
        drops: [
            { itemId: 303, itemName: "Plume de Piou Rouge", rate: 30, quantity: [1, 2] }
        ],
        zones: ["Incarnam", "Astrub"],
        iconId: 361
    },
    {
        id: 37, name: "Piou Bleu", race: 'Animal', level: 2,
        hp: 28, ap: 3, mp: 3, initiative: 12,
        resistances: { neutral: 0, earth: -5, fire: 0, water: 5, air: 0 },
        spells: [2], aiType: 'Passive', isBoss: false,
        minKamas: 2, maxKamas: 8, xp: 15,
        drops: [
            { itemId: 304, itemName: "Plume de Piou Bleu", rate: 30, quantity: [1, 2] }
        ],
        zones: ["Incarnam"],
        iconId: 362
    },
    {
        id: 38, name: "Piou Vert", race: 'Animal', level: 2,
        hp: 26, ap: 3, mp: 4, initiative: 15,
        resistances: { neutral: 0, earth: 5, fire: 0, water: 0, air: -5 },
        spells: [3], aiType: 'Cowardly', isBoss: false,
        minKamas: 2, maxKamas: 8, xp: 15,
        drops: [
            { itemId: 305, itemName: "Plume de Piou Vert", rate: 30, quantity: [1, 2] }
        ],
        zones: ["Incarnam"],
        iconId: 363
    },

    // === ZONE: PRAIRIE ASTRUB ===
    {
        id: 31, name: "Bouftou", race: 'Animal', level: 5,
        hp: 60, ap: 4, mp: 3, initiative: 20,
        resistances: { neutral: 5, earth: 0, fire: 0, water: 0, air: 0 },
        spells: [11, 12], aiType: 'Aggressive', isBoss: false,
        minKamas: 5, maxKamas: 15, xp: 25,
        drops: [
            { itemId: 400, itemName: "Laine de Bouftou", rate: 40, quantity: [1, 3] },
            { itemId: 401, itemName: "Cuir de Bouftou", rate: 20, quantity: [1, 1] }
        ],
        zones: ["Prairie d'Astrub", "Prairie des Bouftous"],
        iconId: 310
    },
    {
        id: 32, name: "Bouftou Noir", race: 'Animal', level: 8,
        hp: 85, ap: 5, mp: 3, initiative: 25,
        resistances: { neutral: 10, earth: 5, fire: -5, water: 0, air: 0 },
        spells: [11, 12, 13], aiType: 'Aggressive', isBoss: false,
        minKamas: 10, maxKamas: 25, xp: 40,
        drops: [
            { itemId: 402, itemName: "Laine de Bouftou Noir", rate: 35, quantity: [1, 2] },
            { itemId: 403, itemName: "Cornes de Bouftou", rate: 10, quantity: [1, 1] }
        ],
        zones: ["Prairie d'Astrub"],
        iconId: 311
    },
    {
        id: 34, name: "Tofu", race: 'Animal', level: 3,
        hp: 35, ap: 4, mp: 5, initiative: 25,
        resistances: { neutral: 0, earth: 0, fire: 0, water: 0, air: 10 },
        spells: [15], aiType: 'Cowardly', isBoss: false,
        minKamas: 3, maxKamas: 10, xp: 18,
        drops: [
            { itemId: 410, itemName: "Plume de Tofu", rate: 50, quantity: [1, 3] },
            { itemId: 411, itemName: "Oeuf de Tofu", rate: 5, quantity: [1, 1] }
        ],
        zones: ["Prairie d'Astrub", "Forêt d'Amakna"],
        iconId: 340
    },

    // === ZONE: FORÊT D'AMAKNA ===
    {
        id: 40, name: "Prespic", race: 'Animal', level: 12,
        hp: 120, ap: 6, mp: 4, initiative: 30,
        resistances: { neutral: 10, earth: 10, fire: -10, water: 0, air: 0 },
        spells: [20, 21], aiType: 'Tactical', isBoss: false,
        minKamas: 15, maxKamas: 35, xp: 55,
        drops: [
            { itemId: 420, itemName: "Poil de Prespic", rate: 35, quantity: [1, 2] },
            { itemId: 421, itemName: "Aiguille de Prespic", rate: 15, quantity: [1, 1] }
        ],
        zones: ["Forêt d'Amakna"],
        iconId: 380
    },
    {
        id: 42, name: "Cochon de Lait", race: 'Animal', level: 15,
        hp: 150, ap: 6, mp: 4, initiative: 28,
        resistances: { neutral: 5, earth: 5, fire: 5, water: 5, air: 5 },
        spells: [25, 26], aiType: 'Aggressive', isBoss: false,
        minKamas: 20, maxKamas: 50, xp: 70,
        drops: [
            { itemId: 430, itemName: "Jambon", rate: 25, quantity: [1, 2] },
            { itemId: 431, itemName: "Cuir de Cochon", rate: 20, quantity: [1, 1] }
        ],
        zones: ["Ferme d'Amakna", "Plaine des Porcs"],
        iconId: 420
    },
    {
        id: 50, name: "Sanglier", race: 'Animal', level: 20,
        hp: 200, ap: 6, mp: 5, initiative: 35,
        resistances: { neutral: 15, earth: 10, fire: 0, water: 0, air: 0 },
        spells: [30, 31, 32], aiType: 'Aggressive', isBoss: false,
        minKamas: 30, maxKamas: 70, xp: 100,
        drops: [
            { itemId: 440, itemName: "Défense de Sanglier", rate: 20, quantity: [1, 2] },
            { itemId: 441, itemName: "Cuir de Sanglier", rate: 30, quantity: [1, 1] }
        ],
        zones: ["Plaine des Porcs", "Forêt d'Amakna"],
        iconId: 500
    },

    // === ZONE: CIMETIÈRE ===
    {
        id: 100, name: "Chafer", race: 'Undead', level: 25,
        hp: 250, ap: 6, mp: 3, initiative: 40,
        resistances: { neutral: 20, earth: 15, fire: -20, water: 10, air: 0 },
        spells: [50, 51, 52], aiType: 'Aggressive', isBoss: false,
        minKamas: 40, maxKamas: 100, xp: 150,
        drops: [
            { itemId: 500, itemName: "Os de Chafer", rate: 30, quantity: [1, 3] },
            { itemId: 501, itemName: "Casque de Chafer", rate: 5, quantity: [1, 1] }
        ],
        zones: ["Cimetière d'Amakna", "Donjon Chafers"],
        iconId: 1000
    },
    {
        id: 101, name: "Chafer Archer", race: 'Undead', level: 30,
        hp: 280, ap: 6, mp: 4, initiative: 45,
        resistances: { neutral: 20, earth: 10, fire: -15, water: 10, air: 10 },
        spells: [53, 54], aiType: 'Tactical', isBoss: false,
        minKamas: 50, maxKamas: 120, xp: 180,
        drops: [
            { itemId: 502, itemName: "Arc de Chafer", rate: 8, quantity: [1, 1] },
            { itemId: 503, itemName: "Flèche de Chafer", rate: 25, quantity: [1, 5] }
        ],
        zones: ["Cimetière d'Amakna", "Donjon Chafers"],
        iconId: 1010
    },

    // === BOSS ===
    {
        id: 113, name: "Bouftou Royal", race: 'Animal', level: 40,
        hp: 2500, ap: 8, mp: 5, initiative: 100,
        resistances: { neutral: 25, earth: 20, fire: 10, water: 10, air: 10 },
        spells: [11, 12, 13, 14], aiType: 'Aggressive', isBoss: true,
        minKamas: 500, maxKamas: 1500, xp: 5000,
        drops: [
            { itemId: 600, itemName: "Coiffe du Bouftou Royal", rate: 5, quantity: [1, 1] },
            { itemId: 601, itemName: "Cape du Bouftou Royal", rate: 5, quantity: [1, 1] },
            { itemId: 602, itemName: "Laine Royale", rate: 100, quantity: [1, 5] }
        ],
        zones: ["Donjon Bouftou"],
        iconId: 1130
    },
    {
        id: 200, name: "Poutch Ingball", race: 'Elemental', level: 100,
        hp: 15000, ap: 0, mp: 0, initiative: 200,
        resistances: { neutral: 50, earth: 50, fire: 50, water: 50, air: 50 },
        spells: [], aiType: 'Passive', isBoss: true,
        minKamas: 0, maxKamas: 0, xp: 0,
        drops: [],
        zones: ["Terrain de Poutch"],
        iconId: 4230
    },
    {
        id: 300, name: "Rat Noir", race: 'Animal', level: 50,
        hp: 3500, ap: 10, mp: 6, initiative: 120,
        resistances: { neutral: 30, earth: 20, fire: -10, water: 20, air: 15 },
        spells: [70, 71, 72, 73], aiType: 'Tactical', isBoss: true,
        minKamas: 800, maxKamas: 2500, xp: 8000,
        drops: [
            { itemId: 700, itemName: "Queue du Rat Noir", rate: 100, quantity: [1, 1] },
            { itemId: 701, itemName: "Cape du Rat Noir", rate: 3, quantity: [1, 1] }
        ],
        zones: ["Égouts de Brakmar"],
        iconId: 3000
    }
];

// =============================================
// FONCTIONS UTILITAIRES
// =============================================

export function getMonsterById(id: number): DofusMonster | undefined {
    return DOFUS_MONSTERS.find(m => m.id === id);
}

export function getMonstersByZone(zone: string): DofusMonster[] {
    return DOFUS_MONSTERS.filter(m =>
        m.zones.some(z => z.toLowerCase().includes(zone.toLowerCase()))
    );
}

export function getMonstersByLevel(minLevel: number, maxLevel: number): DofusMonster[] {
    return DOFUS_MONSTERS.filter(m => m.level >= minLevel && m.level <= maxLevel);
}

export function getMonstersByRace(race: MonsterRace): DofusMonster[] {
    return DOFUS_MONSTERS.filter(m => m.race === race);
}

export function getBosses(): DofusMonster[] {
    return DOFUS_MONSTERS.filter(m => m.isBoss);
}

export function getRandomMonsterGroup(zone: string, count: number = 3): DofusMonster[] {
    const zoneMonsters = getMonstersByZone(zone).filter(m => !m.isBoss);
    const group: DofusMonster[] = [];

    for (let i = 0; i < count && zoneMonsters.length > 0; i++) {
        const idx = Math.floor(Math.random() * zoneMonsters.length);
        group.push(zoneMonsters[idx]);
    }

    return group;
}

export default DOFUS_MONSTERS;
