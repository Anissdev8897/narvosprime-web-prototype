// ══════════════════════════════════════════════════════════════════════════════
// Proto_combat/combat/combatMachine.ts — Machine à états du combat au corps à corps.
//
// LOGIQUE PURE : aucun import de three.js, de React ou du DOM. L'horloge est
// INJECTÉE (`nowMs` en paramètre) — jamais `performance.now()` en interne. C'est
// ce qui rend une fenêtre de combo testable au millimètre, sans afficher un
// pixel, dans l'environnement vitest `node` du projet.
//
// Les règles implémentées ici sont celles de docs/COMBAT_MECANIQUES.md, tirées
// des plugins Unreal (ACF, AdvancedGASSystem, BaconCombatGraph, uAim). Le
// numéro de section est cité à chaque endroit qui en applique une.
//
// Pattern « logique pure / coquille impure » du projet (cf. runtime/movement/) :
// la scène R3F ne fait qu'appeler `update(dt)` et jouer les clips demandés.
// ══════════════════════════════════════════════════════════════════════════════

import {
  ATTAQUE_CHARGEE,
  COMBO_MAINS_NUES,
  PREMIER_MAILLON,
  REGLAGES_DEFAUT,
  type AttackDef,
  type AttackId,
  type ReglagesCombat,
} from "./combatCatalog";
import { dansConeDeGarde, hitDirection, type HitDirection } from "./hitDirection";

/** Phase du corps. Un seul état à la fois — c'est tout l'intérêt. */
export type CombatPhase =
  | "neutre"
  | "anticipation"
  | "actif"
  | "recuperation"
  | "hitstun"
  | "garde_brisee";

/** Pourquoi le combo est retombé à zéro. Miroir d'`EComboResetReason` (Bacon). */
export type RaisonReset = "END_COMBO" | "FENETRE_RATEE" | "INTERROMPU";

/** Pourquoi une entrée a été rejetée — le panneau l'affiche, c'est l'outil de réglage. */
export type RaisonRefus = "endurance" | "phase" | "garde_brisee";

export type CombatEvent =
  /** Jouer un clip. La coquille R3F traduit en `AnimationController.play()`. */
  | { type: "anim"; action: string }
  /** Fin de l'anticipation : la fenêtre de dégâts s'ouvre (ACF `ApplyDamage`). */
  | { type: "impact"; attaque: AttackId; degats: number; portee: number }
  /** Bord montant/descendant de la fenêtre d'enchaînement (Bacon `InputWindow`). */
  | { type: "fenetre"; ouverte: boolean; attaque: AttackId }
  | { type: "refus"; raison: RaisonRefus }
  | { type: "combo_reset"; raison: RaisonReset }
  | { type: "encaisse"; direction: HitDirection; degats: number; bloque: boolean }
  | { type: "garde"; active: boolean }
  | { type: "garde_brisee" }
  /** Cycle de la charge (§8) : appui → seuil franchi → relâchement ou perte. */
  | { type: "charge"; etat: "debut" | "prete" | "relachee" | "annulee" };

export interface CombatMachineOptions {
  reglages?: ReglagesCombat;
  catalogue?: Readonly<Record<AttackId, AttackDef>>;
  premierMaillon?: AttackId;
  /** Coup produit par une charge complète. */
  attaqueChargee?: AttackId;
  onEvent?: (ev: CombatEvent) => void;
}

export interface CoupRecu {
  degats: number;
  /**
   * Angle du vecteur « défenseur → attaquant », DANS LE REPÈRE DU DÉFENSEUR.
   * 0 = de face, +π/2 = sur sa droite, ±π = dans le dos.
   */
  angleRad: number;
  /** Ignore la garde (attaque « imblocable »). */
  imblocable?: boolean;
}

export class CombatMachine {
  readonly reglages: ReglagesCombat;
  private catalogue: Readonly<Record<AttackId, AttackDef>>;
  private premierMaillon: AttackId;
  private onEvent?: (ev: CombatEvent) => void;

