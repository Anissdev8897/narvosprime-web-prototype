// Répare un double-encodage UTF-8 → Windows-1252 → UTF-8.
//
// Cause : `Get-Content -Raw` sous PowerShell 5.1 lit un fichier UTF-8 SANS BOM
// en codepage ANSI. Réécrit en UTF-8, chaque accent devient deux caractères.
//
// Réparation : relire le texte comme du latin1 et le décoder en UTF-8 — c'est
// exactement l'opération inverse.
//
// Usage : node scripts/_fix-mojibake.mjs [--write]

import { readFileSync, writeFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";

const WRITE = process.argv.includes("--write");
const RACINES = ["src", "scripts", "electron"];
const EXT = new Set([".ts", ".tsx", ".mjs", ".js", ".css", ".json", ".md"]);
const IGNORE = new Set(["node_modules", "dist", "dist-electron", "_legacy_archive", "_vendor_sources"]);

/** Marqueurs de mojibake : séquences qui n'apparaissent pas en français normal. */
const MOJIBAKE = /Ã[©¨ªàa-¿]|â€|â•|â”|â–|Å"|Â[°«»§]/;

async function fichiers(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (IGNORE.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await fichiers(full)));
    else if (EXT.has(path.extname(e.name))) out.push(full);
  }
  return out;
}

const tous = [];
for (const r of RACINES) {
  try { tous.push(...(await fichiers(r))); } catch { /* racine absente */ }
}

let touches = 0;
for (const f of tous) {
  const texte = readFileSync(f, "utf8");
  if (!MOJIBAKE.test(texte)) continue;

  const repare = Buffer.from(texte, "latin1").toString("utf8");

  // Garde-fou : si la réparation réintroduit des marqueurs, c'est que le
  // fichier n'était pas doublement encodé — ne rien écrire.
  if (MOJIBAKE.test(repare)) {
    console.log(`  ? ${f} — marqueurs présents mais réparation douteuse, ignoré`);
    continue;
  }

  const avant = (texte.match(new RegExp(MOJIBAKE, "g")) ?? []).length;
  console.log(`  ${WRITE ? "✓" : "•"} ${f}  (${avant} séquences)`);
  if (WRITE) writeFileSync(f, repare, "utf8");
  touches++;
}

console.log(`\n${touches} fichier(s) ${WRITE ? "réparé(s)" : "à réparer"} sur ${tous.length} analysés.`);
if (!WRITE && touches) console.log("Relancer avec --write.");