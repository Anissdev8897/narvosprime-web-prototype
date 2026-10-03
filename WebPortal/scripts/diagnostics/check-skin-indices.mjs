// ══════════════════════════════════════════════════════════════════════════════
// check-skin-indices.mjs — `skinIndex` sort-il du tableau d'os ?
//
// `weightedCoverage` ne compte un poids que si `src < remap.length`, et
// `remap` a la taille du nombre d'OS de la pièce. Un `JOINTS_0` référençant un
// indice au-delà fait donc tomber le poids dans le vide : la pièce est refusée
// alors que tous ses noms d'os sont appariés.
//
// Cas observé en jeu : `samurai_hair` — 100 % de noms appariés, 17 % de poids.
//
// Usage : node scripts/check-skin-indices.mjs
// ══════════════════════════════════════════════════════════════════════════════

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { readFileSync } from "node:fs";

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const manifest = JSON.parse(readFileSync("src/data/parts-manifest.json", "utf8"));

console.log("pièce                  os   idx max   poids hors bornes");
console.log("─".repeat(62));

for (const hero of manifest) {
  for (const part of hero.parts) {
    const doc = await io.read("public" + part.path);
    const skin = doc.getRoot().listSkins()[0];
    if (!skin) continue;
    const nbOs = skin.listJoints().length;

    let maxIdx = -1, total = 0, horsBornes = 0;
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const ji = prim.getAttribute("JOINTS_0");
        const wt = prim.getAttribute("WEIGHTS_0");
        if (!ji || !wt) continue;
        const J = ji.getArray(), W = wt.getArray();
        for (let i = 0; i < J.length; i++) {
          const w = W[i];
          if (w <= 0) continue;
          total += w;
          if (J[i] > maxIdx) maxIdx = J[i];
          if (J[i] >= nbOs) horsBornes += w;
        }
      }
    }
    const pct = total > 0 ? (100 * horsBornes) / total : 0;
    const alerte = pct > 1 ? "  ⚠" : "";
    console.log(
      `${(hero.id + "/" + part.region).padEnd(22)} ${String(nbOs).padStart(3)} ` +
      `${String(maxIdx).padStart(8)} ${pct.toFixed(1).padStart(15)} %${alerte}`,
    );
  }
}
