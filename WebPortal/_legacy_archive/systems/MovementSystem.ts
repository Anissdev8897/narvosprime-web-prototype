
import * as THREE from 'three';

export class MovementSystem {
    public velocity: THREE.Vector3 = new THREE.Vector3();
    public maxSpeed: number = 10;
    public acceleration: number = 50;
    public deceleration: number = 10;
    public rotationSmoothing: number = 10;

    public reset() {
        this.velocity.set(0, 0, 0);
    }

    public update(
        inputState: { forward: boolean; backward: boolean; left: boolean; right: boolean; sprint: boolean },
        cameraForward: THREE.Vector3,
        dt: number
    ): { moveVector: THREE.Vector3; rotation: number | null } {

        // 1. Calculate input direction relative to camera
        const direction = new THREE.Vector3();
        const right = new THREE.Vector3().crossVectors(cameraForward, new THREE.Vector3(0, 1, 0)).normalize();

        if (inputState.forward) direction.add(cameraForward);
        if (inputState.backward) direction.sub(cameraForward);
        if (inputState.right) direction.add(right);
        if (inputState.left) direction.sub(right);

        // Normalize input direction
        if (direction.lengthSq() > 0) {
            direction.normalize();
        }

        // 2. Sprint modifier
        const targetSpeed = inputState.sprint ? this.maxSpeed * 1.8 : this.maxSpeed;

        // 3. Apply physics-like movement (simple velocity integration)
        // If we have input, accelerate towards that direction
        if (direction.lengthSq() > 0) {
            this.velocity.x += direction.x * this.acceleration * dt;
            this.velocity.z += direction.z * this.acceleration * dt;
        } else {
            // Decelerate if no input
            const dampFactor = 1 - Math.exp(-this.deceleration * dt);
            this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, 0, dampFactor);
            this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, 0, dampFactor);
        }

        // Clamp horizontal velocity to max speed
        const currentSpeedSq = this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z;
        if (currentSpeedSq > targetSpeed * targetSpeed) {
            const scale = targetSpeed / Math.sqrt(currentSpeedSq);
            this.velocity.x *= scale;
            this.velocity.z *= scale;
        }

        // 4. Calculate proposed move vector
        const moveVector = new THREE.Vector3(this.velocity.x * dt, 0, this.velocity.z * dt);

        // 5. Calculate target rotation
        let rotation: number | null = null;
        // Only rotate if we are actually moving significantly
        if (direction.lengthSq() > 0.1) {
            rotation = Math.atan2(direction.x, direction.z);
        }

        return { moveVector, rotation };
    }
}
