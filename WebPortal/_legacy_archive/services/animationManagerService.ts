import * as THREE from 'three';

/**
 * Types d'entités supportées par le système d'animations
 */
export type EntityType =
  | 'VEHICLE'      // Véhicule terrestre
  | 'SPACESHIP'    // Vaisseau spatial
  | 'BOAT'         // Bateau
  | 'MOTORCYCLE'   // Moto
  | 'CHARACTER'    // Personnage joueur
  | 'NPC'          // Personnage non-joueur
  | 'MONSTER'      // Monstre
  | 'BOSS';        // Boss

/**
 * Types d'animations basiques pour les joueurs
 */
export type BasicPlayerAnimation =
  | 'IDLE'
  | 'WALK'
  | 'RUN'
  | 'JUMP'
  | 'SWIM'
  | 'SWIM_IDLE'
  | 'ATTACK'
  | 'DEFEND';

/**
 * Configuration d'animation pour un type d'entité
 */
export interface EntityAnimationConfig {
  entityType: EntityType;
  animationName: string;
  animationType: string; // Type spécifique selon l'entité (ex: 'idle', 'move', 'attack')
  loop: boolean;
  weight: number;
  timeScale: number;
}

/**
 * Animation assignée à un objet
 */
export interface AssignedAnimation {
  objectId: string;
  entityType: EntityType;
  animationName: string;
  animationType: string;
  mixer?: THREE.AnimationMixer;
  action?: THREE.AnimationAction;
  isPlaying: boolean;
}

/**
 * Service centralisé de gestion des animations
 * Permet d'attribuer et de modifier les animations de toutes les entités du jeu
 */
export class AnimationManagerService {
  private static instance: AnimationManagerService;

  // Animations basiques temporaires pour les joueurs (sera remplacé par des fichiers plus tard)
  private basicPlayerAnimations: Map<BasicPlayerAnimation, THREE.AnimationClip> = new Map();

  // Animations par type d'entité
  private entityAnimations: Map<EntityType, Map<string, THREE.AnimationClip>> = new Map();

  // Animations assignées aux objets de la scène
  private assignedAnimations: Map<string, AssignedAnimation> = new Map();

  // Mixers pour chaque objet
  private objectMixers: Map<string, THREE.AnimationMixer> = new Map();

  private constructor() {
    this.initializeBasicPlayerAnimations();
    this.initializeEntityAnimations();
  }

  public static getInstance(): AnimationManagerService {
    if (!AnimationManagerService.instance) {
      AnimationManagerService.instance = new AnimationManagerService();
    }
    return AnimationManagerService.instance;
  }

  /**
   * Initialiser les animations basiques temporaires pour les joueurs
   * Ces animations sont créées programmatiquement (sera remplacé par des fichiers plus tard)
   */
  private initializeBasicPlayerAnimations(): void {
    console.log('🎬 [ANIMATION MANAGER] Initialisation des animations basiques joueur...');

    // Créer des animations basiques temporaires (squelettes)
    // Ces animations seront remplacées par de vraies animations FBX/GLTF plus tard

    const basicAnimations: BasicPlayerAnimation[] = [
      'IDLE',
      'WALK',
      'RUN',
      'JUMP',
      'SWIM',
      'SWIM_IDLE',
      'ATTACK',
      'DEFEND'
    ];

    basicAnimations.forEach(animName => {
      // Créer une animation clip temporaire (sera remplacé par de vraies animations)
      const clip = this.createTemporaryAnimationClip(animName);
      this.basicPlayerAnimations.set(animName, clip);
      console.log(`✅ [ANIMATION MANAGER] Animation basique "${animName}" initialisée`);
    });
  }

  /**
   * Créer une animation clip temporaire (placeholder)
   * Sera remplacé par de vraies animations chargées depuis des fichiers
   */
  private createTemporaryAnimationClip(name: string): THREE.AnimationClip {
    // Créer un clip d'animation temporaire avec une durée de 1 seconde
    // Ceci est un placeholder qui sera remplacé par de vraies animations
    const duration = 1.0;
    const tracks: THREE.KeyframeTrack[] = [];

    // Créer une track de position temporaire (sera remplacé par de vraies tracks)
    const positionTrack = new THREE.VectorKeyframeTrack(
      '.position',
      [0, duration],
      [0, 0, 0, 0, 0, 0]
    );
    tracks.push(positionTrack);

    return new THREE.AnimationClip(name, duration, tracks);
  }

