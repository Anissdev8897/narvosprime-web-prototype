// ══════════════════════════════════════════════════════════════════════════════
// talents/talentRuntime.ts — Pont talents → systèmes hot-path (hors React)
//
// Certains effets de talents doivent être lus à 60 fps dans des contrôleurs
// PURS (ex: la vitesse de déplacement dans CharacterController). On ne peut pas
// y faire passer des props React. Ce singleton (même idée que characterScaleStore)
// expose les multiplicateurs nécessaires ; RpgGameWorld le met à jour via un
// effect quand `stats.talents` change.
// ══════════════════════════════════════════════════════════════════════════════

class TalentRuntime {
  /** Multiplicateur de vitesse de déplacement (1 = aucun bonus). */
  moveSpeedMult = 1;

  setMoveSpeedMult(v: number): void {
    this.moveSpeedMult = Number.isFinite(v) && v > 0 ? v : 1;
  }

  reset(): void {
    this.moveSpeedMult = 1;
  }
}

export const talentRuntime = new TalentRuntime();
