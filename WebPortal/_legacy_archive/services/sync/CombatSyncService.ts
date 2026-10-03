import { CombatSync, OnlinePlayer } from '../../types/network';
import { Vector3 } from '../../types';

/**
 * Service de synchronisation des combats PvP
 * Valide les attaques pour éviter la triche
 */
export class CombatSyncService {
  private static instance: CombatSyncService;
  private lastAttackTime: Map<string, number> = new Map();
  private attackHistory: Map<string, CombatSync[]> = new Map();

  private constructor() {}

  public static getInstance(): CombatSyncService {
    if (!CombatSyncService.instance) {
      CombatSyncService.instance = new CombatSyncService();
    }
    return CombatSyncService.instance;
  }

  // Créer un message de synchronisation de combat
  public createCombatSync(
    uid: string,
    targetUid: string,
    damage: number,
    attackType: string
  ): CombatSync {
    const sync: CombatSync = {
      uid,
      targetUid,
      damage,
      attackType,
      timestamp: Date.now()
    };

    // Enregistrer dans l'historique
    if (!this.attackHistory.has(uid)) {
      this.attackHistory.set(uid, []);
    }
    this.attackHistory.get(uid)!.push(sync);

    // Limiter l'historique à 100 attaques
    const history = this.attackHistory.get(uid)!;
    if (history.length > 100) {
      history.shift();
    }

    this.lastAttackTime.set(uid, Date.now());
    return sync;
  }

  // Valider une attaque (anti-triche)
  public validateAttack(
    attackerUid: string,
    targetUid: string,
    damage: number,
    attackerPosition: Vector3,
    targetPosition: Vector3,
    maxRange: number,
    minAttackCooldown: number
  ): { valid: boolean; reason?: string; correctedDamage?: number } {
    // Vérifier la distance
    const distance = Math.sqrt(
      Math.pow(targetPosition.x - attackerPosition.x, 2) +
      Math.pow(targetPosition.y - attackerPosition.y, 2) +
      Math.pow(targetPosition.z - attackerPosition.z, 2)
    );

    if (distance > maxRange) {
      return {
        valid: false,
        reason: `Attaque hors de portée (${distance.toFixed(2)}m > ${maxRange}m)`
      };
    }

    // Vérifier le cooldown
    const lastAttack = this.lastAttackTime.get(attackerUid) || 0;
    const timeSinceLastAttack = Date.now() - lastAttack;

    if (timeSinceLastAttack < minAttackCooldown) {
      return {
        valid: false,
        reason: `Attaque trop rapide (${timeSinceLastAttack}ms < ${minAttackCooldown}ms)`
      };
    }

    // Vérifier les dégâts (limite raisonnable)
    const maxDamage = 10000; // À ajuster selon le jeu
    if (damage > maxDamage) {
      return {
        valid: false,
        reason: `Dégâts anormalement élevés (${damage} > ${maxDamage})`,
        correctedDamage: maxDamage
      };
    }

    if (damage < 0) {
      return {
        valid: false,
        reason: 'Dégâts négatifs',
        correctedDamage: 0
      };
    }

    return { valid: true };
  }

  // Obtenir l'historique d'attaques d'un joueur
  public getAttackHistory(uid: string, limit: number = 10): CombatSync[] {
    const history = this.attackHistory.get(uid) || [];
    return history.slice(-limit);
  }

  // Vérifier si un joueur spam des attaques
  public isSpamming(uid: string, threshold: number = 10): boolean {
    const history = this.attackHistory.get(uid) || [];
    if (history.length < threshold) {
      return false;
    }

    const recentAttacks = history.slice(-threshold);
    const timeSpan = recentAttacks[recentAttacks.length - 1].timestamp - recentAttacks[0].timestamp;
    const attacksPerSecond = (threshold / timeSpan) * 1000;

    return attacksPerSecond > 5; // Plus de 5 attaques par seconde = spam
  }
}

export const combatSyncService = CombatSyncService.getInstance();

