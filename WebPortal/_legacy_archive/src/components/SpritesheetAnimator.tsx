/**
 * @deprecated LEGACY — Système d'animation 2D Spritesheet (style Tiphon/Dofus).
 *
 * Remplacé en 3D par THREE.AnimationMixer + GLB animations (voir ViewModelFPS,
 * Entity3D dans GameWorld3D). À supprimer en même temps que GameWorld.tsx.
 *
 * Encore importé par : Character3DPreview, narvos-data, TacticalCombatScene.
 * Avant suppression : retirer ces imports.
 */
import React, { useState, useEffect, useRef } from 'react';
import { getSpritesheetConfig, SpritesheetConfig } from '../data/animation-configs';
import { resolveTiphonAsset, AssetStrategy } from '../utils/resolveTiphonAsset';

/**
 * Tiphon-like Animation States
 */
export enum AnimationState {
  IDLE = 'Idle',
  WALK = 'Walk',
  RUN = 'Run',
  JUMP = 'Jump',
  ATTACK = 'Attack',
  HIT = 'Hit',
  DIE = 'Die'
}

/**
 * Dofus 8-Direction Mapping
 */
export type EntityDirection = 'S' | 'SE' | 'E' | 'NE' | 'N' | 'NW' | 'W' | 'SW';

export interface SpriteOffsets {
  x: number;
  y: number;
}

export interface SpriteLayer {
  id: string;
  basePath?: string;
  priority: number;
  tint?: string;
  isVisible?: boolean;
}

interface TiphonSpriteProps {
  entityId: string;
  basePath?: string; // Legacy/Single-layer support
  layers?: SpriteLayer[]; // New: Modular support
  state: AnimationState;
  direction: EntityDirection;
  onAnimationEnd?: () => void;
  debug?: boolean;
  className?: string;
  style?: React.CSSProperties;
  
  // LOGICAL VS VISUAL
  logicalWidth?: number; // In grid units
  logicalHeight?: number; // In grid units
  visualOffset?: SpriteOffsets; // Custom visual tweaks
  pivotPoint?: { x: number; y: number }; // Relative 0-1, default {0.5, 1.0}
  scale?: number; // Visual override scale
}

