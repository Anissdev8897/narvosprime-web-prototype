import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { SceneMode } from '../../types';

// Editor Systems
import { EditorSelectionManager } from '../../services/editor/EditorSelectionManager';
import { MeshEditSubsystem } from '../../services/editor/MeshEditSubsystem';
import { GizmoController } from '../../services/editor/GizmoController';
import { EditorToolsManager } from '../../services/editor/EditorToolsManager';

// Core Systems
import { PhysicsSystem } from '../../core/PhysicsSystem';
import { CombatSystem } from '../../core/CombatSystem';
import { AISystem } from '../../core/AISystem';
import { GameStateManager } from '../../core/GameStateManager';
import { TeleportationSystem } from '../../core/TeleportationSystem';
import { PlayerMovement } from '../../services/PlayerMovement';
import { PlayerCameraController } from '../../services/PlayerCameraController';

interface UseSceneSetupProps {
    containerRef: React.RefObject<HTMLDivElement>;
    sceneMode: SceneMode;
    onDeletedObject: (id: string) => void;
    onSaveScene: () => Promise<void>;
    playerMovement: React.MutableRefObject<PlayerMovement | null>;
    playerCameraController: React.MutableRefObject<PlayerCameraController | null>;
    pointerLockManager: React.MutableRefObject<any>;
}

interface UseSceneSetupReturn {
    sceneRef: React.MutableRefObject<THREE.Scene | null>;
    cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>;
    rendererRef: React.MutableRefObject<THREE.WebGLRenderer | null>;
    topCameraRef: React.MutableRefObject<THREE.OrthographicCamera | null>;
    frontCameraRef: React.MutableRefObject<THREE.OrthographicCamera | null>;
    sideCameraRef: React.MutableRefObject<THREE.OrthographicCamera | null>;
    transformControlsRef: React.MutableRefObject<TransformControls | null>;
    gizmoControllerRef: React.MutableRefObject<GizmoController | null>;
    editorSelectionManagerRef: React.MutableRefObject<EditorSelectionManager | null>;
    editorToolsManagerRef: React.MutableRefObject<EditorToolsManager | null>;
    meshEditSubsystemRef: React.MutableRefObject<MeshEditSubsystem | null>;
    physicsSystemRef: React.MutableRefObject<PhysicsSystem | null>;
    combatSystemRef: React.MutableRefObject<CombatSystem | null>;
    aiSystemRef: React.MutableRefObject<AISystem | null>;
    gameStateManagerRef: React.MutableRefObject<GameStateManager | null>;
    teleportationSystemRef: React.MutableRefObject<TeleportationSystem | null>;
    isTransformControlsDraggingRef: React.MutableRefObject<boolean>;
}

