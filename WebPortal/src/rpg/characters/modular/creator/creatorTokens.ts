// ══════════════════════════════════════════════════════════════════════════════
// characters/modular/creator/creatorTokens.ts — Jetons visuels de l'écran de création.
//
// Glyphes d'emplacement et palettes. Séparés du composant parce qu'ils sont des
// DONNÉES : les relire, les tester ou les traduire ne doit pas obliger à ouvrir
// un fichier de 350 lignes de JSX.
//
// ⚠ Les libellés des teintes viennent du panneau latéral supprimé, qui était le
// seul endroit où elles portaient un nom lisible. Ils sont récupérés ici avant
// que le fichier disparaisse — une pastille de couleur sans nom accessible est
// inutilisable au lecteur d'écran.
// ══════════════════════════════════════════════════════════════════════════════

import type { BodySlot } from "../bodySlots";

/**
 * Glyphe par emplacement — tient lieu d'icône là où aucune vignette n'existe
 * (entrées « Aucune », packs sans rendu miniature).
 */
export const SLOT_GLYPH: Partial<Record<BodySlot, string>> = {
  body: "◈", head: "☗", hair: "≋", beard: "︶",
  torso: "▤", arms: "⌇", hands: "✋", legs: "⋀", feet: "⏥",
  top: "⬓", pants: "⌷", shoes: "⏢", gloves: "✍", headwear: "⌒", eyewear: "◠",
  back: "⌂", accessory: "◇",
};

/** Glyphe de repli quand l'emplacement n'en déclare pas. */
export const SLOT_GLYPH_FALLBACK = "◇";

export interface Tint {
  value: string;
  label: string;
}

/**
 * Teints de peau — rampe naturelle puis teintes non humaines.
 *
 * La teinte MULTIPLIE la couleur de base du matériau : `#ffffff` laisse le
 * modèle inchangé, et une valeur sombre assombrit sans virer au noir.
 */
export const SKIN_TINTS: readonly Tint[] = [
  { value: "#f3d3bd", label: "Claire" },
  { value: "#d6a37b", label: "Dorée" },
  { value: "#b57f57", label: "Hâlée" },
  { value: "#8b5a3c", label: "Ambre" },
  { value: "#5c3a21", label: "Sombre" },
  { value: "#8fb9c9", label: "Cyanée" },
  { value: "#a89bc4", label: "Améthyste" },
  { value: "#7d8c74", label: "Chlorophylle" },
];

/**
 * Iris — naturelles d'abord, exotiques ensuite.
 *
 * Valeurs volontairement CLAIRES : la teinte multiplie la couleur de base du
 * matériau des yeux (un bleu-gris sombre). Une pastille foncée donnerait un
 * iris noir.
 */
export const EYE_TINTS: readonly Tint[] = [
  { value: "#ffffff", label: "Naturelle" },
  { value: "#6b4a2f", label: "Noisette" },
  { value: "#8a6a3d", label: "Ambre" },
  { value: "#3f6b8a", label: "Bleu" },
  { value: "#4f8a6b", label: "Vert" },
  { value: "#7a8a9a", label: "Gris" },
  { value: "#9a6a8a", label: "Mauve" },
  { value: "#c04040", label: "Rubis" },
  { value: "#a040c0", label: "Améthyste" },
  { value: "#d0b040", label: "Or" },
];

/** Teinte neutre — n'altère aucune couleur d'origine. */
export const NEUTRAL_TINT = "#ffffff";
