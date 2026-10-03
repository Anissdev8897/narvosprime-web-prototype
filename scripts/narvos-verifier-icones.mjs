// ══════════════════════════════════════════════════════════════════════════════
// narvos-verifier-icones.mjs — vérifie que chaque `iconFile` d'un item existe
// sur disque (public/textures/icons/craft/<iconFile>.webp).
//
//   node scripts/narvos-verifier-icones.mjs
//
// Une icône morte ne se voit qu'à L'ÉCRAN, et trop tard. Ce script la rattrape —
// comme `narvos-verifier-catalogues.mjs` fait pour les références de catalogues.
// Lit `itemCatalog.ts` (esbuild, LA source fait foi) puis check chaque chemin.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const RACINE = "E:/narvosprime-web-prototype";
const TS = `${RACINE}/WebPortal/src/rpg/items/itemCatalog.ts`;
const ICON_DIR = `${RACINE}/WebPortal/public/textures/icons/craft`;
const ESBUILD = `${RACINE}/WebPortal/node_modules/esbuild/bin/esbuild`;

let ts;
try {
  const tmp = path.join(os.tmpdir(), `icones-item-${Date.now()}.mjs`);
  execFileSync("node", [ESBUILD, TS, "--bundle", "--format=esm", "--platform=node", `--outfile=${tmp}`]);
  ts = await import(pathToFileURL(tmp).href);
} catch (e) {
  console.error("ERREUR esbuild:", e.message);
  process.exit(1);
// [FIN INCONNUE — la suite du fichier n'a jamais été lue dans sa dernière version]