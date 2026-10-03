// ══════════════════════════════════════════════════════════════════════════════
// narvos-textures-vers-png.mjs — rend un GLB lisible par Interchange.
//
//   node scripts/narvos-textures-vers-png.mjs <dossier|fichier> <sortie> [--apply]
//
// Convertit les textures WebP en PNG et retire les déclarations d'extension qui
// vont avec. Ne touche à RIEN d'autre : ni géométrie, ni squelette, ni matériaux.
//
// ── LE DÉFAUT QUE ÇA CORRIGE ──────────────────────────────────────────────────
// Une extension listée dans `extensionsRequired` engage le lecteur : il DOIT la
// comprendre ou refuser le document entier. C'est la spec glTF, pas un caprice
// d'Unreal. Interchange ne lit ni `KHR_texture_basisu` (KTX2) ni
// `EXT_texture_webp`, et répond alors :
//
//     Not all required extensions are supported.
//     (Unsupported extensions: EXT_texture_webp)
//     There was no data to import in the provided source data.
//
// Le second message accuse le fichier d'être vide. Il ne l'est pas : il n'a
// jamais été ouvert. Mesuré le 2026-09-03 : 12 monstres sur 15 perdus ainsi.
//
// ── POURQUOI CONVERTIR ET NON DÉGRAISSER ──────────────────────────────────────
// `narvos-degraisser-anim.mjs` SUPPRIME les textures — c'est correct pour une
// animation, qui n'en a pas besoin. Sur un personnage, ça donne un modèle gris.
// Ici on transcode : le pixel survit, seul le conteneur change.
//
// ── LE KTX2 EST DÉSORMAIS COUVERT (2026-09-08) ────────────────────────────────
// Ce fichier disait « le KTX2 demande un décodeur Basis que `sharp` n'a pas ».
// C'était vrai, et ça ne l'est plus : `ktx.exe` v5.0 est compilé dans le dépôt,
// sous `WebPortal/tools/KTX-Software-main/.../build/Release/`. Son sous-commande
// `extract --transcode rgba8` rend un PNG directement.
//
// Mesuré sur `public/models/personnages/_parts` : **221 GLB, 100 % KTX2**, et
// c'est le pack MODULAIRE. Coté Unreal, ses 40 SkeletalMesh portent 0 Texture2D
// et 14 matériaux gris — parce qu'Interchange refuse `KHR_texture_basisu` et
// n'importe donc aucune image, sans lever d'erreur.
//
// ⚠ `_body` (7 GLB : `base.glb`, `base_morphable.glb`, `mpfb_*`) n'a AUCUNE
// texture, et ce n'est pas un défaut : ce sont les corps MakeHuman, qui
// reçoivent leur peau au runtime. Les transcoder ne donnerait rien — il n'y a
// rien à transcoder. Ne pas les compter comme des échecs.
//
// Si `ktx.exe` manque, le comportement d'avant revient : les fichiers sont
// NOMMÉS plutôt qu'avalés en silence.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "../WebPortal/node_modules/sharp/lib/index.js";
import { NodeIO } from "../WebPortal/node_modules/@gltf-transform/core/dist/index.modern.js";
import { ALL_EXTENSIONS } from "../WebPortal/node_modules/@gltf-transform/extensions/dist/index.modern.js";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const APPLY = process.argv.includes("--apply");
const SEULEMENT_DEFAUTS = process.argv.includes("--seulement-defauts");

const cible = args[0];
const sortie = args[1];

if (!cible || !sortie) {
  console.error("Usage : node scripts/narvos-textures-vers-png.mjs <dossier|fichier> <sortie> [--apply] [--seulement-defauts]");
  process.exit(1);
}
if (!fs.existsSync(cible)) {
  console.error(`Introuvable : ${cible}`);
  process.exit(1);
}

/** Extensions de texture qu'Interchange ne sait pas lire. */
const ILLISIBLES = new Set(["EXT_texture_webp", "KHR_texture_basisu", "EXT_texture_avif"]);

