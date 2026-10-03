// ══════════════════════════════════════════════════════════════════════════════
// dialogue/dialogueRunner.ts — Moteur d'exécution des dialogues
//
// Singleton hors-React. Gère l'état d'un dialogue actif :
// navigation entre noeuds, évaluation des conditions, déclenchement des actions.
// ══════════════════════════════════════════════════════════════════════════════

import type {
  DialogueDef,
  DialogueNode,
  DialogueChoice,
  ActiveDialogue,
  DialogueRegistry,
} from "./types";
import { evaluateConditions } from "./conditions";
import { executeActions } from "./actions";

class DialogueRunner {
  private registry: DialogueRegistry = new Map();
  private active: ActiveDialogue | null = null;
  private listeners = new Set<() => void>();

  // ── Registre ──────────────────────────────────────────────────────────────

  /** Enregistre un dialogue dans le catalogue. */
  register(def: DialogueDef): void {
    this.registry.set(def.id, def);
  }

  /** Enregistre plusieurs dialogues. */
  registerAll(defs: DialogueDef[]): void {
    for (const d of defs) this.register(d);
  }

  /** Récupère un dialogue par son id. */
  getDef(id: string): DialogueDef | undefined {
    return this.registry.get(id);
  }

  /** Liste les dialogues disponibles pour un NPC donné. */
  getDialoguesForNpc(npcFolder: string): DialogueDef[] {
    const results: DialogueDef[] = [];
    this.registry.forEach((def) => {
      if (def.npcFolder === npcFolder) results.push(def);
    });
    return results;
  }

  /** Vide le registre (tests). */
  clearRegistry(): void {
    this.registry.clear();
  }

  // ── Session active ────────────────────────────────────────────────────────

  /** Démarre un dialogue par son id. Retourne le noeud initial ou null si verrouillé. */
  start(dialogueId: string): DialogueNode | null {
    const def = this.registry.get(dialogueId);
    if (!def) {
      this.active = null;
      this.notify();
      return null;
    }

    const startNode = def.nodes.find((n) => n.id === def.startNode);
    if (!startNode) {
      this.active = null;
      this.notify();
      return null;
    }

    // Vérifier les conditions d'entrée du noeud de départ
    if (!evaluateConditions(startNode.conditions)) {
      this.active = null;
      this.notify();
      return null;
    }

    this.active = {
      def,
      currentNodeId: def.startNode,
      history: [def.startNode],
      vars: {},
    };

    // Actions onEnter du noeud de départ
    executeActions(startNode.onEnter);

    this.notify();
    return startNode;
  }

  /** Arrête le dialogue en cours. */
  stop(): void {
    if (this.active) {
      const node = this.currentNode();
      if (node) executeActions(node.onExit);
    }
    this.active = null;
    this.notify();
  }

  /**
   * Retourne les choix filtrés par conditions pour le noeud courant.
   * L'UI appelle cette méthode pour afficher les choix, puis appelle
   * goTo(nextNode) avec l'ID du noeud choisi.
   */
  getFilteredChoices(): DialogueChoice[] {
    const node = this.currentNode();
    if (!node || !node.choices) return [];
    return node.choices.filter((c) => evaluateConditions(c.conditions));
  }

  /**
   * Navigue vers un noeud par son ID (appelé par l'UI).
   * Retourne le nouveau noeud ou null si fin de dialogue.
   */
  goTo(nextNodeId: string): DialogueNode | null {
    if (!this.active) return null;

    const node = this.currentNode();
    if (!node) return null;

    // Vérifier que nextNodeId est valide (soit dans les choix directs, soit n'importe quel noeud)
    const def = this.active.def;

    // Actions onExit du noeud courant
    executeActions(node.onExit);

    // Naviguer vers le prochain noeud
    const nextNode = def.nodes.find((n) => n.id === nextNodeId);
    if (!nextNode) {
      // nextNode introuvable → fin du dialogue
      this.active = null;
      this.notify();
      return null;
    }

    // Vérifier les conditions du noeud cible
    if (!evaluateConditions(nextNode.conditions)) {
      this.active = null;
      this.notify();
      return null;
    }

    this.active.currentNodeId = nextNodeId;
    this.active.history.push(nextNodeId);

    // Actions onEnter du nouveau noeud
    executeActions(nextNode.onEnter);

    this.notify();
    return nextNode;
  }

  /**
   * Sélectionne un choix par son index dans la liste FILTRÉE.
   * Utilisé par l'UI après getFilteredChoices().
   */
  selectChoice(filteredIndex: number): DialogueNode | null {
    const choices = this.getFilteredChoices();
    const choice = choices[filteredIndex];
    if (!choice) return null;

    // Actions onSelect du choix
    executeActions(choice.onSelect);

    return this.goTo(choice.nextNode);
  }

  /** Noeud courant, null si aucun dialogue actif. */
  currentNode(): DialogueNode | null {
    if (!this.active) return null;
    return (
      this.active.def.nodes.find(
        (n) => n.id === this.active!.currentNodeId
      ) ?? null
    );
  }

  /** Dialogue actif. */
  getActive(): ActiveDialogue | null {
    return this.active;
  }

  /** true si un dialogue est en cours. */
  get isActive(): boolean {
    return this.active !== null;
  }

  // ── Subscribe (compatible useSyncExternalStore) ──────────────────────────

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }
}

export const dialogueRunner = new DialogueRunner();
