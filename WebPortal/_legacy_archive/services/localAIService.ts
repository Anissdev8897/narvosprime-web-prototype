/**
 * Service d'IA locale utilisant le modèle LysringV4
 * Chargé une seule fois au démarrage et mis en cache
 */

import { pipeline, env } from '@xenova/transformers';
import type { TextGenerationPipeline } from '@xenova/transformers';

// Désactiver le cache local pour utiliser notre propre système
env.allowLocalModels = true;
env.useBrowserCache = false;

export interface LocalAIBehaviorRequest {
  monsterName: string;
  monsterType: 'AGGRESSIVE' | 'DEFENSIVE' | 'STRATEGIC';
  currentState: 'IDLE' | 'PATROL' | 'CHASE' | 'ATTACK' | 'FLEE' | 'AMBUSH';
  playerDistance: number;
  playerHealth: number;
  monsterHealth: number;
  biome: string;
  context?: string;
}

export interface LocalAIBehaviorResponse {
  action: 'IDLE' | 'PATROL' | 'CHASE' | 'ATTACK' | 'FLEE' | 'AMBUSH';
  direction?: { x: number; y: number; z: number };
  reasoning: string;
  confidence: number;
}

class LocalAIService {
  private static instance: LocalAIService;
  private model: TextGenerationPipeline | null = null;
  private isLoaded: boolean = false;
  private isLoading: boolean = false;
  private loadPromise: Promise<void> | null = null;
  private cache: Map<string, { response: LocalAIBehaviorResponse; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 2000; // 2 secondes de cache

  private constructor() { }

  public static getInstance(): LocalAIService {
    if (!LocalAIService.instance) {
      LocalAIService.instance = new LocalAIService();
    }
    return LocalAIService.instance;
  }

  /**
   * Vérifie si le modèle existe sur le serveur
   */
  private async checkModelExists(modelPath: string): Promise<boolean> {
    try {
      // Vérifier si le fichier config.json existe (fichier requis pour un modèle transformers)
      const configUrl = `${modelPath}/config.json`;
      console.log(`🔍 [IA] Vérification du modèle à: ${configUrl}`);
      const response = await fetch(configUrl, { method: 'HEAD' });
      const exists = response.ok;
      console.log(`📋 [IA] Résultat: ${exists ? '✅ Fichier trouvé' : '❌ Fichier non trouvé'} (Status: ${response.status})`);
      if (!exists && response.status === 404) {
        console.warn(`⚠️ [IA] Le fichier ${configUrl} n'existe pas. Vérifiez que le dossier est dans public/`);
      }
      return exists;
    } catch (error) {
      console.error('❌ [IA] Erreur lors de la vérification du modèle:', error);
      return false;
    }
  }

  /**
   * Charge le modèle LysringV4 (une seule fois)
   */
  public async loadModel(onProgress?: (progress: number) => void): Promise<void> {
    if (this.isLoaded) {
      return Promise.resolve();
    }

    if (this.isLoading && this.loadPromise) {
      return this.loadPromise;
    }

    this.isLoading = true;
    this.loadPromise = (async () => {
      try {
        console.log('🔍 Vérification de la disponibilité du modèle IA local LysringV4...');

        const modelPath = '/LysringV4';

        // Vérifier si le modèle existe avant de le charger
        const modelExists = await this.checkModelExists(modelPath);
        console.log(`📂 Chemin vérifié: ${modelPath}/config.json`);
        console.log(`✅ Modèle trouvé: ${modelExists ? 'OUI' : 'NON'}`);

        if (!modelExists) {
          console.warn('⚠️ Modèle IA local non trouvé dans /LysringV4. Le jeu continuera sans IA locale (utilisation du fallback).');
          console.warn('');
          console.warn('📋 Pour activer l\'IA locale:');
          console.warn('   1. Créez le dossier public/LysringV4/');
          console.warn('   2. Placez tous les fichiers du modèle dans ce dossier');
          console.warn('   3. Fichiers requis: config.json, tokenizer.json, tokenizer_config.json, model.safetensors.index.json, model-*.safetensors');
          console.warn('');
          console.warn('💡 Le jeu fonctionnera normalement sans IA locale (les PNJ utiliseront le comportement de fallback).');
          this.isLoading = false;
          this.isLoaded = false; // Marquer comme non chargé pour utiliser le fallback
          return; // Sortir silencieusement sans erreur
        }

        console.log('📥 Chargement du modèle IA local LysringV4...');
        console.log(`📂 Chemin du modèle: ${modelPath}`);
        console.log('⚙️ Configuration du pipeline: text-generation, dtype=q8, device=cpu');

        // Charger le modèle depuis le dossier local
        try {
          console.log('🔄 [IA] Tentative de chargement avec quantisation q8...');
          this.model = await pipeline(
            'text-generation',
            modelPath,
            {
              progress_callback: (progress: any) => {
                console.log(`📊 [IA] Progression du chargement:`, progress);
                if (onProgress && progress.progress !== undefined) {
                  onProgress(progress.progress);
                }
              },
              device: 'cpu', // Utiliser CPU (WebAssembly)
            } as any // Options typées comme any pour éviter les erreurs de type
          ) as TextGenerationPipeline;
          console.log('✅ Pipeline créé avec succès');
        } catch (pipelineError: any) {
          console.error('❌ [IA] Erreur lors de la création du pipeline:', pipelineError);
          console.error('💡 Tentative sans options supplémentaires...');
          // Essayer sans options supplémentaires si la première tentative échoue
          this.model = await pipeline(
            'text-generation',
            modelPath,
            {
              progress_callback: (progress: any) => {
                console.log(`📊 [IA] Progression du chargement (sans options):`, progress);
                if (onProgress && progress.progress !== undefined) {
                  onProgress(progress.progress);
                }
              },
            } as any
          ) as TextGenerationPipeline;
          console.log('✅ Pipeline créé avec succès (sans options supplémentaires)');
        }

        this.isLoaded = true;
        this.isLoading = false;
        console.log('✅ Modèle IA local chargé avec succès');
        console.log('🤖 L\'IA est maintenant disponible pour contrôler les monstres');
      } catch (error: any) {
        // Log détaillé de l'erreur pour diagnostic
        console.error('❌ [IA] Erreur détaillée lors du chargement du modèle:', {
          message: error?.message,
          name: error?.name,
          stack: error?.stack,
          error: error
        });

        // Vérifier si l'erreur est due à un fichier manquant (HTML au lieu de JSON)
        if (error?.message?.includes('DOCTYPE') || error?.message?.includes('Unexpected token') || error?.message?.includes('is not valid JSON')) {
          console.warn('⚠️ Modèle IA local - Certains fichiers sont manquants ou invalides.');
          console.warn('💡 Le modèle essaie de charger des fichiers qui retournent du HTML (404) au lieu de JSON.');
          console.warn('💡 Cela signifie que le dossier public/LysringV4/ est manquant ou incomplet.');
          console.warn('');
          console.warn('📋 Fichiers requis pour le modèle LysringV4:');
          console.warn('   ✅ config.json - Configuration du modèle');
          console.warn('   ✅ tokenizer.json - Tokenizer principal');
          console.warn('   ✅ tokenizer_config.json - Configuration du tokenizer');
          console.warn('   ✅ model.safetensors.index.json - Index des poids du modèle');
          console.warn('   ✅ model-*.safetensors - Fichiers de poids du modèle (peuvent être plusieurs)');
          console.warn('   ⚠️  Autres fichiers possibles: vocab.json, merges.txt, special_tokens_map.json, added_tokens.json');
          console.warn('');
          console.warn('🔧 Solutions:');
          console.warn('   1. Vérifiez que le dossier public/LysringV4/ existe');
          console.warn('   2. Vérifiez que tous les fichiers requis sont présents');
          console.warn('   3. Ouvrez les DevTools > Network et cherchez les requêtes 404 vers /LysringV4/');
          console.warn('   4. Si le modèle n\'est pas disponible, le jeu continuera sans IA locale (fallback activé)');
          console.warn('');
          console.warn('💡 Le jeu continuera sans IA locale (utilisation du fallback).');
        } else {
          console.error('❌ Erreur lors du chargement du modèle IA local:', error);
          console.error('📋 Détails de l\'erreur:', {
            message: error?.message || 'Aucun message',
            name: error?.name || 'Unknown',
            type: typeof error,
            stack: error?.stack || 'Pas de stack trace'
          });
        }
        this.isLoading = false;
        this.isLoaded = false; // Marquer comme non chargé pour utiliser le fallback
        // Ne pas throw l'erreur pour ne pas bloquer le chargement du jeu
      }
    })();

    return this.loadPromise;
  }

  /**
   * Vérifie si le modèle est chargé
   */
  public isModelLoaded(): boolean {
    return this.isLoaded && this.model !== null;
  }

  /**
   * Génère un comportement pour un monstre
   */
  public async generateBehavior(
    request: LocalAIBehaviorRequest
  ): Promise<LocalAIBehaviorResponse> {
    // Si le modèle n'est pas chargé, utiliser directement le fallback
    if (!this.isModelLoaded()) {
      console.debug('Modèle IA non disponible, utilisation du comportement de fallback');
      return this.getFallbackBehavior(request);
    }

    // Vérifier le cache
    const cacheKey = `${request.monsterName}-${request.currentState}-${Math.floor(request.playerDistance)}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.response;
    }

    const prompt = this.buildPrompt(request);

    try {
      // Générer la réponse avec le modèle local
      const output = await (this.model as any)(prompt, {
        max_new_tokens: 150,
        temperature: 0.7,
        top_p: 0.9,
        do_sample: true,
        return_full_text: false,
      });

      // Le type de sortie peut varier, on utilise any pour la compatibilité
      const outputArray = Array.isArray(output) ? output : [output];
      const generatedText = (outputArray[0] as any)?.generated_text || (outputArray[0] as any)?.text || '';

      // Parser la réponse JSON
      let aiResponse: LocalAIBehaviorResponse;
      try {
        // Essayer d'extraire le JSON de la réponse
        const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          aiResponse = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        // Si le parsing échoue, utiliser le fallback
        console.warn('Erreur lors du parsing de la réponse IA, utilisation du fallback:', parseError);
        return this.getFallbackBehavior(request);
      }

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

      // Mettre en cache
      this.cache.set(cacheKey, { response: aiResponse, timestamp: Date.now() });

      return aiResponse;
    } catch (error) {
      console.warn('Erreur lors de la génération IA locale, utilisation du fallback:', error);
      return this.getFallbackBehavior(request);
    }
  }

  /**
   * Construit le prompt pour l'IA
   */
  private buildPrompt(request: LocalAIBehaviorRequest): string {
    return `<s>[INST] You are an AI controlling a monster in a 3D game. Respond ONLY with valid JSON.

Monster: ${request.monsterName}
Type: ${request.monsterType}
Current State: ${request.currentState}
Biome: ${request.biome}
Player Distance: ${request.playerDistance.toFixed(1)} units
Monster Health: ${request.monsterHealth}
Player Health: ${request.playerHealth}

Context: ${request.context || 'Standard gameplay'}

Decide the next action for this monster. Consider:
- Distance to player
- Health status
- Monster type and behavior
- Current state

Respond with JSON only in this format:
{"action": "IDLE|PATROL|CHASE|ATTACK|FLEE|AMBUSH", "direction": {"x": number, "y": number, "z": number}, "reasoning": "string", "confidence": 0.0-1.0} [/INST]`;
  }

  /**
   * Comportement de fallback si l'IA échoue
   */
  private getFallbackBehavior(request: LocalAIBehaviorRequest): LocalAIBehaviorResponse {
    let action: LocalAIBehaviorResponse['action'] = 'PATROL';

    if (request.playerDistance < 5) {
      action = 'ATTACK';
    } else if (request.playerDistance < 15) {
      action = 'CHASE';
    } else if (request.monsterHealth < 30) {
      action = 'FLEE';
    }

    return {
      action,
      direction: { x: 0, y: 0, z: 0 },
      reasoning: 'Fallback behavior (AI unavailable)',
      confidence: 0.5,
    };
  }

  /**
   * Nettoie le cache
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Libère les ressources du modèle
   */
  public dispose(): void {
    this.model = null;
    this.isLoaded = false;
    this.isLoading = false;
    this.loadPromise = null;
    this.clearCache();
  }
}

export const localAIService = LocalAIService.getInstance();

