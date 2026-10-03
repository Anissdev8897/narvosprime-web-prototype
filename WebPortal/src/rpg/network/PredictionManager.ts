// ══════════════════════════════════════════════════════════════════════════════
// network/PredictionManager.ts — Prédiction côté client et réconciliation
//
// Architecture (inspirée des FPS networking : Source, Overwatch, Quake) :
//
//   PRÉDICTION CLIENT
//   ─────────────────
//   Le client applique IMMÉDIATEMENT les inputs du joueur à son état local,
//   sans attendre la validation du serveur. Ainsi le joueur ne ressent pas
//   la latence réseau (rendu réactif).
//
//   RÉCONCILIATION SERVEUR
//   ──────────────────────
//   Quand le serveur renvoie l'état autoritaire (via InputAck), le client :
//     1. Sauvegarde l'état avant chaque prédiction (history de snapshots)
//     2. Reçoit la correction du serveur (state correct à tick T)
//     3. Ré-applique TOUS les inputs non encore acquittés par-dessus
//     4. Corrige en douceur (interpolation) pour éviter les téléportations
//
//   CORRECTION SMOOTH
//   ─────────────────
//   Au lieu de téléporter le joueur à la position du serveur, on interpole
//   la correction sur ~100ms (smooth correction) pour un rendu fluide.
//
// Utilisation :
//   import { predictionManager } from "./PredictionManager";
//   predictionManager.pushInput(inputPayload);
//   const predictedState = predictionManager.predict(dt);
//   predictionManager.reconcile(serverCorrection);
// ══════════════════════════════════════════════════════════════════════════════

import { type PlayerInputPayload, type InputAckPayload, type EntityState, PacketCategory, PacketSubType, createPacket } from "./protocol";
import { networkManager } from "./NetworkManager";

// ── Constantes ──────────────────────────────────────────────────────────────

const PREDICTION_DEFAULTS = {
  /** Taille maximale de l'historique des inputs non-acquittés. */
  maxInputHistory: 128,
  /** Taille maximale de l'historique des snapshots (états pré-prédiction). */
  maxSnapshotHistory: 256,
  /** Durée de la correction smooth (ms) — interpolation vers l'état serveur. */
  smoothCorrectionMs: 100,
  /** Seuil de correction (m) — au-delà, on téléporte (correction brutale). */
  snapCorrectionDist: 5.0,
  /** Nombre max de ré-applications d'inputs par réconciliation. */
  maxReapplyInputs: 64,
  /** Intervalle d'envoi des inputs au serveur (ms). */
  inputSendIntervalMs: 33, // ~30 inputs/s
} as const;

// ── Types ───────────────────────────────────────────────────────────────────

/** État prédit du joueur local. */
export interface PredictedState {
  /** Position prédite. */
  pos: [number, number, number];
  /** Rotation (yaw, pitch) — en degrés. */
  yaw: number;
  pitch: number;
  /** Vélocité. */
  vel: [number, number, number];
  /** État d'animation / comportement. */
  state: string;
  /** Santé. */
  health: number;
  /** Flag : en vol / saut. */
  isJumping: boolean;
  /** Flag : accroupi. */
  isCrouching: boolean;
  /** Flag : en course. */
  isRunning: boolean;
}

/** Snapshot de l'état AVANT prédiction (pour rollback). */
interface StateSnapshot {
  /** Tick serveur associé. */
  serverTick: number;
  /** Input sequence number. */
  inputSeq: number;
  /** Timestamp local. */
  ts: number;
  /** État sauvegardé. */
  state: PredictedState;
}

/** Input en attente de confirmation serveur. */
interface PendingInput {
  inputSeq: number;
  ts: number;
  input: PlayerInputPayload;
}

export interface PredictionStats {
  /** Nombre d'inputs prédits localement. */
  inputsPredicted: number;
  /** Nombre de réconciliations reçues. */
  reconciliationsReceived: number;
  /** Nombre de corrections smooth appliquées. */
  smoothCorrections: number;
  /** Nombre de téléportations (corrections brutales). */
  snapCorrections: number;
  /** Taille du buffer d'inputs en attente. */
  pendingInputs: number;
  /** Nombre de ré-applications à la dernière réconciliation. */
  lastReapplyCount: number;
  /** Latence RTT estimée (ms). */
  rttMs: number;
  /** État actuel prédit. */
  currentState: PredictedState;
}

