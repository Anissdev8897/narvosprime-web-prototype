// ══════════════════════════════════════════════════════════════════════════════
// runtime/CanvasErrorBoundary.tsx — Filet de sécurité visuel pour le Canvas R3F
//
// Pourquoi : un crash dans le sous-arbre R3F (asset GLB corrompu, HDR fetch
// échoué, WebGL Context Lost, exception JS dans un useFrame) cassait jusqu'ici
// SILENCIEUSEMENT → écran noir, joueur paumé. Cet ErrorBoundary intercepte
// l'erreur AVANT qu'elle ne remonte au React root et affiche un overlay clair
// avec deux issues : recharger la fenêtre (recover) ou retourner au menu.
//
// Différent du CharacterErrorBoundary local (qui return null pour un PNJ
// individuel) : ici on rend un fallback VISIBLE car la perte est globale.
// ══════════════════════════════════════════════════════════════════════════════

import { Component } from "react";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Bouton « Retour au menu » — si fourni, sort du runtime (sinon caché). */
  onExit?: () => void;
}

interface State {
  error: Error | null;
}

export class CanvasErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: unknown, info: unknown): void {
    // eslint-disable-next-line no-console
    console.error("[CanvasErrorBoundary] Crash 3D :", error, info);
  }

  private handleReload = (): void => {
    try {
      window.location.reload();
    } catch { /* ignore */ }
  };

  render() {
    if (!this.state.error) return this.props.children;

    const msg = this.state.error.message || String(this.state.error);

    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "linear-gradient(135deg, #1a0c0c 0%, #050505 100%)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 22, padding: 32, fontFamily: "monospace",
      }}>
        <div style={{
          fontSize: 36, fontWeight: 900, letterSpacing: "0.2em",
          color: "#ff6060", textTransform: "uppercase",
          textShadow: "0 0 30px rgba(255,60,60,0.5)",
        }}>
          ⚠ Erreur du moteur 3D
        </div>

        <div style={{
          maxWidth: 720, color: "#fca5a5", fontSize: 13,
          lineHeight: 1.6, textAlign: "center",
        }}>
          Le rendu 3D a rencontré une erreur fatale. Cela peut venir d'un
          asset manquant, d'une perte du contexte WebGL ou d'une absence de
          connexion (les environnements HDR n'ont pas pu se charger).
        </div>

        <div style={{
          maxWidth: 720, padding: "10px 16px",
          background: "rgba(0,0,0,0.5)", border: "1px solid #44262633",
          borderRadius: 8, color: "#ffb3b3", fontSize: 11,
          whiteSpace: "pre-wrap", wordBreak: "break-word",
        }}>
          {msg}
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
          <button
            onClick={this.handleReload}
            style={{
              padding: "14px 32px", fontSize: 14, fontWeight: 900,
              letterSpacing: "0.2em", textTransform: "uppercase",
              background: "linear-gradient(135deg, #ef4444, #b91c1c)",
              color: "#fff", border: "2px solid #fca5a5",
              borderRadius: 8, cursor: "pointer",
              boxShadow: "0 0 24px rgba(239,68,68,0.4)",
            }}
          >
            Recharger
          </button>
          {this.props.onExit && (
            <button
              onClick={this.props.onExit}
              style={{
                padding: "14px 32px", fontSize: 14, fontWeight: 900,
                letterSpacing: "0.2em", textTransform: "uppercase",
                background: "transparent",
                color: "#fca5a5", border: "2px solid #44262633",
                borderRadius: 8, cursor: "pointer",
              }}
            >
              Retour au menu
            </button>
          )}
        </div>
      </div>
    );
  }
}
