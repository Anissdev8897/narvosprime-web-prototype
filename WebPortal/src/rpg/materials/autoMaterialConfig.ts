// ══════════════════════════════════════════════════════════════════════════════
// materials/autoMaterialConfig.ts — Réglages de l'auto-material paysage.
//
// Séparé du shader pour être testable en environnement `node` sans DOM (cf.
// vitest.config.ts) : les fonctions de mélange ci-dessous sont de la logique
// pure, et c'est elle qu'on veut couvrir, pas la compilation GLSL.
// ══════════════════════════════════════════════════════════════════════════════

/** Une couche de sol : albedo + normal, échantillonnées en projection monde. */
export interface AutoMaterialLayer {
  /** Chemin du fichier couleur (KTX2). */
  colorMap: string;
  /** Chemin de la normal map (KTX2), optionnel. */
  normalMap?: string;
  /**
   * Taille d'UN carreau, en unités monde. C'est LE paramètre qui rend cette
   * approche supérieure au baking : la densité de texels est constante partout,
   * qu'on regarde un caillou de 2 unités ou un pan de terrain de 2 258.
   */
  tileSize: number;
}

export interface AutoMaterialConfig {
  /** Sol plat (le dessus). */
  flat: AutoMaterialLayer;
  /** Parois (les pentes). */
  steep: AutoMaterialLayer;
  /** Couche intermédiaire, mélangée entre les deux. Optionnelle. */
  mid?: AutoMaterialLayer;
  /**
   * Bornes du mélange, exprimées en PENTE (0 = horizontal, 1 = vertical).
   * En dessous de `slopeStart` c'est 100 % `flat`, au-dessus de `slopeEnd`
   * c'est 100 % `steep`, et on interpole entre les deux.
   */
  slopeStart: number;
  slopeEnd: number;
  /** Masque basse fréquence qui casse la répétition du carrelage. */
  variationMap?: string;
  /** Taille d'un carreau du masque de variation — volontairement très grande. */
  variationTileSize: number;
  /** Amplitude du décalage de pente induit par la variation. */
  variationStrength: number;
}

/** Identifiant stable d'une couche — ce que l'éditeur Forge manipule. */
export type TerrainLayerId =
  | "neige" | "roche" | "cailloux" | "herbe" | "terre" | "sable_clair" | "sable_ocre";

/**
 * BIBLIOTHÈQUE DE COUCHES — le catalogue dans lequel l'éditeur pioche.
 *
 * Les 7 couches viennent du pack `materials/MWLandscapeAutoMaterial`, converties
 * en KTX2 2048 par `scripts/textures-to-ktx2.mjs` (472 Mo de PNG → 42 Mo, ~56 Mo
 * de VRAM une fois transcodées, mipmaps inclus).
 *
 * Le pack en contenait 7 depuis le début ; seules 3 avaient été converties, ce
 * qui rendait « herbe / sable / terre » impossible à proposer alors que les
 * sources étaient là. Les 4 autres ont été converties depuis.
 *
 * `tileSize` est réglé par la GRANULOMÉTRIE de la matière, pas au hasard : plus
 * le motif est fin (sable, cailloux), plus le carreau doit être petit pour que
 * l'œil ne lise pas la répétition ; plus il est grossier (roche), plus il peut
 * s'étaler sans se trahir.
 *
 * `tint` est une couleur REPRÉSENTATIVE pour la pastille de l'éditeur, pas une
 * couleur de rendu : la texture réelle ne peut pas être échantillonnée pour un
 * aperçu sans décoder un KTX2 hors du GPU. Elle sert uniquement à distinguer les
 * couches d'un coup d'œil dans la liste.
 */
export const TERRAIN_LAYERS: Record<TerrainLayerId, AutoMaterialLayer & { label: string; tint: string }> = {
  neige:       { label: "Neige",       tint: "#e8eef5", tileSize: 8,
                 colorMap: "/models/materials/mwam/TEX_MWAM_Snow_col.ktx2",
                 normalMap: "/models/materials/mwam/TEX_MWAM_Snow_nrm.ktx2" },
  roche:       { label: "Roche",       tint: "#6b6660", tileSize: 12,
                 colorMap: "/models/materials/mwam/TEX_MWAM_Rock_col.ktx2",
                 normalMap: "/models/materials/mwam/TEX_MWAM_Rock_nrm.ktx2" },
  cailloux:    { label: "Cailloux",    tint: "#8d8a84", tileSize: 6,
                 colorMap: "/models/materials/mwam/TEX_MWAM_Stones_col.ktx2",
                 normalMap: "/models/materials/mwam/TEX_MWAM_Stones_nrm.ktx2" },
  herbe:       { label: "Herbe",       tint: "#5d7b42", tileSize: 5,
                 colorMap: "/models/materials/mwam/TEX_MWAM_Grass_col.ktx2",
                 normalMap: "/models/materials/mwam/TEX_MWAM_Grass_nrm.ktx2" },
  terre:       { label: "Terre",       tint: "#6b5340", tileSize: 7,
                 colorMap: "/models/materials/mwam/TEX_MWAM_Dirt_col.ktx2",
                 normalMap: "/models/materials/mwam/TEX_MWAM_Dirt_nrm.ktx2" },
  sable_clair: { label: "Sable clair", tint: "#d6c69a", tileSize: 4,
                 colorMap: "/models/materials/mwam/TEX_MWAM_SandA_col.ktx2",
                 normalMap: "/models/materials/mwam/TEX_MWAM_SandA_nrm.ktx2" },
  sable_ocre:  { label: "Sable ocre",  tint: "#b8945e", tileSize: 4,
                 colorMap: "/models/materials/mwam/TEX_MWAM_SandC_col.ktx2",
                 normalMap: "/models/materials/mwam/TEX_MWAM_SandC_nrm.ktx2" },
};

