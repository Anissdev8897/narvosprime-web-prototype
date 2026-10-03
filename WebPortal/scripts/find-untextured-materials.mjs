// ══════════════════════════════════════════════════════════════════════════════
// find-untextured-materials.mjs — Quels matériaux rendront BLANC ?
//
// Un matériau glTF sans `baseColorTexture` s'affiche avec sa seule
// `baseColorFactor`, blanche par défaut. C'est le symptôme classique d'un export
// depuis Unreal : les matériaux PROCÉDURAUX (auto-material de landscape, qui
// mélange roche/herbe/neige selon la pente et l'altitude) n'ont pas d'équivalent
// glTF — le format ne stocke qu'un seul matériau PBR par primitive. À l'export,
// la couche procédurale disparaît et il ne reste qu'une couleur unie.
//
// Ce script liste les matériaux concernés ET le nombre de sommets qu'ils
// couvrent, pour distinguer un détail invisible d'une montagne entière.
//
// Usage : node scripts/find-untextured-materials.mjs <fichier.glb>...
// ══════════════════════════════════════════════════════════════════════════════

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco3d from "draco3dgltf";
import path from "node:path";

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "draco3d.decoder": await draco3d.createDecoderModule(),
  "draco3d.encoder": await draco3d.createEncoderModule(),
});

for (const file of process.argv.slice(2)) {
  const doc = await io.read(file);
  const root = doc.getRoot();

  // Sommets couverts par chaque matériau — un matériau blanc sur 3 sommets est
  // anecdotique, sur 200 000 c'est une montagne.
  const vertsByMat = new Map();
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const mat = prim.getMaterial();
      const n = prim.getAttribute("POSITION")?.getCount() ?? 0;
      const key = mat ?? "(aucun matériau)";
      vertsByMat.set(key, (vertsByMat.get(key) ?? 0) + n);
    }
  }

  const white = [];
  let totalVerts = 0;
  let whiteVerts = 0;

  for (const [mat, verts] of vertsByMat) {
    totalVerts += verts;
    if (mat === "(aucun matériau)") { white.push({ name: "(aucun matériau)", verts, why: "primitive sans matériau" }); whiteVerts += verts; continue; }
    const hasColor = mat.getBaseColorTexture() !== null;
    if (hasColor) continue;
    const f = mat.getBaseColorFactor();
    const isWhitish = f[0] > 0.85 && f[1] > 0.85 && f[2] > 0.85;
    white.push({
      name: mat.getName() || "(sans nom)",
      verts,
      why: `pas de baseColorTexture · factor=[${f.map((v) => v.toFixed(2)).join(", ")}]${isWhitish ? " ← BLANC" : ""}`,
    });
    whiteVerts += verts;
  }

  const pct = totalVerts ? ((whiteVerts / totalVerts) * 100).toFixed(1) : "0";
  console.log(`\n── ${path.basename(file)}`);
  console.log(`   ${root.listMaterials().length} matériaux · ${totalVerts.toLocaleString("fr")} sommets`);
  if (white.length === 0) {
    console.log("   ✓ tous les matériaux ont une texture de couleur");
  } else {
    console.log(`   ✗ ${white.length} matériau(x) sans texture — ${pct} % des sommets`);
    for (const w of white.sort((a, b) => b.verts - a.verts).slice(0, 15)) {
      console.log(`      ${w.verts.toLocaleString("fr").padStart(9)} sommets  ${w.name}`);
      console.log(`      ${" ".repeat(9)}           ${w.why}`);
    }
  }
}
