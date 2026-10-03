
import { Merchant } from '../types';

export const NPC_THEMES = [
    { title: 'Armurier', subtitle: 'Forge et Métal', type: 'specialized' },
    { title: 'Alchimiste', subtitle: 'Potions et Élixirs', type: 'consumable' },
    { title: 'Marchand de Sable', subtitle: 'Ressources Rares', type: 'resource' },
    { title: 'Brocanteur', subtitle: 'Objets Divers', type: 'general' },
    { title: 'Ingénieur', subtitle: 'Composants Tech', type: 'specialized' },
    { title: 'Botaniste', subtitle: 'Plantes et Graines', type: 'resource' },
    { title: 'Cuisinier', subtitle: 'Nourriture de Voyage', type: 'consumable' },
    { title: 'Joaillier', subtitle: 'Bijoux et Gemmes', type: 'specialized' }
];

const NPC_NAMES = [
    'Zorg', 'Kael', 'Lyra', 'Brak', 'Xenon', 'Syrinx', 'Vax', 'Mora', 'Titus', 'Eris',
    'Cronos', 'Selene', 'Atlas', 'Nova', 'Rhea', 'Nyx', 'Helios', 'Gaia', 'Oceanus', 'Themis'
];

export const generateBatchNPCs = (count: number = 20): Merchant[] => {
    const npcs: Merchant[] = [];

    for (let i = 0; i < count; i++) {
        const name = NPC_NAMES[i % NPC_NAMES.length];
        const theme = NPC_THEMES[i % NPC_THEMES.length];

        npcs.push({
            id: `npc_${i}_${Date.now()}`,
            name: `${name} the ${theme.title}`,
            subtitle: theme.subtitle,
            type: theme.type as any,
            spriteUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${name}`, // Temporary placeholder
            inventory: [], // Will be populated by item generator
            buyFactor: 0.3 + (Math.random() * 0.5) // Between 0.3 and 0.8
        });
    }

    return npcs;
};

export const getMeshyPromptForNPC = (npc: Merchant) => {
    return `NPC character for game: ${npc.name}. Role: ${npc.subtitle}. Style: Dofus/Wakfu 2D character art, clean lines, thick outlines, flat colors with cell shading. Sci-fi fantasy setting. Isolated on bright green background. Full body isometric 3/4 view.`;
};
