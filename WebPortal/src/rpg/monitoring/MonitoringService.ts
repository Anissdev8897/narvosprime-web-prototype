// ══════════════════════════════════════════════════════════════════════════════
// monitoring/MonitoringService.ts — Service de monitoring production
//
// Collecte en continu :
//   • FPS (RAF loop)
//   • Mémoire JS heap (performance.memory)
//   • VRAM (GPU adapter info, si disponible)
//   • Draw calls (estimation via THREE.info.render)
//   • Temps de chargement (marks/measures)
//   • Erreurs JS non catchées
//
// Export : localStorage toutes les 60 s (historique 24h)
// Alertes : memory > 90 % ou FPS < 20 pendant 5 s
// Crash reports : contexte (position + état du jeu)
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";

// ── Types ────────────────────────────────────────────────────────────────────

export interface MetricsSnapshot {
  timestamp: number;        // Date.now()
  fps: number;
  memoryMB: number;         // JS heap used, en MB
  memoryPercent: number;    // ratio heapUsed / heapLimit (0–100)
  vramMB: number;           // VRAM used (GPU), 0 si indisponible
  drawCalls: number;        // renderer.info.render.calls
  triangles: number;        // renderer.info.render.triangles
  textures: number;         // renderer.info.memory.textures
  geometries: number;       // renderer.info.memory.geometries
  loadDurationMs: number;   // dernier temps de chargement mesuré
  jsErrors: number;         // nombre d'erreurs JS depuis la dernière snapshot
}

export interface CrashReport {
  timestamp: number;
  message: string;
  stack: string;
  /** Contexte au moment du crash */
  context: CrashContext;
}

export interface CrashContext {
  stage: string;            // App stage (game, boot, …)
  characterId?: string;
  mapId?: string;
  fps?: number;
  memoryMB?: number;
  /** Dernière position connue (3D) */
  position?: { x: number; y: number; z: number };
}

export interface AlertEvent {
  timestamp: number;
  type: "memory_high" | "fps_low";
  severity: "warning" | "critical";
  value: number;
  threshold: number;
  message: string;
}

export interface MonitoringState {
  metrics: MetricsSnapshot[];
  alerts: AlertEvent[];
  crashes: CrashReport[];
  /** Horodatage du dernier export localStorage */
  lastExport: number;
}

// ── Clés localStorage ────────────────────────────────────────────────────────

const LS_KEY_METRICS  = "narvos:monitoring:metrics";
const LS_KEY_ALERTS   = "narvos:monitoring:alerts";
const LS_KEY_CRASHES  = "narvos:monitoring:crashes";
const LS_KEY_EXPORT   = "narvos:monitoring:export";

const EXPORT_INTERVAL_MS = 60_000;   // 60 s
const HISTORY_RETENTION  = 24 * 60;  // 24 h de snapshots à 1/min
const ALERT_FPS_THRESHOLD      = 20;
const ALERT_FPS_DURATION_MS    = 5000;  // 5 s consécutives
const ALERT_MEMORY_THRESHOLD   = 90;    // %

// ── Service singleton ───────────────────────────────────────────────────────

class MonitoringService {
  private _renderer: THREE.WebGLRenderer | null = null;
  private _metrics: MetricsSnapshot[] = [];
  private _alerts: AlertEvent[] = [];
  private _crashes: CrashReport[] = [];
  private _jsErrorCount = 0;

  // FPS tracking
  private _frameCount = 0;
  private _lastFpsTime = 0;
  private _currentFps = 0;

  // FPS low alert
  private _fpsLowStart: number | null = null;

  // Memory high alert
  private _memoryHighStart: number | null = null;

  // Load duration (dernière mesure)
  private _lastLoadDurationMs = 0;

  // RAF handle
  private _rafId: number | null = null;
  private _exportTimer: ReturnType<typeof setInterval> | null = null;
  private _running = false;

  // Contexte applicatif
  private _context: CrashContext = {
    stage: "unknown",
  };

  // ── Initialisation ──────────────────────────────────────────────────────

