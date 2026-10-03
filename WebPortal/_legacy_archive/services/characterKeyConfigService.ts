/**
 * Service de configuration de touches individuel par personnage
 * Chaque personnage possède sa propre configuration isolée
 */

export interface CharacterAnimationAction {
  // Actions de base
  jump: string;
  sprint: string;
  
  // Actions sociales/émotes
  dance: string;
  sit: string;
  lieDown: string;
  drink: string;
  
  // Actions contextuelles
  collect: string;
  interact: string;
  
  // Actions de nage (si disponibles)
  swimUp?: string;
  swimDown?: string;
  
  // Actions personnalisées (pour futures compétences)
  ability1?: string;
  ability2?: string;
  ability3?: string;
}

export interface CharacterKeyConfig {
  characterId: string;
  characterName: string;
  faction: string;
  animations: CharacterAnimationAction;
  lastModified: number;
}

export class CharacterKeyConfigService {
  private static instance: CharacterKeyConfigService;
  private configs: Map<string, CharacterKeyConfig> = new Map();
  private readonly STORAGE_KEY = 'narvos_character_key_configs';

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): CharacterKeyConfigService {
    if (!CharacterKeyConfigService.instance) {
      CharacterKeyConfigService.instance = new CharacterKeyConfigService();
    }
    return CharacterKeyConfigService.instance;
  }

  /**
   * Obtient la configuration par défaut pour un personnage
   */
  private getDefaultConfig(characterId: string, characterName: string, faction: string): CharacterKeyConfig {
    return {
      characterId,
      characterName,
      faction,
      animations: {
        jump: ' ', // Espace
        sprint: 'shift',
        dance: 'ctrl+1',
        sit: 'ctrl+2',
        lieDown: 'ctrl+3',
        drink: 'ctrl+4',
        collect: 'e',
        interact: 'f',
        swimUp: 'space',
        swimDown: 'c',
        ability1: '1',
        ability2: '2',
        ability3: '3'
      },
      lastModified: Date.now()
    };
  }

  /**
   * Obtient la configuration pour un personnage (crée si elle n'existe pas)
   */
  public getConfig(characterId: string, characterName: string, faction: string): CharacterKeyConfig {
    if (!this.configs.has(characterId)) {
      const defaultConfig = this.getDefaultConfig(characterId, characterName, faction);
      this.configs.set(characterId, defaultConfig);
      this.saveToStorage();
    }
    return this.configs.get(characterId)!;
  }

  /**
   * Met à jour la configuration d'un personnage
   */
  public updateConfig(characterId: string, updates: Partial<CharacterKeyConfig>): void {
    const current = this.configs.get(characterId);
    if (!current) {
      console.warn(`⚠️ [KEYCONFIG] Tentative de mise à jour d'une configuration inexistante: ${characterId}`);
      return;
    }

    const updated: CharacterKeyConfig = {
      ...current,
      ...updates,
      lastModified: Date.now()
    };

    this.configs.set(characterId, updated);
    this.saveToStorage();
    console.log(`✅ [KEYCONFIG] Configuration mise à jour pour ${characterId}`);
  }

  /**
   * Met à jour une action spécifique d'un personnage
   */
  public updateAction(characterId: string, action: keyof CharacterAnimationAction, key: string): void {
    const config = this.configs.get(characterId);
    if (!config) {
      console.warn(`⚠️ [KEYCONFIG] Personnage ${characterId} non trouvé`);
      return;
    }

    config.animations[action] = key;
    config.lastModified = Date.now();
    this.configs.set(characterId, config);
    this.saveToStorage();
  }

  /**
   * Réinitialise la configuration d'un personnage aux valeurs par défaut
   */
  public resetConfig(characterId: string, characterName: string, faction: string): void {
    const defaultConfig = this.getDefaultConfig(characterId, characterName, faction);
    this.configs.set(characterId, defaultConfig);
    this.saveToStorage();
    console.log(`✅ [KEYCONFIG] Configuration réinitialisée pour ${characterId}`);
  }

  /**
   * Vérifie si une touche est déjà utilisée par un autre personnage
   * Retourne le personnage qui utilise cette touche, ou null
   */
  public checkKeyConflict(characterId: string, key: string, action: keyof CharacterAnimationAction): string | null {
    for (const [id, config] of this.configs.entries()) {
      if (id === characterId) continue; // Ignorer le personnage actuel
      
      // Vérifier toutes les actions
      for (const [actionKey, actionValue] of Object.entries(config.animations)) {
        if (actionValue === key && actionKey !== action) {
          return config.characterName;
        }
      }
    }
    return null;
  }

  /**
   * Charge les configurations depuis le localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        for (const config of data) {
          this.configs.set(config.characterId, config);
        }
        console.log(`✅ [KEYCONFIG] ${this.configs.size} configurations chargées depuis le stockage`);
      }
    } catch (error) {
      console.warn('⚠️ [KEYCONFIG] Erreur lors du chargement des configurations:', error);
    }
  }

  /**
   * Sauvegarde les configurations dans le localStorage
   */
  private saveToStorage(): void {
    try {
      const data = Array.from(this.configs.values());
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('⚠️ [KEYCONFIG] Erreur lors de la sauvegarde des configurations:', error);
    }
  }

  /**
   * Supprime la configuration d'un personnage
   */
  public deleteConfig(characterId: string): void {
    this.configs.delete(characterId);
    this.saveToStorage();
    console.log(`✅ [KEYCONFIG] Configuration supprimée pour ${characterId}`);
  }

  /**
   * Obtient toutes les configurations
   */
  public getAllConfigs(): CharacterKeyConfig[] {
    return Array.from(this.configs.values());
  }

  /**
   * Exporte la configuration d'un personnage (pour sauvegarde/partage)
   */
  public exportConfig(characterId: string): string | null {
    const config = this.configs.get(characterId);
    if (!config) return null;
    return JSON.stringify(config, null, 2);
  }

  /**
   * Importe une configuration (pour restauration/partage)
   */
  public importConfig(configJson: string): boolean {
    try {
      const config: CharacterKeyConfig = JSON.parse(configJson);
      this.configs.set(config.characterId, config);
      this.saveToStorage();
      console.log(`✅ [KEYCONFIG] Configuration importée pour ${config.characterId}`);
      return true;
    } catch (error) {
      console.warn('⚠️ [KEYCONFIG] Erreur lors de l\'import de la configuration:', error);
      return false;
    }
  }
}

export const characterKeyConfigService = CharacterKeyConfigService.getInstance();

