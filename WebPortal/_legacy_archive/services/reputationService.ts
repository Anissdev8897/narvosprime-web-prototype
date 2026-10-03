import { Faction } from '../types';

export interface ReputationState {
  [faction: string]: number; // -100 à 100
}

export interface DenunciationResult {
  success: boolean;
  newStatus: 'ENEMY_OF_FACTION' | 'ENEMY_OF_OTHERS' | 'TOTAL_REBEL' | 'NONE';
  message: string;
  reputationChanges: { [faction: string]: number };
}

export class ReputationService {
  private static instance: ReputationService;

  private constructor() {}

  public static getInstance(): ReputationService {
    if (!ReputationService.instance) {
      ReputationService.instance = new ReputationService();
    }
    return ReputationService.instance;
  }

  // Initialiser la réputation pour un joueur
  public initializeReputation(faction: Faction): ReputationState {
    const reputation: ReputationState = {};
    
    // Réputation initiale : 50 avec sa propre faction, 0 avec les autres
    Object.values(Faction).forEach(f => {
      if (f === faction) {
        reputation[f] = 50; // Neutre-positif avec sa faction
      } else if (f === Faction.NEUTRAL || f === Faction.HOSTILE) {
        reputation[f] = 0;
      } else {
        reputation[f] = 0; // Neutre avec les autres factions
      }
    });
    
    return reputation;
  }

  // Dénoncer une trahison
  public denounceTreason(
    playerFaction: Faction,
    targetFaction: Faction,
    evidence: 'WEAK' | 'STRONG' | 'IRREFUTABLE'
  ): DenunciationResult {
    const reputationChanges: { [faction: string]: number } = {};
    let newStatus: DenunciationResult['newStatus'] = 'NONE';
    let message = '';

    // Si le joueur dénonce sa propre faction
    if (targetFaction === playerFaction) {
      // Le joueur devient ennemi de sa propre faction
      reputationChanges[playerFaction] = -100;
      newStatus = 'ENEMY_OF_FACTION';
      message = `Vous avez été déclaré traître par ${playerFaction}. Vous êtes maintenant un ennemi de votre faction.`;
    } 
    // Si le joueur dénonce une autre faction
    else {
      const evidenceMultiplier = evidence === 'WEAK' ? 0.5 : evidence === 'STRONG' ? 1.0 : 1.5;
      
      // Améliorer la réputation avec sa propre faction
      reputationChanges[playerFaction] = 20 * evidenceMultiplier;
      
      // Détériorer la réputation avec la faction dénoncée
      reputationChanges[targetFaction] = -30 * evidenceMultiplier;
      
      // Si la preuve est irréfutable, le joueur peut devenir ennemi des autres factions
      if (evidence === 'IRREFUTABLE') {
        Object.values(Faction).forEach(f => {
          if (f !== playerFaction && f !== targetFaction && f !== Faction.NEUTRAL && f !== Faction.HOSTILE) {
            reputationChanges[f] = -15;
          }
        });
        newStatus = 'ENEMY_OF_OTHERS';
        message = `Votre dénonciation a été acceptée, mais vous êtes maintenant suspect aux yeux des autres factions.`;
      } else {
        message = `Votre dénonciation a été enregistrée. Réputation avec ${targetFaction} diminuée.`;
      }
    }

    return {
      success: true,
      newStatus,
      message,
      reputationChanges
    };
  }

  // Vérifier si le joueur est un rebelle total
  public isTotalRebel(reputation: ReputationState): boolean {
    // Si le joueur a une réputation négative avec toutes les factions principales
    const mainFactions = [Faction.HUMAN, Faction.ALIEN, Faction.MERCENARY];
    return mainFactions.every(f => (reputation[f] || 0) < -50);
  }

  // Obtenir les factions ennemies
  public getEnemyFactions(reputation: ReputationState): Faction[] {
    return Object.entries(reputation)
      .filter(([_, value]) => value < -50)
      .map(([faction, _]) => faction as Faction);
  }

  // Mettre à jour la réputation
  public updateReputation(
    currentReputation: ReputationState,
    changes: { [faction: string]: number }
  ): ReputationState {
    const newReputation = { ...currentReputation };
    
    Object.entries(changes).forEach(([faction, change]) => {
      newReputation[faction] = Math.max(-100, Math.min(100, (newReputation[faction] || 0) + change));
    });
    
    return newReputation;
  }

  // Obtenir le statut du joueur
  public getPlayerStatus(reputation: ReputationState, playerFaction: Faction): {
    status: 'LOYAL' | 'NEUTRAL' | 'SUSPECT' | 'ENEMY' | 'REBEL';
    description: string;
  } {
    const playerRep = reputation[playerFaction] || 0;
    
    if (this.isTotalRebel(reputation)) {
      return {
        status: 'REBEL',
        description: 'Rebelle total - Ennemi de toutes les factions'
      };
    }
    
    if (playerRep < -50) {
      return {
        status: 'ENEMY',
        description: `Ennemi de ${playerFaction}`
      };
    }
    
    if (playerRep < 0) {
      return {
        status: 'SUSPECT',
        description: 'Suspect aux yeux de votre faction'
      };
    }
    
    if (playerRep < 30) {
      return {
        status: 'NEUTRAL',
        description: 'Réputation neutre'
      };
    }
    
    return {
      status: 'LOYAL',
      description: 'Loyal à votre faction'
    };
  }
}

export const reputationService = ReputationService.getInstance();

