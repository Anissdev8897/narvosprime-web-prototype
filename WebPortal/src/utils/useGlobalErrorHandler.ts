/**
 * useGlobalErrorHandler.ts — Hook React qui installe window.onerror
 * et window.onunhandledrejection.
 *
 * Monte les handlers globaux au niveau App et les démonte au cleanup.
 * Les erreurs sont routées vers le crash reporter (captureError).
 *
 * Usage :
 *   function App() {
 *     useGlobalErrorHandler();
 *     return <GameErrorBoundary>...</GameErrorBoundary>;
 *   }
 */

import { useEffect, useRef, useState } from 'react';
import { captureError, classifyError } from './crashReporter';

export interface GlobalErrorState {
  /** Nombre total d'erreurs non-catching interceptées. */
  count: number;
  /** Dernière erreur interceptée (null si aucune). */
  lastError: { message: string; kind: string; timestamp: number } | null;
}

/**
 * Installe window.onerror + window.onunhandledrejection.
 * Retourne l'état global des erreurs (compteur + dernière erreur).
 */
export function useGlobalErrorHandler(): GlobalErrorState {
  const [state, setState] = useState<GlobalErrorState>({
    count: 0,
    lastError: null,
  });
  const countRef = useRef(0);

  useEffect(() => {
    // ── Erreurs synchrones (window.onerror) ─────────────────────────────
    const onError = (
      event: Event | string,
      source?: string,
      lineno?: number,
      colno?: number,
      error?: Error,
    ): void => {
      let msg: string;
      let err: unknown;

      if (typeof event === 'string') {
        msg = event;
        err = error ?? new Error(event);
      } else if (event instanceof ErrorEvent) {
        msg = event.message;
        err = event.error ?? event;
      } else {
        msg = String(event);
        err = new Error(msg);
      }

      // Ignore les erreurs déjà attrapées par un ErrorBoundary (elles y sont loggées)
      const stack = err instanceof Error ? err.stack ?? '' : '';
      if (stack.includes('GameErrorBoundary') || stack.includes('CanvasErrorBoundary')) {
        return;
      }

      const kind = classifyError(err);
      const context: Record<string, unknown> = {};
      if (source) context.source = source;
      if (lineno !== undefined) context.lineno = lineno;
      if (colno !== undefined) context.colno = colno;

      captureError(err, { ...context, handler: 'window.onerror' });

      countRef.current += 1;
      setState({
        count: countRef.current,
        lastError: { message: msg, kind, timestamp: Date.now() },
      });

      // Ne pas empêcher le comportement par défaut (le navigateur peut afficher
      // l'erreur dans la console). return false aurait annulé l'event.
    };

    // ── Promise rejections (window.onunhandledrejection) ─────────────────
    const onRejection = (event: PromiseRejectionEvent): void => {
      event.preventDefault(); // ← empêche le warning console redondant

      const err = event.reason instanceof Error
        ? event.reason
        : new Error(String(event.reason));
      const kind = classifyError(err);

      captureError(err, { handler: 'onunhandledrejection', promise: true });

      countRef.current += 1;
      setState({
        count: countRef.current,
        lastError: { message: err.message, kind, timestamp: Date.now() },
      });
    };

    window.addEventListener('error', onError as EventListener);
    window.addEventListener('unhandledrejection', onRejection as EventListener);

    return () => {
      window.removeEventListener('error', onError as EventListener);
      window.removeEventListener('unhandledrejection', onRejection as EventListener);
    };
  }, []);

  return state;
}
