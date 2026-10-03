// combat/damageEvents.ts — bus des CHIFFRES DE DÉGÂTS flottants (hors-React, zéro alloc/frame).
//
// Émission au POINT UNIQUE : le handle `applyDamage` des PNJ (npcRegistry) — toutes les
// sources (flèches, sorts, mêlée, poings, DoT) passent par là → un seul branchement.
// Le CRIT est signalé par la SOURCE juste avant son applyDamage (markNextCrit) : le
// wrapper consomme le drapeau → kind "crit" → chiffre orange agrandi.
// Consommation : DamageNumbers draine le ring-buffer chaque frame (pool de sprites).
export type DamageKind = "hit" | "crit" | "player_hurt" | "heal";

export interface DamageEvent {
  x: number; y: number; z: number;
  amount: number;
  kind: DamageKind;
}

const queue: DamageEvent[] = [];
const MAX_QUEUE = 64;
let nextCrit = false;

export const damageEvents = {
  /** La PROCHAINE émission de dégâts est un CRITIQUE (drapeau consommé une fois). */
  markNextCrit(): void { nextCrit = true; },
  /** Consomme le drapeau crit (appelé par le wrapper applyDamage). */
  consumeNextCrit(): boolean { const c = nextCrit; nextCrit = false; return c; },

  emit(x: number, y: number, z: number, amount: number, kind: DamageKind): void {
    if (queue.length >= MAX_QUEUE) queue.shift(); // borné — on perd les plus anciens
    queue.push({ x, y, z, amount, kind });
  },

  /** Draine TOUT (appelé chaque frame par le renderer). Renvoie le tampon réutilisable. */
  drain(into: DamageEvent[]): DamageEvent[] {
    into.length = 0;
    if (queue.length > 0) { into.push(...queue); queue.length = 0; }
    return into;
  },

  clear(): void { queue.length = 0; nextCrit = false; },
};
