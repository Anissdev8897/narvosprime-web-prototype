
export enum AssetStrategy {
  MASTER_SHEET = 'MASTER_SHEET',
  ANGLE_SHEET = 'ANGLE_SHEET',
  FRAME_FILE = 'FRAME_FILE'
}

export interface TiphonAssetResolution {
  path: string;
  strategy: AssetStrategy;
  frameCount: number;
  columns: number;
  rows: number;
  isV4: boolean;
}

/**
 * THE ABSOLUTE DEFINITIVE TIPHON RESOLVER (Narvos Prime V4)
 * Based on deep terminal verification of all character classes.
 */
export const resolveTiphonAsset = (
  entityId: string,
  basePath: string,
  state: string,
  direction: string,
  currentConfig: any,
  currentFrame: number = 0,
  layerId: string = 'Body'
): TiphonAssetResolution => {
  const id = entityId.toLowerCase();
  
  // Angle mapping for 8/16-directional isometric
  const dirAngleMap: Record<string, string> = {
    'S': '000', 'SE': '045', 'E': '090', 'NE': '135',
    'N': '180', 'NW': '225', 'W': '270', 'SW': '315'
  };
  const angle = dirAngleMap[direction] || '045';

  const side = (direction.includes('E') || direction === 'S' || direction === 'SE') ? 'R' : 'L';
  const sideName = side === 'R' ? 'Right' : 'Left';

  let finalPath = '';
  let finalStrategy = AssetStrategy.MASTER_SHEET;
  let finalFrameCount = currentConfig?.frameCount || 12;
  let finalCols = currentConfig?.columns || 1;
  let finalRows = currentConfig?.rows || 1;
  let isV4Asset = false;

  // 1. Knight Man (Prefix Frame-Files, 0-indexed)
  if (id.includes('knight_man')) {
    const frameIdx = String(currentFrame).padStart(4, '0');
    const knightState = `${side}_${state}`;
    finalPath = `${basePath}/Animations_Frames_256x256/${knightState}/${knightState}_${frameIdx}.png`;
    finalStrategy = AssetStrategy.FRAME_FILE;
    isV4Asset = true;
  }
  // 2. Knight Girl (Side-Folders, 1-indexed)
  else if (id.includes('knight_girl')) {
    const frameIdx = String(currentFrame + 1).padStart(4, '0');
    finalPath = `${basePath}/256x256/${state}/${sideName}/${state}_${frameIdx}.png`;
    finalStrategy = AssetStrategy.FRAME_FILE;
    isV4Asset = true;
  }
  // 3. Thief (Simple Frame-Files, 1-indexed)
  else if (id.includes('thief')) {
    const frameIdx = String(currentFrame + 1).padStart(4, '0');
    finalPath = `${basePath}/256x256/${state}/${state}_${frameIdx}.png`;
    finalStrategy = AssetStrategy.FRAME_FILE;
    isV4Asset = true;
  }
  // 4. HalberdWarrior (Deeply Nested Frame-Files, 0-indexed)
  else if (id.includes('halberd') || id.includes('warrior')) {
    const frameIdx = String(currentFrame).padStart(4, '0');
    finalPath = `${basePath}/256x256/${state}/${layerId}/${angle}/${state}_${layerId}_${angle}_${frameIdx}.png`;
    finalStrategy = AssetStrategy.FRAME_FILE;
    isV4Asset = true;
  }
  // 5. Prototyping Hero (Specific 180p structure)
  else if (id.includes('hero') || id.includes('prototyping')) {
    let prototypeFolder = 'Idle_Unarmed';
    if (state.includes('Walk')) prototypeFolder = 'WalkForward_Unarmed';
    else if (state.includes('Run')) prototypeFolder = 'Run_Unarmed';
    else if (state.includes('Jump')) prototypeFolder = 'Jump_Unarmed';
    else if (state.includes('Hit')) prototypeFolder = 'Hit_Unarmed';
    else if (state.includes('Die') || state.includes('Death')) prototypeFolder = 'Death_Unarmed';
    else if (state.includes('Attack')) prototypeFolder = 'Attack_Unarmed_01';
    
    finalPath = `${basePath}/x180p_Spritesheets/${prototypeFolder}/${prototypeFolder}_${layerId}_${angle}.png`;
    finalStrategy = AssetStrategy.ANGLE_SHEET;
    isV4Asset = true;
  }
  // 6. Assembled / Shadow (Optimized 320p structure)
  else if (id.includes('assembled') || id.includes('shadow')) {
    let shadowFolder = 'Idle_Stand';
    if (state.includes('Walk')) shadowFolder = 'Walk_Forward';
    else if (state.includes('Run')) shadowFolder = 'Run_Forward';
    else if (state.includes('Jump')) shadowFolder = 'Jump_Run';
    else if (state.includes('Hit')) shadowFolder = 'Hit_Stand';
    else if (state.includes('Die') || state.includes('Death')) shadowFolder = 'Death_Stand';
    else if (state.includes('Attack')) shadowFolder = 'Attack_01_Stand';
    
    finalPath = `${basePath}/x320p_Spritesheets/${shadowFolder}/${shadowFolder}_${layerId}_${angle}.png`;
    finalStrategy = AssetStrategy.ANGLE_SHEET;
    isV4Asset = true;
  }
  // Fallback
  else {
    finalPath = `${basePath}/${state}.png`;
    finalStrategy = AssetStrategy.MASTER_SHEET;
  }

  const cleanPath = finalPath.replace(/\/\//g, '/');
  
  return {
    path: encodeURI(cleanPath),
    strategy: finalStrategy,
    frameCount: finalFrameCount,
    columns: finalCols,
    rows: finalRows,
    isV4: isV4Asset
  };
};
