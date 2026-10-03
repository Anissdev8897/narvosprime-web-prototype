// ══════════════════════════════════════════════════════════════════════════════
// runtime/debug/gameplayDebugger/GameplayDebuggerOverlay.tsx — Overlay 2D
//
// Affiche les données textuelles de la catégorie active du GameplayDebugger.
// Supporte le balisage couleur [color]...[/] dans les chaînes.
// DOM pur (hors Canvas) — rendu en position:fixed.
// ══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useRef } from "react";
import { gameplayDebugger } from "./core";
import type { GameplayDebuggerCategory } from "./core";

/** Styles de l'overlay */
const OVERLAY_STYLES: React.CSSProperties = {
  position: "fixed",
  top: 12,
  left: 12,
  zIndex: 9999,
  fontFamily: "'Consolas', 'Courier New', monospace",
  fontSize: 12,
  lineHeight: 1.5,
  pointerEvents: "none",
  userSelect: "none",
  maxWidth: 520,
};

const HEADER_STYLES: React.CSSProperties = {
  display: "flex",
  gap: 2,
  marginBottom: 6,
  flexWrap: "wrap",
  pointerEvents: "auto",
};

interface TabProps {
  cat: GameplayDebuggerCategory;
  active: boolean;
  index: number;
  onClick: () => void;
}

function CategoryTab({ cat, active, index, onClick }: TabProps) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "3px 10px",
        fontSize: 10,
        fontFamily: "inherit",
        fontWeight: 700,
        cursor: "pointer",
        borderRadius: 4,
        border: active
          ? "1px solid #5bd6ff"
          : "1px solid rgba(255,255,255,0.12)",
        background: active
          ? "rgba(91, 214, 255, 0.18)"
          : "rgba(255,255,255,0.04)",
        color: active ? "#5bd6ff" : "#94a3b8",
        letterSpacing: "0.08em",
        textTransform: "uppercase" as const,
      }}
      title={`[${cat.keybind}] ${cat.label}`}
    >
      {index + 1}: {cat.label}
    </button>
  );
}

/** Parse le balisage [color]text[/] en spans React. */
function ColoredText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  const regex = /\[(#[\da-fA-F]{3,8}|[\w]+)\](.*?)\[\/\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    // Texte avant le match
    if (match.index > lastIndex) {
      parts.push(
        <span key={key++}>{text.slice(lastIndex, match.index)}</span>,
      );
    }
    const color = match[1];
    const content = match[2];
    parts.push(
      <span key={key++} style={{ color }}>
        {content}
      </span>,
    );
    lastIndex = match.index + match[0].length;
  }

  // Reste du texte
  if (lastIndex < text.length) {
    parts.push(<span key={key++}>{text.slice(lastIndex)}</span>);
  }

  return <>{parts}</>;
}

/**
 * Overlay 2D du GameplayDebugger.
 * Affiche le header avec les onglets des catégories et les données de la catégorie active.
 * S'abonne au gameplayDebugger pour les changements de visibilité/catégorie.
 */
export function GameplayDebuggerOverlay() {
  const [, setTick] = useState(0);
  const tickRef = useRef(0);

  // S'abonne aux changements du debugger (visibilité, catégorie)
  useEffect(() => {
    const unsub = gameplayDebugger.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsub;
  }, []);

  // Tick périodique pour rafraîchir les data overlay
  useEffect(() => {
    const id = setInterval(() => {
      tickRef.current++;
      setTick(tickRef.current);
    }, 100); // 10 FPS suffisant pour du texte
    return () => clearInterval(id);
  }, []);

  if (!gameplayDebugger.visible) return null;

  const categories = gameplayDebugger.getAllCategories();
  const active = gameplayDebugger.activeCategory;
  const activeIndex = gameplayDebugger.currentIndex;

  const lines = active ? active.getOverlayData() : [];

  return (
    <div style={OVERLAY_STYLES}>
      {/* Barre d'onglets */}
      <div style={HEADER_STYLES}>
        <span
          style={{
            color: "#5bd6ff",
            fontWeight: 900,
            fontSize: 10,
            letterSpacing: "0.16em",
            marginRight: 8,
            padding: "3px 0",
          }}
        >
          DEBUG
        </span>
        {categories.map((cat, i) => (
          <CategoryTab
            key={cat.id}
            cat={cat}
            active={cat.id === active?.id}
            index={i}
            onClick={() => gameplayDebugger.selectCategory(i)}
          />
        ))}
      </div>

      {/* Données de la catégorie active */}
      {active && lines.length > 0 && (
        <div
          style={{
            background: "rgba(5, 8, 14, 0.88)",
            border: "1px solid rgba(91, 214, 255, 0.18)",
            borderRadius: 8,
            padding: "10px 14px",
            color: "#cbd5e1",
            boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
            backdropFilter: "blur(4px)",
          }}
        >
          {lines.map((line, i) => {
            if (line === "" || line === "───") {
              return (
                <div
                  key={i}
                  style={{
                    height: line === "───" ? 1 : 8,
                    background: line === "───" ? "rgba(91,214,255,0.12)" : undefined,
                    margin: line === "───" ? "4px 0" : undefined,
                  }}
                />
              );
            }
            return (
              <div key={i} style={{ whiteSpace: "pre-wrap" }}>
                <ColoredText text={line} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
