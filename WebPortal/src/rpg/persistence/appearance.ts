// rpg/persistence/appearance.ts — apparence du personnage (teinte + modèle d'avatar).
//
// Persistée PAR PERSO en base (character_state.appearance) + cache localStorage
// pour la lecture synchrone au lancement du jeu (App lit avant de monter le monde).
//
// VALIDATION STRICTE des couleurs : des hex PARTIELS ("#d") ont été persistés par
// d'anciens inputs texte → toute lecture/écriture passe par sanitizeHexColor, et la
// lecture RÉPARE le cache (les données corrompues existantes s'auto-corrigent).
import { loadCharacterDb, saveCharacterDb } from "./dbStore";
import { sanitizeHexColor } from "../utils/color";

export interface Appearance { tint: string; model: string; }

const DEFAULT: Appearance = { tint: "#ffffff", model: "wraith" };
const tintKey = (id: string) => `narvos:tint:${id}`;
const modelKey = (id: string) => `narvos:model:${id}`;

function cacheLocal(charId: string, a: Appearance): void {
  try { localStorage.setItem(tintKey(charId), a.tint); localStorage.setItem(modelKey(charId), a.model); } catch { /* quota */ }
}

/** Enregistre l'apparence (localStorage + base) — teinte assainie à l'écriture. */
export function saveAppearance(charId: string, a: Appearance): void {
  if (!charId) return;
  const clean: Appearance = { tint: sanitizeHexColor(a.tint), model: a.model };
  cacheLocal(charId, clean);
  saveCharacterDb(charId, "appearance", clean); // → base (débouncé, no-op hors Electron)
}

/** Lecture synchrone (localStorage) — assainit ET RÉPARE le cache si corrompu. */
export function loadAppearance(charId: string): Appearance {
  try {
    const rawTint = localStorage.getItem(tintKey(charId)) || DEFAULT.tint;
    const tint = sanitizeHexColor(rawTint, DEFAULT.tint);
    if (tint !== rawTint) localStorage.setItem(tintKey(charId), tint); // répare le cache
    return { tint, model: localStorage.getItem(modelKey(charId)) || DEFAULT.model };
  } catch { return { ...DEFAULT }; }
}

/** Lecture base (Electron) — null si absente. Assainit + resync le cache + RÉPARE la base. */
export async function loadAppearanceDb(charId: string): Promise<Appearance | null> {
  if (!charId) return null;
  const a = await loadCharacterDb<Appearance>(charId, "appearance");
  if (a && typeof a.tint === "string" && typeof a.model === "string") {
    const clean: Appearance = { tint: sanitizeHexColor(a.tint), model: a.model };
    cacheLocal(charId, clean);
    if (clean.tint !== a.tint) saveCharacterDb(charId, "appearance", clean); // répare la base
    return clean;
  }
  return null;
}
