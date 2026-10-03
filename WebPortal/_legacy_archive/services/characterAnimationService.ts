import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { CharacterModel } from '../components/CharacterSelection';

/**
 * Service de gestion des animations de personnage
 */
export class CharacterAnimationService {
  private static instance: CharacterAnimationService;
  private animationClips: Map<string, THREE.AnimationClip> = new Map();
  private animationMixers: Map<string, THREE.AnimationMixer> = new Map();
  private currentActions: Map<string, THREE.AnimationAction> = new Map();
  private fbxLoader: FBXLoader;

  private constructor() {
    this.fbxLoader = new FBXLoader();
  }

  public static getInstance(): CharacterAnimationService {
    if (!CharacterAnimationService.instance) {
      CharacterAnimationService.instance = new CharacterAnimationService();
    }
    return CharacterAnimationService.instance;
  }

  /**
   * Charger les animations d'un personnage
   * Retourne null si le modèle n'a pas d'animations
   */
  public async loadCharacterAnimations(
    characterModel: CharacterModel,
    mesh: THREE.Object3D
  ): Promise<THREE.AnimationMixer | null> {
    const mixerId = `character_${characterModel.id}`;
    
    // Vérifier si le modèle a des animations définies
    if (!characterModel.animations || 
        (!characterModel.animations.idle && !characterModel.animations.walk && !characterModel.animations.run)) {
      console.log(`ℹ️ Modèle ${characterModel.id} n'a pas d'animations définies (modèle statique pour choix de faction)`);
      return null;
    }
    
    // Créer le mixer si nécessaire
    if (!this.animationMixers.has(mixerId)) {
      const mixer = new THREE.AnimationMixer(mesh);
      this.animationMixers.set(mixerId, mixer);
    }

    const mixer = this.animationMixers.get(mixerId)!;

    // Charger TOUTES les animations disponibles (intégration complète)
    const animationsToLoad: Array<{ key: string; path: string }> = [];
    
    // Animations de base (toujours chargées si disponibles)
    if (characterModel.animations.idle) {
      animationsToLoad.push({ key: 'idle', path: characterModel.animations.idle });
    }
    if (characterModel.animations.walk) {
      animationsToLoad.push({ key: 'walk', path: characterModel.animations.walk });
    }
    if (characterModel.animations.run) {
      animationsToLoad.push({ key: 'run', path: characterModel.animations.run });
    }
    if (characterModel.animations.jump) {
      animationsToLoad.push({ key: 'jump', path: characterModel.animations.jump });
    }

    // Animations de nage
    if (characterModel.animations.swim) {
      animationsToLoad.push({ key: 'swim', path: characterModel.animations.swim });
    }
    if (characterModel.animations.swimIdle) {
      animationsToLoad.push({ key: 'swimIdle', path: characterModel.animations.swimIdle });
    }
    if (characterModel.animations.swimForward) {
      animationsToLoad.push({ key: 'swimForward', path: characterModel.animations.swimForward });
    }

    // Animations sociales/émotes
    if (characterModel.animations.dance) {
      animationsToLoad.push({ key: 'dance', path: characterModel.animations.dance });
    }
    if (characterModel.animations.sit) {
      animationsToLoad.push({ key: 'sit', path: characterModel.animations.sit });
    }
    if (characterModel.animations.lieDown) {
      animationsToLoad.push({ key: 'lieDown', path: characterModel.animations.lieDown });
    }
    if (characterModel.animations.drink) {
      animationsToLoad.push({ key: 'drink', path: characterModel.animations.drink });
    }

    // Animations contextuelles
    if (characterModel.animations.collect) {
      animationsToLoad.push({ key: 'collect', path: characterModel.animations.collect });
    }
    if (characterModel.animations.crouch) {
      animationsToLoad.push({ key: 'crouch', path: characterModel.animations.crouch });
    }

    // Charger toutes les autres animations personnalisées
    for (const [key, path] of Object.entries(characterModel.animations)) {
      if (typeof path === 'string' && !animationsToLoad.find(a => a.key === key)) {
        animationsToLoad.push({ key, path });
      }
    }

    console.log(`✅ [ANIMATIONS] ${animationsToLoad.length} animations chargées pour ${characterModel.id}:`, 
      animationsToLoad.map(a => a.key).join(', '));

    for (const anim of animationsToLoad) {
      const clipKey = `${mixerId}_${anim.key}`;
      
      if (!this.animationClips.has(clipKey)) {
        try {
          const fbx = await new Promise<THREE.Group>((resolve, reject) => {
            this.fbxLoader.load(anim.path, resolve, undefined, reject);
          });

          if (fbx.animations && fbx.animations.length > 0) {
            const clip = fbx.animations[0];
            clip.name = anim.key;
            this.animationClips.set(clipKey, clip);
          }
        } catch (error) {
          console.warn(`Erreur lors du chargement de l'animation ${anim.key} pour ${characterModel.id}:`, error);
        }
      }
    }

    return mixer;
  }

