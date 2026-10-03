// reputation/reputationCatalog.ts — Paliers de réputation, seuils et récompenses.

export type ReputationTierId =
  | "hostile"
  | "unfriendly"
  | "neutral"
  | "friendly"
  | "honored"
  | "revered"
  | "exalted";

export interface ReputationTier {
  id: ReputationTierId;
  label: string;
  minRep: number;
  color: string;
  rewards: string[];
}

/** Trié par minRep croissant — itérer en reverse pour trouver le tier courant. */
export const REPUTATION_TIERS: ReputationTier[] = [
  {
    id: "hostile",
    label: "Hostile",
    minRep: -Infinity,
    color: "#dc2626",
    rewards: ["PNJ hostiles à vue", "Prix marchands ×3"],
  },
  {
    id: "unfriendly",
    label: "Inamical",
    minRep: -3000,
    color: "#f97316",
    rewards: ["PNJ méfiants", "Prix marchands ×1.5"],
  },
  {
    id: "neutral",
    label: "Neutre",
    minRep: 0,
    color: "#a3a3a3",
    rewards: ["Accès de base aux marchands"],
  },
  {
    id: "friendly",
    label: "Amical",
    minRep: 3000,
    color: "#22c55e",
    rewards: ["Réduction marchand 10%", "Quêtes faction débloquées"],
  },
  {
    id: "honored",
    label: "Honoré",
    minRep: 9000,
    color: "#3b82f6",
    rewards: ["Réduction marchand 20%", "Équipement faction"],
  },
  {
    id: "revered",
    label: "Révéré",
    minRep: 21000,
    color: "#8b5cf6",
    rewards: ["Réduction marchand 30%", "Monture faction"],
  },
  {
    id: "exalted",
    label: "Exalté",
    minRep: 42000,
    color: "#f59e0b",
    rewards: ["Titre spécial", "Apparence exclusive", "Réduction 40%"],
  },
];

/** Tier suivant (pour la barre de progression). null si déjà exalted. */
export function nextTier(currentId: ReputationTierId): ReputationTier | null {
  const idx = REPUTATION_TIERS.findIndex((t) => t.id === currentId);
  if (idx < 0 || idx >= REPUTATION_TIERS.length - 1) return null;
  return REPUTATION_TIERS[idx + 1];
}

/** Réduction marchand selon le tier (multiplicateur prix). */
export function merchantDiscount(tierId: ReputationTierId): number {
  switch (tierId) {
    case "hostile": return 3.0;
    case "unfriendly": return 1.5;
    case "neutral": return 1.0;
    case "friendly": return 0.9;
    case "honored": return 0.8;
    case "revered": return 0.7;
    case "exalted": return 0.6;
  }
}

/** Gains de réputation par type d'action. */
export const REP_GAINS = {
  KILL_ENEMY: 25,
  QUEST_COMPLETE: 150,
  MERCHANT_TRADE: 10,
  SHIP_DESTROYED: 50,
  KILL_ALLY_PENALTY: 200,
} as const;
