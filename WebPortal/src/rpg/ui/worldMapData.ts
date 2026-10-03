// ══════════════════════════════════════════════════════════════════════════════
// ui/worldMapData.ts — Donnees statiques du graphe de la carte du monde
//
// Chaque noeud correspond a une map definie dans loaders/assetManifest.ts.
// Les positions gridPos sont abstraites (pas des coordonnees monde) et servent
// a disposer les hexagones dans le canvas 2D de WorldMapOverlay.
// ══════════════════════════════════════════════════════════════════════════════

/** Noeud de la carte du monde representant une zone jouable. */
export interface MapNode {
  /** Identifiant technique — doit correspondre a la cle dans MAPS. */
  id: string;
  /** Nom affiche dans l'overlay. */
  label: string;
  /** Description courte de la zone. */
  description: string;
  /** Fourchette de niveaux suggeree. */
  levelRange: string;
  /** Position abstraite 2D (colonne, ligne) pour le graphe hexagonal. */
  gridPos: [number, number];
  /** Identifiants des maps connectees (aretes du graphe). */
  connections: string[];
  /** Couleur d'accent du noeud (hex). */
  color: string;
  /** Icone unicode pour le marqueur de zone. */
  icon: string;
}

/** Type de point d'interet sur la carte (legende). */
export type PoiType = "npc" | "merchant" | "portal" | "spawn";

/** Marqueur de point d'interet dans une zone. */
export interface PoiMarker {
  type: PoiType;
  label: string;
  /** Offset relatif au centre du noeud (pixels dans l'espace canvas). */
  offset: [number, number];
}

// ── Noeuds derives de MAPS (assetManifest.ts) ────────────────────────────────
// 4 maps : forge, orbital, tower, donjon_furiste.
// Les connexions forment un graphe en losange :
//   orbital (hub central) <-> forge, tower, donjon_furiste
//   forge <-> tower (passage souterrain)
//   tower <-> donjon_furiste (portail dimensionnel)

export const WORLD_MAP_NODES: MapNode[] = [
  {
    id: "orbital",
    label: "Orbital Hub",
    description:
      "Station orbitale principale — hub social, marchands, quetes de depart. " +
      "Zone securisee sans ennemis hostiles.",
    levelRange: "1 - 5",
    gridPos: [0, 0],
    connections: ["forge", "tower", "donjon_furiste"],
    color: "#38bdf8",
    icon: "⌖", // point d'ancrage
  },
  {
    id: "forge",
    label: "Forge World",
    description:
      "Planete volcanique industrielle. Forges colossales, coulees de lave " +
      "et ateliers de fabrication d'armes. Monstres mecaniques errants.",
    levelRange: "5 - 15",
    gridPos: [-2, -1.5],
    connections: ["orbital", "tower"],
    color: "#f97316",
    icon: "⚒", // marteau et pic
  },
  {
    id: "tower",
    label: "Tower",
    description:
      "Tour ancestrale plantee dans les nuages. Etages ascendants de " +
      "difficulte croissante, boss a chaque palier.",
    levelRange: "10 - 25",
    gridPos: [2, -1.5],
    connections: ["orbital", "forge", "donjon_furiste"],
    color: "#a78bfa",
    icon: "♖", // tour (piece d'echecs)
  },
  {
    id: "donjon_furiste",
    label: "Donjon Furiste",
    description:
      "Donjon futuriste enfoui sous la surface. Pieges technologiques, " +
      "sentinelles IA et boss final Gralynis.",
    levelRange: "20 - 35",
    gridPos: [0, 2],
    connections: ["orbital", "tower"],
    color: "#ef4444",
    icon: "☠", // tete de mort
  },
];

// ── POI par zone (marchand, PNJ, portail, spawn) ─────────────────────────────
// Donnees derivees de npcCatalog.ts et merchants.ts.

export const ZONE_POIS: Record<string, PoiMarker[]> = {
  orbital: [
    { type: "spawn",    label: "Point d'apparition",  offset: [0, 20] },
    { type: "merchant", label: "Grand Chef",           offset: [-25, -12] },
    { type: "merchant", label: "Kgnitig",              offset: [25, -12] },
    { type: "npc",      label: "General",              offset: [-18, 10] },
    { type: "npc",      label: "Sous-Major",           offset: [18, 10] },
    { type: "portal",   label: "Portail Forge",        offset: [-30, 0] },
    { type: "portal",   label: "Portail Tower",        offset: [30, 0] },
    { type: "portal",   label: "Portail Donjon",       offset: [0, 30] },
  ],
  forge: [
    { type: "spawn",    label: "Zone d'atterrissage",  offset: [0, 18] },
    { type: "merchant", label: "Forgeron",             offset: [-20, -8] },
    { type: "npc",      label: "General (Mission)",    offset: [20, -8] },
    { type: "portal",   label: "Retour Orbital",       offset: [25, 12] },
  ],
  tower: [
    { type: "spawn",    label: "Entree de la Tour",    offset: [0, 18] },
    { type: "npc",      label: "Prophete",             offset: [-16, -10] },
    { type: "portal",   label: "Portail Forge",        offset: [-28, 0] },
    { type: "portal",   label: "Portail Donjon",       offset: [28, 0] },
    { type: "portal",   label: "Retour Orbital",       offset: [0, -20] },
  ],
  donjon_furiste: [
    { type: "spawn",    label: "Sas d'entree",         offset: [0, 20] },
    { type: "npc",      label: "Sentinelle IA",        offset: [-18, -6] },
    { type: "portal",   label: "Retour Orbital",       offset: [0, -22] },
  ],
};

// ── Couleurs de la legende (par type de POI) ─────────────────────────────────

export const POI_COLORS: Record<PoiType, string> = {
  npc:      "#38bdf8", // bleu cyan
  merchant: "#fbbf24", // or
  portal:   "#c084fc", // violet
  spawn:    "#4ade80", // vert
};

export const POI_LABELS: Record<PoiType, string> = {
  npc:      "PNJ / Quete",
  merchant: "Marchand",
  portal:   "Portail",
  spawn:    "Point d'apparition",
};
