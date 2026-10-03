/**
 * 🎒 ITEMS DOFUS 2.61 - ÉQUIPEMENTS ET CONSOMMABLES
 * Données des objets avec stats, sets et caractéristiques
 */

export type ItemType = 'Weapon' | 'Hat' | 'Cloak' | 'Amulet' | 'Ring' | 'Belt' | 'Boots' | 'Shield' |
    'Pet' | 'Mount' | 'Consumable' | 'Resource' | 'Quest' | 'Dofus';

export type ItemSlot = 'weapon' | 'hat' | 'cloak' | 'amulet' | 'ring1' | 'ring2' | 'belt' | 'boots' | 'shield' | 'pet' | 'mount' | 'dofus';

export interface ItemStats {
    vitality?: number;
    wisdom?: number;
    strength?: number;
    intelligence?: number;
    chance?: number;
    agility?: number;
    ap?: number;
    mp?: number;
    range?: number;
    summons?: number;
    damage?: number;
    heals?: number;
    initiative?: number;
    prospecting?: number;
    pods?: number;
    critChance?: number;
    critDamage?: number;
    resistance?: {
        neutral?: number;
        earth?: number;
        fire?: number;
        water?: number;
        air?: number;
    };
}

export interface DofusItem {
    id: number;
    name: string;
    type: ItemType;
    slot?: ItemSlot;
    level: number;
    description: string;
    stats: ItemStats;
    setId?: number; // ID de la panoplie
    conditions?: string;
    price: number; // Prix en kamas
    iconId: number;
    weight: number; // Pods
}

export interface ItemSet {
    id: number;
    name: string;
    items: number[];
    bonuses: { [itemCount: number]: ItemStats };
}

// =============================================
// ÉQUIPEMENTS DE BASE
// =============================================

export const DOFUS_ITEMS: DofusItem[] = [
    // === ARMES ===
    {
        id: 1, name: "Épée de Boisaille", type: 'Weapon', slot: 'weapon',
        level: 1, description: "Une épée en bois, parfaite pour débuter.",
        stats: { strength: 5, damage: 3 },
        price: 100, iconId: 100, weight: 10
    },
    {
        id: 2, name: "Petite Épée du Bouftou", type: 'Weapon', slot: 'weapon',
        level: 10, description: "Forgée avec des cornes de Bouftou.",
        stats: { strength: 15, vitality: 10, damage: 8 },
        setId: 1, price: 1500, iconId: 101, weight: 15
    },
    {
        id: 3, name: "Arc de Jeune Aventurier", type: 'Weapon', slot: 'weapon',
        level: 1, description: "Un arc simple mais efficace.",
        stats: { agility: 5, range: 1, damage: 5 },
        price: 150, iconId: 200, weight: 8
    },
    {
        id: 4, name: "Baguette d'Apprenti", type: 'Weapon', slot: 'weapon',
        level: 1, description: "Baguette magique pour débutants.",
        stats: { intelligence: 5, heals: 5 },
        price: 120, iconId: 300, weight: 5
    },

    // === COIFFES ===
    {
        id: 100, name: "Coiffe du Bouftou", type: 'Hat', slot: 'hat',
        level: 10, description: "Une coiffe en laine de Bouftou.",
        stats: { vitality: 15, wisdom: 5 },
        setId: 1, price: 1200, iconId: 1000, weight: 10
    },
    {
        id: 101, name: "Casque du Chafer", type: 'Hat', slot: 'hat',
        level: 30, description: "Un casque récupéré sur un Chafer.",
        stats: { vitality: 40, strength: 20, resistance: { neutral: 5 } },
        price: 8000, iconId: 1001, weight: 25
    },
    {
        id: 102, name: "Chapeau Prespic", type: 'Hat', slot: 'hat',
        level: 15, description: "Hérissé d'aiguilles de Prespic.",
        stats: { vitality: 20, agility: 15 },
        price: 2500, iconId: 1002, weight: 12
    },

    // === CAPES ===
    {
        id: 200, name: "Cape du Bouftou", type: 'Cloak', slot: 'cloak',
        level: 10, description: "Cape en laine chaude.",
        stats: { vitality: 10, wisdom: 10 },
        setId: 1, price: 1000, iconId: 2000, weight: 8
    },
    {
        id: 201, name: "Cape du Tofu", type: 'Cloak', slot: 'cloak',
        level: 5, description: "Cape légère ornée de plumes.",
        stats: { agility: 10, mp: 1 },
        price: 600, iconId: 2001, weight: 5
    },

    // === AMULETTES ===
    {
        id: 300, name: "Amulette du Bouftou", type: 'Amulet', slot: 'amulet',
        level: 10, description: "Amulette faite de cornes.",
        stats: { vitality: 20, strength: 10 },
        setId: 1, price: 1500, iconId: 3000, weight: 2
    },
    {
        id: 301, name: "Petite Amulette d'Émeraude", type: 'Amulet', slot: 'amulet',
        level: 20, description: "Une émeraude montée sur argent.",
        stats: { wisdom: 15, intelligence: 20 },
        price: 4000, iconId: 3001, weight: 3
    },

    // === ANNEAUX ===
    {
        id: 400, name: "Anneau du Bouftou", type: 'Ring', slot: 'ring1',
        level: 10, description: "Anneau taillé dans une corne.",
        stats: { strength: 10, vitality: 5 },
        setId: 1, price: 800, iconId: 4000, weight: 1
    },
    {
        id: 401, name: "Alliance Forcée", type: 'Ring', slot: 'ring1',
        level: 1, description: "Un anneau simple mais symbolique.",
        stats: { vitality: 5 },
        price: 50, iconId: 4001, weight: 1
    },

    // === CEINTURES ===
    {
        id: 500, name: "Ceinture du Bouftou", type: 'Belt', slot: 'belt',
        level: 10, description: "Ceinture en cuir de Bouftou.",
        stats: { vitality: 25, pods: 50 },
        setId: 1, price: 1100, iconId: 5000, weight: 5
    },
    {
        id: 501, name: "Ceinture du Sanglier", type: 'Belt', slot: 'belt',
        level: 25, description: "Solide ceinture renforcée.",
        stats: { vitality: 45, strength: 15, pods: 100 },
        price: 5500, iconId: 5001, weight: 8
    },

    // === BOTTES ===
    {
        id: 600, name: "Bottes du Bouftou", type: 'Boots', slot: 'boots',
        level: 10, description: "Bottes confortables en laine.",
        stats: { vitality: 15, agility: 10 },
        setId: 1, price: 1000, iconId: 6000, weight: 8
    },
    {
        id: 601, name: "Sandales Légères", type: 'Boots', slot: 'boots',
        level: 1, description: "Sandales de base.",
        stats: { agility: 5 },
        price: 80, iconId: 6001, weight: 3
    },

    // === CONSOMMABLES ===
    {
        id: 1000, name: "Pain", type: 'Consumable',
        level: 1, description: "Régénère 30 HP hors combat.",
        stats: {},
        price: 10, iconId: 8000, weight: 2
    },
    {
        id: 1001, name: "Potion de Vie Mineure", type: 'Consumable',
        level: 1, description: "Récupère 50 HP instantanément.",
        stats: {},
        price: 50, iconId: 8001, weight: 1
    },
    {
        id: 1002, name: "Potion de Rappel", type: 'Consumable',
        level: 1, description: "Téléporte au Zaap de sauvegarde.",
        stats: {},
        price: 200, iconId: 8002, weight: 1
    },

    // === RESSOURCES ===
    {
        id: 303, name: "Plume de Piou Rouge", type: 'Resource',
        level: 1, description: "Plume colorée tombée d'un Piou.",
        stats: {},
        price: 5, iconId: 9000, weight: 1
    },
    {
        id: 400, name: "Laine de Bouftou", type: 'Resource',
        level: 1, description: "Laine douce et chaude.",
        stats: {},
        price: 15, iconId: 9001, weight: 2
    },
    {
        id: 500, name: "Os de Chafer", type: 'Resource',
        level: 1, description: "Os récupéré sur un squelette.",
        stats: {},
        price: 50, iconId: 9002, weight: 3
    },

    // === DOFUS (rare) ===
    {
        id: 5000, name: "Dofus Pourpre", type: 'Dofus', slot: 'dofus',
        level: 60, description: "Un œuf de dragon légendaire qui confère un pouvoir immense.",
        stats: { vitality: 100, damage: 30, ap: 1 },
        price: 10000000, iconId: 10000, weight: 50
    },
    {
        id: 5001, name: "Dofus Turquoise", type: 'Dofus', slot: 'dofus',
        level: 80, description: "Augmente considérablement les soins.",
        stats: { wisdom: 50, heals: 50, intelligence: 80 },
        price: 15000000, iconId: 10001, weight: 50
    }
];

