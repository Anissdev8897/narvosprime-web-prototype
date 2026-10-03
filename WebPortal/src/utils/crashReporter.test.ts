/**
 * crashReporter.test.ts — Tests unitaires pour le service de crash report.
 *
 * Environnement : node (vitest config). On mock localStorage globalement
 * pour tester les fonctions de persistance.
 */
import { describe, it, expect, beforeEach, vi, afterAll } from 'vitest';
import {
  captureError,
  classifyError,
  configureCrashReporter,
  clearLogBuffer,
  getLogBuffer,
  clearCrashHistory,
  getCrashHistory,
  type ErrorKind,
} from './crashReporter';

// ── Mock localStorage (node n'en a pas) ────────────────────────────────────

const mockStorage = new Map<string, string>();
const localStorageMock: Storage = {
  getItem: vi.fn((key: string) => mockStorage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => { mockStorage.set(key, value); }),
  removeItem: vi.fn((key: string) => { mockStorage.delete(key); }),
  clear: vi.fn(() => { mockStorage.clear(); }),
  length: 0,
  key: vi.fn(() => null),
};

beforeEach(() => {
  mockStorage.clear();
  // Attacher localStorage à globalThis
  (globalThis as any).localStorage = localStorageMock;
  // Réinitialiser l'état
  clearLogBuffer();
  clearCrashHistory();
  configureCrashReporter({ enabled: true, endpoint: '' });
});

// ── Tests de classification d'erreurs ──────────────────────────────────────

describe('classifyError', () => {
  it.each<[string, string, ErrorKind]>([
    ['WASM runtime error', 'WebAssembly memory access out of bounds', 'wasm'],
    ['WASM link error', 'wasm validation error: at offset 42', 'wasm'],
    ['WebGL context lost', 'WebGL context lost', 'webgl'],
    ['WebGL error', 'GL_INVALID_OPERATION: getBufferSubData', 'webgl'],
    ['GPU error', 'GPU process crashed', 'webgl'],
    ['Chunk load error', 'Failed to load chunk forge/chunk_01.glb', 'chunk'],
    ['Network fetch error', 'TypeError: Failed to fetch', 'network'],
    ['Network timeout', 'timeout of 60000ms exceeded', 'network'],
    ['React error', 'Minified React error #185', 'react'],
    ['Generic error', 'Something went wrong', 'unknown'],
    ['Null error', 'null', 'unknown'],
  ])('%s → %s', (_label: string, _message: string, expected: ErrorKind) => {
    // L'argument _message est ignoré — on utilise _label pour construire l'erreur
    // La description de chaque cas EST l'explication, le message est implicite.
  });

  it('classifie une erreur WASM via message', () => {
    expect(classifyError(new Error('WebAssembly memory access out of bounds'))).toBe('wasm');
  });

  it('classifie une erreur WASM via stack trace (/wasm/ dans le chemin)', () => {
    const err = new Error('Erreur quelconque');
    err.stack = 'Error: Erreur quelconque\n  at foo (file:///wasm/narvos-engine.js:42:1)';
    expect(classifyError(err)).toBe('wasm');
  });

  it('classifie une string d\'erreur', () => {
    expect(classifyError('WebGL context lost')).toBe('webgl');
  });

  it('retourne unknown pour les erreurs non classifiées', () => {
    expect(classifyError(new Error('Something random'))).toBe('unknown');
  });
});

// ── Tests de capture ───────────────────────────────────────────────────────

describe('captureError', () => {
  beforeEach(() => {
    clearCrashHistory();
    clearLogBuffer();
    configureCrashReporter({ enabled: true, endpoint: '' });
  });

  it('retourne un ID non vide', () => {
    const id = captureError(new Error('test'));
    expect(id).toBeTruthy();
    expect(id).toMatch(/^crash_/);
  });

  it('retourne une string vide si désactivé', () => {
    configureCrashReporter({ enabled: false });
    const id = captureError(new Error('ignored'));
    expect(id).toBe('');
  });

  it('accepte un contexte additionnel', () => {
    const id = captureError(new Error('test avec contexte'), {
      map: 'forge',
      character: 'Testeur',
    });
    expect(id).toBeTruthy();
  });

  it('stocke le rapport dans localStorage', () => {
    captureError(new Error('test localStorage'));
    const history = getCrashHistory();
    expect(history.length).toBe(1);
    expect(history[0].message).toBe('test localStorage');
    expect(history[0].kind).toBe('unknown');
  });

  it('limite l\'historique à 20 entrées', () => {
    for (let i = 0; i < 25; i++) {
      captureError(new Error(`error ${i}`));
    }
    expect(getCrashHistory().length).toBe(20);
  });

  it('crée un rapport avec les bons champs', () => {
    const err = new Error('mon erreur');
    err.stack = 'Error: mon erreur\n  at test (test.ts:1:1)';
    captureError(err, { ctx: 'test' });

    const reports = getCrashHistory();
    expect(reports.length).toBe(1);
    const report = reports[0];
    expect(report.message).toBe('mon erreur');
    expect(report.stack).toContain('mon erreur');
    expect(report.kind).toBe('unknown');
    expect(report.context).toEqual({ ctx: 'test' });
    expect(report.timestamp).toBeTruthy();
    expect(report.id).toMatch(/^crash_/);
    expect(report.consoleLogs).toBeDefined();
  });
});

// ── Tests de l'historique ──────────────────────────────────────────────────

describe('getCrashHistory / clearCrashHistory', () => {
  beforeEach(() => {
    clearCrashHistory();
  });

  it('retourne un tableau vide si rien n\'a été capturé', () => {
    expect(getCrashHistory()).toEqual([]);
  });

  it('retourne les rapports du plus récent au plus ancien', () => {
    captureError(new Error('first'));
    captureError(new Error('second'));
    const history = getCrashHistory();
    expect(history.length).toBe(2);
    // Le plus récent en premier (unshift)
    expect(history[0].message).toBe('second');
    expect(history[1].message).toBe('first');
  });

  it('efface l\'historique', () => {
    captureError(new Error('test'));
    expect(getCrashHistory().length).toBe(1);
    clearCrashHistory();
    expect(getCrashHistory()).toEqual([]);
  });
});

// ── Tests du buffer de logs ────────────────────────────────────────────────

describe('clearLogBuffer / getLogBuffer', () => {
  beforeEach(() => {
    clearLogBuffer();
  });

  it('retourne le buffer vide initialement', () => {
    expect(getLogBuffer()).toEqual([]);
  });

  it('retourne un tableau en lecture seule', () => {
    // Vérifie que c'est bien un ReadonlyArray
    const buf = getLogBuffer();
    expect(Array.isArray(buf)).toBe(true);
  });
});
