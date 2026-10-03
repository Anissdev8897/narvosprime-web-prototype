// WebPortal/src/rpg/runtime/feed/WorldFeed.tsx
// Overlay HUD (hors Canvas) du « monde vivant ». S'abonne à l'EventBus, agrège via
// WorldFeedLog, et affiche un fil discret en haut-droite. Rafraîchi ~4 fps (pas 60).
import { useRef, useEffect, useState } from "react";
import { WorldFeedLog, type FeedMessage } from "./worldFeedLog";
import { eventBus } from "../core/EventBus";

const TTL_MS = 6000;

export function WorldFeed() {
  const logRef = useRef(new WorldFeedLog());
  const [messages, setMessages] = useState<FeedMessage[]>([]);

  useEffect(() => {
    const log = logRef.current;
    const offDestroyed = eventBus.on("ship:destroyed", ({ faction }) =>
      log.shipDestroyed(faction, Date.now()),
    );
    const offRelation = eventBus.on("faction:relationChanged", ({ a, b, relation }) =>
      log.factionRelationChanged(a, b, relation, Date.now()),
    );
    const offWorldEvent = eventBus.on("world:eventStarted", (payload) =>
      log.worldEventStarted(payload, Date.now()),
    );
    const iv = setInterval(() => setMessages([...log.recent(Date.now())]), 250);
    return () => { offDestroyed(); offRelation(); offWorldEvent(); clearInterval(iv); log.clear(); };
  }, []);

  if (messages.length === 0) return null;

  const now = Date.now();
  return (
    <div style={{
      position: "fixed", top: 48, right: 16, zIndex: 41, pointerEvents: "none",
      display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", maxWidth: 340,
    }}>
      {messages.map((m) => (
        <div key={m.id} style={{
          background: "rgba(5,7,12,0.78)",
          border: `1px solid ${m.color}`,
          color: m.color,
          padding: "5px 11px", borderRadius: 8,
          fontSize: 12, fontWeight: 700, letterSpacing: "0.02em",
          textShadow: "0 1px 2px #000", boxShadow: `0 0 10px ${m.color}44`,
          opacity: Math.max(0.05, 1 - (now - m.createdAt) / TTL_MS), // fondu progressif
        }}>
          {m.text}
        </div>
      ))}
    </div>
  );
}