  private phaseActuelle: CombatPhase = "neutre";
  private attaque: AttackId | null = null;
  private debutAttaqueMs = 0;
  private impactEmis = false;
  private fenetreOuverte = false;
  private rangCombo = 0;

  /** Tampon d'entrée : UNE seule entrée, écrasée par la suivante (§3). */
  private tamponMs: number | null = null;

  private finEtatMs = 0;
  private endurance: number;
  private derniereActionMs = -Infinity;
  private derniereMajMs = 0;

  private gardeDemandee = false;
  private gardeActive = false;

  /** Instant d'appui de la charge en cours, ou `null` si aucune charge armée. */
  private chargeDebutMs: number | null = null;
  private chargePrete = false;
  private attaqueChargee: AttackId;

  constructor(opts: CombatMachineOptions = {}) {
    this.reglages = opts.reglages ?? { ...REGLAGES_DEFAUT };
    this.catalogue = opts.catalogue ?? COMBO_MAINS_NUES;
    this.premierMaillon = opts.premierMaillon ?? PREMIER_MAILLON;
    this.attaqueChargee = opts.attaqueChargee ?? ATTAQUE_CHARGEE;
    this.onEvent = opts.onEvent;
    this.endurance = this.reglages.enduranceMax;
  }

  /**
   * Remplace le catalogue à chaud (réglage au panneau).
   *
   * Les RÉGLAGES globaux, eux, se modifient EN PLACE via `machine.reglages.x = …`
   * — même convention que `gameSettings` dans le jeu : l'objet est la source de
   * vérité, et une référence gardée ailleurs reste valide après un réglage.
   * Un catalogue, lui, se remplace : ses entrées sont `readonly`.
   */
  remplacerCatalogue(catalogue: Readonly<Record<AttackId, AttackDef>>): void {
    this.catalogue = catalogue;
  }

  // ── Lecture (panneau de debug, coquille R3F) ────────────────────────────────

  get phase(): CombatPhase { return this.phaseActuelle; }
  get attaqueCourante(): AttackId | null { return this.attaque; }
  get rang(): number { return this.rangCombo; }
  get enFenetre(): boolean { return this.fenetreOuverte; }
  get enGarde(): boolean { return this.gardeActive; }
  get enduranceCourante(): number { return this.endurance; }
  /** Charge armée et en cours de maintien. */
  get enCharge(): boolean { return this.chargeDebutMs !== null; }
  /** Seuil franchi : le relâchement donnera la variante chargée. */
  get chargePreteMaintenant(): boolean { return this.chargePrete; }
  /** Durée de maintien de la charge (ms). -1 si aucune charge armée. */
  chargeTenueMs(nowMs: number): number {
    return this.chargeDebutMs === null ? -1 : nowMs - this.chargeDebutMs;
  }
  /** Tampon armé et non périmé — l'affichage de cet état explique 90 % des « ça n'a pas répondu ». */
  tamponArme(nowMs: number): boolean {
    return this.tamponMs !== null && nowMs - this.tamponMs <= this.reglages.bufferTtlMs;
  }
  /** Temps écoulé dans le coup en cours (ms). -1 hors attaque. */
  avancementMs(nowMs: number): number {
    return this.attaque === null ? -1 : nowMs - this.debutAttaqueMs;
  }

  // ── Entrées ────────────────────────────────────────────────────────────────

