import { PlayerStatus, ZoneType, Faction, InventoryItem, PlayerKill, RPIdentity } from '../types';

export interface PermadeathConfig {
  maxUnjustifiedKills: number;
  assassinStatusThreshold: number;
  xpTransferPercent: number;
  safeZones: string[];
  warZones: string[];
  contestedZones: string[];
  dangerousZones: string[];
}

export class PermadeathService {
  private static instance: PermadeathService;
  private playerKills: Map<string, PlayerKill[]> = new Map();
  private playerStatuses: Map<string, PlayerStatus> = new Map();
  private wantedPlayers: Set<string> = new Set();
  private config: PermadeathConfig;

  private constructor() {
    this.config = {
      maxUnjustifiedKills: 3,
      assassinStatusThreshold: 3,
      xpTransferPercent: 0.1, // 10% de l'XP du joueur tué
      safeZones: ['hub', 'city_center'],
      warZones: ['war_zone_1', 'war_zone_2'],
      contestedZones: ['contested_zone_1', 'contested_zone_2'],
      dangerousZones: ['wild_zone', 'boss_area']
    };
  }

  public static getInstance(): PermadeathService {
    if (!PermadeathService.instance) {
      PermadeathService.instance = new PermadeathService();
    }
    return PermadeathService.instance;
  }

  // Déterminer le type de zone
  public getZoneType(zoneId: string): ZoneType {
    if (this.config.safeZones.includes(zoneId)) {
      return ZoneType.SAFE;
    }
    if (this.config.warZones.includes(zoneId) || this.config.contestedZones.includes(zoneId)) {
      return ZoneType.WAR;
    }
    if (this.config.dangerousZones.includes(zoneId)) {
      return ZoneType.DANGEROUS;
    }
    return ZoneType.SAFE; // Par défaut, zone sûre
  }

  // Vérifier si un kill est justifié
  public isKillJustified(
    killerId: string,
    victimId: string,
    zoneType: ZoneType,
    killerFaction: Faction,
    victimFaction: Faction,
    factionsAtWar: Faction[][]
  ): boolean {
    // En zone de guerre, tout kill est justifié
    if (zoneType === ZoneType.WAR) {
      return true;
    }

    // En zone dangereuse, kill entre factions ennemies = justifié
    if (zoneType === ZoneType.DANGEROUS) {
      const areEnemies = factionsAtWar.some(
        ([f1, f2]) => 
          (f1 === killerFaction && f2 === victimFaction) ||
          (f1 === victimFaction && f2 === killerFaction)
      );
      return areEnemies;
    }

    // En zone sûre, aucun kill n'est justifié
    return false;
  }

  // Enregistrer un kill de joueur
  public registerPlayerKill(
    killerId: string,
    victimId: string,
    zoneType: ZoneType,
    killerFaction: Faction,
    victimFaction: Faction,
    factionsAtWar: Faction[][],
    victimXP: number,
    victimInventory: InventoryItem[]
  ): {
    justified: boolean;
    xpGained: number;
    lootDropped: InventoryItem[];
    newStatus: PlayerStatus | null;
    isPermadeath: boolean;
  } {
    const justified = this.isKillJustified(
      killerId,
      victimId,
      zoneType,
      killerFaction,
      victimFaction,
      factionsAtWar
    );

    const kill: PlayerKill = {
      killerId,
      victimId,
      timestamp: Date.now(),
      zoneType,
      justified,
      lootDropped: justified ? victimInventory : [] // Pas de loot si kill injustifié
    };

    // Enregistrer le kill
    if (!this.playerKills.has(killerId)) {
      this.playerKills.set(killerId, []);
    }
    this.playerKills.get(killerId)!.push(kill);

    // Calculer l'XP gagnée
    const xpGained = justified ? Math.floor(victimXP * this.config.xpTransferPercent) : 0;

    // Mettre à jour le statut si kill injustifié
    let newStatus: PlayerStatus | null = null;
    if (!justified) {
      const unjustifiedKills = this.playerKills.get(killerId)?.filter(k => !k.justified).length || 0;
      
      if (unjustifiedKills >= this.config.assassinStatusThreshold) {
        this.playerStatuses.set(killerId, PlayerStatus.ASSASSIN);
        this.wantedPlayers.add(killerId);
        newStatus = PlayerStatus.ASSASSIN;
      }
    }

    // Mort définitive uniquement en zone de guerre ou dangereuse
    const isPermadeath = zoneType === ZoneType.WAR || zoneType === ZoneType.DANGEROUS;

    return {
      justified,
      xpGained,
      lootDropped: kill.lootDropped,
      newStatus,
      isPermadeath
    };
  }

  // Obtenir le statut d'un joueur
  public getPlayerStatus(playerId: string): PlayerStatus {
    return this.playerStatuses.get(playerId) || PlayerStatus.CITIZEN;
  }

  // Vérifier si un joueur est recherché
  public isWanted(playerId: string): boolean {
    return this.wantedPlayers.has(playerId);
  }

  // Obtenir le nombre de kills injustifiés
  public getUnjustifiedKillsCount(playerId: string): number {
    return this.playerKills.get(playerId)?.filter(k => !k.justified).length || 0;
  }

  // Réinitialiser le statut (après capture ou paiement d'amende)
  public resetStatus(playerId: string): void {
    this.playerStatuses.delete(playerId);
    this.wantedPlayers.delete(playerId);
  }

  // Marquer comme traître
  public markAsTraitor(playerId: string): void {
    this.playerStatuses.set(playerId, PlayerStatus.TRAITOR);
    this.wantedPlayers.add(playerId);
  }

  // Obtenir l'historique des kills
  public getKillHistory(playerId: string): PlayerKill[] {
    return this.playerKills.get(playerId) || [];
  }
}

export const permadeathService = PermadeathService.getInstance();

