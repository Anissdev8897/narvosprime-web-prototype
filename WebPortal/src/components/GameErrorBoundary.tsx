// components/GameErrorBoundary.tsx — capture les erreurs du monde de jeu (RpgGameWorld)
// pour qu'un crash N'EMPORTE PAS toute l'app (écran blanc). Affiche un panneau + retour menu.
import { Component, type ReactNode } from "react";

interface Props { children: ReactNode; onExit?: () => void; }
interface State { error: Error | null; }

export class GameErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State { return { error }; }

  componentDidCatch(error: Error, info: unknown) {
    console.error("[GameErrorBoundary] crash du monde de jeu :", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#02030a", color: "#e2f6ff",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, fontFamily: "monospace", padding: 24 }}>
        <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: "0.3em", color: "#ff6b6b", textShadow: "0 0 30px rgba(255,80,80,.4)" }}>ERREUR MONDE</div>
        <div style={{ color: "#9fb4c8", fontSize: 13, maxWidth: 620, textAlign: "center", lineHeight: 1.7 }}>
          Le monde de jeu a rencontré une erreur — l'application a été préservée.
        </div>
        <code style={{ color: "#ffb877", fontSize: 12, maxWidth: 720, wordBreak: "break-word", textAlign: "center", background: "rgba(255,120,60,.08)", padding: "10px 14px", borderRadius: 6, border: "1px solid #ffb87733" }}>
          {this.state.error.message}
        </code>
        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <button onClick={() => this.setState({ error: null })}
            style={{ padding: "10px 22px", fontWeight: 900, letterSpacing: "0.2em", cursor: "pointer", background: "rgba(34,211,238,.15)", color: "#22d3ee", border: "1px solid #22d3ee", borderRadius: 6, fontFamily: "monospace", textTransform: "uppercase" }}>
            ↺ Réessayer
          </button>
          {this.props.onExit && (
            <button onClick={() => { this.setState({ error: null }); this.props.onExit?.(); }}
              style={{ padding: "10px 22px", fontWeight: 900, letterSpacing: "0.2em", cursor: "pointer", background: "transparent", color: "#9fb4c8", border: "1px solid #334155", borderRadius: 6, fontFamily: "monospace", textTransform: "uppercase" }}>
              ← Menu
            </button>
          )}
        </div>
      </div>
    );
  }
}
