// Inspection d'un GLB : textures (taille/format), skinning, morph targets, Draco.
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco3d from "draco3dgltf";
import sharp from "sharp";
import path from "node:path";

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "draco3d.decoder": await draco3d.createDecoderModule(),
  "draco3d.encoder": await draco3d.createEncoderModule(),
});

for (const file of process.argv.slice(2)) {
  const doc = await io.read(file);
  const root = doc.getRoot();

  let texBytes = 0;
  const dims = new Map();
  for (const tex of root.listTextures()) {
    const img = tex.getImage();
    if (!img) continue;
    texBytes += img.byteLength;
    try {
      const m = await sharp(Buffer.from(img)).metadata();
      const k = `${m.width}x${m.height} ${tex.getMimeType()}`;
      dims.set(k, (dims.get(k) ?? 0) + 1);
    } catch { dims.set(`? ${tex.getMimeType()}`, (dims.get(`? ${tex.getMimeType()}`) ?? 0) + 1); }
  }

  let morphPrims = 0, skinnedPrims = 0, prims = 0, verts = 0;
  for (const mesh of root.listMeshes()) {
    for (const p of mesh.listPrimitives()) {
      prims++;
      verts += p.getAttribute("POSITION")?.getCount() ?? 0;
      if (p.listTargets().length > 0) morphPrims++;
      if (p.getAttribute("JOINTS_0")) skinnedPrims++;
    }
  }

  // VRAM estimée : RGBA8 + mipmaps (×1.333)
  let vram = 0;
  for (const tex of root.listTextures()) {
    const img = tex.getImage();
    if (!img) continue;
    try {
      const m = await sharp(Buffer.from(img)).metadata();
      vram += m.width * m.height * 4 * 1.333;
    } catch { /* ktx2 non lisible par sharp */ }
  }

  console.log(`\n── ${path.basename(file)}`);
  console.log(`   extensions : ${root.listExtensionsUsed().map((e) => e.extensionName).join(", ") || "(aucune)"}`);
  console.log(`   textures   : ${root.listTextures().length} · ${(texBytes / 1048576).toFixed(1)} MB disque · ~${(vram / 1048576).toFixed(0)} MB VRAM (RGBA8+mips)`);
  for (const [k, v] of [...dims].sort()) console.log(`                ${v}× ${k}`);
  console.log(`   géométrie  : ${prims} primitives · ${verts.toLocaleString("fr")} sommets · ${skinnedPrims} skinnées · ${morphPrims} avec morph targets`);
  // Les nœuds VIDES sont les points d'attache d'armes/accessoires, retrouvés par
  // nom au runtime. Les compter permet de prouver qu'une conversion ne les a pas
  // supprimés (c'est ce que ferait prune()).
  const nodes = root.listNodes();
  const empties = nodes.filter((n) => !n.getMesh() && n.listChildren().length === 0).length;
  const bones = root.listSkins().reduce((s, sk) => s + sk.listJoints().length, 0);
  console.log(`   nœuds      : ${nodes.length} (${empties} feuilles vides) · ${bones} os · ${root.listSkins().length} skins · ${root.listAnimations().length} animations`);
}
