// ══════════════════════════════════════════════════════════════════════════════
// combat/cooldownStore.ts — Cooldowns d'ultimes (singleton hors-React).
//
// Les sorts les plus puissants (ultimes) ont un cooldown de base de 60 s, réductible
// par l'équipement/progression. Le store ne connaît que des (id → secondes restantes)
// et un tick central. La réduction est fournie par l'appelant (stat d'équipement)
// → aucune logique spécifique par sort.
// ══════════════════════════════════════════════════════════════════════════════

export const ULTIMATE_BASE_CD = 60; // secondes
const MAX_REDUCTION = 0.8;          // plafond : on ne descend jamais sous 20% du CD

class CooldownStore {
  private cds = new Map<string, number>(); // id → secondes restantes

  /**
   * Déclenche le cooldown d'un sort.
   * @param id          identifiant du sort/ultime
   * @param baseCd      cooldown de base (défaut 60 s pour un ultime)
   * @param cdReduction réduction 0..0.8 (issue de l'équipement) → CD effectif = base × (1−r)
   */
  trigger(id: string, baseCd: number = ULTIMATE_BASE_CD, cdReduction = 0): void {
    const r = Math.max(0, Math.min(MAX_REDUCTION, cdReduction));
    this.cds.set(id, baseCd * (1 - r));
  }

  /** Secondes restantes avant disponibilité (0 = prêt). */
  remaining(id: string): number {
    return Math.max(0, this.cds.get(id) ?? 0);
  }

  isReady(id: string): boolean {
    return this.remaining(id) <= 0;
  }

  /** Fraction restante 0..1 (pour un cooldown radial en HUD). */
  fraction(id: string, baseCd: number = ULTIMATE_BASE_CD): number {
    if (baseCd <= 0) return 0;
    return Math.max(0, Math.min(1, this.remaining(id) / baseCd));
  }

  /** Avance tous les cooldowns (appelé chaque frame). */
  tick(dt: number): void {
    if (this.cds.size === 0) return;
    for (const [id, t] of this.cds) {
      const n = t - dt;
      if (n <= 0) this.cds.delete(id);
      else this.cds.set(id, n);
    }
  }

  reset(): void { this.cds.clear(); }
}

export const cooldownStore = new CooldownStore();
