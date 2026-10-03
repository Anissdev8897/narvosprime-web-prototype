// ══════════════════════════════════════════════════════════════════════════════
// input/MappingContext.ts — Contextes de mapping d'input (EnhancedInput-like)
//
// Chaque contexte définit un ensemble de mappings action→touches avec une
// priorité. Quand plusieurs contextes sont actifs, seuls les mappings du
// contexte de plus haute priorité sont actifs.
// ══════════════════════════════════════════════════════════════════════════════

import { EContextPriority, type KeyMapping } from './types';

/**
 * Un contexte de mapping regroupe des associations action→touches
 * avec une priorité. Exemples : "jeu", "menu", "dialogue", "UI".
 */
export class MappingContext {
  readonly name: string;
  readonly priority: EContextPriority;
  private mappings = new Map<string, KeyMapping>();
  private _active = false;

  constructor(name: string, priority: EContextPriority) {
    this.name = name;
    this.priority = priority;
  }

  get active(): boolean {
    return this._active;
  }

  /** Active ce contexte. */
  activate(): void {
    this._active = true;
  }

  /** Désactive ce contexte. */
  deactivate(): void {
    this._active = false;
  }

  /** Ajoute ou met à jour un mapping d'action. */
  setMapping(actionId: string, mapping: KeyMapping): void {
    this.mappings.set(actionId, mapping);
  }

  /** Supprime le mapping d'une action. */
  removeMapping(actionId: string): void {
    this.mappings.delete(actionId);
  }

  /** Récupère le mapping d'une action. */
  getMapping(actionId: string): KeyMapping | undefined {
    return this.mappings.get(actionId);
  }

  /** Tous les IDs d'actions de ce contexte. */
  get actionIds(): IterableIterator<string> {
    return this.mappings.keys();
  }

  /** Tous les mappings de ce contexte. */
  get allMappings(): Map<string, KeyMapping> {
    return this.mappings;
  }

  /** Vide tous les mappings. */
  clear(): void {
    this.mappings.clear();
  }
}

/**
 * Gestionnaire de contextes.
 * Résout quel contexte est actif pour chaque action selon la priorité.
 */
export class MappingContextManager {
  private contexts: MappingContext[] = [];

  /** Ajoute un contexte (remplace par le nom si existant). */
  addContext(context: MappingContext): void {
    const existing = this.contexts.findIndex((c) => c.name === context.name);
    if (existing >= 0) {
      this.contexts[existing] = context;
    } else {
      this.contexts.push(context);
    }
    // Trier par priorité descendante (le plus prioritaire en premier)
    this.contexts.sort((a, b) => b.priority - a.priority);
  }

  /** Retire un contexte par son nom. */
  removeContext(name: string): void {
    this.contexts = this.contexts.filter((c) => c.name !== name);
  }

  /** Récupère un contexte par son nom. */
  getContext(name: string): MappingContext | undefined {
    return this.contexts.find((c) => c.name === name);
  }

  /** Active un contexte par son nom. */
  activate(name: string): void {
    this.getContext(name)?.activate();
  }

  /** Désactive un contexte par son nom. */
  deactivate(name: string): void {
    this.getContext(name)?.deactivate();
  }

  /**
   * Résout le mapping pour une action donnée.
   * Parcourt les contextes actifs par ordre de priorité et retourne le
   * premier mapping trouvé pour cette action.
   */
  resolveMapping(actionId: string): KeyMapping | undefined {
    for (const ctx of this.contexts) {
      if (ctx.active) {
        const mapping = ctx.getMapping(actionId);
        if (mapping) return mapping;
      }
    }
    return undefined;
  }

  /**
   * Vérifie si au moins un contexte actif mappe cette action.
   */
  hasAction(actionId: string): boolean {
    return this.resolveMapping(actionId) !== undefined;
  }

  /** Désactive tous les contextes. */
  deactivateAll(): void {
    for (const ctx of this.contexts) ctx.deactivate();
  }

  /** Active uniquement les contextes spécifiés (désactive les autres). */
  activateOnly(names: string[]): void {
    // `active` est un getter seul : y écrire lève en mode strict (les modules ES
    // le sont toujours). Passer par activate()/deactivate(), qui sont l'API
    // publique de mutation du contexte.
    for (const ctx of this.contexts) {
      if (names.includes(ctx.name)) ctx.activate();
      else ctx.deactivate();
    }
  }

  /** Retourne la liste des noms de contextes actifs. */
  get activeContexts(): string[] {
    return this.contexts.filter((c) => c.active).map((c) => c.name);
  }

  /** Retourne la priorité effective actuelle. */
  get effectivePriority(): EContextPriority {
    for (const ctx of this.contexts) {
      if (ctx.active) return ctx.priority;
    }
    return EContextPriority.UI; // plus faible par défaut
  }
}
