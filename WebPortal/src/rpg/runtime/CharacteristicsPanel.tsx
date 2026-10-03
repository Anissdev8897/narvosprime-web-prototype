// ══════════════════════════════════════════════════════════════════════════════
// runtime/CharacteristicsPanel.tsx — Menu Caractéristiques élémentaires (touche K)
// ══════════════════════════════════════════════════════════════════════════════

import { Minus, Plus, RotateCcw, X, Sparkles, AlertCircle } from "lucide-react";
import type { PlayerStats } from "../stats/PlayerStats";
import {
  CHAR_ELEMENTS, investPoint, refundPoint, resetElements, elementBonusLabels, spentPoints,
} from "../stats/characteristics";
import { ELEMENTS } from "../elements/elements";

const ACCENT = "#a855f7";

interface Props {
  stats: PlayerStats;
  /** Stats TOTALES (base + équipement + bonus niveaux). Affichées dans le résumé. */
  effective?: PlayerStats;
  onChange: (next: PlayerStats) => void;
  onClose: () => void;
}

/** Stats clés à afficher dans le résumé du perso, avec libellé + couleur. */
const STAT_ROWS: { key: keyof PlayerStats; label: string; color: string; suffix?: string }[] = [
  { key: "maxHp",      label: "PV max",      color: "#ef4444" },
  { key: "maxMana",    label: "Mana max",    color: "#818cf8" },
  { key: "puissance",  label: "Puissance",   color: "#fbbf24" },
  { key: "defense",    label: "Défense",     color: "#06b6d4" },
  { key: "critique",   label: "Critique",    color: "#a3e635", suffix: " %" },
  { key: "initiative", label: "Initiative",  color: "#94a3b8" },
];

