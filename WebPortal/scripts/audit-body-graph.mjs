// Dump du graphe de nœuds de base_skinned.glb — diagnostic squelette.
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco3d from "draco3dgltf";

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "draco3d.decoder": await draco3d.createDecoderModule() });

const doc = await io.read("public/models/personnages/_body/base_skinned.glb");
const root = doc.getRoot();

const scenes = root.listScenes();
console.log(`scenes: ${scenes.length}`);
for (const s of scenes) {
  console.log(`  scene "${s.getName()}" enfants racine: ${s.listChildren().length}`);
  for (const c of s.listChildren()) console.log(`    - ${c.getName() || "(sans nom)"}`);
}

const nodes = root.listNodes();
console.log(`\nnodes total: ${nodes.length}`);
const avecMesh = nodes.filter((n) => n.getMesh());
console.log(`nodes avec mesh: ${avecMesh.length} → ${avecMesh.map((n) => n.getName()).join(", ")}`);
const avecSkin = nodes.filter((n) => n.getSkin());
console.log(`nodes avec skin: ${avecSkin.length} → ${avecSkin.map((n) => n.getName()).join(", ")}`);

console.log(`\nmeshes: ${root.listMeshes().length}`);
for (const m of root.listMeshes()) {
  console.log(`  mesh "${m.getName()}" primitives=${m.listPrimitives().length}`);
}

// Un joint qui n'est atteignable depuis AUCUNE racine de scène devient
// `undefined` dans le clone three.js → « Cannot read properties of undefined
// (reading 'matrixWorld') ».
const atteignables = new Set();
const descendre = (n) => { atteignables.add(n); n.listChildren().forEach(descendre); };
for (const s of scenes) s.listChildren().forEach(descendre);
console.log(`\nnodes atteignables depuis une scène: ${atteignables.size} / ${nodes.length}`);

for (const skin of root.listSkins()) {
  const joints = skin.listJoints();
  const orphelins = joints.filter((j) => !atteignables.has(j));
  const noms = joints.map((j) => j.getName());
  const doublons = noms.filter((n, i) => noms.indexOf(n) !== i);
  console.log(`skin "${skin.getName()}" joints=${joints.length}` +
    ` · hors-scène=${orphelins.length}` +
    ` · noms dupliqués=${[...new Set(doublons)].length}` +
    ` · skeleton=${skin.getSkeleton()?.getName() ?? "(aucun)"}`);
  if (orphelins.length) console.log(`  ⚠ ORPHELINS: ${orphelins.map((j) => j.getName()).join(", ")}`);
  if (doublons.length) console.log(`  ⚠ DOUBLONS: ${[...new Set(doublons)].join(", ")}`);
}

const orphelinsMesh = avecMesh.filter((n) => !atteignables.has(n));
if (orphelinsMesh.length) {
  console.log(`\n⚠ ${orphelinsMesh.length} node(s) porteur(s) de mesh HORS SCÈNE : ` +
    orphelinsMesh.map((n) => n.getName()).join(", "));
}
