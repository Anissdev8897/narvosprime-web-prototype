import { Vector3 } from '../types';

/**
 * Service de gestion du Fog of War (brouillard de guerre)
 */
export class FogOfWarService {
  private static instance: FogOfWarService;
  private discoveryRadius = 50;
  private discoveredPixels: Set<string> = new Set(); // Format: "x,y"
  
  public static getInstance(): FogOfWarService {
    if (!FogOfWarService.instance) {
      FogOfWarService.instance = new FogOfWarService();
    }
    return FogOfWarService.instance;
  }
  
  /**
   * Découvrir une zone autour d'une position
   */
  public discoverArea(position: Vector3, mapBounds: { min: Vector3; max: Vector3 }): void {
    const centerX = Math.floor(position.x);
    const centerZ = Math.floor(position.z);
    
    // Découvrir tous les pixels dans le rayon
    for (let x = centerX - this.discoveryRadius; x <= centerX + this.discoveryRadius; x++) {
      for (let z = centerZ - this.discoveryRadius; z <= centerZ + this.discoveryRadius; z++) {
        const distance = Math.sqrt(
          Math.pow(x - centerX, 2) +
          Math.pow(z - centerZ, 2)
        );
        
        if (distance <= this.discoveryRadius) {
          // Vérifier que le pixel est dans les bounds de la map
          if (x >= mapBounds.min.x && x <= mapBounds.max.x &&
              z >= mapBounds.min.z && z <= mapBounds.max.z) {
            this.discoveredPixels.add(`${x},${z}`);
          }
        }
      }
    }
  }
  
  /**
   * Vérifier si une position est découverte
   */
  public isDiscovered(x: number, z: number): boolean {
    const key = `${Math.floor(x)},${Math.floor(z)}`;
    return this.discoveredPixels.has(key);
  }
  
  /**
   * Obtenir le pourcentage de découverte
   */
  public getDiscoveryPercentage(mapBounds: { min: Vector3; max: Vector3 }): number {
    const totalArea = (mapBounds.max.x - mapBounds.min.x) * (mapBounds.max.z - mapBounds.min.z);
    const discoveredArea = this.discoveredPixels.size;
    return totalArea > 0 ? (discoveredArea / totalArea) * 100 : 0;
  }
  
  /**
   * Sauvegarder les pixels découverts
   */
  public saveDiscoveredPixels(planetId: string | null): void {
    const key = `narvos_fogofwar_${planetId || 'hub'}`;
    localStorage.setItem(key, JSON.stringify(Array.from(this.discoveredPixels)));
  }
  
  /**
   * Charger les pixels découverts
   */
  public loadDiscoveredPixels(planetId: string | null): void {
    const key = `narvos_fogofwar_${planetId || 'hub'}`;
    const data = localStorage.getItem(key);
    if (data) {
      this.discoveredPixels = new Set(JSON.parse(data));
    } else {
      this.discoveredPixels = new Set();
    }
  }
  
  /**
   * Réinitialiser le fog of war
   */
  public reset(planetId: string | null): void {
    this.discoveredPixels.clear();
    this.saveDiscoveredPixels(planetId);
  }
  
  /**
   * Obtenir tous les pixels découverts
   */
  public getDiscoveredPixels(): Set<string> {
    return this.discoveredPixels;
  }
}

export const fogOfWarService = FogOfWarService.getInstance();

