// combat/expeditionLedger.ts — registre du BUTIN SÉCURISÉ (hors-React, pur).
//
// SÉCURISÉ = l'état de l'inventaire à la dernière présence au HUB (map orbital) ;
// NON SÉCURISÉ = tout ce qui a été acquis depuis (items + crédits). À la mort sur le
// serveur paradisiaque, le NON SÉCURISÉ est perdu (plancher : jamais sous le snapshot).
// Le snapshot se rafraîchit en continu tant qu'on est au hub → revenir au hub = sécuriser.
import type { LootItem } from "../loot/LootRegistry";

export interface LedgerLoss { lostItemIndices: number[]; lostCredits: number; lostCount: number; }

let snapItemCounts = new Map<string, number>(); // id → quantité sécurisée
let snapCredits = 0;
let armed = false; // au moins un snapshot pris (sinon pas de perte applicable)

function countByItem(items: LootItem[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) m.set(it.id, (m.get(it.id) ?? 0) + 1);
  return m;
}

export const expeditionLedger = {
  /** Snapshot au HUB : tout l'état courant devient SÉCURISÉ. */
  secure(items: LootItem[], credits: number): void {
    snapItemCounts = countByItem(items);
    snapCredits = credits;
    armed = true;
  },

  /** Diff NON SÉCURISÉ courant (affichage HUD). */
  unsecured(items: LootItem[], credits: number): { items: number; credits: number } {
    if (!armed) return { items: 0, credits: 0 };
    let extra = 0;
    const cur = countByItem(items);
    for (const [id, n] of cur) extra += Math.max(0, n - (snapItemCounts.get(id) ?? 0));
    return { items: extra, credits: Math.max(0, credits - snapCredits) };
  },

  /** Perte à la MORT (paradisiaque) : indices d'items à retirer + crédits perdus.
   *  Pour chaque id, on retire les exemplaires AU-DELÀ du compte sécurisé (les derniers). */
  computeLoss(items: LootItem[], credits: number): LedgerLoss {
    if (!armed) return { lostItemIndices: [], lostCredits: 0, lostCount: 0 };
    const allowed = new Map(snapItemCounts);
    const lost: number[] = [];
    for (let i = 0; i < items.length; i++) {
      const id = items[i].id;
      const left = allowed.get(id) ?? 0;
      if (left > 0) allowed.set(id, left - 1);
      else lost.push(i);
    }
    return {
      lostItemIndices: lost,
      lostCredits: Math.max(0, credits - snapCredits),
      lostCount: lost.length,
    };
  },

  /** Reset (changement de perso / sortie du jeu / tests). */
  reset(): void { snapItemCounts = new Map(); snapCredits = 0; armed = false; },
};
