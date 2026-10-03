// ══════════════════════════════════════════════════════════════════════════════
// quests/questStore.ts — État runtime des quêtes (singleton hors-React)
//
// P2 : 8 types d'objectifs, chainage (choix de branche), récompenses étendues,
//      état abandonné, event bridge.
//
// Persistance par PERSONNAGE (clé localStorage = char id).
// Modèle "auto-complétion" : dès que tous les objectifs d'une quête active sont
// remplis, elle bascule en "completed" et les méthodes record*() RETOURNENT sa
// définition. L'appelant octroie la récompense — le store reste pur.
//
// Snapshot IMMUABLE : `get()` renvoie la même référence tant que rien ne change,
// une NOUVELLE référence à chaque mutation → compatible useSyncExternalStore.
// ══════════════════════════════════════════════════════════════════════════════

import { QUESTS, getQuest, type QuestDef, type QuestObjective } from "./questCatalog";
import { loadCharacterDb, saveCharacterDb } from "../persistence/dbStore";
import { eventBus } from "../runtime/core/EventBus";

const DB_KEY = "quests";

/** Progression d'une quête acceptée : un compteur par objectif. */
export interface QuestProgress {
  id: string;
  counts: number[];
  done: boolean;
  /** Pour survive : temps cumulé (secondes) dans la zone de survie. */
  surviveProgress?: number;
  /** Pour escort : ids des PNJs escortés. */
  escortedIds?: string[];
}

export interface QuestState {
  active: QuestProgress[];
  completed: string[];
  /** Quêtes que le joueur a explicitement abandonnées. */
  abandoned: string[];
  /** Choix de branche effectués : { branchQuestId → choiceId }. */
  branchChoices: Record<string, string>;
}

const EMPTY: QuestState = { active: [], completed: [], abandoned: [], branchChoices: {} };

const keyOf = (charId: string) => `narvos:quests:${charId}`;

function sanitize(p: Partial<QuestState> | null | undefined): QuestState {
  return {
    active: Array.isArray(p?.active) ? p!.active.filter((a) => getQuest(a.id)) : [],
    completed: Array.isArray(p?.completed) ? p!.completed.filter((id) => getQuest(id)) : [],
    abandoned: Array.isArray(p?.abandoned) ? p!.abandoned.filter((id) => getQuest(id)) : [],
    branchChoices: (p?.branchChoices && typeof p.branchChoices === "object") ? p.branchChoices : {},
  };
}

function load(charId: string): QuestState {
  if (!charId) return { ...EMPTY };
  try { const raw = localStorage.getItem(keyOf(charId)); return sanitize(raw ? JSON.parse(raw) : null); }
  catch { return { ...EMPTY }; }
}

function objectiveDone(def: QuestDef, i: number, count: number): boolean {
  return count >= (def.objectives[i]?.target ?? Infinity);
}

function questComplete(def: QuestDef, counts: number[]): boolean {
  return def.objectives.every((_, i) => objectiveDone(def, i, counts[i] ?? 0));
}

class QuestStore {
  private charId = "";
  private state: QuestState = EMPTY;
  private listeners = new Set<() => void>();

  /** Initialise/recharge pour un perso. À appeler au boot du gameworld. */
  setCharacter(charId: string): void {
    this.charId = charId;
    this.state = load(charId);
    this.notify();
    if (charId) {
      loadCharacterDb<Partial<QuestState>>(charId, DB_KEY).then((db) => {
        if (db && this.charId === charId) { this.state = sanitize(db); this.notify(); }
      });
    }
  }

  /** Snapshot courant (référence stable entre mutations). */
  get(): QuestState {
    return this.state;
  }

  isActive(id: string): boolean {
    return this.state.active.some((a) => a.id === id);
  }
  isCompleted(id: string): boolean {
    return this.state.completed.includes(id);
  }
  isAbandoned(id: string): boolean {
    return this.state.abandoned.includes(id);
  }

