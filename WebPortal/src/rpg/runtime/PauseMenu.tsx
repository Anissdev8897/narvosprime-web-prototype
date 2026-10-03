// ══════════════════════════════════════════════════════════════════════════════
// runtime/PauseMenu.tsx — Menu Échap / Pause (overlay React)
// ══════════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { Play, Settings as SettingsIcon, LogOut, X } from "lucide-react";
import { SettingsPanel } from "./SettingsPanel";

interface PauseMenuProps {
  onResume: () => void;
  onExit: () => void;
  onVideoChange: () => void;
}

const ACCENT = "#22d3ee";

export function PauseMenu({ onResume, onExit, onVideoChange }: PauseMenuProps) {
  const [view, setView] = useState<"main" | "settings">("main");

  const btn: React.CSSProperties = {
    width: "100%", padding: "14px 18px", borderRadius: 12, fontWeight: 800,
    textTransform: "uppercase", letterSpacing: "0.18em", fontSize: 13,
    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
    cursor: "pointer", border: `1px solid rgba(34, 211, 238, 0.25)`, background: "rgba(34, 211, 238, 0.05)",
    color: "#fff",
  };
  const wrap: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 80, display: "flex",
    alignItems: "center", justifyContent: "center",
    background: "radial-gradient(circle at center, rgba(8, 16, 36, 0.85) 0%, rgba(2, 3, 10, 0.97) 100%)",
    backdropFilter: "blur(12px)",
    animation: "fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards",
  };
  const panel: React.CSSProperties = {
    width: view === "settings" ? 720 : 380, maxWidth: "92vw", maxHeight: "88vh",
    overflow: "auto",
    background: "linear-gradient(180deg, rgba(8, 12, 28, 0.95) 0%, rgba(4, 6, 12, 0.98) 100%)",
    border: `1px solid rgba(34, 211, 238, 0.35)`,
    borderRadius: 20, padding: 28,
    boxShadow: `0 24px 64px rgba(0, 0, 0, 0.8), 0 0 40px rgba(34, 211, 238, 0.15), inset 0 0 32px rgba(34, 211, 238, 0.02)`,
  };

  if (view === "main") {
    return (
      <div style={wrap}>
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes panelSlideIn {
            from { transform: scale(0.96) translateY(12px); opacity: 0; }
            to { transform: scale(1) translateY(0); opacity: 1; }
          }
          .pause-panel {
            animation: panelSlideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          }
          .btn-sci-fi-cyan {
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          }
          .btn-sci-fi-cyan:hover {
            transform: translateY(-1px);
            filter: brightness(1.2);
            box-shadow: 0 4px 15px rgba(34, 211, 238, 0.25);
            border-color: rgba(34, 211, 238, 0.6) !important;
          }
          .btn-sci-fi-cyan:active {
            transform: translateY(0) scale(0.97);
          }
        `}</style>
        
        <div className="pause-panel" style={panel}>
          <h1 style={{
            textAlign: "center", color: ACCENT, fontWeight: 900, letterSpacing: "0.4em", fontSize: 26, marginBottom: 28,
            textShadow: `0 0 16px rgba(34, 211, 238, 0.6)`, display: "flex", alignItems: "center", justifyContent: "center", gap: 12
          }}>
            PAUSE
          </h1>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button className="btn-sci-fi-cyan" style={{ ...btn, borderColor: ACCENT, background: `rgba(34, 211, 238, 0.15)`, boxShadow: "0 0 15px rgba(34, 211, 238, 0.1)" }} onClick={onResume}><Play size={18} /> Reprendre</button>
            <button className="btn-sci-fi-cyan" style={btn} onClick={() => setView("settings")}><SettingsIcon size={18} /> Paramètres</button>
            <button className="btn-sci-fi-cyan" style={btn} onClick={onExit}><LogOut size={18} /> Retour menu principal</button>
            <button className="btn-sci-fi-cyan" style={{ ...btn, borderColor: "rgba(239, 68, 68, 0.35)", background: "rgba(239, 68, 68, 0.05)", color: "#fca5a5" }} onClick={onExit}><X size={18} /> Quitter</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <style>{`
        .btn-sci-fi-cyan {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .btn-sci-fi-cyan:hover {
          transform: translateY(-1px);
          filter: brightness(1.2);
          box-shadow: 0 4px 15px rgba(34, 211, 238, 0.25);
          border-color: rgba(34, 211, 238, 0.6) !important;
        }
        .btn-sci-fi-cyan:active {
          transform: translateY(0) scale(0.97);
        }
      `}</style>
      <div className="pause-panel" style={panel}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ color: ACCENT, fontWeight: 900, letterSpacing: "0.3em", fontSize: 20, textShadow: `0 0 12px rgba(34, 211, 238, 0.4)` }}>PARAMÈTRES</h2>
          <button className="btn-sci-fi-cyan" style={{ ...btn, width: "auto", padding: "8px 16px" }} onClick={() => setView("main")}><X size={16} /> Retour</button>
        </div>
        <SettingsPanel onVideoChange={onVideoChange} />
      </div>
    </div>
  );
}
