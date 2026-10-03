
import * as THREE from 'three';
import { PlayerEntity, EntityType, CameraMode, SceneMode } from '../types';
import { PlayerMovement } from '../services/PlayerMovement';
import { CAMERA_PROFILES } from '../constants';

/**
 * Système de Physique Tactique (Physics System)
 * Gère le mouvement et la caméra pour la version Dofus-style
 */
export class PhysicsSystem {
    private playerMovement: PlayerMovement;
    private collisionRaycaster: THREE.Raycaster;

    constructor(
        camera: THREE.Camera,
        playerMovement: PlayerMovement
    ) {
        this.playerMovement = playerMovement;
        this.collisionRaycaster = new THREE.Raycaster();
    }

    public updateGroundMovement(
        player: PlayerEntity,
        playerMesh: THREE.Object3D,
        camera: THREE.Camera,
        keys: Set<string>,
        delta: number,
        interactables: THREE.Object3D[],
        cameraMode: CameraMode
    ): void {
        // En mode tactique ISO, le yaw est fixe à 45° pour les calculs WASD
        const cameraYaw = Math.PI / 4;

        // Mise à jour du mouvement (Clavier + Target)
        this.playerMovement.update(delta, keys, cameraYaw);

        const newPos = this.playerMovement.getPosition();
        player.position.x = newPos.x;
        player.position.y = newPos.y;
        player.position.z = newPos.z;

        playerMesh.position.copy(newPos);

        // Orientation du personnage vers la vélocité
        const velocity = this.playerMovement.getVelocity();
        if (velocity.lengthSq() > 0.01) {
            const angle = Math.atan2(velocity.x, velocity.z);
            playerMesh.rotation.y = angle;
            player.rotation = angle;
        }
    }

    public applyCamera(camera: THREE.Camera, playerPos: THREE.Vector3, mode: CameraMode): void {
        // 🎮 MODE DOFUS 2D: Caméra fixe centrée sur la map (Screen-by-Screen)
        if (mode === CameraMode.DOFUS_2D) {
            // Dans Dofus, la caméra est fixe et alignée parfaitement avec le fond
            // Pour simuler une vue 2D Dofus avec une caméra Perspective Three.js :
            // 1. On positionne la caméra très haut ou très loin en Z
            // 2. On regarde le centre (0,0,0)

            // Note: Normalement on utiliserait une OrthographicCamera, 
            // mais pour garder la compatibilité avec le reste du moteur 3D, on triche avec la perspective.

            // Position idéale pour voir la map à plat (qui est rendue sur le plan XZ à Y=0)
            // On se place à la verticale (High Y) mais avec le décalage Isométrique si nécessaire.

            // En mode "FULLMAP_IMAGE", la map est une image plane à Y=0.
            // On veut la voir d'en haut (Top-Down) pour qu'elle remplisse l'écran.

            const MAP_CENTER_X = 0;
            const MAP_CENTER_Z = 0;

            // Distance fixe
            camera.position.set(MAP_CENTER_X, 100, MAP_CENTER_Z + 0.1); // +0.1 Z pour orienter le "Up" vecteur correctement
            camera.lookAt(MAP_CENTER_X, 0, MAP_CENTER_Z);

            // Ajustement du Zoom/FOV si c'est une PerspectiveCamera (Hack)
            if (camera instanceof THREE.PerspectiveCamera) {
                // Un petit FOV avec une grande distance "aplatit" la perspective (effet téléobjectif)
                // camera.fov = 10; 
                // camera.updateProjectionMatrix();
                // (Note: Modifier le FOV à chaque frame est coûteux et peut causer des glitchs, 
                // on suppose que SetupCamera le fait ou que la distance suffit).
            }
            return;
        }

        // Mode TACTICAL_ISO standard (suit le joueur)
        const profile = CAMERA_PROFILES.TACTICAL_ISO;
        if (!profile) return;

        // Vue isométrique: caméra au-dessus et en arrière du joueur
        const distance = profile.distance;
        const height = profile.height;

        // Position: légèrement en diagonale pour l'effet ISO
        camera.position.set(
            playerPos.x + distance * 0.3,
            playerPos.y + height,
            playerPos.z + distance * 0.3
        );

        // Regarder le joueur
        camera.lookAt(playerPos.x, playerPos.y, playerPos.z);
    }

    public teleport(position: THREE.Vector3): void {
        this.playerMovement.setPosition(position);
        this.playerMovement.resetVelocity();
    }

    public setNoclipMode(enabled: boolean): void {
        this.playerMovement.setNoclipMode(enabled);
    }

    public isNoclipMode(): boolean {
        return this.playerMovement.isNoclipMode();
    }
}
