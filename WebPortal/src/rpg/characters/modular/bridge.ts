// ══════════════════════════════════════════════════════════════════════════════
// characters/modular/bridge.ts — Pont entre le pipeline mort et le système vivant.
//
// Trois responsabilités :
//   1. Migration CustomCharacter v1→v2 (ajout du champ `equipped`)
//   2. Résolution de l'équipement (fusion explicit + defaults)
//   3. Discriminateur pour les personnages modulaires
//
// C'est la seule surface publique que le reste de l'appli doit importer.
// ══════════════════════════════════════════════════════════════════════════════

import type { CustomCharacter } from "../customCharacterStore";
import { starterOutfit, type Gender } from "./partCatalog";
import { type BodySlot, REQUIRED_SLOTS } from "./bodySlots";

/** Valeur de `baseAvatar` qui désigne un personnage modulaire (pipeline BikerBundle). */
export const MODULAR_BODY_ID = "modular";

/** Nouvelle clé de stockage pour les CustomCharacter v2 (équipement modulaire). */
export const STORAGE_KEY_V2 = "narvos:custom_characters:v2";

/**
 * Migre un CustomCharacter v1 (sans `equipped`) vers v2.
 *
 * RÈGLE : si `equipped` est absent OU vide, on le peuple avec `starterOutfit(gender)`.
 * Sinon, on le laisse tel quel (déjà migré ou créé en v2).
 *
 * Ne mute PAS l'objet original — retourne une shallow copy enrichie.
 */
export function migrateCustomCharacter(
  c: CustomCharacter,
  gender: Gender = "male",
): CustomCharacter {
  if (c.equipped && Object.keys(c.equipped).length > 0) {
    return c; // déjà migré ou créé en v2
  }

  return {
    ...c,
    equipped: { ...starterOutfit(gender) },
  };
}

/**
 * Résout l'équipement d'un CustomCharacter, quel que soit son schéma (v1 ou v2).
 *
 * - v2 avec `equipped` présent → retourné tel quel, complété SEULEMENT par les
 *   `REQUIRED_SLOTS` manquants. Le reste = choix explicite de l'utilisateur.
 * - v1 sans `equipped` → tenue de départ complète.
 *
 * ── `head` N'EST PLUS COMPLÉTÉ D'OFFICE ──────────────────────────────────────
 *
 * Cette fonction forçait `["body", "head"]` en dur, alors que `REQUIRED_SLOTS`
 * ne contient que `body` — et le commentaire prétendait le contraire.
 *
 * Deux raisons de s'aligner sur la constante :
 *   • Mesuré : `m_body` porte 43 % de sommets skinnés sur l'os `head`,
 *     `f_body` 50 %. Les corps sont COMPLETS, `head` est une variante.
 *   • Le catalogue féminin n'a AUCUNE pièce `head`. Exiger le slot était
 *     insatisfiable pour la moitié des personnages.
 */
export function resolveEquipped(
  c: CustomCharacter,
  gender: Gender = "male",
): Partial<Record<BodySlot, string>> {
  const defaults = starterOutfit(gender);
  const equipped = c.equipped ?? {};

  // v1 sans equipped → tenue de départ complète
  if (!c.equipped || Object.keys(c.equipped).length === 0) {
    return { ...defaults };
  }

  // v2 : on garde l'explicite, on complète SEULEMENT les slots requis manquants
  const merged = { ...equipped };
  for (const slot of REQUIRED_SLOTS) {
    if (!merged[slot] && defaults[slot]) {
      merged[slot] = defaults[slot];
    }
  }
  return merged;
}

/**
 * Discriminateur : true si le personnage utilise le pipeline modulaire BikerBundle.
 *
 * Basé sur `baseAvatar === "modular"` — seule condition nécessaire et suffisante.
 */
export function isModularCustomCharacter(c: CustomCharacter | undefined | null): boolean {
  return !!c && c.baseAvatar === MODULAR_BODY_ID;
}
