/**
 * NARVOS PRIME - Character Animation Manager
 * Centralizes the management of 8-directional character animations from extracted sprites.
 */

export enum AnimationState {
    IDLE = 'IDLE',
    RUN = 'RUN',
    ATTACK = 'ATTACK',
    HIT = 'HIT',
    DEATH = 'DEATH'
}

export type Direction8 = 
    | 'S'   // 0: South
    | 'SW'  // 1: South-West
    | 'W'   // 2: West
    | 'NW'  // 3: North-West
    | 'N'   // 4: North
    | 'NE'  // 5: North-East
    | 'E'   // 6: East
    | 'SE'; // 7: South-East

export const DIRECTION_TO_INDEX: Record<Direction8, number> = {
    'S':  0,
    'SW': 1,
    'W':  2,
    'NW': 3,
    'N':  4,
    'NE': 5,
    'E':  6,
    'SE': 7
};

// Maps animation state to the frame offset (0-3) within a direction's block.
// Each direction block has 4 frames.
export const ANIMATION_FRAMES: Record<AnimationState, number[]> = {
    [AnimationState.IDLE]: [0],
    [AnimationState.RUN]: [1, 2, 3, 2, 1, 0], // Smooth run loop using available 4 frames
    [AnimationState.ATTACK]: [3], // Use the final frame for attack/impact
    [AnimationState.HIT]: [0, 1, 0], // Quick flinch
    [AnimationState.DEATH]: [0, 1, 2, 3] // Use all frames for death sequence (placeholder)
};

export interface CharacterAssetConfig {
    classId: string;
    gender: 'M' | 'F';
    basePath: string; // e.g., '/textures/personnage_extracted/bio_scout_male'
}

class CharacterAnimationManager {
    /**
     * Get the relative path of a specific frame for a character.
     */
    getFrameUrl(config: CharacterAssetConfig, state: AnimationState, direction: Direction8, frameIndex: number): string {
        const dirIndex = DIRECTION_TO_INDEX[direction];
        const frames = ANIMATION_FRAMES[state];
        const localFrameOffset = frames[frameIndex % frames.length];
        
        // Final frame ID (sXXX.png)
        // dirIndex 0 (S) -> frames 0, 1, 2, 3
        // dirIndex 1 (SW) -> frames 4, 5, 6, 7
        const finalId = dirIndex * 4 + localFrameOffset;
        const paddedId = finalId.toString().padStart(3, '0');
        
        return `${config.basePath}/s${paddedId}.png`;
    }

    /**
     * Map a tactical orientation (target - source) to one of the 8 directions.
     */
    getDirectionFromDiff(dx: number, dy: number): Direction8 {
        if (dx > 0 && dy === 0) return 'E';
        if (dx < 0 && dy === 0) return 'W';
        if (dx === 0 && dy > 0) return 'S';
        if (dx === 0 && dy < 0) return 'N';
        if (dx > 0 && dy > 0) return 'SE';
        if (dx < 0 && dy > 0) return 'SW';
        if (dx > 0 && dy < 0) return 'NE';
        if (dx < 0 && dy < 0) return 'NW';
        return 'S'; // Default
    }

    /**
     * Helper to get animation duration in frames for a state.
     */
    getFrameCount(state: AnimationState): number {
        return ANIMATION_FRAMES[state].length;
    }
}

export const animationManager = new CharacterAnimationManager();
export default animationManager;
