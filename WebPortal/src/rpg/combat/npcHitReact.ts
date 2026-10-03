// combat/npcHitReact.ts — réactions d'IMPACT des PNJ (hors-React, même pattern que
// statusEffects). Le joueur frappe → on déclenche ici la réaction à jouer sur la cible
// (légère "hit" ou lourde "bighit" selon le type d'attaque) ; le PNJ la CONSOMME dans son
// useFrame et joue l'anim one-shot correspondante.
export type HitReactKind = "hit" | "bighit";

const pending = new Map<string, HitReactKind>();

export const npcHitReact = {
  /** Déclenche une réaction d'impact sur un PNJ (écrase la précédente non consommée). */
  trigger(npcId: string, kind: HitReactKind): void { pending.set(npcId, kind); },
  /** Consomme (et efface) la réaction en attente du PNJ. null si aucune. */
  consume(npcId: string): HitReactKind | null {
    const k = pending.get(npcId);
    if (k) pending.delete(npcId);
    return k ?? null;
  },
  clear(): void { pending.clear(); },
};
