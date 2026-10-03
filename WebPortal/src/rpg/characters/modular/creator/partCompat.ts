// ══════════════════════════════════════════════════════════════════════════════
// characters/modular/creator/partCompat.ts — Verdict de compatibilité d'une pièce.
//
// Lit `src/data/part-compat.json`, produit par
// `scripts/audit-part-compat.mjs`. Consulté AVANT l'assemblage : prévenir dans
// la liste vaut mieux que laisser `rebindSkinnedMesh` refuser après le clic, ce
// qui se traduit par une pièce qui disparaît sans explication.
//
// ── POURQUOI UN MODULE À PART ────────────────────────────────────────────────
//
// Ce verdict était dupliqué entre le panneau latéral (supprimé) et l'écran de
// création. Deux copies d'une règle métier finissent toujours par diverger : ici
// les seuils étaient déjà écrits en dur, sans nom, dans les deux fichiers.
//
// ⚠ Les taux viennent d'un audit qui n'apparie qu'au NOM EXACT. Il ne voit ni la
// passe par emplacement humanoïde, ni le repli d'ancêtre de `buildBoneRemap`.
// C'est donc un PLANCHER : une pièce annoncée « incompatible » peut très bien
// s'assembler. Le verdict sert à prévenir, jamais à interdire — c'est
// `rebindSkinnedMesh` qui tranche, au moment du montage.
// ══════════════════════════════════════════════════════════════════════════════

import compat from "../../../../data/part-compat.json";

/** Sous ce taux de poids apparié, `rebindSkinnedMesh` refuse (MIN_COVERAGE). */
export const COVERAGE_INCOMPATIBLE = 0.5;

/** Sous ce taux, la pièce se lie mais une part notable du maillage est rabattue. */
export const COVERAGE_ADJUSTED = 0.9;

/** Au-delà de cet écart de pose de bind (unités monde), la pièce est fortement retaillée. */
export const BIND_DELTA_RESIZED = 1.5;

interface CompatRow {
  id: string;
  coverageByWeight: number;
  bindDelta: number;
}

const COMPAT = new Map((compat as CompatRow[]).map((r) => [r.id, r]));

export type CompatLevel = "warn" | "danger";

export interface CompatVerdict {
  text: string;
  level: CompatLevel;
}

/**
 * Verdict affiché à côté d'une pièce. `null` = rien à signaler.
 *
 * `null` aussi pour une pièce ABSENTE de l'audit : les pièces du pack de base ne
 * sont pas mesurées (elles sont la référence). Les marquer « inconnu »
 * couvrirait l'écran d'avertissements sur les pièces les plus sûres.
 */
export function compatOf(partId: string | null | undefined): CompatVerdict | null {
  if (!partId) return null;
  const row = COMPAT.get(partId);
  if (!row) return null;

  if (row.coverageByWeight < COVERAGE_INCOMPATIBLE) return { text: "incompatible", level: "danger" };
  if (row.coverageByWeight < COVERAGE_ADJUSTED) return { text: "ajusté", level: "warn" };
  if (row.bindDelta > BIND_DELTA_RESIZED) return { text: "retaillé", level: "warn" };
  return null;
}

/** Nombre de pièces mesurées — utile pour repérer un audit périmé. */
export const COMPAT_ENTRIES = COMPAT.size;
