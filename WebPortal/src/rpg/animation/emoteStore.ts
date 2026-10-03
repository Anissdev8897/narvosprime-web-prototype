// ══════════════════════════════════════════════════════════════════════════════
// animation/emoteStore.ts — Singleton d'état des émotes (pont gameplay ↔ React)
//
// Pattern "singleton hors-React" (cf. CLAUDE.md). L'UI (EmoteMenu) écrit ;
// le composant R3F (OwnAnimPlayerCharacter) lit via useSyncExternalStore.
// ══════════════════════════════════════════════════════════════════════════════

type Listener = () => void;

interface EmoteState {
  emoteId: string | null;
  glbPath: string | null;
  loop: boolean;
  version: number;
}

const state: EmoteState = { emoteId: null, glbPath: null, loop: false, version: 0 };
const listeners = new Set<Listener>();

function notify(): void {
  state.version++;
  for (const fn of listeners) fn();
}

export const emoteStore = {
  play(emoteId: string, glbPath: string, loop: boolean): void {
    state.emoteId = emoteId;
    state.glbPath = glbPath;
    state.loop = loop;
    notify();
  },

  cancel(): void {
    if (!state.emoteId) return;
    state.emoteId = null;
    state.glbPath = null;
    state.loop = false;
    notify();
  },

  getSnapshot(): EmoteState {
    return state;
  },

  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