// ── Noms de matériau réservés par le moteur ──────────────────────────────────
//
// ⚠ UN MATÉRIAU DE PROJET QUI PORTE LE NOM D'UN MATÉRIAU MOTEUR SE RÉSOUT VERS
// CELUI DU MOTEUR. `WorldGridMaterial` est le matériau GRIS par défaut d'Unreal
// (`/Engine/EngineMaterials/WorldGridMaterial`) : un asset importé sous ce nom
// affiche le gris du moteur, textures présentes ou pas.
//
// Mesuré le 2026-09-08 sur les 10 323 GLB de `public/` : **2 598 en portent un**,
// soit 25 % du parc. Et la cause est identifiée — 8 516 de ces GLB ont pour
// générateur « Unreal Engine … glTF Exporter » : l'exportateur nomme le matériau
// d'après le défaut du moteur quand la source EST le défaut du moteur. Les
// allers-retours fabriquent le problème.
//
// Le renommage se fait ICI, dans le GLB, AVANT l'import. Le corriger après coup
// dans Unreal marche aussi (`adk-renommer-worldgrid-tout.py`, 68 assets), mais
// il faut alors le refaire à chaque réimport.
const RESERVES = new Set(["WorldGridMaterial", "DefaultMaterial", "WorldGridMaterial_Inst"]);

/**
 * Nom de remplacement, dérivé du CHEMIN du fichier.
 *
 * ⚠ Il doit être UNIQUE entre packs. `M_Narvos` partout remplacerait une
 * collision moteur par une collision entre nos propres assets — et celle-là
 * serait plus difficile à voir, puisque les deux seraient à nous.
 */
function nomDeRemplacement(fichier, racine, index) {
  const rel = path.relative(racine, fichier).replace(/\\/g, "/");
  const base = rel
    .replace(/\.(glb|gltf)$/i, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(-52);
  return `M_${base}${index > 0 ? "_" + index : ""}`;
}

/** Types MIME que `sharp` sait lire tout seul. */
const TRANSCODABLES = new Set(["image/webp", "image/avif"]);

// ── Le décodeur KTX2 ─────────────────────────────────────────────────────────
//
// ⚠ CHEMIN EN DUR, ET DÉLIBÉRÉMENT. `ktx.exe` n'est ni sur le PATH ni dans
// node_modules : c'est un binaire compilé une fois dans `tools/`. Le chercher
// dynamiquement donnerait l'illusion de portabilité sans en apporter.
const KTX = path.resolve(
  import.meta.dirname,
  "../WebPortal/tools/KTX-Software-main/KTX-Software-main/build/Release/ktx.exe"
);
const KTX_PRESENT = fs.existsSync(KTX);

/** Dossier de travail, créé une fois et nettoyé à la fin. */
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "narvos-ktx2-"));
let compteurTmp = 0;

/**
 * KTX2 -> PNG, via `ktx extract`.
 *
 * ⚠ `--transcode rgba8` n'est PAS optionnel. Ces KTX2 portent
 * `vkFormat: VK_FORMAT_UNDEFINED` — ils sont supercompressés (Basis). `extract`
 * sait alors sortir du RAW ou du block-compressed, mais pas du PNG. Le
 * transcodage vers RGBA8 non compressé est ce qui rend le PNG possible.
 *
 * ⚠ On repasse par `sharp` derrière. Deux raisons : le PNG de `ktx` fait
 * 287 ko pour un 1024² là où sharp le ramène plus bas, et surtout un aller-retour
 * par sharp VALIDE l'image — un PNG que sharp refuse ne doit pas entrer dans
 * un GLB qu'on croira réparé.
 */
