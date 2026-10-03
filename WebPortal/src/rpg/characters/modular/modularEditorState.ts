// ══════════════════════════════════════════════════════════════════════════════
// characters/modular/modularEditorState.ts — Navigation de l'éditeur (logique PURE).
//
// L'éditeur se pilote aux flèches : ◀ ▶ font défiler les pièces d'un
// emplacement. Toute cette mécanique — construire la liste, savoir où l'on est,
// avancer, reculer, boucler — vit ici, sans React ni Three.js.
//
// C'est le pattern « logique pure / coquille impure » du projet : le composant
// `ModularEditorPanel` n'est qu'un affichage au-dessus de ces fonctions, et la
// navigation reste vérifiable sans monter un Canvas.
//
// ── L'ENTRÉE « AUCUNE » ──────────────────────────────────────────────────────
//
// Chaque emplacement facultatif commence par une option vide (`id: null`). Sans
// elle, les flèches ne permettraient jamais de RETIRER une pièce : on ne
// pourrait que passer d'un chapeau à un autre, sans pouvoir se découvrir la
// tête. Les emplacements de `REQUIRED_SLOTS` n'en ont pas — le corps ne peut
// pas être absent.
// ══════════════════════════════════════════════════════════════════════════════

import {
  type BodySlot, type SlotCategory,
  REQUIRED_SLOTS, SLOT_CATEGORY, SLOT_ORDER, slotsInCategory,
} from "./bodySlots";
import { type ModularPart, partsForSlot, getPart, starterOutfit } from "./partCatalog";
import type { Gender } from "./partCatalog";
import { type ArchetypeId, type BuildId, findBody, BUILDS } from "./bodyArchetypes";
import { SKIN_TINTS, EYE_TINTS } from "./creator/creatorTokens";
import type { BodyProportions } from "./bodyProportions";
import { isCreatorPart } from "./anatomySources";

/** Une entrée de la liste défilante d'un emplacement. */
export interface SlotOption {
  /** `null` = « aucune pièce » (retirer l'équipement de cet emplacement). */
  id: string | null;
  label: string;
  /** Pack d'origine — affiché sous le nom pour situer la pièce. */
  source?: string;
  part?: ModularPart;
}

/** État complet de l'éditeur, sérialisable tel quel. */
export interface EditorSelection {
  archetype: ArchetypeId;
  build: BuildId;
  gender: Gender;
  /**
   * Réglages fins de silhouette (épaules, taille, bras).
   *
   * Absent = personnage d'avant les curseurs. `sanitizeProportions` rend alors
   * la silhouette d'origine — jamais un personnage tordu par des valeurs vides.
   */
  proportions?: BodyProportions;
  equipped: Partial<Record<BodySlot, string>>;
  /**
   * Morphologie fine : position de chaque curseur, de -1 à +1.
   *
   * Clé = `<région>.<axe>` (ex. `nose.nose-flaring`), produite par
   * `construireSliders`. On ne stocke QUE les curseurs déplacés : un
   * personnage neutre reste un objet vide plutôt qu'une liste de 199 zéros,
   * et un axe retiré d'un pack disparaît de lui-même au chargement suivant.
   *
   * Absent = personnage d'avant les curseurs — corps neutre, jamais une erreur.
   */
  morphs?: Record<string, number>;
  /**
   * Coiffure choisie (id de `COIFFURES`), ou absent = crâne nu.
   *
   * Stockée par ID et non par chemin : un pack déplacé sur le disque ne casse
   * pas les personnages déjà sauvegardés — seul `hairCatalog` connaît les
   * chemins.
   */
  hairId?: string;
  /** Couleur de la chevelure. */
  hairTint?: string;
  /** Teinte de peau, `#ffffff` = inchangée. */
  skinTint: string;
  /**
   * Couleur des iris, `#ffffff` = inchangée.
   *
   * Séparée de `skinTint` : les deux visent le même maillage et se distinguent
   * par le matériau. Les fusionner interdirait un teint sombre avec des yeux
   * clairs.
   */
  eyeTint: string;
}

