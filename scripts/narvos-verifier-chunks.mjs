// ══════════════════════════════════════════════════════════════════════════════
// narvos-verifier-chunks.mjs — les chunks couvrent-ils toute la map ?
//
//   node scripts/narvos-verifier-chunks.mjs <source.glb|.gltf> <dossier-chunks>
//
// ── POURQUOI CE CONTRÔLE EXISTE ───────────────────────────────────────────────
// `puzzle-chunks.mjs` avertit « X % des triangles perdus dans le pipeline », et
// cet avertissement est TROMPEUR : il compare le total de la map ENTIÈRE au
// contenu d'UN chunk. Sur Tower il annonçait 39 % de perte alors que la question
// n'avait pas été posée correctement.
//
// La vraie question tient en deux mesures :
//   1. la somme des triangles des chunks vaut-elle celle de la source ?
//      (elle peut la DÉPASSER : `join()` matérialise les instances, donc un mesh
//      référencé cinquante fois compte cinquante fois après fusion)
//   2. l'union des boîtes englobantes couvre-t-elle celle de la source ?
//      C'est ce qui attrape un pan de map absent — une perte de triangles
//      répartie uniformément ne se verrait pas, un trou dans l'espace si.
//
// Un ratio inférieur à 1 sans trou spatial signale une simplification ; un trou
// spatial signale une perte réelle, et il faut alors revoir le découpage.
// ══════════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import { NodeIO } from "../WebPortal/node_modules/@gltf-transform/core/dist/index.js";
import { ALL_EXTENSIONS } from "../WebPortal/node_modules/@gltf-transform/extensions/dist/index.js";

const source = process.argv[2];
const dossier = process.argv[3];

if (!source || !dossier) {
  console.error("Usage : node scripts/narvos-verifier-chunks.mjs <source> <dossier-chunks>");
  process.exit(1);
}
for (const p of [source, dossier]) {
  if (!fs.existsSync(p)) { console.error(`Introuvable : ${p}`); process.exit(1); }
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

// Draco est OBLIGATOIRE ici : les chunks sortent compressés, et sans le décodeur
// gltf-transform échoue sur `DT_FLOAT32` — un message qui ne parle ni de Draco
// ni de compression.
try {
  const draco = await import("../WebPortal/node_modules/draco3dgltf/draco3dgltf.js");
  const d = draco.default ?? draco;
  io.registerDependencies({
    "draco3d.decoder": await d.createDecoderModule(),
    "draco3d.encoder": await d.createEncoderModule(),
  });
} catch (err) {
  console.error("ATTENTION draco3dgltf indisponible — les chunks seront illisibles.");
  console.error("  " + err.message.split("\n")[0]);
}

/** Multiplie un point par une matrice 4x4 en colonne-major (convention glTF). */
function transformer(m, p, out) {
  out[0] = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12];
  out[1] = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
  out[2] = m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14];
  return out;
}

function multiplier(a, b) {
  const r = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) {
    for (let l = 0; l < 4; l++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + l] * b[c * 4 + k];
      r[c * 4 + l] = s;
    }
  }
  return r;
}

const IDENTITE = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** Triangles et boîte englobante EN ESPACE MONDE.
 *
 *  ⚠ LA TRAVERSÉE DU GRAPHE EST OBLIGATOIRE, ET C'EST LE PIÈGE DE CE CONTRÔLE.
 *  Les chunks sortent de `flatten()` : leurs transforms sont CUITES dans les
 *  sommets, donc leurs accesseurs sont déjà en monde. La map source, elle, garde
 *  sa hiérarchie et ses accesseurs sont en LOCAL.
 *
 *  Les comparer sans appliquer les matrices donnait une source de
 *  91 538 x 46 640 x 52 709 face à des chunks de 638 538 x 2 523 280 — et le
 *  contrôle concluait « couverture complète » quoi qu'il arrive. Un instrument
 *  qui ne signale jamais rien est pire que pas d'instrument. */
