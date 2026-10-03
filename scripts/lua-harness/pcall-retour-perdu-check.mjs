import { RACINE_DEPOT } from "./_racine.mjs";
// ══════════════════════════════════════════════════════════════════════════════
// pcall-retour-perdu-check.mjs — un pcall dont on ne lit que le booléen, autour
// d'une fonction qui RENVOIE quelque chose.
//
//   node scripts/lua-harness/pcall-retour-perdu-check.mjs
//
// ── LE DÉFAUT (2026-09-14) ────────────────────────────────────────────────────
//   local ok = pcall(function()
//       return Narvos.Roster.EnregistrerInventaire(...)   -- rend false, raison
//   end)
//   if (not ok) then Console.Warn("...") end
//
// `ok` dit « pas d'exception ». Le refus de la fonction (false, « Base
// indisponible ») est dans la valeur RENDUE, jetée par la capture à une seule
// variable. Le sac, les compagnons et les métiers n'ont JAMAIS été écrits en base,
// sans une ligne au journal.
//
// ── LA FORME, PAS LE LIEU ─────────────────────────────────────────────────────
// Refusé : `local <un seul nom> = pcall(function()` dont le corps, au premier
// niveau, contient `return <expression>`. Une valeur rendue et jamais lue est le
// défaut lui-même, quelle que soit la fonction appelée.
// Accepté : `local ok, resultat = pcall(...)` (la valeur est capturée), et un
// corps sans `return` (on ne protège qu'un effet).
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const RACINE = RACINE_DEPOT + "/WebPortal/Server/nanos_world/packages";

/** Rend les violations d'un texte Lua : [{ ligne, texte }]. */
function Examiner(source) {
  const lignes = source.split(/\r?\n/);
  const violations = [];
  for (let i = 0; i < lignes.length; i++) {
    const m = lignes[i].match(/^(\s*)local\s+([A-Za-z_]\w*)\s*=\s*pcall\(function\(\)\s*(.*)$/);
    if (!m) continue;
    const indent = m[1].length;
    const reste = m[3];
    // Forme sur une ligne : `local ok = pcall(function() return x end)`.
    if (/^return\s+\S/.test(reste.trim())) {
      violations.push({ ligne: i + 1, texte: lignes[i].trim() });
      continue;
    }
    for (let j = i + 1; j < lignes.length; j++) {
      const l = lignes[j];
      const retrait = l.match(/^(\s*)/)[1].length;
      if (/^\s*end\)/.test(l) && retrait === indent) break;
      if (retrait === indent + 4 && /^\s*return\s+\S/.test(l)) {
        violations.push({ ligne: i + 1, texte: lignes[i].trim() + "  …  " + l.trim() });
        break;
      }
    }
  }
  return violations;
}

// ── Le contrôle se prouve d'abord sur la forme du défaut ─────────────────────
const DEFAUT = [
  "local function EnregistrerSac(player)",
  "    local ok = pcall(function()",
  "        return Narvos.Roster.EnregistrerInventaire(1, \"x\", {})",
  "    end)",
  "    return ok",
  "end",
].join("\n");
const CORRIGE = DEFAUT.replace("local ok = pcall", "local ok, enregistre, raison = pcall");
const EFFET = [
  "    local ok = pcall(function()",
  "        cible:ApplyDamage(1)",
  "    end)",
].join("\n");
let echecs = 0;
if (Examiner(DEFAUT).length !== 1) { console.log("  ECHEC  auto-test : la forme du defaut n'est pas refusee"); echecs++; }
if (Examiner(CORRIGE).length !== 0) { console.log("  ECHEC  auto-test : la forme corrigee est refusee a tort"); echecs++; }
if (Examiner(EFFET).length !== 0) { console.log("  ECHEC  auto-test : un pcall d'effet est refuse a tort"); echecs++; }
if (Examiner("local ok = pcall(function() return f() end)").length !== 1) { console.log("  ECHEC  auto-test : forme sur une ligne"); echecs++; }

// ── Le dépôt ──────────────────────────────────────────────────────────────────
function* FichiersLua(dossier) {
  for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
    const p = path.join(dossier, e.name);
    if (e.isDirectory()) {
      if (e.name === "Catalogs" || e.name.startsWith(".")) continue;
      yield* FichiersLua(p);
    } else if (e.name.endsWith(".lua")) yield p;
  }
}

let examines = 0;
for (const f of FichiersLua(RACINE)) {
  examines++;
  for (const v of Examiner(fs.readFileSync(f, "utf8"))) {
    console.log(`  REFUS  ${path.relative(RACINE, f)}:${v.ligne}  ${v.texte}`);
    echecs++;
  }
}

console.log("");
if (echecs > 0) {
  console.error(`${echecs} pcall(s) jettent la valeur rendue — lire \`local ok, resultat, raison = pcall(...)\`.`);
  process.exitCode = 1;
} else {
  console.log(`${examines} fichier(s) Lua : aucun pcall ne jette une valeur rendue (auto-test vert).`);
}