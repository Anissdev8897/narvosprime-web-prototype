// Sonde jetable : amplitude max des deltas morph (décide si int16 normalisé passe).
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

for (const f of ["echo/torso", "echo/head", "echo/arms", "steel/head", "wraith/torso"]) {
  const d = await io.read(`public/models/personnages/_parts/${f}.glb`);
  const max = new Map();
  const types = new Set();

  for (const m of d.getRoot().listMeshes())
    for (const p of m.listPrimitives())
      for (const t of p.listTargets())
        for (const s of t.listSemantics()) {
          const a = t.getAttribute(s);
          types.add(`${s}:${a.getArray().constructor.name}${a.getNormalized() ? "(norm)" : ""}`);
          const arr = a.getArray();
          let mx = max.get(s) ?? 0;
          for (let k = 0; k < arr.length; k++) {
            const v = Math.abs(arr[k]);
            if (v > mx) mx = v;
          }
          max.set(s, mx);
        }

  if (max.size === 0) { console.log(`${f.padEnd(12)} aucune cible`); continue; }
  const parts = [...max].map(([s, v]) => `${s} max ${v.toFixed(4)}`).join("  ");
  console.log(`${f.padEnd(12)} ${parts}   [${[...types].join(", ")}]`);
}