export const DEFAULT_SKIN_TINT = "#ffffff";
export const DEFAULT_EYE_TINT = "#ffffff";

/**
 * Liste défilante d'un emplacement, dans l'ordre où les flèches la parcourent.
 *
 * Deux filtres, dans cet ordre :
 *
 * 1. `isCreatorPart` — l'anatomie n'accepte que les sources de corps nus. Sans
 *    lui, le découpeur y verse vestes, plastrons et bottes, parce qu'il classe
 *    une pièce par la région du corps qu'elle couvre, pas par sa nature. Le
 *    carrousel « torse » comptait 40 entrées, dont une majorité d'armures.
 * 2. `gender` — laisse passer les pièces universelles (dont MPFB2, corps neutre)
 *    et écarte celles de l'autre sexe.
 */
export function optionsForSlot(slot: BodySlot, gender: Gender): SlotOption[] {
  const pièces = partsForSlot(slot)
    .filter(isCreatorPart)
    .filter((p) => p.gender === undefined || p.gender === gender);
  const options: SlotOption[] = pièces.map((p) => ({
    id: p.id, label: p.label, source: p.source, part: p,
  }));
  if (REQUIRED_SLOTS.includes(slot)) return options;
  return [{ id: null, label: "Aucune" }, ...options];
}

/**
 * Position actuelle dans la liste d'un emplacement.
 *
 * Renvoie 0 si la pièce équipée est introuvable : un identifiant devenu obsolète
 * (pack retiré, pièce renommée) doit ramener l'utilisateur au début de la liste,
 * pas bloquer les flèches sur un index négatif.
 */
export function currentIndex(options: SlotOption[], equippedId: string | undefined): number {
  const i = options.findIndex((o) => o.id === (equippedId ?? null));
  return i >= 0 ? i : 0;
}

/**
 * Fait défiler un emplacement de `dir` crans et renvoie une NOUVELLE tenue.
 *
 * Boucle aux deux extrémités : arrivé à la dernière pièce, ▶ revient à la
 * première. Une liste circulaire évite d'avoir à griser les flèches, et la
 * navigation reste utilisable d'une seule main.
 */
export function cycleSlot(
  equipped: Partial<Record<BodySlot, string>>,
  slot: BodySlot,
  dir: 1 | -1,
  gender: Gender,
): Partial<Record<BodySlot, string>> {
  const options = optionsForSlot(slot, gender);
  if (options.length === 0) return equipped;

  const i = currentIndex(options, equipped[slot]);
  // `+ options.length` avant le modulo : en JS, (-1 % 3) vaut -1, pas 2.
  const suivant = options[(i + dir + options.length) % options.length];

  const out = { ...equipped };
  if (suivant.id === null) delete out[slot];
  else out[slot] = suivant.id;
  return out;
}

/** Équipe une pièce précise (choix par liste déroulante). */
export function setSlot(
  equipped: Partial<Record<BodySlot, string>>,
  slot: BodySlot,
  id: string | null,
): Partial<Record<BodySlot, string>> {
  const out = { ...equipped };
  if (id === null) delete out[slot];
  else out[slot] = id;
  return out;
}

/**
 * Emplacements à afficher pour une catégorie — uniquement ceux réellement
 * pourvus, pour ne pas montrer une rangée de flèches inertes.
 */
export function editableSlots(category: SlotCategory, gender: Gender): BodySlot[] {
  return slotsInCategory(category).filter((s) => {
    const n = optionsForSlot(s, gender).length;
    return REQUIRED_SLOTS.includes(s) ? n > 0 : n > 1; // > 1 : « Aucune » seule ne compte pas
  });
}

/** Catégories ayant au moins un emplacement à éditer. */
export function activeCategories(gender: Gender, all: SlotCategory[]): SlotCategory[] {
  return all.filter((c) => editableSlots(c, gender).length > 0);
}

/**
 * Résumé lisible d'un emplacement : « Tête — Wraith (3/12) ».
 * Sert de libellé central entre les deux flèches.
 */