  /**
   * Jouer une animation avec FPS constant et bouclage propre
   */
  public playAnimation(
    characterId: string,
    animationName: string,
    loop: boolean = true,
    fadeIn: number = 0.3
  ): void {
    const mixerId = `character_${characterId}`;
    const mixer = this.animationMixers.get(mixerId);
    if (!mixer) {
      console.warn(`Mixer non trouvé pour ${characterId}`);
      return;
    }

    const clipKey = `${mixerId}_${animationName}`;
    let clip = this.animationClips.get(clipKey);
    
    // Si l'animation demandée n'existe pas, utiliser un fallback
    if (!clip) {
      console.warn(`Animation ${animationName} non trouvée pour ${characterId}, recherche d'un fallback...`);
      
      // Fallback : si idle n'existe pas, utiliser walk
      if (animationName === 'idle') {
        const walkClipKey = `${mixerId}_walk`;
        clip = this.animationClips.get(walkClipKey);
        if (clip) {
          console.log(`Utilisation de l'animation 'walk' comme fallback pour 'idle'`);
        }
      }
      
      // Si toujours pas trouvé, utiliser la première animation disponible
      if (!clip) {
        for (const [key, animClip] of this.animationClips.entries()) {
          if (key.startsWith(mixerId)) {
            clip = animClip;
            console.log(`Utilisation de l'animation ${key} comme fallback`);
            break;
          }
        }
      }
      
      if (!clip) {
        console.error(`Aucune animation disponible pour ${characterId}`);
        return;
      }
    }

    // Arrêter l'animation actuelle avec fade out propre
    const currentAction = this.currentActions.get(mixerId);
    if (currentAction && currentAction.isRunning()) {
      // S'assurer que l'animation revient à sa position de base avant de s'arrêter
      if (!loop && currentAction.loop === THREE.LoopOnce) {
        // Attendre que l'animation se termine naturellement
        currentAction.clampWhenFinished = true;
      } else {
        currentAction.fadeOut(fadeIn);
      }
    }

    // Jouer la nouvelle animation
    const action = mixer.clipAction(clip);
    
    // Réinitialiser à la position de base pour éviter les sauts
    action.reset();
    
    // Configurer le bouclage
    if (loop) {
      action.setLoop(THREE.LoopRepeat, Infinity);
      // S'assurer que l'animation boucle proprement (même position de début et fin)
      action.clampWhenFinished = false;
    } else {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true; // Rester sur la dernière frame
    }
    
    // FPS constant : utiliser timeScale pour garantir une vitesse constante
    action.timeScale = 1.0; // Vitesse normale (peut être ajustée si nécessaire)
    
    // Fade in pour transition fluide
    action.fadeIn(fadeIn);
    action.play();

    this.currentActions.set(mixerId, action);
  }

