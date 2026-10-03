/**
 * Gestionnaire de Modèles IA pour PNJ
 * Architecture modulaire pour intégrer et gérer les modèles IA essentiels
 * 
 * Modèles sélectionnés pour les PNJ :
 * - Chatbot (09-Chatbot) : Dialogues, réponses contextuelles
 * - Agent Autonome (10-agent-autonome) : Comportements, décisions, routines
 */

import { localAIService } from './localAIService';

export type AIModelType = 'CHATBOT' | 'AGENT' | 'VISION_LANGUAGE';
export type AIModelStatus = 'NOT_LOADED' | 'LOADING' | 'LOADED' | 'ERROR';

export interface AIModelConfig {
  id: string;
  name: string;
  type: AIModelType;
  path: string;
  description: string;
  useCase: string[];
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  enabled: boolean;
}

export interface AIModelStatusInfo {
  config: AIModelConfig;
  status: AIModelStatus;
  error?: string;
  loadTime?: number;
}

/**
 * Gestionnaire centralisé des modèles IA pour PNJ
 */
class AIModelManager {
  private static instance: AIModelManager;
  private models: Map<string, AIModelStatusInfo> = new Map();
  private loadPromises: Map<string, Promise<void>> = new Map();

  // Configuration des modèles IA essentiels pour les PNJ
  private readonly MODEL_CONFIGS: AIModelConfig[] = [
    {
      id: 'lysringv4',
      name: 'LysringV4',
      type: 'CHATBOT',
      path: '/LysringV4',
      description: 'Modèle de dialogue pour conversations avec les PNJ',
      useCase: ['dialogue', 'réponses contextuelles', 'interactions joueur-PNJ'],
      priority: 'HIGH',
      enabled: false // ❌ DÉSACTIVÉ temporairement
    },
    {
      id: 'mistral-7b',
      name: 'Mistral-7B-v0.1',
      type: 'CHATBOT',
      path: '/Mistral-7B-v0.1',
      description: 'Modèle alternatif pour dialogues avancés',
      useCase: ['dialogue avancé', 'compréhension contextuelle'],
      priority: 'MEDIUM',
      enabled: false // Désactivé par défaut, peut être activé plus tard
    },
    {
      id: 'qwen3-4b',
      name: 'Qwen3-4B',
      type: 'CHATBOT',
      path: '/Qwen3-4B',
      description: 'Modèle léger pour dialogues NPC (Mode Fusion)',
      useCase: ['dialogue rapide', 'réponses courtes', 'npc'],
      priority: 'HIGH',
      enabled: false // ❌ DÉSACTIVÉ temporairement
    },
    {
      id: 'codellama-agent',
      name: 'CodeLlama-7B-Instruct',
      type: 'AGENT',
      path: '/codellama-7b-instruct',
      description: 'Agent autonome pour comportements et décisions des PNJ',
      useCase: ['comportements autonomes', 'décisions', 'routines', 'réactions'],
      priority: 'HIGH',
      enabled: false // À implémenter plus tard
    }
  ];

  private constructor() {
    // Initialiser le statut de tous les modèles
    this.MODEL_CONFIGS.forEach(config => {
      this.models.set(config.id, {
        config,
        status: 'NOT_LOADED'
      });
    });
  }

  public static getInstance(): AIModelManager {
    if (!AIModelManager.instance) {
      AIModelManager.instance = new AIModelManager();
    }
    return AIModelManager.instance;
  }

  /**
   * Obtenir la configuration d'un modèle
   */
  public getModelConfig(id: string): AIModelConfig | null {
    return this.MODEL_CONFIGS.find(m => m.id === id) || null;
  }

  /**
   * Obtenir tous les modèles activés
   */
  public getEnabledModels(): AIModelConfig[] {
    return this.MODEL_CONFIGS.filter(m => m.enabled);
  }

  /**
   * Obtenir le statut d'un modèle
   */
  public getModelStatus(id: string): AIModelStatusInfo | null {
    return this.models.get(id) || null;
  }

  /**
   * Obtenir tous les statuts
   */
  public getAllStatuses(): AIModelStatusInfo[] {
    return Array.from(this.models.values());
  }

