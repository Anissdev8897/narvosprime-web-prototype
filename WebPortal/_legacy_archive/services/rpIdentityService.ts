import { RPIdentity } from '../types';

export class RPIdentityService {
  private static instance: RPIdentityService;
  private identities: Map<string, RPIdentity> = new Map();

  private constructor() {}

  public static getInstance(): RPIdentityService {
    if (!RPIdentityService.instance) {
      RPIdentityService.instance = new RPIdentityService();
    }
    return RPIdentityService.instance;
  }

  // Créer une identité RP
  public createIdentity(
    playerId: string,
    firstName: string,
    lastName: string,
    age: number,
    backstory: string
  ): { success: boolean; identity: RPIdentity | null; reason?: string } {
    // Validation
    if (!firstName || firstName.trim().length === 0) {
      return { success: false, identity: null, reason: 'Le prénom est requis' };
    }
    if (!lastName || lastName.trim().length === 0) {
      return { success: false, identity: null, reason: 'Le nom est requis' };
    }
    if (age < 18 || age > 150) {
      return { success: false, identity: null, reason: 'L\'âge doit être entre 18 et 150 ans' };
    }
    if (!backstory || backstory.trim().length < 50) {
      return { success: false, identity: null, reason: 'L\'histoire personnelle doit contenir au moins 50 caractères' };
    }

    // Vérifier si une identité existe déjà
    if (this.identities.has(playerId)) {
      return { success: false, identity: null, reason: 'Une identité existe déjà pour ce joueur' };
    }

    const identity: RPIdentity = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      age,
      backstory: backstory.trim(),
      createdAt: Date.now()
    };

    this.identities.set(playerId, identity);

    return { success: true, identity };
  }

  // Obtenir une identité
  public getIdentity(playerId: string): RPIdentity | null {
    return this.identities.get(playerId) || null;
  }

  // Vérifier si un joueur a une identité
  public hasIdentity(playerId: string): boolean {
    return this.identities.has(playerId);
  }

  // Mettre à jour une identité (seulement l'histoire peut être mise à jour)
  public updateBackstory(playerId: string, newBackstory: string): { success: boolean; reason?: string } {
    const identity = this.identities.get(playerId);
    if (!identity) {
      return { success: false, reason: 'Identité non trouvée' };
    }

    if (newBackstory.trim().length < 50) {
      return { success: false, reason: 'L\'histoire personnelle doit contenir au moins 50 caractères' };
    }

    identity.backstory = newBackstory.trim();
    return { success: true };
  }

  // Obtenir les informations publiques (pour les gardiens)
  public getPublicInfo(playerId: string): { firstName: string; lastName: string; age: number; backstory: string } | null {
    const identity = this.identities.get(playerId);
    if (!identity) {
      return null;
    }

    return {
      firstName: identity.firstName,
      lastName: identity.lastName,
      age: identity.age,
      backstory: identity.backstory
    };
  }
}

export const rpIdentityService = RPIdentityService.getInstance();

