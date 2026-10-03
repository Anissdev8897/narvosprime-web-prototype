// ══════════════════════════════════════════════════════════════════════════════
// electron/accountUnify.ts — SHIM d'authentification pour unifier les comptes.
//
// PROBLÈME (lot 7, plan docs/PLAN_UNIFICATION_COMPTES.md) : deux magasins
// d'identité. Web → nanos `comptes` (PBKDF2-Lua `selHex:iters:hash`), Electron →
// MySQL `users` (bcrypt). Un compte créé d'un côté ne se connecte pas de l'autre.
//
// CE SHIM : permet à l'Electron d'ACCEPTER un hash PBKDF2 du format JEU (Comptes.lua /
// storage.ts) au lieu de le refuser (`database.ts:449-453` refuse tout non-bcrypt).
//
// ⚠ NON-INVASIF : `UNIFY_ACCOUNTS = false` par défaut → aucune modification du
// chemin de connexion existant. Ne pas activer sans validation d'Aniss.
// ══════════════════════════════════════════════════════════════════════════════

import * as crypto from "node:crypto";

/** Drapeau d'activation. false = comportement existant (code non déclenché). */
export const UNIFY_ACCOUNTS = false;

/** Format jeu (PBKDF2) : `selHex:iterations:hashHex` (SHA-256, 256 bits). */
export interface Pbkdf2Hash { saltHex: string; iterations: number; hashHex: string; }

export function parseLuaPbkdf2(stored: string): Pbkdf2Hash | null {
  const m = /^([0-9a-fA-F]+):(\d+):([0-9a-fA-F]+)$/.exec(stored.trim());
  if (!m) return null;
  return { saltHex: m[1], iterations: parseInt(m[2], 10), hashHex: m[3] };
}

/** Recalcule un PBKDF2 (même schéma que Comptes.lua / storage.ts) et compare. */
export function verifyPbkdf2(passwordRaw: string, parsed: Pbkdf2Hash): boolean {
  try {
    const salt = Buffer.from(parsed.saltHex, "hex");
    const derived = crypto.pbkdf2Sync(passwordRaw, salt, parsed.iterations, 32, "sha256");
    const hex = derived.toString("hex");
    return crypto.timingSafeEqual(Buffer.from(hex, "hex"), Buffer.from(parsed.hashHex, "hex"));
  } catch {
    return false;
  }
}

/**
 * Vérifie un mot de passe contre un hash stocké, quel que soit son schéma.
 * - bcrypt   → délègue à `bcryptCompare` (le chemin Electron actuel).
 * - PBKDF2   → format jeu (`selHex:iters:hash`).
 * Retourne `null` si le hash n'est ni bcrypt ni PBKDF2 (le § existant gère le refus).
 * ⚠ UNIQUEMENT appelable quand `UNIFY_ACCOUNTS` est true.
 */
export async function verifyPasswordUnified(
  passwordRaw: string,
  storedHash: string,
  bcryptCompare: (p: string, h: string) => Promise<boolean>,
): Promise<"bcrypt" | "pbkdf2" | "unparsable"> {
  const isBcrypt = /^\$2[aby]\$/.test(storedHash);
  if (isBcrypt) return (await bcryptCompare(passwordRaw, storedHash)) ? "bcrypt" : "unparsable";
  const parsed = parseLuaPbkdf2(storedHash);
  if (parsed) return verifyPbkdf2(passwordRaw, parsed) ? "pbkdf2" : "unparsable";
  return "unparsable";
}

/**
 * Stub de SERVICE BCRYPT (à déployer si on délègue le hachage hors-Lua, comme
 * recommandé dans le plan : le PBKDF2-Lua est ~200× plus faible que bcrypt).
 * Expose l'interface attendue ; l'implémentation (micro-service bcrypt/argon2)
 * est le chantier serveur de Claude, PAS ce shim.
 */
export const bcryptService = {
  async hash(password: string): Promise<string> {
    // TODO(Claude) : appeler le service bcrypt externalisé (migration des hash).
    throw new Error("bcryptService : à déployer dans un service dédié (hors du shim)");
  },
  async verify(_password: string, _hash: string): Promise<boolean> {
    throw new Error("bcryptService : à déployer dans un service dédié (hors du shim)");
  },
};