  /**
   * Arrêter toutes les animations
   */
  public stopAllAnimations(characterId: string): void {
    const mixerId = `character_${characterId}`;
    const mixer = this.animationMixers.get(mixerId);
    if (!mixer) return;

    const currentAction = this.currentActions.get(mixerId);
    if (currentAction) {
      currentAction.fadeOut(0.3);
      setTimeout(() => {
        currentAction.stop();
      }, 300);
    }
  }

  /**
   * Gérer les animations selon l'état du joueur (mouvement, sprint, saut)
   */
  public updatePlayerAnimation(
    characterId: string,
    isMoving: boolean,
    isRunning: boolean,
    isJumping: boolean,
    isSwimming: boolean = false,
    isUnderwater: boolean = false
  ): void {
    if (isSwimming || isUnderwater) {
      // Animations de nage
      if (isMoving) {
        this.playAnimation(characterId, 'swimForward', true, 0.2);
      } else {
        this.playAnimation(characterId, 'swimIdle', true, 0.2);
      }
      return;
    }

    if (isJumping) {
      // Animation de saut (une seule fois, pas en boucle)
      // Vérifier si l'animation existe avant de la jouer
      const mixerId = `character_${characterId}`;
      const clipKey = `${mixerId}_jump`;
      if (this.animationClips.has(clipKey)) {
        this.playAnimation(characterId, 'jump', false, 0.2);
      } else {
        // Si pas d'animation de saut, utiliser l'animation de course ou marche
        if (isRunning) {
          this.playAnimation(characterId, 'run', true, 0.2);
        } else if (isMoving) {
          this.playAnimation(characterId, 'walk', true, 0.2);
        }
      }
      return;
    }

    if (isMoving) {
      if (isRunning) {
        this.playAnimation(characterId, 'run', true, 0.2);
      } else {
        this.playAnimation(characterId, 'walk', true, 0.2);
      }
    } else {
      this.playAnimation(characterId, 'idle', true, 0.2);
    }
  }

  /**
   * Vérifier si une animation est en cours
   */
  public isAnimationPlaying(characterId: string, animationName: string): boolean {
    const mixerId = `character_${characterId}`;
    const currentAction = this.currentActions.get(mixerId);
    if (!currentAction) return false;
    
    const clipKey = `${mixerId}_${animationName}`;
    const clip = this.animationClips.get(clipKey);
    if (!clip) return false;
    
    return currentAction.getClip() === clip && currentAction.isRunning();
  }

  /**
   * Mettre à jour les mixers (à appeler dans la boucle de jeu)
   * Garantit un FPS constant pour toutes les animations
   */
  public update(delta: number): void {
    // Limiter le delta pour éviter les sauts lors de lag
    const maxDelta = 0.033; // Maximum 33ms entre les frames (30 FPS minimum) - réduit pour plus de fluidité
    const clampedDelta = Math.min(delta, maxDelta);
    
    // Optimisation : mettre à jour tous les mixers en une seule passe
    // Éviter les vérifications inutiles pour améliorer les performances
    this.animationMixers.forEach((mixer, mixerId) => {
      // Mettre à jour le mixer avec delta limité
      mixer.update(clampedDelta);
      
      // Vérifier que les animations en boucle se répètent proprement (uniquement si nécessaire)
      const currentAction = this.currentActions.get(mixerId);
      if (currentAction?.isRunning() && currentAction.loop === THREE.LoopRepeat) {
        const clip = currentAction.getClip();
        // Vérifier seulement si l'animation a dépassé sa durée (éviter les vérifications inutiles)
        if (clip && currentAction.time >= clip.duration) {
          // Réinitialiser proprement si nécessaire
          currentAction.time = currentAction.time % clip.duration;
        }
      }
    });
  }

  /**
   * Obtenir le mixer d'un personnage
   */
  public getMixer(characterId: string): THREE.AnimationMixer | null {
    const mixerId = `character_${characterId}`;
    return this.animationMixers.get(mixerId) || null;
  }
}

export const characterAnimationService = CharacterAnimationService.getInstance();

