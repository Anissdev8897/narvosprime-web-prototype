// professions/ProfessionPanel.tsx — HUD des métiers (niveaux, XP, endurance, sac).
//
// Lecture seule, branché sur le store via useProfessions. Bouton flottant vert pour
// ouvrir/fermer. Affiche les 6 métiers (barre d'XP), l'endurance partagée, et le sac
// de ressources récoltées (libellé + rareté).
import { useProfessions } from "./useProfessions";
import { PROFESSIONS, RARITY_COLOR, itemLabel, itemRarity } from "./professionCatalog";
import { xpForLevel, MAX_PROFESSION_LEVEL, type ProfessionId } from "./professionTypes";
import { STAMINA_MAX } from "./professionStore";

export function ProfessionFloatingButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Métiers (Bûcheron, Mineur, Récolteur…)"
      style={{
        position: "fixed", top: 254, right: 14, zIndex: 55,
        width: 42, height: 42, borderRadius: 10, cursor: "pointer",
        background: open ? "#2f6b3a" : "rgba(20,30,22,0.85)",
        border: "1px solid #5cb85c", color: "#cfeacd", fontSize: 20,
        boxShadow: open ? "0 0 14px #5cb85c88" : "0 2px 8px rgba(0,0,0,0.4)",
      }}
    >
      🪓
    </button>
  );
}

export function ProfessionPanel({ open, onClose, onCraft }: { open: boolean; onClose: () => void; onCraft?: (p: ProfessionId) => void }) {
  const st = useProfessions();
  if (!open) return null;

  const staminaPct = Math.round((st.stamina / STAMINA_MAX) * 100);
  const resourceEntries = Object.entries(st.resources).filter(([, n]) => n > 0);

  return (
    <div
      style={{
        position: "fixed", top: 110, right: 66, zIndex: 56, width: 320,
        maxHeight: "76vh", overflowY: "auto",
        background: "rgba(12,16,14,0.96)", border: "1px solid #3f7a44",
        borderRadius: 12, padding: 16, color: "#e8f0e8",
        fontFamily: "system-ui, sans-serif", boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: "#9be39b" }}>Métiers</div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#9aa3b2", fontSize: 18, cursor: "pointer" }}>✕</button>
      </div>

      {/* Endurance partagée */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#cfe6cf", marginBottom: 4 }}>
          <span>⚡ Endurance</span><span>{Math.round(st.stamina)}/{STAMINA_MAX}</span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: "#1c241d", overflow: "hidden" }}>
          <div style={{ width: `${staminaPct}%`, height: "100%", background: "linear-gradient(90deg,#ffd24a,#ff9d2a)" }} />
        </div>
      </div>

      {/* Métiers */}
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {PROFESSIONS.map((p) => {
          const prog = st.profs[p.id];
          const max = prog.level >= MAX_PROFESSION_LEVEL;
          const need = xpForLevel(prog.level);
          const pct = max ? 100 : Math.min(100, Math.round((prog.xp / need) * 100));
          return (
            <div key={p.id} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: p.color, fontWeight: 700 }}>{p.icon} {p.label}</span>
                <span style={{ color: "#bcd0bc", fontSize: 12 }}>Niv. {prog.level}{max ? " (max)" : ""}</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: "#1c241d", overflow: "hidden", marginTop: 5 }}>
                <div style={{ width: `${pct}%`, height: "100%", background: p.color }} />
              </div>
              {!max && (
                <div style={{ fontSize: 10, color: "#7d8d7d", marginTop: 2, textAlign: "right" }}>
                  {Math.round(prog.xp)} / {need} XP
                </div>
              )}
              {p.kind === "craft" && onCraft && (
                <button onClick={() => onCraft(p.id)}
                  style={{ width: "100%", marginTop: 6, padding: "5px", fontSize: 11, fontWeight: 800, cursor: "pointer",
                    background: `${p.color}22`, color: p.color, border: `1px solid ${p.color}66`, borderRadius: 5 }}>
                  🔨 Ouvrir l'atelier
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Sac de ressources */}
      <div style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#9be39b", marginBottom: 6 }}>Ressources</div>
        {resourceEntries.length === 0 ? (
          <div style={{ fontSize: 12, color: "#7d8d7d" }}>Aucune ressource récoltée pour l'instant.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {resourceEntries.map(([id, n]) => (
              <div key={id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: RARITY_COLOR[itemRarity(id)] ?? "#c7cdd6" }}>{itemLabel(id)}</span>
                <span style={{ color: "#dfe7df" }}>×{n}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
