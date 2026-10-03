// ══════════════════════════════════════════════════════════════════════════════
// characters/modular/partCatalog.ts — Catalogue des pièces modulaires.
//
// SOURCE : BikerBundle/CharacterParts_Biker — pack UE5 dont toutes les pièces
// sont skinnées sur le mannequin `UE5_Mannequin_meta`. Écart de pose de bind
// mesuré entre le corps et les vêtements : 0,0000 → assemblage sans déformation.
//
// Chemins vérifiés par listing du dossier — ne pas les deviner.
//
// ── LES HÉROS SONT DÉSORMAIS DÉCOUPÉS, HORS LIGNE ────────────────────────────
//
// Ce fichier affirmait que Wraith, Murdock et consorts « ne peuvent NI être
// découpés NI recevoir les pièces de ce pack ». La première moitié est caduque
// depuis le 02/08/2026 : `scripts/extract-body-parts.mjs` les segmente et
// produit 39 pièces, exposées par `heroParts.ts`. Le découpage se fait à la
// GÉNÉRATION, pas en jeu — la nuance importe, rien n'est calculé au runtime.
//
// La seconde moitié tient toujours : chaque pièce garde son squelette d'origine
// (68 à 168 os). Rien ne garantit qu'une tête de Wraith se pose sur un corps
// Biker. C'est `rebindSkinnedMesh` qui tranche, au seuil de 50 % de couverture.
// Ce catalogue expose les pièces et leur nombre d'os ; il ne promet pas qu'elles
// s'assemblent.
// ══════════════════════════════════════════════════════════════════════════════

import type { BodySlot } from "./bodySlots";
import { HERO_PARTS } from "./heroParts";

export type Gender = "male" | "female";

export interface ModularPart {
  id: string;
  label: string;
  slot: BodySlot;
  /**
   * Absent = pièce UNIVERSELLE, proposée quel que soit le genre choisi.
   *
   * Les pièces découpées des héros n'ont pas de genre : Wraith n'est ni le
   * mannequin masculin ni le féminin. Les ranger de force dans l'un des deux
   * aurait caché la moitié du catalogue à la moitié des joueurs.
   */
  gender?: Gender;
  path: string;
  /** Pack d'origine — `biker` ou l'identifiant du héros découpé. */
  source: string;
  /** Os du squelette d'origine (pièces héros) : indice de compatibilité. */
  bones?: number;
  /** `material` = découpe d'auteur, `bone` = segmentation calculée,
   *  `author` = pièce livrée déjà séparée (asIs, aucune découpe). */
  cut?: "material" | "bone" | "author";
}

const ROOT = "/models/personnages/BikerBundle/CharacterParts_Biker/Meshes/UE5_Mannequin_meta";
const M = `${ROOT}/Male`;
const F = `${ROOT}/Female`;

