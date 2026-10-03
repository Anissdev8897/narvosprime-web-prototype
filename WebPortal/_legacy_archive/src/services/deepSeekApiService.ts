/**
 * Service DeepSeek API via HuggingFace Router
 * Utilise l'API OpenAI-compatible de HuggingFace pour DeepSeek-V3.2
 */

export interface DeepSeekMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface DeepSeekResponse {
    message: string;
    reasoning?: string;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

/**
 * Service pour appeler DeepSeek-V3.2 via HuggingFace API
 */
class DeepSeekApiService {
    private static instance: DeepSeekApiService;
    private apiKey: string | null = null;
    private readonly BASE_URL = 'https://router.huggingface.co/v1';
    private readonly MODEL = 'deepseek-ai/DeepSeek-V3.2-Exp';

    // Cache pour réduire les appels API
    private cache: Map<string, { response: DeepSeekResponse; timestamp: number }> = new Map();
    private readonly CACHE_DURATION = 300000; // 5 minutes

    private constructor() {
        // Récupérer le token depuis les variables d'environnement ou localStorage
        this.apiKey = this.getApiKey();

        // ✅ Token par défaut si non trouvé (pour développement)
        if (!this.apiKey) {
            this.apiKey = process.env.HF_API_TOKEN || '';
            console.log('🔑 [DeepSeek] Token par défaut configuré');
        }
    }

    public static getInstance(): DeepSeekApiService {
        if (!DeepSeekApiService.instance) {
            DeepSeekApiService.instance = new DeepSeekApiService();
        }
        return DeepSeekApiService.instance;
    }

    /**
     * Vérifie si le service est configuré et prêt
     */
    public isAvailable(): boolean {
        return !!this.apiKey && this.apiKey.length > 0;
    }

    /**
     * Récupérer la clé API
     */
    private getApiKey(): string | null {
        // En Electron, on peut utiliser process.env
        if (typeof process !== 'undefined' && process.env?.HF_TOKEN) {
            return process.env.HF_TOKEN;
        }
        // En navigateur, on peut stocker dans localStorage
        if (typeof localStorage !== 'undefined') {
            return localStorage.getItem('HF_TOKEN');
        }
        return null;
    }

    /**
     * Définir la clé API
     */
    public setApiKey(key: string): void {
        this.apiKey = key;
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('HF_TOKEN', key);
        }
        console.log('✅ [DeepSeek] Clé API configurée');
    }

    /**
     * Générer une réponse avec DeepSeek
     */
    public async chat(
        messages: DeepSeekMessage[],
        options?: {
            maxTokens?: number;
            temperature?: number;
            systemPrompt?: string;
        }
    ): Promise<DeepSeekResponse> {
        if (!this.apiKey) {
            throw new Error('Clé API HuggingFace non configurée. Utilisez setApiKey() ou définissez HF_TOKEN.');
        }

        // Vérifier le cache
        const cacheKey = JSON.stringify(messages.slice(-3)); // Cache basé sur les 3 derniers messages
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
            console.log('💾 [DeepSeek] Réponse depuis cache');
            return cached.response;
        }

