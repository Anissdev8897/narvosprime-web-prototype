// ui/ReputationPanel.tsx — Panneau de réputation par faction (toggle K).

import { useReputation, reputationStore } from "../reputation/reputationStore";
import { REPUTATION_TIERS, nextTier, type ReputationTierId } from "../reputation/reputationCatalog";
import { FACTIONS } from "../factions/factions";
import type { FactionId } from "../runtime/core/worldTypes";

const FACTION_IDS: FactionId[] = ["akarlys", "mezalayis", "zayan"];
const FACTION_ICONS: Record<FactionId, string> = {
  akarlys: "🛡️",
  mezalayis: "⚔️",
  zayan: "👽",
};

function tierProgress(rep: number, tierId: ReputationTierId): number {
  const tier = REPUTATION_TIERS.find((t) => t.id === tierId)!;
  const next = nextTier(tierId);
  if (!next) return 1;
  const range = next.minRep - tier.minRep;
  if (range <= 0) return 1;
  return Math.max(0, Math.min(1, (rep - tier.minRep) / range));
}

export function ReputationPanel({ onClose }: { onClose: () => void }) {
  const rep = useReputation();

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 75,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(2,3,10,0.82)", backdropFilter: "blur(6px)",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 480, maxWidth: "92vw", padding: 28,
        background: "rgba(8,6,16,0.96)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        boxShadow: "0 0 60px rgba(100,60,255,0.12)",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 24,
        }}>
          <div style={{
            fontSize: 15, fontWeight: 900, textTransform: "uppercase",
            letterSpacing: "0.15em", color: "#e2e8f0",
          }}>
            Réputation
          </div>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8, padding: "6px 14px", cursor: "pointer",
            color: "#94a3b8", fontSize: 12, fontWeight: 700,
          }}>
            Fermer [K]
          </button>
        </div>

        {/* Faction rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {FACTION_IDS.map((fid) => {
            const faction = FACTIONS[fid];
            const value = rep[fid];
            const tierId = reputationStore.tierOf(fid);
            const tier = REPUTATION_TIERS.find((t) => t.id === tierId)!;
            const next = nextTier(tierId);
            const pct = tierProgress(value, tierId);

            return (
              <div key={fid} style={{
                padding: "14px 16px", borderRadius: 12,
                background: `${faction.color}08`,
                border: `1px solid ${faction.color}22`,
              }}>
                {/* Faction name + icon */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 10, marginBottom: 10,
                }}>
                  <span style={{ fontSize: 22 }}>{FACTION_ICONS[fid]}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: 14, fontWeight: 800, color: faction.color,
                      letterSpacing: "0.04em",
                    }}>
                      {faction.name}
                    </div>
                    <div style={{
                      fontSize: 11, fontWeight: 700, color: tier.color,
                      textTransform: "uppercase", letterSpacing: "0.1em",
                    }}>
                      {tier.label}
                    </div>
                  </div>
                  <div style={{
                    fontSize: 13, fontWeight: 800, color: "#e2e8f0",
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    {value.toLocaleString("fr-FR")}
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{
                  height: 6, borderRadius: 3,
                  background: "rgba(255,255,255,0.06)",
                  overflow: "hidden",
                }}>
                  <div style={{
                    width: `${pct * 100}%`,
                    height: "100%", borderRadius: 3,
                    background: `linear-gradient(90deg, ${tier.color}, ${faction.color})`,
                    transition: "width 0.4s ease-out",
                  }} />
                </div>

                {/* Next tier label */}
                <div style={{
                  marginTop: 6, display: "flex", justifyContent: "space-between",
                  fontSize: 10, color: "#64748b",
                }}>
                  <span>{tier.label}</span>
                  <span>{next ? `${next.label} — ${next.minRep.toLocaleString("fr-FR")}` : "MAX"}</span>
                </div>

                {/* Rewards */}
                <div style={{
                  marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4,
                }}>
                  {tier.rewards.map((r) => (
                    <span key={r} style={{
                      fontSize: 9, padding: "2px 8px", borderRadius: 4,
                      background: `${tier.color}18`, color: tier.color,
                      fontWeight: 600, letterSpacing: "0.02em",
                    }}>
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