  /** Une quête est proposable si : prérequis complété, ni active, ni terminée, ni abandonnée. */
  isAvailable(def: QuestDef): boolean {
    if (this.isActive(def.id) || this.isCompleted(def.id) || this.isAbandoned(def.id)) return false;
    if (def.requires && !this.isCompleted(def.requires)) return false;
    // Vérifier les branchements : si la quête parente a des branches, le choix doit avoir été fait.
    const parentQuest = def.requires ? getQuest(def.requires) : undefined;
    if (parentQuest?.branches) {
      const chosen = this.state.branchChoices[parentQuest.id];
      if (!chosen) return false;
      const validLeadsTo = parentQuest.branches
        .flatMap((b) => b.choices)
        .filter((c) => c.id === chosen)
        .map((c) => c.leadsTo);
      if (!validLeadsTo.includes(def.id)) return false;
    }
    // Vérifier les groupes exclusifs
    if (def.exclusiveGroup) {
      const groupQuests = QUESTS.filter((q) => q.exclusiveGroup === def.exclusiveGroup && q.id !== def.id);
      if (groupQuests.some((q) => this.isActive(q.id) || this.isCompleted(q.id))) return false;
    }
    return true;
  }

  /** Quêtes proposables sur une map (filtrées par dispo). */
  availableForMap(mapId: string): QuestDef[] {
    return QUESTS.filter((q) => (q.mapId == null || q.mapId === mapId) && this.isAvailable(q));
  }

  /** Accepte une quête (no-op si déjà active/terminée/indisponible). */
  accept(id: string): void {
    const def = getQuest(id);
    if (!def || !this.isAvailable(def)) return;
    const prog: QuestProgress = { id, counts: def.objectives.map(() => 0), done: false };
    const abandoned = this.state.abandoned.filter((a) => a !== id);
    this.state = { ...this.state, active: [...this.state.active, prog], abandoned };
    this.persist();
    this.notify();
  }

  /** Abandonne une quête active (l'ajoute à la liste des abandonnées). */
  abandon(id: string): void {
    if (!this.isActive(id)) return;
    this.state = {
      ...this.state,
      active: this.state.active.filter((a) => a.id !== id),
      abandoned: [...this.state.abandoned, id],
    };
    this.persist();
    this.notify();
  }

  /** Choisit une branche après complétion d'une quête à embranchements. */
  chooseBranch(questId: string, choiceId: string): boolean {
    const def = getQuest(questId);
    if (!def?.branches) return false;
    const allChoices = def.branches.flatMap((b) => b.choices);
    const choice = allChoices.find((c) => c.id === choiceId);
    if (!choice) return false;
    this.state = {
      ...this.state,
      branchChoices: { ...this.state.branchChoices, [questId]: choiceId },
    };
    this.persist();
    this.notify();
    return true;
  }

  /** Retourne les branches disponibles pour une quête complétée (choix pas encore fait). */
  getAvailableBranches(questId: string): QuestDef["branches"] | undefined {
    const def = getQuest(questId);
    if (!def?.branches) return undefined;
    if (this.state.branchChoices[questId]) return undefined;
    if (!this.isCompleted(questId)) return undefined;
    return def.branches;
  }

  // ── Hooks de progression ────────────────────────────────────────────────────

  /** À appeler à chaque kill ennemi. folder = type tué. */
  recordKill(folder?: string): QuestDef[] {
    return this.bump((def, obj) =>
      obj.kind === "kill" && (obj.enemyFolder == null || obj.enemyFolder === folder) ? 1 : 0
    );
  }

  /** À appeler avec la position joueur. Complète les objectifs "reach". */
  recordReach(mapId: string, x: number, z: number): QuestDef[] {
    return this.bump((def, obj) => {
      if (obj.kind !== "reach" || !obj.zone || obj.mapId !== mapId) return 0;
      const dx = x - obj.zone.x;
      const dz = z - obj.zone.z;
      return dx * dx + dz * dz <= obj.zone.radius * obj.zone.radius ? 1 : 0;
    });
  }

