// ══════════════════════════════════════════════════════════════════════════════
// runtime/screenShake.ts — Tremblement d'écran (game juice, singleton hors-React)
//
// Modèle "trauma" (cf. la GDC talk de Squirrel Eiserloh) : les impacts ajoutent
// du trauma (0..1), qui décroît tout seul. L'intensité appliquée à la caméra est
// trauma² → les petits trauma restent subtils, les gros frappent fort.
//
// La caméra (FpsCamera) appelle `tick(dt)` chaque frame et applique l'offset.
// N'importe quel système de gameplay appelle `add()` sur un impact.
// ══════════════════════════════════════════════════════════════════════════════

class ScreenShake {
  private trauma = 0;

  /** Ajoute du trauma (clampé à 1). Ex: tir 0.12, dégât reçu ~0.3, explosion 0.6. */
  add(amount: number): void {
    if (amount <= 0) return;
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /**
   * Décroît le trauma et retourne l'INTENSITÉ courante (trauma²) à appliquer.
   * Retourne 0 si rien à secouer → la caméra peut court-circuiter (coût nul).
   */
  tick(dt: number): number {
    if (this.trauma <= 0) return 0;
    // ~1.8/s : un petit tir (0.12) se dissipe en ~70 ms, une explosion (0.6)
    // en ~330 ms → un "kick" net, jamais nauséeux.
    this.trauma = Math.max(0, this.trauma - dt * 1.8);
    return this.trauma * this.trauma;
  }

  /** Remet à zéro (changement de map / mort / sortie). */
  reset(): void {
    this.trauma = 0;
  }
}

export const screenShake = new ScreenShake();