// ── PredictionManager ───────────────────────────────────────────────────────

/**
 * Gestionnaire de prédiction client et réconciliation serveur.
 *
 * Design :
 *   • Maintient un buffer d'inputs non-acquittés et un buffer de snapshots
 *   • Applique la prédiction localement avant confirmation serveur
 *   • Réconcilie avec l'état serveur en ré-appliquant les inputs manquants
 *   • Correction smooth (interpolation) ou snap (téléportation) selon la distance
 *   • Singleton (seul le joueur local est prédit)
 */
export class PredictionManager {
  // ── Privé ────────────────────────────────────────────────────────────────
  private _state: PredictedState = this._defaultState();
  private _serverState: PredictedState = this._defaultState();

  // Buffers
  private _inputHistory: PendingInput[] = [];
  private _snapshotHistory: StateSnapshot[] = [];

  // Séquence
  private _inputSeqCounter = 0;
  private _lastAckedInputSeq = 0;
  private _lastServerTick = 0;

  // Smooth correction
  private _correctionStart: [number, number, number] | null = null;
  private _correctionTarget: [number, number, number] | null = null;
  private _correctionStartTs = 0;

  // Statistiques
  private _inputsPredicted = 0;
  private _reconciliationsReceived = 0;
  private _smoothCorrections = 0;
  private _snapCorrections = 0;
  private _lastReapplyCount = 0;

  // Timeout d'envoi des inputs
  private _lastInputSendTs = 0;

  constructor() {
    // S'abonner aux acquittements d'input du serveur
    networkManager.on("packet", (pkt) => {
      const packet = pkt as { header?: { cat?: string; sub?: string }; data?: unknown };
      if (
        packet?.header?.cat === "input" &&
        packet?.header?.sub === "input:ack"
      ) {
        this.reconcile(packet.data as InputAckPayload);
      }
    });
  }

  // ── Propriétés ────────────────────────────────────────────────────────────

  get state(): PredictedState {
    return { ...this._state };
  }

  get stats(): PredictionStats {
    return {
      inputsPredicted: this._inputsPredicted,
      reconciliationsReceived: this._reconciliationsReceived,
      smoothCorrections: this._smoothCorrections,
      snapCorrections: this._snapCorrections,
      pendingInputs: this._inputHistory.length,
      lastReapplyCount: this._lastReapplyCount,
      rttMs: networkManager.stats.latencyMs,
      currentState: { ...this._state },
    };
  }

  get lastAckedInputSeq(): number {
    return this._lastAckedInputSeq;
  }

  // ── API publique ──────────────────────────────────────────────────────────

  /**
   * Réinitialise l'état prédit.
   * À appeler quand le joueur spawn / respawn.
   */
  reset(pos?: [number, number, number]): void {
    this._state = this._defaultState();
    if (pos) this._state.pos = [...pos];
    this._serverState = { ...this._state };
    this._inputHistory = [];
    this._snapshotHistory = [];
    this._inputSeqCounter = 0;
    this._lastAckedInputSeq = 0;
    this._correctionStart = null;
    this._correctionTarget = null;
  }

  /**
   * Définit l'état initial depuis le serveur.
   */
  setInitialState(state: PredictedState): void {
    this._state = { ...state };
    this._serverState = { ...state };
    this._snapshotHistory = [];
    this._inputHistory = [];
  }

  /**
   * Pousse un input du joueur dans le pipeline de prédiction.
   *
   * 1. Sauvegarde l'état actuel dans l'historique des snapshots
   * 2. Ajoute l'input à la file des inputs en attente
   * 3. L'input sera envoyé au serveur (si le délai est écoulé)
   *
   * @returns Le numéro de séquence de l'input.
   */
  pushInput(input: Omit<PlayerInputPayload, "inputSeq">): number {
    const seq = ++this._inputSeqCounter;

    // Sauvegarder l'état pré-prédiction
    this._snapshotHistory.push({
      serverTick: this._lastServerTick,
      inputSeq: seq,
      ts: performance.now(),
      state: { ...this._state },
    });

    // Limiter la taille de l'historique
    if (this._snapshotHistory.length > PREDICTION_DEFAULTS.maxSnapshotHistory) {
      this._snapshotHistory.shift();
    }

    // Créer l'input complet
    const fullInput: PlayerInputPayload = {
      ...input,
      inputSeq: seq,
      timestamp: performance.now(),
    };

    // Ajouter aux inputs en attente
    this._inputHistory.push({
      inputSeq: seq,
      ts: performance.now(),
      input: fullInput,
    });

    // Limiter la taille
    if (this._inputHistory.length > PREDICTION_DEFAULTS.maxInputHistory) {
      this._inputHistory.shift();
    }

    this._inputsPredicted++;

    // Envoyer au serveur (throttlé)
    this._maybeSendInput(fullInput);

    return seq;
  }

