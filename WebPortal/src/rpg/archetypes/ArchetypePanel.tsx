// archetypes/ArchetypePanel.tsx — sélection de classe d'archétype + aperçu des sorts.
// Ouvert par le PNJ "Maître d'Armes" (ou la pastille ⚔️). Choisir = archetypeStore.set.
import { useEffect } from "react";
import { ARCHETYPES, ARCHETYPE_IDS, type ArchetypeId } from "./archetypeCatalog";
import { useArchetype, archetypeStore } from "./archetypeStore";
import { preloadArchetypePacksNow } from "./preloadArchetypeAssets";

export function ArchetypeFloatingButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} title="Choisir une classe (archétype)"
      style={{ position: "fixed", top: 158, right: 16, zIndex: 55, width: 42, height: 42, borderRadius: 10,
        cursor: "pointer", background: open ? "#4527a0" : "rgba(26,18,42,0.85)", border: "1px solid #a64dff",
        color: "#e6d6ff", fontSize: 20, boxShadow: open ? "0 0 14px #a64dff88" : "0 2px 8px rgba(0,0,0,0.4)" }}>
      ⚔️
    </button>
  );
}

export function ArchetypePanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const active = useArchetype();
  // Précharge les packs d'anim de classe à l'ouverture → changer d'archétype ne parse plus
  // le pack au prochain dégainage = pas de freeze (pattern PNJ/arme/récolte).
  useEffect(() => { if (open) preloadArchetypePacksNow(); }, [open]);
  if (!open) return null;

  return (
    <div style={{
      position: "fixed", top: 90, left: "50%", transform: "translateX(-50%)", zIndex: 120, width: 720, maxWidth: "94vw",
      maxHeight: "82vh", overflowY: "auto", background: "rgba(12,8,20,0.97)", border: "1px solid #a64dff66",
      borderRadius: 14, padding: 20, color: "#ece3ff", fontFamily: "system-ui, sans-serif",
      boxShadow: "0 16px 60px rgba(0,0,0,0.7)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: "#c9a8ff" }}>⚔️ Maître d'Armes — Choix de classe</div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#9aa3b2", fontSize: 20, cursor: "pointer" }}>✕</button>
      </div>
      <div style={{ fontSize: 12, color: "#b39ad6", marginBottom: 16 }}>
        Chaque classe a une arme, des animations et des sorts signature. Sélectionne ton archétype.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
        {ARCHETYPE_IDS.map((id) => {
          const a = ARCHETYPES[id];
          const sel = active === id;
          return (
            <button key={id} onClick={() => archetypeStore.set(id as ArchetypeId)}
              style={{
                textAlign: "left", cursor: "pointer", borderRadius: 10, padding: "12px 13px",
                background: sel ? `${a.color}22` : "rgba(255,255,255,0.03)",
                border: `2px solid ${sel ? a.color : "#ffffff14"}`, color: "#ece3ff",
              }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: a.color }}>
                {a.label}{sel ? " ✓" : ""}
              </div>
              <div style={{ fontSize: 11.5, color: "#bcaed6", margin: "4px 0 8px", lineHeight: 1.35 }}>{a.description}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {a.spells.map((s) => (
                  <div key={s.id} style={{ fontSize: 11 }}>
                    <span style={{ color: s.isUltimate ? "#ffb547" : "#d7ccf0", fontWeight: 700 }}>
                      {s.isUltimate ? "★ " : "• "}{s.label}
                    </span>
                    <span style={{ color: "#8f82ac" }}>
                      {s.pctPlayerHp ? ` · ${Math.round(s.pctPlayerHp * 100)}% PV` : ""}
                      {s.isUltimate ? ` · ${s.baseCooldown}s` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {active && (
        <div style={{ marginTop: 16, padding: 10, borderRadius: 8, background: "rgba(166,77,255,0.1)", fontSize: 12, color: "#d7ccf0" }}>
          Classe active : <b style={{ color: ARCHETYPES[active].color }}>{ARCHETYPES[active].label}</b>.
          Lance tes sorts signature avec <kbd>C</kbd> / <kbd>V</kbd>{ARCHETYPES[active].spells.length > 2 ? " / <kbd>B</kbd>" : ""}.
        </div>
      )}
    </div>
  );
}
