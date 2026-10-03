// ══════════════════════════════════════════════════════════════════════════════
// ui/EmoteMenu.tsx — Menu d'émotes in-game (touche G)
//
// Overlay modal avec onglets par catégorie. Clic sur une émote → emoteStore.play()
// → le composant R3F (OwnAnimPlayerCharacter) capte le changement et joue le clip.
// G ou Échap ferme le menu. Si une émote loop est en cours, un bouton "Annuler"
// permet de la stopper.
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useSyncExternalStore } from "react";
import { EMOTE_CATEGORIES, emotesByCategory, type EmoteCategory } from "../animation/emoteRegistry";
import { emoteStore } from "../animation/emoteStore";
import { eventBus } from "../runtime/core/EventBus";
import styles from "./EmoteMenu.module.css";

interface EmoteMenuProps {
  onClose: () => void;
}

export function EmoteMenu({ onClose }: EmoteMenuProps) {
  const [activeCat, setActiveCat] = useState<EmoteCategory>("social");
  const emotes = emotesByCategory(activeCat);
  const snap = useSyncExternalStore(emoteStore.subscribe, emoteStore.getSnapshot);
  const hasActiveEmote = snap.emoteId !== null;

  const handlePlay = useCallback((emoteId: string, glbPath: string, loop: boolean) => {
    emoteStore.play(emoteId, glbPath, loop);
    eventBus.emit("emote:play", { entityId: "player", emoteId, loop });
    if (!loop) onClose();
  }, [onClose]);

  const handleCancel = useCallback(() => {
    emoteStore.cancel();
    eventBus.emit("emote:cancel", { entityId: "player" });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "g" || e.key === "G") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>Émotes</span>
          <span className={styles.closeHint}>G / Échap pour fermer</span>
        </div>

        <div className={styles.tabs}>
          {EMOTE_CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              className={`${styles.tab} ${activeCat === cat.key ? styles.tabActive : ""}`}
              onClick={() => setActiveCat(cat.key)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className={styles.grid}>
          {emotes.map((e) => (
            <button
              key={e.id}
              className={styles.emoteBtn}
              onClick={() => handlePlay(e.id, e.glbPath, e.loop)}
            >
              <span className={styles.emoteIcon}>{e.icon}</span>
              <span className={styles.emoteLabel}>{e.label}</span>
              {e.loop && <span className={styles.loopBadge}>boucle</span>}
            </button>
          ))}
        </div>

        {hasActiveEmote && (
          <div className={styles.cancelBar}>
            <button className={styles.cancelBtn} onClick={handleCancel}>
              Annuler l'émote en cours
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
