// Sonde jetable : nos pièces se lient-elles au squelette Quaternius ?
//
// Le sens qui compte : le corps Quaternius devient le CORPS D'ACCUEIL, et les
// 39 pièces découpées viennent s'y greffer. On mesure donc la fraction du poids
// de skinning de chaque pièce qui retrouve un os chez Quaternius.
import { readFileSync } from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";

const Q = "public/models/export/Base Characters/Godot - UE/Superhero_Male_FullBody.gltf";
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

// Lecture JSON : le .gltf référence une texture absente du pack, NodeIO échoue.
const g = JSON.parse(readFileSync(Q, "utf8"));
const qBones = new Set((g.skins?.[0]?.joints ?? []).map((i) => g.nodes[i]?.name ?? ""));

/** Poids de skinning par os d'une pièce. */
async function weights(file) {
  const doc = await io.read(file);
  const names = (doc.getRoot().listSkins()[0]?.listJoints() ?? []).map((j) => j.getName());
  const w = new Float64Array(names.length);
  let total = 0;
  for (const m of doc.getRoot().listMeshes())
    for (const p of m.listPrimitives()) {
      const J = p.getAttribute("JOINTS_0"), W = p.getAttribute("WEIGHTS_0");
      if (!J || !W) continue;
      const je = [0, 0, 0, 0], we = [0, 0, 0, 0];
      for (let v = 0; v < J.getCount(); v++) {
        J.getElement(v, je); W.getElement(v, we);
        for (let k = 0; k < 4; k++) {
          if (we[k] <= 0 || je[k] >= names.length) continue;
          w[je[k]] += we[k]; total += we[k];
        }
      }
    }
  return { names, w, total };
}

console.log(`Corps d'accueil Quaternius : ${qBones.size} os\n`);
console.log("pièce                  POIDS apparié   verdict");
console.log("─".repeat(52));

const manifest = JSON.parse(readFileSync("src/data/parts-manifest.json", "utf8"));
let ok = 0, ajuste = 0, refuse = 0;

for (const hero of manifest) {
  for (const part of hero.parts) {
    const { names, w, total } = await weights("public" + part.path);
    let appar = 0;
    for (let i = 0; i < names.length; i++) if (qBones.has(names[i])) appar += w[i];
    const pct = total > 0 ? appar / total : 0;

    const verdict = pct < 0.5 ? "✗ REFUSÉ" : pct < 0.9 ? "⚠ ajusté" : "✓";
    if (pct < 0.5) refuse++; else if (pct < 0.9) ajuste++; else ok++;
    console.log(`${(hero.id + "/" + part.region).padEnd(20)} ${(pct * 100).toFixed(1).padStart(9)}%   ${verdict}`);
  }
}

console.log(`\n${ok} directes · ${ajuste} ajustées · ${refuse} refusées sur ${ok + ajuste + refuse}`);