  /**
   * Appui sur la touche d'attaque.
   *
   * Avance d'abord l'horloge : sans ça, un appui reçu entre deux `update()`
   * serait jugé sur une phase périmée — typiquement une fenêtre déjà fermée mais
   * encore marquée ouverte, qui laisse enchaîner un coup interdit.
   */
  pressAttack(nowMs: number): void {
    this.update(nowMs);

    switch (this.phaseActuelle) {
      case "neutre":
        this.demarrer(this.premierMaillon, nowMs, false);
        return;

      case "anticipation":
        // §4 : anticipation → refusée (règle ACF stricte). `tamponDesAnticipation`
        // ouvre l'autre lecture — c'est un choix de sensation, pas de correction.
        if (this.reglages.tamponDesAnticipation) this.bufferiser(nowMs);
        else this.emit({ type: "refus", raison: "phase" });
        return;

      case "actif":
        // §4 : engagement. On ne peut pas annuler son propre coup, mais l'appui
        // n'est pas perdu — il attend l'ouverture de la fenêtre.
        this.bufferiser(nowMs);
        return;

      case "recuperation": {
        const def = this.def();
        const ecoule = nowMs - this.debutAttaqueMs;
        if (this.fenetreOuverte && def.next) {
          this.demarrer(def.next, nowMs, true);
        } else if (ecoule < def.windowOpenMs) {
          this.bufferiser(nowMs); // appui anticipé → consommé à l'ouverture (§3)
        } else {
          // §2 règle 3 : hors fenêtre, l'appui n'est pas ignoré — il relance le
          // combo au premier maillon. Rater la fenêtre coûte le combo, pas le tour.
          this.emit({ type: "combo_reset", raison: "FENETRE_RATEE" });
          this.demarrer(this.premierMaillon, nowMs, false);
        }
        return;
      }

      case "hitstun":
        this.emit({ type: "refus", raison: "phase" });
        return;

      case "garde_brisee":
        this.emit({ type: "refus", raison: "garde_brisee" });
        return;
    }
  }

  /** Maintien de la touche de garde. La garde est une POSTURE, pas un coup (§7). */
  setGarde(tenue: boolean): void {
    this.gardeDemandee = tenue;
  }

  // ── Attaque chargée (docs/COMBAT_MECANIQUES.md §8) ─────────────────────────
  //
  // ACF modélise la touche par `ESustainedActionState` : NotStarted → Started →
  // Released. La DURÉE entre appui et relâchement choisit la variante.
  //
  // TROIS ARBITRAGES, et pourquoi ils sont tranchés ainsi :
  //
  //   1. RELÂCHEMENT AVANT LE SEUIL → le coup NORMAL part.
  //      « Ne rien jouer » ferait de la charge un engagement, mais au prix
  //      d'appuis qui ne produisent rien — exactement la perception d'entrée
  //      perdue que le tampon d'entrée (§3) existe pour supprimer. On ne
  //      construit pas d'un côté ce qu'on détruit de l'autre.
  //      L'argument « on ne peut plus annuler une charge entamée par erreur »
  //      tient moins : à 350 ms, une charge lancée par erreur est déjà punie
  //      par l'anticipation de 300 ms du coup chargé.
  //
  //   2. L'ENDURANCE SE DRAINE PENDANT LE MAINTIEN.
  //      Sans drain, maintenir la charge en attendant l'ouverture adverse est
  //      gratuit, donc toujours optimal — le jeu devient une partie de qui
  //      bouge en premier. Le drain met un prix au temps, ce que la durée seule
  //      ne fait pas. Endurance à sec en chargeant → charge perdue.
  //
  //   3. ENCAISSER UN COUP PERD LA CHARGE.
  //      Cohérent avec §4 : `hit` est prioritaire sur tout et fait perdre le
  //      combo. Une charge qui survivrait au coup rendrait l'échange favorable
  //      à celui qui charge — il encaisse et garde son gros coup.

  /**
   * Appui maintenu sur la touche d'attaque (ACF `EStarted`).
   *
   * N'arme la charge que depuis une phase où une attaque peut réellement
   * partir. Ailleurs (anticipation, actif, hitstun…), la charge n'est pas
   * armée et c'est le RELÂCHEMENT qui retombe sur `pressAttack` — donc sur la
   * logique de tampon et de refus déjà en place, sans la dupliquer.
   */
  chargeCommencee(nowMs: number): void {
    this.update(nowMs);
    if (this.chargeDebutMs !== null) return; // déjà armée (auto-repeat clavier)
    if (this.phaseActuelle !== "neutre" && this.phaseActuelle !== "recuperation") return;

    this.chargeDebutMs = nowMs;
    this.chargePrete = false;
    this.emit({ type: "charge", etat: "debut" });
    // §8 : une charge maintenue doit avoir sa propre boucle VISIBLE, sinon le
    // joueur ne sait pas que sa charge est en cours.
    this.emit({ type: "anim", action: "ability_e_targeting_loop" });
  }

