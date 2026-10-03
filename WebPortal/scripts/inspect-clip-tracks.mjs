// Quelles pistes un clip contient-il, et lesquelles déplacent la racine ?
//
// Le root motion est la question décisive pour l'escalade : si le clip déplace
// lui-même le personnage, il entre en concurrence avec le contrôleur qui gère
// déjà la position. Ce script le mesure au lieu de le supposer.
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco3d from "draco3dgltf";
import path from "node:path";

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "draco3d.decoder": await draco3d.createDecoderModule(),
  "draco3d.encoder": await draco3d.createEncoderModule(),
});

/** Os considérés comme racine du mouvement selon la convention UE/Mixamo. */
const ROOTISH = /^(root|pelvis|hips|armature)$/i;

for (const file of process.argv.slice(2)) {
  const doc = await io.read(file);
  for (const anim of doc.getRoot().listAnimations()) {
    let pos = 0, rot = 0, scale = 0;
    const rootPosTargets = new Set();
    let rootTranslationRange = 0;

    for (const ch of anim.listChannels()) {
      const p = ch.getTargetPath();
      const node = ch.getTargetNode();
      const name = node?.getName() ?? "?";
      if (p === "translation") {
        pos++;
        if (ROOTISH.test(name)) {
          rootPosTargets.add(name);
          // Amplitude du déplacement : c'est ça, le root motion.
          const out = ch.getSampler()?.getOutput()?.getArray();
          if (out) {
            let minY = Infinity, maxY = -Infinity, minXZ = Infinity, maxXZ = -Infinity;
            for (let i = 0; i < out.length; i += 3) {
              const y = out[i + 1];
              const xz = Math.hypot(out[i], out[i + 2]);
              if (y < minY) minY = y; if (y > maxY) maxY = y;
              if (xz < minXZ) minXZ = xz; if (xz > maxXZ) maxXZ = xz;
            }
            rootTranslationRange = Math.max(rootTranslationRange, maxY - minY, maxXZ - minXZ);
          }
        }
      } else if (p === "rotation") rot++;
      else if (p === "scale") scale++;
    }

    const rm = rootTranslationRange > 0.05;
    console.log(
      `${path.basename(file)} · "${anim.getName()}" ${anim.listChannels().length} pistes ` +
      `(pos=${pos} rot=${rot} scale=${scale}) · durée ~${(anim.listSamplers()[0]?.getInput()?.getArray()?.slice(-1)[0] ?? 0).toFixed(2)}s`,
    );
    console.log(
      `   root motion : ${rm ? `OUI — amplitude ${rootTranslationRange.toFixed(2)} m sur [${[...rootPosTargets].join(", ")}]` : "non (< 5 cm)"}`,
    );
  }
}
