#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════
// narvos-vignettes-to-lua.mjs — les VIGNETTES 3D que le client nanos livre déjà.
//
//   node scripts/narvos-vignettes-to-lua.mjs            # constat
//   node scripts/narvos-vignettes-to-lua.mjs --apply    # écrit Catalogs/Vignettes.lua
//
// ── POURQUOI (2026-09-15) ─────────────────────────────────────────────────────
// Demande de Hanibes : « ne mettez pas des icônes qui ne ressemblent à rien, faites
// une impression 3D en 2D pour chaque arme ou consommable dans l'inventaire ».
// Le client nanos embarque 755 rendus 3D de ses assets de base
// (NanosWorld/Content/NanosWorld/Thumbnails/*.jpg), adressables depuis un WebUI par
// `assets://nanos-world/Thumbnails/<clé>.jpg` (docs : glossary/basic-types.mdx,
// menu de spawn du sandbox). Toutes nos armes à feu sont des assets de base.
//
// ── LA VIGNETTE PORTE LE NOM DE LA CLÉ, PAS DU FICHIER ────────────────────────
// Mesuré sur les meshes dont la clé du manifeste diffère du nom de fichier :
// 6 vignettes au nom de la CLÉ (`SM_Grenade_G67`), 1 au nom du fichier. On publie
// donc les noms tels quels, et le contrôle croise avec les clés du manifeste.
//
// Les objets de NOTRE pack (meshes `narvos::SM_*`) n'ont pas de vignette livrée :
// le client les rend lui-même (Client/VignettesObjets.lua, SceneCapture).
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const RACINE = "E:/narvosprime-web-prototype";
const DOSSIER = process.env.NANOS_VIGNETTES
  || "D:/steam/steamapps/common/nanos-world-playtest/NanosWorld/Content/NanosWorld/Thumbnails";
const MANIFESTE = `${RACINE}/WebPortal/Server/nanos_world/game-mod/nanos-world-server-main/nanos-world-server-main/DefaultAssetPack.toml`;
const CIBLE = `${RACINE}/WebPortal/Server/nanos_world/packages/narvos/Shared/Catalogs/Vignettes.lua`;
const APPLY = process.argv.includes("--apply");

if (!fs.existsSync(DOSSIER)) {
  console.error(`ARRET : vignettes du client introuvables : ${DOSSIER}`);
  console.error("  (définir NANOS_VIGNETTES si l'installation Steam est ailleurs)");
  process.exit(1);
}

const noms = fs.readdirSync(DOSSIER)
  .filter((f) => f.toLowerCase().endsWith(".jpg"))
  .map((f) => f.slice(0, -4))
  .filter((n) => /^[A-Za-z0-9_]+$/.test(n))
  .sort();

// Croisement avec les clés du manifeste : une vignette sans clé n'est pas fausse
// (le manifeste recopié date du 13/08), mais on le DIT.
const cles = new Set();
if (fs.existsSync(MANIFESTE)) {
  for (const ligne of fs.readFileSync(MANIFESTE, "utf8").split(/\r?\n/)) {
    const m = ligne.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(?:"|\{)/);
    if (m) cles.add(m[1]);
  }
}
const horsManifeste = noms.filter((n) => !cles.has(n));

const lignes = [
  "-- ══════════════════════════════════════════════════════════════════════════════",
  "-- Vignettes.lua — les rendus 3D des assets de BASE, livrés avec le client nanos.",
  "--",
  "-- FICHIER GENERE par scripts/narvos-vignettes-to-lua.mjs depuis",
  "-- NanosWorld/Content/NanosWorld/Thumbnails du client. Ne pas éditer à la main.",
  `-- ${noms.length} vignette(s), ${noms.length - horsManifeste.length} au nom d'une clé du manifeste.`,
  "-- ══════════════════════════════════════════════════════════════════════════════",
  "",
  "local Vignettes = {}",
  "",
  "--- Préfixe d'adresse d'une vignette du pack de base, lisible par un WebUI.",
  'Vignettes.RACINE_BASE = "assets://nanos-world/Thumbnails/"',
  "",
  "--- Clés d'assets de base qui ont une vignette.",
  "Vignettes.BASE = {",
  ...noms.map((n) => `    ${n} = true,`),
  "}",
  "",
  "--- L'adresse de la vignette d'un mesh (\"pack::Clé\"), ou nil s'il n'en a pas.",
  "---@param mesh any",
  "---@return string|nil",
  "function Vignettes.PourMesh(mesh)",
  "    if (type(mesh) ~= \"string\") then return nil end",
  "    local pack, cle = mesh:match(\"^([%w%-]+)::([%w_]+)$\")",
  "    if (pack == \"nanos-world\" and Vignettes.BASE[cle]) then",
  "        return Vignettes.RACINE_BASE .. cle .. \".jpg\"",
  "    end",
  "    return nil",
  "end",
  "",
  "return Vignettes",
  "",
];

console.log(APPLY ? "=== APPLIQUE ===" : "=== SIMULATION (ajouter --apply) ===");
console.log(`  vignettes : ${noms.length} (${horsManifeste.length} hors manifeste recopié)`);
if (APPLY) {
  fs.writeFileSync(CIBLE, lignes.join("\n"), "utf8");
  console.log(`  écrit : ${path.relative(RACINE, CIBLE)}`);
} else {
  console.log("  Rien écrit.");
}