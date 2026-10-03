import * as THREE from 'three';

export interface WorldScale {
  targetSize: number; // Taille cible pour un personnage standard (en unités du monde)
  scaleFactor: number; // Facteur d'échelle à appliquer
}

export interface ModelCategory {
  type: 'CHARACTER' | 'MONSTER' | 'VEHICLE' | 'WEAPON' | 'PROP' | 'BUILDING' | 'NPC' | 'OTHER';
  baseSize: number; // Taille de base attendue pour cette catégorie (en mètres réels)
}

// Tailles de base par catégorie (en mètres réels)
const CATEGORY_BASE_SIZES: Record<ModelCategory['type'], number> = {
  CHARACTER: 1.8, // Personnage humain moyen : 1.8m
  MONSTER: 3.0, // Monstre moyen : 3m
  VEHICLE: 5.0, // Véhicule moyen : 5m
  WEAPON: 0.3, // Arme moyenne : 30cm
  PROP: 1.0, // Objet moyen : 1m
  BUILDING: 10.0, // Bâtiment moyen : 10m
  NPC: 1.8, // PNJ : même taille qu'un personnage
  OTHER: 1.0 // Par défaut : 1m
};

// Tailles cibles dans le monde du jeu (en unités)
const TARGET_SIZES: Record<ModelCategory['type'], number> = {
  CHARACTER: 2.5, // Personnage = 2.5 unités dans le monde (taille normale)
  MONSTER: 4.0, // Monstre = 4 unités
  VEHICLE: 6.0, // Véhicule = 6 unités
  WEAPON: 0.5, // Arme = 0.5 unités
  PROP: 1.5, // Objet = 1.5 unités
  BUILDING: 15.0, // Bâtiment = 15 unités
  NPC: 2.5, // PNJ = 2.5 unités (même taille que le joueur)
  OTHER: 2.0 // Par défaut = 2 unités
};

export class ScalingService {
  private static instance: ScalingService;
  private worldBounds: { min: THREE.Vector3; max: THREE.Vector3; size: THREE.Vector3; recommendedMaxSize: number } | null = null;

  private constructor() {}

  public static getInstance(): ScalingService {
    if (!ScalingService.instance) {
      ScalingService.instance = new ScalingService();
    }
    return ScalingService.instance;
  }

  // Mettre à jour les dimensions du monde
  public setWorldBounds(bounds: { min: THREE.Vector3; max: THREE.Vector3; size: THREE.Vector3; recommendedMaxSize: number }): void {
    this.worldBounds = bounds;
  }

  // Obtenir les dimensions du monde
  public getWorldBounds(): { min: THREE.Vector3; max: THREE.Vector3; size: THREE.Vector3; recommendedMaxSize: number } | null {
    return this.worldBounds;
  }

  // Calculer la bounding box d'un objet
  private getBoundingBox(object: THREE.Object3D): THREE.Box3 {
    const box = new THREE.Box3();
    box.setFromObject(object);
    return box;
  }

  // Obtenir la taille maximale d'un objet (diagonale de la bounding box)
  private getMaxDimension(box: THREE.Box3): number {
    const size = box.getSize(new THREE.Vector3());
    return Math.max(size.x, size.y, size.z);
  }

  // Calculer l'échelle pour un modèle selon sa catégorie
  public calculateScale(
    object: THREE.Object3D,
    category: ModelCategory['type'] = 'OTHER'
  ): number {
    const box = this.getBoundingBox(object);
    if (box.isEmpty()) {
      return 1.0; // Pas de bounding box valide
    }

    const maxDimension = this.getMaxDimension(box);
    if (maxDimension === 0) {
      return 1.0;
    }

    // Taille de base attendue pour cette catégorie (en mètres réels)
    const baseSize = CATEGORY_BASE_SIZES[category];
    
    // Taille cible dans le monde du jeu (en unités)
    const targetSize = TARGET_SIZES[category];

    // Si le modèle est déjà à la bonne échelle (dans une plage acceptable)
    // On ajuste légèrement si nécessaire
    const currentSizeInWorld = maxDimension;
    
    // Calculer le facteur d'échelle pour atteindre la taille cible
    // On suppose que le modèle original est à l'échelle réelle (baseSize)
    // On veut qu'il devienne targetSize dans le monde
    const scaleFactor = targetSize / currentSizeInWorld;

    // Si le modèle est déjà proche de la taille cible, on ajuste moins
    const tolerance = 0.1; // 10% de tolérance
    if (Math.abs(currentSizeInWorld - targetSize) / targetSize < tolerance) {
      return 1.0; // Pas besoin de redimensionner
    }

    return scaleFactor;
  }