  /** À appeler quand l'inventaire change. `have(itemId)` = quantité possédée. */
  recordCollect(have: (itemId: string) => number): QuestDef[] {
    return this.bumpAbsolute((def, obj) =>
      obj.kind === "collect" && obj.itemId ? have(obj.itemId) : null
    );
  }

  /** À appeler quand le joueur parle à un PNJ. */
  recordTalk(npcId: string): QuestDef[] {
    return this.bump((def, obj) =>
      obj.kind === "talk" && (obj.npcId == null || obj.npcId === npcId) ? 1 : 0
    );
  }

  /**
   * À appeler périodiquement (≈1×/s) pendant que le joueur survit.
   * dt = temps écoulé depuis le dernier appel (secondes).
   */
  recordSurvive(dt: number): QuestDef[] {
    return this.apply((def, prog) => {
      const surviveObjs = def.objectives.filter((o) => o.kind === "survive");
      if (surviveObjs.length === 0) return prog.counts;

      const newCounts = [...prog.counts];
      const surviveProgress = prog.surviveProgress ?? 0;
      const newProgress = surviveProgress + dt;

      for (let i = 0; i < def.objectives.length; i++) {
        const obj = def.objectives[i];
        if (obj.kind === "survive") {
          // Survie : le compteur est 0 tant que duration n'est pas atteint, puis target.
          newCounts[i] = newProgress >= (obj.duration ?? 0) ? obj.target : 0;
        }
      }

      prog.surviveProgress = newProgress;
      return newCounts;
    });
  }

  /** À appeler quand un PNJ escorté atteint sa destination. */
  recordEscort(npcId: string): QuestDef[] {
    return this.apply((def, prog) => {
      const escortObjs = def.objectives.filter((o) => o.kind === "escort");
      if (escortObjs.length === 0) return prog.counts;

      const newCounts = [...prog.counts];
      const escorted = prog.escortedIds ?? [];

      for (let i = 0; i < def.objectives.length; i++) {
        const obj = def.objectives[i];
        if (obj.kind === "escort") {
          if (!escorted.includes(npcId)) {
            const newEscorted = [...escorted, npcId];
            prog.escortedIds = newEscorted;
            const needed = obj.escortCount ?? 1;
            newCounts[i] = Math.min(obj.target, newEscorted.length >= needed ? 1 : newEscorted.length);
          }
        }
      }

      return newCounts;
    });
  }

  /** À appeler quand le joueur utilise un objet. */
  recordUse(itemId: string): QuestDef[] {
    return this.bump((def, obj) =>
      obj.kind === "use" && (obj.itemId == null || obj.itemId === itemId) ? 1 : 0
    );
  }

  /** À appeler quand le joueur fabrique un objet (craft). */
  recordCraft(itemId: string): QuestDef[] {
    return this.bump((def, obj) =>
      obj.kind === "craft" && (obj.itemId == null || obj.itemId === itemId) ? 1 : 0
    );
  }

  // ── Event Bridge ────────────────────────────────────────────────────────────
  /** Types d'événements pour le pont d'événements. */
  static readonly EVENT_KILL    = "quest:kill";
  static readonly EVENT_COLLECT = "quest:collect";
  static readonly EVENT_REACH   = "quest:reach";
  static readonly EVENT_TALK    = "quest:talk";
  static readonly EVENT_SURVIVE = "quest:survive";
  static readonly EVENT_ESCORT  = "quest:escort";
  static readonly EVENT_USE     = "quest:use";
  static readonly EVENT_CRAFT   = "quest:craft";