  /** Relâchement de la touche d'attaque (ACF `EReleased`). */
  chargeRelachee(nowMs: number): void {
    this.update(nowMs);
    const debut = this.chargeDebutMs;

    // Charge jamais armée (appui reçu en pleine attaque) : le relâchement vaut
    // un appui simple. Arbitrage 1, appliqué aussi à ce cas.
    if (debut === null) {
      this.pressAttack(nowMs);
      return;
    }

    const tenue = nowMs - debut;
    this.chargeDebutMs = null;
    this.chargePrete = false;

    if (tenue < this.reglages.chargeSeuilMs) {
      // Arbitrage 1 : trop court → coup normal. La touche répond TOUJOURS.
      this.emit({ type: "charge", etat: "annulee" });
      this.pressAttack(nowMs);
      return;
    }

    this.emit({ type: "charge", etat: "relachee" });
    if (!this.demarrer(this.attaqueChargee, nowMs, false)) {
      // Refusée faute d'endurance : `demarrer` a déjà émis le refus, mais la
      // boucle de visée tourne toujours à l'écran. Il faut la couper.
      this.emit({ type: "anim", action: "idle" });
    }
  }

  /** Coupe la charge en cours. `rendreLaMain` : rejoue `idle` (la boucle de visée tourne). */
  private annulerCharge(rendreLaMain: boolean): void {
    if (this.chargeDebutMs === null) return;
    this.chargeDebutMs = null;
    this.chargePrete = false;
    this.emit({ type: "charge", etat: "annulee" });
    if (rendreLaMain) this.emit({ type: "anim", action: "idle" });
  }

  /**
   * Encaisse un coup. Renvoie les dégâts RÉELLEMENT subis (réduits si gardés).
   *
   * @returns dégâts appliqués — l'appelant tient le total de PV, pas la machine.
   */
  recevoirCoup(nowMs: number, coup: CoupRecu): number {
    this.update(nowMs);
    const direction = hitDirection(coup.angleRad);

    // Arbitrage 3 : encaisser perd la charge, gardée ou non. La conserver
    // rendrait l'échange favorable à celui qui charge — il encaisse et garde
    // son gros coup.
    this.annulerCharge(false);

    const garde =
      !coup.imblocable &&
      this.gardeActive &&
      dansConeDeGarde(coup.angleRad, this.reglages.coneGardeDeg);

    if (garde) {
      // §7 : coup dans le cône → dégâts réduits, PAS d'interruption, mais un
      // coût d'endurance. C'est ce coût qui empêche la garde permanente.
      const degats = coup.degats * this.reglages.gardePassthrough;
      this.endurance -= this.reglages.gardeCoutEndurance;
      this.derniereActionMs = nowMs;
      this.emit({ type: "encaisse", direction, degats, bloque: true });

      if (this.endurance <= 0) {
        this.endurance = 0;
        this.romprAttaque();
        this.gardeActive = false;
        this.emit({ type: "garde", active: false });
        this.phaseActuelle = "garde_brisee";
        this.finEtatMs = nowMs + this.reglages.gardeBriseeMs;
        this.emit({ type: "garde_brisee" });
        this.emit({ type: "anim", action: "stun" });
      }
      return degats;
    }

    // §4 : `hit` est prioritaire sur tout. Le combo est perdu, y compris en
    // pleine phase active — l'engagement protège de SON PROPRE spam, pas des coups.
    if (this.attaque !== null) this.emit({ type: "combo_reset", raison: "INTERROMPU" });
    this.romprAttaque();
    this.tamponMs = null;
    this.rangCombo = 0;
    if (this.gardeActive) {
      this.gardeActive = false;
      this.emit({ type: "garde", active: false });
    }
    this.phaseActuelle = "hitstun";
    this.finEtatMs = nowMs + this.reglages.hitstunMs;
    this.derniereActionMs = nowMs;
    this.emit({ type: "encaisse", direction, degats: coup.degats, bloque: false });
    this.emit({ type: "anim", action: "hit" });
    return coup.degats;
  }

