
import { Item, Merchant } from '../types';
import { generateImageAPI, makeImageTransparent } from '../utils';
import { getMeshyPromptForItem } from './itemGenerator';
import { getMeshyPromptForNPC } from './npcGenerator';
import { socket } from '../../net/socket';

export const VisualGeneratorService = {
    /**
     * Generates a visual for an item using AI.
     */
    generateItemVisual: async (item: Item, apiKey: string, backupKey?: string): Promise<string> => {
        const prompt = getMeshyPromptForItem(item);
        console.log(`[VisualGen] Generating visual for item: ${item.name}...`);

        try {
            const rawUrl = await generateImageAPI(apiKey, prompt, '512', '1:1', backupKey);
            // Process transparency
            const transparentUrl = await makeImageTransparent(rawUrl, "#FFFFFF");

            // Save to Server
            if (socket) {
                const result = await socket.saveAsset({
                    type: 'item',
                    id: item.id,
                    name: item.name,
                    base64Content: transparentUrl,
                    metadata: {
                        type: item.type,
                        rarity: item.rarity,
                        description: item.description,
                        buy_price: item.basePrice,
                        stats: item.statsBonus
                    }
                });
                if (result.success && result.url) return result.url;
            }

            return transparentUrl;
        } catch (error) {
            console.error(`[VisualGen] Failed for item ${item.name}:`, error);
            throw error;
        }
    },

    /**
     * Generates a visual for an NPC using AI.
     */
    generateNPCVisual: async (npc: Merchant, apiKey: string, backupKey?: string): Promise<string> => {
        const prompt = getMeshyPromptForNPC(npc);
        console.log(`[VisualGen] Generating visual for NPC: ${npc.name}...`);

        try {
            const rawUrl = await generateImageAPI(apiKey, prompt, '512', '1:1', backupKey);
            const transparentUrl = await makeImageTransparent(rawUrl, "#00FF00"); // Standard in our prompts

            // Save to Server
            if (socket) {
                const result = await socket.saveAsset({
                    type: 'npc',
                    id: npc.id,
                    name: npc.name,
                    base64Content: transparentUrl,
                    metadata: {
                        subtitle: npc.subtitle,
                        type: npc.type
                    }
                });
                if (result.success && result.url) return result.url;
            }

            return transparentUrl;
        } catch (error) {
            console.error(`[VisualGen] Failed for NPC ${npc.name}:`, error);
            throw error;
        }
    }
};
