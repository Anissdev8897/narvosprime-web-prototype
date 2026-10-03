// ══════════════════════════════════════════════════════════════════════════════
// npc/NpcController.ts — Cerveau d'un PNJ (logique PURE, sans React/Three rendu)
//
// Machine à états + santé. Aucune dépendance R3F → testable en isolation.
// Le composant Npc.tsx applique le résultat (anim, déplacement, dégâts joueur).
//
//   états : idle ──(joueur dans aggroRange)──▶ chase ──(à portée)──▶ attack
//                ◀───────────(joueur hors leash)───────────┘
//           hp ≤ 0 ──▶ dead (terminal)
// ══════════════════════════════════════════════════════════════════════════════

import type { ActionId } from "../types";

export type NpcState = "idle" | "chase" | "attack" | "dead";

// ── Réglages de désengagement ────────────────────────────────────────────────
// LEASH_MULT : au-delà de aggroRange × ce facteur → abandon immédiat (distance).
// GIVE_UP_TIME : durée (s) sans pouvoir engager (hors aggro OU sans ligne de
//   vue) avant d'abandonner la poursuite (perte de cible).
const LEASH_MULT   = 1.25;
const GIVE_UP_TIME = 3.5;

export interface NpcConfig {
  maxHp: number;
  /** Vitesse de poursuite (m/s). */
  moveSpeed: number;
  /** Rayon de détection : en deçà, le PNJ entre en poursuite. */
  aggroRange: number;
  /** Distance d'attaque : en deçà, le PNJ attaque. */
  attackRange: number;
  /** Délai (s) entre deux attaques. */
  attackCooldown: number;
  /** Dégâts infligés au joueur par attaque. */
  attackDamage: number;
  /** Seuls les ennemis poursuivent/attaquent ; les autres restent idle. */
  hostile: boolean;
}

export interface NpcFrameResult {
  /** Animation à jouer cette frame. */
  action: ActionId;
  /** Le PNJ doit-il avancer vers le joueur ? */
  moving: boolean;
  /** Une attaque vient-elle de partir ? (→ appliquer attackDamage au joueur) */
  attackFired: boolean;
}

/**
 * POLITIQUE IA — décide l'état suivant selon la distance au joueur.
 *
 * Isolée pour être facile à ajuster. Deux garde-fous contre le clignotement :
 *   • attackKeep : reste en "attack" un peu au-delà de attackRange.
 *   • leash      : ne désengage la poursuite qu'au-delà de 1.5× l'aggroRange
 *                  (hystérésis : un PNJ qui chasse "tient" sa cible).
 */
export interface NpcSenses {
  /** Le PNJ a-t-il une LIGNE DE VUE dégagée vers le joueur (pas de mur) ? */
  canSee?: boolean;
  /** Le joueur est-il vivant ? (mort → désengagement complet). */
  playerAlive?: boolean;
}

export function decideNpcState(
  current: NpcState, dist: number, cfg: NpcConfig, senses: NpcSenses = {},
): NpcState {
  const canSee      = senses.canSee ?? true;
  const playerAlive = senses.playerAlive ?? true;

  // Joueur mort ou PNJ non hostile → totalement désengagé.
  if (!cfg.hostile || !playerAlive) return "idle";

  const attackKeep = cfg.attackRange * 1.25;
  const leash      = cfg.aggroRange * 1.5;

  // ── Attaque : UNIQUEMENT avec ligne de vue (pas à travers un mur) ──────────
  if (canSee && dist <= cfg.attackRange) return "attack";
  if (canSee && current === "attack" && dist <= attackKeep) return "attack";
  // ── Poursuite : autorisée même sans LOS (le PNJ se déplace pour contourner
  //    le mur et retrouver une ligne de vue), tant que le joueur est à portée.
  if (dist <= cfg.aggroRange) return "chase";
  if ((current === "chase" || current === "attack") && dist <= leash) return "chase";
  return "idle";
}

export class NpcController {
  hp: number;
  state: NpcState = "idle";
  private cfg: NpcConfig;
  private attackTimer = 0;
  /** Temps écoulé sans pouvoir engager (hors aggro OU sans ligne de vue). */
  private lostTimer = 0;

  constructor(cfg: NpcConfig) {
    this.cfg = cfg;
    this.hp = cfg.maxHp;
  }

  get maxHp(): number { return this.cfg.maxHp; }
  get moveSpeed(): number { return this.cfg.moveSpeed; }
  get attackDamage(): number { return this.cfg.attackDamage; }
  get hostile(): boolean { return this.cfg.hostile; }
  get hpFraction(): number { return Math.max(0, this.hp / this.cfg.maxHp); }
  get alive(): boolean { return this.state !== "dead"; }

  /** Inflige des dégâts ; bascule en "dead" si hp ≤ 0. */
  applyDamage(amount: number): void {
    if (this.state === "dead") return;
    this.hp -= Math.max(0, amount);
    if (this.hp <= 0) {
      this.hp = 0;
      this.state = "dead";
    }
  }

  /** Avance la machine à états d'une frame. `distToPlayer` en mètres.
   *  `senses` = ligne de vue + état vivant du joueur (cf. NpcSenses). */
  update(dt: number, distToPlayer: number, senses: NpcSenses = {}): NpcFrameResult {
    if (this.state === "dead") {
      return { action: "death", moving: false, attackFired: false };
    }

    this.attackTimer = Math.max(0, this.attackTimer - dt);
    const canSee      = senses.canSee ?? true;
    const playerAlive = senses.playerAlive ?? true;

    // Timer de "perte de cible" : monte tant que le PNJ ne peut pas réellement
    // engager (joueur hors aggro OU sans ligne de vue), remis à 0 sinon.
    const canEngage = playerAlive && distToPlayer <= this.cfg.aggroRange && canSee;
    this.lostTimer = canEngage ? 0 : this.lostTimer + dt;

    // ── DÉSENGAGEMENT (retour idle) si UNE condition est remplie ──────────────
    //   • mort du joueur
    //   • distance : au-delà du leash (aggroRange × LEASH_MULT)
    //   • perte de cible : trop longtemps sans pouvoir engager
    const leash = this.cfg.aggroRange * LEASH_MULT;
    if (!playerAlive || distToPlayer > leash || this.lostTimer > GIVE_UP_TIME) {
      this.state = "idle";
      return { action: "idle", moving: false, attackFired: false };
    }

    this.state = decideNpcState(this.state, distToPlayer, this.cfg, { canSee, playerAlive });

    let attackFired = false;
    if (this.state === "attack" && this.attackTimer === 0) {
      this.attackTimer = this.cfg.attackCooldown;
      attackFired = true; // l'attaque "porte" au moment du déclenchement
    }

    const action: ActionId =
      this.state === "attack" ? "attack" :
      this.state === "chase"  ? "run"    :
                                "idle";

    return { action, moving: this.state === "chase", attackFired };
  }
}
