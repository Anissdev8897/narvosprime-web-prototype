// Strip mesh+textures from Wraith ability GLBs, keep skeleton+animation only.
import { NodeIO } from "@gltf-transform/core";
import { prune } from "@gltf-transform/functions";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = path.resolve(__dirname, "../public/models/assets_character/wraith/animations");
const OUT = path.join(BASE, "stripped");

const FILES = [
  "Ability_E.glb",
  "Ability_E_Recovery.glb",
  "Ability_E_Targeting_Loop.glb",
  "Ability_E_Targeting_Start.glb",
  "Ability_Q_Fire.glb",
];

fs.mkdirSync(OUT, { recursive: true });

const io = new NodeIO();

for (const file of FILES) {
  const src = path.join(BASE, file);
  console.log(`\n=== Processing ${file} ===`);

  const doc = await io.read(src);
  const root = doc.getRoot();

  for (const anim of root.listAnimations()) {
    console.log(`  Animation: "${anim.getName()}" (${anim.listChannels().length} channels)`);
  }

  for (const node of root.listNodes()) {
    if (node.getMesh()) node.setMesh(null);
    if (node.getSkin()) node.setSkin(null);
  }

  for (const mat of root.listMaterials()) mat.dispose();
  for (const tex of root.listTextures()) tex.dispose();
  for (const mesh of root.listMeshes()) mesh.dispose();
  for (const skin of root.listSkins()) skin.dispose();

  await doc.transform(prune());

  const dst = path.join(OUT, file);
  await io.write(dst, doc);
  const stat = fs.statSync(dst);
  console.log(`  -> ${(stat.size / 1024).toFixed(1)} KB`);
}

console.log("\nDone!");
