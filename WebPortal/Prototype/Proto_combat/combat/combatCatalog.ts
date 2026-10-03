// ══════════════════════════════════════════════════════════════════════════════
// Proto_combat/combat/combatCatalog.ts — LES CHIFFRES DU COMBAT, en un seul endroit.
//
// Le banc d'essai existe pour régler ces valeurs à l'œil, pas pour les deviner
// (cf. docs/COMBAT_MECANIQUES.md §12). Elles vivent donc HORS de la machine à
// états : le panneau les édite en direct, la machine les relit à chaque coup.
//
// Module PUR : ni three.js, ni React, ni DOM.
// ══════════════════════════════════════════════════════════════════════════════

import type { ActionId } from "../../../src/rpg/types";

/** Identifiant d'un maillon du combo. Distinct d'`ActionId` : deux maillons
 *  peuvent jouer le MÊME clip avec des timings différents. */
export type AttackId =
  | "punch1"
  | "punch2"
  | "punch3"
  | "kick"
  | "punch_charged";

export interface AttackDef {
  readonly id: AttackId;
  /** Clip joué. `ActionId` du jeu — le prototype CONSOMME, il n'invente pas. */
  readonly action: ActionId;
  /** Libellé du panneau. */
  readonly label: string;

  // ── Les trois phases (ms) ─────────────────────────────────────────────────
  /** Anticipation : le coup est parti, rien ne touche encore. */
  readonly startupMs: number;
  /** Actif : fenêtre de dégâts ouverte. L'action ne s'annule PLUS. */
  readonly activeMs: number;
  /** Récupération : coup fini, personnage vulnérable. */
  readonly recoveryMs: number;

  // ── Fenêtre d'enchaînement, en ms ABSOLUES depuis le début du coup ────────
  readonly windowOpenMs: number;
  readonly windowCloseMs: number;

  // ── Effet ─────────────────────────────────────────────────────────────────
  readonly damage: number;
  readonly staminaCost: number;
  readonly rangeM: number;
  /** Maillon suivant, ou `null` si c'est un finisher (→ `END_COMBO`). */
  readonly next: AttackId | null;
}

/**
 * L'enchaînement mains nues : punch1 → punch2 → punch3.
 *
 * Progression volontaire des trois phases : chaque maillon frappe plus fort,
 * plus lentement, et se punit davantage. Un combo dont tous les maillons ont les
 * mêmes timings n'a aucune tension — le 3e coup doit être un engagement.
 *
 * `windowOpenMs >= startupMs + activeMs` sur chaque entrée : la fenêtre n'ouvre
 * que pendant la récupération, jamais avant (§2 du doc). C'est VÉRIFIÉ par
 * `validerCatalogue()` — un réglage au panneau ne peut pas casser la règle en
 * silence.
 */
export const COMBO_MAINS_NUES: Readonly<Record<AttackId, AttackDef>> = {
  punch1: {
    id: "punch1",
    action: "punch1",
    label: "Jab",
    startupMs: 110,
    activeMs: 70,
    recoveryMs: 260,
    windowOpenMs: 180,
    windowCloseMs: 380,
    damage: 6,
    staminaCost: 8,
    rangeM: 1.6,
    next: "punch2",
  },
  punch2: {
    id: "punch2",
    action: "punch2",
    label: "Crochet",
    startupMs: 140,
    activeMs: 80,
    recoveryMs: 300,
    windowOpenMs: 220,
    windowCloseMs: 440,
    damage: 9,
    staminaCost: 12,
    rangeM: 1.7,
    next: "punch3",
  },
  punch3: {
    id: "punch3",
    action: "punch3",
    label: "Uppercut (finisher)",
    startupMs: 190,
    activeMs: 100,
    recoveryMs: 430,
    // Un finisher n'enchaîne pas : la fenêtre est fermée d'office
    // (open === close). Le combo repart de zéro (END_COMBO).
    windowOpenMs: 290,
    windowCloseMs: 290,
    damage: 18,
    staminaCost: 20,
    rangeM: 1.5,
    next: null,
  },
  kick: {
    id: "kick",
    action: "kick",
    label: "Coup de pied",
    startupMs: 170,
    activeMs: 90,
    recoveryMs: 340,
    windowOpenMs: 260,
    windowCloseMs: 450,
    damage: 12,
    staminaCost: 15,
    rangeM: 2.1,
    next: "punch3",
  },
  punch_charged: {
    id: "punch_charged",
    action: "punch_charged",
    label: "Coup chargé",
    startupMs: 300,
    activeMs: 110,
    recoveryMs: 520,
    windowOpenMs: 410,
    windowCloseMs: 410,
    damage: 26,
    staminaCost: 28,
    rangeM: 1.8,
    next: null,
  },
};

/** Premier maillon du combo — l'attaque lancée depuis le neutre. */
export const PREMIER_MAILLON: AttackId = "punch1";

/** Coup produit par un relâchement de charge complet (§8). */
export const ATTAQUE_CHARGEE: AttackId = "punch_charged";

