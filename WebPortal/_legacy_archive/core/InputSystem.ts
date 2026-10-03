import * as THREE from 'three';

/**
 * Système de gestion des entrées optimisé (Style C++)
 * Gère le clavier et la souris avec un état centralisé.
 */
export class InputSystem {
    private keys: Set<string>;
    private mousePosition: THREE.Vector2;
    private isPointerLocked: boolean;
    private domElement: HTMLElement | null;

    // Callbacks pour les événements
    public onKeyDown?: (key: string) => void;
    public onKeyUp?: (key: string) => void;
    public onMouseDown?: (button: number) => void;

    constructor() {
        this.keys = new Set();
        this.mousePosition = new THREE.Vector2(0, 0);
        this.isPointerLocked = false;
        this.domElement = null;

        // Binding des méthodes pour garder le contexte 'this'
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handlePointerLockChange = this.handlePointerLockChange.bind(this);
    }

    /**
     * Initialise les écouteurs d'événements sur l'élément DOM cible
     */
    public initialize(element: HTMLElement): void {
        this.domElement = element;

        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);
        window.addEventListener('mousemove', this.handleMouseMove);
        window.addEventListener('mousedown', this.handleMouseDown);
        document.addEventListener('pointerlockchange', this.handlePointerLockChange);

        console.log('✅ [InputSystem] Initialized');
    }

    /**
     * Nettoie les écouteurs d'événements (Destructeur)
     */
    public dispose(): void {
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
        window.removeEventListener('mousemove', this.handleMouseMove);
        window.removeEventListener('mousedown', this.handleMouseDown);
        document.removeEventListener('pointerlockchange', this.handlePointerLockChange);

        this.keys.clear();
        console.log('🛑 [InputSystem] Disposed');
    }

    /**
     * Vérifie si une touche est maintenue enfoncée
     */
    public isKeyPressed(key: string): boolean {
        return this.keys.has(key.toLowerCase());
    }

    /**
     * Récupère la position de la souris normalisée (-1 à +1)
     */
    public getMouseNormalized(): THREE.Vector2 {
        return this.mousePosition;
    }

    // --- Gestionnaires d'événements internes ---

    private handleKeyDown(event: KeyboardEvent): void {
        const key = event.key.toLowerCase();
        this.keys.add(key);
        if (this.onKeyDown) this.onKeyDown(key);
    }

    private handleKeyUp(event: KeyboardEvent): void {
        const key = event.key.toLowerCase();
        this.keys.delete(key);
        if (this.onKeyUp) this.onKeyUp(key);
    }

    private handleMouseMove(event: MouseEvent): void {
        if (this.domElement) {
            // Calculer la position normalisée pour le Raycasting
            this.mousePosition.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.mousePosition.y = -(event.clientY / window.innerHeight) * 2 + 1;
        }
    }

    private handleMouseDown(event: MouseEvent): void {
        if (this.onMouseDown) this.onMouseDown(event.button);
    }

    private handlePointerLockChange(): void {
        this.isPointerLocked = document.pointerLockElement === this.domElement;
    }
}
