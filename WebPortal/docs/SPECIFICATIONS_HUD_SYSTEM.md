# 📋 Spécifications Techniques - Nouveau Système HUD et Cartographie

## 🎯 Vue d'Ensemble

Ce document décrit les spécifications techniques pour la refonte complète du système HUD (Heads-Up Display) et l'implémentation d'un système de cartographie avancé pour NARVOS PRIME.

---

## 1. 🎨 NOUVEAU SYSTÈME HUD PAR FACTION

### 1.1 Architecture Générale

**Objectif** : Remplacer le HUD actuel (`StatsHUD.tsx`) par un nouveau système visuel avec codes couleurs spécifiques par faction.

**Fichiers à modifier/créer** :
- `components/NewHUD.tsx` (nouveau composant principal)
- `components/HealthBar.tsx` (barre de vie)
- `components/ArmorBar.tsx` (barre d'armure)
- `components/WeaponDisplay.tsx` (affichage des armes)
- `services/hudService.ts` (service de gestion du HUD)
- `constants.ts` (ajout des constantes de couleurs par faction)

### 1.2 Codes Couleurs par Faction

#### **AKARLYS (HUMAN)**
```typescript
const AKARLYS_COLORS = {
  health: '#ef4444',      // Rouge (#ef4444)
  armor: '#3b82f6',       // Bleu (#3b82f6)
  primary: '#3b82f6',     // Bleu primaire
  accent: '#60a5fa',       // Bleu clair
  glow: 'rgba(59, 130, 246, 0.5)' // Glow bleu
};
```

#### **ZAYAN (ALIEN)**
```typescript
const ZAYAN_COLORS = {
  health: '#a855f7',      // Violet (#a855f7)
  armor: '#22c55e',       // Vert (#22c55e)
  primary: '#a855f7',     // Violet primaire
  accent: '#c084fc',      // Violet clair
  glow: 'rgba(168, 85, 247, 0.5)' // Glow violet
};
```

#### **MEZALAYIS (MERCENARY)**
```typescript
const MEZALAYIS_COLORS = {
  health: '#eab308',      // Jaune (#eab308)
  armor: '#f97316',       // Orange (#f97316)
  primary: '#eab308',     // Jaune primaire
  accent: '#fbbf24',      // Jaune clair
  glow: 'rgba(234, 179, 8, 0.5)' // Glow jaune
};
```

### 1.3 Structure du Nouveau HUD

#### **Composant Principal : `NewHUD.tsx`**

```typescript
interface NewHUDProps {
  playerFaction: Faction;
  stats: Stats;
  weapon?: WeaponData;
  planetId?: string | null;
  playerStatus?: PlayerStatus;
}

export const NewHUD: React.FC<NewHUDProps> = ({
  playerFaction,
  stats,
  weapon,
  planetId,
  playerStatus
}) => {
  // Déterminer les couleurs selon la faction
  const colors = getFactionColors(playerFaction);
  
  return (
    <div className="absolute inset-0 pointer-events-none z-30">
      {/* Barres de santé et armure (bas gauche) */}
      <HealthBar 
        health={stats.hp} 
        maxHealth={stats.maxHp} 
        color={colors.health}
        faction={playerFaction}
      />
      <ArmorBar 
        armor={stats.armor} 
        maxArmor={stats.maxArmor} 
        color={colors.armor}
        faction={playerFaction}
      />
      
      {/* Affichage des armes (bas droite) */}
      {weapon && (
        <WeaponDisplay 
          weapon={weapon}
          faction={playerFaction}
        />
      )}
      
      {/* Indicateurs de statut (haut) */}
      <StatusIndicators 
        playerStatus={playerStatus}
        planetId={planetId}
        faction={playerFaction}
      />
    </div>
  );
};
```

#### **Barre de Santé : `HealthBar.tsx`**

**Caractéristiques** :
- Position : Bas gauche de l'écran
- Style : Barre horizontale avec icône de crâne à gauche
- Animation : Effet de glow pulsant quand la santé est basse (< 30%)
- Couleur : Selon faction (rouge/violet/jaune)
- Affichage : `{current} / {max}` en texte

**Implémentation** :
```typescript
interface HealthBarProps {
  health: number;
  maxHealth: number;
  color: string;
  faction: Faction;
}

export const HealthBar: React.FC<HealthBarProps> = ({
  health,
  maxHealth,
  color,
  faction
}) => {
  const percent = (health / maxHealth) * 100;
  const isLow = percent < 30;
  
  return (
    <div className="absolute bottom-32 left-8 w-80">
      <div className="flex items-center gap-2 mb-1">
        <Skull size={16} className="text-white" />
        <span className="text-xs font-mono text-white font-bold">HEALTH</span>
        <span className="text-xs font-mono text-slate-400 ml-auto">
          {Math.ceil(health)} / {maxHealth}
        </span>
      </div>
      <div className="h-4 bg-slate-900/90 border-2 border-white/20 overflow-hidden relative">
        <div 
          className={`h-full transition-all duration-300 ${isLow ? 'animate-pulse' : ''}`}
          style={{ 
            width: `${percent}%`,
            backgroundColor: color,
            boxShadow: isLow ? `0 0 20px ${color}` : 'none'
          }}
        />
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-20 bg-[url('data:image/png;base64,...')]" />
      </div>
    </div>
  );
};
```

#### **Barre d'Armure : `ArmorBar.tsx`**

**Caractéristiques** :
- Position : Juste au-dessus de la barre de santé
- Style : Barre horizontale avec icône de bouclier à gauche
- Animation : Effet de glow quand l'armure est pleine
- Couleur : Selon faction (bleu/vert/orange)
- Affichage : `{current} / {max}` en texte

**Implémentation** : Similaire à `HealthBar.tsx` mais avec icône `Shield` et couleur d'armure.

### 1.4 Désactivation de l'Ancien HUD

**Dans `GameEngine.tsx`** :
```typescript
// ❌ DÉSACTIVER L'ANCIEN HUD
// {!isPaused && !showFullSettings && !showForge && !isTransitioning && (
//   <StatsHUD ... />
// )}

// ✅ ACTIVER LE NOUVEAU HUD
{!isPaused && !showFullSettings && !showForge && !isTransitioning && (
  <NewHUD
    playerFaction={playerRef.current.faction}
    stats={playerRef.current.stats}
    weapon={currentWeapon}
    planetId={activePlanetId}
    playerStatus={playerRef.current.status}
  />
)}
```

---

## 2. 📡 RADAR AMÉLIORÉ

### 2.1 Spécifications Techniques

**Objectif** : Améliorer le système de radar existant pour une détection plus précise et visuellement attrayante.

**Fichiers à modifier** :
- `components/Radar.tsx` (refonte complète)
- `services/radarService.ts` (nouveau service de détection)

### 2.2 Caractéristiques du Nouveau Radar

#### **Zone de Surveillance**
- **Rayon** : 5 mètres autour du joueur (au lieu de 1500 actuellement)
- **Forme** : Cercle de détection
- **Mise à jour** : 60 FPS (chaque frame)

#### **Détection des Entités**

**Entités en Mouvement** :
- **Types détectés** :
  - Joueurs (autres joueurs)
  - Monstres
  - PNJ (marchands, civils)
  - Véhicules
- **Indicateurs visuels** :
  - **Point animé** : Pulsation pour indiquer le mouvement
  - **Traînée** : Ligne pointillée montrant la direction du mouvement
  - **Couleur** : Selon le type et la faction
    - Monstres : Rouge (`#ef4444`)
    - Alliés : Bleu/Vert/Violet selon faction
    - Ennemis : Rouge/Orange selon tension
    - Neutres : Blanc (`#ffffff`)

**Objets Statiques** :
- **Types détectés** :
  - Ressources (minerais, plantes)
  - Props (crates, containers)
  - Structures (bâtiments, portails)
- **Indicateurs visuels** :
  - **Point fixe** : Pas d'animation
  - **Forme** : Carré au lieu de cercle
  - **Couleur** : Gris clair (`#9ca3af`) par défaut

#### **Interface Visuelle**

**Améliorations** :
- **Grille de distance** : Cercles concentriques à 1m, 2.5m, 5m
- **Scanline rotative** : Effet de balayage continu
- **Légende** : Petite légende en bas du radar indiquant les types d'entités
- **Zoom** : Option de zoom (1x, 2x, 4x) pour voir plus de détails

### 2.3 Implémentation Technique

#### **Service de Détection : `radarService.ts`**

```typescript
export interface RadarEntity {
  id: string;
  type: 'PLAYER' | 'MONSTER' | 'NPC' | 'VEHICLE' | 'PROP' | 'RESOURCE' | 'STRUCTURE';
  position: Vector3;
  velocity?: Vector3; // Pour détecter le mouvement
  faction?: Faction;
  isMoving: boolean;
  lastPosition?: Vector3;
}

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
          position: obj.position,
          velocity: this.calculateVelocity(obj),
          faction: obj.userData?.faction,
          isMoving: this.isEntityMoving(obj),
          lastPosition: obj.userData?.lastPosition
        };
        
        entities.push(entity);
        obj.userData.lastPosition = obj.position;
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
    if (userDataType === 'MERCHANT_NPC' || userDataType === 'CIVILIAN') return 'NPC';
    if (userDataType === 'VEHICLE') return 'VEHICLE';
    if (userDataType === 'RESOURCE') return 'RESOURCE';
    if (userDataType === 'PROP') return 'PROP';
    if (userDataType === 'PORTAL_FRAME' || userDataType === 'STRUCTURE') return 'STRUCTURE';
    
    // Par défaut, considérer comme joueur si c'est un personnage
    if (obj.userData?.type === 'PLAYER' || obj.userData?.canMove) {
      return 'PLAYER';
    }
    
    return 'PROP';
  }
  
  private calculateDistance(pos1: Vector3, pos2: THREE.Vector3): number {
    return Math.sqrt(
      Math.pow(pos2.x - pos1.x, 2) +
      Math.pow(pos2.z - pos1.z, 2)
    );
  }
}

export const radarService = RadarService.getInstance();
```

#### **Composant Radar Amélioré : `Radar.tsx`**

```typescript
export const Radar: React.FC<RadarProps> = ({
  playerPosition,
  playerRotation,
  entities = [],
  playerFaction,
  playerReputation
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const [zoom, setZoom] = useState(1);
  const detectionRange = 5; // 5 mètres
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const render = () => {
      // Nettoyer le canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = (canvas.width / 2) - 10;
      
      // Dessiner le fond
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();
      
      // Dessiner les cercles de distance (1m, 2.5m, 5m)
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
      ctx.lineWidth = 1;
      [1, 2.5, 5].forEach(distance => {
        const circleRadius = (distance / detectionRange) * radius;
        ctx.beginPath();
        ctx.arc(centerX, centerY, circleRadius, 0, Math.PI * 2);
        ctx.stroke();
      });
      
      // Dessiner les entités
      const radarEntities = radarService.detectEntities(
        playerPosition,
        entities
      );
      
      radarEntities.forEach(entity => {
        const distance = Math.sqrt(
          Math.pow(entity.position.x - playerPosition.x, 2) +
          Math.pow(entity.position.z - playerPosition.z, 2)
        );
        
        if (distance <= detectionRange) {
          const angle = Math.atan2(
            entity.position.x - playerPosition.x,
            entity.position.z - playerPosition.z
          ) - playerRotation;
          
          const r = (distance / detectionRange) * radius;
          const x = centerX + Math.sin(angle) * r;
          const y = centerY - Math.cos(angle) * r;
          
          // Déterminer la couleur et la forme
          const color = getEntityColor(entity, playerFaction, playerReputation);
          const isStatic = !entity.isMoving;
          
          if (isStatic) {
            // Objet statique : carré
            ctx.fillStyle = color;
            ctx.fillRect(x - 2, y - 2, 4, 4);
          } else {
            // Entité en mouvement : cercle animé
            const pulse = Math.sin(Date.now() * 0.005) * 0.5 + 1;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, 2 * pulse, 0, Math.PI * 2);
            ctx.fill();
            
            // Traînée de mouvement
            if (entity.velocity) {
              const velocityAngle = Math.atan2(entity.velocity.x, entity.velocity.z);
              const trailLength = 5;
              ctx.strokeStyle = color;
              ctx.lineWidth = 1;
              ctx.setLineDash([2, 2]);
              ctx.beginPath();
              ctx.moveTo(x, y);
              ctx.lineTo(
                x + Math.sin(velocityAngle) * trailLength,
                y - Math.cos(velocityAngle) * trailLength
              );
              ctx.stroke();
              ctx.setLineDash([]);
            }
          }
        }
      });
      
      // Dessiner le joueur (centre)
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(-playerRotation);
      ctx.fillStyle = '#60a5fa';
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(4, 4);
      ctx.lineTo(0, 2);
      ctx.lineTo(-4, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      
      // Scanline effect
      const time = Date.now() * 0.002;
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(time);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, -0.15, 0.15);
      ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
      ctx.fill();
      ctx.restore();
      
      animationFrameRef.current = requestAnimationFrame(render);
    };
    
    render();
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [playerPosition, playerRotation, entities, playerFaction, playerReputation]);
  
  return (
    <div className="relative w-48 h-48">
      <div className="absolute -top-6 left-0 text-[10px] text-blue-400 font-mono">
        LR-SENSOR ARRAY (5M)
      </div>
      <canvas 
        ref={canvasRef} 
        width={192} 
        height={192} 
        className="rounded-full border-2 border-blue-500/50 bg-slate-900/90 backdrop-blur-sm shadow-lg shadow-blue-500/20"
      />
      {/* Légende */}
      <div className="absolute -bottom-6 left-0 text-[8px] text-slate-400 font-mono space-y-0.5">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span>Monsters</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span>Allies</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-gray-400" />
          <span>Static</span>
        </div>
      </div>
    </div>
  );
};
```

---

## 3. 🗺️ SYSTÈME DE CARTE (TOUCHE M)

### 3.1 Spécifications Générales

**Objectif** : Créer un système de carte accessible via la touche `M` avec fog of war, biomes, et zones d'alliance.

**Fichiers à créer** :
- `components/MapView.tsx` (composant principal de la carte)
- `services/mapService.ts` (service de gestion de la carte)
- `services/fogOfWarService.ts` (service de fog of war)
- `types.ts` (ajout des types pour la carte)

### 3.2 Fonctionnalités de la Carte

#### **Affichage de la Map**
- **Forme complète** : Afficher la forme complète de la map actuelle (planète ou HUB)
- **Position du joueur** : Indicateur clair de la position actuelle
- **Zones d'alliance** : Zones colorées selon les factions contrôlantes
- **Biomes** : Identification visuelle des différents biomes
- **Fog of War** : Zones non découvertes masquées progressivement

#### **Système de Découverte (Fog of War)**
- **Découverte progressive** : Les zones se révèlent au fur et à mesure que le joueur les explore
- **Rayon de découverte** : 50 mètres autour du joueur
- **Persistance** : Les zones découvertes sont sauvegardées dans `localStorage`
- **Visualisation** : Zones découvertes = opaques, zones non découvertes = sombres avec effet de brouillard

#### **Biomes**
- **Forêt Tropicale** (MYCELION) : Vert foncé avec motifs organiques
- **Océan** (AQUARYS) : Bleu avec motifs aquatiques
- **Désert** (DRAELKARA) : Jaune/orange avec motifs sablonneux
- **HUB** : Gris métallique avec motifs technologiques

### 3.3 Implémentation Technique

#### **Service de Carte : `mapService.ts`**

```typescript
export interface MapZone {
  id: string;
  type: 'BIOME' | 'ALLIANCE_ZONE' | 'POI'; // Point of Interest
  biome?: BiomeType;
  faction?: Faction;
  name: string;
  bounds: {
    min: Vector3;
    max: Vector3;
  };
  discovered: boolean;
}

export interface MapData {
  planetId: string | null;
  sceneMode: SceneMode;
  zones: MapZone[];
  discoveredAreas: Set<string>; // IDs des zones découvertes
  playerHistory: Vector3[]; // Historique des positions pour le fog of war
}

export class MapService {
  private static instance: MapService;
  private mapData: MapData | null = null;
  private discoveryRadius = 50; // 50 mètres
  
  public static getInstance(): MapService {
    if (!MapService.instance) {
      MapService.instance = new MapService();
    }
    return MapService.instance;
  }
  
  /**
   * Initialiser la carte pour une planète/scène
   */
  public initializeMap(planetId: string | null, sceneMode: SceneMode): void {
    const zones = this.generateZones(planetId, sceneMode);
    const discoveredAreas = this.loadDiscoveredAreas(planetId);
    
    this.mapData = {
      planetId,
      sceneMode,
      zones,
      discoveredAreas,
      playerHistory: []
    };
  }
  
  /**
   * Mettre à jour la découverte selon la position du joueur
   */
  public updateDiscovery(playerPosition: Vector3): void {
    if (!this.mapData) return;
    
    // Ajouter la position à l'historique
    this.mapData.playerHistory.push({ ...playerPosition });
    
    // Limiter l'historique à 1000 points
    if (this.mapData.playerHistory.length > 1000) {
      this.mapData.playerHistory.shift();
    }
    
    // Découvrir les zones dans le rayon
    this.mapData.zones.forEach(zone => {
      if (this.isInRadius(playerPosition, zone.bounds, this.discoveryRadius)) {
        this.mapData!.discoveredAreas.add(zone.id);
        zone.discovered = true;
      }
    });
    
    // Sauvegarder les zones découvertes
    this.saveDiscoveredAreas();
  }
  
  /**
   * Générer les zones pour une planète
   */
  private generateZones(planetId: string | null, sceneMode: SceneMode): MapZone[] {
    const zones: MapZone[] = [];
    
    if (sceneMode === SceneMode.HUB) {
      zones.push({
        id: 'hub_central',
        type: 'BIOME',
        name: 'HUB Central',
        bounds: { min: { x: -50, y: 0, z: -50 }, max: { x: 50, y: 0, z: 50 } },
        discovered: false
      });
      return zones;
    }
    
    if (planetId === 'mycelion') {
      // Forêt tropicale
      zones.push({
        id: 'mycelion_forest',
        type: 'BIOME',
        biome: BiomeType.FUNGAL,
        name: 'Forêt Fongique',
        bounds: { min: { x: -500, y: 0, z: -500 }, max: { x: 500, y: 0, z: 500 } },
        discovered: false
      });
    } else if (planetId === 'aquarys') {
      // Océan
      zones.push({
        id: 'aquarys_ocean',
        type: 'BIOME',
        biome: BiomeType.OCEAN,
        name: 'Océan Abyssal',
        bounds: { min: { x: -500, y: -100, z: -500 }, max: { x: 500, y: 0, z: 500 } },
        discovered: false
      });
    } else if (planetId === 'draelkara') {
      // Désert
      zones.push({
        id: 'draelkara_desert',
        type: 'BIOME',
        biome: BiomeType.DESERT,
        name: 'Désert Aride',
        bounds: { min: { x: -500, y: 0, z: -500 }, max: { x: 500, y: 0, z: 500 } },
        discovered: false
      });
    }
    
    return zones;
  }
  
  /**
   * Vérifier si une position est dans le rayon de découverte
   */
  private isInRadius(position: Vector3, bounds: { min: Vector3; max: Vector3 }, radius: number): boolean {
    const centerX = (bounds.min.x + bounds.max.x) / 2;
    const centerZ = (bounds.min.z + bounds.max.z) / 2;
    const distance = Math.sqrt(
      Math.pow(position.x - centerX, 2) +
      Math.pow(position.z - centerZ, 2)
    );
    return distance <= radius;
  }
  
  /**
   * Charger les zones découvertes depuis localStorage
   */
  private loadDiscoveredAreas(planetId: string | null): Set<string> {
    const key = `narvos_map_discovered_${planetId || 'hub'}`;
    const data = localStorage.getItem(key);
    if (data) {
      return new Set(JSON.parse(data));
    }
    return new Set();
  }
  
  /**
   * Sauvegarder les zones découvertes dans localStorage
   */
  private saveDiscoveredAreas(): void {
    if (!this.mapData) return;
    const key = `narvos_map_discovered_${this.mapData.planetId || 'hub'}`;
    localStorage.setItem(key, JSON.stringify(Array.from(this.mapData.discoveredAreas)));
  }
  
  /**
   * Obtenir les données de la carte
   */
  public getMapData(): MapData | null {
    return this.mapData;
  }
}

export const mapService = MapService.getInstance();
```

#### **Service de Fog of War : `fogOfWarService.ts`**

```typescript
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
    return (discoveredArea / totalArea) * 100;
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
    }
  }
}

export const fogOfWarService = FogOfWarService.getInstance();
```

#### **Composant de Carte : `MapView.tsx`**

```typescript
interface MapViewProps {
  isOpen: boolean;
  onClose: () => void;
  playerPosition: Vector3;
  playerFaction: Faction;
  planetId: string | null;
  sceneMode: SceneMode;
}

export const MapView: React.FC<MapViewProps> = ({
  isOpen,
  onClose,
  playerPosition,
  playerFaction,
  planetId,
  sceneMode
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mapData, setMapData] = useState<MapData | null>(null);
  
  useEffect(() => {
    if (!isOpen) return;
    
    // Initialiser la carte
    mapService.initializeMap(planetId, sceneMode);
    fogOfWarService.loadDiscoveredPixels(planetId);
    
    const data = mapService.getMapData();
    setMapData(data);
  }, [isOpen, planetId, sceneMode]);
  
  useEffect(() => {
    if (!isOpen || !mapData) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Mettre à jour la découverte
    mapService.updateDiscovery(playerPosition);
    fogOfWarService.discoverArea(playerPosition, {
      min: { x: -500, y: 0, z: -500 },
      max: { x: 500, y: 0, z: 500 }
    });
    
    // Dessiner la carte
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Dessiner les biomes
      mapData.zones.forEach(zone => {
        if (zone.type === 'BIOME') {
          const biomeColor = getBiomeColor(zone.biome);
          ctx.fillStyle = biomeColor;
          ctx.fillRect(
            zone.bounds.min.x + 500,
            zone.bounds.min.z + 500,
            zone.bounds.max.x - zone.bounds.min.x,
            zone.bounds.max.z - zone.bounds.min.z
          );
        }
      });
      
      // Dessiner le fog of war
      for (let x = -500; x < 500; x += 5) {
        for (let z = -500; z < 500; z += 5) {
          if (!fogOfWarService.isDiscovered(x, z)) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(x + 500, z + 500, 5, 5);
          }
        }
      }
      
      // Dessiner la position du joueur
      const playerX = playerPosition.x + 500;
      const playerZ = playerPosition.z + 500;
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(playerX, playerZ, 5, 0, Math.PI * 2);
      ctx.fill();
      
      // Dessiner les zones d'alliance
      // ... (implémentation des zones d'alliance)
    };
    
    render();
    
    // Sauvegarder périodiquement
    const saveInterval = setInterval(() => {
      fogOfWarService.saveDiscoveredPixels(planetId);
    }, 5000);
    
    return () => {
      clearInterval(saveInterval);
    };
  }, [isOpen, mapData, playerPosition, planetId]);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center">
      <div className="relative w-4/5 h-4/5 bg-slate-900 border-2 border-blue-500 rounded-lg p-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white hover:text-red-400 text-2xl"
        >
          ×
        </button>
        <h2 className="text-2xl font-bold text-white mb-4">MAP</h2>
        <canvas
          ref={canvasRef}
          width={1000}
          height={1000}
          className="w-full h-full border border-slate-700"
        />
      </div>
    </div>
  );
};

function getBiomeColor(biome?: BiomeType): string {
  switch (biome) {
    case BiomeType.FUNGAL:
      return '#22c55e'; // Vert (forêt tropicale)
    case BiomeType.OCEAN:
      return '#0ea5e9'; // Bleu (océan)
    case BiomeType.DESERT:
      return '#eab308'; // Jaune (désert)
    default:
      return '#64748b'; // Gris (HUB)
  }
}
```

### 3.4 Intégration dans GameEngine

**Dans `GameEngine.tsx`** :
```typescript
const [isMapOpen, setIsMapOpen] = useState(false);

// Gestionnaire de touche M
useEffect(() => {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'm' || event.key === 'M') {
      if (!isPaused && !showFullSettings && !showForge) {
        setIsMapOpen(prev => !prev);
      }
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [isPaused, showFullSettings, showForge]);

// Rendu de la carte
{isMapOpen && (
  <MapView
    isOpen={isMapOpen}
    onClose={() => setIsMapOpen(false)}
    playerPosition={playerRef.current.position}
    playerFaction={playerRef.current.faction}
    planetId={activePlanetId}
    sceneMode={sceneMode}
  />
)}
```

---

## 4. 📝 PLAN D'IMPLÉMENTATION

### Phase 1 : Nouveau HUD (Priorité Haute)
1. ✅ Créer `NewHUD.tsx` avec structure de base
2. ✅ Créer `HealthBar.tsx` et `ArmorBar.tsx`
3. ✅ Implémenter les codes couleurs par faction
4. ✅ Désactiver l'ancien `StatsHUD`
5. ✅ Tester avec les 3 factions

### Phase 2 : Radar Amélioré (Priorité Haute)
1. ✅ Créer `radarService.ts`
2. ✅ Modifier `Radar.tsx` pour zone de 5m
3. ✅ Implémenter détection entités/objets
4. ✅ Ajouter animations et traînées
5. ✅ Tester la détection

### Phase 3 : Système de Carte (Priorité Moyenne)
1. ✅ Créer `mapService.ts`
2. ✅ Créer `fogOfWarService.ts`
3. ✅ Créer `MapView.tsx`
4. ✅ Implémenter fog of war
5. ✅ Ajouter biomes et zones d'alliance
6. ✅ Intégrer touche M
7. ✅ Tester la persistance

---

## 5. 🎨 RESSOURCES VISUELLES

### Icônes Requises
- Crâne (Health)
- Bouclier (Armor)
- Arme (Weapon Display)
- Carte (Map Button)

### Effets Visuels
- Glow pulsant (santé basse)
- Scanline rotative (radar)
- Traînées de mouvement (entités)
- Fog of war (carte)

---

## 6. ✅ CHECKLIST DE VALIDATION

- [ ] Nouveau HUD fonctionne avec les 3 factions
- [ ] Codes couleurs corrects (rouge/violet/jaune pour santé, bleu/vert/orange pour armure)
- [ ] Radar détecte dans un rayon de 5m
- [ ] Radar différencie entités mobiles (cercle animé) et objets statiques (carré)
- [ ] Carte accessible via touche M
- [ ] Carte affiche la forme complète de la map
- [ ] Position du joueur visible sur la carte
- [ ] Fog of war fonctionne et se révèle progressivement
- [ ] Biomes identifiables visuellement
- [ ] Zones d'alliance affichées
- [ ] Sauvegarde des zones découvertes fonctionne

---

*Document créé le : ${new Date().toLocaleDateString('fr-FR')}*