// =============================================
// PANOPLIES (SETS)
// =============================================

export const ITEM_SETS: ItemSet[] = [
    {
        id: 1,
        name: "Panoplie du Bouftou",
        items: [2, 100, 200, 300, 400, 500, 600], // IDs des items
        bonuses: {
            2: { vitality: 10 },
            3: { vitality: 20, strength: 10 },
            4: { vitality: 30, strength: 20, wisdom: 10 },
            5: { vitality: 50, strength: 30, wisdom: 15, ap: 1 },
            6: { vitality: 70, strength: 40, wisdom: 20, ap: 1, mp: 1 },
            7: { vitality: 100, strength: 50, wisdom: 30, ap: 1, mp: 1, damage: 10 }
        }
    }
];

// =============================================
// FONCTIONS UTILITAIRES
// =============================================

export function getItemById(id: number): DofusItem | undefined {
    return DOFUS_ITEMS.find(i => i.id === id);
}

export function getItemsByType(type: ItemType): DofusItem[] {
    return DOFUS_ITEMS.filter(i => i.type === type);
}

export function getItemsByLevel(minLevel: number, maxLevel: number): DofusItem[] {
    return DOFUS_ITEMS.filter(i => i.level >= minLevel && i.level <= maxLevel);
}

export function getItemsBySet(setId: number): DofusItem[] {
    return DOFUS_ITEMS.filter(i => i.setId === setId);
}

export function getSetById(setId: number): ItemSet | undefined {
    return ITEM_SETS.find(s => s.id === setId);
}

export function calculateSetBonus(equippedItems: number[], setId: number): ItemStats {
    const set = getSetById(setId);
    if (!set) return {};

    const equippedFromSet = equippedItems.filter(id => set.items.includes(id)).length;
    return set.bonuses[equippedFromSet] || {};
}

export default DOFUS_ITEMS;