/** Pack Biker — `source` ajouté à la composition, pour ne pas le répéter 45 fois. */
const BIKER_PARTS: Omit<ModularPart, "source">[] = [
  // ── Homme — anatomie ──────────────────────────────────────────────────────
  { id: "m_body", label: "Corps masculin", slot: "body", gender: "male", path: `${M}/Bodyparts/SK_ma_UE5_meta_body.glb` },
  { id: "m_arms", label: "Bras", slot: "arms", gender: "male", path: `${M}/Bodyparts/SK_ma_meta_body_arms.glb` },
  { id: "m_hands", label: "Mains", slot: "hands", gender: "male", path: `${M}/Bodyparts/SK_ma_meta_body_hands.glb` },
  { id: "m_head_01", label: "Visage 1", slot: "head", gender: "male", path: `${M}/Bodyparts/SK_ma_meta_body_head_01.glb` },
  { id: "m_head_02", label: "Visage 2", slot: "head", gender: "male", path: `${M}/Bodyparts/SK_ma_meta_body_head_02.glb` },
  { id: "m_hair_used", label: "Cheveux courts", slot: "hair", gender: "male", path: `${M}/Bodyparts/SK_ma_meta_tal_nrw_hair_used.glb` },
  { id: "m_hair_wild", label: "Cheveux longs", slot: "hair", gender: "male", path: `${M}/Bodyparts/SK_ma_meta_tal_nrw_hair_wild.glb` },
  { id: "m_beard", label: "Barbe fournie", slot: "beard", gender: "male", path: `${M}/Bodyparts/SK_ma_meta_tal_nrw_beard_full.glb` },

  // ── Homme — vêtements ─────────────────────────────────────────────────────
  { id: "m_jacket_a", label: "Blouson cuir A", slot: "top", gender: "male", path: `${M}/SK_m_tal_nrw_jacket_leather_01_a.glb` },
  { id: "m_jacket_b", label: "Blouson cuir B", slot: "top", gender: "male", path: `${M}/SK_m_tal_nrw_jacket_leather_01_b.glb` },
  { id: "m_jacket_c", label: "Blouson cuir C", slot: "top", gender: "male", path: `${M}/SK_m_tal_nrw_jacket_leather_01_c.glb` },
  { id: "m_jacket_d", label: "Blouson cuir D", slot: "top", gender: "male", path: `${M}/SK_m_tal_nrw_jacket_leather_01_d.glb` },
  { id: "m_vest_jeans", label: "Gilet en jean", slot: "top", gender: "male", path: `${M}/SK_m_tal_nrw_jeans_vest_used.glb` },
  { id: "m_vest_jeans_b", label: "Gilet en jean usé", slot: "top", gender: "male", path: `${M}/SK_m_tal_nrw_jeans_vest_used_b.glb` },
  { id: "m_vest_long", label: "Chemise longue", slot: "top", gender: "male", path: `${M}/SK_m_tal_nrw_vest_longshirt.glb` },
  { id: "m_shirt_vest", label: "Chemise sans manches", slot: "top", gender: "male", path: `${M}/SK_ma_meta_tal_nrw_shirt_vest.glb` },
  { id: "m_tanktop", label: "Débardeur", slot: "top", gender: "male", path: `${M}/SK_ma_meta_tal_nrw_tanktop_short.glb` },
  { id: "m_jeans", label: "Jean", slot: "pants", gender: "male", path: `${M}/SK_ma_meta_tal_nrw_pants_jeans.glb` },
  { id: "m_boots_half", label: "Bottes mi-hautes", slot: "shoes", gender: "male", path: `${M}/SK_ma_meta_tal_nrw_shoe_boots_half.glb` },
  { id: "m_shoes", label: "Chaussures basses", slot: "shoes", gender: "male", path: `${M}/SK_ma_meta_tal_nrw_shoe_short.glb` },
  { id: "m_gloves", label: "Gants biker", slot: "gloves", gender: "male", path: `${M}/SK_ma_meta_tal_nrw_glove_biker.glb` },
  { id: "m_gloves_02", label: "Gants biker 2", slot: "gloves", gender: "male", path: `${M}/SK_ma_meta_tal_nrw_glove_biker_02.glb` },

  // ── Homme — accessoires ───────────────────────────────────────────────────
  { id: "m_bandana_head", label: "Bandana frontal", slot: "headwear", gender: "male", path: `${M}/Accessories/SK_ma_tal_nrw_hat_bandana_forhead.glb` },
  { id: "m_bandana_full", label: "Bandana intégral", slot: "headwear", gender: "male", path: `${M}/Accessories/SK_ma_tal_nrw_hat_bandana_full.glb` },
  { id: "m_glass_02", label: "Lunettes 1", slot: "eyewear", gender: "male", path: `${M}/Accessories/SK_ma_meta_tal_nrw_glass_02.glb` },
  { id: "m_glass_03", label: "Lunettes 2", slot: "eyewear", gender: "male", path: `${M}/Accessories/SK_ma_meta_tal_nrw_glass_03.glb` },
  { id: "m_bracelet_01", label: "Bracelet", slot: "accessory", gender: "male", path: `${M}/Accessories/SK_m_tal_nrw_bracelett_01_a.glb` },
  { id: "m_ring", label: "Bague", slot: "accessory", gender: "male", path: `${M}/Accessories/SK_m_tal_nrw_ring_01.glb` },

  // ── Femme — anatomie ──────────────────────────────────────────────────────
  { id: "f_body", label: "Corps féminin", slot: "body", gender: "female", path: `${F}/Bodyparts/SK_fe_UE5_meta_body_muscular_IK.glb` },
  { id: "f_hair", label: "Cheveux", slot: "hair", gender: "female", path: `${F}/SK_fe_tal_hair_02.glb` },

  // ── Femme — vêtements ─────────────────────────────────────────────────────
  { id: "f_leatherjack_a", label: "Blouson cuir A", slot: "top", gender: "female", path: `${F}/SK_fe_meta_tal_nrw_leatherjack_01_a.glb` },
  { id: "f_leatherjack_b", label: "Blouson cuir B", slot: "top", gender: "female", path: `${F}/SK_fe_meta_tal_nrw_leatherjack_01_b.glb` },
  { id: "f_tanktop", label: "Débardeur", slot: "top", gender: "female", path: `${F}/SK_fe_meta_tal_nrw_chest_tanktop.glb` },
  { id: "f_shirt_half", label: "Chemise courte", slot: "top", gender: "female", path: `${F}/SK_fe_meta_tal_nrw_shirt_half.glb` },
  { id: "f_shirt_vest_a", label: "Gilet A", slot: "top", gender: "female", path: `${F}/SK_fe_meta_tal_nrw_shirt_vest_a.glb` },
  { id: "f_shirt_vest_used", label: "Gilet usé", slot: "top", gender: "female", path: `${F}/SK_fe_meta_tal_nrw_shirt_vest_used.glb` },
  { id: "f_jeans", label: "Jean", slot: "pants", gender: "female", path: `${F}/SK_fe_meta_tal_nrw_pants_jeans.glb` },
  { id: "f_jeans_wide", label: "Jean large", slot: "pants", gender: "female", path: `${F}/SK_fe_meta_tal_nrw_pants_jeans_wide.glb` },
  { id: "f_boot_01", label: "Bottes", slot: "shoes", gender: "female", path: `${F}/SK_fe_meta_tal_nrw_boot_01_a.glb` },
  { id: "f_boot_casual", label: "Bottines", slot: "shoes", gender: "female", path: `${F}/SK_fe_meta_tal_nrw_boot_casual.glb` },
  { id: "f_gloves_01", label: "Gants biker", slot: "gloves", gender: "female", path: `${F}/Accessories/SK_fe_meta_tal_nrw_glove_biker_01.glb` },
  { id: "f_gloves_02", label: "Gants biker 2", slot: "gloves", gender: "female", path: `${F}/Accessories/SK_fe_meta_tal_nrw_glove_biker_02.glb` },

  // ── Femme — accessoires ───────────────────────────────────────────────────
  { id: "f_bandana", label: "Bandana", slot: "headwear", gender: "female", path: `${F}/Accessories/SK_fe_tal_nrw_hat_bandana.glb` },
  { id: "f_headband", label: "Serre-tête", slot: "headwear", gender: "female", path: `${F}/Accessories/SK_fe_tal_nrw_headband.glb` },
  { id: "f_glass_02", label: "Lunettes", slot: "eyewear", gender: "female", path: `${F}/Accessories/SK_fe_meta_tal_nrw_glass_02.glb` },
];