async function ktx2VersPng(octets) {
  const n = compteurTmp++;
  const src = path.join(TMP, `t${n}.ktx2`);
  const dst = path.join(TMP, `t${n}.png`);
  fs.writeFileSync(src, Buffer.from(octets));
  try {
    execFileSync(KTX, ["extract", "--transcode", "rgba8", src, dst], { stdio: "pipe" });
    return await sharp(fs.readFileSync(dst)).png({ compressionLevel: 9 }).toBuffer();
  } finally {
    fs.rmSync(src, { force: true });
    fs.rmSync(dst, { force: true });
  }
}

const fichiers = [];
const collecter = (p) => {
  const st = fs.statSync(p);
  if (st.isFile()) {
    if (/\.(glb|gltf)$/i.test(p)) fichiers.push(p);
    return;
  }
  for (const e of fs.readdirSync(p, { withFileTypes: true })) collecter(path.join(p, e.name));
};
collecter(cible);

// ⚠ LE DÉCODEUR DRACO EST OBLIGATOIRE ICI. Ces GLB sont des exports Meshy, et
// la plupart sont compressés en Draco. Sans la dépendance enregistrée,
// gltf-transform échoue sur `DT_FLOAT32` — un message qui ne parle ni de Draco
// ni de compression, et qu'on prend d'abord pour un fichier corrompu.
//
// `narvos-renommer-os.mjs` s'en passe parce qu'il n'a jamais rencontré que des
// packs non compressés ; ça ne veut pas dire qu'il n'en aura pas besoin un jour.
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

try {
  const draco = await import("../WebPortal/node_modules/draco3dgltf/draco3dgltf.js");
  const d = draco.default ?? draco;
  io.registerDependencies({
    "draco3d.decoder": await d.createDecoderModule(),
    "draco3d.encoder": await d.createEncoderModule(),
  });
} catch (err) {
  console.error("ATTENTION draco3dgltf indisponible : les GLB compresses seront illisibles.");
  console.error("  " + err.message.split("\n")[0]);
}

const racine = fs.statSync(cible).isDirectory() ? cible : path.dirname(cible);

console.log(APPLY ? "=== APPLIQUE ===" : "=== SIMULATION (ajouter --apply) ===");

let convertis = 0;
let intacts = 0;
const bloques = [];

