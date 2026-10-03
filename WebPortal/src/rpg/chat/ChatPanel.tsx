// ══════════════════════════════════════════════════════════════════════════════
// chat/ChatPanel.tsx — Panneau de chat in-game NARVOS PRIME
//
// UI du chat : liste de messages scrollable, champ de saisie avec Enter,
// bouton toggle pour réduire/déplier le panneau.
//
// Points clés :
//   • Quand l'input a le focus, TOUS les événements clavier sont stoppés
//     (stopPropagation + stopImmediatePropagation) pour ne pas déclencher les
//     contrôles du jeu (marche, sorts, etc.).
//   • Auto-scroll vers le bas à chaque nouveau message.
//   • Style futuriste cohérent avec le HUD existant (tokens.css).
// ══════════════════════════════════════════════════════════════════════════════

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  type KeyboardEvent as ReactKeyboardEvent,
  type FormEvent,
} from "react";
import { chatStore, useChatMessages, type ChatMessageType } from "./chatStore";
import styles from "./ChatPanel.module.css";

// ── Props ────────────────────────────────────────────────────────────────────

type ChatPanelProps = {
  /** Nom du joueur affiché comme expéditeur des messages. */
  playerName: string;
};

// ── Utilitaire : formatage HH:MM ─────────────────────────────────────────────

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

// ── Classes CSS par type de message ──────────────────────────────────────────

const MESSAGE_CLASS: Record<ChatMessageType, string> = {
  player: styles.typePlayer,
  system: styles.typeSystem,
  admin: styles.typeAdmin,
  error: styles.typeError,
};

const SENDER_CLASS: Record<ChatMessageType, string> = {
  player: styles.typePlayer,
  system: styles.senderSystem,
  admin: styles.senderAdmin,
  error: styles.senderError,
};

// ── Composant ChatPanel ──────────────────────────────────────────────────────

export function ChatPanel({ playerName }: ChatPanelProps) {
  const messages = useChatMessages();
  const [open, setOpen] = useState(true);
  const [inputValue, setInputValue] = useState("");

  // Ref pour l'auto-scroll
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Ref pour l'input (focus programmatique)
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Auto-scroll quand de nouveaux messages arrivent ─────────────────────

  useEffect(() => {
    if (open && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, open]);

  // ── Envoi de message (Enter ou bouton) ─────────────────────────────────

  const handleSubmit = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault();
      const text = inputValue.trim();
      if (!text) return;
      chatStore.send(playerName, text);
      setInputValue("");
    },
    [inputValue, playerName],
  );

  // ── Blocage TOTAL des événements clavier quand l'input a le focus ──────
  // Empêche les contrôles de jeu (ZQSD, espace, etc.) de réagir
  // pendant que le joueur tape un message.

  const blockKeyboard = useCallback(
    (e: ReactKeyboardEvent<HTMLInputElement>) => {
      e.stopPropagation();
      // stopImmediatePropagation via l'événement natif pour bloquer les
      // listeners document-level (InputManager du jeu).
      e.nativeEvent.stopImmediatePropagation();

      // Enter = envoyer le message
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }

      // Escape = retirer le focus de l'input (rendre le contrôle au jeu)
      if (e.key === "Escape") {
        e.preventDefault();
        inputRef.current?.blur();
      }
    },
    [handleSubmit],
  );

  // Bloquer aussi keyup et keypress pour éviter toute fuite
  const blockEvent = useCallback(
    (e: ReactKeyboardEvent<HTMLInputElement>) => {
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
    },
    [],
  );

  // ── Toggle ouverture / fermeture ───────────────────────────────────────

  const handleToggle = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  // ── Rendu : panneau fermé → bouton toggle uniquement ───────────────────

  if (!open) {
    return (
      <button
        className={styles.toggleBtn}
        onClick={handleToggle}
        title="Ouvrir le chat"
      >
        {/* Icone chat SVG inline */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>
    );
  }

  // ── Rendu : panneau ouvert ─────────────────────────────────────────────

  return (
    <div className={styles.container}>
      <div className={styles.panel}>
        {/* En-tete */}
        <div className={styles.header}>
          <span className={styles.headerTitle}>
            {/* Petit icone chat */}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Chat
          </span>
          <button
            className={styles.headerClose}
            onClick={handleToggle}
            title="Reduire le chat"
          >
            _
          </button>
        </div>

        {/* Liste des messages */}
        <div className={styles.messages}>
          {messages.length === 0 && (
            <div className={styles.emptyHint}>
              Aucun message. Tapez /help pour les commandes.
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`${styles.message} ${MESSAGE_CLASS[msg.type]}`}
            >
              <span className={styles.timestamp}>
                {formatTime(msg.timestamp)}
              </span>
              <span className={`${styles.sender} ${SENDER_CLASS[msg.type]}`}>
                {msg.sender}
              </span>
              {msg.text}
            </div>
          ))}
          {/* Sentinelle invisible pour l'auto-scroll */}
          <div ref={messagesEndRef} />
        </div>

        {/* Zone de saisie */}
        <form
          className={styles.inputRow}
          onSubmit={handleSubmit}
        >
          <input
            ref={inputRef}
            className={styles.input}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={blockKeyboard}
            onKeyUp={blockEvent}
            onKeyPress={blockEvent}
            placeholder="Taper un message..."
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" className={styles.sendBtn}>
            Envoyer
          </button>
        </form>
      </div>
    </div>
  );
}