  /** Restaurer l'état depuis localStorage */
  loadPersisted(): void {
    try {
      const m = localStorage.getItem(LS_KEY_METRICS);
      if (m) this._metrics = JSON.parse(m);
      const a = localStorage.getItem(LS_KEY_ALERTS);
      if (a) this._alerts = JSON.parse(a);
      const c = localStorage.getItem(LS_KEY_CRASHES);
      if (c) this._crashes = JSON.parse(c);
    } catch {
      // localStorage peut échouer (quota, privacy mode)
    }
  }

  /** Attacher le renderer Three.js pour les stats GPU */
  attachRenderer(r: THREE.WebGLRenderer): void {
    this._renderer = r;
  }

  /** Mettre à jour le contexte applicatif (appelé depuis App.tsx / RpgGameWorld) */
  updateContext(partial: Partial<CrashContext>): void {
    this._context = { ...this._context, ...partial };
  }

  /** Démarrer la boucle de monitoring (RAF) */
  start(): void {
    if (this._running) return;
    // Hors navigateur (tests vitest en env `node`, process principal Electron),
    // il n'y a pas de boucle d'affichage à échantillonner. Même convention que
    // le reste du projet : sortir proprement plutôt que lever. Le service reste
    // utilisable — `recordCrash`, `updateContext` et les compteurs ne dépendent
    // pas du RAF.
    if (typeof requestAnimationFrame === "undefined") {
      console.warn("[Monitoring] pas de requestAnimationFrame — boucle FPS désactivée");
      return;
    }
    this._running = true;
    this.loadPersisted();
    this._lastFpsTime = performance.now();
    this._frameCount = 0;

    const tick = (now: number) => {
      if (!this._running) return;

      // FPS
      this._frameCount++;
      const elapsed = now - this._lastFpsTime;
      if (elapsed >= 1000) {
        this._currentFps = Math.round((this._frameCount * 1000) / elapsed);
        this._frameCount = 0;
        this._lastFpsTime = now;
      }

      // Snapshot périodique (toutes les ~secondes, on n'enregistre que les stats consolidées)
      this._rafId = requestAnimationFrame(tick);
    };

    // Export timer toutes les 60 s. L'identifiant est CONSERVÉ : sans lui,
    // `stop()` arrêtait le RAF mais laissait le timer tourner à vie, et chaque
    // cycle start/stop en empilait un de plus.
    this._exportTimer = setInterval(() => this._exportSnapshot(), EXPORT_INTERVAL_MS);

    this._rafId = requestAnimationFrame(tick);
  }

  stop(): void {
    this._running = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    if (this._exportTimer !== null) {
      clearInterval(this._exportTimer);
      this._exportTimer = null;
    }
  }

  // ── Construction d'une snapshot ─────────────────────────────────────────

  private _buildSnapshot(): MetricsSnapshot {
    const mem = (performance as any).memory;
    let memoryMB = 0;
    let memoryPercent = 0;
    if (mem) {
      memoryMB = Math.round(mem.usedJSHeapSize / (1024 * 1024));
      const limit = mem.jsHeapSizeLimit || 1;
      memoryPercent = Math.round((mem.usedJSHeapSize / limit) * 100);
    }

    let vramMB = 0;
    // Tentative d'obtenir la VRAM via GPU adapter (Chrome > 110)
    // On ne le fait pas à chaque frame (coûteux) — une seule fois suffit
    // car l'API ne change pas en cours de session.
    if (!this._vramQueried) {
      this._queryVram().then((mb) => { this._vramMB = mb; });
      this._vramQueried = true;
    }
    vramMB = this._vramMB;

    let drawCalls = 0;
    let triangles = 0;
    let textures = 0;
    let geometries = 0;
    if (this._renderer) {
      const info = this._renderer.info;
      drawCalls   = info.render?.calls ?? 0;
      triangles   = info.render?.triangles ?? 0;
      textures    = info.memory?.textures ?? 0;
      geometries  = info.memory?.geometries ?? 0;
    }

    return {
      timestamp: Date.now(),
      fps: this._currentFps,
      memoryMB,
      memoryPercent,
      vramMB,
      drawCalls,
      triangles,
      textures,
      geometries,
      loadDurationMs: this._lastLoadDurationMs,
      jsErrors: this._jsErrorCount,
    };
  }

