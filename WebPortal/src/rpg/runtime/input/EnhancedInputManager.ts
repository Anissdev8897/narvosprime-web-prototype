// ══════════════════════════════════════════════════════════════════════════════
// input/EnhancedInputManager.ts — Gestionnaire d'input amélioré (EnhancedInput-like)
//
// Orchestre l'ensemble du système : lie les touches brutes aux actions via les
// contextes de mapping, applique les modificateurs, évalue les triggers.
// Remplace progressivement l'InputManager brut.
// ══════════════════════════════════════════════════════════════════════════════

import { InputManager } from '../movement/InputManager';
import { INPUT_ACTION_DEFS_BY_ID, getDefaultMappings } from './InputActionDefs';
import { applyModifiers } from './InputModifiers';
import {
  createTriggerState,
  updateTriggerState,
  evaluateTrigger,
} from './InputTriggers';
import { MappingContext, MappingContextManager } from './MappingContext';
import {
  EContextPriority,
  EInputValueType,
  ETriggerType,
  type TriggerConfig,
  type ModifierConfig,
  type InputActionValue,
  type KeyMapping,
  type TriggerState as TriggerStateType,
  type TriggerOutput,
} from './types';

/**
 * État interne pour une action suivie (keys pressed + trigger eval state).
 */
interface ActionRuntime {
  /** Mapping actuel (touches, modificateurs, trigger). */
  mapping: KeyMapping;
  /** Ensemble des codes touche mappés actuellement enfoncés. */
  pressedKeys: Set<string>;
  /** État du trigger (timestamps, etc.). */
  triggerState: ReturnType<typeof createTriggerState>;
  /** Dernière valeur brute (avant modificateurs). */
  rawValue: InputActionValue;
  /** Dernière valeur après modificateurs. */
  modifiedValue: InputActionValue;
  /** Dernier output du trigger. */
  lastOutput: TriggerOutput;
  /** Valeur maintenue (ex: pour un bouton toggle). */
  heldValue: InputActionValue;
}

export class EnhancedInputManager {
  private rawInput: InputManager;
  private contextMgr = new MappingContextManager();
  private actionStates = new Map<string, ActionRuntime>();
  private mouseLookDX = 0;
  private mouseLookDY = 0;
  private wheelAccum = 0;
  private _enabled = true;

  /** Timestamp de la dernière frame (ms). */
  private now = 0;

  constructor(rawInput: InputManager) {
    this.rawInput = rawInput;
    this.initDefaultContexts();
  }

  // ── Initialisation des contextes par défaut ──────────────────────────────

  private initDefaultContexts(): void {
    this.contextMgr.addContext(new MappingContext('game', EContextPriority.Game));
    this.contextMgr.addContext(new MappingContext('menu', EContextPriority.Menu));
    this.contextMgr.addContext(new MappingContext('dialogue', EContextPriority.Dialogue));
    this.contextMgr.addContext(new MappingContext('ui', EContextPriority.UI));

    // Contexte de jeu actif par défaut
    this.contextMgr.activate('game');

    // Ajoute les mappings par défaut au contexte 'game'
    const gameCtx = this.contextMgr.getContext('game')!;
    const defaults = getDefaultMappings();
    for (const [actionId, keys] of Object.entries(defaults)) {
      const def = INPUT_ACTION_DEFS_BY_ID.get(actionId);
      gameCtx.setMapping(actionId, {
        keys,
        modifiers: def?.defaultModifiers,
        trigger: def?.defaultTrigger,
      });
    }
  }

  // ── Activation/désactivation ─────────────────────────────────────────────

  setEnabled(v: boolean): void {
    this._enabled = v;
    this.rawInput.setEnabled(v);
    if (!v) {
      // Reset des états de trigger
      for (const state of this.actionStates.values()) {
        state.pressedKeys.clear();
        state.triggerState = createTriggerState();
      }
    }
  }

  get enabled(): boolean {
    return this._enabled;
  }

  // ── Gestion des contextes ────────────────────────────────────────────────

  get contextManager(): MappingContextManager {
    return this.contextMgr;
  }

  /** Passe en mode jeu (active 'game', désactive les autres). */
  setGameMode(): void {
    this.contextMgr.deactivateAll();
    this.contextMgr.activate('game');
  }