export function CharacteristicsPanel({ stats, effective, onChange, onClose }: Props) {
  const points = stats.charPoints;
  const total = effective ?? stats;

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center",
      background: "radial-gradient(circle at center, rgba(8, 12, 28, 0.85) 0%, rgba(2, 3, 10, 0.96) 100%)",
      backdropFilter: "blur(12px)",
      animation: "fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards",
    }}>
      {/* CSS Injection for custom characteristics panel effects */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes panelSlideIn {
          from { transform: scale(0.96) translateY(12px); opacity: 0; }
          to { transform: scale(1) translateY(0); opacity: 1; }
        }
        .char-panel {
          animation: panelSlideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .element-row {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1px solid rgba(255, 255, 255, 0.04) !important;
        }
        .element-row:hover {
          transform: translateX(2px);
          background: rgba(255, 255, 255, 0.03) !important;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        }
        .char-btn {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .char-btn:hover:not(:disabled) {
          transform: scale(1.05);
          filter: brightness(1.2);
        }
        .char-btn:active:not(:disabled) {
          transform: scale(0.95);
        }
        .ctrl-btn {
          transition: all 0.2s ease-in-out;
        }
        .ctrl-btn:hover:not(:disabled) {
          transform: scale(1.1);
          filter: brightness(1.25);
        }
        .ctrl-btn:active:not(:disabled) {
          transform: scale(0.9);
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
          background: rgba(168, 85, 247, 0.25);
          border-radius: 4px;
        }
        .scroll-container::-webkit-scrollbar-thumb:hover {
          background: rgba(168, 85, 247, 0.45);
        }
      `}</style>

      <div className="char-panel scroll-container" onClick={(e) => e.stopPropagation()} style={{
        width: 580, maxWidth: "94vw", maxHeight: "90vh", overflow: "auto",
        background: "linear-gradient(180deg, rgba(8, 12, 28, 0.95) 0%, rgba(4, 6, 12, 0.98) 100%)",
        border: `1px solid rgba(168, 85, 247, 0.35)`, borderRadius: 20,
        boxShadow: `0 24px 64px rgba(0, 0, 0, 0.8), 0 0 40px rgba(168, 85, 247, 0.15), inset 0 0 32px rgba(168, 85, 247, 0.02)`,
        padding: 24, display: "flex", flexDirection: "column",
      }}>
        {/* Titre + points dispo */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ color: ACCENT, fontWeight: 900, letterSpacing: "0.25em", fontSize: 20, display: "flex", alignItems: "center", gap: 10, textShadow: "0 0 12px rgba(168, 85, 247, 0.4)" }}>
            <Sparkles size={22} style={{ filter: "drop-shadow(0 0 6px rgba(168, 85, 247, 0.5))" }} /> CARACTÉRISTIQUES
          </h2>
          <button onClick={onClose} className="char-btn" style={btn()}><X size={16} /> Fermer</button>
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18, background: "rgba(0,0,0,0.25)", padding: "10px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.03)" }}>
          <span style={{ color: points > 0 ? "#4ade80" : "#cbd5e1", fontWeight: 800, fontSize: 14.5 }}>
            Points disponibles : <strong style={{ color: points > 0 ? "#4ade80" : ACCENT }}>{points}</strong>
          </span>
        </div>

        {/* ── Résumé des statistiques (base + équipement = total) ───────────── */}
        <div style={{
          marginBottom: 20, padding: "14px 18px",
          background: "rgba(15, 23, 42, 0.4)",
          border: "1px solid rgba(255, 255, 255, 0.05)",
          borderRadius: 12,
        }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "baseline",
            marginBottom: 12,
          }}>
            <span style={{ color: "#5bd6ff", fontSize: 11, letterSpacing: "0.2em", fontWeight: 800, textTransform: "uppercase" }}>
              Statistiques · Niveau {stats.level}
            </span>
            <span style={{ color: "#94a3b8", fontSize: 10, letterSpacing: 0.5 }}>
              base + équipement = <strong style={{ color: "#4ade80" }}>total</strong>
            </span>
          </div>

          {/* Grille 2 colonnes : 6 stats clés */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 20px" }}>
            {STAT_ROWS.map(({ key, label, color, suffix = "" }) => {
              const baseVal  = (stats as unknown as Record<string, unknown>)[key] as number;
              const totalVal = (total as unknown as Record<string, unknown>)[key] as number;
              const bonus    = totalVal - baseVal;
              return (
                <div key={String(key)} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "baseline",
                  fontFamily: "monospace", fontSize: 12.5, borderBottom: "1px solid rgba(255,255,255,0.02)", paddingBottom: 4
                }}>
                  <span style={{ color: "#cbd5e1" }}>{label}</span>
                  <span style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                    <span style={{ color: "#64748b" }}>{baseVal}</span>
                    {bonus !== 0 && (
                      <span style={{ color: bonus > 0 ? "#4ade80" : "#ef4444", fontSize: 11, fontWeight: 700 }}>
                        {bonus > 0 ? "+" : ""}{bonus}
                      </span>
                    )}
                    <span style={{ color, fontWeight: 900, marginLeft: 4, textShadow: `0 0 8px ${color}20` }}>
                      = {totalVal}{suffix}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>

          {/* Ligne PV / Mana courants vs max */}
          <div style={{
            marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.04)",
            display: "flex", justifyContent: "space-between",
            fontFamily: "monospace", fontSize: 11.5, color: "#94a3b8",
          }}>
            <span>
              PV : <strong style={{ color: "#ef4444" }}>{Math.round(stats.currentHp)}</strong> / {total.maxHp}
            </span>
            <span>
              Mana : <strong style={{ color: "#818cf8" }}>{Math.round(stats.currentMana)}</strong> / {total.maxMana}
            </span>
          </div>
        </div>

        {/* Liste des 8 éléments */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
          {CHAR_ELEMENTS.map((el) => {
            const def = ELEMENTS[el];
            const pts = stats.elements[el] ?? 0;
            const bonus = elementBonusLabels(pts);
            return (
              <div key={el} className="element-row" style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 12,
                background: `${def.color}05`, border: `1px solid ${def.color}25`,
              }}>
                {/* Pastille élément */}
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                  background: `radial-gradient(circle at 30% 30%, ${def.emissive}, ${def.color})`,
                  boxShadow: `0 0 12px ${def.color}88`,
                  border: "1.5px solid rgba(255,255,255,0.1)"
                }} />
                {/* Nom + bonus */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: def.color, fontWeight: 800, fontSize: 13.5, textShadow: `0 0 6px ${def.color}15` }}>{def.label}</div>
                  <div style={{ color: "#94a3b8", fontSize: 11, letterSpacing: 0.2 }}>{bonus.dmg} · {bonus.res}</div>
                </div>
                {/* Points investis */}
                <div style={{ fontFamily: "monospace", fontWeight: 850, fontSize: 16, color: pts > 0 ? def.color : "#64748b", minWidth: 32, textAlign: "center" }}>{pts}</div>
                {/* Contrôles −/+ */}
                <button
                  onClick={() => onChange(refundPoint(stats, el))}
                  disabled={pts <= 0}
                  className="ctrl-btn"
                  style={ctrlBtn(pts > 0, "#ef4444")}
                  title="Retirer un point"
                ><Minus size={15} strokeWidth={2.5} /></button>
                <button
                  onClick={() => onChange(investPoint(stats, el))}
                  disabled={points <= 0}
                  className="ctrl-btn"
                  style={ctrlBtn(points > 0, def.color)}
                  title="Investir un point"
                ><Plus size={15} strokeWidth={2.5} /></button>
              </div>
            );
          })}
        </div>

        {/* Réinitialiser */}
        <button
          onClick={() => onChange(resetElements(stats))}
          disabled={spentPoints(stats.elements) === 0}
          className="char-btn"
          style={{
            ...btn(), width: "100%", justifyContent: "center", marginTop: 20,
            background: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.25)", color: "#fca5a5",
            opacity: spentPoints(stats.elements) === 0 ? 0.35 : 1,
            cursor: spentPoints(stats.elements) === 0 ? "not-allowed" : "pointer"
          }}
        >
          <RotateCcw size={16} /> Réinitialiser le build
        </button>
        <p style={{ color: "#64748b", fontSize: 11, marginTop: 12, lineHeight: 1.5, display: "flex", gap: 6, alignItems: "flex-start" }}>
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2, opacity: 0.6 }} />
          <span>
            Chaque point augmente les dégâts de tes sorts de cet élément et ta résistance aux dégâts du même élément.
            Tu gagnes des points à chaque montée de niveau.
          </span>
        </p>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
function btn(): React.CSSProperties {
  return {
    padding: "8px 16px", borderRadius: 10, fontWeight: 800, cursor: "pointer", fontSize: 12,
    border: `1px solid rgba(168, 85, 247, 0.25)`, background: "rgba(168, 85, 247, 0.05)", color: "#fff",
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

