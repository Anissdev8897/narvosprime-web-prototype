// WebPortal/src/rpg/runtime/world-events/EventDirectorRunner.tsx
// Composant React INVISIBLE : tient l'EventDirector et émet ses émissions sur l'EventBus.
// Monté GLOBALEMENT (le monde vit partout). Le feed les affiche automatiquement.
import { useEffect } from "react";
import { eventBus } from "../core/EventBus";
import { EventDirector } from "./eventDirector";

const TICK_INTERVAL_MS = 1000;

export function EventDirectorRunner() {
  useEffect(() => {
    const director = new EventDirector(Math.random, Date.now());
    const iv = setInterval(() => {
      const emissions = director.tick(Date.now());
      for (const e of emissions) eventBus.emit("world:eventStarted", e);
    }, TICK_INTERVAL_MS);
    return () => clearInterval(iv);
  }, []);
  return null;
}
