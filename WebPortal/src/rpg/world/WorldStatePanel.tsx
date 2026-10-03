// world/WorldStatePanel.tsx — moniteur de l'UNIVERS VIVANT (carte galactique HUD).
//
// Affiche en lecture seule : puissance des factions, contrôle + économie des régions, et
// le flux d'actualités (conquêtes/essors/famines/raids). Toggle in-game (touche G — admin
// libre). Thème NARVOS PRIME (cyan HUD).
import { useWorld, useWorldJournal } from "./worldStateStore";
import { REGION_LABEL, type WorldEventKind } from "./worldSim";
import { FACTIONS } from "../factions/factions";
import { FORGE } from "../forge/forgeTheme";
import type { FactionId } from "../runtime/core/worldTypes";

const KIND_ICON: Record<WorldEventKind, string> = { conquete: "⚔", essor: "▲", famine: "▼", raid: "✸", guerre: "⚔" };

export function WorldStatePanel({ onClose }: { onClose: () => void }) {
  const world = useWorld();
  const journal = useWorldJournal();
  const factionIds = Object.keys(world.factions) as FactionId[];

  return (
    <div style={{ position: "fixed", top: 60, left: "50%", transform: "translateX(-50%)", zIndex: 180, width: 560, maxHeight: "80vh", overflowY: "auto",
      background: "rgba(2,4,10,0.95)", border: `1px solid ${FORGE.accentDim}`, borderRadius: 6, color: FORGE.text, fontFamily: FORGE.mono,
      boxShadow: `0 0 40px ${FORGE.accentFaint}`,
      backgroundImage: `linear-gradient(${FORGE.accentFaint} 1px, transparent 1px), linear-gradient(90deg, ${FORGE.accentFaint} 1px, transparent 1px)`, backgroundSize: "32px 32px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: `1px solid ${FORGE.accentDim}` }}>
        <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: "0.28em", color: FORGE.text, textShadow: `0 0 16px ${FORGE.accentDim}` }}>ÉTAT <span style={{ color: FORGE.accent }}>GALACTIQUE</span></div>
        <button onClick={onClose} style={{ background: "transparent", border: `1px solid ${FORGE.accentDim}`, color: FORGE.textDim, borderRadius: 3, padding: "3px 10px", cursor: "pointer", fontFamily: FORGE.mono }}>✕</button>
      </div>

      <div style={{ padding: 16 }}>
        {/* Factions */}
        <Title>Forces en présence · cycle {world.epoch}</Title>
        {factionIds.map((f) => {
          const def = FACTIONS[f]; const pow = world.factions[f].power;
          const owned = Object.values(world.regions).filter((r) => r.controller === f).length;
          return (
            <div key={f} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                <span style={{ color: def.color, fontWeight: 800 }}>{def.name}</span>
                <span style={{ color: FORGE.textDim }}>{owned} région(s) · {pow.toFixed(0)}</span>
              </div>
              <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${pow}%`, height: "100%", background: def.color, boxShadow: `0 0 8px ${def.color}` }} />
              </div>
            </div>
          );
        })}

        {/* Régions */}
        <Title>Territoires & économie</Title>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {Object.entries(world.regions).map(([id, r]) => {
            const def = FACTIONS[r.controller];
            const trend = r.price > 1.08 ? "▲" : r.price < 0.92 ? "▼" : "•";
            const trendColor = r.price > 1.08 ? FORGE.ok : r.price < 0.92 ? FORGE.danger : FORGE.textDim;
            return (
              <div key={id} style={{ background: FORGE.panel, border: `1px solid ${def.color}44`, borderRadius: 4, padding: "8px 10px" }}>
                <div style={{ fontSize: 12, fontWeight: 800 }}>{REGION_LABEL[id] ?? id}</div>
                <div style={{ fontSize: 10, color: def.color }}>◤ {def.name}</div>
                <div style={{ fontSize: 10, color: FORGE.textDim, marginTop: 3 }}>
                  Éco <span style={{ color: trendColor }}>{trend} {(r.price * 100).toFixed(0)}%</span>
                  {r.contest > 0.15 && <span style={{ color: FORGE.warn }}> · contesté {(r.contest * 100).toFixed(0)}%</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Actualités */}
        <Title>Dépêches de l'univers</Title>
        {journal.length === 0 ? (
          <div style={{ fontSize: 11, color: FORGE.textFaint, fontStyle: "italic" }}>Calme plat dans la galaxie…</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {journal.slice(0, 18).map((e) => (
              <div key={e.id} style={{ fontSize: 11, color: FORGE.textDim, display: "flex", gap: 8 }}>
                <span style={{ color: e.kind === "famine" || e.kind === "raid" ? FORGE.danger : e.kind === "essor" ? FORGE.ok : FORGE.accent }}>{KIND_ICON[e.kind]}</span>
                <span>cycle {e.startEpoch} — {e.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "16px 0 8px" }}>
      <span style={{ width: 12, height: 1, background: FORGE.accent, boxShadow: `0 0 6px ${FORGE.accent}` }} />
      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.2em", color: FORGE.accent, textTransform: "uppercase" }}>{children}</span>
    </div>
  );
}