  /** Traite un événement générique du pont d'événements. */
  handleEvent(type: string, payload: Record<string, unknown>): QuestDef[] {
    switch (type) {
      case QuestStore.EVENT_KILL:
        return this.recordKill(payload.folder as string | undefined);
      case QuestStore.EVENT_COLLECT:
        return this.recordCollect(payload.have as (itemId: string) => number);
      case QuestStore.EVENT_REACH:
        return this.recordReach(
          payload.mapId as string,
          payload.x as number,
          payload.z as number,
        );
      case QuestStore.EVENT_TALK:
        return this.recordTalk(payload.npcId as string);
      case QuestStore.EVENT_SURVIVE:
        return this.recordSurvive(payload.dt as number);
      case QuestStore.EVENT_ESCORT:
        return this.recordEscort(payload.npcId as string);
      case QuestStore.EVENT_USE:
        return this.recordUse(payload.itemId as string);
      case QuestStore.EVENT_CRAFT:
        return this.recordCraft(payload.itemId as string);
      default:
        return [];
    }
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  // ── Interne ──────────────────────────────────────────────────────────────────

  /** INC RÉMENT (delta ≥ 0) à chaque objectif. */
  private bump(deltaFn: (def: QuestDef, obj: QuestObjective) => number): QuestDef[] {
    return this.apply((def, prog) =>
      def.objectives.map((obj, i) => {
        if (obj.kind === "survive" || obj.kind === "escort") return prog.counts[i] ?? 0;
        const d = deltaFn(def, obj);
        return d > 0 ? Math.min(obj.target, (prog.counts[i] ?? 0) + d) : prog.counts[i] ?? 0;
      })
    );
  }

  /** Valeur ABSOLUE (ex: "possède N items"). `valueFn` retourne null pour inchangé. */
  private bumpAbsolute(valueFn: (def: QuestDef, obj: QuestObjective) => number | null): QuestDef[] {
    return this.apply((def, prog) =>
      def.objectives.map((obj, i) => {
        if (obj.kind === "survive" || obj.kind === "escort") return prog.counts[i] ?? 0;
        const v = valueFn(def, obj);
        return v == null ? prog.counts[i] ?? 0 : Math.min(obj.target, v);
      })
    );
  }

  /** Cœur commun : recompute counts, détecte les complétions, mute l'état. */
  private apply(
    nextCountsFn: (def: QuestDef, prog: QuestProgress) => number[]
  ): QuestDef[] {
    const justCompleted: QuestDef[] = [];
    let changed = false;
    const stillActive: QuestProgress[] = [];
    const newlyCompletedIds: string[] = [];

    for (const a of this.state.active) {
      const def = getQuest(a.id);
      if (!def) { changed = true; continue; }

      const prog: QuestProgress = { ...a, counts: [...a.counts] };
      if (a.surviveProgress !== undefined) prog.surviveProgress = a.surviveProgress;
      if (a.escortedIds) prog.escortedIds = [...a.escortedIds];

      const counts = nextCountsFn(def, prog);
      const countsChanged = counts.some((c, i) => c !== (prog.counts[i] ?? 0));

      if (questComplete(def, counts)) {
        justCompleted.push(def);
        newlyCompletedIds.push(def.id);
        changed = true;
      } else {
        const updatedProg: QuestProgress = {
          ...a,
          counts,
          surviveProgress: prog.surviveProgress,
          escortedIds: prog.escortedIds,
        };
        stillActive.push(countsChanged ? updatedProg : { ...a, counts, surviveProgress: prog.surviveProgress, escortedIds: prog.escortedIds });
        if (countsChanged) changed = true;
      }
    }

    if (!changed) return [];
    this.state = {
      ...this.state,
      active: stillActive,
      completed: [...this.state.completed, ...newlyCompletedIds],
    };
    this.persist();
    this.notify();

    // Émettre un événement quest:complete pour chaque quête terminée.
    // Permet aux handlers (récompenses, UI, chaînage) de réagir sans
    // dépendre de l'appelant qui a déclenché le record*().
    for (const def of justCompleted) {
      eventBus.emit("quest:complete", { questId: def.id, title: def.title });
    }

    return justCompleted;
  }

  private persist(): void {
    if (!this.charId) return;
    try { localStorage.setItem(keyOf(this.charId), JSON.stringify(this.state)); }
    catch { /* quota / privé */ }
    saveCharacterDb(this.charId, DB_KEY, this.state);
  }

  private notify(): void {
    for (const fn of this.listeners) fn();
  }
}

export const questStore = new QuestStore();
