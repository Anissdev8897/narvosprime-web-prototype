#!/usr/bin/env node
/**
 * Reecrit les #include qui epinglent le chemin physique du moteur.
 *
 *   #include "Runtime/Engine/Classes/Materials/MaterialInstanceDynamic.h"
 *   -> #include "Materials/MaterialInstanceDynamic.h"
 *
 * UBT ajoute les dossiers Public/ et Classes/ de chaque module dependant au
 * chemin d'include : la forme canonique est donc relative au module. La forme
 * longue marche tant que l'arborescence du moteur ne bouge pas — et elle a
 * bouge en 5.8 (Engine/Classes/Materials -> Engine/Public/Materials).
 *
 * `Runtime/Launch/Resources/Version.h` est laisse tel quel : pas de segment
 * Public/Classes, c'est l'idiome officiel pour lire ENGINE_MINOR_VERSION.
 *
 * Simulation par defaut ; `--apply` ecrit.
 *
 * Usage :
 *   node scripts/unreal-fix-includes.mjs <racine> [--apply]
 */

import fs from "node:fs";
import path from "node:path";

const root = process.argv[2];
const APPLY = process.argv.includes("--apply");

if (!root || !fs.existsSync(root)) {
  console.error("Usage : node scripts/unreal-fix-includes.mjs <racine> [--apply]");
  process.exit(1);
}

// Racine du moteur suivie du nom de module, puis du dossier expose. Seul ce qui
// suit est conserve.
//
// `Private/` est volontairement exclu : les headers prives d'un module ne sont
// PAS sur le chemin d'include. La forme longue y est la seule qui fonctionne
// (avec le PrivateIncludePaths correspondant dans le .Build.cs) — la raccourcir
// casserait du code qui compile, par exemple
// `Runtime/Renderer/Private/SceneRendering.h`.
const PATTERN =
  /^(\s*)#include\s+"(?:Runtime|Editor|Developer|ThirdParty)\/[^/"]+\/(?:Public|Classes)\/([^"]+)"/gm;

const SOURCE_EXT = new Set([".h", ".cpp", ".hpp", ".inl"]);

const walk = (dir, acc = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    // Intermediate contient les artefacts de build : les toucher n'a aucun effet.
    if (entry.isDirectory()) {
      if (entry.name === "Intermediate" || entry.name === "Binaries") continue;
      walk(path.join(dir, entry.name), acc);
    } else if (SOURCE_EXT.has(path.extname(entry.name))) {
      acc.push(path.join(dir, entry.name));
    }
  }
  return acc;
};

let touched = 0;
let rewritten = 0;

for (const file of walk(root)) {
  const before = fs.readFileSync(file, "utf8");
  if (!before.includes("#include \"")) continue;

  let count = 0;
  const after = before.replace(PATTERN, (_match, indent, tail) => {
    count++;
    return `${indent}#include "${tail}"`;
  });
  if (count === 0) continue;

  touched++;
  rewritten += count;
  console.log(`${String(count).padStart(3)}  ${path.relative(root, file)}`);
  if (APPLY) fs.writeFileSync(file, after, "utf8");
}

console.log("");
console.log(
  `${APPLY ? "APPLIQUE" : "SIMULATION (ajouter --apply)"} : ${rewritten} include(s) dans ${touched} fichier(s)`,
);