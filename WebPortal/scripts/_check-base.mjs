import { NodeIO } from "@gltf-transform/core";
import sharp from "sharp";
import { rasterize } from "./lib/soft-raster.mjs";

const doc = await new NodeIO().read("public/models/personnages/base/SK_BaseBody_Mixamo.glb");
const mesh = doc.getRoot().listMeshes()[0];
const prims = mesh.listPrimitives();

const pos = prims[0].getAttribute("POSITION").getArray();
const idx = [];
for (const p of prims) idx.push(...p.getIndices().getArray());

const W = 240, H = 320;
const rgba = rasterize(pos, idx, { width: W, height: H });
await sharp(Buffer.from(rgba.buffer), { raw: { width: W, height: H, channels: 4 } })
  .png()
  .toFile("public/thumbs/_base_body_check.png");

console.log(`${prims.length} primitives · ${idx.length / 3} triangles rendus`);