import * as THREE from 'three';

/**
 * Service de mouvement du joueur (Dofus-style)
 * Gère les déplacements clavier (WASD) et souris (Navigation par clic)
 */
export class PlayerMovement {
    private position: THREE.Vector3;
    private velocity: THREE.Vector3;
    private targetPosition: THREE.Vector3 | null = null;
    private friction: number = 0.9;
    private acceleration: number = 2.0;
    private maxSpeed: number = 0.5;
    private noclip: boolean = false;
    private path: THREE.Vector3[] = [];
    private currentPathIndex: number = 0;

    constructor(initialPosition: THREE.Vector3) {
        this.position = initialPosition.clone();
        this.velocity = new THREE.Vector3();
    }

    public setPath(path: THREE.Vector3[]): void {
        this.path = path;
        this.currentPathIndex = 0;
        this.targetPosition = null;
    }

    public setTarget(pos: THREE.Vector3): void {
        this.targetPosition = pos.clone();
        this.path = [];
    }

    public update(delta: number, keys: Set<string>, cameraYaw: number): void {
        const moveVector = new THREE.Vector3();

        // Mouvement Clavier (WASD / ZQSD)
        if (keys.has('w') || keys.has('z')) moveVector.z -= 1;
        if (keys.has('s')) moveVector.z += 1;
        if (keys.has('a') || keys.has('q')) moveVector.x -= 1;
        if (keys.has('d')) moveVector.x += 1;

        if (moveVector.lengthSq() > 0) {
            moveVector.normalize();
            // Appliquer la rotation de la caméra au mouvement
            moveVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw);

            this.velocity.x += moveVector.x * this.acceleration * delta;
            this.velocity.z += moveVector.z * this.acceleration * delta;
            this.targetPosition = null; // Le clavier annule le mouvement souris
            this.path = []; // Le clavier annule le chemin
        }

        // Mouvement par Pathfinding
        if (this.path.length > 0) {
            const nextPoint = this.path[this.currentPathIndex];
            const dir = new THREE.Vector3().subVectors(nextPoint, this.position);
            dir.y = 0;
            const dist = dir.length();

            if (dist > 0.2) {
                dir.normalize();
                this.velocity.x += dir.x * this.acceleration * delta;
                this.velocity.z += dir.z * this.acceleration * delta;
            } else {
                this.currentPathIndex++;
                if (this.currentPathIndex >= this.path.length) {
                    this.path = [];
                    this.velocity.set(0, 0, 0);
                }
            }
        }
        // Mouvement Souris Direct (Fallback)
        else if (this.targetPosition) {
            const dir = new THREE.Vector3().subVectors(this.targetPosition, this.position);
            dir.y = 0;
            const dist = dir.length();

            if (dist > 0.1) {
                dir.normalize();
                this.velocity.x += dir.x * this.acceleration * delta;
                this.velocity.z += dir.z * this.acceleration * delta;
            } else {
                this.targetPosition = null;
                this.velocity.set(0, 0, 0);
            }
        }

        // Appliquer la friction et limiter la vitesse
        this.velocity.x *= this.friction;
        this.velocity.z *= this.friction;

        const currentSpeed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);
        if (currentSpeed > this.maxSpeed) {
            const ratio = this.maxSpeed / currentSpeed;
            this.velocity.x *= ratio;
            this.velocity.z *= ratio;
        }

        // Mise à jour de la position
        this.position.x += this.velocity.x;
        this.position.z += this.velocity.z;

        // Noclip (gestion simplifiée de la hauteur)
        if (!this.noclip) {
            this.position.y = 0; // Fixé au sol isométrique
        }
    }

    public getPosition(): THREE.Vector3 {
        return this.position;
    }

    public setPosition(pos: THREE.Vector3): void {
        this.position.copy(pos);
    }

    public getVelocity(): THREE.Vector3 {
        return this.velocity;
    }

    public resetVelocity(): void {
        this.velocity.set(0, 0, 0);
    }

    public setNoclipMode(enabled: boolean): void {
        this.noclip = enabled;
    }

    public isNoclipMode(): boolean {
        return this.noclip;
    }
}