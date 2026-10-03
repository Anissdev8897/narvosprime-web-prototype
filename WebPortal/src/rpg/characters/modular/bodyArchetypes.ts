// ══════════════════════════════════════════════════════════════════════════════
// characters/modular/bodyArchetypes.ts — Corps de base : espèce × morphologie.
//
// Première étape de la création : le joueur choisit un ARCHÉTYPE (humain, alien,
// synthétique…) puis une MORPHOLOGIE (maigre, athlétique, musclé, corpulent).
// Le couple des deux désigne un corps nu — la toile sur laquelle viennent
// ensuite les pièces d'anatomie, puis les vêtements.
//
// ── POURQUOI DES ENTRÉES SANS MODÈLE ─────────────────────────────────────────
//
// `path: null` déclare une combinaison PRÉVUE mais dont le GLB n'existe pas
// encore. C'est volontaire : la taxonomie doit être complète avant les assets,
// pour que l'UI affiche la grille entière et grise ce qui manque plutôt que de
// faire croire que « alien » n'existe pas.
//
// Ajouter un modèle = renseigner son `path` ET son `partId`. Aucun autre code
// à toucher.
//
// ⚠ NE PAS filtrer les entrées `path: null` à la source. `availableBodies()`
// existe pour ça ; `BASE_BODIES` reste la liste complète, sinon l'UI perdrait la
// distinction entre « n'existe pas » et « pas encore modélisé ».
// ══════════════════════════════════════════════════════════════════════════════

import type { Gender } from "./partCatalog";

/** Espèce / nature du corps. */
export type ArchetypeId = "human" | "alien" | "synthetic" | "mutant";

/** Corpulence, indépendante de l'espèce. */
export type BuildId = "slim" | "athletic" | "muscular" | "heavy";

export interface BodyArchetype {
  id: ArchetypeId;
  label: string;
  /** Une phrase affichée sous le nom dans l'écran de création. */
  description: string;
}

export interface BodyBuild {
  id: BuildId;
  label: string;
  /**
   * Facteur d'épaisseur indicatif, appliqué faute de modèle dédié.
   *
   * Ce n'est PAS un remplacement d'un vrai morph : mettre un corps athlétique à
   * l'échelle 1,12 en X/Z donne une silhouette plus large, pas une musculature.
   * Sert de repli visible en attendant les modèles, et de valeur de départ si un
   * jour un morph `build` est exposé par les GLB.
   */
  girth: number;
}

export const ARCHETYPES: BodyArchetype[] = [
  { id: "human",     label: "Humain",      description: "Morphologie standard. Base de référence des équipements." },
  { id: "alien",     label: "Alien",       description: "Proportions non humaines. Certains équipements sont incompatibles." },
  { id: "synthetic", label: "Synthétique", description: "Châssis artificiel. Pièces mécaniques interchangeables." },
  { id: "mutant",    label: "Mutant",      description: "Anatomie altérée. Tolère les greffes de pièces hétérogènes." },
];

export const BUILDS: BodyBuild[] = [
  { id: "slim",     label: "Maigre",     girth: 0.92 },
  { id: "athletic", label: "Athlétique", girth: 1.0 },
  { id: "muscular", label: "Musclé",     girth: 1.1 },
  { id: "heavy",    label: "Corpulent",  girth: 1.22 },
];

export interface BaseBody {
  id: string;
  label: string;
  archetype: ArchetypeId;
  build: BuildId;
  /** Absent = corps non genré (aliens, synthétiques). */
  gender?: Gender;
  /** `null` = combinaison déclarée, modèle pas encore fourni. */
  path: string | null;
  /**
   * Identifiant de la pièce `body` correspondante dans `partCatalog`.
   *
   * ⚠ DEUX ESPACES D'IDENTIFIANTS DISTINCTS. `BaseBody.id` (`human_m_athletic`)
   * décrit une combinaison archétype × morphologie ; `ModularPart.id`
   * (`m_body`) désigne un GLB au catalogue. Équiper un personnage avec le
   * premier passe la validation de type mais échoue à l'exécution :
   * `pruneUnknown` ne le trouve pas au catalogue et le retire, laissant un
   * personnage sans corps — sans la moindre erreur.
   */
  partId: string | null;
}

const BIKER = "/models/personnages/BikerBundle/CharacterParts_Biker/Meshes/UE5_Mannequin_meta";

/**
 * Corps de base connus.
 *
 * Seuls les deux mannequins Biker existent aujourd'hui. Ils sont rattachés à la
 * morphologie `athletic` parce que c'est celle qui sert de référence aux
 * vêtements du pack — les rattacher à `slim` ferait croire qu'une variante
 * musclée manque alors que c'est la même géométrie.
 */