  /**
   * Initialiser les animations par type d'entité
   */
  private initializeEntityAnimations(): void {
    console.log('🎬 [ANIMATION MANAGER] Initialisation des animations par type d\'entité...');

    const entityTypes: EntityType[] = [
      'VEHICLE',
      'SPACESHIP',
      'BOAT',
      'MOTORCYCLE',
      'CHARACTER',
      'NPC',
      'MONSTER',
      'BOSS'
    ];

    entityTypes.forEach(entityType => {
      const animations = new Map<string, THREE.AnimationClip>();

      // Définir les types d'animations selon le type d'entité
      const animationTypes = this.getAnimationTypesForEntity(entityType);

      animationTypes.forEach(animType => {
        const clip = this.createTemporaryAnimationClip(`${entityType}_${animType}`);
        animations.set(animType, clip);
      });

      this.entityAnimations.set(entityType, animations);
      console.log(`✅ [ANIMATION MANAGER] Animations pour "${entityType}" initialisées (${animationTypes.length} types)`);
    });
  }

  /**
   * Obtenir les types d'animations disponibles pour un type d'entité
   */
  private getAnimationTypesForEntity(entityType: EntityType): string[] {
    switch (entityType) {
      case 'VEHICLE':
        return ['idle', 'move', 'turn_left', 'turn_right', 'brake', 'reverse'];
      case 'SPACESHIP':
        return ['idle', 'thrust', 'turn_left', 'turn_right', 'boost', 'land'];
      case 'BOAT':
        return ['idle', 'move', 'turn_left', 'turn_right', 'anchor'];
      case 'MOTORCYCLE':
        return ['idle', 'move', 'turn_left', 'turn_right', 'wheelie', 'brake'];
      case 'CHARACTER':
        return ['idle', 'walk', 'run', 'jump', 'swim', 'attack', 'defend'];
      case 'NPC':
        return ['idle', 'walk', 'talk', 'work', 'sleep'];
      case 'MONSTER':
        return ['idle', 'patrol', 'chase', 'attack', 'hurt', 'death'];
      case 'BOSS':
        return ['idle', 'attack1', 'attack2', 'attack3', 'special', 'hurt', 'death', 'phase2'];
      default:
        return ['idle'];
    }
  }

  /**
   * Obtenir les animations basiques disponibles pour les joueurs
   */
  public getBasicPlayerAnimations(): BasicPlayerAnimation[] {
    return Array.from(this.basicPlayerAnimations.keys());
  }

  /**
   * Obtenir les types d'animations disponibles pour un type d'entité
   */
  public getAnimationTypesForEntityType(entityType: EntityType): string[] {
    const animations = this.entityAnimations.get(entityType);
    return animations ? Array.from(animations.keys()) : [];
  }

  /**
   * Attribuer une animation basique à un objet joueur
   */
  public assignBasicPlayerAnimation(
    object: THREE.Object3D,
    animationName: BasicPlayerAnimation
  ): boolean {
    const clip = this.basicPlayerAnimations.get(animationName);
    if (!clip) {
      console.error(`❌ [ANIMATION MANAGER] Animation basique "${animationName}" non trouvée`);
      return false;
    }

    return this.applyAnimationToObject(object, 'CHARACTER', animationName, clip);
  }

  /**
   * Attribuer une animation à un objet selon son type d'entité
   */
  public assignEntityAnimation(
    object: THREE.Object3D,
    entityType: EntityType,
    animationType: string
  ): boolean {
    const animations = this.entityAnimations.get(entityType);
    if (!animations) {
      console.error(`❌ [ANIMATION MANAGER] Type d'entité "${entityType}" non trouvé`);
      return false;
    }

    const clip = animations.get(animationType);
    if (!clip) {
      console.error(`❌ [ANIMATION MANAGER] Animation "${animationType}" non trouvée pour "${entityType}"`);
      return false;
    }

    return this.applyAnimationToObject(object, entityType, animationType, clip);
  }

  /**
   * Jouer une animation personnalisée (ex: importée via GLTF)
   */
  public playCustomAnimation(
    object: THREE.Object3D,
    clip: THREE.AnimationClip
  ): boolean {
    // On utilise 'NPC' comme type par défaut pour les animations custom
    return this.applyAnimationToObject(object, 'NPC', clip.name, clip);
  }