  private _vramQueried = false;
  private _vramMB = 0;

  private async _queryVram(): Promise<number> {
    try {
      const gpu = (navigator as any).gpu;
      if (!gpu) return 0;
      const adapter = await gpu.requestAdapter();
      if (!adapter) return 0;
      const info = adapter.info;
      // Certains drivers exposent la VRAM via adapter limits
      if (adapter.limits?.maxBufferSize) {
        // approximation : pas de vraie VRAM exposée dans WebGPU
      }
      return 0; // WebGPU n'expose pas la VRAM directement
    } catch {
      return 0;
    }
  }

  // ── Export ──────────────────────────────────────────────────────────────

  private _exportSnapshot(): void {
    const snapshot = this._buildSnapshot();
    // Reset du compteur d'erreurs après snapshot
    this._jsErrorCount = 0;

    // Alerte mémoire
    if (snapshot.memoryPercent > ALERT_MEMORY_THRESHOLD) {
      const now = this._memoryHighStart ?? Date.now();
      this._memoryHighStart = now;
    } else {
      this._memoryHighStart = null;
    }

    // Alerte FPS bas
    if (snapshot.fps > 0 && snapshot.fps < ALERT_FPS_THRESHOLD) {
      if (this._fpsLowStart === null) {
        this._fpsLowStart = Date.now();
      } else if (Date.now() - this._fpsLowStart >= ALERT_FPS_DURATION_MS) {
        this._addAlert({
          timestamp: Date.now(),
          type: "fps_low",
          severity: "critical",
          value: snapshot.fps,
          threshold: ALERT_FPS_THRESHOLD,
          message: `FPS < ${ALERT_FPS_THRESHOLD} depuis ${ALERT_FPS_DURATION_MS / 1000}s (${snapshot.fps} FPS)`,
        });
        this._fpsLowStart = null; // éviter les doublons
      }
    } else {
      this._fpsLowStart = null;
    }

    // Alerte mémoire haute (persistante)
    if (snapshot.memoryPercent > ALERT_MEMORY_THRESHOLD) {
      this._addAlert({
        timestamp: Date.now(),
        type: "memory_high",
        severity: "warning",
        value: snapshot.memoryPercent,
        threshold: ALERT_MEMORY_THRESHOLD,
        message: `Mémoire > ${ALERT_MEMORY_THRESHOLD}% (${snapshot.memoryPercent}%, ${snapshot.memoryMB} MB)`,
      });
    }

    // Ajouter aux historiques
    this._metrics.push(snapshot);
    // Limiter à 24h
    const cutoff = Date.now() - HISTORY_RETENTION * 60_000;
    this._metrics = this._metrics.filter((m) => m.timestamp >= cutoff);
    this._alerts = this._alerts.filter((a) => a.timestamp >= cutoff);

    this._persist();
  }

  private _addAlert(alert: AlertEvent): void {
    // Éviter les doublons à moins de 60 s
    const last = this._alerts[this._alerts.length - 1];
    if (last && last.type === alert.type && (alert.timestamp - last.timestamp) < 60_000) return;
    this._alerts.push(alert);
    this._warnUser(alert);
  }

  private _warnUser(alert: AlertEvent): void {
    const prefix = alert.severity === "critical" ? "⚠️ CRITIQUE" : "⚠️ Warning";
    console.warn(`[Monitoring] ${prefix} — ${alert.message}`);
  }

  private _persist(): void {
    try {
      localStorage.setItem(LS_KEY_METRICS, JSON.stringify(this._metrics));
      localStorage.setItem(LS_KEY_ALERTS, JSON.stringify(this._alerts));
      localStorage.setItem(LS_KEY_CRASHES, JSON.stringify(this._crashes));
      localStorage.setItem(LS_KEY_EXPORT, JSON.stringify(Date.now()));
    } catch {
      // Quota dépassé → nettoyer les plus vieux
      if (this._metrics.length > 100) {
        this._metrics = this._metrics.slice(-100);
      }
      if (this._alerts.length > 50) {
        this._alerts = this._alerts.slice(-50);
      }
    }
  }

