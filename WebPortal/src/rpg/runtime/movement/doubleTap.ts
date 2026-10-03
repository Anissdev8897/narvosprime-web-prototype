// runtime/movement/doubleTap.ts — Détection de double appui, logique PURE.
//
// POURQUOI UN MODULE À PART
//
// Le runtime de mouvement contient DÉJÀ trois détecteurs de front montant
// (`jumpEdge` et `stabilizeEdge` dans InputManager, `prevCrouchHeld` dans
// CharacterController), mais AUCUN n'horodate : ils savent dire « la touche vient
// d'être pressée », pas « deux fois en moins de 300 ms ». En ajouter un quatrième
// ad hoc dupliquerait la logique une fois de plus.
//
// L'horloge est INJECTÉE (`now` en paramètre) plutôt que lue depuis `performance`:
// c'est ce qui rend le module testable en environnement node, sans DOM ni timers.

export interface DoubleTapOptions {
  /** Fenêtre maximale entre les deux appuis, en millisecondes. */
  windowMs?: number;
}

export class DoubleTapDetector {
  private lastTapAt = -Infinity;
  private readonly windowMs: number;

  constructor(opts: DoubleTapOptions = {}) {
    // 300 ms : au-delà, deux sauts délibérés successifs seraient pris pour une
    // escalade ; en deçà, le double appui devient difficile à déclencher.
    this.windowMs = opts.windowMs ?? 300;
  }

  /**
   * À appeler sur chaque FRONT MONTANT de la touche (jamais sur l'auto-répétition
   * du clavier : deux répétitions séparées de ~30 ms passeraient pour un double
   * appui à chaque fois que le joueur maintient la touche).
   *
   * @param now horodatage en millisecondes
   * @returns true si cet appui complète un double appui
   */
  tap(now: number): boolean {
    const isDouble = now - this.lastTapAt <= this.windowMs;
    // On réarme après un double appui détecté : sinon trois appuis rapides
    // déclencheraient deux fois (2e+3e), ce qui ferait ré-entrer en escalade
    // juste après en être sorti.
    this.lastTapAt = isDouble ? -Infinity : now;
    return isDouble;
  }

  /** Oublie l'appui en attente (changement de map, perte de focus, mort). */
  reset(): void {
    this.lastTapAt = -Infinity;
  }
}
