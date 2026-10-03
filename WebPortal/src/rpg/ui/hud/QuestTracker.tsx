// ══════════════════════════════════════════════════════════════════════════════
// ui/hud/QuestTracker.tsx — Suivi de quête (objectif actuel, progression)
//
// Position : haut-droit (sous la minimap)
// Affiche la quête active avec barres de progression par objectif
// React.memo : ne se re-render que si quests change
// ══════════════════════════════════════════════════════════════════════════════

import { memo } from "react";
import type { QuestDisplayData } from "./hudTypes";
import { CircleCheck, Circle } from "lucide-react";

export interface QuestTrackerProps {
  quests: QuestDisplayData[];
}

/** Barre de progression individuelle. */
function progressBar(current: number, target: number, done: boolean): string {
  if (done || target <= 0) return "100%";
  const pct = Math.min(100, (current / target) * 100);
  return `${Math.round(pct)}%`;
}

/**
 * Objectif individuel (memoïsé).
 */
const QuestObjective = memo(function QuestObjective({
  obj,
}: {
  obj: QuestDisplayData["objectives"][number];
}) {
  return (
    <div style={styles.objective}>
      <span style={{ color: obj.done ? "#4ade80" : "#94a3b8", flexShrink: 0 }}>
        {obj.done ? (
          <CircleCheck size={12} />
        ) : (
          <Circle size={12} />
        )}
      </span>
      <span
        style={{
          ...styles.objLabel,
          color: obj.done ? "#94a3b8" : "#cbd5e1",
          textDecoration: obj.done ? "line-through" : undefined,
        }}
      >
        {obj.label}
      </span>
      <span style={styles.objCount}>
        {obj.current}/{obj.target}
      </span>
    </div>
  );
});

/**
 * Quête individuelle (memoïsé).
 */
const QuestCard = memo(function QuestCard({
  quest,
}: {
  quest: QuestDisplayData;
}) {
  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span style={styles.title}>{quest.title}</span>
        {quest.allDone && <span style={styles.badge}>TERMINÉE</span>}
      </div>
      {quest.objectives.map((obj, i) => (
        <QuestObjective key={i} obj={obj} />
      ))}
    </div>
  );
});

/**
 * Tracker de quêtes : affiche les quêtes actives avec progression.
 * React.memo : ne se re-render que si le tableau quests change.
 */
export const QuestTracker = memo(function QuestTracker({
  quests,
}: QuestTrackerProps) {
  if (quests.length === 0) return null;

  return (
    <div style={styles.container}>
      {quests.map((q) => (
        <QuestCard key={q.id} quest={q} />
      ))}
    </div>
  );
});
QuestTracker.displayName = "QuestTracker";

// ── Styles inline ────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    maxWidth: 260,
  },
  card: {
    background: "rgba(6,10,18,0.72)",
    backdropFilter: "blur(8px)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 6,
    padding: "8px 10px",
    fontSize: 11,
    fontFamily: "Inter, system-ui, sans-serif",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  title: {
    fontWeight: 700,
    color: "#e8ecf6",
    fontSize: 12,
    letterSpacing: "0.3px",
  },
  badge: {
    fontSize: 9,
    fontWeight: 700,
    color: "#4ade80",
    letterSpacing: "0.5px",
    textTransform: "uppercase",
  },
  objective: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    padding: "2px 0",
  },
  objLabel: {
    flex: 1,
    fontSize: 10,
  },
  objCount: {
    fontSize: 9,
    fontWeight: 600,
    color: "#64748b",
    fontVariantNumeric: "tabular-nums",
    fontFamily: "monospace",
  },
};
