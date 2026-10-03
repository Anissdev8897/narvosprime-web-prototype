// forge/forgePresenceStore.ts — PRÉSENCE des co-éditeurs (Forge Live). Éphémère.
//
// Chaque éditeur diffuse sa caméra + identité ; on garde les pairs vivants (purge des
// silencieux). Sert à afficher les marqueurs/curseurs des autres dans la scène.
import { useSyncExternalStore } from "react";

export interface Peer {
  id: string;            // playerId
  name: string;
  color: string;
  cam: [number, number, number]; // position caméra (cible regardée)
  lastSeen: number;      // ms (performance.now)
}

const STALE_MS = 8000; // pair sans signal > 8 s → retiré

let peers: Record<string, Peer> = {};
let version = 0;
const listeners = new Set<() => void>();
function notify() { version++; for (const l of listeners) l(); }

export const forgePresence = {
  /** Met à jour (ou ajoute) un pair. nowMs injecté pour testabilité. */
  upsert(p: Omit<Peer, "lastSeen">, nowMs: number): void {
    peers = { ...peers, [p.id]: { ...p, lastSeen: nowMs } };
    notify();
  },
  /** Retire les pairs silencieux depuis > STALE_MS. Renvoie true si la liste a changé. */
  prune(nowMs: number): boolean {
    const kept: Record<string, Peer> = {};
    let changed = false;
    for (const [id, p] of Object.entries(peers)) {
      if (nowMs - p.lastSeen <= STALE_MS) kept[id] = p; else changed = true;
    }
    if (changed) { peers = kept; notify(); }
    return changed;
  },
  remove(id: string): void { if (peers[id]) { const n = { ...peers }; delete n[id]; peers = n; notify(); } },
  clear(): void { peers = {}; notify(); },
  list(): Peer[] { return Object.values(peers); },
  subscribe(l: () => void): () => void { listeners.add(l); return () => { listeners.delete(l); }; },
  getVersion: () => version,
};

export function usePeers(): Peer[] {
  useSyncExternalStore(forgePresence.subscribe, forgePresence.getVersion, forgePresence.getVersion);
  return Object.values(peers);
}

/** Couleur stable dérivée d'un id (HSL → hex) pour distinguer les pairs. */
export function peerColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return `hsl(${h}, 80%, 62%)`;
}