export function slotSummary(slot: BodySlot, equipped: Partial<Record<BodySlot, string>>, gender: Gender): {
  label: string; position: number; total: number; source?: string;
} {
  const options = optionsForSlot(slot, gender);
  const idPorte = equipped[slot];
  const i = currentIndex(options, idPorte);

  // Pièce portée absente de la liste : ça arrive à un personnage sauvegardé
  // AVANT la liste blanche d'anatomie (05/08/2026), qui porte encore une tête
  // de Wraith ou une veste de zombie. `currentIndex` renvoie 0 dans ce cas — le
  // panneau annoncerait alors la PREMIÈRE option pendant que le modèle affiche
  // l'ancienne pièce. On préfère nommer ce qui est réellement porté, et le dire.
  if (idPorte && !options.some((o) => o.id === idPorte)) {
    const p = getPart(idPorte);
    if (p) {
      return { label: `${p.label} (hors catalogue)`, position: 0, total: options.length, source: p.source };
    }
  }

  const o = options[i];
  return { label: o?.label ?? "Aucune", position: i + 1, total: options.length, source: o?.source };
}

/**
 * Retire d'une tenue les pièces qui n'existent plus au catalogue.
 *
 * Appelé avant tout rendu : `useGLTF` lancé sur le chemin d'une pièce disparue
 * suspend indéfiniment, ce qui fige l'écran de création sans message d'erreur.
 */
export function pruneUnknown(
  equipped: Partial<Record<BodySlot, string>>,
): Partial<Record<BodySlot, string>> {
  const out: Partial<Record<BodySlot, string>> = {};
  for (const slot of SLOT_ORDER) {
    const id = equipped[slot];
    if (id && getPart(id)) out[slot] = id;
  }
  return out;
}

/**
 * Fenêtre de `size` éléments CENTRÉE sur `index`, bornée aux extrémités.
 *
 * Renvoie l'indice de départ à passer à `slice`.
 *
 * ── POURQUOI CENTRÉE ET BORNÉE ───────────────────────────────────────────────
 *
 * Faire défiler le contenu sous un curseur fixe désoriente : la pièce
 * sélectionnée sauterait d'un bord à l'autre. En centrant, elle reste au milieu ;
 * en bornant, on ne montre pas de cases vides en début et en fin de liste.
 *
 * L'écran de création calculait cette fenêtre à DEUX endroits, avec deux
 * comportements différents — dont un `Math.min` imbriqué recopié sur une seule
 * ligne. Une liste plus courte que la fenêtre y produisait un départ négatif.
 */
export function windowAround(total: number, index: number, size: number): number {
  if (total <= size) return 0;
  const brut = index - Math.floor(size / 2);
  return Math.max(0, Math.min(brut, total - size));
}

/** Catégorie d'un emplacement — réexport pratique pour le composant. */
export function categoryOf(slot: BodySlot): SlotCategory {
  return SLOT_CATEGORY[slot];
}

/**
 * Sélection de départ — un personnage jamais vide à l'ouverture de l'éditeur.
 *
 * Vit ici et non dans un composant : c'est de la logique d'état, testable sans
 * React, et son seul appelant côté composant a disparu avec le panneau latéral.
 *
 * ⚠ `corps.partId` et NON `corps.id`. Deux espaces d'identifiants distincts :
 * `BaseBody.id` (`human_m_athletic`) décrit une combinaison archétype ×
 * morphologie, `ModularPart.id` (`m_body`) désigne un GLB au catalogue. Passer
 * le premier satisfait le typage et produit un personnage SANS CORPS —
 * `pruneUnknown` ne le trouve pas et le retire en silence.
 */
/**
 * Sélection d'un personnage NEUF.
 *
 * Défaut = femme (choix produit du 04/08/2026). ⚠ Ne pas confondre avec le repli
 * des personnages EXISTANTS : ceux d'avant la bascule n'ont pas de `gender`
 * stocké et portent des pièces masculines. Les rouvrir en femme laisserait
 * `m_body` sur une sélection féminine, que `pruneUnknown` retirerait — corps
 * disparu, sans erreur. Leur repli reste donc `male`, côté `ForgePersonnages`.
 */