  /**
   * Charger un modèle spécifique
   */
  public async loadModel(id: string, onProgress?: (progress: number) => void): Promise<void> {
    const modelInfo = this.models.get(id);
    if (!modelInfo) {
      throw new Error(`Modèle ${id} non trouvé`);
    }

    if (modelInfo.status === 'LOADED') {
      return Promise.resolve();
    }

    if (modelInfo.status === 'LOADING') {
      return this.loadPromises.get(id) || Promise.resolve();
    }

    if (!modelInfo.config.enabled) {
      console.log(`⚠️ [AIModelManager] Modèle ${id} désactivé, chargement ignoré`);
      return Promise.resolve();
    }

    const startTime = Date.now();
    modelInfo.status = 'LOADING';

    const loadPromise = (async () => {
      try {
        // Pour l'instant, on utilise localAIService pour LysringV4
        // Plus tard, on pourra charger d'autres modèles ici
        if (id === 'lysringv4') {
          await localAIService.loadModel(onProgress);
          modelInfo.status = localAIService.isModelLoaded() ? 'LOADED' : 'ERROR';
        } else {
          // TODO: Implémenter le chargement des autres modèles
          console.warn(`⚠️ [AIModelManager] Chargement de ${id} non implémenté`);
          modelInfo.status = 'ERROR';
          modelInfo.error = 'Chargement non implémenté';
        }

        if (modelInfo.status === 'LOADED') {
          modelInfo.loadTime = Date.now() - startTime;
          console.log(`✅ [AIModelManager] Modèle ${id} chargé en ${modelInfo.loadTime}ms`);
        }
      } catch (error: any) {
        modelInfo.status = 'ERROR';
        modelInfo.error = error?.message || 'Erreur inconnue';
        console.error(`❌ [AIModelManager] Erreur lors du chargement de ${id}:`, error);
      }
    })();

    this.loadPromises.set(id, loadPromise);
    return loadPromise;
  }

  /**
   * Charger tous les modèles activés
   */
  public async loadAllEnabledModels(onProgress?: (modelId: string, progress: number) => void): Promise<void> {
    const enabledModels = this.getEnabledModels();
    console.log(`🔄 [AIModelManager] Chargement de ${enabledModels.length} modèle(s) activé(s)`);

    for (const model of enabledModels) {
      try {
        await this.loadModel(model.id, (progress) => {
          onProgress?.(model.id, progress);
        });
      } catch (error) {
        console.error(`❌ [AIModelManager] Erreur lors du chargement de ${model.id}:`, error);
      }
    }
  }

  /**
   * Vérifier si un modèle est disponible
   */
  public async checkModelAvailability(id: string): Promise<boolean> {
    const modelInfo = this.models.get(id);
    if (!modelInfo) return false;

    try {
      const configUrl = `${modelInfo.config.path}/config.json`;
      const response = await fetch(configUrl, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Activer/Désactiver un modèle
   */
  public setModelEnabled(id: string, enabled: boolean): void {
    const modelInfo = this.models.get(id);
    if (modelInfo) {
      modelInfo.config.enabled = enabled;
      console.log(`${enabled ? '✅' : '❌'} [AIModelManager] Modèle ${id} ${enabled ? 'activé' : 'désactivé'}`);
    }
  }

  /**
   * Obtenir le modèle recommandé pour un use case
   */
  public getRecommendedModel(useCase: string): AIModelConfig | null {
    const enabledModels = this.getEnabledModels();

    // Chercher un modèle qui correspond exactement au use case
    for (const model of enabledModels) {
      if (model.useCase.includes(useCase.toLowerCase())) {
        return model;
      }
    }

    // Sinon, retourner le premier modèle activé de type approprié
    if (useCase.includes('dialogue') || useCase.includes('chat')) {
      return enabledModels.find(m => m.type === 'CHATBOT') || null;
    }
    if (useCase.includes('comportement') || useCase.includes('décision')) {
      return enabledModels.find(m => m.type === 'AGENT') || null;
    }

    return enabledModels[0] || null;
  }
}

export const aiModelManager = AIModelManager.getInstance();

