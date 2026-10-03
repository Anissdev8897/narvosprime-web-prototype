// runtime/testing/testInputBridge.ts
// API de test pour agents IA — exposée sur window.__narvosTest en mode DEV.
// Permet d'injecter des événements clavier/souris et de lire l'état du jeu.

interface TestAPI {
  // ── Entrées clavier ──────────────────────────────────────────────────
  keyDown(key: string, code?: string): void;
  keyUp(key: string, code?: string): void;
  press(key: string, durationMs?: number): Promise<void>;

  // ── Entrées souris ───────────────────────────────────────────────────
  mouseMove(dx: number, dy: number): void;
  mouseDown(button?: number): void;
  mouseUp(button?: number): void;
  click(button?: number): void;
  wheel(deltaY: number): void;

  // ── Séquence prédéfinies ─────────────────────────────────────────────
  walkForward(ms?: number): Promise<void>;
  walkBackward(ms?: number): Promise<void>;
  strafeLeft(ms?: number): Promise<void>;
  strafeRight(ms?: number): Promise<void>;
  jump(): Promise<void>;
  crouch(): Promise<void>;
  sprint(active: boolean): void;
  attack(): Promise<void>;
  aimDownSights(active: boolean): void;

  // ── État du jeu ──────────────────────────────────────────────────────
  getState(): TestGameState;
  registerStateProvider(fn: () => Partial<TestGameState>): void;
  screenshot(): void;
}

interface TestGameState {
  playerPos: { x: number; y: number; z: number } | null;
  cameraView: string;
  currentAction: string;
  fps: number;
  grounded: boolean | null;
  errors: string[];
}

function createTestAPI(): TestAPI {
  const errors: string[] = [];
  let stateProvider: (() => Partial<TestGameState>) | null = null;

  // Capture les erreurs console
  const origError = console.error;
  console.error = (...args: any[]) => {
    errors.push(args.map(String).join(' '));
    origError.apply(console, args);
  };

  function dispatchKey(type: 'keydown' | 'keyup', key: string, code?: string) {
    document.dispatchEvent(new KeyboardEvent(type, {
      key, code: code || `Key${key.toUpperCase()}`,
      bubbles: true, cancelable: true,
    }));
  }

  return {
    keyDown(key, code) { dispatchKey('keydown', key, code); },
    keyUp(key, code) { dispatchKey('keyup', key, code); },

    async press(key, durationMs = 100) {
      dispatchKey('keydown', key);
      await new Promise(r => setTimeout(r, durationMs));
      dispatchKey('keyup', key);
    },

    mouseMove(dx, dy) {
      document.dispatchEvent(new MouseEvent('mousemove', {
        movementX: dx, movementY: dy, bubbles: true,
      }));
    },

    mouseDown(button = 0) {
      document.dispatchEvent(new MouseEvent('mousedown', {
        button, bubbles: true,
      }));
    },

    mouseUp(button = 0) {
      document.dispatchEvent(new MouseEvent('mouseup', {
        button, bubbles: true,
      }));
    },

    click(button = 0) {
      this.mouseDown(button);
      setTimeout(() => this.mouseUp(button), 50);
    },

    wheel(deltaY) {
      document.dispatchEvent(new WheelEvent('wheel', {
        deltaY, bubbles: true,
      }));
    },

    async walkForward(ms = 500) {
      dispatchKey('keydown', 'w');
      await new Promise(r => setTimeout(r, ms));
      dispatchKey('keyup', 'w');
    },

    async walkBackward(ms = 500) {
      dispatchKey('keydown', 's');
      await new Promise(r => setTimeout(r, ms));
      dispatchKey('keyup', 's');
    },

    async strafeLeft(ms = 500) {
      dispatchKey('keydown', 'a');
      await new Promise(r => setTimeout(r, ms));
      dispatchKey('keyup', 'a');
    },

    async strafeRight(ms = 500) {
      dispatchKey('keydown', 'd');
      await new Promise(r => setTimeout(r, ms));
      dispatchKey('keyup', 'd');
    },

    async jump() { await this.press(' '); },
    async crouch() {
      dispatchKey('keydown', 'Control');
      await new Promise(r => setTimeout(r, 300));
      dispatchKey('keyup', 'Control');
    },

    sprint(active) {
      if (active) dispatchKey('keydown', 'Shift');
      else dispatchKey('keyup', 'Shift');
    },

    async attack() {
      this.mouseDown(0);
      await new Promise(r => setTimeout(r, 100));
      this.mouseUp(0);
    },

    aimDownSights(active) {
      if (active) this.mouseDown(2);
      else this.mouseUp(2);
    },

    getState(): TestGameState {
      const live = stateProvider?.() ?? {};
      return {
        playerPos: live.playerPos ?? null,
        cameraView: live.cameraView ?? 'unknown',
        currentAction: live.currentAction ?? 'unknown',
        fps: live.fps ?? 0,
        grounded: live.grounded ?? null,
        errors: [...errors],
      };
    },

    registerStateProvider(fn) {
      stateProvider = fn;
    },

    screenshot() {
      console.log('[TEST] Screenshot requested — utiliser gartos_capture ou browser_get_images');
    },
  };
}

// Monte l'API en mode développement (détecté par NODE_ENV ou présence de Vite HMR)
const isDev = typeof window !== 'undefined' && (
  (window as any).__VITE_HMR__ || 
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1'
);

if (isDev) {
  (window as any).__narvosTest = createTestAPI();
  console.log('[TestBridge] API de test montée sur window.__narvosTest');
  console.log('[TestBridge] Commandes: walkForward(), jump(), attack(), crouch(), sprint(), mouseMove(), keyDown(), press()...');
  console.log('[TestBridge] Bridge fichier actif sur /test-commands.json');

  // ── Bridge fichier : poll /test-commands.json toutes les 500ms ──
  // Mia écrit les commandes dans ce fichier, le jeu les exécute.
  let lastTs = 0;
  const pollBridge = async () => {
    try {
      const res = await fetch('/test-commands.json?_=' + Date.now());
      const data = await res.json();
      if (data.ts > lastTs && data.cmd) {
        lastTs = data.ts;
        const api = (window as any).__narvosTest;
        console.log('[Bridge] Exécution:', data.cmd, data.args);
        if (typeof api[data.cmd] === 'function') {
          api[data.cmd](...data.args);
        }
      }
    } catch(e) { /* fichier pas encore écrit, normal */ }
  };
  setInterval(pollBridge, 500);
}

export {};