async function mesurer(chemin) {
  const doc = await io.read(chemin);
  let tris = 0;
  const bb = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };

  const v = [0, 0, 0];
  const w = [0, 0, 0];

  const visiter = (noeud, parent) => {
    const monde = multiplier(parent, noeud.getMatrix() ?? IDENTITE);
    const mesh = noeud.getMesh();

    if (mesh) {
      for (const prim of mesh.listPrimitives()) {
        const idx = prim.getIndices();
        const pos = prim.getAttribute("POSITION");
        if (!pos) continue;
        tris += idx ? idx.getCount() / 3 : pos.getCount() / 3;

        for (let k = 0; k < pos.getCount(); k++) {
          pos.getElement(k, v);
          transformer(monde, v, w);
          for (let i = 0; i < 3; i++) {
            if (w[i] < bb.min[i]) bb.min[i] = w[i];
            if (w[i] > bb.max[i]) bb.max[i] = w[i];
          }
        }
      }
    }

    for (const enfant of noeud.listChildren()) visiter(enfant, monde);
  };

  for (const scene of doc.getRoot().listScenes()) {
    for (const racine of scene.listChildren()) visiter(racine, IDENTITE);
  }
  return { tris: Math.round(tris), bb };
}

const fmt = (n) => n.toLocaleString("fr-FR").replace(/ | /g, " ");
const dim = (bb) => bb.min.map((v, i) => (bb.max[i] - v)).map((v) => Math.round(v));

console.log(`source : ${path.basename(source)}`);
const src = await mesurer(source);
console.log(`  triangles : ${fmt(src.tris)}`);
console.log(`  etendue   : ${dim(src.bb).join(" x ")}`);
console.log("");

const chunks = fs.readdirSync(dossier).filter((f) => f.toLowerCase().endsWith(".glb")).sort();
console.log(`chunks : ${chunks.length}`);

let total = 0;
const union = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };

for (const c of chunks) {
  const m = await mesurer(path.join(dossier, c));
  total += m.tris;
  for (let i = 0; i < 3; i++) {
    if (m.bb.min[i] < union.min[i]) union.min[i] = m.bb.min[i];
    if (m.bb.max[i] > union.max[i]) union.max[i] = m.bb.max[i];
  }
  console.log(`  ${c.padEnd(16)} ${fmt(m.tris).padStart(11)} tris   ${dim(m.bb).join(" x ")}`);
}

console.log("");
console.log(`  cumul     : ${fmt(total)} triangles`);
console.log(`  ratio     : ${(total / src.tris).toFixed(2)}x la source`);
console.log(`  etendue   : ${dim(union).join(" x ")}`);

// ── Verdict ───────────────────────────────────────────────────────────────────
//
// Tolérance de 2 % sur chaque axe : `prune()` retire les nœuds vides, dont
// certains bornaient la boîte de la source sans porter un seul triangle.
const TOL = 0.02;
const trous = [];
for (let i = 0; i < 3; i++) {
  const etendueSrc = src.bb.max[i] - src.bb.min[i];
  if (!Number.isFinite(etendueSrc) || etendueSrc === 0) continue;
  const marge = etendueSrc * TOL;
  if (union.min[i] > src.bb.min[i] + marge) trous.push(`min axe ${"XYZ"[i]}`);
  if (union.max[i] < src.bb.max[i] - marge) trous.push(`max axe ${"XYZ"[i]}`);
}

console.log("");
if (trous.length > 0) {
  console.log(`TROU SPATIAL — la couverture s'arrete avant la source : ${trous.join(", ")}`);
  console.log("Un pan de la map manque. Revoir le decoupage avant d'importer.");
  process.exitCode = 1;
} else if (total < src.tris * 0.9) {
  console.log("Couverture spatiale COMPLETE, mais moins de triangles que la source.");
  console.log("Simplification, pas trou : acceptable pour du decor, a juger a l'oeil.");
} else {
  console.log("Couverture spatiale COMPLETE, triangles conserves ou multiplies.");
  console.log("Un ratio > 1 est NORMAL : join() materialise les instances.");
}