// ══════════════════════════════════════════════════════════════════════════════
// quests/QuestTracker.tsx — Suivi des quêtes actives en surimpression HUD
//
// Affiche en haut-droite les quêtes acceptées + l'avancement de chaque objectif.
// Discret (pas de fond plein), pour rester lisible sans gêner le jeu.
// ══════════════════════════════════════════════════════════════════════════════

import { useQuests } from "./useQuests";
import { getQuest } from "./questCatalog";

export function QuestTracker() {
  const { active } = useQuests();
  if (active.length === 0) return null;

  return (
    <div style={{
      position: "fixed", top: 92, right: 14, zIndex: 40,
      width: 248, pointerEvents: "none",
      display: "flex", flexDirection: "column", gap: 8,
      fontFamily: "system-ui, sans-serif",
    }}>
      {active.map((a) => {
        const def = getQuest(a.id);
        if (!def) return null;
        return (
          <div key={a.id} style={{
            background: "linear-gradient(180deg, rgba(8,12,20,0.82), rgba(8,12,20,0.62))",
            borderLeft: "3px solid #fbbf24",
            borderRadius: 6, padding: "7px 10px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.4)",
          }}>
            <div style={{
              color: "#fbbf24", fontSize: 12, fontWeight: 800,
              letterSpacing: "0.02em", marginBottom: 4,
              textShadow: "0 1px 2px rgba(0,0,0,0.8)",
            }}>
              ◈ {def.title}
            </div>
            {def.objectives.map((obj, i) => {
              const count = a.counts[i] ?? 0;
              const done = count >= obj.target;
              return (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "baseline",
                  fontSize: 11, color: done ? "#4ade80" : "#cbd5e1", gap: 8,
                }}>
                  <span style={{ textDecoration: done ? "line-through" : "none", opacity: done ? 0.7 : 1 }}>
                    {done ? "✓" : "•"} {obj.label}
                  </span>
                  {obj.target > 1 && (
                    <span style={{ fontFamily: "monospace", fontWeight: 700, color: done ? "#4ade80" : "#fbbf24" }}>
                      {count}/{obj.target}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
