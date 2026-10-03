// ══════════════════════════════════════════════════════════════════════════════
// runtime/debug/gameplayDebugger/core.ts — Gameplay Debugger (F3 overlay)
//
// Architecture inspirée du GameplayDebugger d'Unreal Engine :
//   • Catégories enregistrables (comme UGameplayDebuggerCategory)
//   • Overlay 2D (F3 toggle, touches 1-5 pour catégories)
//   • Helpers 3D (DebugLine, DebugSphere, DebugText) dans le monde
//
// Singleton GameplayDebugger : point d'entrée unique pour l'enregistrement
// des catégories et la collecte des données de debug.
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";

// ── Types de dessins 3D ─────────────────────────────────────────────────────
/** Appel de dessin 3D produit par une catégorie chaque frame. */
export interface DebugLineCall {
  type: "line";
  start: THREE.Vector3;
  end: THREE.Vector3;
  color: number;
  duration?: number; // frames (0 = une frame)
}

export interface DebugSphereCall {
  type: "sphere";
  center: THREE.Vector3;
  radius: number;
  color: number;
  duration?: number;
}

export interface DebugTextCall {
  type: "text";
  position: THREE.Vector3;
  text: string;
  color: number;
  size?: number;
  duration?: number;
}

export type DebugDrawCall = DebugLineCall | DebugSphereCall | DebugTextCall;

// ── Interface de catégorie ──────────────────────────────────────────────────
export interface GameplayDebuggerCategory {
  /** Identifiant unique (ex: "npc", "perf", "quetes"). */
  id: string;
  /** Nom affiché dans l'onglet. */
  label: string;
  /** Touche de sélection (1-5). */
  keybind: string;

  /**
   * Appelé chaque frame avant le rendu.
   * @param dt delta time (secondes) depuis la frame précédente.
   */
  update(dt: number): void;

  /**
   * Retourne les lignes de texte pour l'overlay 2D.
   * Chaque string est une ligne ; le premier élément est le titre.
   * Les lignes vides ajoutent un saut.
   */
  getOverlayData(): string[];

  /**
   * Retourne les appels de dessin 3D pour cette frame.
   * Sera vidé après chaque frame.
   */
  getDrawCalls(): DebugDrawCall[];
}

// ── Singleton GameplayDebugger ──────────────────────────────────────────────
type Listener = () => void;

class GameplayDebuggerCore {
  private categories = new Map<string, GameplayDebuggerCategory>();
  private order: string[] = [];
  private activeIndex = 0;
  private _visible = false;
  private listeners = new Set<Listener>();
  private drawCallsPool: DebugDrawCall[] = [];

  /** Active/désactive l'overlay. */
  toggle(): void {
    this._visible = !this._visible;
    this.notify();
  }

  /** Force la visibilité. */
  setVisible(v: boolean): void {
    if (this._visible === v) return;
    this._visible = v;
    this.notify();
  }

  get visible(): boolean {
    return this._visible;
  }

  /** Bascule vers la catégorie d'index `idx` (0-4). */
  selectCategory(index: number): void {
    if (index < 0 || index >= this.order.length) return;
    this.activeIndex = index;
    this.notify();
  }

  /** Passe à la catégorie suivante. */
  nextCategory(): void {
    if (this.order.length === 0) return;
    this.activeIndex = (this.activeIndex + 1) % this.order.length;
    this.notify();
  }

  /** Passe à la catégorie précédente. */
  prevCategory(): void {
    if (this.order.length === 0) return;
    this.activeIndex = (this.activeIndex - 1 + this.order.length) % this.order.length;
    this.notify();
  }

  /** Enregistre une catégorie. */
  register(category: GameplayDebuggerCategory): void {
    if (this.categories.has(category.id)) {
      console.warn(`[GameplayDebugger] Category "${category.id}" already registered, skipping.`);
      return;
    }
    this.categories.set(category.id, category);
    this.order.push(category.id);
    this.notify();
  }

  /** Désenregistre une catégorie. */
  unregister(id: string): void {
    if (!this.categories.has(id)) return;
    this.categories.delete(id);
    this.order = this.order.filter((o) => o !== id);
    if (this.activeIndex >= this.order.length) {
      this.activeIndex = Math.max(0, this.order.length - 1);
    }
    this.notify();
  }

  /** Retourne la catégorie active. */
  get activeCategory(): GameplayDebuggerCategory | undefined {
    if (this.order.length === 0) return undefined;
    return this.categories.get(this.order[this.activeIndex]);
  }

  /** Retourne l'index de la catégorie active. */
  get currentIndex(): number {
    return this.activeIndex;
  }

  /** Liste de toutes les catégories enregistrées (dans l'ordre). */
  getAllCategories(): GameplayDebuggerCategory[] {
    return this.order.map((id) => this.categories.get(id)!);
  }

  /** Nombre de catégories. */
  get count(): number {
    return this.order.length;
  }

  /** Appelé chaque frame par le GameplayDebuggerOverlay ou Debug3DScene. */
  tick(dt: number): void {
    if (!this._visible) return;
    // Vide le pool
    this.drawCallsPool.length = 0;
    // Update la catégorie active
    const cat = this.activeCategory;
    if (cat) {
      cat.update(dt);
      this.drawCallsPool.push(...cat.getDrawCalls());
    }
  }

  /** Récupère les draw calls de la frame courante. */
  flushDrawCalls(): DebugDrawCall[] {
    const calls = [...this.drawCallsPool];
    return calls;
  }

  /** Abonnement aux changements (visibilité, catégorie active). */
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }
}

/** Instance unique du Gameplay Debugger. */
export const gameplayDebugger = new GameplayDebuggerCore();
