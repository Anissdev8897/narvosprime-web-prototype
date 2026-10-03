// ══════════════════════════════════════════════════════════════════════════════
// quests/QuestJournal.tsx — Journal de quêtes (touche J)
// ══════════════════════════════════════════════════════════════════════════════

import { ScrollText, X, Check, Plus, Trash2, Coins, Sparkles, AlertCircle } from "lucide-react";
import { useQuests } from "./useQuests";
import { questStore } from "./questStore";
import { getQuest, type QuestDef } from "./questCatalog";
import { LOOT_CATALOG } from "../loot/LootRegistry";
import { lootIcon } from "../loaders/launcherAssets";

const ACCENT = "#fbbf24";

interface Props {
  mapId: string;
  onClose: () => void;
  /** Feedback (toast/son) à l'acceptation d'une quête. */
  onAccept?: (def: QuestDef) => void;
}

export function QuestJournal({ mapId, onClose, onAccept }: Props) {
  const { active, completed } = useQuests();
  const available = questStore.availableForMap(mapId);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center",
      background: "radial-gradient(circle at center, rgba(8, 12, 28, 0.85) 0%, rgba(2, 3, 10, 0.96) 100%)",
      backdropFilter: "blur(12px)",
      animation: "fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards",
    }}>
      {/* CSS Injection for custom effects and scrollbar */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes panelSlideIn {
          from { transform: scale(0.96) translateY(12px); opacity: 0; }
          to { transform: scale(1) translateY(0); opacity: 1; }
        }
        .quest-panel {
          animation: panelSlideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .quest-card {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          background: rgba(15, 23, 42, 0.4) !important;
        }
        .quest-card:hover {
          transform: translateY(-2px);
          border-color: rgba(251, 191, 36, 0.4) !important;
          background: rgba(30, 41, 59, 0.45) !important;
          box-shadow: 0 8px 24px rgba(251, 191, 36, 0.08), inset 0 0 12px rgba(251, 191, 36, 0.03);
        }
        .quest-card.completed-card {
          border-color: rgba(74, 222, 128, 0.15) !important;
          background: rgba(20, 83, 45, 0.1) !important;
        }
        .quest-card.completed-card:hover {
          border-color: rgba(74, 222, 128, 0.35) !important;
          background: rgba(20, 83, 45, 0.15) !important;
          box-shadow: 0 8px 24px rgba(74, 222, 128, 0.06);
        }
        .btn-sci-fi {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .btn-sci-fi:hover {
          transform: translateY(-1px);
          filter: brightness(1.2);
          box-shadow: 0 4px 12px rgba(251, 191, 36, 0.25);
        }
        .btn-sci-fi:active {
          transform: translateY(0) scale(0.97);
        }
        .scroll-container::-webkit-scrollbar {
          width: 6px;
        }
        .scroll-container::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
          border-radius: 4px;
        }
        .scroll-container::-webkit-scrollbar-thumb {
          background: rgba(251, 191, 36, 0.2);
          border-radius: 4px;
        }
        .scroll-container::-webkit-scrollbar-thumb:hover {
          background: rgba(251, 191, 36, 0.4);
        }
      `}</style>

      <div className="quest-panel" onClick={(e) => e.stopPropagation()} style={{
        width: 660, maxWidth: "94vw", maxHeight: "88vh", display: "flex", flexDirection: "column",
        background: "linear-gradient(180deg, rgba(8, 12, 28, 0.95) 0%, rgba(4, 6, 12, 0.98) 100%)",
        border: `1px solid rgba(251, 191, 36, 0.35)`, borderRadius: 20,
        boxShadow: `0 24px 64px rgba(0, 0, 0, 0.8), 0 0 40px rgba(251, 191, 36, 0.15), inset 0 0 32px rgba(251, 191, 36, 0.02)`,
        padding: 24, overflow: "hidden",
      }}>
        {/* En-tête */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexShrink: 0 }}>
          <h2 style={{ color: ACCENT, fontWeight: 900, letterSpacing: "0.22em", fontSize: 20, display: "flex", alignItems: "center", gap: 10, textShadow: "0 0 12px rgba(251, 191, 36, 0.4)" }}>
            <ScrollText size={22} style={{ filter: "drop-shadow(0 0 6px rgba(251, 191, 36, 0.5))" }} /> JOURNAL DE QUÊTES
          </h2>
          <button onClick={onClose} className="btn-sci-fi" style={btn()}><X size={16} /> Fermer (J)</button>
        </div>

        {/* Corps défilable */}
        <div className="scroll-container" style={{ flex: 1, overflowY: "auto", paddingRight: 4, display: "flex", flexDirection: "column", gap: 20 }}>
          
          {/* ── Disponibles ───────────────────────────────────────────────── */}
          <Section title="Proposées ici" count={available.length} color="#5bd6ff">
            {available.length === 0 && <Empty text="Aucune nouvelle quête sur cette zone." />}
            {available.map((q) => (
              <QuestCard key={q.id} def={q} state="available"
                onAction={() => { questStore.accept(q.id); onAccept?.(q); }} />
            ))}
          </Section>

          {/* ── Actives ───────────────────────────────────────────────────── */}
          <Section title="En cours" count={active.length} color={ACCENT}>
            {active.length === 0 && <Empty text="Aucune quête en cours. Accepte-en une ci-dessus." />}
            {active.map((a) => {
              const def = getQuest(a.id);
              if (!def) return null;
              return (
                <QuestCard key={a.id} def={def} state="active" counts={a.counts}
                  onAction={() => questStore.abandon(a.id)} />
              );
            })}
          </Section>

          {/* ── Terminées ─────────────────────────────────────────────────── */}
          {completed.length > 0 && (
            <Section title="Terminées" count={completed.length} color="#4ade80">
              {completed.map((id) => {
                const def = getQuest(id);
                if (!def) return null;
                return <QuestCard key={id} def={def} state="completed" />;
              })}
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sous-composants ────────────────────────────────────────────────────────────

function Section({ title, count, color, children }: {
  title: string; count: number; color: string; children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{
        color, fontSize: 11, letterSpacing: "0.22em", fontWeight: 800,
        textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8,
        borderLeft: `3px solid ${color}`, paddingLeft: 10,
      }}>
        {title}
        <span style={{
          background: `${color}15`, color, borderRadius: 6,
          padding: "2px 8px", fontSize: 10, fontWeight: 900, border: `1px solid ${color}30`
        }}>{count}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>
    </div>
  );
}

function QuestCard({ def, state, counts, onAction }: {
  def: QuestDef;
  state: "available" | "active" | "completed";
  counts?: number[];
  onAction?: () => void;
}) {
  const dim = state === "completed";
  return (
    <div className={`quest-card ${dim ? "completed-card" : ""}`} style={{
      borderRadius: 12, padding: "14px 18px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: dim ? "#4ade80" : "#f8fafc", fontWeight: 800, fontSize: 14.5, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
            {dim ? <Check size={16} color="#4ade80" strokeWidth={3} /> : null}
            {def.title}
          </div>
          <div style={{ color: "#94a3b8", fontSize: 12.5, lineHeight: 1.5, marginBottom: 12 }}>{def.description}</div>

          {/* Objectifs (sauf si terminée) */}
          {state !== "completed" && def.objectives.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px", background: "rgba(0,0,0,0.2)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.03)", marginBottom: 12 }}>
              {def.objectives.map((obj, i) => {
                const c = counts?.[i] ?? 0;
                const done = c >= obj.target;
                return (
                  <div key={i} style={{
                    fontSize: 12, color: done ? "#4ade80" : "#cbd5e1",
                    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
                  }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: done ? 700 : 500 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: done ? "#4ade80" : ACCENT }} />
                      {obj.label}
                    </span>
                    {obj.target > 1 && (
                      <span style={{ fontFamily: "monospace", color: done ? "#4ade80" : ACCENT, fontWeight: 700, background: done ? "rgba(74,222,128,0.1)" : "rgba(251,191,36,0.1)", padding: "1px 6px", borderRadius: 4 }}>
                        {c}/{obj.target}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Récompenses */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 10 }}>
            <span style={{ fontSize: 10.5, textTransform: "uppercase", color: "#64748b", fontWeight: 700, letterSpacing: 0.5, marginRight: 2 }}>Récompenses:</span>
            {def.reward.xp ? (
              <span style={rewardChip("#a3e635")}><Sparkles size={12} /> {def.reward.xp} XP</span>
            ) : null}
            {def.reward.credits ? (
              <span style={rewardChip("#fbbf24")}><Coins size={12} /> {def.reward.credits} Crd</span>
            ) : null}
            {(def.reward.items ?? []).map((id) => {
              const it = LOOT_CATALOG[id];
              if (!it) return null;
              const img = lootIcon(id);
              return (
                <span key={id} style={rewardChip("#c084fc")}>
                  {img ? (
                    <img src={img} alt="" style={{ width: 13, height: 13, objectFit: "contain", marginRight: 3 }} />
                  ) : (
                    <span style={{ marginRight: 3, fontSize: 11 }}>{it.icon}</span>
                  )}
                  {it.label}
                </span>
              );
            })}
          </div>
        </div>

        {/* Bouton d'action */}
        <div style={{ flexShrink: 0, marginTop: 2 }}>
          {state === "available" && (
            <button onClick={onAction} className="btn-sci-fi" style={actionBtn("#38bdf8")}><Plus size={14} /> Accepter</button>
          )}
          {state === "active" && (
            <button onClick={onAction} className="btn-sci-fi" style={actionBtn("#ef4444")} title="Abandonner"><Trash2 size={14} /> Abandonner</button>
          )}
          {state === "completed" && (
            <span style={{ color: "#4ade80", background: "rgba(74, 222, 128, 0.1)", border: "1px solid rgba(74, 222, 128, 0.2)", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 8px rgba(74, 222, 128, 0.2)" }}><Check size={16} strokeWidth={3} /></span>
          )}
        </div>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div style={{
      color: "#64748b", fontSize: 12.5, fontStyle: "italic", padding: "14px 18px",
      background: "rgba(255,255,255,0.01)", border: "1px dashed rgba(255,255,255,0.06)",
      borderRadius: 10, display: "flex", alignItems: "center", gap: 8,
    }}>
      <AlertCircle size={14} style={{ opacity: 0.6 }} /> {text}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
function btn(): React.CSSProperties {
  return {
    padding: "8px 16px", borderRadius: 10, fontWeight: 800, cursor: "pointer", fontSize: 12,
    border: `1px solid rgba(251, 191, 36, 0.25)`, background: "rgba(251, 191, 36, 0.05)", color: "#fff",
    display: "flex", alignItems: "center", gap: 8,
  };
}
function actionBtn(color: string): React.CSSProperties {
  return {
    padding: "8px 14px", borderRadius: 8, fontWeight: 800, cursor: "pointer", fontSize: 12,
    border: `1px solid ${color}45`, background: `${color}15`, color,
    display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
  };
}
function rewardChip(color: string): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center",
    color, fontSize: 11, fontWeight: 700,
    background: `${color}10`, border: `1px solid ${color}20`,
    padding: "2px 8px", borderRadius: 6,
  };
}
