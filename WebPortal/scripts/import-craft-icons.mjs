// ═════════════════════════════════════════════════════════════════════════════
// scripts/import-craft-icons.mjs — Importe les icones de craft du cours Survival.
//
// POURQUOI WEBP ET PAS KTX2
// Ces icones sont de UI : affichees en <img> / canvas 2D, jamais echantillonnees
// par le GPU. KTX2 ne reduirait aucune VRAM ici et rendrait le fichier illisible
// par une balise <img>. WebP avec alpha est le format juste.
//
// POURQUOI public/textures/icons/ ET PAS public/textures/objet/
// generate-assets-manifest.cjs ne scanne que 7 categories nommees (personnage,
// monstres, objet, spells, sprites, ui, decor). Un dossier « icons » reste donc
// hors manifest — pas de 432 entrees que personne ne consomme — tout en etant
// vu par build-texture-index.mjs, donc navigable dans le TextureBrowser.
//
// Usage : node scripts/import-craft-icons.mjs [--write]
// ═════════════════════════════════════════════════════════════════════════════
import { readdirSync, statSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";

const SOURCE = "export/model/SurvivalGameCourse/Content/CraftResourcesIcons/Textures";
const CIBLE = "public/textures/icons/craft";
const ECRIRE = process.argv.includes("--write");

if (!existsSync(SOURCE)) {
  console.error("[icons] source absente : " + SOURCE);
  process.exit(1);
}

const fichiers = readdirSync(SOURCE).filter((f) => /\.png$/i.test(f));
console.log("[icons] " + fichiers.length + " PNG trouves");

// Deduplication par contenu : le pack livre des variantes « _b » qui peuvent
// etre des copies exactes. On compare les octets, pas les noms.
const parHash = new Map();
let octetsAvant = 0;
for (const f of fichiers) {
  const p = join(SOURCE, f);
  const buf = readFileSync(p);
  octetsAvant += buf.length;
  const h = createHash("sha1").update(buf).digest("hex");
  if (!parHash.has(h)) parHash.set(h, []);
  parHash.get(h).push(f);
}

const uniques = [...parHash.values()];
const doublons = fichiers.length - uniques.length;
console.log("[icons] " + uniques.length + " uniques, " + doublons + " doublons exacts");

if (!ECRIRE) {
  console.log("[icons] avant : " + (octetsAvant / 1048576).toFixed(1) + " Mo");
  const ex = uniques.filter((g) => g.length > 1).slice(0, 5);
  for (const g of ex) console.log("   doublon : " + g.join("  =  "));
  console.log("[icons] dry-run. --write pour appliquer");
  process.exit(0);
}

mkdirSync(CIBLE, { recursive: true });

let ecrits = 0;
let octetsApres = 0;
const alias = {};

for (const groupe of uniques) {
  // Nom retenu : le plus court du groupe (Tex_bone_01 plutot que Tex_bone_01_b),
  // pour que la clef stable soit le nom de base et non la variante.
  const canonique = groupe.slice().sort((a, b) => a.length - b.length || a.localeCompare(b))[0];
  const nom = basename(canonique, extname(canonique)).toLowerCase() + ".webp";
  const dest = join(CIBLE, nom);

  const out = await sharp(join(SOURCE, canonique))
    .webp({ quality: 90, alphaQuality: 100, effort: 6 })
    .toBuffer();
  writeFileSync(dest, out);
  octetsApres += out.length;
  ecrits++;

  for (const membre of groupe) {
    const clef = basename(membre, extname(membre)).toLowerCase();
    if (clef !== basename(nom, ".webp")) alias[clef] = basename(nom, ".webp");
  }
}

writeFileSync(join(CIBLE, "_alias.json"), JSON.stringify(alias, null, 2));

console.log("[icons] ecrits            : " + ecrits + " webp");
console.log("[icons] alias de doublons : " + Object.keys(alias).length);
console.log("[icons] avant : " + (octetsAvant / 1048576).toFixed(1) + " Mo");
console.log("[icons] apres : " + (octetsApres / 1048576).toFixed(1) + " Mo   ("
  + (100 - (octetsApres / octetsAvant) * 100).toFixed(1) + " % de gain)");