  // Appliquer l'échelle à un objet
  public applyScale(
    object: THREE.Object3D,
    category: ModelCategory['type'] = 'OTHER',
    customTargetSize?: number
  ): number {
    const scale = customTargetSize 
      ? this.calculateCustomScale(object, customTargetSize)
      : this.calculateScale(object, category);
    
    object.scale.multiplyScalar(scale);
    return scale;
  }

  // Calculer l'échelle pour une taille cible personnalisée
  private calculateCustomScale(object: THREE.Object3D, targetSize: number): number {
    const box = this.getBoundingBox(object);
    if (box.isEmpty()) {
      return 1.0;
    }

    const maxDimension = this.getMaxDimension(box);
    if (maxDimension === 0) {
      return 1.0;
    }

    return targetSize / maxDimension;
  }

  // Normaliser un modèle selon les dimensions du monde
  public normalizeToWorld(
    object: THREE.Object3D,
    category: ModelCategory['type'] = 'OTHER'
  ): number {
    if (!this.worldBounds) {
      // Si pas de worldBounds, utiliser l'échelle par catégorie
      return this.applyScale(object, category);
    }

    // Utiliser la taille recommandée du monde comme référence
    const recommendedSize = this.worldBounds.recommendedMaxSize;
    
    // Ajuster selon la catégorie
    const categoryMultiplier = TARGET_SIZES[category] / TARGET_SIZES.OTHER;
    const targetSize = recommendedSize * categoryMultiplier * 0.1; // 10% de la taille recommandée

    return this.applyScale(object, category, targetSize);
  }

  // Détecter automatiquement la catégorie d'un modèle basé sur son nom/path
  public detectCategory(objectName: string, path?: string): ModelCategory['type'] {
    const name = (objectName + (path || '')).toLowerCase();

    // Détection par mots-clés - PNJ en premier
    if (name.includes('pnj') || name.includes('npc') || name.includes('marchand') || name.includes('banquier') || name.includes('merchant') || name.includes('banker')) {
      return 'NPC';
    }
    if (name.includes('character') || name.includes('player') || name.includes('humanoid') || 
        name.includes('personnage') || name.includes('civil')) {
      return 'CHARACTER';
    }
    
    if (name.includes('monster') || name.includes('mob') || name.includes('enemy') || 
        name.includes('boss') || name.includes('creature') || name.includes('monstre')) {
      return 'MONSTER';
    }
    
    if (name.includes('vehicle') || name.includes('car') || name.includes('truck') || 
        name.includes('ship') || name.includes('vehicule') || name.includes('hover')) {
      return 'VEHICLE';
    }
    
    if (name.includes('weapon') || name.includes('gun') || name.includes('sword') || 
        name.includes('arme') || name.includes('blade')) {
      return 'WEAPON';
    }
    
    if (name.includes('building') || name.includes('house') || name.includes('structure') || 
        name.includes('batiment') || name.includes('forge')) {
      return 'BUILDING';
    }
    
    if (name.includes('prop') || name.includes('object') || name.includes('item')) {
      return 'PROP';
    }

    return 'OTHER';
  }

  // Obtenir la taille recommandée pour une catégorie
  public getRecommendedSize(category: ModelCategory['type']): number {
    return TARGET_SIZES[category];
  }

  // Vérifier si un objet est à la bonne échelle
  public isProperlyScaled(
    object: THREE.Object3D,
    category: ModelCategory['type'] = 'OTHER',
    tolerance: number = 0.2
  ): boolean {
    const box = this.getBoundingBox(object);
    if (box.isEmpty()) {
      return true; // On considère qu'un objet sans bounding box est OK
    }

    const maxDimension = this.getMaxDimension(box);
    const targetSize = TARGET_SIZES[category];
    
    const difference = Math.abs(maxDimension - targetSize) / targetSize;
    return difference < tolerance;
  }
}

export const scalingService = ScalingService.getInstance();

