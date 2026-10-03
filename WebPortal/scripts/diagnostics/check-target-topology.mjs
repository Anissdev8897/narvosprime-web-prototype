// ══════════════════════════════════════════════════════════════════════════════
// check-target-topology.mjs — Les cibles MPFB2 sont-elles applicables à nos têtes ?
//
// Une cible MakeHuman est une liste creuse « index dx dy dz » : elle désigne des
// SOMMETS PAR LEUR NUMÉRO dans `base.obj`. Appliquée à un maillage d'une autre
// topologie, l'indice 4271 ne désigne plus le même point du visage — il désigne
// un sommet arbitraire. Le résultat n'est pas « approximatif », il est aléatoire.
//
// Ce script compare les nombres de sommets et l'indice maximum référencé par les
// cibles de visage. C'est la mesure qui décide si l'import est direct ou non.
// ══════════════════════════════════════════════════════════════════════════════

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import path from "node:path";

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const MPFB = "C:/Users/aniss/OneDrive/Bureau/Nouveau dossier/mpfb2-master/src/mpfb/data";

async function sommetsGlb(p) {
  if (!existsSync(p)) return null;
  const doc = await io.read(p);
  let n = 0;
  for (const m of doc.getRoot().listMeshes())
    for (const prim of m.listPrimitives())
      n += prim.getAttribute("POSITION")?.getCount() ?? 0;
  return n;
}

// ── base.obj de MakeHuman ────────────────────────────────────────────────────
const obj = readFileSync(path.join(MPFB, "3dobjs", "base.obj"), "utf8");
let baseVerts = 0;
for (const l of obj.split("\n")) if (l.startsWith("v ")) baseVerts++;

// ── indice maximum référencé par les cibles de visage ────────────────────────
let maxIdx = 0, nbCibles = 0;
for (const dossier of ["nose", "cheek", "head", "chin"]) {
  const d = path.join(MPFB, "targets", dossier);
  if (!existsSync(d)) continue;
  for (const f of readdirSync(d)) {
    if (!f.endsWith(".target.gz") && !f.endsWith(".target")) continue;
    const raw = path.join(d, f);
    const txt = f.endsWith(".gz")
      ? gunzipSync(readFileSync(raw)).toString("utf8")
      : readFileSync(raw, "utf8");
    nbCibles++;
    for (const line of txt.split("\n")) {
      const i = parseInt(line, 10);
      if (Number.isFinite(i) && i > maxIdx) maxIdx = i;
    }
  }
}

const B = "public/models/personnages/_parts";
console.log(`base.obj MakeHuman        ${String(baseVerts).padStart(7)} sommets`);
console.log(`indice max des cibles     ${String(maxIdx).padStart(7)}  (${nbCibles} cibles de visage lues)`);
console.log("");
for (const [nom, p] of [
  ["biker_m/head", `${B}/biker_m/head.glb`],
  ["biker_f/head", `${B}/biker_f/head.glb`],
]) {
  const n = await sommetsGlb(p);
  console.log(`${nom.padEnd(25)} ${String(n ?? "ABSENT").padStart(7)} sommets`);
}

console.log("");
console.log(
  maxIdx < 1 || baseVerts < 1
    ? "⚠ lecture incomplète"
    : "→ Les cibles indexent des sommets de base.obj. Toute tête d'une AUTRE\n" +
      "  topologie doit passer par un transfert (projection), pas par une\n" +
      "  application directe.",
);
