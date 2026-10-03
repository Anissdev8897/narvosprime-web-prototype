#!/usr/bin/env node
/**
 * Enveloppe dans TEXT() les litteraux passes aux accesseurs de FJsonObject.
 *
 *   jObject->GetIntegerField("UpdateRate")
 *   -> jObject->GetIntegerField(TEXT("UpdateRate"))
 *
 * En 5.8 ces methodes prennent un FStringView au lieu d'un const FString&.
 * Un litteral nu est un const char[] : il se convertissait implicitement en
 * FString, mais pas en FStringView (char vs TCHAR). D'ou des dizaines de C2664.
 *
 * La reecriture est valable en 5.7 comme en 5.8 : TEXT() produit deja le type
 * de caractere du moteur, et evite au passage la conversion ANSI -> TCHAR.
 *
 * Simulation par defaut ; `--apply` ecrit.
 *
 * Usage :
 *   node scripts/unreal-fix-json-literals.mjs <racine> [--apply]
 */

import fs from "node:fs";
import path from "node:path";

const root = process.argv[2];
const APPLY = process.argv.includes("--apply");

if (!root || !fs.existsSync(root)) {
  console.error("Usage : node scripts/unreal-fix-json-literals.mjs <racine> [--apply]");
  process.exit(1);
}

// Premier argument uniquement : c'est le seul qui porte le nom du champ.
// Le litteral peut contenir des echappements, d'ou la classe [^"\\]|\\. .
const PATTERN =
  /((?:Get|Set|Has|TryGet|Remove)[A-Za-z]*Field\s*\(\s*)"((?:[^"\\]|\\.)*)"/g;

const SOURCE_EXT = new Set([".h", ".cpp", ".hpp", ".inl"]);

const walk = (dir, acc = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
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
  let count = 0;
  const after = before.replace(PATTERN, (_match, call, field) => {
    count++;
    return `${call}TEXT("${field}")`;
  });
  if (count === 0) continue;

  touched++;
  rewritten += count;
  console.log(`${String(count).padStart(4)}  ${path.relative(root, file)}`);
  if (APPLY) fs.writeFileSync(file, after, "utf8");
}

console.log("");
console.log(
  `${APPLY ? "APPLIQUE" : "SIMULATION (ajouter --apply)"} : ${rewritten} litteral(aux) dans ${touched} fichier(s)`,
);