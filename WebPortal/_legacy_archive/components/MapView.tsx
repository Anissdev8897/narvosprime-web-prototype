import React, { useEffect, useRef, useState } from 'react';
import { Vector3, Faction, SceneMode, BiomeType } from '../types';
import { mapService, MapData } from '../services/mapService';
import { fogOfWarService } from '../services/fogOfWarService';
import { X } from 'lucide-react';

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
  const [discoveryPercentage, setDiscoveryPercentage] = useState(0);
  const animationFrameRef = useRef<number | undefined>(undefined);

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
    
    // ✅ Calculer dynamiquement les limites de la carte (une seule fois)
    let minX = -500, maxX = 500, minZ = -500, maxZ = 500;
    if (mapData) {
      mapData.zones.forEach(zone => {
        if (zone.bounds) {
          minX = Math.min(minX, zone.bounds.min.x);
          maxX = Math.max(maxX, zone.bounds.max.x);
          minZ = Math.min(minZ, zone.bounds.min.z);
          maxZ = Math.max(maxZ, zone.bounds.max.z);
        }
      });
    }
    
    // Mettre à jour la découverte
    mapService.updateDiscovery(playerPosition);
    fogOfWarService.discoverArea(playerPosition, {
      min: { x: minX, y: 0, z: minZ },
      max: { x: maxX, y: 0, z: maxZ }
    });
    
    // Calculer le pourcentage de découverte
    const percentage = fogOfWarService.getDiscoveryPercentage({
      min: { x: minX, y: 0, z: minZ },
      max: { x: maxX, y: 0, z: maxZ }
    });
    setDiscoveryPercentage(percentage);
    
    // Ajouter une marge de 10% pour l'affichage
    const marginX = (maxX - minX) * 0.1;
    const marginZ = (maxZ - minZ) * 0.1;
    const displayMinX = minX - marginX;
    const displayMaxX = maxX + marginX;
    const displayMinZ = minZ - marginZ;
    const displayMaxZ = maxZ + marginZ;
    
    const mapWidth = displayMaxX - displayMinX;
    const mapHeight = displayMaxZ - displayMinZ;
    const offsetX = -displayMinX; // Offset pour centrer
    const offsetZ = -displayMinZ;
    
    // ✅ Adapter la taille du canvas à la carte réelle (minimum 2000x2000, maximum 10000x10000)
    const canvasWidth = Math.max(2000, Math.min(10000, Math.ceil(mapWidth * 2)));
    const canvasHeight = Math.max(2000, Math.min(10000, Math.ceil(mapHeight * 2)));
    
    if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
    }
    
    // Dessiner la carte
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Dessiner les biomes
      mapData.zones.forEach(zone => {
        if (zone.type === 'BIOME') {
          const biomeColor = getBiomeColor(zone.biome);
          const x = zone.bounds.min.x + offsetX;
          const z = zone.bounds.min.z + offsetZ;
          const width = zone.bounds.max.x - zone.bounds.min.x;
          const height = zone.bounds.max.z - zone.bounds.min.z;
          
          ctx.fillStyle = biomeColor;
          ctx.fillRect(x, z, width, height);
          
          // Ajouter un motif selon le biome
          addBiomePattern(ctx, zone.biome, x, z, width, height);
        }
      });
      
      // Dessiner le fog of war
      const pixelSize = Math.max(2, Math.min(10, Math.floor(mapWidth / 200))); // Pixel size adaptatif
      for (let x = displayMinX; x < displayMaxX; x += pixelSize) {
        for (let z = displayMinZ; z < displayMaxZ; z += pixelSize) {
          if (!fogOfWarService.isDiscovered(x, z)) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(x + offsetX, z + offsetZ, pixelSize, pixelSize);
          }
        }
      }
      
      // Dessiner la position du joueur
      const playerX = playerPosition.x + offsetX;
      const playerZ = playerPosition.z + offsetZ;
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(playerX, playerZ, 8, 0, Math.PI * 2);
      ctx.fill();
      
      // Cercle autour du joueur pour la zone de découverte
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(playerX, playerZ, 50, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Dessiner les zones d'alliance (si disponibles)
      // TODO: Implémenter les zones d'alliance selon les données du jeu
      
      animationFrameRef.current = requestAnimationFrame(render);
    };
    
    render();
    
    // Sauvegarder périodiquement
    const saveInterval = setInterval(() => {
      fogOfWarService.saveDiscoveredPixels(planetId);
    }, 5000);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      clearInterval(saveInterval);
    };
  }, [isOpen, mapData, playerPosition, planetId]);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center">
      <div className="relative w-4/5 h-4/5 bg-slate-900 border-2 border-blue-500 rounded-lg p-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-white">MAP</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-red-400 text-2xl transition-colors"
          >
            <X size={24} />
          </button>
        </div>
        
        {/* Canvas */}
        <div className="flex-1 relative border border-slate-700 rounded overflow-hidden">
          <canvas
            ref={canvasRef}
            width={2000}
            height={2000}
            className="w-full h-full"
            style={{ imageRendering: 'auto' }}
          />
          
          {/* Légende */}
          <div className="absolute top-4 right-4 bg-slate-900/90 border border-slate-700 p-3 rounded text-xs space-y-2">
            <div className="text-white font-bold mb-2">LEGEND</div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded-full" />
              <span className="text-slate-300">Player</span>
            </div>
            {mapData?.zones.map(zone => zone.biome && (
              <div key={zone.id} className="flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: getBiomeColor(zone.biome) }}
                />
                <span className="text-slate-300">{zone.name}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Footer avec statistiques */}
        <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
          <div className="font-mono">
            Discovery: {discoveryPercentage.toFixed(1)}%
          </div>
          <div className="font-mono">
            Position: ({playerPosition.x.toFixed(1)}, {playerPosition.z.toFixed(1)})
          </div>
        </div>
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
    case BiomeType.HUB:
      return '#64748b'; // Gris (HUB)
    default:
      return '#64748b'; // Gris par défaut
  }
}

function addBiomePattern(
  ctx: CanvasRenderingContext2D,
  biome: BiomeType | undefined,
  x: number,
  z: number,
  width: number,
  height: number
): void {
  if (!biome) return;
  
  ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
  
  switch (biome) {
    case BiomeType.FUNGAL:
      // Motif organique (cercles)
      for (let i = 0; i < 50; i++) {
        const px = x + Math.random() * width;
        const pz = z + Math.random() * height;
        ctx.beginPath();
        ctx.arc(px, pz, Math.random() * 10 + 5, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case BiomeType.OCEAN:
      // Motif aquatique (lignes ondulées)
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 20; i++) {
        ctx.beginPath();
        const startY = z + (i * height / 20);
        ctx.moveTo(x, startY);
        for (let j = 0; j < width; j += 10) {
          ctx.lineTo(x + j, startY + Math.sin(j * 0.1) * 5);
        }
        ctx.stroke();
      }
      break;
    case BiomeType.DESERT:
      // Motif désertique (points)
      for (let i = 0; i < 100; i++) {
        const px = x + Math.random() * width;
        const pz = z + Math.random() * height;
        ctx.fillRect(px, pz, 2, 2);
      }
      break;
  }
}

