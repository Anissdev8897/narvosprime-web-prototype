/**
 * Service d'IA pour les monstres utilisant l'IA locale (LysringV4)
 * Délègue les appels au localAIService
 */

import { localAIService, LocalAIBehaviorRequest, LocalAIBehaviorResponse } from './localAIService';

export interface AIModelConfig {
  model: string;
  baseUrl: string;
  apiKey: string;
  maxTokens: number;
  temperature: number;
}

export interface AIBehaviorRequest {
  monsterName: string;
  monsterType: 'AGGRESSIVE' | 'DEFENSIVE' | 'STRATEGIC';
  currentState: 'IDLE' | 'PATROL' | 'CHASE' | 'ATTACK' | 'FLEE' | 'AMBUSH';
  playerDistance: number;
  playerHealth: number;
  monsterHealth: number;
  biome: string;
  context?: string;
}

export interface AIBehaviorResponse {
  action: 'IDLE' | 'PATROL' | 'CHASE' | 'ATTACK' | 'FLEE' | 'AMBUSH';
  direction?: { x: number; y: number; z: number };
  reasoning: string;
  confidence: number;
}

// Configuration des modèles API disponibles
// Seulement OpenAI et Grok sont conservés
export const AI_MODELS: Record<string, AIModelConfig> = {
  // Modèle 1: Comportement Agressif (combat direct) - GPT-4o (OpenAI)
  AGGRESSIVE: {
    model: "gpt-4o-mini-2024-07-18",
    baseUrl: "https://api.openai.com/v1",
    apiKey: process.env.OPENAI_API_KEY || "",
    maxTokens: 4096,
    temperature: 0.0,
  },

  // Modèle 2: Comportement Défensif (patrouille, évasion) - Grok Beta
  DEFENSIVE: {
    model: "grok-beta",
    baseUrl: "https://api.x.ai/v1",
    apiKey: process.env.XAI_API_KEY || "",
    maxTokens: 4096,
    temperature: 0.0,
  },

  // Modèle 3: Comportement Stratégique (embuscade, tactique) - GPT-4o (OpenAI)
  STRATEGIC: {
    model: "gpt-4o-mini-2024-07-18",
    baseUrl: "https://api.openai.com/v1",
    apiKey: process.env.OPENAI_API_KEY || "",
    maxTokens: 4096,
    temperature: 0.0,
  },
};