  /** Passe en mode menu (active 'menu', désactive 'game'). */
  setMenuMode(): void {
    this.contextMgr.deactivateAll();
    this.contextMgr.activate('menu');
  }

  /** Passe en mode dialogue. */
  setDialogueMode(): void {
    this.contextMgr.deactivateAll();
    this.contextMgr.activate('dialogue');
  }

  /** Passe en mode UI (overlay). */
  setUiMode(): void {
    this.contextMgr.deactivateAll();
    this.contextMgr.activate('ui');
  }

  // ── Mise à jour frame ────────────────────────────────────────────────────

  /**
   * Appelé une fois par frame dans la boucle de jeu.
   * Met à jour l'état interne de toutes les actions.
   * @param dt Delta time (secondes)
   */
  update(dt: number): void {
    if (!this._enabled) return;

    this.now = performance.now();

    // 1. Lire la souris et la molette depuis l'InputManager brut
    this.mouseLookDX = this.rawInput['lookDX'] ?? 0;
    this.mouseLookDY = this.rawInput['lookDY'] ?? 0;
    this.wheelAccum = this.rawInput['wheel'] ?? 0;

    // 2. Mettre à jour chaque action
    for (const [actionId, state] of this.actionStates) {
      this.updateAction(actionId, state);
    }

    // 3. Remettre à zéro les accumulateurs consommés
    this.mouseLookDX = 0;
    this.mouseLookDY = 0;
    this.wheelAccum = 0;
  }

  /**
   * Met à jour une action : résout le mapping, lit l'état des touches,
   * applique les modificateurs et évalue le trigger.
   */
  private updateAction(actionId: string, state: ActionRuntime): void {
    // Résoudre le mapping (contexte prioritaire)
    const resolvedMapping = this.contextMgr.resolveMapping(actionId);
    if (!resolvedMapping) return;

    state.mapping = resolvedMapping;

    // Lire l'état brut des touches
    let isPressed = false;
    for (const keyCode of resolvedMapping.keys) {
      if (this.rawInput['keys']?.has(keyCode)) {
        isPressed = true;
        break;
      }
    }

    // Construire la valeur brute selon le type d'action
    const def = INPUT_ACTION_DEFS_BY_ID.get(actionId);
    if (def) {
      state.rawValue = this.buildRawValue(def.valueType, isPressed, actionId);
    } else {
      state.rawValue = isPressed;
    }

    // Appliquer les modificateurs
    const modifiers = resolvedMapping.modifiers ?? [];
    state.modifiedValue = applyModifiers(state.rawValue, modifiers);

    // Évaluer le trigger
    const trigger = resolvedMapping.trigger;
    if (trigger) {
      updateTriggerState(state.triggerState, this.now, isPressed);
      state.lastOutput = evaluateTrigger(state.triggerState, trigger, this.now, state.modifiedValue);
    } else {
      // Pas de trigger → passage direct (Pressed implicite)
      updateTriggerState(state.triggerState, this.now, isPressed);
      state.lastOutput = {
        triggered: state.triggerState.isPressed && !state.triggerState.wasPressed,
        value: state.modifiedValue,
        elapsed: state.triggerState.isPressed ? this.now - state.triggerState.pressStart : 0,
        intensity: state.triggerState.isPressed ? 1 : 0,
      };
    }
  }

  /**
   * Construit la valeur brute pour une action selon son type.
   */
  private buildRawValue(
    valueType: EInputValueType,
    isPressed: boolean,
    actionId: string,
  ): InputActionValue {
    switch (valueType) {
      case EInputValueType.Digital:
        return isPressed;

      case EInputValueType.Axis1D: {
        // Pour Axis1D, on regarde le mapping complet : plusieurs touches
        // forment un axe (ex: W=+1, S=-1 → somme)
        const mapping = this.contextMgr.resolveMapping(actionId);
        if (!mapping) return 0;
        let value = 0;
        for (const key of mapping.keys) {
          if (this.rawInput['keys']?.has(key)) {
            // Les touches "négatives" sont détectées via Negate modifier
            value = 1;
          }
        }
        return value;
      }

      case EInputValueType.Axis2D: {
        // Pour Axis2D, on construit [x, y] à partir des touches
        // Convention : l'action 'move' utilise WASD
        // L'action 'look' utilise la souris
        if (actionId === 'move') {
          const keys = this.rawInput['keys']!;
          return [
            (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) -
            (keys.has('KeyA') || keys.has('KeyQ') || keys.has('ArrowLeft') ? 1 : 0),
            (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) -
            (keys.has('KeyW') || keys.has('KeyZ') || keys.has('ArrowUp') ? 1 : 0),
          ] as [number, number];
        }
        if (actionId === 'look') {
          return [this.mouseLookDX, this.mouseLookDY] as [number, number];
        }
        return [0, 0];
      }

      case EInputValueType.Axis3D:
        return [0, 0, 0] as [number, number, number];

      default:
        return isPressed;
    }
  }

