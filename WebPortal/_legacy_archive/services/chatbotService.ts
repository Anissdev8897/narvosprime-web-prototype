/**
 * Service Chatbot NPC - Mode Fusion (DeepSeek API + Qwen3-4B + Fallback)
 * Gère les dialogues avec les PNJ en utilisant un système de fusion de modèles
 * Priorité: DeepSeek API > Qwen3-4B local > Fallback intelligent
 */

import { pipeline, env } from '@xenova/transformers';
import type { TextGenerationPipeline } from '@xenova/transformers';
import { deepSeekApiService } from './deepSeekApiService';

// Configuration
env.allowLocalModels = true;
env.useBrowserCache = false;

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface NPCContext {
    npcName: string;
    npcType: 'MARCHAND' | 'GARDE' | 'CIVIL' | 'SAGE' | 'ARTISAN';
    planetId: string;
    faction: string;
    mood?: 'AMICAL' | 'NEUTRE' | 'HOSTILE';
    questRelated?: boolean;
}

export interface ChatResponse {
    message: string;
    emotion?: 'CONTENT' | 'TRISTE' | 'COLERE' | 'SURPRISE' | 'NEUTRE';
    actions?: string[];
    nextPrompts?: string[];
    source?: 'DEEPSEEK_API' | 'QWEN_LOCAL' | 'FALLBACK';
}

/**
 * Service de Chatbot NPC avec fusion de modèles
 */
class ChatbotService {
    private static instance: ChatbotService;
    private qwenModel: TextGenerationPipeline | null = null;
    private isLoaded: boolean = false;
    private isLoading: boolean = false;
    private loadPromise: Promise<void> | null = null;

    // ❌ DÉSACTIVÉ temporairement - réactiver avec true
    private useDeepSeekApi: boolean = false;

    // Cache pour réponses fréquentes
    private responseCache: Map<string, { response: ChatResponse; timestamp: number }> = new Map();
    private readonly CACHE_DURATION = 60000; // 1 minute

    private constructor() { }

    public static getInstance(): ChatbotService {
        if (!ChatbotService.instance) {
            ChatbotService.instance = new ChatbotService();
        }
        return ChatbotService.instance;
    }

    /**
     * Charger le modèle Qwen3-4B
     */
    public async loadModel(onProgress?: (progress: number) => void): Promise<void> {
        if (this.isLoaded) return;
        if (this.isLoading && this.loadPromise) return this.loadPromise;

        this.isLoading = true;
        this.loadPromise = (async () => {
            try {
                console.log('🔄 [CHATBOT] Chargement de Qwen3-4B...');

                const modelPath = '/Qwen3-4B';

                // Vérifier si le modèle existe
                const configExists = await this.checkModelExists(modelPath);
                if (!configExists) {
                    console.warn('⚠️ [CHATBOT] Modèle Qwen3-4B non trouvé, utilisation du fallback');
                    this.isLoading = false;
                    return;
                }

                this.qwenModel = await pipeline('text-generation', modelPath, {
                    progress_callback: (progress: any) => {
                        if (onProgress && progress.progress !== undefined) {
                            onProgress(progress.progress);
                        }
                    }
                });

                this.isLoaded = true;
                console.log('✅ [CHATBOT] Qwen3-4B chargé avec succès');
            } catch (error) {
                console.error('❌ [CHATBOT] Erreur chargement Qwen3-4B:', error);
                this.isLoading = false;
            }
        })();

        return this.loadPromise;
    }

