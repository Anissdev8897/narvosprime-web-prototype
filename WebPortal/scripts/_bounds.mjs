import { readFileSync } from "node:fs";
import { parseObjPositions } from "./lib/mh-target.mjs";

const ROOT = "C:/Users/aniss/mes_projet/mpfb2-master/mpfb2-master/src/mpfb/data";
const p = parseObjPositions(readFileSync(`${ROOT}/3dobjs/base.obj`, "utf8"));

const mn = [1e9, 1e9, 1e9];
const mx = [-1e9, -1e9, -1e9];
for (let i = 0; i < p.length; i += 3) {
  for (let k = 0; k < 3; k++) {
    const v = p[i + k];
    if (v < mn[k]) mn[k] = v;
    if (v > mx[k]) mx[k] = v;
  }
}

console.log("base.obj — bornes :");
["X", "Y", "Z"].forEach((a, k) =>
  console.log(`  ${a}  ${mn[k].toFixed(3)} .. ${mx[k].toFixed(3)}   etendue ${(mx[k] - mn[k]).toFixed(3)}`),
);

const rig = JSON.parse(readFileSync(`${ROOT}/rigs/standard/rig.mixamo.json`, "utf8"));
console.log("\nrig.mixamo.json — default_position :");
for (const n of ["mixamorig:Hips", "mixamorig:Head", "mixamorig:LeftFoot"]) {
  console.log(`  ${n.padEnd(22)} [${rig.bones[n].head.default_position.map((v) => v.toFixed(3)).join(", ")}]`);
}