  // ── Horloge ────────────────────────────────────────────────────────────────

  /**
   * Avance la machine jusqu'à `nowMs`. Idempotent pour un même `nowMs`.
   *
   * À appeler une fois par frame AVANT de lire l'état. Les entrées l'appellent
   * elles-mêmes, donc l'ordre input/update dans la boucle n'a pas d'importance —
   * une source de bug classique supprimée à la racine.
   */
  update(nowMs: number): void {
    const dtMs = Math.max(0, nowMs - this.derniereMajMs);
    this.derniereMajMs = nowMs;

    // États minutés (hitstun, garde brisée) : ils bloquent tout le reste.
    if (this.phaseActuelle === "hitstun" || this.phaseActuelle === "garde_brisee") {
      if (nowMs >= this.finEtatMs) {
        this.phaseActuelle = "neutre";
        this.emit({ type: "anim", action: "idle" });
      }
      this.regenerer(nowMs, dtMs);
      this.majGarde(false);
      return;
    }

    if (this.attaque !== null) this.avancerAttaque(nowMs);

    this.avancerCharge(nowMs, dtMs);
    this.regenerer(nowMs, dtMs);
    this.majGarde(
      this.gardeDemandee &&
        this.endurance > 0 &&
        (this.phaseActuelle === "neutre" || this.phaseActuelle === "recuperation"),
    );
  }

  // ── Interne ────────────────────────────────────────────────────────────────

  private def(): AttackDef {
    // Appelé seulement quand `attaque !== null` : les phases d'attaque sont les
    // seules à y accéder.
    return this.catalogue[this.attaque as AttackId];
  }

  private avancerAttaque(nowMs: number): void {
    const def = this.def();
    const ecoule = nowMs - this.debutAttaqueMs;
    const finStartup = def.startupMs;
    const finActif = finStartup + def.activeMs;
    const finCoup = finActif + def.recoveryMs;

    // §1 : l'impact tombe à la fin de l'anticipation, pas à l'appui.
    if (!this.impactEmis && ecoule >= finStartup) {
      this.impactEmis = true;
      this.emit({ type: "impact", attaque: def.id, degats: def.damage, portee: def.rangeM });
    }

    this.phaseActuelle =
      ecoule < finStartup ? "anticipation" : ecoule < finActif ? "actif" : "recuperation";

    // §2 : la fenêtre n'ouvre que pendant la récupération. `ignorerFenetre` est
    // l'outil de réglage repris de `SetSkipWindowConstraint` (Bacon) : il élargit
    // la fenêtre à TOUTE la récupération pour régler les autres valeurs d'abord.
    const bornes = this.reglages.ignorerFenetre
      ? { debut: finActif, fin: finCoup }
      : { debut: def.windowOpenMs, fin: def.windowCloseMs };
    const dedans = def.next !== null && ecoule >= bornes.debut && ecoule <= bornes.fin;
    if (dedans !== this.fenetreOuverte) {
      this.fenetreOuverte = dedans;
      this.emit({ type: "fenetre", ouverte: dedans, attaque: def.id });
    }

    // Consommation du tampon : c'est ICI, à l'ouverture, que l'appui anticipé
    // ressort (§3). Le faire à l'appui reviendrait à n'avoir aucun tampon.
    if (dedans && this.tamponMs !== null) {
      if (nowMs - this.tamponMs <= this.reglages.bufferTtlMs) {
        this.tamponMs = null;
        this.demarrer(def.next as AttackId, nowMs, true);
        return;
      }
      this.tamponMs = null; // périmé : oublié, sinon il ressortirait plus tard
    }

    if (ecoule >= finCoup) {
      const raison: RaisonReset = def.next === null ? "END_COMBO" : "FENETRE_RATEE";
      this.romprAttaque();
      this.rangCombo = 0;
      this.tamponMs = null;
      this.emit({ type: "combo_reset", raison });
      this.emit({ type: "anim", action: "idle" });
    }
  }