  /**
   * Prédit l'état local à partir des inputs accumulés.
   * À appeler chaque frame.
   *
   * @param dt Delta time (ms) depuis la dernière frame.
   * @returns L'état prédit.
   */
  predict(dt: number): PredictedState {
    const s = this._state;
    const dtSec = dt / 1000;

    // Appliquer la correction smooth si en cours
    this._updateSmoothCorrection(dt);

    // Appliquer les inputs non encore envoyés au serveur
    // (les inputs déjà envoyés sont dans _inputHistory et seront
    //  ré-appliqués pendant la réconciliation)
    for (const pending of this._inputHistory) {
      if (pending.inputSeq <= this._lastAckedInputSeq) continue;
      this._applyInput(s, pending.input, dtSec);
    }

    return { ...s };
  }

  /**
   * Réconcilie l'état local avec la correction du serveur.
   *
   * Algorithme :
   *   1. Trouver le snapshot correspondant au inputSeq acquitté
   *   2. Restaurer cet état
   *   3. Ré-appliquer TOUS les inputs plus récents que l'acquittement
   *   4. Si la différence est grande → correction smooth
   *   5. Si la différence est petite → fusion
   *
   * @param ack Paquet d'acquittement du serveur.
   */
  reconcile(ack: InputAckPayload): void {
    this._reconciliationsReceived++;
    this._lastAckedInputSeq = ack.inputSeq;
    this._lastServerTick = ack.serverTick;

    // Nettoyer les inputs acquittés
    this._inputHistory = this._inputHistory.filter(
      (p) => p.inputSeq > ack.inputSeq,
    );

    // Trouver le snapshot correspondant
    let snapshotIdx = -1;
    for (let i = this._snapshotHistory.length - 1; i >= 0; i--) {
      if (this._snapshotHistory[i].inputSeq <= ack.inputSeq) {
        snapshotIdx = i;
        break;
      }
    }

    if (snapshotIdx === -1) {
      // Pas de snapshot trouvé — on ne peut pas réconcilier proprement
      // Utiliser la correction directe du serveur
      if (ack.correction) {
        this._applyServerCorrection(ack.correction);
      }
      return;
    }

    // Restaurer l'état au moment du snapshot
    const snapshot = this._snapshotHistory[snapshotIdx];
    this._state = { ...snapshot.state };

    // Nettoyer les snapshots plus anciens
    this._snapshotHistory = this._snapshotHistory.slice(snapshotIdx + 1);

    // Ré-appliquer tous les inputs plus récents
    let reapplied = 0;
    for (const pending of this._inputHistory) {
      this._applyInput(this._state, pending.input, 0); // dt=0 → applique l'état
      reapplied++;
    }

    this._lastReapplyCount = reapplied;

    // Si le serveur a envoyé une correction (état autoritaire)
    if (ack.correction) {
      this._applyServerCorrection(ack.correction);
    }
  }

  /**
   * Vide manuellement les inputs acquittés (quand on reçoit un full state sync).
   */
  acknowledgeUpTo(seq: number): void {
    this._lastAckedInputSeq = seq;
    this._inputHistory = this._inputHistory.filter(
      (p) => p.inputSeq > seq,
    );
  }

  // ── Méthodes privées ──────────────────────────────────────────────────────

  private _defaultState(): PredictedState {
    return {
      pos: [0, 0, 0],
      yaw: 0,
      pitch: 0,
      vel: [0, 0, 0],
      state: "idle",
      health: 100,
      isJumping: false,
      isCrouching: false,
      isRunning: false,
    };
  }

