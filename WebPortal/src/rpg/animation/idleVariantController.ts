// ══════════════════════════════════════════════════════════════════════════════
// animation/idleVariantController.ts — Variantes d'idle aléatoires (ShuffleBag)
//
// Quand le joueur reste immobile, ce contrôleur change la variante d'idle à
// intervalles aléatoires pour donner de la vie au personnage. Inspiré du
// pattern ShuffleBag du plugin Nanimation (UE5) : chaque variante est tirée
// exactement une fois avant remélange → pas de répétition consécutive.
//
// Pur TS (zéro dépendance React/Three). Piloté par update(dt, isIdle).
// ══════════════════════════════════════════════════════════════════════════════

const WW = "/models/animations/WW100IdleAnimPack/Animations/UE4";

/** Variantes d'idle debout (loops) — tirées du WW100IdleAnimPack. */
export const IDLE_VARIANT_PATHS: string[] = [
  `${WW}/AS_StandUpright_Normal01_Loop01.glb`,
  `${WW}/AS_StandUpright_Normal02_Loop01.glb`,
  `${WW}/AS_StandUpright_Normal03_Loop01.glb`,
];

/** ShuffleBag : tire chaque élément une fois avant de re-mélanger. */
class ShuffleBag<T> {
  private items: T[];
  private bag: T[] = [];
  private cursor = 0;

  constructor(items: T[]) {
    this.items = items;
    this.reshuffle();
  }

  private reshuffle(): void {
    this.bag = [...this.items];
    for (let i = this.bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
    }
    this.cursor = 0;
  }

  draw(): T {
    if (this.cursor >= this.bag.length) this.reshuffle();
    return this.bag[this.cursor++];
  }

  get size(): number { return this.items.length; }
}

export interface IdleVariantOptions {
  /** Temps minimum en idle avant le 1er changement (s). */
  minDelay?: number;
  /** Temps maximum avant un changement (s). */
  maxDelay?: number;
}

export class IdleVariantController {
  private bag: ShuffleBag<number>;
  private timer = 0;
  private nextSwitch: number;
  private currentIndex = 0;
  private wasIdle = false;
  private minDelay: number;
  private maxDelay: number;

  constructor(variantCount: number, opts: IdleVariantOptions = {}) {
    this.minDelay = opts.minDelay ?? 8;
    this.maxDelay = opts.maxDelay ?? 18;
    const indices = Array.from({ length: variantCount }, (_, i) => i);
    this.bag = new ShuffleBag(indices);
    this.nextSwitch = this.randomDelay();
  }

  private randomDelay(): number {
    return this.minDelay + Math.random() * (this.maxDelay - this.minDelay);
  }

  /** Retourne l'index de variante à utiliser (change quand le timer expire).
   *  @returns -1 si pas d'idle (le caller garde son idle de base). */
  update(dt: number, isIdle: boolean): number {
    if (!isIdle) {
      this.timer = 0;
      this.wasIdle = false;
      return -1;
    }

    if (!this.wasIdle) {
      this.wasIdle = true;
      this.timer = 0;
      this.nextSwitch = this.randomDelay();
    }

    this.timer += dt;
    if (this.timer >= this.nextSwitch) {
      this.timer = 0;
      this.nextSwitch = this.randomDelay();
      this.currentIndex = this.bag.draw();
    }
    return this.currentIndex;
  }

  /** Index courant (pour lecture sans update). */
  get current(): number { return this.currentIndex; }

  reset(): void {
    this.timer = 0;
    this.wasIdle = false;
    this.currentIndex = 0;
  }
}
