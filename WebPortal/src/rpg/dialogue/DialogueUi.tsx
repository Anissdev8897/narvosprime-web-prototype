// ══════════════════════════════════════════════════════════════════════════════
// dialogue/DialogueUi.tsx — UI bulles de dialogue + choix + portrait
//
// Composant React superposé (overlay) pour les dialogues PNJ.
// Affiche : portrait PNJ, bulle de texte, choix du joueur.
// ══════════════════════════════════════════════════════════════════════════════

import {
  useSyncExternalStore,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import { dialogueStore } from "./dialogueStore";
import { dialogueRunner } from "./dialogueRunner";
import type { DialogueChoice } from "./types";

// ── Style (inline CSS — pas de dépendance au système de styles du projet) ──

const OVERLAY: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center",
  pointerEvents: "none",
};

const PANEL: React.CSSProperties = {
  pointerEvents: "auto",
  width: "min(90vw, 640px)",
  marginBottom: "10vh",
  background: "rgba(10, 10, 14, 0.92)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: 12,
  padding: 20,
  display: "flex",
  gap: 16,
  backdropFilter: "blur(8px)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
};

const PORTRAIT: React.CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: "50%",
  background: "linear-gradient(135deg, #3b82f6, #6366f1)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 20,
  fontWeight: 700,
  color: "#fff",
  flexShrink: 0,
  border: "2px solid rgba(255,255,255,0.15)",
};

const BUBBLE: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const SPEAKER: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "#94a3b8",
  letterSpacing: "0.02em",
};

const TEXT: React.CSSProperties = {
  fontSize: 15,
  lineHeight: "1.6",
  color: "#e2e8f0",
  whiteSpace: "pre-wrap",
};

const CHOICES: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  marginTop: 4,
};

const CHOICE_BTN: React.CSSProperties = {
  all: "unset",
  cursor: "pointer",
  padding: "10px 14px",
  borderRadius: 8,
  color: "#e2e8f0",
  fontSize: 14,
  fontWeight: 500,
  background: "rgba(255, 255, 255, 0.04)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  transition: "background 0.15s",
};

const CLOSE_BTN: React.CSSProperties = {
  all: "unset",
  cursor: "pointer",
  position: "absolute",
  top: -8,
  right: -8,
  width: 24,
  height: 24,
  borderRadius: "50%",
  background: "rgba(100, 100, 120, 0.8)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#fff",
  fontSize: 14,
  lineHeight: 1,
};

// ── Composant ────────────────────────────────────────────────────────────────

export function DialogueUi(): ReactNode {
  const uiState = useSyncExternalStore(
    dialogueStore.subscribe,
    dialogueStore.get,
    dialogueStore.get
  );

  if (!uiState.open || !uiState.currentNode) return null;

  const node = uiState.currentNode;
  const choices = dialogueRunner.getFilteredChoices();

  const initial = node.speaker?.[0] ?? "?";
  const isEnd = choices.length === 0;

  return (
    <div style={OVERLAY}>
      <div style={PANEL}>
        {/* Portrait */}
        <div style={PORTRAIT}>{initial}</div>

        {/* Bulle */}
        <div style={BUBBLE}>
          <div style={SPEAKER}>{uiState.speakerName}</div>
          <div style={TEXT}>{node.text}</div>

          {/* Choix filtrés */}
          {choices.length > 0 && (
            <div style={CHOICES}>
              {choices.map((choice, i) => (
                <ChoiceButton key={i} choice={choice} index={i} />
              ))}
            </div>
          )}

          {/* Fin du dialogue */}
          {isEnd && (
            <div
              style={{
                ...CHOICE_BTN,
                color: "#94a3b8",
                cursor: "pointer",
              }}
              onClick={() => dialogueStore.close()}
            >
              [Fermer]
            </div>
          )}
        </div>

        {/* Close button */}
        <button
          style={CLOSE_BTN}
          onClick={() => dialogueStore.close()}
          aria-label="Fermer"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function ChoiceButton({
  choice,
  index,
}: {
  choice: DialogueChoice;
  index: number;
}): ReactNode {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (index === 0) ref.current?.focus();
  }, [index]);

  const handleClick = useCallback(() => {
    dialogueStore.selectChoice(index);
  }, [index]);

  return (
    <button
      ref={ref}
      style={CHOICE_BTN}
      onClick={handleClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(59, 130, 246, 0.15)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
      }}
    >
      {choice.text}
    </button>
  );
}

// ── Hook pour lancer un dialogue depuis un PNJ ──────────────────────────────

export function useStartDialogue(): (dialogueId: string) => boolean {
  return useCallback((dialogueId: string) => {
    return dialogueStore.open(dialogueId);
  }, []);
}
