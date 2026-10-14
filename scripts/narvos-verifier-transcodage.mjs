// ══════════════════════════════════════════════════════════════════════════════
// narvos-verifier-transcodage.mjs — le transcodage a-t-il abîmé quelque chose ?
//
//   node scripts/narvos-verifier-transcodage.mjs <source> <sortie> [--tout]
//
// Compare un arbre de GLB avant/après passage par `narvos-textures-vers-png.mjs`
// et vérifie, sur chaque paire :
//
//   · sommets, os, morph targets     IDENTIQUES  (le transcodage ne touche que
//                                                 les images ; tout écart est un
//                                                 modèle abîmé)
//   · `KHR_texture_basisu`           ABSENT      (sinon Interchange refuse encore)
//   · pixels des textures            VARIÉS      (min == max sur tous les canaux
//                                                 = image vide qui passerait pour
//                                                 une réussite)
//
// ── POURQUOI CE FICHIER EXISTE ────────────────────────────────────────────────
// Le 2026-09-08, 211 GLB modulaires ont été transcodés du KTX2 vers le PNG. Je
// n'avais validé l'intégrité que sur UN fichier — et une conversion validée sur
// un témoin n'est pas une conversion validée. Sur ce dépôt, une opération qui se
// déclare réussie sans preuve a déjà coûté plusieurs journées : les 611
// SkeletalMesh importés gris, les 26 animations d'AimOffset qui ont fait refuser
// 12 441 assets, les 2 clés TOML en double qui ont coûté les 64 403.
//
// Par défaut l'échantillon est RÉGULIER sur tout l'arbre — pas les 12 premiers
// fichiers, qui sont tous du même sous-dossier et ne prouvent rien du reste.
// `--tout` vérifie les 221, plus lent.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import sharp from "../WebPortal/node_modules/sharp/lib/index.js";
import { NodeIO } from "../WebPortal/node_modules/@gltf-transform/core/dist/index.js";
import { ALL_EXTENSIONS } from "../WebPortal/node_modules/@gltf-transform/extensions/dist/index.js";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const TOUT = process.argv.includes("--tout");
const [SRC, DST] = args;

if (!SRC || !DST) {
  console.error("Usage : node scripts/narvos-verifier-transcodage.mjs <source> <sortie> [--tout]");
  process.exit(1);
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
try {
  const draco = await import("../WebPortal/node_modules/draco3dgltf/draco3dgltf.js");
  const d = draco.default ?? draco;
  io.registerDependencies({
    "draco3d.decoder": await d.createDecoderModule(),
    "draco3d.encoder": await d.createEncoderModule(),
  });
} catch {
  console.error("ATTENTION draco3dgltf indisponible : les GLB compresses seront illisibles.");
}

function glbs(dir, base, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) glbs(p, base, out);
    else if (/\.glb$/i.test(e.name)) out.push(path.relative(base, p).split(path.sep).join("/"));
  }
  return out;
}

const tous = glbs(SRC, SRC);
const pas = Math.max(1, Math.floor(tous.length / 14));
const ech = TOUT ? tous : tous.filter((_, i) => i % pas === 0);

const sommets = (r) =>
  r.listMeshes().flatMap((m) => m.listPrimitives())
    .reduce((s, p) => s + (p.getAttribute("POSITION")?.getCount() || 0), 0);
const os = (r) => r.listSkins().reduce((s, k) => s + k.listJoints().length, 0);
const morphs = (r) =>
  r.listMeshes().flatMap((m) => m.listPrimitives()).reduce((s, p) => s + p.listTargets().length, 0);

console.log(`${tous.length} GLB en source · ${ech.length} verifie(s)${TOUT ? " (--tout)" : " (echantillon regulier)"}`);
console.log("");
console.log("FICHIER".padEnd(34) + "SOMMETS".padStart(8) + "OS".padStart(6) + "MORPH".padStart(7) +
            "TEX".padStart(5) + "  KTX2" + "  PIXELS");
console.log("-".repeat(80));

let defauts = 0, absents = 0;

for (const rel of ech) {
  const pd = path.join(DST, rel);
  if (!fs.existsSync(pd)) { console.log(rel.padEnd(34) + "  ABSENT DE LA SORTIE"); absents++; continue; }

  let a, b;
  try { a = await io.read(path.join(SRC, rel)); b = await io.read(pd); }
  catch (e) { console.log(rel.padEnd(34) + "  ILLISIBLE : " + e.message.slice(0, 40)); defauts++; continue; }

  const ra = a.getRoot(), rb = b.getRoot();
  const okS = sommets(ra) === sommets(rb);
  const okO = os(ra) === os(rb);
  const okM = morphs(ra) === morphs(rb);
  const ktx = rb.listExtensionsUsed().some((e) => e.extensionName === "KHR_texture_basisu");

  const tex = rb.listTextures();
  let uniformes = 0, verifiees = 0;
  for (const t of tex.slice(0, 3)) {
    if (t.getMimeType() !== "image/png") continue;
    try {
      const st = await sharp(Buffer.from(t.getImage())).stats();
      verifiees++;
      if (st.channels.every((c) => c.min === c.max)) uniformes++;
    } catch { uniformes++; }
  }

  const bon = okS && okO && okM && !ktx && uniformes === 0;
  if (!bon) defauts++;

  const court = (path.dirname(rel) + "/" + path.basename(rel)).slice(-33);
  console.log(
    court.padEnd(34) +
    (String(sommets(rb)) + (okS ? " " : "!")).padStart(8) +
    (String(os(rb)) + (okO ? " " : "!")).padStart(6) +
    (String(morphs(rb)) + (okM ? " " : "!")).padStart(7) +
    String(tex.length).padStart(5) +
    (ktx ? "   OUI" : "   non") +
    "  " + (uniformes ? `${uniformes} UNIFORME(S)` : verifiees ? `${verifiees} variees` : "aucune PNG")
  );
}

console.log("");
if (defauts === 0 && absents === 0) {
  console.log(`Conforme : geometrie, squelette et morphs intacts ; KTX2 retire ; pixels reels.`);
} else {
  console.error(`${defauts} en defaut, ${absents} absent(s). Le « ! » marque la colonne fautive.`);
  process.exitCode = 1;
}