/** Ordre d'affichage dans l'éditeur — du plus froid au plus aride. */
export const TERRAIN_LAYER_ORDER: readonly TerrainLayerId[] = [
  "neige", "roche", "cailloux", "herbe", "terre", "sable_clair", "sable_ocre",
];

/**
 * Assemble une config depuis trois identifiants de couche.
 *
 * C'est le point d'entrée de l'éditeur Forge : choisir « herbe / terre / roche »
 * doit produire une config valide sans qu'on retape des chemins de fichiers —
 * une faute de frappe dans un chemin ne se voit qu'au runtime, et le fallback
 * SPA de Vite renvoie du `text/html` en 200 au lieu d'un 404 (cf. CLAUDE.md).
 */
export function buildAutoMaterial(
  flat: TerrainLayerId,
  steep: TerrainLayerId,
  mid?: TerrainLayerId,
  overrides?: Partial<Pick<AutoMaterialConfig, "slopeStart" | "slopeEnd" | "variationStrength" | "variationTileSize">>,
): AutoMaterialConfig {
  const pick = (id: TerrainLayerId): AutoMaterialLayer => {
    const { colorMap, normalMap, tileSize } = TERRAIN_LAYERS[id];
    return { colorMap, normalMap, tileSize };
  };
  return {
    flat: pick(flat),
    steep: pick(steep),
    mid: mid ? pick(mid) : undefined,
    slopeStart: overrides?.slopeStart ?? 0.18,
    slopeEnd: overrides?.slopeEnd ?? 0.45,
    variationMap: "/models/materials/mwam/TEX_MWAM_Variation_msk.ktx2",
    variationTileSize: overrides?.variationTileSize ?? 220,
    variationStrength: overrides?.variationStrength ?? 0.12,
  };
}

/**
 * Préréglage Forge — map enneigée.
 *
 * Neige à plat, roche sur les parois, cailloux en transition. Les seuils
 * viennent de l'observation d'Unreal : la neige tient jusqu'à ~35° puis la
 * roche perce, ce qui correspond à une pente de 0,18 à 0,45.
 */
export const FORGE_AUTO_MATERIAL: AutoMaterialConfig = {
  flat:  { colorMap: "/models/materials/mwam/TEX_MWAM_Snow_col.ktx2",
           normalMap: "/models/materials/mwam/TEX_MWAM_Snow_nrm.ktx2",   tileSize: 8 },
  mid:   { colorMap: "/models/materials/mwam/TEX_MWAM_Stones_col.ktx2",
           normalMap: "/models/materials/mwam/TEX_MWAM_Stones_nrm.ktx2", tileSize: 6 },
  steep: { colorMap: "/models/materials/mwam/TEX_MWAM_Rock_col.ktx2",
           normalMap: "/models/materials/mwam/TEX_MWAM_Rock_nrm.ktx2",   tileSize: 12 },
  slopeStart: 0.18,
  slopeEnd: 0.45,
  variationMap: "/models/materials/mwam/TEX_MWAM_Variation_msk.ktx2",
  variationTileSize: 220,
  variationStrength: 0.12,
};

/**
 * Pente d'une normale monde : 0 pour une face horizontale, 1 pour une verticale.
 *
 * On prend la valeur ABSOLUE de Y : un plafond est aussi « plat » qu'un sol du
 * point de vue du mélange. Sans ça, le dessous des surplombs — nombreux sur
 * cette map, avec ses arches — recevrait de la roche verticale sur une face
 * pourtant horizontale.
 */
export function slopeOf(normalY: number): number {
  return 1 - Math.min(1, Math.abs(normalY));
}

/**
 * Poids des trois couches pour une pente donnée.
 *
 * Retourne toujours une partition (somme = 1) : c'est ce qui garantit qu'aucune
 * zone ne s'assombrit ou ne sature au passage d'une couche à l'autre.
 */
export function layerWeights(
  slope: number,
  cfg: Pick<AutoMaterialConfig, "slopeStart" | "slopeEnd" | "mid">,
): { flat: number; mid: number; steep: number } {
  const t = smoothstep(cfg.slopeStart, cfg.slopeEnd, slope);
  if (!cfg.mid) return { flat: 1 - t, mid: 0, steep: t };
  // La couche intermédiaire culmine au milieu de la transition et s'efface aux
  // deux bouts — d'où la parabole 4t(1-t), maximale à t=0,5.
  const mid = 4 * t * (1 - t);
  const rest = 1 - mid;
  return { flat: rest * (1 - t), mid, steep: rest * t };
}

/** `smoothstep` de GLSL, en TS — même courbe des deux côtés du pont. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x < edge0 ? 0 : 1;
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
