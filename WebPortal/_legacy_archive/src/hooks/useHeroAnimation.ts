import { useState, useEffect, useRef } from 'react';

interface Position {
    x: number;
    y: number;
}

export type HeroAction = 'Idle_Stand' | 'Walk_Front' | 'Walk_Back' | 'Run_Front' | 'Run_Back' | 'Attack_01' | 'Death';

export interface HeroAnimationData {
    action: HeroAction;
    angle: string; // "000", "045", etc.
    spritePath: string;
}

export function useHeroAnimation(
    currentPos: Position,
    targetPos: Position,
    basePath: string = '/textures/new_asset/asset_principal/hero/Assembled_Shadow_Optimized_Spritesheets/x180p_Spritesheets'
): HeroAnimationData {
    const [action, setAction] = useState<HeroAction>('Idle_Stand');
    const [angle, setAngle] = useState<string>('180');
    const prevPosRef = useRef<Position>(currentPos);

    useEffect(() => {
        const dx = currentPos.x - prevPosRef.current.x;
        const dy = currentPos.y - prevPosRef.current.y;
        const velocity = Math.sqrt(dx * dx + dy * dy);

        // Movement detection (small threshold to avoid jitter)
        const isMoving = velocity > 0.001;
        
        // Calculate angle between current and target
        const tDx = targetPos.x - currentPos.x;
        const tDy = targetPos.y - currentPos.y;
        
        let visualAngle = parseInt(angle, 10); // Maintain previous angle by default

        if (isMoving || Math.abs(tDx) > 0.1 || Math.abs(tDy) > 0.1) {
            // atan2 returns radians between -PI and PI. 
            // In screen coordinates: Y increases downwards.
            // Angle 0 is East (Right), 90 is South (Down), 180 is West (Left), 270 is North (Up)
            const radians = Math.atan2(tDy, tDx);
            let degrees = (radians * 180) / Math.PI + 90; // Rotate so 0 is South
            
            // Normalize to 0-360
            degrees = ((degrees % 360) + 360) % 360;
            
            // Snap to nearest 45
            visualAngle = 45 * Math.round(degrees / 45);
            visualAngle = visualAngle % 360;
            setAngle(String(visualAngle).padStart(3, '0'));
        }

        // Determine Action
        let currentAction: HeroAction = 'Idle_Stand';
        if (isMoving) {
            // South directions (Front): 45, 90, 135, and maybe 0/180
            // North directions (Back): 225, 270, 315
            const isBack = visualAngle > 200 && visualAngle < 340;
            const isRunning = velocity > 0.15; // Threshold for Run vs Walk

            if (isRunning) {
                currentAction = isBack ? 'Run_Back' : 'Run_Front';
            } else {
                currentAction = isBack ? 'Walk_Back' : 'Walk_Front';
            }
        } else {
            currentAction = 'Idle_Stand';
        }

        setAction(currentAction);
        prevPosRef.current = currentPos;
    }, [currentPos.x, currentPos.y, targetPos.x, targetPos.y]);

    // Build the dynamic path based on action and angle
    // Note: Idle_Stand folder contains Idle_Stand_Body_xxx.png
    const spritePath = `${basePath}/${action}/${action}_Body_${angle}.png`;

    return { action, angle, spritePath };
}