/** Réglages globaux — tout ce qui n'appartient pas à un coup en particulier. */
export interface ReglagesCombat {
  /** Péremption du tampon d'entrée. Passé ce délai l'appui est oublié (§3). */
  bufferTtlMs: number;
  /**
   * Le tampon accepte-t-il un appui pendant l'ANTICIPATION ?
   *
   * `false` = règle ACF stricte (§4 : anticipation → refusée). Un double appui
   * accidentel ne déclenche rien.
   * `true` = plus permissif ; un joueur nerveux enchaîne quand même.
   *
   * Exposé parce que c'est un choix de SENSATION, pas de correction : il se
   * tranche manette en main, pas en lisant du code.
   */
  tamponDesAnticipation: boolean;
  /** Ignore la contrainte de fenêtre. Repris de `SetSkipWindowConstraint` (Bacon) — outil de réglage. */
  ignorerFenetre: boolean;

  /** Immobilisation après un coup encaissé non gardé. */
  hitstunMs: number;
  /** Ouverture TOTALE du cône de garde, en degrés (120 = 60° de chaque côté). */
  coneGardeDeg: number;
  /** Part des dégâts qui passe malgré une garde réussie (0.25 = 75 % absorbés). */
  gardePassthrough: number;
  /** Endurance consommée par un coup gardé, en plus des dégâts réduits. */
  gardeCoutEndurance: number;
  /** Immobilisation après une rupture de garde (endurance à sec en gardant). */
  gardeBriseeMs: number;

  // ── Attaque chargée (§8) ──────────────────────────────────────────────────
  /** Maintien à partir duquel le relâchement donne la variante CHARGÉE. */
  chargeSeuilMs: number;
  /**
   * Endurance drainée PAR SECONDE pendant le maintien.
   *
   * > 0 volontairement : sans drain, maintenir la charge en attendant
   * l'ouverture de l'adversaire est gratuit, donc toujours optimal. Le drain
   * rend le camping coûteux sans rendre une charge normale inabordable.
   */
  chargeCoutParSec: number;

  /** Endurance maximale. */
  enduranceMax: number;
  /** Régénération d'endurance, par seconde, hors action. */
  enduranceRegenParSec: number;
  /** Délai après une action avant que la régénération reprenne. */
  enduranceRegenDelaiMs: number;
}

export const REGLAGES_DEFAUT: ReglagesCombat = {
  bufferTtlMs: 250,
  tamponDesAnticipation: false,
  ignorerFenetre: false,

  hitstunMs: 380,
  coneGardeDeg: 120,
  gardePassthrough: 0.25,
  gardeCoutEndurance: 14,
  gardeBriseeMs: 900,

  // 350 ms : la valeur déjà retenue par `CHARGE_MS` dans le jeu
  // (`src/rpg/combat/unarmedCombat.ts`). Repartir d'un autre chiffre ferait
  // diverger deux réglages qui décrivent la même sensation.
  chargeSeuilMs: 350,
  chargeCoutParSec: 18,

  enduranceMax: 100,
  enduranceRegenParSec: 22,
  enduranceRegenDelaiMs: 500,
};

/**
 * Vérifie les invariants d'un catalogue. Renvoie la liste des violations —
 * vide si tout va bien.
 *
 * Pourquoi ça existe : le panneau édite ces chiffres EN DIRECT. Une fenêtre
 * réglée à 50 ms sur un coup dont l'anticipation dure 110 ms ouvrirait
 * l'enchaînement PENDANT l'anticipation, ce qui laisse annuler son propre coup
 * en le rejouant (§2). Sans contrôle, ça passe inaperçu : le combat devient
 * simplement « plus nerveux », puis injouable, sans qu'on sache pourquoi.
 */
export function validerCatalogue(
  catalogue: Readonly<Record<AttackId, AttackDef>>,
): string[] {
  const erreurs: string[] = [];
  for (const def of Object.values(catalogue)) {
    const finAttaque = def.startupMs + def.activeMs;
    const total = finAttaque + def.recoveryMs;
    if (def.windowOpenMs < finAttaque) {
      erreurs.push(
        `${def.id}: fenêtre ouverte à ${def.windowOpenMs}ms, avant la fin de la phase active (${finAttaque}ms) — l'attaque pourrait s'annuler elle-même`,
      );
    }
    if (def.windowCloseMs < def.windowOpenMs) {
      erreurs.push(`${def.id}: fenêtre fermée (${def.windowCloseMs}ms) avant son ouverture (${def.windowOpenMs}ms)`);
    }
    if (def.windowCloseMs > total) {
      erreurs.push(
        `${def.id}: fenêtre fermée à ${def.windowCloseMs}ms, après la fin du coup (${total}ms) — rater la fenêtre ne coûterait rien`,
      );
    }
    if (def.next !== null && def.windowCloseMs === def.windowOpenMs) {
      erreurs.push(`${def.id}: fenêtre de durée nulle alors qu'un maillon suivant (${def.next}) est déclaré — il serait inatteignable`);
    }
    if (def.next !== null && !(def.next in catalogue)) {
      erreurs.push(`${def.id}: maillon suivant "${def.next}" absent du catalogue`);
    }
  }
  return erreurs;
}