export const useSceneSetup = ({
    containerRef,
    sceneMode,
    onDeletedObject,
    onSaveScene,
    playerMovement,
    playerCameraController,
    pointerLockManager
}: UseSceneSetupProps): UseSceneSetupReturn => {
    // Three.js Core Refs
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

    // Editor Cameras
    const topCameraRef = useRef<THREE.OrthographicCamera | null>(null);
    const frontCameraRef = useRef<THREE.OrthographicCamera | null>(null);
    const sideCameraRef = useRef<THREE.OrthographicCamera | null>(null);

    // Editor Systems
    const transformControlsRef = useRef<TransformControls | null>(null);
    const gizmoControllerRef = useRef<GizmoController | null>(null);
    const editorSelectionManagerRef = useRef<EditorSelectionManager | null>(null);
    const editorToolsManagerRef = useRef<EditorToolsManager | null>(null);
    const meshEditSubsystemRef = useRef<MeshEditSubsystem | null>(null);
    const isTransformControlsDraggingRef = useRef<boolean>(false);

    // Game Systems
    const physicsSystemRef = useRef<PhysicsSystem | null>(null);
    const combatSystemRef = useRef<CombatSystem | null>(null);
    const aiSystemRef = useRef<AISystem | null>(null);
    const gameStateManagerRef = useRef<GameStateManager | null>(null);
    const teleportationSystemRef = useRef<TeleportationSystem | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        // 1. Create Scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x111827); // Dark blue-gray
        sceneRef.current = scene;

        // 2. Create Main Camera (Perspective)
        const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 20000);
        if (sceneMode === SceneMode.HUB) {
            camera.position.set(0, 5, 10);
            camera.lookAt(0, 0, 0);
        } else {
            camera.position.set(0, 5, 10);
        }
        cameraRef.current = camera;

        // 3. Create Editor Cameras (Orthographic for multi-view)
        const aspect = window.innerWidth / window.innerHeight;
        const frustumSize = 20;

        // Top View (XZ)
        const topCam = new THREE.OrthographicCamera(
            frustumSize * aspect / -2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / -2, 1, 1000
        );
        topCam.position.set(0, 50, 0);
        topCam.lookAt(0, 0, 0);
        topCam.up.set(0, 0, -1);
        topCameraRef.current = topCam;

        // Front View (XY)
        const frontCam = new THREE.OrthographicCamera(
            frustumSize * aspect / -2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / -2, 1, 1000
        );
        frontCam.position.set(0, 0, 50);
        frontCam.lookAt(0, 0, 0);
        frontCameraRef.current = frontCam;

        // Side View (ZY)
        const sideCam = new THREE.OrthographicCamera(
            frustumSize * aspect / -2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / -2, 1, 1000
        );
        sideCam.position.set(50, 0, 0);
        sideCam.lookAt(0, 0, 0);
        sideCameraRef.current = sideCam;

        // 4. Create Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.domElement.style.pointerEvents = 'auto';
        renderer.domElement.style.touchAction = 'none';
        renderer.domElement.style.userSelect = 'none';
        rendererRef.current = renderer;
        containerRef.current.appendChild(renderer.domElement);

        // 5. Initialize Editor Systems
        try {
            const selectionManager = new EditorSelectionManager(scene);
            editorSelectionManagerRef.current = selectionManager;

            const meshEditSubsystem = new MeshEditSubsystem(selectionManager);
            meshEditSubsystemRef.current = meshEditSubsystem;

            const gizmoController = new GizmoController(scene, camera, renderer);
            gizmoControllerRef.current = gizmoController;

            const toolsManager = new EditorToolsManager(
                gizmoController,
                selectionManager,
                meshEditSubsystem,
                scene,
                onDeletedObject
            );
            editorToolsManagerRef.current = toolsManager;

            const oldTransformControls = gizmoController.getTransformControls();
            if (oldTransformControls) {
                transformControlsRef.current = oldTransformControls;
            }

            console.log('✅ [SCENE SETUP] Editor systems initialized');
        } catch (error) {
            console.error('❌ [SCENE SETUP] Editor init error:', error);
        }

        // 6. Initialize TransformControls (Legacy Gizmo)
        try {
            const transformControls = new TransformControls(camera, renderer.domElement);
            transformControls.setMode('translate');
            transformControls.setSpace('world');
            transformControls.enabled = false;
            transformControls.setSize(0.5);

            const controlsAsObject3D = transformControls as unknown as THREE.Object3D;
            controlsAsObject3D.userData.type = 'TRANSFORM_CONTROLS';

            transformControls.addEventListener('dragging-changed', (event) => {
                isTransformControlsDraggingRef.current = event.value as boolean;
                if (event.value) {
                    if (pointerLockManager.current && document.pointerLockElement) {
                        document.exitPointerLock();
                    }
                } else {
                    setTimeout(async () => { await onSaveScene(); }, 500);
                }
            });

            scene.add(transformControls as any);
            if (!transformControlsRef.current) {
                transformControlsRef.current = transformControls;
            }

            console.log('✅ [SCENE SETUP] TransformControls initialized');
        } catch (error) {
            console.error('❌ [SCENE SETUP] TransformControls init error:', error);
        }

        // 7. Initialize Game Systems
        combatSystemRef.current = new CombatSystem(scene);
        gameStateManagerRef.current = new GameStateManager();
        aiSystemRef.current = new AISystem(scene);

        if (playerMovement.current && playerCameraController.current) {
            teleportationSystemRef.current = new TeleportationSystem(
                scene,
                playerMovement.current,
                playerCameraController.current
            );
        }

        if (cameraRef.current && playerMovement.current) {
            physicsSystemRef.current = new PhysicsSystem(
                cameraRef.current,
                playerMovement.current
            );
        }

        console.log('✅ [SCENE SETUP] All systems initialized');

        // 8. Handle Resize
        const handleResize = () => {
            if (!cameraRef.current || !rendererRef.current) return;
            const width = window.innerWidth;
            const height = window.innerHeight;
            cameraRef.current.aspect = width / height;
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setSize(width, height);
        };
        window.addEventListener('resize', handleResize);

        // 9. Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
            if (rendererRef.current && containerRef.current) {
                containerRef.current.removeChild(rendererRef.current.domElement);
                rendererRef.current.dispose();
            }
            if (transformControlsRef.current) {
                transformControlsRef.current.dispose();
            }
            console.log('🧹 [SCENE SETUP] Cleanup complete');
        };
    }, [containerRef, sceneMode]); // Dependencies

    return {
        sceneRef,
        cameraRef,
        rendererRef,
        topCameraRef,
        frontCameraRef,
        sideCameraRef,
        transformControlsRef,
        gizmoControllerRef,
        editorSelectionManagerRef,
        editorToolsManagerRef,
        meshEditSubsystemRef,
        physicsSystemRef,
        combatSystemRef,
        aiSystemRef,
        gameStateManagerRef,
        teleportationSystemRef,
        isTransformControlsDraggingRef
    };
};
