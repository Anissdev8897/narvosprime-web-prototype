
import * as THREE from 'three';
import { CAMERA_PROFILES } from '../constants';

export class CameraSystem {
    // Spherical coordinates
    public radius: number = 15;
    public theta: number = 0; // Horizontal angle
    public phi: number = Math.PI / 3; // Vertical angle (polar)

    // Smoothing
    private currentPosition: THREE.Vector3 = new THREE.Vector3();
    private currentLookAt: THREE.Vector3 = new THREE.Vector3();
    private smoothingFactor: number = 0.1;

    constructor() {
        this.theta = 0;
        this.phi = Math.PI / 3;
        this.radius = 15;
    }

    public handleInput(deltaX: number, deltaY: number, sensitivity: number = 0.005) {
        this.theta -= deltaX * sensitivity;
        this.phi += deltaY * sensitivity;

        // Clamp vertical angle to avoid flipping
        // Using standard constraints generally good for TPS
        const minPolarAngle = 0.1;
        const maxPolarAngle = Math.PI - 0.1;
        this.phi = Math.max(minPolarAngle, Math.min(maxPolarAngle, this.phi));
    }

    public getForwardVector(): THREE.Vector3 {
        // Direction the camera is looking, projected onto XZ plane for movement
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.theta);
        return forward.normalize();
    }

    public update(camera: THREE.PerspectiveCamera, targetPosition: THREE.Vector3, dt: number) {
        // Calculate ideal position based on spherical coords
        // x = r * sin(phi) * sin(theta)
        // y = r * cos(phi)
        // z = r * sin(phi) * cos(theta)

        const offset = new THREE.Vector3();
        offset.x = this.radius * Math.sin(this.phi) * Math.sin(this.theta);
        offset.y = this.radius * Math.cos(this.phi);
        offset.z = this.radius * Math.sin(this.phi) * Math.cos(this.theta);

        const idealPosition = targetPosition.clone().add(offset);

        // Smooth camera movement
        this.currentPosition.lerp(idealPosition, 1.0 - Math.pow(0.001, dt)); // Frame-rate independent smoothing

        camera.position.copy(this.currentPosition);
        camera.lookAt(targetPosition);
    }
}