  /**
   * Garantit que l'action a un runtimeState (lazy init).
   */
  private ensureAction(actionId: string): ActionRuntime {
    let state = this.actionStates.get(actionId);
    if (!state) {
      const def = INPUT_ACTION_DEFS_BY_ID.get(actionId);
      const defaults = getDefaultMappings();
      state = {
        mapping: {
          keys: defaults[actionId] ?? [],
          modifiers: def?.defaultModifiers,
          trigger: def?.defaultTrigger,
        },
        pressedKeys: new Set(),
        triggerState: createTriggerState(),
        rawValue: false,
        modifiedValue: false,
        lastOutput: { triggered: false, value: false, elapsed: 0, intensity: 0 },
        heldValue: false,
      };
      this.actionStates.set(actionId, state);
    }
    return state;
  }

  /** Force la MAJ d'une action (appelée manuellement si mapping modifié). */
  markDirty(actionId: string): void {
    const state = this.actionStates.get(actionId);
    if (state) {
      state.triggerState = createTriggerState();
    }
  }

  // ── API de lecture publique ──────────────────────────────────────────────

  /**
   * Retourne true si l'action a été déclenchée cette frame (front montant pour
   * Pressed, une fois après hold pour Hold, etc.).
   */
  triggered(actionId: string): boolean {
    if (!this._enabled) return false;
    const state = this.actionStates.get(actionId);
    return state?.lastOutput.triggered ?? false;
  }

  /**
   * Retourne la valeur maintenue de l'action (continue, ex: axe de mouvement).
   */
  getValue(actionId: string): InputActionValue {
    if (!this._enabled) {
      const def = INPUT_ACTION_DEFS_BY_ID.get(actionId);
      if (!def) return false;
      switch (def.valueType) {
        case EInputValueType.Digital: return false;
        case EInputValueType.Axis1D: return 0;
        case EInputValueType.Axis2D: return [0, 0];
        case EInputValueType.Axis3D: return [0, 0, 0];
      }
    }
    const state = this.actionStates.get(actionId);
    if (!state) {
      // Lazy init
      return this.getValueLazy(actionId);
    }
    return state.modifiedValue;
  }

  private getValueLazy(actionId: string): InputActionValue {
    const def = INPUT_ACTION_DEFS_BY_ID.get(actionId);
    if (!def) return false;

    // Construit la valeur à la volée sans état interne
    const keys = this.rawInput['keys']!;
    let isPressed = false;
    const mapping = this.contextMgr.resolveMapping(actionId);
    if (mapping) {
      for (const key of mapping.keys) {
        if (keys?.has(key)) { isPressed = true; break; }
      }
    }

    switch (def.valueType) {
      case EInputValueType.Digital: return isPressed;
      case EInputValueType.Axis1D: return isPressed ? 1 : 0;
      case EInputValueType.Axis2D: {
        if (actionId === 'move') {
          return [
            (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) -
            (keys.has('KeyA') || keys.has('KeyQ') || keys.has('ArrowLeft') ? 1 : 0),
            (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) -
            (keys.has('KeyW') || keys.has('KeyZ') || keys.has('ArrowUp') ? 1 : 0),
          ] as [number, number];
        }
        return [0, 0];
      }
      case EInputValueType.Axis3D: return [0, 0, 0];
    }
  }

  /**
   * Consomme un événement triggered (retourne true une seule fois).
   * Similaire à `consumeJump()` dans l'InputManager brut.
   */
  consumeTriggered(actionId: string): boolean {
    if (!this._enabled) return false;
    const state = this.actionStates.get(actionId);
    if (!state) return false;
    const t = state.lastOutput.triggered;
    if (t) state.lastOutput = { triggered: false, value: false, elapsed: 0, intensity: 0 };
    return t;
  }

