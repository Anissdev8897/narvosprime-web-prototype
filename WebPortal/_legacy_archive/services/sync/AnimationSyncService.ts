import { AnimationSync, OnlinePlayer } from '../../types/network';

/**
 * Service de synchronisation des animations des joueurs
 */
export class AnimationSyncService {
  private static instance: AnimationSyncService;
  private activeAnimations: Map<string, AnimationSync> = new Map();

  private constructor() {}

  public static getInstance(): AnimationSyncService {
    if (!AnimationSyncService.instance) {
      AnimationSyncService.instance = new AnimationSyncService();
    }
    return AnimationSyncService.instance;
  }

  // Créer un message de synchronisation d'animation
  public createAnimationSync(
    uid: string,
    animationName: string,
    isPlaying: boolean,
    time: number = 0
  ): AnimationSync {
    const sync: AnimationSync = {
      uid,
      animationName,
      isPlaying,
      time,
      timestamp: Date.now()
    };

    this.activeAnimations.set(uid, sync);
    return sync;
  }

  // Obtenir l'animation active d'un joueur
  public getActiveAnimation(uid: string): AnimationSync | null {
    return this.activeAnimations.get(uid) || null;
  }

  // Arrêter une animation
  public stopAnimation(uid: string): void {
    this.activeAnimations.delete(uid);
  }

  // Appliquer une synchronisation d'animation reçue
  public applyAnimationSync(sync: AnimationSync): void {
    this.activeAnimations.set(sync.uid, sync);
  }

  // Obtenir toutes les animations actives
  public getAllActiveAnimations(): AnimationSync[] {
    return Array.from(this.activeAnimations.values());
  }
}

export const animationSyncService = AnimationSyncService.getInstance();

