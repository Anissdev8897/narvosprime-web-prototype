// ══════════════════════════════════════════════════════════════════════════════
// characters/modular/creator/merchantCatalog.ts — Le catalogue du Marchand. PUR.
//
// Regroupe les équipements issus des personnages découpés — armures, vêtements,
// accessoires — pour qu'on puisse les parcourir et les retrouver.
//
// ── CE MODULE NE MODIFIE JAMAIS LE PERSONNAGE ────────────────────────────────
//
// Règle du cahier des charges : « les équipements ne doivent pas apparaître dans
// l'édition de création du personnage ». Ici, la garantie est STRUCTURELLE et
// non déclarative : aucune fonction de ce fichier ne rend une `EditorSelection`
// ni ne touche à `equipped`. Il n'existe donc aucun chemin par lequel un essayage
// pourrait se retrouver sauvegardé.
//
// Ça compte parce que l'écran persiste en continu via `onChange`, pas au moment
// du « Sauvegarder » : une pièce écrite dans `equipped`, même « pour voir », y
// resterait.
//
// La logique de recherche vit ici et non dans le composant : c'est ce qui la
// rend testable sans monter React.
// ══════════════════════════════════════════════════════════════════════════════

import { MERCHANT_SLOTS, SLOT_LABELS, type BodySlot } from "../bodySlots";
import { partsForSlot, type ModularPart } from "../partCatalog";

/** Une entrée du catalogue, enrichie de quoi l'afficher et la filtrer. */
export interface MerchantEntry {
  part: ModularPart;
  /** Libellé de l'emplacement, pour que la recherche porte aussi dessus. */
  slotLabel: string;
}

/** Un pack d'origine et ses pièces. */
export interface MerchantGroup {
  source: string;
  entries: MerchantEntry[];
}

/**
 * Tout l'équipement disponible, quel que soit l'emplacement.
 *
 * Construit depuis `MERCHANT_SLOTS`, donc dérivé de la taxonomie : un nouvel
 * emplacement d'équipement apparaît ici sans qu'on y pense, et un emplacement
 * d'anatomie ne peut pas s'y glisser.
 */
export function allMerchantEntries(): MerchantEntry[] {
  const out: MerchantEntry[] = [];
  for (const slot of MERCHANT_SLOTS) {
    for (const part of partsForSlot(slot)) {
      out.push({ part, slotLabel: SLOT_LABELS[slot] });
    }
  }
  return out;
}

/**
 * Normalise pour la recherche : minuscules, accents retirés.
 *
 * Sans ça, chercher « epee » ne trouverait pas « Épée », et l'utilisateur
 * conclurait que la pièce n'existe pas.
 */
/** Bornes du bloc « Combining Diacritical Marks » (U+0300 à U+036F). */
const DIACRITIQUE_MIN = 0x0300;
const DIACRITIQUE_MAX = 0x036f;

function normaliser(s: string): string {
  // Filtrage par POINT DE CODE plutôt que par classe de caractères dans une
  // regex. Une plage `[̀-ͯ]` écrite en littéral finit par contenir de
  // vrais caractères combinants — invisibles dans un éditeur, collés au crochet
  // qui précède, et fragiles au moindre changement d'encodage du fichier.
  const nfd = s.toLowerCase().normalize("NFD");
  let out = "";
  for (const c of nfd) {
    const p = c.codePointAt(0) ?? 0;
    if (p < DIACRITIQUE_MIN || p > DIACRITIQUE_MAX) out += c;
  }
  return out;
}

/**
 * Filtre par texte libre et par emplacement.
 *
 * La recherche porte sur le nom, le **pack d'origine** et le libellé
 * d'emplacement — retrouver « tout ce qui vient de Wraith » est le geste
 * principal quand on range des découpes.
 *
 * Chaque mot doit correspondre (ET, pas OU) : « wraith casque » ne rend que les
 * casques de Wraith.
 */
export function filterMerchant(
  entries: readonly MerchantEntry[],
  query: string,
  slot: BodySlot | null,
): MerchantEntry[] {
  const mots = normaliser(query).split(/\s+/).filter(Boolean);
  return entries.filter((e) => {
    if (slot && e.part.slot !== slot) return false;
    if (mots.length === 0) return true;
    const foin = normaliser(`${e.part.label} ${e.part.source} ${e.slotLabel}`);
    return mots.every((m) => foin.includes(m));
  });
}

/**
 * Groupe par pack d'origine, packs triés par nom.
 *
 * C'est le regroupement demandé : voir d'un coup d'œil ce que chaque personnage
 * découpé a fourni. Les pièces gardent leur ordre de catalogue à l'intérieur
 * d'un pack — un tri alphabétique casserait les séries numérotées.
 */
export function groupBySource(entries: readonly MerchantEntry[]): MerchantGroup[] {
  const map = new Map<string, MerchantEntry[]>();
  for (const e of entries) {
    const liste = map.get(e.part.source);
    if (liste) liste.push(e);
    else map.set(e.part.source, [e]);
  }
  return [...map.entries()]
    .map(([source, list]) => ({ source, entries: list }))
    .sort((a, b) => a.source.localeCompare(b.source));
}

/** Emplacements d'équipement qui ont au moins une pièce — les autres n'ont rien à filtrer. */
export function merchantSlotsWithParts(): BodySlot[] {
  return MERCHANT_SLOTS.filter((s) => partsForSlot(s).length > 0);
}