    /**
     * Vérifier si le modèle existe
     */
    private async checkModelExists(modelPath: string): Promise<boolean> {
        try {
            const response = await fetch(`${modelPath}/config.json`, { method: 'HEAD' });
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Générer une réponse de dialogue NPC
     * Priorité: DeepSeek API > Qwen3-4B local > Fallback
     */
    public async chat(
        playerMessage: string,
        context: NPCContext,
        history: ChatMessage[] = []
    ): Promise<ChatResponse> {
        // Vérifier le cache
        const cacheKey = `${context.npcName}-${playerMessage.slice(0, 50)}`;
        const cached = this.responseCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
            return cached.response;
        }

        // ✅ PRIORITÉ 1: DeepSeek API (si disponible et activé)
        if (this.useDeepSeekApi && deepSeekApiService.isAvailable()) {
            try {
                console.log('🚀 [CHATBOT] Utilisation de DeepSeek API...');
                const deepSeekResponse = await deepSeekApiService.generateNPCResponse(
                    context.npcName,
                    context.npcType,
                    playerMessage,
                    `Planète: ${context.planetId}, Faction: ${context.faction}, Humeur: ${context.mood || 'NEUTRE'}`
                );

                const response: ChatResponse = {
                    message: deepSeekResponse.message,
                    emotion: this.detectEmotion(deepSeekResponse.message),
                    nextPrompts: this.getDefaultPrompts(context),
                    source: 'DEEPSEEK_API'
                };

                this.responseCache.set(cacheKey, { response, timestamp: Date.now() });
                return response;
            } catch (error) {
                console.warn('⚠️ [CHATBOT] DeepSeek API échoué, fallback vers Qwen local:', error);
            }
        }

        // ✅ PRIORITÉ 2: Qwen3-4B local (si chargé)
        if (this.isLoaded && this.qwenModel) {
            try {
                const prompt = this.buildPrompt(playerMessage, context, history);

                const result = await this.qwenModel(prompt, {
                    max_new_tokens: 150,
                    temperature: 0.7,
                    top_p: 0.9,
                    do_sample: true
                });

                const generatedText = (result as any)[0]?.generated_text || '';
                const response = this.parseResponse(generatedText, context);
                response.source = 'QWEN_LOCAL';

                // Cache la réponse
                this.responseCache.set(cacheKey, { response, timestamp: Date.now() });

                return response;
            } catch (error) {
                console.warn('⚠️ [CHATBOT] Qwen local échoué, utilisation fallback:', error);
            }
        }

        // ✅ PRIORITÉ 3: Fallback intelligent (toujours disponible)
        const fallbackResponse = this.getFallbackResponse(playerMessage, context);
        fallbackResponse.source = 'FALLBACK';
        return fallbackResponse;
    }

    /**
     * Détecter l'émotion depuis le texte
     */
    private detectEmotion(text: string): ChatResponse['emotion'] {
        const lowerText = text.toLowerCase();
        if (lowerText.includes('!') || lowerText.includes('surprise')) return 'SURPRISE';
        if (lowerText.includes('triste') || lowerText.includes('désolé')) return 'TRISTE';
        if (lowerText.includes('colère') || lowerText.includes('furieux')) return 'COLERE';
        if (lowerText.includes('heureux') || lowerText.includes('content') || lowerText.includes(':)')) return 'CONTENT';
        return 'NEUTRE';
    }

    /**
     * Construire le prompt pour le modèle
     */
    private buildPrompt(
        playerMessage: string,
        context: NPCContext,
        history: ChatMessage[]
    ): string {
        const systemPrompt = `Tu es ${context.npcName}, un(e) ${context.npcType} de la planète ${context.planetId}.
Faction: ${context.faction}
Humeur: ${context.mood || 'NEUTRE'}
${context.questRelated ? 'Tu as une quête importante à proposer.' : ''}

Réponds de manière courte et immersive (max 2-3 phrases). Reste dans le personnage.
Réponds en JSON: {"message": "ta réponse", "emotion": "CONTENT|TRISTE|COLERE|SURPRISE|NEUTRE", "nextPrompts": ["suggestion1", "suggestion2"]}`;

        let conversationHistory = '';
        for (const msg of history.slice(-4)) { // Garder les 4 derniers messages
            conversationHistory += `${msg.role === 'user' ? 'Joueur' : context.npcName}: ${msg.content}\n`;
        }

        return `<s>[INST] ${systemPrompt}

${conversationHistory}Joueur: ${playerMessage}

${context.npcName}: [/INST]`;
    }

    /**
     * Parser la réponse du modèle
     */
    private parseResponse(text: string, context: NPCContext): ChatResponse {
        try {
            // Extraire le JSON de la réponse
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    message: parsed.message || 'Hmm...',
                    emotion: parsed.emotion || 'NEUTRE',
                    nextPrompts: parsed.nextPrompts || []
                };
            }
        } catch {
            // Si parsing échoue, extraire le texte brut
        }

