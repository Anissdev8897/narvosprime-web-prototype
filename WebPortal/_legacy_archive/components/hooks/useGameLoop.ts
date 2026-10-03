
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { SceneMode, Faction, EntityType, CameraMode } from '../../types';
import { PhysicsSystem } from '../../core/PhysicsSystem';
import { CombatSystem } from '../../core/CombatSystem';
import { AISystem } from '../../core/AISystem';
import { WorldGenerator } from '../../core/WorldGenerator';

interface UseGameLoopProps {
    rendererRef: React.MutableRefObject<THREE.WebGLRenderer | null>;
    sceneRef: React.MutableRefObject<THREE.Scene | null>;
    cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>;
    physicsSystemRef: React.MutableRefObject<PhysicsSystem | null>;
    combatSystemRef: React.MutableRefObject<CombatSystem | null>;
    aiSystemRef: React.MutableRefObject<AISystem | null>;
    worldGeneratorRef: React.MutableRefObject<WorldGenerator | null>;
    playerRef: React.MutableRefObject<any>;
    playerMeshRef: React.MutableRefObject<THREE.Object3D | null>;
    monstersRef: React.MutableRefObject<any[]>;
    entitiesRef: React.MutableRefObject<THREE.Object3D[]>;
    interactablesRef: React.MutableRefObject<THREE.Object3D[]>;
    clockRef: React.MutableRefObject<THREE.Clock>;
    keysRef: React.MutableRefObject<Set<string>>;
    sceneMode: SceneMode;
    isPaused: boolean;
    isTransitioning: boolean;
    activePlanetId: string | null;
    cameraMode: CameraMode;
}

export const useGameLoop = ({
    rendererRef,
    sceneRef,
    cameraRef,
    physicsSystemRef,
    combatSystemRef,
    aiSystemRef,
    playerRef,
    playerMeshRef,
    monstersRef,
    entitiesRef,
    interactablesRef,
    clockRef,
    keysRef,
    isPaused,
    cameraMode,
}: UseGameLoopProps) => {

    useEffect(() => {
        const animate = () => {
            const delta = clockRef.current.getDelta();

            if (rendererRef.current && sceneRef.current && cameraRef.current) {
                // Rendu simple
                rendererRef.current.render(sceneRef.current, cameraRef.current);
            }

            if (!isPaused) {
                // IA
                if (aiSystemRef.current && monstersRef.current.length > 0) {
                    aiSystemRef.current.updateAI(
                        monstersRef.current,
                        playerRef.current,
                        playerMeshRef.current,
                        'hub'
                    );
                }

                // Physique et Mouvement
                if (physicsSystemRef.current && playerMeshRef.current && cameraRef.current) {
                    physicsSystemRef.current.updateGroundMovement(
                        playerRef.current,
                        playerMeshRef.current,
                        cameraRef.current,
                        keysRef.current,
                        delta,
                        interactablesRef.current,
                        cameraMode
                    );

                    // Caméra ISO
                    physicsSystemRef.current.applyCamera(
                        cameraRef.current,
                        playerMeshRef.current.position,
                        cameraMode
                    );
                }

                // Animations (Si présentes)
                if (playerRef.current.mixer) {
                    playerRef.current.mixer.update(delta);
                }
            }
        };

        if (rendererRef.current) {
            rendererRef.current.setAnimationLoop(animate);
        }

        return () => {
            if (rendererRef.current) {
                rendererRef.current.setAnimationLoop(null);
            }
        };
    }, [isPaused, cameraMode, rendererRef]);
};