  /**
   * Appliquer une animation à un objet
   */
  private applyAnimationToObject(
    object: THREE.Object3D,
    entityType: EntityType,
    animationName: string,
    clip: THREE.AnimationClip
  ): boolean {
    try {
      const objectId = object.uuid;

      // Créer ou récupérer le mixer pour cet objet
      let mixer = this.objectMixers.get(objectId);
      if (!mixer) {
        mixer = new THREE.AnimationMixer(object);
        this.objectMixers.set(objectId, mixer);
      }

      // Arrêter l'animation précédente si elle existe
      const existing = this.assignedAnimations.get(objectId);
      if (existing && existing.action) {
        existing.action.stop();
      }

      // Créer une nouvelle action
      const action = mixer.clipAction(clip);
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.play();

      // Enregistrer l'animation assignée
      const assigned: AssignedAnimation = {
        objectId,
        entityType,
        animationName,
        animationType: animationName.toLowerCase(),
        mixer,
        action,
        isPlaying: true
      };

      this.assignedAnimations.set(objectId, assigned);

      // Stocker le mixer dans userData pour la mise à jour
      object.userData.animationMixer = mixer;
      object.userData.animationManager = this;

      console.log(`✅ [ANIMATION MANAGER] Animation "${animationName}" assignée à l'objet "${object.name || objectId}" (${entityType})`);
      return true;
    } catch (error) {
      console.error(`❌ [ANIMATION MANAGER] Erreur lors de l'application de l'animation:`, error);
      return false;
    }
  }

  /**
   * Arrêter l'animation d'un objet
   */
  public stopAnimation(objectId: string): void {
    const assigned = this.assignedAnimations.get(objectId);
    if (assigned && assigned.action) {
      assigned.action.stop();
      assigned.isPlaying = false;
      console.log(`⏹️ [ANIMATION MANAGER] Animation arrêtée pour l'objet "${objectId}"`);
    }
  }

  /**
   * Obtenir l'animation assignée à un objet
   */
  public getAssignedAnimation(objectId: string): AssignedAnimation | null {
    return this.assignedAnimations.get(objectId) || null;
  }

  /**
   * Mettre à jour tous les mixers (à appeler dans la boucle de rendu)
   */
  public update(delta: number): void {
    this.objectMixers.forEach((mixer, objectId) => {
      const assigned = this.assignedAnimations.get(objectId);
      if (assigned && assigned.isPlaying) {
        mixer.update(delta);
      }
    });
  }

  /**
   * Détecter le type d'entité d'un objet depuis son userData
   */
  public detectEntityType(object: THREE.Object3D): EntityType | null {
    // Vérifier userData.type en premier
    const userDataType = object.userData.type;
    if (userDataType) {
      const upperType = userDataType.toUpperCase();
      if (['VEHICLE', 'SPACESHIP', 'BOAT', 'MOTORCYCLE', 'CHARACTER', 'NPC', 'MONSTER', 'BOSS'].includes(upperType)) {
        return upperType as EntityType;
      }
    }

    // Vérifier userData.entityType
    if (object.userData.entityType) {
      return object.userData.entityType as EntityType;
    }

    // Détection par nom (fallback)
    const name = (object.name || '').toLowerCase();
    if (name.includes('vehicle') || name.includes('vehicule')) return 'VEHICLE';
    if (name.includes('spaceship') || name.includes('vaisseau')) return 'SPACESHIP';
    if (name.includes('boat') || name.includes('bateau')) return 'BOAT';
    if (name.includes('motorcycle') || name.includes('moto')) return 'MOTORCYCLE';
    if (name.includes('character') || name.includes('personnage')) return 'CHARACTER';
    if (name.includes('npc') || name.includes('pnj')) return 'NPC';
    if (name.includes('monster') || name.includes('monstre')) return 'MONSTER';
    if (name.includes('boss')) return 'BOSS';

    return null;
  }

  /**
   * Nettoyer les ressources d'un objet
   */
  public cleanup(objectId: string): void {
    const assigned = this.assignedAnimations.get(objectId);
    if (assigned && assigned.action) {
      assigned.action.stop();
    }
    this.assignedAnimations.delete(objectId);
    this.objectMixers.delete(objectId);
  }
}

export const animationManagerService = AnimationManagerService.getInstance();