        try {
            // Construire les messages avec system prompt optionnel
            const fullMessages: DeepSeekMessage[] = options?.systemPrompt
                ? [{ role: 'system', content: options.systemPrompt }, ...messages]
                : messages;

            console.log('🚀 [DeepSeek] Envoi requête API...');

            const response = await fetch(`${this.BASE_URL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: this.MODEL,
                    messages: fullMessages,
                    max_tokens: options?.maxTokens || 256,
                    temperature: options?.temperature || 0.7
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ [DeepSeek] Erreur API:', response.status, errorText);
                throw new Error(`API Error ${response.status}: ${errorText}`);
            }

            const data = await response.json();

            const result: DeepSeekResponse = {
                message: data.choices?.[0]?.message?.content || '',
                reasoning: data.choices?.[0]?.message?.reasoning_content,
                usage: data.usage
            };

            // Mettre en cache
            this.cache.set(cacheKey, { response: result, timestamp: Date.now() });

            console.log('✅ [DeepSeek] Réponse reçue:', result.message.substring(0, 50) + '...');
            return result;

        } catch (error) {
            console.error('❌ [DeepSeek] Erreur:', error);
            throw error;
        }
    }

    /**
     * Générer un comportement NPC
     */
    public async generateNPCResponse(
        npcName: string,
        npcType: string,
        playerMessage: string,
        context?: string
    ): Promise<DeepSeekResponse> {
        const systemPrompt = `Tu es ${npcName}, un(e) ${npcType} dans un jeu vidéo de science-fiction.
Réponds de manière courte (max 2-3 phrases), immersive et dans le personnage.
${context ? `Contexte: ${context}` : ''}
Ne sors jamais du personnage. Utilise un langage adapté au jeu.`;

        return this.chat(
            [{ role: 'user', content: playerMessage }],
            { systemPrompt, maxTokens: 150, temperature: 0.8 }
        );
    }

    /**
     * Générer un comportement de monstre IA
     */
    public async generateMonsterBehavior(
        monsterName: string,
        situation: string
    ): Promise<{ action: string; reasoning: string }> {
        const systemPrompt = `Tu es une IA de jeu contrôlant un monstre nommé "${monsterName}".
Analyse la situation et décide de l'action: IDLE, PATROL, CHASE, ATTACK, FLEE, ou AMBUSH.
Réponds UNIQUEMENT en JSON: {"action": "ACTION", "reasoning": "explication courte"}`;

        try {
            const response = await this.chat(
                [{ role: 'user', content: situation }],
                { systemPrompt, maxTokens: 100, temperature: 0.5 }
            );

            const jsonMatch = response.message.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            return { action: 'PATROL', reasoning: 'Fallback behavior' };
        } catch {
            return { action: 'PATROL', reasoning: 'API error fallback' };
        }
    }

    /**
     * Générer une action tactique complexe pour un monstre (Combat Tactique)
     */
    public async generateTacticalAction(
        monsterState: any,
        combatants: any[]
    ): Promise<{ type: 'move' | 'spell' | 'pass'; targetX?: number; targetY?: number; spellId?: string; reasoning: string }> {
        const situation = {
            monster: {
                name: monsterState.name,
                pos: { x: monsterState.gridX, y: monsterState.gridY },
                stats: monsterState.stats,
                spells: monsterState.spells.map((s: any) => ({
                    id: s.id,
                    name: s.name,
                    pa: s.paCost,
                    range: s.maxRange
                }))
            },
            enemies: combatants
                .filter(c => c.team !== monsterState.team && c.isAlive)
                .map(c => ({ name: c.name, pos: { x: c.gridX, y: c.gridY }, hp: c.stats.hp })),
            allies: combatants
                .filter(c => c.team === monsterState.team && c.isAlive && c.id !== monsterState.id)
                .map(c => ({ name: c.name, pos: { x: c.gridX, y: c.gridY }, hp: c.stats.hp }))
        };

        const systemPrompt = `Tu es le cerveau tactique d'un monstre dans NARVOS PRIME (L'ia DeepSeek).
        TON OBJECTIF : Tuer les ennemis le plus efficacement possible.
        STRATÉGIE CONSEILLÉE : 
        1. Toujours essayer de se rapprocher pour attaquer si l'ennemi est hors de portée.
        2. Utiliser le "Hit and Run" : Après avoir attaqué, si tu as encore des PM, déplace-toi vers une case qui t'éloigne de l'ennemi pour réduire les chances d'être touché au prochain tour.
        3. Priorise les cibles avec peu de PV (Focus fire).
        4. Ne reste pas collé au joueur si tu n'as plus de PA.
        
        Analyse la grille (14x10) et décide de l'action. 
        Réponds UNIQUEMENT en JSON: {"type": "move"|"spell"|"pass", "targetX": X, "targetY": Y, "spellId": "ID", "reasoning": "..."}`;

        try {
            const response = await this.chat(
                [{ role: 'user', content: JSON.stringify(situation) }],
                { systemPrompt, maxTokens: 150, temperature: 0.3 }
            );

            const jsonMatch = response.message.match(/\{[\s\S]*\}/);
            if (jsonMatch) return JSON.parse(jsonMatch[0]);
            return { type: 'pass', reasoning: 'AI decode failed' };
        } catch (error) {
            console.error('DeepSeek AI error:', error);
            return { type: 'pass', reasoning: 'API error fallback' };
        }
    }

    /**
     * Nettoyer le cache
     */
    public clearCache(): void {
        this.cache.clear();
        console.log('🧹 [DeepSeek] Cache vidé');
    }
}

export const deepSeekApiService = DeepSeekApiService.getInstance();
