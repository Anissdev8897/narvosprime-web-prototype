/**
 * crashReporter.ts — Service de remontée d'erreurs (client-side).
 *
 * Collecte le contexte (navigateur, URL, timestamp, personnage, map…),
 * stocke les N derniers logs console, et peut envoyer les crashes à un
 * serveur distant (optionnel, désactivé par défaut).
 *
 * Exposé sur window.__crashReporter pour les handlers globaux
 * (window.onerror, window.onunhandledrejection).
 *
 * ⚠ Ce module ne dépend d'aucun framework React — utilisable dans
 * n'importe quel contexte (WASM, three.js, workers).
 */

// ── Configuration ───────────────────────────────────────────────────────────

export interface CrashReporterConfig {
  /** URL du endpoint de crash (POST JSON). Vide = pas d'envoi. */
  endpoint: string;
  /** Nombre max de logs console conservés en mémoire. */
  maxConsoleLogs: number;
  /** Tags fixes ajoutés à chaque rapport (ex: version, build). */
  tags: Record<string, string>;
  /** true = envoie les rapports, false = log seulement. */
  enabled: boolean;
}

const DEFAULT_CONFIG: CrashReporterConfig = {
  endpoint: '',           // ← pas d'envoi par défaut
  maxConsoleLogs: 100,
  tags: {},
  enabled: true,
};

// ── Types ───────────────────────────────────────────────────────────────────

export interface CrashReport {
  id: string;
  timestamp: string;
  url: string;
  userAgent: string;
  message: string;
  stack?: string;
  kind: ErrorKind;
  context?: Record<string, unknown>;
  consoleLogs: string[];
  tags: Record<string, string>;
}

/** Catégories d'erreurs connues. */
export type ErrorKind =
  | 'wasm'
  | 'webgl'
  | 'chunk'
  | 'network'
  | 'react'
  | 'promise'
  | 'unknown';

// ── État interne ────────────────────────────────────────────────────────────

let config: CrashReporterConfig = { ...DEFAULT_CONFIG };
const consoleLogs: string[] = [];
const MAX_CONSOLE_LOGS = DEFAULT_CONFIG.maxConsoleLogs;

// ── Interception console (buffer rotatif) ───────────────────────────────────

/** Remplace console.log/warn/error par une version qui bufferise. */
export function installConsoleCapture(): () => void {
  const origLog   = console.log.bind(console);
  const origWarn  = console.warn.bind(console);
  const origError = console.error.bind(console);

  (console as any).log = (...args: unknown[]) => {
    appendLog('log', args);
    origLog(...args);
  };
  (console as any).warn = (...args: unknown[]) => {
    appendLog('warn', args);
    origWarn(...args);
  };
  (console as any).error = (...args: unknown[]) => {
    appendLog('error', args);
    origError(...args);
  };

  return () => {
    console.log = origLog;
    console.warn = origWarn;
    console.error = origError;
  };
}

function appendLog(level: string, args: unknown[]): void {
  const line = `[${level}] ${args.map((a) => {
    try { return typeof a === 'object' ? JSON.stringify(a) : String(a); }
    catch { return String(a); }
  }).join(' ')}`;
  consoleLogs.push(line);
  if (consoleLogs.length > MAX_CONSOLE_LOGS) consoleLogs.shift();
}

// ── Classification d'erreur ─────────────────────────────────────────────────

export function classifyError(error: unknown): ErrorKind {
  const msg = String(error instanceof Error ? error.message : error).toLowerCase();
  const stack = error instanceof Error ? error.stack ?? '' : '';

  if (msg.includes('wasm') || msg.includes('webassembly') || stack.includes('.wasm') || stack.includes('/wasm/')) {
    return 'wasm';
  }
  if (
    msg.includes('webgl') ||
    msg.includes('context lost') ||
    msg.includes('gl.') ||
    msg.includes('getbuffer') ||
    msg.includes('gpu')
  ) {
    return 'webgl';
  }
  if (
    msg.includes('chunk') ||
    msg.includes('load') && (msg.includes('.glb') || msg.includes('.gltf'))
  ) {
    return 'chunk';
  }
  if (
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('xhr') ||
    msg.includes('timeout') ||
    msg.includes('failed to fetch')
  ) {
    return 'network';
  }
  if (
    msg.includes('minified react error') ||
    msg.includes('react') ||
    msg.includes('rendered fewer hooks')
  ) {
    return 'react';
  }
  return 'unknown';
}

// ── Génération ID unique ────────────────────────────────────────────────────

function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `crash_${ts}_${rand}`;
}

// ── API publique ────────────────────────────────────────────────────────────

/** Reconfigure le crash reporter (fusion partielle). */
export function configureCrashReporter(partial: Partial<CrashReporterConfig>): void {
  config = { ...config, ...partial };
}

/** Remet à zéro le buffer de logs. */
export function clearLogBuffer(): void {
  consoleLogs.length = 0;
}

/** Retourne les logs capturés (les N derniers). */
export function getLogBuffer(): ReadonlyArray<string> {
  return consoleLogs;
}

/**
 * Capture une erreur et produit un rapport.
 * Retourne l'ID du rapport.
 */
export function captureError(
  error: unknown,
  context?: Record<string, unknown>,
): string {
  if (!config.enabled) return '';

  const err = error instanceof Error ? error : new Error(String(error));
  const kind = classifyError(error);
  const report: CrashReport = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    message: err.message,
    stack: err.stack,
    kind,
    context: { ...context },
    consoleLogs: [...consoleLogs],
    tags: { ...config.tags },
  };

  // Log local
  console.warn(
    `[CrashReporter] ${kind.toUpperCase()} — ${report.id}`,
    report.message,
    report.context,
  );

  // Stockage localStorage pour rapport post-mortem
  try {
    if (typeof localStorage !== 'undefined') {
      const history = JSON.parse(localStorage.getItem('narvos:crash_history') || '[]');
      history.unshift(report);
      if (history.length > 20) history.length = 20;
      localStorage.setItem('narvos:crash_history', JSON.stringify(history));
    }
  } catch { /* quota plein → ignoré */ }

  // Envoi serveur (optionnel)
  if (config.endpoint && typeof fetch !== 'undefined') {
    sendReport(report).catch(() => { /* fire-and-forget */ });
  }

  return report.id;
}

async function sendReport(report: CrashReport): Promise<void> {
  const body = JSON.stringify(report);
  // Timeout 5s pour ne pas bloquer
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    await fetch(config.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: controller.signal,
      keepalive: true, // envoyé même si la page se ferme
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Lit l'historique des crashes stocké dans localStorage. */
export function getCrashHistory(): CrashReport[] {
  try {
    if (typeof localStorage !== 'undefined') {
      return JSON.parse(localStorage.getItem('narvos:crash_history') || '[]');
    }
  } catch { /* ignore */ }
  return [];
}

/** Efface l'historique des crashes. */
export function clearCrashHistory(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('narvos:crash_history');
    }
  } catch { /* ignore */ }
}

// ── Exposition globale ──────────────────────────────────────────────────────

if (typeof window !== 'undefined') {
  const w = window as unknown as Record<string, unknown>;
  w.__crashReporter = {
    capture: captureError,
    configure: configureCrashReporter,
    history: getCrashHistory,
    clear: clearCrashHistory,
    classify: classifyError,
    logs: getLogBuffer,
    clearLogs: clearLogBuffer,
  };
}
