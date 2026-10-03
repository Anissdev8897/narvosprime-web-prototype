// ══════════════════════════════════════════════════════════════════════════════
// characters/modular/selectionToMacro.ts — Sélection du créateur → macro-morphs.
//
// PURE. Aucun import R3F, aucun accès au DOM : c'est la règle du projet pour la
// logique de gameplay, et c'est ce qui rend ce fichier testable en env `node`.
//
// ── POURQUOI CE PONT EXISTE ──────────────────────────────────────────────────
//
// Le créateur persiste DÉJÀ un archétype, une morphologie (`build`) et un genre.
// Le corps MakeHuman, lui, veut cinq curseurs continus (`BodyMacro`). Traduire
// l'un vers l'autre fait apparaître le corps morphable SANS inventer d'état
// sauvegardé nouveau — donc sans migration de personnages existants.
//
// C'est délibérément une ÉTAPE. Le jour où le créateur exposera ses propres
// curseurs de morphologie, ce fichier devient la valeur de DÉPART de ces
// curseurs plutôt que leur seule source.
//
// ── CE QUE ÇA REMPLACE ───────────────────────────────────────────────────────
//
// `BodyBuild.girth` met le corps à l'échelle en X/Z (0,92 → 1,22). Son propre
// commentaire le dit : « ce n'est PAS un remplacement d'un vrai morph […] donne
// une silhouette plus large, pas une musculature ». Les macro-morphs MakeHuman
// sont ce vrai morph — `muscle` et `weight` y sont deux axes SÉPARÉS, ce qu'un
// facteur d'échelle unique ne peut pas exprimer : un corps musclé et un corps
// corpulent ont la même largeur d'épaules et une répartition différente.
// ══════════════════════════════════════════════════════════════════════════════

import { DEFAULT_MACRO, type BodyMacro } from "./macroWeights";
import type { ArchetypeId, BuildId } from "./bodyArchetypes";

export type MacroGender = "male" | "female";

export interface MacroSelection {
  gender: MacroGender;
  build: BuildId;
  archetype: ArchetypeId;
}

/**
 * Muscle et masse grasse par morphologie.
 *
 * DEUX AXES, PAS UN. C'est tout l'intérêt d'être passé aux macro-morphs :
 * `muscular` et `heavy` ne sont pas deux points d'un même curseur « largeur »,
 * ce sont deux directions différentes. Un corps musclé est dense et découpé, un
 * corps corpulent est large et lisse — le second a MOINS de muscle que le
 * premier, pas plus.
 *
 * Valeurs sur 0 → 1, où 0,5 est le maillage neutre de MakeHuman.
 */
const PAR_MORPHOLOGIE: Record<BuildId, { muscle: number; weight: number }> = {
  slim:     { muscle: 0.35, weight: 0.22 },
  athletic: { muscle: 0.62, weight: 0.45 },
  muscular: { muscle: 0.92, weight: 0.58 },
  heavy:    { muscle: 0.45, weight: 0.90 },
};

/**
 * Écarts appliqués PAR-DESSUS la morphologie, selon l'archétype.
 *
 * Additifs et non absolus : un alien musclé doit rester musclé. Les remplacer
 * par des valeurs absolues ferait que l'archétype écrase la morphologie, et les
 * quatre `build` deviendraient indiscernables sur tout ce qui n'est pas humain.
 *
 * ⚠ Zone de RÉGLAGE ARTISTIQUE, pas de correction technique. Ces quatre lignes
 * décident à quoi ressemblent les races de NARVOS. Elles sont volontairement
 * timides : mieux vaut un alien trop proche de l'humain qu'un alien difforme
 * que les équipements ne pourront plus habiller.
 */
const PAR_ARCHETYPE: Record<ArchetypeId, Partial<BodyMacro>> = {
  human:     {},
  alien:     { height: 0.72, muscle: -0.10, weight: -0.12 },
  synthetic: { height: 0.58, muscle: 0.08 },
  mutant:    { height: 0.44, muscle: 0.14, weight: 0.10 },
};

const borne = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Traduit ce que le créateur a déjà en main vers les cinq curseurs MakeHuman.
 *
 * L'ÂGE ET L'ETHNIE RESTENT NEUTRES. Le créateur ne les demande pas, et les
 * deviner depuis l'archétype produirait des corps que le joueur n'a pas
 * choisis — un « mutant » n'est pas plus vieux qu'un humain.
 */
export function selectionToMacro(s: MacroSelection): BodyMacro {
  const morpho = PAR_MORPHOLOGIE[s.build] ?? PAR_MORPHOLOGIE.athletic;
  const ecart = PAR_ARCHETYPE[s.archetype] ?? {};

  // `height` de l'archétype est ABSOLU (il n'y a pas de taille dans `build`),
  // `muscle` et `weight` sont des écarts. La distinction est explicite ici pour
  // qu'on n'ait pas à la déduire des signes dans la table.
  return {
    ...DEFAULT_MACRO,
    gender: s.gender === "male" ? 1 : 0,
    muscle: borne(morpho.muscle + (ecart.muscle ?? 0)),
    weight: borne(morpho.weight + (ecart.weight ?? 0)),
    height: borne(ecart.height ?? DEFAULT_MACRO.height),
  };
}
