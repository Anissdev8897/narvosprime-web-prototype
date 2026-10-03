// ══════════════════════════════════════════════════════════════════════════════
// stats/progressionStore.ts — Sauvegarde/restauration de la progression joueur
//
// Persistance par PERSONNAGE (clé = id du perso) dans localStorage : survit au
// changement de map ET au redémarrage du jeu, fonctionne en web ET en Electron.
// Stocke l'état RUNTIME RPG (stats/xp/niveau, inventaire/crédits, map, position).
//
// Pourquoi localStorage et pas directement MySQL ?
//   • Le pont MySQL n'existe qu'en Electron ; localStorage marche partout (vérifiable).
//   • Le schéma SQL `characters.stats_json` est "Dofus" (pa/pm/vitalité…) ≠ PlayerStats.
//   Le push vers MySQL pourra s'ajouter par-dessus (même blob JSON) sans rien casser.
// ══════════════════════════════════════════════════════════════════════════════

import type { PlayerStats } from "./PlayerStats";
import type { InventoryState } from "../loot/Inventory";
import { pointsForLevel, spentPoints } from "./characteristics";
import { loadCharacterDb, readCharacterDb, saveCharacterDb, type DbRead } from "../persistence/dbStore";

/** Clé d'état en base (table character_state). */
const DB_KEY = "progression";

export interface Progression {
  /** classId au moment de la sauvegarde (garde-fou si la classe change). */
  classId: string;
  stats: PlayerStats;
  inventory: InventoryState;
  /** Dernière map visitée (clé de MAPS). */
  mapId: string;
  /** Dernière position monde. */
  position: { x: number; y: number; z: number };
  savedAt: number;
}

const keyOf = (charId: string) => `narvos:progress:${charId}`;

/** Applique les garde-fous / rétrocompat sur une progression chargée. */
function sanitizeProgression(p: Progression | null): Progression | null {
  if (!p) return null;
  if (p.stats) {
    // Sécurité : un perso sauvegardé "mort" revient avec un minimum de PV.
    if (p.stats.currentHp <= 0) p.stats.currentHp = Math.max(1, Math.round(p.stats.maxHp * 0.5));
    // Rétrocompat : saves antérieurs aux systèmes caractéristiques / talents.
    if (p.stats.elements == null) p.stats.elements = {};
    if (p.stats.talents == null) p.stats.talents = {};
    if (typeof p.stats.charPoints !== "number") {
      p.stats.charPoints = pointsForLevel(p.stats.level) - spentPoints(p.stats.elements);
    }
    // Rétrocompat : saves antérieurs au système shield/stamina.
    if (typeof p.stats.maxShield !== "number") {
      p.stats.maxShield = Math.round(p.stats.maxHp * 0.6);
      p.stats.currentShield = p.stats.maxShield;
    }
    if (typeof p.stats.maxStamina !== "number") {
      p.stats.maxStamina = 100;
      p.stats.currentStamina = 100;
    }
  }
  return p;
}

/**
 * Borne au-delà de laquelle une coordonnée est forcément le résultat d'un bug.
 *
 * `CharacterController` laisse tomber le joueur jusqu'à FALL_HARD_FLOOR
 * (−10000) quand la carte n'a pas encore de collision. Une sauvegarde prise à
 * ce moment-là fige le personnage dans le vide pour toujours.
 */
const COORD_MAX = 20_000;

export function saveProgression(charId: string, p: Progression): void {
  if (!charId) return;

  // GARDE NUMÉRIQUE — dernier rempart, tous appelants confondus.
  //
  // La position écrite ici est celle qui sera RESTAURÉE au prochain démarrage.
  // Y écrire un NaN ou une coordonnée aberrante condamne le personnage : il
  // renaît au mauvais endroit, y retombe, et la sauvegarde se réécrit. On
  // préfère donc conserver l'ancienne position que d'en enregistrer une
  // invalide — une sauvegarde périmée reste jouable, pas une sauvegarde folle.
  const q = p.position;
  const positionValide = q
    && Number.isFinite(q.x) && Number.isFinite(q.y) && Number.isFinite(q.z)
    && Math.abs(q.x) < COORD_MAX && Math.abs(q.y) < COORD_MAX && Math.abs(q.z) < COORD_MAX;

  let aEcrire = p;
  if (!positionValide) {
    const ancienne = loadProgression(charId)?.position;
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[progression] position refusée pour ${charId} : ` +
        `(${q?.x}, ${q?.y}, ${q?.z}) — ` +
        (ancienne ? "l'ancienne position est conservée." : "aucune position enregistrée."),
      );
    }
    aEcrire = ancienne ? { ...p, position: ancienne } : { ...p, position: undefined as never };
    if (!ancienne) return; // rien de sain à écrire : on n'écrase pas
  }

  try { localStorage.setItem(keyOf(charId), JSON.stringify(aEcrire)); }
  catch { /* quota / privé */ }
  saveCharacterDb(charId, DB_KEY, aEcrire); // → base (débouncé, no-op hors Electron)
}

export function loadProgression(charId: string): Progression | null {
  if (!charId) return null;
  try {
    const raw = localStorage.getItem(keyOf(charId));
    return raw ? sanitizeProgression(JSON.parse(raw) as Progression) : null;
  } catch { return null; }
}

/**
 * Charge la progression depuis la BASE — null si absente OU si la lecture a échoué.
 *
 * ⚠ Cette ambiguïté est destructrice pour un appelant qui écrit ensuite. Utiliser
 * `readProgressionDb` dès qu'une sauvegarde suit.
 */
export async function loadProgressionDb(charId: string): Promise<Progression | null> {
  if (!charId) return null;
  return sanitizeProgression(await loadCharacterDb<Progression>(charId, DB_KEY));
}

/**
 * Lecture typée de la progression : distingue « pas de sauvegarde cloud » de
 * « impossible de savoir ».
 *
 * ── POURQUOI C'EST LE POINT CRITIQUE ─────────────────────────────────────────
 *
 * Le monde de jeu construit un personnage NIVEAU 1 tant que la restauration n'a
 * pas eu lieu, et arme son autosave à 800 ms. La lecture, elle, expire à
 * 1500 ms. Sans ce retour typé, l'ordre garantissait l'écriture du niveau 1
 * AVANT même de savoir s'il existait une sauvegarde — donc son écrasement.
 */
export async function readProgressionDb(charId: string): Promise<DbRead<Progression>> {
  if (!charId) return { status: "ok", value: null };
  const r = await readCharacterDb<Progression>(charId, DB_KEY);
  return r.status === "ok" ? { status: "ok", value: sanitizeProgression(r.value) } : r;
}

export function hasProgression(charId: string): boolean {
  if (!charId) return false;
  try { return localStorage.getItem(keyOf(charId)) !== null; } catch { return false; }
}

export function clearProgression(charId: string): void {
  try { localStorage.removeItem(keyOf(charId)); } catch { /* ignore */ }
}
