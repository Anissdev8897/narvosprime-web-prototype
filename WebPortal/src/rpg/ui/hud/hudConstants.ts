// ══════════════════════════════════════════════════════════════════════════════
// ui/hud/hudConstants.ts — Codes couleurs HUD par faction
// ══════════════════════════════════════════════════════════════════════════════

import { Faction } from "../../../types";
import type { FactionColors } from "./hudTypes";

const AKARLYS_COLORS: FactionColors = {
  health: "#ef4444",
  armor: "#3b82f6",
  mana: "#0ea5e9",
  primary: "#3b82f6",
  accent: "#60a5fa",
  glow: "rgba(59, 130, 246, 0.5)",
};

const ZAYAN_COLORS: FactionColors = {
  health: "#a855f7",
  armor: "#22c55e",
  mana: "#c084fc",
  primary: "#a855f7",
  accent: "#c084fc",
  glow: "rgba(168, 85, 247, 0.5)",
};

const MEZALAYIS_COLORS: FactionColors = {
  health: "#eab308",
  armor: "#f97316",
  mana: "#fbbf24",
  primary: "#eab308",
  accent: "#fbbf24",
  glow: "rgba(234, 179, 8, 0.5)",
};

const FACTION_COLOR_MAP: Record<Faction, FactionColors> = {
  [Faction.HUMAN]: AKARLYS_COLORS,
  [Faction.ALIEN]: ZAYAN_COLORS,
  [Faction.MERCENARY]: MEZALAYIS_COLORS,
  [Faction.HOSTILE]: AKARLYS_COLORS,
  [Faction.NEUTRAL]: AKARLYS_COLORS,
};

export function getFactionColors(faction: Faction): FactionColors {
  return FACTION_COLOR_MAP[faction] ?? AKARLYS_COLORS;
}

export const DEFAULT_HUD_COLORS = AKARLYS_COLORS;
export const LOW_HEALTH_THRESHOLD = 0.3;
export const LOW_MANA_THRESHOLD = 0.25;
export const BAR_HEIGHT = 14;
export const BAR_WIDTH = 220;
