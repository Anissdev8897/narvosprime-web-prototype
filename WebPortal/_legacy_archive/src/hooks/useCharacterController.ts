import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Orientation isométrique standard (Dofus Style)
 */
export type IsoDirection = 'SE' | 'SW' | 'NW' | 'NE' | 'S' | 'W' | 'N' | 'E';

/**
 * États d'animation type Dofus
 */
export type AnimState = 'Idle' | 'Walk' | 'Run' | 'Jump' | 'Hit' | 'Death';

interface Position {
    x: number;
    y: number;
}

export interface CharacterControl {
    visualPosition: Position;
    angle: IsoDirection;
    animation: AnimState;
    isMoving: boolean;
    updateTarget: (newX: number, newY: number) => void;
    stopMoving: () => void;
}

/**
 * Hook de contrôle de personnage "Dofus Refined"
 * Gère l'orientation 8-directions, la machine à états et l'interpolation visuelle.
 */
export function useCharacterController(
    initialPos: Position,
    moveSpeed: number = 2.5, // Vitesse de base pour le Lerp
    canMove?: (nx: number, ny: number) => boolean // Callback de collision
): CharacterControl {
    const [visualPos, setVisualPos] = useState<Position>(initialPos);
    const [angle, setAngle] = useState<IsoDirection>('SE');
    const [animation, setAnimation] = useState<AnimState>('Idle');
    const [isMoving, setIsMoving] = useState(false);

    const targetPosRef = useRef<Position>(initialPos);
    const lastTickRef = useRef<number>(0);
    const rafRef = useRef<number>(0);

    // Track visualPos in a ref for the R.A.F logic to avoid closure staleness
    const visualPosRef = useRef<Position>(initialPos);

    /**
     * Calcul de l'angle isométrique (8 directions)
     * Basé sur un axe Sud = 0° (Clockwise)
     */
    const getAngleFromVector = (dx: number, dy: number): IsoDirection => {
        const radians = Math.atan2(dy, dx);
        let degrees = (radians * 180) / Math.PI;
        
        // On aligne 0 sur le SUD. Par défaut atan2(y,x) a 0 sur l'EST.
        // On effectue une soustraction (90 - deg) pour pivoter de 90° et inverser.
        let finalDegrees = (90 - degrees + 360) % 360;

        // Snapping sur les 8 directions (45° per slice)
        // 0 -> S
        // 45 -> SE
        // 90 -> E
        // 135 -> NE
        // 180 -> N
        // 225 -> NW
        // 270 -> W
        // 315 -> SW
        const snapped = Math.round(finalDegrees / 45) * 45;
        const normalized = snapped % 360;

        const map: Record<number, IsoDirection> = {
            0: 'S', 45: 'SE', 90: 'E', 135: 'NE',
            180: 'N', 225: 'NW', 270: 'W', 315: 'SW',
            360: 'S'
        };

        return map[normalized] || 'SE';
    };

    const updateTarget = useCallback((nx: number, ny: number) => {
        targetPosRef.current = { x: nx, y: ny };
        setIsMoving(true);
    }, []);

    const stopMoving = useCallback(() => {
        setIsMoving(false);
        setAnimation('Idle');
    }, []);

    // Refs are the "truth" for the high-frequency loop to avoid re-running the effect
    const isMovingRef = useRef(isMoving);
    const animationRef = useRef<AnimState>(animation);
    const moveSpeedRef = useRef(moveSpeed);

    useEffect(() => { isMovingRef.current = isMoving; }, [isMoving]);
    useEffect(() => { animationRef.current = animation; }, [animation]);
    useEffect(() => { moveSpeedRef.current = moveSpeed; }, [moveSpeed]);

    // Main Visual Loop (Visual Lerp + Collisions)
    useEffect(() => {
        const tick = (time: number) => {
            if (!lastTickRef.current) lastTickRef.current = time;
            const deltaTime = (time - lastTickRef.current) / 1000;
            lastTickRef.current = time;

            if (isMovingRef.current) {
                const currentPos = visualPosRef.current;
                const dx = targetPosRef.current.x - currentPos.x;
                const dy = targetPosRef.current.y - currentPos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance > 0.1) {
                    // 1. Orientation
                    const newAngle = getAngleFromVector(dx, dy);
                    setAngle(prev => prev !== newAngle ? newAngle : prev);

                    // 2. Animation state
                    const newAnim = distance > 5 ? 'Run' : 'Walk';
                    if (animationRef.current !== newAnim) {
                        setAnimation(newAnim);
                    }

                    // 3. Speed calculation
                    const currentSpeed = (animationRef.current === 'Run') ? moveSpeedRef.current * 3 : moveSpeedRef.current;
                    const moveAmount = currentSpeed * deltaTime * 10;
                    
                    const ratio = Math.min(distance, moveAmount) / distance;
                    let nextX = currentPos.x + (dx * ratio);
                    let nextY = currentPos.y + (dy * ratio);

                    // 4. Collision checking with sliding
                    if (canMove) {
                        if (!canMove(nextX, nextY)) {
                            if (canMove(nextX, currentPos.y)) nextY = currentPos.y;
                            else if (canMove(currentPos.x, nextY)) nextX = currentPos.x;
                            else { nextX = currentPos.x; nextY = currentPos.y; }
                        }
                    }

                    if (nextX !== currentPos.x || nextY !== currentPos.y) {
                        visualPosRef.current = { x: nextX, y: nextY };
                        setVisualPos({ x: nextX, y: nextY });
                    } else if (distance < 0.5) {
                        stopMoving();
                    }
                } else {
                    stopMoving();
                }
            }

            rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, [canMove, stopMoving]); // Only depend on stable callbacks

    return {
        visualPosition: visualPos,
        angle,
        animation,
        isMoving,
        updateTarget,
        stopMoving
    };
}