  // ── Crash reports ───────────────────────────────────────────────────────

  /** Enregistrer une erreur non catchée avec contexte */
  reportCrash(error: Error, context?: Partial<CrashContext>): void {
    const report: CrashReport = {
      timestamp: Date.now(),
      message: error.message || String(error),
      stack: error.stack || "",
      context: {
        ...this._context,
        ...context,
        fps: this._currentFps,
        memoryMB: this._buildSnapshot().memoryMB,
      },
    };
    this._crashes.push(report);

    // Limiter les crashs stockés
    if (this._crashes.length > 50) {
      this._crashes = this._crashes.slice(-50);
    }

    console.error("[Monitoring] Crash report saved:", report.message);
    this._persist();
  }

  /** Incrémenter le compteur d'erreurs JS */
  incrementJsError(): void {
    this._jsErrorCount++;
  }

  /** Définir le dernier temps de chargement mesuré */
  setLoadDuration(ms: number): void {
    this._lastLoadDurationMs = ms;
  }

  // ── Getters publics (pour le dashboard) ────────────────────────────────

  getAlerts(): AlertEvent[] {
    return [...this._alerts];
  }

  getCrashes(): CrashReport[] {
    return [...this._crashes];
  }

  getMetrics(): MetricsSnapshot[] {
    return [...this._metrics];
  }

  getLatestMetrics(): MetricsSnapshot | null {
    return this._metrics.length > 0 ? this._metrics[this._metrics.length - 1] : null;
  }

  getContext(): CrashContext {
    return { ...this._context };
  }

  getCurrentFps(): number {
    return this._currentFps;
  }

  /** Nombre de crashs depuis le dernier export */
  getCrashCount(): number {
    return this._crashes.length;
  }

  /** Récupérer les erreurs les plus fréquentes (top N) */
  getTopErrors(n = 10): { message: string; count: number; lastSeen: number }[] {
    const freq = new Map<string, { count: number; lastSeen: number }>();
    for (const c of this._crashes) {
      const key = c.message;
      const existing = freq.get(key);
      if (existing) {
        existing.count++;
        if (c.timestamp > existing.lastSeen) existing.lastSeen = c.timestamp;
      } else {
        freq.set(key, { count: 1, lastSeen: c.timestamp });
      }
    }
    return [...freq.entries()]
      .map(([message, data]) => ({ message, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, n);
  }

  /** Effacer toutes les données */
  clear(): void {
    this._metrics = [];
    this._alerts = [];
    this._crashes = [];
    this._jsErrorCount = 0;
    try {
      localStorage.removeItem(LS_KEY_METRICS);
      localStorage.removeItem(LS_KEY_ALERTS);
      localStorage.removeItem(LS_KEY_CRASHES);
      localStorage.removeItem(LS_KEY_EXPORT);
    } catch { /* ignore */ }
  }
}

// ── Singleton exporté ───────────────────────────────────────────────────────

export const monitoringService = new MonitoringService();

// ── Initialisation globale (error listeners) ────────────────────────────────

/**
 * Installer les écouteurs globaux d'erreurs JS non catchées.
 * À appeler UNE FOIS au boot de l'application (dans App.tsx ou main.tsx).
 */
export function installGlobalErrorHandlers(): void {
  if (typeof window === "undefined") return;

  // window.onerror (anciennes erreurs, promesses non catchées)
  window.addEventListener("error", (event: ErrorEvent) => {
    const error = event.error || new Error(event.message);
    monitoringService.reportCrash(error, { stage: monitoringService.getContext().stage });
    monitoringService.incrementJsError();
  });

  // unhandledrejection (promesses reject non catchées)
  window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const error = reason instanceof Error ? reason : new Error(String(reason));
    monitoringService.reportCrash(error, { stage: monitoringService.getContext().stage });
    monitoringService.incrementJsError();
  });

  console.log("[Monitoring] Global error handlers installed");
}