/**
 * Catalogue complet : pack Biker + pièces découpées des héros.
 *
 * L'ordre compte pour l'UI — les pièces du pack de base viennent d'abord, les
 * variantes héros ensuite. Une flèche « suivant » part donc du connu vers
 * l'exotique.
 */
export const MODULAR_PARTS: ModularPart[] = [
  ...BIKER_PARTS.map((p) => ({ ...p, source: "biker" })),
  ...HERO_PARTS.map(({ sourceLabel: _ignored, ...p }) => p),
];

const BY_ID = new Map(MODULAR_PARTS.map((p) => [p.id, p]));

export function getPart(id: string): ModularPart | undefined { return BY_ID.get(id); }

/**
 * Pièces proposées pour un emplacement, genre compris.
 *
 * Inclut les pièces sans genre : ce sont les variantes héros, qui doivent
 * apparaître dans les deux cas.
 */
export function partsFor(gender: Gender, slot: BodySlot): ModularPart[] {
  return MODULAR_PARTS.filter((p) => p.slot === slot && (p.gender === undefined || p.gender === gender));
}

/**
 * TOUTES les pièces d'un emplacement, tous packs et tous genres confondus.
 *
 * C'est la liste que demande l'éditeur modulaire : « toutes les têtes dans une
 * même liste », qu'elles viennent du mannequin Biker, de Wraith ou d'Echo.
 * `partsFor` reste la vue filtrée pour la création de personnage classique.
 */