  /**
   * Applique un input à l'état prédit.
   * Version simplifiée — la vraie physique sera dans CharacterController.
   */
  private _applyInput(s: PredictedState, input: PlayerInputPayload, _dt: number): void {
    // Direction
    const [dx, dz] = input.moveDir;
    const speed = 5.0; // m/s
    const yawRad = (input.yaw * Math.PI) / 180;

    // Mouvement relatif à la rotation de la caméra
    const forwardX = Math.sin(yawRad) * dx;
    const forwardZ = Math.cos(yawRad) * dx;
    const rightX = Math.cos(yawRad) * dz;
    const rightZ = -Math.sin(yawRad) * dz;

    const moveX = forwardX + rightX;
    const moveZ = forwardZ + rightZ;

    // Appliquer le mouvement
    s.pos[0] += moveX * speed * (_dt || 0.016);
    s.pos[2] += moveZ * speed * (_dt || 0.016);

    // Rotation
    s.yaw = input.yaw;
    s.pitch = input.pitch;

    // Bitfield des boutons
    s.isJumping = (input.buttons & 2) !== 0;
    s.isRunning = (input.buttons & 4) !== 0;
    s.isCrouching = (input.buttons & 8) !== 0;

    // État d'animation
    if (s.isJumping) s.state = "jump";
    else if (s.isRunning && (dx !== 0 || dz !== 0)) s.state = "sprint";
    else if (dx !== 0 || dz !== 0) s.state = "run";
    else s.state = "idle";
  }

  /**
   * Applique une correction du serveur.
   * Si la distance est faible → correction smooth (interpolation).
   * Si la distance est grande → snap (téléportation immédiate).
   */
  private _applyServerCorrection(correction: EntityState): void {
    const curr = this._state;
    const dx = correction.pos[0] - curr.pos[0];
    const dy = correction.pos[1] - curr.pos[1];
    const dz = correction.pos[2] - curr.pos[2];
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (dist > PREDICTION_DEFAULTS.snapCorrectionDist) {
      // Téléportation : correction immédiate
      curr.pos = [...correction.pos];
      if (correction.vel) curr.vel = [...correction.vel];
      if (correction.health !== undefined) curr.health = correction.health;
      this._snapCorrections++;
    } else {
      // Correction smooth
      this._correctionStart = [...curr.pos];
      this._correctionTarget = [...correction.pos];
      this._correctionStartTs = performance.now();
      this._smoothCorrections++;
    }

    // Mettre à jour le reste
    if (correction.state) curr.state = correction.state;
  }

  /**
   * Interpole la position vers la cible de correction.
   * Appelée chaque frame par predict().
   */
  private _updateSmoothCorrection(_dt: number): void {
    if (!this._correctionStart || !this._correctionTarget) return;

    const elapsed = performance.now() - this._correctionStartTs;
    const t = Math.min(1, elapsed / PREDICTION_DEFAULTS.smoothCorrectionMs);

    // Easing quadratique out (décélération)
    const eased = t * (2 - t);

    this._state.pos[0] = this._correctionStart[0] + (this._correctionTarget[0] - this._correctionStart[0]) * eased;
    this._state.pos[1] = this._correctionStart[1] + (this._correctionTarget[1] - this._correctionStart[1]) * eased;
    this._state.pos[2] = this._correctionStart[2] + (this._correctionTarget[2] - this._correctionStart[2]) * eased;

    if (t >= 1) {
      this._correctionStart = null;
      this._correctionTarget = null;
    }
  }

  /**
   * Envoie l'input au serveur (throttlé par inputSendIntervalMs).
   */
  private _maybeSendInput(input: PlayerInputPayload): void {
    const now = performance.now();
    if (now - this._lastInputSendTs < PREDICTION_DEFAULTS.inputSendIntervalMs) {
      return; // Trop tôt pour envoyer
    }
    this._lastInputSendTs = now;

    // Utiliser le NetworkManager pour envoyer au serveur
    const packet = createPacket(
      PacketCategory.Input,
      PacketSubType.PlayerInput,
      input,
    );
    networkManager.send(packet);
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

/** Instance unique du gestionnaire de prédiction. */
export const predictionManager = new PredictionManager();
