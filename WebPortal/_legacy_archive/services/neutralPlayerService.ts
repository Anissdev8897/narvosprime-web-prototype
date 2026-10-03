/**
 * Service dédié au mouvement et à la caméra du joueur neutre (début du jeu)
 * 
 * Ce service gère uniquement le déplacement et la caméra pour le joueur neutre
 * qui n'a pas d'animations. Il évite les conflits avec le système d'animations
 * des autres personnages (factions).
 */

import * as THREE from 'three';
import { Faction, SceneMode } from '../types';
import { CAMERA_PROFILES } from '../constants';

export interface NeutralPlayerState {
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  rotation: number;
  pitch: number;
  cameraOffset: {
    radius: number;
    theta: number;
    phi: number;
  };
  lastMouseX?: number;
  lastMouseY?: number;
}

export class NeutralPlayerService {
  private static instance: NeutralPlayerService;
  private state: NeutralPlayerState;

  private constructor() {
    this.state = {
      position: { x: 0, y: 2, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      rotation: 0,
      pitch: 0,
      cameraOffset: {
        radius: 15,
        theta: 0,
        phi: Math.PI / 3
      }
    };
  }

  public static getInstance(): NeutralPlayerService {
    if (!NeutralPlayerService.instance) {
      NeutralPlayerService.instance = new NeutralPlayerService();
    }
    return NeutralPlayerService.instance;
  }

  /**
   * Initialise l'état du joueur neutre
   */
  public initialize(position?: { x: number; y: number; z: number }): void {
    if (position) {
      this.state.position = { ...position };
    } else {
      this.state.position = { x: 0, y: 2, z: 0 };
    }
    this.state.velocity = { x: 0, y: 0, z: 0 };
    this.state.rotation = 0;
    this.state.pitch = 0;
    this.state.cameraOffset = {
      radius: 15,
      theta: 0,
      phi: Math.PI / 3
    };
    this.state.lastMouseX = undefined;
    this.state.lastMouseY = undefined;
  }

  /**
   * Met à jour le mouvement du joueur neutre
   * @param keys Set des touches pressées
   * @param keyBindings Configuration des touches
   * @param speed Vitesse de déplacement
   * @param cameraDirection Direction de la caméra (pour le mouvement relatif)
   * @param delta Temps écoulé depuis la dernière frame
   */
  public updateMovement(
    keys: Set<string>,
    keyBindings: { moveForward: string; moveBackward: string; moveLeft: string; moveRight: string; sprint: string; jump: string },
    speed: number,
    cameraDirection: THREE.Vector3,
    delta: number = 0.016
  ): void {
    // Normaliser les touches
    const normalizeKey = (key: string): string => {
      if (key === 'Shift') return 'shift';
      if (key === 'Control') return 'control';
      if (key === 'Alt') return 'alt';
      if (key === ' ') return ' ';
      return key.toLowerCase();
    };

    // Calculer la vitesse (sprint ou normal)
    const currentSpeed = keys.has(normalizeKey(keyBindings.sprint)) ? speed * 1.8 : speed;
    
    // Direction de la caméra (horizontal uniquement)
    const camDir = cameraDirection.clone();
    camDir.y = 0;
    camDir.normalize();
    const camRight = new THREE.Vector3().crossVectors(camDir, new THREE.Vector3(0, 1, 0));

    // Calculer la direction de mouvement
    const moveDir = new THREE.Vector3();
    if (keys.has(normalizeKey(keyBindings.moveForward))) moveDir.add(camDir);
    if (keys.has(normalizeKey(keyBindings.moveBackward))) moveDir.sub(camDir);
    if (keys.has(normalizeKey(keyBindings.moveRight))) moveDir.add(camRight);
    if (keys.has(normalizeKey(keyBindings.moveLeft))) moveDir.sub(camRight);

    // Appliquer le mouvement
    if (moveDir.lengthSq() > 0) {
      moveDir.normalize().multiplyScalar(currentSpeed * delta * 60); // Normaliser pour 60 FPS
      this.state.position.x += moveDir.x;
      this.state.position.z += moveDir.z;
      
      // Rotation du personnage vers la direction de mouvement
      this.state.rotation = Math.atan2(moveDir.x, moveDir.z);
    }

    // Saut (si nécessaire)
    if (keys.has(normalizeKey(keyBindings.jump))) {
      // Le saut sera géré par la physique dans GameEngine
    }
  }

  /**
   * Met à jour la caméra pour le joueur neutre
   * @param mouseX Position X de la souris (ou deltaX si pointer lock)
   * @param mouseY Position Y de la souris (ou deltaY si pointer lock)
   * @param isPointerLocked Si le pointer lock est actif
   * @param sceneMode Mode de scène actuel
   * @param activePlanetId ID de la planète active (null pour HUB)
   */
  public updateCamera(
    mouseX: number,
    mouseY: number,
    isPointerLocked: boolean,
    sceneMode: SceneMode,
    activePlanetId: string | null = null
  ): void {
    const profile = CAMERA_PROFILES[activePlanetId ? activePlanetId.toUpperCase() : 'HUB'] || CAMERA_PROFILES.HUB;
    
    let deltaX = 0;
    let deltaY = 0;

    if (isPointerLocked) {
      // Mode pointer lock: utiliser directement les valeurs
      deltaX = mouseX;
      deltaY = mouseY;
    } else {
      // Mode sans pointer lock: calculer le delta depuis la dernière position
      if (this.state.lastMouseX !== undefined && this.state.lastMouseY !== undefined) {
        deltaX = mouseX - this.state.lastMouseX;
        deltaY = mouseY - this.state.lastMouseY;
      }
      this.state.lastMouseX = mouseX;
      this.state.lastMouseY = mouseY;
    }

    // Mettre à jour les angles de la caméra avec sensibilité augmentée pour réduire la latence
    // Augmenter le facteur de sensibilité pour une réponse plus rapide
    this.state.cameraOffset.theta -= deltaX * 0.007; // Augmenté de 0.005 à 0.007
    
    let newPhi = this.state.cameraOffset.phi + deltaY * 0.007; // Augmenté de 0.005 à 0.007
    // Clamp Polar Angle (Vertical) based on profile
    newPhi = Math.max(profile.minPolarAngle, Math.min(profile.maxPolarAngle, newPhi));
    this.state.cameraOffset.phi = newPhi;
  }

  /**
   * Calcule la position de la caméra pour le joueur neutre
   * @param playerMeshPosition Position du mesh du joueur
   * @param sceneMode Mode de scène actuel
   * @param activePlanetId ID de la planète active
   * @param cameraMode Mode de caméra (FIRST_PERSON ou THIRD_PERSON)
   * @returns Position cible de la caméra
   */
  public calculateCameraPosition(
    playerMeshPosition: THREE.Vector3,
    sceneMode: SceneMode,
    activePlanetId: string | null = null,
    cameraMode: 'FIRST_PERSON' | 'THIRD_PERSON' = 'THIRD_PERSON'
  ): THREE.Vector3 {
    const profile = CAMERA_PROFILES[activePlanetId ? activePlanetId.toUpperCase() : 'HUB'] || CAMERA_PROFILES.HUB;

    if (cameraMode === 'FIRST_PERSON') {
      // Première personne: caméra à la position de la tête
      const headHeight = 1.6; // Hauteur approximative de la tête
      return playerMeshPosition.clone().add(new THREE.Vector3(0, headHeight, 0));
    } else {
      // Troisième personne: caméra orbitale
      const offset = new THREE.Vector3(0, profile.height, profile.distance);
      offset.applyAxisAngle(new THREE.Vector3(1, 0, 0), this.state.cameraOffset.phi - (Math.PI / 2));
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.state.cameraOffset.theta);
      
      return playerMeshPosition.clone().add(offset);
    }
  }