export function partsForSlot(slot: BodySlot): ModularPart[] {
  return MODULAR_PARTS.filter((p) => p.slot === slot);
}

/** Emplacements réellement pourvus pour un genre (l'UI ne montre que ceux-là). */
export function availableSlots(gender: Gender): BodySlot[] {
  const s = new Set<BodySlot>();
  for (const p of MODULAR_PARTS) if (p.gender === undefined || p.gender === gender) s.add(p.slot);
  return [...s];
}

/** Emplacements pourvus, tous packs confondus — vue de l'éditeur modulaire. */
export function allAvailableSlots(): BodySlot[] {
  const s = new Set<BodySlot>();
  for (const p of MODULAR_PARTS) s.add(p.slot);
  return [...s];
}

/**
 * Tenue du personnage NEUF : vêtements de pauvre, aucun équipement.
 *
 * ── SLOTS VOLONTAIREMENT VIDES ───────────────────────────────────────────────
 *
 * Ne pas « combler les trous » : chaque absence est un choix.
 *
 *   torso, legs, feet   anatomie déjà portée par `body`, et de toute façon
 *                       masquée par `SLOT_HIDES` sous `top`/`pants`/`shoes`.
 *   beard               facultatif, laissé au joueur.
 *   gloves, headwear    ÉQUIPEMENT — le joueur démarre sans.
 *   eyewear, back
 *   accessory
 *
 * ── REMPLACE `defaultOutfit`, QUI A ÉTÉ SUPPRIMÉE ────────────────────────────
 *
 * L'ancienne fonction a été introduite puis migrée en un seul passage, plutôt
 * que modifiée en place : `migrateCustomCharacter` la consomme pour les
 * personnages v1 déjà persistés, et la muter aurait changé leur apparence
 * RÉTROACTIVEMENT, sans diff visible sur le changement de comportement.
 *
 * Aucun alias déprécié n'est laissé derrière : un export sans appelant n'est
 * signalé par rien dans ce projet (pas de linter, et tsc ne voit pas non plus
 * les imports CSS).
 *
 * Écart assumé : bottes biker → chaussures basses (`m_boots_half` → `m_shoes`,
 * `f_boot_01` → `f_boot_casual`). Les bottes lisent comme de l'équipement, pas
 * comme une tenue de départ.
 *
 * ⚠ `arms` et `hands` sont CONSERVÉS, contrairement à ce que la mesure
 * suggérerait. `m_body` porte déjà 15 % de sommets skinnés sur les mains, donc
 * la géométrie est superposée — mais rien ne prouve que les avant-bras du corps
 * seul sont correctement texturés. Les retirer demande une validation
 * VISUELLE ; tant qu'elle n'est pas faite, on garde le comportement actuel.
 */
export function starterOutfit(gender: Gender): Partial<Record<BodySlot, string>> {
  // ── ANATOMIE SEULE — LE CORPS NE DOIT PAS ÊTRE MASQUÉ (03/08/2026) ─────────
  //
  // La tenue de départ équipait `top` / `pants` / `shoes`. Conséquence à
  // l'écran : le créateur montrait un personnage habillé, donc l'anatomie qu'on
  // vient y régler — buste, bras, jambes, pieds — était invisible sous le tissu.
  // On réglait à l'aveugle.
  //
  // Vêtements et équipement s'achètent désormais chez l'équipementier
  // (cf. `slotSource`). La composition de départ ne porte plus que du corps.
  return gender === "male"
    ? { body: "m_body", head: "m_head_01", arms: "m_arms", hands: "m_hands", hair: "m_hair_used" }
    : { body: "f_body", hair: "f_hair" };
}

/** Pièces d'un emplacement, groupées par pack — l'UI affiche l'origine. */
export function partsBySource(slot: BodySlot): Map<string, ModularPart[]> {
  const out = new Map<string, ModularPart[]>();
  for (const p of partsForSlot(slot)) {
    const liste = out.get(p.source);
    if (liste) liste.push(p);
    else out.set(p.source, [p]);
  }
  return out;
}
