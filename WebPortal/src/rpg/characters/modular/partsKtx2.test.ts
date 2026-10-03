// ══════════════════════════════════════════════════════════════════════════════
// partsKtx2.test.ts — Les pièces du créateur doivent rester en KTX2.
//
// ── L'HISTOIRE QUI JUSTIFIE CE TEST ─────────────────────────────────────────
//
// 03/08/2026 : les douze pièces canoniques sont converties en KTX2, 1749 → 103 Mo.
// 04/08/2026 : `extract-body-parts.mjs` est relancé pour ajouter des sources.
//              Il RÉGÉNÈRE les pièces depuis les GLB d'origine — les versions
//              KTX2 sont écrasées par des PNG frais.
// 05/08/2026 : mesuré, 144 GLB sur 221 sont repassés en PNG, dont les douze
//              pièces canoniques : 262 Mo de textures non compressées pour le
//              corps par défaut du créateur.
//
// Personne ne l'a vu, parce que rien ne le disait. Le jeu se contente de
// consommer plus de VRAM — jusqu'au « Context Lost », écran noir sans message.
//
// ── POURQUOI LIRE LE FICHIER, ET PAS SA TAILLE ──────────────────────────────
//
// Le premier diagnostic classait par poids : faux dans les deux sens.
// `echo/torso.glb` pèse 142 Mo ET est en KTX2 (c'est du maillage) ; une tête de
// 33 Mo peut être intégralement en PNG. Seul le contenu tranche : l'extension
// glTF `KHR_texture_basisu` est présente, ou elle ne l'est pas.
//
// On ne lit que l'entête + le chunk JSON (quelques Ko), jamais les 87 Mo du
// fichier : le test doit rester rapide même sur 200 pièces.
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import { openSync, readSync, closeSync, existsSync } from "node:fs";
import path from "node:path";
import { MODULAR_PARTS } from "./partCatalog";
import { isInCreator } from "./anatomySources";

const RACINE_PUBLIC = path.resolve(__dirname, "../../../../public");

/**
 * État de compression d'un GLB.
 *
 * `"sans-texture"` est un cas à part, pas un échec : les corps MPFB2 importés
 * de l'addon Blender n'embarquent AUCUNE image (ils rendent par couleur de
 * matériau). Un GLB sans texture ne peut pas porter `KHR_texture_basisu` et n'a
 * rien à y gagner — le confondre avec « non compressé » donnait six faux
 * positifs et rendait le test criard là où il n'y avait rien à corriger.
 */
type EtatCompression = "ktx2" | "png" | "sans-texture" | null;

function etatCompression(fichierGlb: string): EtatCompression {
  if (!existsSync(fichierGlb)) return null;
  const fd = openSync(fichierGlb, "r");
  try {
    const entete = Buffer.alloc(20);
    if (readSync(fd, entete, 0, 20, 0) < 20) return null;
    if (entete.readUInt32LE(0) !== 0x46546c67) return null; // magic "glTF"
    const tailleJson = entete.readUInt32LE(12);
    // Garde-fou : un chunk JSON démesuré signale un fichier corrompu, pas un
    // GLB à charger entièrement en mémoire dans un test.
    if (tailleJson <= 0 || tailleJson > 32 * 1024 * 1024) return null;
    const json = Buffer.alloc(tailleJson);
    readSync(fd, json, 0, tailleJson, 20);
    const gltf = JSON.parse(json.toString("utf8")) as {
      extensionsUsed?: string[];
      images?: unknown[];
    };
    if ((gltf.images ?? []).length === 0) return "sans-texture";
    return (gltf.extensionsUsed ?? []).some((e) => /basisu/i.test(e)) ? "ktx2" : "png";
  } catch {
    return null;
  } finally {
    closeSync(fd);
  }
}

/** Chemin disque d'une pièce, depuis son chemin web (`/models/...`). */
function surDisque(cheminWeb: string): string {
  return path.join(RACINE_PUBLIC, cheminWeb.replace(/^\//, ""));
}

describe("compression des pièces du créateur", () => {
  // `isInCreator` et non `isCreatorPart` : le second seul laisse passer les
  // casques et les bottes (emplacements marchand), qui ne sont pas la charge
  // VRAM de l'écran de création.
  const piecesCreateur = MODULAR_PARTS.filter(isInCreator);

  it("le catalogue du créateur n'est pas vide (le test inspecte vraiment quelque chose)", () => {
    // Un test qui parcourt une liste vide passe toujours. Sans ce garde-fou,
    // un filtre trop strict rendrait le suivant muet.
    expect(piecesCreateur.length).toBeGreaterThan(20);
  });

  it("toute pièce texturée proposée au créateur est en KTX2", () => {
    const enPng: string[] = [];
    for (const p of piecesCreateur) {
      // `null` = fichier absent : c'est le rôle d'un AUTRE test (intégrité du
      // catalogue). Ne pas le confondre avec « non compressé », sinon un pack
      // manquant se lirait comme un problème de VRAM.
      if (etatCompression(surDisque(p.path)) === "png") enPng.push(`${p.id} → ${p.path}`);
    }
    expect(
      enPng,
      `Ces pièces sont en PNG/JPEG — elles gonflent la VRAM et finissent en\n` +
        `« Context Lost ». Corriger avec :\n` +
        `  node scripts/assets-to-ktx2.mjs public/models/personnages/_parts --max=1024\n\n` +
        enPng.join("\n"),
    ).toEqual([]);
  });
});
