import { useSyncExternalStore } from "react";
import { questStore } from "./questStore";
import type { QuestState } from "./questStore";

/** Hook React réactif sur l'état des quêtes (snapshot immuable du store). */
export function useQuests(): QuestState {
  return useSyncExternalStore(
    (cb) => questStore.subscribe(cb),
    () => questStore.get(),
    () => questStore.get(),
  );
}
