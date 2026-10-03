// runtime/movement/staminaStore.ts — Endurance de LOCOMOTION (course, saut).
//
// POURQUOI UN STORE À PART
//
// Une jauge `stamina` existe déjà dans `professions/professionStore.ts`, mais
// elle est PERSISTÉE par personnage et incrémente une version à chaque mutation
// pour réveiller `useSyncExternalStore`. L'appeler à chaque frame pendant une
// course provoquerait un re-render React par frame, plus une écriture
// localStorage par frame.
//
// Celui-ci est donc : pur, non persisté, muté en place, et il ne notifie ses
// abonnés QUE lorsque la valeur affichée change réellement (arrondi au centième).
// La logique est testable sans DOM — le tick prend `dt` en argument, il ne lit
// aucune horloge.

/** Réglages d'endurance. Exposés pour les tests et un futur écran d'options. */
export const STAMINA = {
  /** Capacité totale, en « secondes de course à plein régime ». */
  max: 100,
  /** Coût de la course, par seconde. 100/12 → ~12 s de course continue. */
  runDrainPerSec: 100 / 12,
  /** Coût d'un saut, ponctuel. */
  jumpCost: 12,
  /** Régénération, par seconde, une fois le délai écoulé. */
  regenPerSec: 100 / 8,
  /** Délai d'inactivité avant que la régénération démarre, en secondes. */
  regenDelay: 1.0,
  /**
   * Seuil de ré-autorisation après épuisement. Sans lui, à 0 le joueur
   * récupérerait une miette d'endurance et repartirait en course pour 1 frame,
   * en boucle — un scintillement course/marche à chaque frame.
   */
  exhaustedRecovery: 25,
} as const;

// Annotations explicites : `as const` sur STAMINA fige `max` au type littéral
// `100`, ce qui rendrait `current` non assignable dès la première décrémentation.
let current: number = STAMINA.max;
let sinceSpend: number = STAMINA.regenDelay; // démarre régénérable
let exhausted = false;
let version = 0;
let lastNotified: number = 1;
const listeners = new Set<() => void>();

function notifyIfChanged(): void {
  // L'UI n'a besoin d'un rendu que si la barre bouge visiblement. À 60 fps une
  // notification par frame serait 60 re-renders/seconde pour rien.
  const shown = Math.round((current / STAMINA.max) * 100) / 100;
  if (shown === lastNotified) return;
  lastNotified = shown;
  version++;
  for (const l of listeners) l();
}

export const staminaStore = {
  /** Fraction 0..1, pour la barre d'endurance. */
  get ratio(): number { return current / STAMINA.max; },
  get value(): number { return current; },
  /** true tant que le joueur n'a pas récupéré assez pour re-courir. */
  get isExhausted(): boolean { return exhausted; },

  /** La course est-elle permise à cet instant ? */
  canRun(): boolean { return !exhausted && current > 0; },

  /**
   * Avance l'endurance d'une frame.
   * @param dt      secondes écoulées
   * @param running le joueur court-il ET se déplace-t-il réellement ?
   */
  tick(dt: number, running: boolean): void {
    if (running && current > 0) {
      current = Math.max(0, current - STAMINA.runDrainPerSec * dt);
      sinceSpend = 0;
      if (current <= 0) exhausted = true;
    } else {
      sinceSpend += dt;
      if (sinceSpend >= STAMINA.regenDelay && current < STAMINA.max) {
        current = Math.min(STAMINA.max, current + STAMINA.regenPerSec * dt);
      }
    }
    // Sortie d'épuisement uniquement au-dessus du seuil de récupération.
    if (exhausted && current >= STAMINA.exhaustedRecovery) exhausted = false;
    notifyIfChanged();
  },

  /** Consomme le coût d'un saut. Renvoie false si l'endurance est insuffisante. */
  spendJump(): boolean {
    if (current < STAMINA.jumpCost) return false;
    current -= STAMINA.jumpCost;
    sinceSpend = 0;
    if (current <= 0) exhausted = true;
    notifyIfChanged();
    return true;
  },

  /**
   * Consomme un montant d'endurance (dash, wallrun, etc.).
   * Réduit à 0 si le montant dépasse la réserve actuelle.
   */
  spend(amount: number): void {
    if (amount <= 0) return;
    current = Math.max(0, current - amount);
    sinceSpend = 0;
    if (current <= 0) exhausted = true;
    notifyIfChanged();
  },

  /** Remise à plein (changement de map, respawn, triche admin). */
  reset(): void {
    current = STAMINA.max;
    sinceSpend = STAMINA.regenDelay;
    exhausted = false;
    notifyIfChanged();
  },

  subscribe(l: () => void): () => void { listeners.add(l); return () => { listeners.delete(l); }; },
  getVersion: (): number => version,
};