  /**
   * Consomme la valeur actuelle et retourne l'output du trigger.
   */
  consumeOutput(actionId: string): TriggerOutput {
    if (!this._enabled) return { triggered: false, value: false, elapsed: 0, intensity: 0 };
    const state = this.actionStates.get(actionId);
    if (!state) return { triggered: false, value: false, elapsed: 0, intensity: 0 };
    const out = { ...state.lastOutput };
    state.lastOutput = { triggered: false, value: false, elapsed: 0, intensity: 0 };
    return out;
  }

  /** Réinitialise l'état du trigger d'une action. */
  resetAction(actionId: string): void {
    const state = this.actionStates.get(actionId);
    if (state) {
      state.triggerState = createTriggerState();
      state.pressedKeys.clear();
    }
  }

  /**
   * Permet de modifier le mapping d'une action à chaud.
   * Utilisé par l'éditeur de touches.
   */
  setActionMapping(actionId: string, keys: string[], contextName = 'game'): void {
    const ctx = this.contextMgr.getContext(contextName);
    if (!ctx) return;
    const existing = ctx.getMapping(actionId);
    ctx.setMapping(actionId, {
      keys,
      modifiers: existing?.modifiers,
      trigger: existing?.trigger,
    });
    this.resetAction(actionId);
  }

  /** Modifie également les modificateurs d'une action. */
  setActionModifiers(actionId: string, modifiers: ModifierConfig[], contextName = 'game'): void {
    const ctx = this.contextMgr.getContext(contextName);
    if (!ctx) return;
    const existing = ctx.getMapping(actionId);
    ctx.setMapping(actionId, {
      keys: existing?.keys ?? [],
      modifiers,
      trigger: existing?.trigger,
    });
  }

  /** Modifie le trigger d'une action. */
  setActionTrigger(actionId: string, trigger: TriggerConfig, contextName = 'game'): void {
    const ctx = this.contextMgr.getContext(contextName);
    if (!ctx) return;
    const existing = ctx.getMapping(actionId);
    ctx.setMapping(actionId, {
      keys: existing?.keys ?? [],
      modifiers: existing?.modifiers,
      trigger,
    });
    this.resetAction(actionId);
  }

  // ── Raccourcis spécifiques (compatibilité ascendante) ────────────────────
  // Ces accesseurs/méthodes permettent à CharacterController et PlayerRig de
  // continuer à fonctionner sans changement, en lisant les actions via la
  // nouvelle API. Interface identique à InputManager.

  /** Déplacement souris accumulé (pixel) puis remis à zéro. */
  consumeLook(): { dx: number; dy: number } {
    const r = { dx: this.mouseLookDX, dy: this.mouseLookDY };
    this.mouseLookDX = 0;
    this.mouseLookDY = 0;
    return r;
  }

  /**
   * Restitue un front de saut consommé par un autre système (escalade).
   * Même sémantique que InputManager.injectJump().
   */
  injectJump(): void {
    const state = this.actionStates.get('jump');
    if (state) {
      state.lastOutput = { triggered: true, value: true, elapsed: 0, intensity: 1 };
    }
  }

  /** Axe latéral : +1 droite, -1 gauche. */
  get moveX(): number {
    const v = this.getValue('move');
    return Array.isArray(v) ? v[0] : 0;
  }

  /** Axe avant/arrière : +1 arrière, -1 avant. */
  get moveZ(): number {
    const v = this.getValue('move');
    return Array.isArray(v) ? v[1] : 0;
  }

  get sprint(): boolean {
    return this.getValue('sprint') as boolean;
  }

  get jumpHeld(): boolean {
    return this.getValue('jump') as boolean;
  }

  get flyDown(): boolean {
    return this.getValue('flyDown') as boolean;
  }

  get crouchHeld(): boolean {
    return this.getValue('crouch') as boolean;
  }

  consumeJump(): boolean {
    return this.consumeTriggered('jump');
  }

  consumeStabilizeToggle(): boolean {
    return this.consumeTriggered('stabilize');
  }

  consumeWheel(): number {
    const w = this.wheelAccum;
    this.wheelAccum = 0;
    return w;
  }

  consumeViewRequest(): import('../movement/playerState').CameraView | null {
    if (this.consumeTriggered('viewFps')) return 'fps';
    if (this.consumeTriggered('viewTps')) return 'tps';
    return null;
  }
}