for (const f of fichiers) {
  let doc;
  try {
    doc = await io.read(f);
  } catch (err) {
    console.log(`  ILLISIBLE ${path.basename(f)} — ${err.message.split("\n")[0]}`);
    continue;
  }

  const root = doc.getRoot();

  // A-t-on affaire à un fichier concerné ? On regarde les extensions déclarées,
  // pas seulement les MIME : une extension requise sans texture correspondante
  // suffit à faire refuser le document.
  const declarees = root.listExtensionsUsed().map((e) => e.extensionName);
  const genantes = declarees.filter((n) => ILLISIBLES.has(n));

  let images = 0;
  let irrecuperables = 0;

  for (const texture of root.listTextures()) {
    const mime = texture.getMimeType();
    const parKtx = mime === "image/ktx2";

    if (!TRANSCODABLES.has(mime) && !parKtx) continue;
    if (parKtx && !KTX_PRESENT) { irrecuperables++; continue; }

    const source = texture.getImage();
    if (!source) continue;

    try {
      const png = parKtx
        ? await ktx2VersPng(source)
        : await sharp(Buffer.from(source)).png().toBuffer();
      texture.setImage(new Uint8Array(png));
      texture.setMimeType("image/png");
      const uri = texture.getURI();
      if (uri) texture.setURI(uri.replace(/\.(webp|avif|ktx2)$/i, ".png"));
      images++;
    } catch (err) {
      irrecuperables++;
    }
  }

  // ── Les noms de matériau réservés ─────────────────────────────────────────
  let renommes = 0;
  {
    let i = 0;
    for (const mat of root.listMaterials()) {
      if (!RESERVES.has(mat.getName() || "")) continue;
      mat.setName(nomDeRemplacement(f, racine, i++));
      renommes++;
    }
  }

  if (genantes.length === 0 && images === 0 && renommes === 0) {
    // ⚠ ON COPIE, ON NE SAUTE PAS.
    //
    // La sortie est un ARBRE SÉPARÉ, destiné à remplacer la source au réimport.
    // Sauter un fichier sans rien à convertir laisse un trou : mesuré le
    // 2026-09-08 sur `_parts`, 211 fichiers écrits sur 221, et les 10 manquants
    // étaient de vraies pièces modulaires — 6 corps MakeHuman et 4 vêtements
    // (`nuc_bulletproof/torso`, `nuc_jeans/legs`…), tous à ZÉRO texture donc
    // légitimement intouchés, mais tout aussi légitimement attendus par
    // l'import. Un dossier de sortie incomplet ne se voit qu'au moment où il
    // manque un pantalon en jeu.
    intacts++;
    // ⚠ DEUX USAGES, DEUX COMPORTEMENTS, et confondre les deux coute cher.
    //
    // Par DEFAUT on copie : la sortie est alors un MIROIR complet, destine a
    // remplacer la source au reimport. Sauter un fichier sans rien a convertir
    // laisserait un trou — mesure le 2026-09-08 sur `_parts`, 211 ecrits sur
    // 221, et les 10 manquants etaient de vraies pieces modulaires.
    //
    // Avec `--seulement-defauts` on ne copie PAS : la sortie ne contient que
    // les fichiers REPARES. C'est le mode a employer sur un gisement entier —
    // `public/` fait 265 Go, en miroiter la totalite pour corriger 3 422
    // fichiers serait absurde.
    if (APPLY && !SEULEMENT_DEFAUTS) {
      const dest = path.join(sortie, path.relative(racine, f));
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(f, dest);
    }
    continue;
  }

  if (irrecuperables > 0) {
    bloques.push({ fichier: f, images: irrecuperables });
    continue;
  }

  // ⚠ RETIRER LA DÉCLARATION, PAS SEULEMENT LES PIXELS. gltf-transform garde
  // l'objet `Extension` enregistré tant qu'on ne le `dispose()` pas : le
  // document ressortirait avec `extensionsRequired: ["EXT_texture_webp"]` alors
  // que plus aucune texture ne l'emploie, et Interchange le refuserait encore.
  // Ce défaut exact avait rendu un premier dégraissage totalement inopérant.
  for (const ext of root.listExtensionsUsed()) {
    if (ILLISIBLES.has(ext.extensionName)) ext.dispose();
  }

  const destination = path.join(sortie, path.relative(racine, f));
  if (APPLY) {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    await io.write(destination, doc);
  }

  convertis++;
  if (convertis <= 8) {
    console.log(`  CONVERTI  ${path.basename(f)}  (${images} texture(s), ${renommes} materiau(x) renomme(s), ${genantes.join(", ") || "aucune extension"})`);
  }
}

console.log("");
console.log(`  ${convertis} converti(s), ${intacts} ${SEULEMENT_DEFAUTS ? "sans objet (NON copie(s))" : "copie(s) tel(s) quel(s)"}, ${bloques.length} bloque(s)`);

if (bloques.length > 0) {
  console.log("");
  console.log("  BLOQUES :");
  for (const b of bloques) console.log(`      ${path.basename(b.fichier)}  (${b.images} image(s))`);
  if (!KTX_PRESENT) {
    console.log("");
    console.log("  CAUSE : ktx.exe introuvable — le KTX2 ne peut pas etre decode.");
    console.log(`    attendu : ${KTX}`);
    console.log("    il se compile depuis WebPortal/tools/KTX-Software-main/ (CMake).");
  }
}

fs.rmSync(TMP, { recursive: true, force: true });

if (APPLY && convertis > 0) {
  console.log("");
  console.log(`  ecrit sous : ${sortie}`);
} else if (!APPLY) {
  console.log("");
  console.log("Rien ecrit.");
}