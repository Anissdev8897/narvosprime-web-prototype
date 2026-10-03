// WebPortal/src/rpg/runtime/factions-ai/factionsAI.ts
// IA des factions évolutives (Prompt 11) — logique PURE (testable).
// Règle 1 : trêve d'épuisement entre deux ennemis qui ont chacun subi ≥N pertes
// dans la fenêtre ; reprise automatique à expiration de la trêve.
// Règle 2 : alliance défensive quand une faction subit ≥ALLIANCE_THRESHOLD frappes
// de la même attaquante dans la fenêtre ; une 3e faction neutre devient alliée.
import type { FactionId, FactionRelation } from '../core/worldTypes';

export interface FactionTransition {
  a: FactionId;
  b: FactionId;
  relation: FactionRelation;
}

interface Truce { until: number; }
interface Alliance { a: FactionId; b: FactionId; until: number; }

const FACTIONS_LIST: FactionId[] = ['akarlys', 'mezalayis', 'zayan'];

const WINDOW_MS = 12_000;          // fenêtre de comptage des pertes
const TRUCE_THRESHOLD = 4;         // pertes/faction pour déclencher la trêve
const TRUCE_DURATION_MS = 18_000;  // durée d'une trêve

const ALLIANCE_THRESHOLD = 6;       // frappes victim|attacker pour déclencher l'alliance
const ALLIANCE_DURATION_MS = 25_000; // durée d'une alliance défensive

/** Clé symétrique d'une paire de factions (tri alphabétique). */
const pairKey = (a: FactionId, b: FactionId): string => [a, b].sort().join('|');

/** Clé directionnelle victim|attacker (NON symétrique). */
const aggrKey = (victim: FactionId, attacker: FactionId): string => `${victim}|${attacker}`;

export class FactionsAI {
  private losses = new Map<FactionId, number[]>();
  private truces = new Map<string, Truce>();

  /** Suivi des frappes reçues par faction : clé = "victim|attacker". */
  private aggressions = new Map<string, { count: number; firstAt: number }>();

  /** Alliances défensives actives : clé symétrique pairKey(a, b). */
  private alliances = new Map<string, Alliance>();

  /** Enregistre une perte de vaisseau (à alimenter depuis eventBus 'ship:destroyed'). */
  onShipDestroyed(faction: FactionId, now: number): void {
    const arr = this.losses.get(faction) ?? [];
    arr.push(now);
    this.losses.set(faction, arr);
  }

  /**
   * Enregistre une frappe de combat pour la règle d'alliance défensive.
   * Ignoré si l'un des deux est null ou si même faction (friendly fire).
   */
  onCombatHit(victimFaction: FactionId | null, attackerFaction: FactionId | null, now: number): void {
    if (!victimFaction || !attackerFaction) return;
    if (victimFaction === attackerFaction) return;

    const key = aggrKey(victimFaction, attackerFaction);
    const entry = this.aggressions.get(key);
    if (entry) {
      entry.count++;
    } else {
      this.aggressions.set(key, { count: 1, firstAt: now });
    }
  }

  /**
   * Évalue les transitions à appliquer à `now`. Pure : NE MUTE PAS la matrice globale.
   * L'appelant applique chaque transition via `setRelation`.
   * @param currentRelation accesseur en LECTURE de la matrice actuelle
   */
  tick(now: number, currentRelation: (a: FactionId, b: FactionId) => FactionRelation): FactionTransition[] {
    // Purge des pertes hors fenêtre
    for (const [f, arr] of this.losses) {
      this.losses.set(f, arr.filter((t) => now - t < WINDOW_MS));
    }

    // Purge des aggressions hors fenêtre (basée sur firstAt)
    for (const [key, entry] of this.aggressions) {
      if (now - entry.firstAt >= WINDOW_MS) {
        this.aggressions.delete(key);
      }
    }

    const transitions: FactionTransition[] = [];

    // 1) Reprises : trêves expirées → re-enemy
    for (const [key, truce] of this.truces) {
      if (now >= truce.until) {
        const [a, b] = key.split('|') as [FactionId, FactionId];
        transitions.push({ a, b, relation: 'enemy' });
        this.truces.delete(key);
      }
    }

    // 2) Reprises : alliances expirées → neutral
    for (const [key, alliance] of this.alliances) {
      if (now >= alliance.until) {
        transitions.push({ a: alliance.a, b: alliance.b, relation: 'neutral' });
        this.alliances.delete(key);
      }
    }

    // 3) Trêves d'épuisement : paires actuellement enemy, pas déjà en trêve, seuils atteints
    for (let i = 0; i < FACTIONS_LIST.length; i++) {
      for (let j = i + 1; j < FACTIONS_LIST.length; j++) {
        const a = FACTIONS_LIST[i];
        const b = FACTIONS_LIST[j];
        const key = pairKey(a, b);
        if (this.truces.has(key)) continue;
        if (currentRelation(a, b) !== 'enemy') continue;
        const lossA = (this.losses.get(a) ?? []).length;
        const lossB = (this.losses.get(b) ?? []).length;
        if (lossA >= TRUCE_THRESHOLD && lossB >= TRUCE_THRESHOLD) {
          transitions.push({ a, b, relation: 'neutral' });
          this.truces.set(key, { until: now + TRUCE_DURATION_MS });
          // reset des compteurs pour éviter un re-déclenchement immédiat avant l'expiration
          this.losses.set(a, []);
          this.losses.set(b, []);
        }
      }
    }

    // 4) Alliance défensive : victim a subi ≥ALLIANCE_THRESHOLD frappes de attacker
    for (const [aggressionKey, entry] of this.aggressions) {
      if (entry.count < ALLIANCE_THRESHOLD) continue;

      const [victim, attacker] = aggressionKey.split('|') as [FactionId, FactionId];

      // Chercher une faction C tierce, non ennemie de victim, pas déjà alliée
      const third = FACTIONS_LIST.find((c) => {
        if (c === victim || c === attacker) return false;
        if (currentRelation(victim, c) === 'enemy') return false;
        if (currentRelation(c, victim) === 'enemy') return false;
        const allianceKey = pairKey(victim, c);
        if (this.alliances.has(allianceKey)) return false;
        return true;
      });

      if (third !== undefined) {
        const allianceKey = pairKey(victim, third);
        transitions.push({ a: victim, b: third, relation: 'ally' });
        this.alliances.set(allianceKey, { a: victim, b: third, until: now + ALLIANCE_DURATION_MS });
        // Reset pour éviter rebondissements
        this.aggressions.delete(aggressionKey);
      }
    }

    return transitions;
  }

  /**
   * Garde-fou de cycle de vie : retourne les transitions à appliquer pour RESTAURER les
   * trêves actives à `enemy` ET les alliances actives à `neutral` (état initial).
   * Appelé au démontage du Runner pour éviter que des états persistent dans la matrice
   * globale au-delà du cycle de vie de l'IA.
   */
  dispose(): FactionTransition[] {
    const out: FactionTransition[] = [];
    for (const key of this.truces.keys()) {
      const [a, b] = key.split('|') as [FactionId, FactionId];
      out.push({ a, b, relation: 'enemy' });
    }
    for (const alliance of this.alliances.values()) {
      out.push({ a: alliance.a, b: alliance.b, relation: 'neutral' });
    }
    this.clear();
    return out;
  }

  clear(): void {
    this.losses.clear();
    this.truces.clear();
    this.aggressions.clear();
    this.alliances.clear();
  }
}
