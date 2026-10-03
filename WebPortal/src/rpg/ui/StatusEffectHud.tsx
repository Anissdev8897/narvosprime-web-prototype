import { usePlayerEffects } from "../combat/usePlayerEffects";
import type { PlayerFxKind } from "../combat/statusEffects";

const FX_META: Record<PlayerFxKind, { icon: string; label: string; color: string }> = {
  invisibility:  { icon: "👻", label: "Invisible",    color: "#a78bfa" },
  shield_regen:  { icon: "🛡️", label: "Bouclier+",    color: "#60a5fa" },
  speed_boost:   { icon: "⚡", label: "Vélocité",     color: "#fbbf24" },
  damage_boost:  { icon: "🔥", label: "Puissance",    color: "#f87171" },
};

export function StatusEffectHud() {
  const effects = usePlayerEffects();
  if (effects.length === 0) return null;

  return (
    <div style={{
      position: "fixed",
      top: 100,
      left: "50%",
      transform: "translateX(-50%)",
      display: "flex",
      gap: 8,
      zIndex: 60,
      pointerEvents: "none",
    }}>
      {effects.map((fx) => {
        const meta = FX_META[fx.kind];
        const pct = fx.total > 0 ? Math.max(0, fx.remaining / fx.total) : 0;
        const secs = Math.ceil(fx.remaining);
        return (
          <div key={fx.kind} style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 12px 5px 8px",
            background: "rgba(0,0,0,0.65)",
            borderRadius: 8,
            border: `1px solid ${meta.color}55`,
            backdropFilter: "blur(6px)",
            minWidth: 110,
          }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>{meta.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                color: meta.color,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                lineHeight: 1.2,
                whiteSpace: "nowrap",
              }}>
                {meta.label} <span style={{ color: "#cbd5e1", fontWeight: 400 }}>{secs}s</span>
              </div>
              <div style={{
                marginTop: 3,
                height: 3,
                borderRadius: 2,
                background: "rgba(255,255,255,0.1)",
                overflow: "hidden",
              }}>
                <div style={{
                  width: `${pct * 100}%`,
                  height: "100%",
                  borderRadius: 2,
                  background: meta.color,
                  transition: "width 0.3s linear",
                }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
