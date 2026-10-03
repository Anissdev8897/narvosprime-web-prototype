import * as THREE from 'three';
import { Vector3, Faction } from '../types';

/**
 * Entité détectée par le radar
 */
export interface RadarEntity {
  id: string;
  type: 'PLAYER' | 'MONSTER' | 'NPC' | 'VEHICLE' | 'PROP' | 'RESOURCE' | 'STRUCTURE';
  position: Vector3;
  velocity?: Vector3; // Pour détecter le mouvement
  faction?: Faction;
  isMoving: boolean;
  lastPosition?: Vector3;
}

/**
 * Service de détection radar amélioré
 */
export class RadarService {
  private static instance: RadarService;
  private detectionRange = 5; // 5 mètres
  
  public static getInstance(): RadarService {
    if (!RadarService.instance) {
      RadarService.instance = new RadarService();
    }
    return RadarService.instance;
  }
  
  /**
   * Détecter toutes les entités dans la zone de surveillance
   */
  public detectEntities(
    playerPosition: Vector3,
    sceneObjects: THREE.Object3D[]
  ): RadarEntity[] {
    const entities: RadarEntity[] = [];
    
    sceneObjects.forEach(obj => {
      const distance = this.calculateDistance(playerPosition, obj.position);
      
      if (distance <= this.detectionRange) {
        const entity: RadarEntity = {
          id: obj.uuid,
          type: this.determineEntityType(obj),
          position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
          velocity: this.calculateVelocity(obj),
          faction: obj.userData?.faction,
          isMoving: this.isEntityMoving(obj),
          lastPosition: obj.userData?.lastPosition
        };
        
        entities.push(entity);
        obj.userData.lastPosition = { x: obj.position.x, y: obj.position.y, z: obj.position.z };
      }
    });
    
    return entities;
  }
  
  /**
   * Déterminer si une entité est en mouvement
   */
  private isEntityMoving(obj: THREE.Object3D): boolean {
    if (!obj.userData.lastPosition) return false;
    
    const lastPos = obj.userData.lastPosition;
    const currentPos = obj.position;
    const distance = Math.sqrt(
      Math.pow(currentPos.x - lastPos.x, 2) +
      Math.pow(currentPos.z - lastPos.z, 2)
    );
    
    return distance > 0.1; // Seuil de mouvement : 10cm
  }
  
  /**
   * Calculer la vélocité d'une entité
   */
  private calculateVelocity(obj: THREE.Object3D): Vector3 | undefined {
    if (!obj.userData.lastPosition) return undefined;
    
    const lastPos = obj.userData.lastPosition;
    const currentPos = obj.position;
    
    return {
      x: currentPos.x - lastPos.x,
      y: currentPos.y - lastPos.y,
      z: currentPos.z - lastPos.z
    };
  }
  
  /**
   * Déterminer le type d'entité
   */
  private determineEntityType(obj: THREE.Object3D): RadarEntity['type'] {
    const userDataType = obj.userData?.type;
    
    if (userDataType === 'MONSTER') return 'MONSTER';
    if (userDataType === 'MERCHANT_NPC' || userDataType === 'CIVILIAN' || userDataType === 'BANKER_NPC') return 'NPC';
    if (userDataType === 'VEHICLE') return 'VEHICLE';
    if (userDataType === 'RESOURCE') return 'RESOURCE';
    if (userDataType === 'PROP' || userDataType === 'IMPORTED_MODEL') return 'PROP';
    if (userDataType === 'PORTAL_FRAME' || userDataType === 'STRUCTURE' || userDataType === 'TERRAIN') return 'STRUCTURE';
    
    // Par défaut, considérer comme joueur si c'est un personnage
    if (obj.userData?.type === 'PLAYER' || obj.userData?.canMove) {
      return 'PLAYER';
    }
    
    return 'PROP';
  }
  
  /**
   * Calculer la distance entre deux positions
   */
  private calculateDistance(pos1: Vector3, pos2: THREE.Vector3): number {
    return Math.sqrt(
      Math.pow(pos2.x - pos1.x, 2) +
      Math.pow(pos2.z - pos1.z, 2)
    );
  }
  
  /**
   * Obtenir la portée de détection
   */
  public getDetectionRange(): number {
    return this.detectionRange;
  }
  
  /**
   * Définir la portée de détection
   */
  public setDetectionRange(range: number): void {
    this.detectionRange = Math.max(1, Math.min(50, range)); // Limiter entre 1 et 50 mètres
  }
}

export const radarService = RadarService.getInstance();