export function initialSelection(gender: Gender = "female"): EditorSelection {
  const corps = findBody("human", "athletic", gender);
  return {
    archetype: "human",
    build: "athletic",
    gender,
    equipped: corps?.partId ? { body: corps.partId } : {},
    skinTint: DEFAULT_SKIN_TINT,
    eyeTint: DEFAULT_EYE_TINT,
  };
}

/**
 * Personnage aléatoire — anatomie, morphologie, teintes et proportions.
 *
 * ── CE QUE LE HASARD NE TOUCHE PAS ───────────────────────────────────────────
 *
 * L'ARCHÉTYPE reste `human` : alien, synthétique et mutant n'ont pas de corps
 * (`path: null`). Les tirer donnerait un personnage sans corps une fois sur
 * quatre — un bouton « aléatoire » qui casse le perso n'est pas un bouton.
 *
 * Chaque emplacement est tiré parmi ses options RÉELLES du catalogue, `null`
 * compris : « pas de barbe » est un résultat légitime, pas un échec.
 *
 * `rnd` est injectable pour que les tests soient déterministes — sans lui il
 * faudrait tester un tirage, ce qui ne prouve rien.
 */
export function randomSelection(
  gender: Gender,
  rnd: () => number = Math.random,
): EditorSelection {
  // `readonly` accepté : les palettes du créateur sont figées, et les copier
  // pour satisfaire le typage allouerait à chaque tirage.
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length) % xs.length];
  const build = pick(BUILDS).id;
  const corps = findBody("human", build, gender);

  const equipped: Partial<Record<BodySlot, string>> = {};
  for (const slot of editableSlots("anatomy", gender)) {
    const choix = pick(optionsForSlot(slot, gender)).id;
    if (choix) equipped[slot] = choix;
  }
  // Le corps prime sur le tirage : c'est le seul emplacement REQUIS, et il doit
  // s'accorder à la morphologie tirée juste au-dessus.
  if (corps?.partId) equipped.body = corps.partId;

  // Teinte hors palette = personnages tous identiques évités, mais on reste sur
  // les teintes du catalogue : un tirage RVB libre donnerait des peaux vertes.
  return {
    archetype: "human",
    build,
    gender,
    equipped,
    proportions: {
      shoulderWidth: rnd() * 2 - 1,
      waistHeight: rnd() * 2 - 1,
      armLength: rnd() * 2 - 1,
    },
    skinTint: pick(SKIN_TINTS).value,
    eyeTint: pick(EYE_TINTS).value,
  };
}

/**
 * Bascule de genre — reconstruit la composition sur le catalogue de l'autre genre.
 *
 * ── POURQUOI ON NE PEUT PAS SE CONTENTER DE `{ ...sel, gender }` ─────────────
 *
 * Les pièces sont GENRÉES : `m_body` n'existe que pour l'homme, `f_body` que
 * pour la femme. Changer le seul champ `gender` laisserait un corps masculin sur
 * une sélection féminine — puis `pruneUnknown` retirerait les pièces devenues
 * introuvables, y compris `body`. Résultat : un personnage SANS CORPS, sans la
 * moindre erreur.
 *
 * On repart donc de la tenue de départ du nouveau genre, en conservant ce qui
 * ne dépend pas de lui : archétype, morphologie, teintes.
 */
export function switchGender(sel: EditorSelection, gender: Gender): EditorSelection {
  if (sel.gender === gender) return sel;
  const corps = findBody(sel.archetype, sel.build, gender);
  return {
    ...sel,
    gender,
    equipped: {
      ...starterOutfit(gender),
      // Le corps vient de l'archétype × morphologie courants, pas de la tenue de
      // départ : sans ça, basculer le genre ramènerait aussi la morphologie à
      // « athlétique » et le joueur perdrait son réglage sans comprendre.
      ...(corps?.partId ? { body: corps.partId } : {}),
    },
  };
}
