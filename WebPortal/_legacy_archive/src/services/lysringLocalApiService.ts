/**
 * Service pour l'IA Locale LysringV4
 * Utilisé comme fallback si DeepSeek n'est pas disponible
 */

export interface LysringMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface LysringResponse {
    message: string;
    usage?: any;
}

class LysringLocalApiService {
    private static instance: LysringLocalApiService;
    // URL locale par défaut (ajustable selon le runner local - ex: LM Studio, vLLM, Ollama)
    private readonly BASE_URL = 'http://localhost:5001/v1'; // Narvos Local AI Server
    private readonly MODEL = 'lysring-v4';

    private constructor() { }

    public static getInstance(): LysringLocalApiService {
        if (!LysringLocalApiService.instance) {
            LysringLocalApiService.instance = new LysringLocalApiService();
        }
        return LysringLocalApiService.instance;
    }

    /**
     * Vérifie si le serveur local répond
     */
    public async isAvailable(): Promise<boolean> {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);

            // On tente un ping sur l'endpoint models ou juste un fetch
            const response = await fetch(`${this.BASE_URL}/models`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response.ok;
        } catch (e) {
            return false;
        }
    }

    /**
     * Chat avec l'IA locale (API compatible OpenAI)
     */
    public async chat(messages: LysringMessage[]): Promise<LysringResponse> {
        try {
            const response = await fetch(`${this.BASE_URL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: this.MODEL,
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: 500
                })
            });

            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }

            const data = await response.json();
            return {
                message: data.choices[0].message.content,
                usage: data.usage
            };
        } catch (error) {
            console.error('❌ [IA Locale] Erreur:', error);
            throw error;
        }
    }

    /**
     * Génère une action tactique (Format identique à DeepSeek pour compatibilité)
     */
    public async generateTacticalAction(monsterState: any, combatants: any[]): Promise<any> {
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

        const systemPrompt = `Tu es le cerveau tactique d'un monstre dans NARVOS PRIME (L'ia Locale LysringV4).
        TON OBJECTIF : Tuer les ennemis le plus efficacement possible.
        STRATÉGIE : Utilise tes sorts si tu es à portée, sinon déplace-toi. Utilise tes PM restants pour fuir après l'attaque.
        RÉPONDS UNIQUEMENT EN JSON: {"type": "move"|"spell"|"pass", "targetX": X, "targetY": Y, "spellId": "ID", "reasoning": "..."}`;

        try {
            const response = await this.chat([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: JSON.stringify(situation) }
            ]);

            const jsonMatch = response.message.match(/\{[\s\S]*\}/);
            if (jsonMatch) return JSON.parse(jsonMatch[0]);
            throw new Error('Format JSON invalide');
        } catch (error) {
            console.warn('⚠️ [IA Locale] Fallback sur le script de base');
            throw error;
        }
    }
}

export const lysringLocalApiService = LysringLocalApiService.getInstance();