        // Extraction simple du texte après [/INST]
        const responseStart = text.indexOf('[/INST]');
        let message = responseStart >= 0
            ? text.substring(responseStart + 7).trim()
            : text.trim();

        // Nettoyer
        message = message.replace(/<\/?s>/g, '').trim();
        if (message.length > 200) message = message.substring(0, 200) + '...';

        return {
            message: message || this.getDefaultResponse(context),
            emotion: 'NEUTRE',
            nextPrompts: this.getDefaultPrompts(context)
        };
    }

    /**
     * Réponse de fallback (sans IA)
     */
    private getFallbackResponse(playerMessage: string, context: NPCContext): ChatResponse {
        const greetings = ['bonjour', 'salut', 'hey', 'hello', 'coucou'];
        const isGreeting = greetings.some(g => playerMessage.toLowerCase().includes(g));

        const responses: Record<string, string[]> = {
            MARCHAND: [
                "Bienvenue dans ma boutique ! Que puis-je vous proposer ?",
                "J'ai des marchandises rares venues de toute la galaxie.",
                "Mes prix sont les meilleurs de la planète !"
            ],
            GARDE: [
                "Tout est calme dans le secteur.",
                "Je surveille cette zone. Passez votre chemin.",
                "Des problèmes dans le coin ? Dites-moi tout."
            ],
            CIVIL: [
                "Belle journée pour explorer, n'est-ce pas ?",
                "J'ai entendu des rumeurs intéressantes...",
                "Cette planète a tellement de secrets."
            ],
            SAGE: [
                "La sagesse vient à ceux qui savent écouter.",
                "Les étoiles ont beaucoup à nous apprendre.",
                "Je sens une grande destinée en vous."
            ],
            ARTISAN: [
                "Je peux créer tout ce dont vous avez besoin.",
                "Mes créations sont uniques dans toute la galaxie.",
                "Apportez-moi les bons matériaux et je ferai des merveilles."
            ]
        };

        const typeResponses = responses[context.npcType] || responses.CIVIL;
        const message = isGreeting
            ? typeResponses[0]
            : typeResponses[Math.floor(Math.random() * typeResponses.length)];

        return {
            message,
            emotion: context.mood === 'HOSTILE' ? 'COLERE' : 'NEUTRE',
            nextPrompts: this.getDefaultPrompts(context)
        };
    }

    /**
     * Réponse par défaut
     */
    private getDefaultResponse(context: NPCContext): string {
        const defaults: Record<string, string> = {
            MARCHAND: "Intéressé par mes articles ?",
            GARDE: "Hmm ?",
            CIVIL: "Oui ?",
            SAGE: "Je vous écoute.",
            ARTISAN: "Besoin de quelque chose ?"
        };
        return defaults[context.npcType] || "...";
    }

    /**
     * Suggestions de dialogue par défaut
     */
    private getDefaultPrompts(context: NPCContext): string[] {
        const prompts: Record<string, string[]> = {
            MARCHAND: ["Montrez-moi vos articles", "Combien pour ça ?", "Au revoir"],
            GARDE: ["Que se passe-t-il ici ?", "Des conseils ?", "Merci"],
            CIVIL: ["Parlez-moi de cet endroit", "Des nouvelles ?", "À bientôt"],
            SAGE: ["Enseignez-moi", "Quelle est ma destinée ?", "Je vous remercie"],
            ARTISAN: ["Que pouvez-vous créer ?", "J'ai des matériaux", "Je reviendrai"]
        };
        return prompts[context.npcType] || ["Oui", "Non", "Au revoir"];
    }

    /**
     * Obtenir le statut du service
     */
    public isModelLoaded(): boolean {
        return this.isLoaded;
    }

    /**
     * Nettoyer le cache
     */
    public clearCache(): void {
        this.responseCache.clear();
    }
}

export const chatbotService = ChatbotService.getInstance();
