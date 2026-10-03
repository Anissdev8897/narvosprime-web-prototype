// ══════════════════════════════════════════════════════════════════════════════
// narvos-origine-glb.mjs — d'où vient chaque GLB, et est-il utilisable ?
//
//   node scripts/narvos-origine-glb.mjs <dossier> [--detail] [--generateur Unreal]
//
// ── POURQUOI ──────────────────────────────────────────────────────────────────
// Un GLB ne dit pas d'où il vient, sauf à un endroit : `asset.generator`, dans
// son en-tête JSON. C'est la seule marque fiable, et elle décide de ce qu'on
// peut en attendre :
//
//   « Unreal Engine … glTF Exporter »  -> ALLER-RETOUR. L'asset existait DÉJÀ
//        dans Unreal. Le réimporter recrée un doublon, et surtout l'export
//        Unreal nomme volontiers son matériau `WorldGridMaterial` — le nom du
//        matériau gris du moteur, qui se résout alors vers CELUI D'UNREAL.
//        Mesuré le 2026-09-08 : 42 matériaux sur 70 dans `_parts`.
//   « Khronos glTF Blender I/O »        -> vient de Blender.
//   « Meshy »                           -> génération IA.
//
// Le script lit **les 64 premiers kilo-octets** de chaque fichier : le chunk
// JSON d'un GLB commence à l'octet 12, et `asset.generator` y est toujours dans
// les premiers champs. Sur des dizaines de gigaoctets de modèles, lire l'en-tête
// au lieu du fichier fait la différence entre une minute et une heure.
//
// Il relève en même temps les deux défauts qui rendent un GLB inutilisable par
// Interchange, sans lever d'erreur :
//   · `KHR_texture_basisu` / `EXT_texture_webp` dans `extensionsRequired`
//   · un matériau nommé `WorldGridMaterial`
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const DETAIL = process.argv.includes("--detail");
const iGen = process.argv.indexOf("--generateur");
const FILTRE = iGen >= 0 ? String(process.argv[iGen + 1] || "").toLowerCase() : null;

const cible = args[0];
if (!cible || !fs.existsSync(cible)) {
  console.error("Usage : node scripts/narvos-origine-glb.mjs <dossier> [--detail] [--generateur Unreal]");
  process.exit(1);
}

const TETE = 65536;

function glbs(dir, out = []) {
  let entrees;
  try { entrees = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entrees) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) glbs(p, out);
    else if (/\.glb$/i.test(e.name)) out.push(p.replace(/\\/g, "/"));
  }
  return out;
}

/** Lit l'en-tête d'un GLB sans charger le fichier. */
function entete(f) {
  const fd = fs.openSync(f, "r");
  try {
    const buf = Buffer.alloc(TETE);
    const lus = fs.readSync(fd, buf, 0, TETE, 0);
    return buf.toString("latin1", 0, lus);
  } finally {
    fs.closeSync(fd);
  }
}

const fichiers = glbs(cible);
console.log(`${fichiers.length} GLB sous ${cible}`);
console.log("");

const parGen = new Map();
const ktx2 = [], webp = [], worldgrid = [];
let illisibles = 0;

for (const f of fichiers) {
  let t;
  try { t = entete(f); } catch { illisibles++; continue; }

  // `"generator":"..."` — on prend la valeur, en tolerant les espaces.
  const m = /"generator"\s*:\s*"([^"]{0,120})"/.exec(t);
  const gen = m ? m[1] : "(non declare)";
  const clef = gen.replace(/[\d.]+/g, "N").slice(0, 46);
  if (!parGen.has(clef)) parGen.set(clef, []);
  parGen.get(clef).push(f);

  if (t.includes("KHR_texture_basisu")) ktx2.push(f);
  if (t.includes("EXT_texture_webp")) webp.push(f);
  if (t.includes("WorldGridMaterial")) worldgrid.push(f);
}

console.log("=== par GENERATEUR (les chiffres remplaces par N) ===");
for (const [g, liste] of [...parGen].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${String(liste.length).padStart(6)}  ${g}`);
}

console.log("");
console.log("=== defauts qui rendent un GLB muet a l'import Unreal ===");
console.log(`  ${String(ktx2.length).padStart(6)}  KHR_texture_basisu   (Interchange n'importe AUCUNE image)`);
console.log(`  ${String(webp.length).padStart(6)}  EXT_texture_webp     (idem)`);
console.log(`  ${String(worldgrid.length).padStart(6)}  WorldGridMaterial    (le moteur resout vers SON materiau gris)`);
if (illisibles) console.log(`  ${String(illisibles).padStart(6)}  illisibles`);

if (DETAIL) {
  const bloc = (titre, liste) => {
    if (!liste.length) return;
    console.log("");
    console.log(`── ${titre} (${liste.length}) ──`);
    for (const f of liste.slice(0, 40)) console.log("  " + f.replace(cible + "/", ""));
    if (liste.length > 40) console.log(`  … et ${liste.length - 40} autres`);
  };
  bloc("KTX2", ktx2);
  bloc("WebP", webp);
  bloc("WorldGridMaterial", worldgrid);
}

if (FILTRE) {
  console.log("");
  console.log(`── GLB dont le generateur contient « ${FILTRE} » ──`);
  let n = 0;
  for (const [g, liste] of parGen) {
    if (!g.toLowerCase().includes(FILTRE)) continue;
    for (const f of liste) {
      if (n < 60) console.log("  " + f.replace(cible + "/", ""));
      n++;
    }
  }
  console.log(`  ${n} fichier(s)`);
}