  /**
   * Calcule la direction de regard de la caméra
   * @param playerMeshPosition Position du mesh du joueur
   * @param cameraMode Mode de caméra
   * @returns Point de regard (lookAt)
   */
  public calculateCameraLookAt(
    playerMeshPosition: THREE.Vector3,
    cameraMode: 'FIRST_PERSON' | 'THIRD_PERSON' = 'THIRD_PERSON'
  ): THREE.Vector3 {
    if (cameraMode === 'FIRST_PERSON') {
      // En première personne, regarder dans la direction de la caméra
      const direction = new THREE.Vector3(0, 0, -1);
      direction.applyAxisAngle(new THREE.Vector3(1, 0, 0), this.state.cameraOffset.phi - (Math.PI / 2));
      direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.state.cameraOffset.theta);
      return playerMeshPosition.clone().add(direction.multiplyScalar(10));
    } else {
      // En troisième personne, regarder vers la tête du joueur
      const headHeight = 1.6;
      return playerMeshPosition.clone().add(new THREE.Vector3(0, headHeight, 0));
    }
  }

  /**
   * Réinitialise la position de la souris (utile après un clic)
   */
  public resetMousePosition(mouseX: number, mouseY: number): void {
    this.state.lastMouseX = mouseX;
    this.state.lastMouseY = mouseY;
  }

  /**
   * Obtient l'état actuel du joueur neutre
   */
  public getState(): NeutralPlayerState {
    return { ...this.state };
  }

  /**
   * Obtient la position actuelle
   */
  public getPosition(): { x: number; y: number; z: number } {
    return { ...this.state.position };
  }

  /**
   * Définit la position
   */
  public setPosition(position: { x: number; y: number; z: number }): void {
    this.state.position = { ...position };
  }

  /**
   * Obtient la vélocité actuelle
   */
  public getVelocity(): { x: number; y: number; z: number } {
    return { ...this.state.velocity };
  }

  /**
   * Définit la vélocité
   */
  public setVelocity(velocity: { x: number; y: number; z: number }): void {
    this.state.velocity = { ...velocity };
  }

  /**
   * Obtient la rotation actuelle
   */
  public getRotation(): number {
    return this.state.rotation;
  }

  /**
   * Obtient les offsets de la caméra
   */
  public getCameraOffset(): { radius: number; theta: number; phi: number } {
    return { ...this.state.cameraOffset };
  }

  /**
   * Définit les offsets de la caméra
   */
  public setCameraOffset(offset: { radius: number; theta: number; phi: number }): void {
    this.state.cameraOffset = { ...offset };
  }
}

// Export singleton instance
export const neutralPlayerService = NeutralPlayerService.getInstance();