  private demarrer(id: AttackId, nowMs: number, enchaine: boolean): boolean {
    const def = this.catalogue[id];

    // §5 : la ressource est une PORTE, pas une file. Le refus vide aussi le
    // tampon — sinon le coup ressortirait seul dès le retour de l'endurance,
    // sans que le joueur l'ait redemandé.
    if (this.endurance < def.staminaCost) {
      this.tamponMs = null;
      this.emit({ type: "refus", raison: "endurance" });
      return false;
    }

    if (this.fenetreOuverte) {
      this.fenetreOuverte = false;
      this.emit({ type: "fenetre", ouverte: false, attaque: this.attaque as AttackId });
    }

    this.endurance -= def.staminaCost;
    this.derniereActionMs = nowMs;
    this.attaque = id;
    this.debutAttaqueMs = nowMs;
    this.impactEmis = false;
    this.tamponMs = null;
    this.rangCombo = enchaine ? this.rangCombo + 1 : 1;
    this.phaseActuelle = "anticipation";
    if (this.gardeActive) {
      this.gardeActive = false;
      this.emit({ type: "garde", active: false });
    }
    this.emit({ type: "anim", action: def.action });
    return true;
  }

  /** Coupe net l'attaque en cours sans émettre de reset (l'appelant s'en charge). */
  private romprAttaque(): void {
    if (this.fenetreOuverte && this.attaque !== null) {
      this.fenetreOuverte = false;
      this.emit({ type: "fenetre", ouverte: false, attaque: this.attaque });
    }
    this.attaque = null;
    this.impactEmis = false;
    this.phaseActuelle = "neutre";
  }

  private bufferiser(nowMs: number): void {
    // Une seule entrée, écrasée par la suivante : une FILE transformerait un
    // martèlement de touche en enchaînement automatique (§3).
    this.tamponMs = nowMs;
  }

  /** Arbitrage 2 : le maintien coûte de l'endurance, et le seuil se signale. */
  private avancerCharge(nowMs: number, dtMs: number): void {
    if (this.chargeDebutMs === null) return;

    this.endurance -= (this.reglages.chargeCoutParSec * dtMs) / 1000;
    // Marque l'activité : sans ça, `regenerer` rendrait l'endurance en même
    // temps que la charge la consomme — le drain serait invisible.
    this.derniereActionMs = nowMs;

    if (!this.chargePrete && nowMs - this.chargeDebutMs >= this.reglages.chargeSeuilMs) {
      this.chargePrete = true;
      this.emit({ type: "charge", etat: "prete" });
    }

    if (this.endurance <= 0) {
      this.endurance = 0;
      this.annulerCharge(true);
    }
  }

  private regenerer(nowMs: number, dtMs: number): void {
    if (this.phaseActuelle !== "neutre" && this.phaseActuelle !== "garde_brisee") return;
    if (this.gardeActive) return;          // garder empêche de récupérer
    if (this.chargeDebutMs !== null) return; // charger aussi (arbitrage 2)
    if (nowMs - this.derniereActionMs < this.reglages.enduranceRegenDelaiMs) return;
    this.endurance = Math.min(
      this.reglages.enduranceMax,
      this.endurance + (this.reglages.enduranceRegenParSec * dtMs) / 1000,
    );
  }

  private majGarde(active: boolean): void {
    if (active === this.gardeActive) return;
    this.gardeActive = active;
    this.emit({ type: "garde", active });
    this.emit({ type: "anim", action: active ? "block" : "idle" });
  }

  private emit(ev: CombatEvent): void {
    this.onEvent?.(ev);
  }
}