class AIService {
  private cache: Map<string, { response: AIBehaviorResponse; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 2000; // 2 secondes de cache

  /**
   * Détermine le type de comportement selon le monstre
   */
  private getBehaviorType(monsterName: string, aggressiveness: number): 'AGGRESSIVE' | 'DEFENSIVE' | 'STRATEGIC' {
    // Monstres agressifs (combat direct)
    if (aggressiveness > 0.7 || monsterName.includes('Predator') || monsterName.includes('Serpent')) {
      return 'AGGRESSIVE';
    }
    // Monstres stratégiques (embuscade, tactique)
    if (monsterName.includes('Lurker') || monsterName.includes('Goliath') || monsterName.includes('Leviathan')) {
      return 'STRATEGIC';
    }
    // Par défaut: défensif (patrouille)
    return 'DEFENSIVE';
  }

  /**
   * Appelle l'API (OpenAI ou Grok) pour obtenir un comportement
   */
  private async callAPI(
    config: AIModelConfig,
    request: AIBehaviorRequest
  ): Promise<AIBehaviorResponse> {
    const cacheKey = `${request.monsterName}-${request.currentState}-${Math.floor(request.playerDistance)}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.response;
    }

    const prompt = this.buildPrompt(request);

    // Déterminer l'endpoint selon l'API (OpenAI ou Grok utilisent le même endpoint)
    const endpoint = `${config.baseUrl}/chat/completions`;

    // Headers communs
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    };

    // Headers spécifiques pour OpenAI
    if (config.baseUrl.includes('openai.com')) {
      headers['HTTP-Referer'] = window.location.origin;
      headers['X-Title'] = 'NarvosPrime AI Monster System';
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: config.model,
          messages: [
            {
              role: 'system',
              content: 'You are an AI controlling a monster in a 3D game. Respond ONLY with valid JSON: {"action": "IDLE|PATROL|CHASE|ATTACK|FLEE|AMBUSH", "direction": {"x": number, "y": number, "z": number}, "reasoning": "string", "confidence": 0.0-1.0}'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: config.maxTokens,
          temperature: config.temperature,
          response_format: { type: 'json_object' }
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No response from AI');
      }

      const aiResponse: AIBehaviorResponse = JSON.parse(content);

      // Validation et fallback
      if (!['IDLE', 'PATROL', 'CHASE', 'ATTACK', 'FLEE', 'AMBUSH'].includes(aiResponse.action)) {
        aiResponse.action = 'PATROL';
      }

      if (!aiResponse.direction) {
        aiResponse.direction = { x: 0, y: 0, z: 0 };
      }

      if (aiResponse.confidence === undefined) {
        aiResponse.confidence = 0.5;
      }

      // Cache la réponse
      this.cache.set(cacheKey, { response: aiResponse, timestamp: Date.now() });

      return aiResponse;
    } catch (error) {
      console.warn('AI Service error, using fallback behavior:', error);
      // Fallback: comportement basique
      return this.getFallbackBehavior(request);
    }
  }

  /**
   * Construit le prompt pour l'IA
   */
  private buildPrompt(request: AIBehaviorRequest): string {
    return `Monster: ${request.monsterName}
Type: ${request.monsterType}
Current State: ${request.currentState}
Biome: ${request.biome}
Player Distance: ${request.playerDistance.toFixed(1)} units
Monster Health: ${request.monsterHealth}/${request.monsterHealth}
Player Health: ${request.playerHealth}

Context: ${request.context || 'Standard gameplay'}

Decide the next action for this monster. Consider:
- Distance to player
- Health status
- Monster type and behavior
- Current state

Respond with JSON only.`;
  }

  /**
   * Comportement de fallback si l'IA échoue
   */
  private getFallbackBehavior(request: LocalAIBehaviorRequest): AIBehaviorResponse {
    let action: AIBehaviorResponse['action'] = 'PATROL';

    // ✅ Comportement de fallback amélioré selon le type de monstre
    // AGGRESSIVE: Attaque directe
    if (request.monsterType === 'AGGRESSIVE') {
      if (request.playerDistance < 8) {
        action = 'ATTACK';
      } else if (request.playerDistance < 20) {
        action = 'CHASE';
      } else {
        action = 'PATROL';
      }
    }
    // DEFENSIVE: Patrouille et fuite si faible
    else if (request.monsterType === 'DEFENSIVE') {
      if (request.monsterHealth < 30) {
        action = 'FLEE';
      } else if (request.playerDistance < 5) {
        action = 'ATTACK';
      } else if (request.playerDistance < 12) {
        action = 'CHASE';
      } else {
        action = 'PATROL';
      }
    }
    // STRATEGIC: Embuscade et tactique
    else if (request.monsterType === 'STRATEGIC') {
      if (request.playerDistance < 6) {
        action = 'ATTACK';
      } else if (request.playerDistance < 15 && request.monsterHealth > 50) {
        action = 'AMBUSH';
      } else if (request.playerDistance < 25) {
        action = 'CHASE';
      } else {
        action = 'PATROL';
      }
    }
    // Fallback par défaut
    else {
      if (request.playerDistance < 5) {
        action = 'ATTACK';
      } else if (request.playerDistance < 15) {
        action = 'CHASE';
      } else if (request.monsterHealth < 30) {
        action = 'FLEE';
      }
    }

    return {
      action,
      direction: { x: 0, y: 0, z: 0 },
      reasoning: `Fallback behavior (AI unavailable) - Type: ${request.monsterType}`,
      confidence: 0.5,
    };
  }

  /**
   * Méthode principale: obtient le comportement d'un monstre
   * Utilise maintenant l'IA locale (LysringV4)
   */
  async getMonsterBehavior(
    monsterName: string,
    aggressiveness: number,
    currentState: 'IDLE' | 'PATROL' | 'CHASE' | 'ATTACK' | 'FLEE' | 'AMBUSH',
    playerDistance: number,
    playerHealth: number,
    monsterHealth: number,
    biome: string,
    context?: string
  ): Promise<AIBehaviorResponse> {
    const behaviorType = this.getBehaviorType(monsterName, aggressiveness);

    const request: LocalAIBehaviorRequest = {
      monsterName,
      monsterType: behaviorType,
      currentState,
      playerDistance,
      playerHealth,
      monsterHealth,
      biome,
      context,
    };

    // Utiliser l'IA locale
    if (localAIService.isModelLoaded()) {
      try {
        const response = await localAIService.generateBehavior(request);
        return response as AIBehaviorResponse;
      } catch (error) {
        console.warn('Erreur IA locale, utilisation du fallback:', error);
        return this.getFallbackBehavior(request);
      }
    } else {
      // Si le modèle n'est pas encore chargé, utiliser le fallback
      return this.getFallbackBehavior(request);
    }
  }

  /**
   * Nettoie le cache
   */
  clearCache() {
    this.cache.clear();
  }
}

export const aiService = new AIService();

