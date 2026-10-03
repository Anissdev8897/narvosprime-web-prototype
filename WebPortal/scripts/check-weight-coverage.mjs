// ══════════════════════════════════════════════════════════════════════════════
// check-weight-coverage.mjs — Réplique HORS LIGNE le calcul du runtime.
//
// Contradiction à trancher : en jeu, `samurai_hair` sort à 100 % de noms
// appariés et 17 % de poids. Ces deux chiffres viennent du MÊME `remap` — ils
// ne peuvent pas diverger si le calcul est juste.
//
// Ici on recalcule à partir du fichier, primitive par primitive :
//   • combien de primitives porte la pièce
//   • combien de joints déclare son skin
//   • quelle fraction du poids tombe sur un joint dont le NOM existe chez l'hôte
//
// Un écart avec le runtime désigne le chemin Three.js ; un accord désigne ma
// lecture des données.
//
// Usage : node scripts/check-weight-coverage.mjs [pièce]
// ══════════════════════════════════════════════════════════════════════════════

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { readFileSync } from "node:fs";

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const FILTRE = process.argv[2];

const HOTE = "public/models/personnages/BikerBundle/CharacterParts_Biker/Meshes/UE5_Mannequin_meta/Male/Bodyparts/SK_ma_UE5_meta_body.glb";
const hoteDoc = await io.read(HOTE);
const nomsHote = new Set(hoteDoc.getRoot().listSkins()[0].listJoints().map((j) => j.getName()));

const manifest = JSON.parse(readFileSync("src/data/parts-manifest.json", "utf8"));

console.log(`hôte : ${nomsHote.size} os`);
console.log("pièce                 prim  joints  noms ok   POIDS ok   sommets");
console.log("─".repeat(70));

for (const hero of manifest) {
  for (const part of hero.parts) {
    const nom = `${hero.id}/${part.region}`;
    if (FILTRE && !nom.includes(FILTRE)) continue;

    const doc = await io.read("public" + part.path);
    const skin = doc.getRoot().listSkins()[0];
    if (!skin) continue;
    const joints = skin.listJoints().map((j) => j.getName());
    const nomsOk = joints.filter((n) => nomsHote.has(n)).length;

    let nbPrim = 0, sommets = 0, total = 0, apparie = 0;
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const ji = prim.getAttribute("JOINTS_0");
        const wt = prim.getAttribute("WEIGHTS_0");
        if (!ji || !wt) continue;
        nbPrim++;
        sommets += prim.getAttribute("POSITION")?.getCount() ?? 0;
        const J = ji.getArray(), W = wt.getArray();
        for (let i = 0; i < J.length; i++) {
          const w = W[i];
          if (w <= 0) continue;
          total += w;
          // Le joint est apparié si SON NOM existe chez l'hôte — exactement le
          // critère du remap, réduit à sa première étape.
          if (nomsHote.has(joints[J[i]])) apparie += w;
        }
      }
    }
    const pctNom = joints.length ? (100 * nomsOk) / joints.length : 0;
    const pctPoids = total > 0 ? (100 * apparie) / total : 0;
    const alerte = Math.abs(pctNom - pctPoids) > 20 ? "  ⚠ ÉCART" : "";
    console.log(
      `${nom.padEnd(21)} ${String(nbPrim).padStart(4)} ${String(joints.length).padStart(7)} ` +
      `${pctNom.toFixed(0).padStart(7)} % ${pctPoids.toFixed(1).padStart(9)} % ` +
      `${String(sommets).padStart(9)}${alerte}`,
    );
  }
}