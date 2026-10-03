
import { Item } from '../types';

export const ITEM_CATEGORIES = {
    weapon: [
        'Sabre de Flux', 'Lame Cryogénique', 'Dague de Plasma', 'Hache à Impulsion', 'Masse à Gravité',
        'Fusil de Précision Bio', 'Pistolet à Énergie', 'Lance-Flammes Chimique', 'Arc à Tachyons', 'Griffes d\'Acier'
    ],
    armor: [
        'Plastron en Darniar', 'Casque de Vision Nocturne', 'Bottes à Lévitation', 'Gantelets de Force', 'Jambières Renforcées',
        'Combinaison Furtive', 'Bouclier Énergétique', 'Cape en Soie d\'Espace', 'Anneau de Stase', 'Amulette de Lys'
    ],
    consumable: [
        'Potion de Vie Supérieure', 'Sérum d\'Adrénaline', 'Pilule de Concentration', 'Ration d\'Akarlys', 'Élixir de Puissance',
        'Antidote Universel', 'Nanites de Réparation', 'Capsule d\'Oxygène', 'Stimulant Cognitif', 'Essence de Lys'
    ],
    resource: [
        'Minerai d\'Alakyris', 'Cristal de Quartz Rose', 'Fragment de Météorite', 'Lingot de Darniar', 'Liquide de Refroidissement',
        'Plante Luminescente', 'Fibre de Carbone', 'Noyau d\'Énergie Vidé', 'Circuit Imprimé Ancien', 'Épice de Sable'
    ]
};

const ADJECTIVES = ['Alpha', 'Oméga', 'Spectral', 'Radieux', 'Obscur', 'Ancien', 'Futuriste', 'Corrompu', 'Pur', 'Légendaire'];
const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

export const generateBatchItems = (category: keyof typeof ITEM_CATEGORIES, count: number = 25): Item[] => {
    const items: Item[] = [];
    const baseNames = ITEM_CATEGORIES[category];

    for (let i = 0; i < count; i++) {
        const baseName = baseNames[i % baseNames.length];
        const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
        const rarity = RARITIES[Math.floor(Math.random() ** 1.5 * RARITIES.length)] as any; // Shorter way to weight lower rarities

        const level = Math.floor(Math.random() * 20) + 1;
        const basePrice = level * 10 * (RARITIES.indexOf(rarity) + 1);

        items.push({
            id: `gen_${category}_${i}_${Date.now()}`,
            name: `${baseName} ${adj}`,
            description: `Un objet de type ${category} découvert sur Narvos Prime.`,
            icon: i % 2 === 0 ? '📦' : '💎', // Placeholder icon
            type: category as any,
            rarity,
            quantity: 1,
            basePrice,
            statsBonus: category === 'weapon' || category === 'armor' ? {
                puissance: level * (RARITIES.indexOf(rarity) + 1),
                hp: category === 'armor' ? level * 5 : 0
            } : undefined,
            effect: category === 'consumable' ? {
                type: 'heal',
                value: level * 10
            } : undefined
        });
    }

    return items;
};

// Functions to help calling Meshy for these items
export const getMeshyPromptForItem = (item: Item) => {
    return `Single ${item.name}. ${item.description}. Style: Dofus/Wakfu 2D vector art, clean outlines, isometric view. Concept: futuristic fantasy, ${item.type}. Isolated on white background.`;
};