export const SpritesheetAnimator: React.FC<TiphonSpriteProps> = ({
  entityId,
  basePath,
  layers = [],
  state = AnimationState.IDLE,
  direction = 'SE',
  onAnimationEnd,
  debug = false,
  className = '',
  style = {},
  visualOffset = { x: 0, y: 0 },
  pivotPoint = { x: 0.5, y: 1.0 },
  scale = 1.0
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [activeConfig, setActiveConfig] = useState<SpritesheetConfig | null>(null);
  
  // New: Multiple layers state
  const [layerImages, setLayerImages] = useState<Record<string, HTMLImageElement>>({});
  const [loadErrors, setLoadErrors] = useState<Record<string, string>>({});
  
  const lastTimeRef = useRef<number>(0);
  const requestRef = useRef<number>(0);

  // Cache for preloaded frame images (for FRAME_FILE strategy)
  const frameCache = useRef<Record<string, HTMLImageElement>>({});

  // 1. DIRECTION MAPPING (Only used for MASTER_SHEET)
  const directionRows: Record<EntityDirection, number> = {
    'S': 4, 'SE': 0, 'E': 7, 'NE': 3, 'N': 6, 'NW': 2, 'W': 5, 'SW': 1
  };

  // 2. LOAD ASSETS (Synchronized layers)
  useEffect(() => {
    const config = getSpritesheetConfig(entityId, state);
    setActiveConfig(config);
    
    // Prepare effective layers (either prop or singleton from basePath)
    const effectiveLayers: SpriteLayer[] = layers.length > 0 
      ? layers 
      : basePath 
        ? [{ id: 'body', basePath, priority: 0, isVisible: true }] 
        : [];

    effectiveLayers.forEach(layer => {
      if (!layer.isVisible && layers.length > 0) return;
      
      const layerPath = layer.basePath || basePath || "";
      const resolution = resolveTiphonAsset(
        entityId, 
        layerPath, 
        state, 
        direction, 
        config, 
        currentFrame, 
        layer.id === 'body' ? 'Body' : layer.id
      );
      const sheetPath = resolution.path;

      if (frameCache.current[sheetPath]) {
        setLayerImages(prev => ({ ...prev, [layer.id]: frameCache.current[sheetPath] }));
        return;
      }

      const img = new Image();
      img.onload = () => {
        if (debug) console.log(`[Tiphon] Loaded layer ${layer.id}: ${sheetPath}`);
        setLayerImages(prev => ({ ...prev, [layer.id]: img }));
        setLoadErrors(prev => {
          const next = { ...prev };
          delete next[layer.id];
          return next;
        });
        frameCache.current[sheetPath] = img;
      };
      img.onerror = () => {
        console.error(`[Tiphon] Failed to load layer ${layer.id}: ${sheetPath}`);
        setLoadErrors(prev => ({ ...prev, [layer.id]: `Failed: ${layer.id}` }));
      };
      img.src = sheetPath;
    });
    
  }, [entityId, state, basePath, JSON.stringify(layers), direction, currentFrame]);

  // Reset frame when state/direction/entity changes
  useEffect(() => {
    setCurrentFrame(0);
    lastTimeRef.current = 0; // Reset timer to ensure first frame shows for full duration
    
    // Clear cache when changing entity/state to prevent memory bloat? 
    // Maybe keep a small LRU or just leave it for now.
    // frameCache.current = {}; 
  }, [entityId, state, direction]);

  // 3. ANIMATION TICK
  useEffect(() => {
    const animate = (time: number) => {
      if (!activeConfig) return;
      
      const frameDuration = 1000 / (activeConfig.fps || 12);
      if (!lastTimeRef.current) lastTimeRef.current = time;
      
      const delta = time - lastTimeRef.current;
      if (delta >= frameDuration) {
        setCurrentFrame(prev => {
          const next = prev + 1;
          const totalFrames = activeConfig.frameCount || 1;
          if (next >= totalFrames) {
            if (activeConfig.loop) return 0;
            onAnimationEnd?.();
            return prev;
          }
          return next;
        });
        lastTimeRef.current = time;
      }
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [activeConfig, onAnimationEnd]);

  // 4. DRAWING (MULTI-LAYER)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activeConfig) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const effectiveLayers: SpriteLayer[] = layers.length > 0 
      ? [...layers].sort((a, b) => a.priority - b.priority) 
      : basePath 
        ? [{ id: 'body', basePath, priority: 0, isVisible: true }] 
        : [];

    effectiveLayers.forEach(layer => {
      const spriteSheet = layerImages[layer.id];
      if (!spriteSheet || (layers.length > 0 && !layer.isVisible)) return;

      const layerPath = layer.basePath || basePath || "";
      const res = resolveTiphonAsset(
        entityId, 
        layerPath, 
        state, 
        direction, 
        activeConfig, 
        currentFrame,
        layer.id === 'body' ? 'Body' : layer.id
      );

      let sx = 0;
      let sy = 0;
      let sw = activeConfig.frameWidth || spriteSheet.width;
      let sh = activeConfig.frameHeight || spriteSheet.height;

      if (res.strategy === AssetStrategy.MASTER_SHEET) {
        const row = directionRows[direction] ?? 0;
        const col = currentFrame % (activeConfig.columns || 1);
        sx = col * (activeConfig.frameWidth || sw);
        sy = row * (activeConfig.frameHeight || sh);
      } 
      else if (res.strategy === AssetStrategy.ANGLE_SHEET) {
        const col = currentFrame % (activeConfig.columns || 1);
        sx = col * (activeConfig.frameWidth || sw);
        sy = 0;
      }
      else {
        sx = 0; sy = 0;
        sw = spriteSheet.width;
        sh = spriteSheet.height;
      }
      
      const dw = (activeConfig.frameWidth || sw) * scale;
      const dh = (activeConfig.frameHeight || sh) * scale;

      const targetX = (canvas.width * pivotPoint.x) - (dw * pivotPoint.x) + visualOffset.x;
      const targetY = (canvas.height * pivotPoint.y) - (dh * pivotPoint.y) + visualOffset.y;

      ctx.imageSmoothingEnabled = false;
      
      // Potential for tinting/overlay here in the future
      ctx.drawImage(
        spriteSheet,
        sx, sy, sw, sh,
        targetX, targetY, dw, dh
      );

      if (debug && layer.id === 'body') {
        ctx.strokeStyle = 'lime';
        ctx.strokeRect(targetX, targetY, dw, dh);
        ctx.fillStyle = 'red';
        ctx.beginPath();
        ctx.arc(canvas.width * pivotPoint.x, canvas.height * pivotPoint.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.font = '10px monospace';
        ctx.fillText(`${res.strategy}`, targetX, targetY - 10);
      }
    });

  }, [activeConfig, layerImages, currentFrame, direction, scale, pivotPoint, visualOffset, debug, entityId, basePath, JSON.stringify(layers), state]);

  if (!activeConfig) return null;

  const containerSizeW = (activeConfig.frameWidth || 128) * 2;
  const containerSizeH = (activeConfig.frameHeight || 128) * 2;

  return (
    <div 
      className={`tiphon-entity ${className}`}
      style={{
        width: containerSizeW,
        height: containerSizeH,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'visible',
        ...style
      }}
    >
      {Object.keys(loadErrors).length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: 10,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(50,0,0,0.8)',
          color: '#ffaaaa',
          fontSize: '9px',
          padding: '4px',
          zIndex: 100,
          pointerEvents: 'none',
          whiteSpace: 'pre',
          border: '1px solid red',
          textAlign: 'center'
        }}>
          LOAD ERRORS: {Object.keys(loadErrors).length}<br/>
          ID: {entityId}<br/>
          ST: {state}
        </div>
      )}
      <canvas
        ref={canvasRef}
        width={containerSizeW}
        height={containerSizeH}
        style={{
          position: 'absolute',
          bottom: 0,
          pointerEvents: 'none',
          imageRendering: 'pixelated',
          opacity: Object.keys(loadErrors).length > 0 && layers.length === 0 ? 0.3 : 1
        }}
      />
    </div>
  );
};
