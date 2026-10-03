
import { Item, Merchant } from '../types';
import { generateBatchItems, getMeshyPromptForItem } from './itemGenerator';
import { generateBatchNPCs, getMeshyPromptForNPC } from './npcGenerator';
import { generateImageAPI, makeImageTransparent } from '../utils';
import { socket } from '../../net/socket';

export const batchGenerateAndSaveAssets = async (
    category: 'item' | 'npc',
    count: number,
    apiKey: string,
    onProgress?: (current: number, total: number, message: string) => void
) => {
    console.log(`[Batch] Starting generation for ${count} ${category}s...`);

    if (category === 'item') {
        const types: (keyof typeof import('./itemGenerator').ITEM_CATEGORIES)[] = ['weapon', 'armor', 'consumable', 'resource'];
        for (let i = 0; i < count; i++) {
            const itemType = types[i % types.length];
            const items = generateBatchItems(itemType, 1);
            const item = items[0];

            if (onProgress) onProgress(i + 1, count, `Génération de ${item.name}...`);

            try {
                // 1. Generate Image
                const prompt = getMeshyPromptForItem(item);
                const imageUrl = await generateImageAPI(apiKey, prompt);

                // 2. Process Transparency
                const transparentUrl = await makeImageTransparent(imageUrl, "#FFFFFF"); // Meshy uses white usually

                // 3. Save to Server
                await socket.saveAsset({
                    type: 'item',
                    id: item.id,
                    name: item.name,
                    base64Content: transparentUrl,
                    metadata: {
                        type: item.type,
                        rarity: item.rarity,
                        level: 1, // Default or calculated
                        stats: item.statsBonus,
                        buyPrice: item.basePrice || 10,
                        sellPrice: Math.floor((item.basePrice || 10) * 0.5),
                        description: item.description
                    }
                });

                console.log(`[Batch] Item ${item.name} saved.`);
            } catch (error) {
                console.error(`[Batch] Failed to generate item ${i}:`, error);
            }
        }
    } else if (category === 'npc') {
        const npcs = generateBatchNPCs(count);
        for (let i = 0; i < count; i++) {
            const npc = npcs[i];

            if (onProgress) onProgress(i + 1, count, `Génération de ${npc.name}...`);

            try {
                // 1. Generate Image
                const prompt = getMeshyPromptForNPC(npc);
                const imageUrl = await generateImageAPI(apiKey, prompt);

                // 2. Process Transparency
                const transparentUrl = await makeImageTransparent(imageUrl, "#00FF00"); // Often green in our prompts

                // 3. Save to Server
                await socket.saveAsset({
                    type: 'npc',
                    id: npc.id,
                    name: npc.name,
                    base64Content: transparentUrl,
                    metadata: {
                        subtitle: npc.subtitle,
                        type: npc.type,
                        aiBehavior: 'neutral'
                    }
                });

                console.log(`[Batch] NPC ${npc.name} saved.`);
            } catch (error) {
                console.error(`[Batch] Failed to generate NPC ${i}:`, error);
            }
        }
    }

    console.log(`[Batch] Finished generation.`);
};
