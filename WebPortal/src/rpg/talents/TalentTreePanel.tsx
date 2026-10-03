// ══════════════════════════════════════════════════════════════════════════════
// talents/TalentTreePanel.tsx — Arbre de talents (touche L)
// ══════════════════════════════════════════════════════════════════════════════

import { Minus, Plus, RotateCcw, X, GitBranch, Lock } from "lucide-react";
import type { PlayerStats } from "../stats/PlayerStats";
import { BRANCH_META, talentsByBranch, type TalentBranch, type TalentNode } from "./talentCatalog";
import {
  investTalent, refundTalent, resetTalents,
  talentPointsAvailable, talentUnlocked, talentPointsEarned, LEVELS_PER_TALENT_POINT,
} from "./talentEffects";

const ACCENT = "#38bdf8";
const BRANCHES: TalentBranch[] = ["damage", "survival", "mobility", "mana"];

interface Props {
  stats: PlayerStats;
  onChange: (next: PlayerStats) => void;
  onClose: () => void;
}

export function TalentTreePanel({ stats, onChange, onClose }: Props) {
  const avail = talentPointsAvailable(stats);
  const nextAt = (Math.floor(stats.level / LEVELS_PER_TALENT_POINT) + 1) * LEVELS_PER_TALENT_POINT;

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center",
      background: "radial-gradient(circle at center, rgba(8, 12, 28, 0.85) 0%, rgba(2, 3, 10, 0.96) 100%)",
      backdropFilter: "blur(12px)",
      animation: "fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards",
    }}>
      {/* CSS Injection for premium styles */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes panelSlideIn {
          from { transform: scale(0.96) translateY(12px); opacity: 0; }
          to { transform: scale(1) translateY(0); opacity: 1; }
        }
        .talent-panel {
          animation: panelSlideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .talent-branch {
          transition: all 0.25s ease-in-out;
        }
        .talent-branch:hover {
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5), inset 0 0 20px rgba(255, 255, 255, 0.01);
          transform: translateY(-2px);
        }
        .talent-node {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .talent-node.unlocked-node:hover {
          transform: translateY(-1px);
          background: rgba(30, 41, 59, 0.5) !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }
        .talent-btn {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .talent-btn:hover:not(:disabled) {
          transform: scale(1.1);
          filter: brightness(1.2);
        }
        .talent-btn:active:not(:disabled) {
          transform: scale(0.9);
        }
        .btn-reset {
          transition: all 0.2s ease-in-out;
        }
        .btn-reset:hover:not(:disabled) {
          filter: brightness(1.2);
          box-shadow: 0 4px 15px rgba(56, 189, 248, 0.2);
          transform: translateY(-1px);
        }
        .btn-reset:active:not(:disabled) {
          transform: translateY(0) scale(0.98);
        }
        .scroll-container::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .scroll-container::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
          border-radius: 4px;
        }
        .scroll-container::-webkit-scrollbar-thumb {
          background: rgba(56, 189, 248, 0.2);
          border-radius: 4px;
        }
        .scroll-container::-webkit-scrollbar-thumb:hover {
          background: rgba(56, 189, 248, 0.4);
        }
      `}</style>

      <div className="talent-panel scroll-container" onClick={(e) => e.stopPropagation()} style={{
        width: 880, maxWidth: "96vw", maxHeight: "92vh", overflow: "auto",
        background: "linear-gradient(180deg, rgba(8, 12, 28, 0.95) 0%, rgba(4, 6, 12, 0.98) 100%)",
        border: `1px solid rgba(56, 189, 248, 0.35)`, borderRadius: 20,
        boxShadow: `0 24px 64px rgba(0, 0, 0, 0.8), 0 0 40px rgba(56, 189, 248, 0.15), inset 0 0 32px rgba(56, 189, 248, 0.02)`,
        padding: 24, display: "flex", flexDirection: "column",
      }}>
        {/* Titre & Fermeture */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <h2 style={{ color: ACCENT, fontWeight: 900, letterSpacing: "0.22em", fontSize: 20, display: "flex", alignItems: "center", gap: 10, textShadow: "0 0 12px rgba(56, 189, 248, 0.4)" }}>
            <GitBranch size={22} style={{ filter: "drop-shadow(0 0 6px rgba(56, 189, 248, 0.5))" }} /> ARBRE DE TALENTS
          </h2>
          <button onClick={onClose} className="talent-btn" style={btn()}><X size={16} /> Fermer (L)</button>
        </div>

        {/* Barre d'infos des points */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, background: "rgba(0,0,0,0.25)", padding: "10px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.03)" }}>
          <span style={{ color: avail > 0 ? "#4ade80" : "#94a3b8", fontWeight: 800, fontSize: 14.5, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: avail > 0 ? "#4ade80" : "#64748b", boxShadow: avail > 0 ? "0 0 8px #4ade80" : "none" }} />
            Points disponibles : <strong style={{ color: avail > 0 ? "#4ade80" : "#cbd5e1" }}>{avail}</strong>
          </span>
          <span style={{ color: "#64748b", fontSize: 11.5, letterSpacing: 0.5 }}>
            +1 point tous les <strong style={{ color: ACCENT }}>{LEVELS_PER_TALENT_POINT}</strong> niveaux · prochain au niveau <strong style={{ color: ACCENT }}>{nextAt}</strong>
          </span>
        </div>

        {/* 4 colonnes de branches */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, flex: 1 }}>
          {BRANCHES.map((branch) => {
            const meta = BRANCH_META[branch];
            const nodes = talentsByBranch(branch);
            return (
              <div key={branch} className="talent-branch" style={{
                background: `linear-gradient(180deg, ${meta.color}07 0%, ${meta.color}02 100%)`,
                border: `1px solid ${meta.color}35`,
                borderRadius: 14, padding: 12, display: "flex", flexDirection: "column", gap: 10,
              }}>
                <div style={{
                  color: meta.color, fontWeight: 900, fontSize: 13, textAlign: "center",
                  letterSpacing: "0.12em", borderBottom: `1px solid ${meta.color}25`, paddingBottom: 8, marginBottom: 4,
                  textShadow: `0 0 8px ${meta.color}20`
                }}>
                  {meta.icon} {meta.label.toUpperCase()}
                </div>
                {nodes.map((node) => (
                  <NodeCard key={node.id} node={node} stats={stats} color={meta.color}
                    canInvest={avail > 0}
                    onInvest={() => onChange(investTalent(stats, node.id))}
                    onRefund={() => onChange(refundTalent(stats, node.id))}
                  />
                ))}
              </div>
            );
          })}
        </div>

        {/* Bouton de réinitialisation */}
        <button
          onClick={() => onChange(resetTalents(stats))}
          disabled={avail === talentPointsEarned(stats.level)}
          className="btn-reset"
          style={{
            ...btn(), width: "100%", justifyContent: "center", marginTop: 20,
            background: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.25)", color: "#fca5a5",
            opacity: avail === talentPointsEarned(stats.level) ? 0.35 : 1,
            cursor: avail === talentPointsEarned(stats.level) ? "not-allowed" : "pointer"
          }}
        >
          <RotateCcw size={16} /> Réinitialiser les talents
        </button>
      </div>
    </div>
  );
}

function NodeCard({ node, stats, color, canInvest, onInvest, onRefund }: {
  node: TalentNode; stats: PlayerStats; color: string;
  canInvest: boolean; onInvest: () => void; onRefund: () => void;
}) {
  const rank = stats.talents?.[node.id] ?? 0;
  const unlocked = talentUnlocked(stats, node);
  const maxed = rank >= node.maxRank;

  return (
    <div className={`talent-node ${unlocked ? "unlocked-node" : "locked-node"}`} style={{
      background: rank > 0 ? `${color}0c` : "rgba(15, 23, 42, 0.55)",
      border: `1px solid ${rank > 0 ? `${color}88` : maxed ? "#4ade8088" : "rgba(255, 255, 255, 0.06)"}`,
      borderRadius: 12, padding: "10px 12px", opacity: unlocked ? 1 : 0.4,
      position: "relative",
      boxShadow: rank > 0 ? `0 0 10px ${color}10, inset 0 0 10px ${color}05` : "none",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ color: rank > 0 ? color : unlocked ? "#cbd5e1" : "#64748b", fontWeight: 800, fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
          {!unlocked && <Lock size={10} style={{ color: "#ef4444" }} />}
          {node.name}
        </span>
        <span style={{
          fontFamily: "monospace", fontSize: 11, fontWeight: 800,
          color: maxed ? "#4ade80" : rank > 0 ? color : "#64748b",
          background: maxed ? "rgba(74,222,128,0.1)" : rank > 0 ? `${color}15` : "rgba(255,255,255,0.03)",
          padding: "1px 6px", borderRadius: 4,
          boxShadow: maxed ? "0 0 8px rgba(74,222,128,0.15)" : "none",
          border: maxed ? "1px solid rgba(74,222,128,0.2)" : "1px solid transparent"
        }}>
          {rank}/{node.maxRank}
        </span>
      </div>
      <div style={{ color: unlocked ? "#94a3b8" : "#475569", fontSize: 11, lineHeight: 1.4, marginBottom: 8, minHeight: 32 }}>
        {node.description}
      </div>
      
      {/* Contrôles +/- */}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", borderTop: "1px solid rgba(255,255,255,0.03)", paddingTop: 8 }}>
        <button
          onClick={onRefund}
          disabled={rank <= 0}
          className="talent-btn"
          style={ctrlBtn(rank > 0, "#ef4444")}
          title="Retirer un rang"
        >
          <Minus size={13} strokeWidth={2.5} />
        </button>
        <button
          onClick={onInvest}
          disabled={!canInvest || maxed || !unlocked}
          className="talent-btn"
          style={ctrlBtn(canInvest && !maxed && unlocked, color)}
          title="Investir un rang"
        >
          <Plus size={13} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
function btn(): React.CSSProperties {
  return {
    padding: "8px 16px", borderRadius: 10, fontWeight: 800, cursor: "pointer", fontSize: 12,
    border: `1px solid rgba(56, 189, 248, 0.25)`, background: "rgba(56, 189, 248, 0.05)", color: "#fff",
    display: "flex", alignItems: "center", gap: 8,
  };
}
function ctrlBtn(enabled: boolean, color = "#64748b"): React.CSSProperties {
  return {
    width: 26, height: 26, borderRadius: 8, cursor: enabled ? "pointer" : "not-allowed",
    border: `1px solid ${enabled ? `${color}60` : "rgba(255,255,255,0.05)"}`,
    background: enabled ? `${color}15` : "transparent",
    color: enabled ? color : "#475569", display: "flex", alignItems: "center", justifyContent: "center",
    opacity: enabled ? 1 : 0.4,
  };
}