// ── LE MANNEQUIN BIKER EST LE SQUELETTE CANONIQUE (03/08/2026) ───────────────
//
// Mesuré par `scripts/inspect-base-bodies.mjs` : les corps homme et femme ont
// **161 os, racine "root", 100 % de recouvrement**. Un seul squelette, donc une
// pièce découpée et validée sur un genre vaut pour l'autre. C'est ce qui rend
// l'objectif tenable : greffer les découpes des nouveaux assets sur cette base.
//
// Les quatre morphologies partagent ce corps et ne diffèrent que par `girth`
// (0,92 → 1,22, cf. `BUILDS`). Elles étaient à `path: null`, donc grisées : le
// joueur voyait quatre choix dont un seul cliquable. Une morphologie qui change
// l'épaisseur d'un corps commun est un résultat honnête ; un bouton mort ne
// l'est pas.
//
// Le raffinement viendra des 1445 cibles MPFB2, qui s'appliquent au MAILLAGE et
// laissent le rig intact — elles n'invalideront pas ce choix.

const HUMAN_BODY: Record<Gender, { partId: string; path: string }> = {
  male:   { partId: "m_body", path: `${BIKER}/Male/Bodyparts/SK_ma_UE5_meta_body.glb` },
  female: { partId: "f_body", path: `${BIKER}/Female/Bodyparts/SK_fe_UE5_meta_body_muscular_IK.glb` },
};

const GENDER_LABEL: Record<Gender, string> = { male: "Humain", female: "Humaine" };
const BUILD_SUFFIX: Record<Gender, Record<BuildId, string>> = {
  male:   { slim: "maigre", athletic: "athlétique", muscular: "musclé",  heavy: "corpulent" },
  female: { slim: "maigre", athletic: "athlétique", muscular: "musclée", heavy: "corpulente" },
};

/**
 * Corps humains — générés, pas listés.
 *
 * Écrire les huit entrées à la main invitait l'oubli : c'est exactement ce qui
 * s'est produit, six d'entre elles étant restées à `path: null`. Dériver de
 * `BUILDS` garantit qu'une morphologie ajoutée demain aura son corps le jour même.
 */
const HUMAN_BODIES: BaseBody[] = (["male", "female"] as Gender[]).flatMap((gender) =>
  BUILDS.map((b) => ({
    id: `human_${gender === "male" ? "m" : "f"}_${b.id}`,
    label: `${GENDER_LABEL[gender]} — ${BUILD_SUFFIX[gender][b.id]}`,
    archetype: "human" as ArchetypeId,
    build: b.id,
    gender,
    partId: HUMAN_BODY[gender].partId,
    path: HUMAN_BODY[gender].path,
  })),
);

export const BASE_BODIES: BaseBody[] = [
  ...HUMAN_BODIES,

  { id: "alien_slim",       label: "Alien — élancé",         archetype: "alien",     build: "slim",     partId: null, path: null },
  { id: "alien_athletic",   label: "Alien — standard",       archetype: "alien",     build: "athletic", partId: null, path: null },
  { id: "alien_heavy",      label: "Alien — massif",         archetype: "alien",     build: "heavy",    partId: null, path: null },

  { id: "synth_slim",       label: "Synthétique — léger",    archetype: "synthetic", build: "slim",     partId: null, path: null },
  { id: "synth_athletic",   label: "Synthétique — standard", archetype: "synthetic", build: "athletic", partId: null, path: null },
  { id: "synth_muscular",   label: "Synthétique — lourd",    archetype: "synthetic", build: "muscular", partId: null, path: null },

  { id: "mutant_muscular",  label: "Mutant — musclé",        archetype: "mutant",    build: "muscular", partId: null, path: null },
  { id: "mutant_heavy",     label: "Mutant — colossal",      archetype: "mutant",    build: "heavy",    partId: null, path: null },
];

const ARCHETYPE_BY_ID = new Map(ARCHETYPES.map((a) => [a.id, a]));
const BUILD_BY_ID = new Map(BUILDS.map((b) => [b.id, b]));
const BODY_BY_ID = new Map(BASE_BODIES.map((b) => [b.id, b]));

export function getArchetype(id: string): BodyArchetype | undefined { return ARCHETYPE_BY_ID.get(id as ArchetypeId); }
export function getBuild(id: string): BodyBuild | undefined { return BUILD_BY_ID.get(id as BuildId); }
export function getBaseBody(id: string): BaseBody | undefined { return BODY_BY_ID.get(id); }

/** Corps réellement jouables — ceux dont le modèle existe. */
export function availableBodies(): BaseBody[] {
  return BASE_BODIES.filter((b) => b.path !== null);
}

/** Morphologies proposées pour un archétype, modèle fourni ou non. */
export function buildsFor(archetype: ArchetypeId): BodyBuild[] {
  const présents = new Set(BASE_BODIES.filter((b) => b.archetype === archetype).map((b) => b.build));
  return BUILDS.filter((b) => présents.has(b.id));
}

/**
 * Corps correspondant à un choix, ou `undefined`.
 *
 * `gender` est ignoré pour les archétypes non genrés : demander un alien
 * « masculin » ne doit pas renvoyer vide alors qu'un seul corps existe.
 */
export function findBody(archetype: ArchetypeId, build: BuildId, gender?: Gender): BaseBody | undefined {
  return BASE_BODIES.find(
    (b) => b.archetype === archetype && b.build === build && (b.gender === undefined || b.gender === gender),
  );
}

/** Un archétype a-t-il au moins un corps jouable ? Sert à griser l'entrée d'UI. */
export function isArchetypePlayable(archetype: ArchetypeId): boolean {
  return BASE_BODIES.some((b) => b.archetype === archetype && b.path !== null);
}
