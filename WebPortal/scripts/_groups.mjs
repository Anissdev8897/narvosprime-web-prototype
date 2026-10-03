import { readFileSync } from "node:fs";
const M = "C:/Users/aniss/mes_projet/mpfb2-master/mpfb2-master/src/mpfb/data/mesh_metadata";

const cfg = JSON.parse(readFileSync(`${M}/hm08_config.json`, "utf8"));
console.log("hm08_config.json — clés :", Object.keys(cfg).join(", "));
for (const [k, v] of Object.entries(cfg)) {
  const apercu = Array.isArray(v) ? `[${v.length} entrées] ${JSON.stringify(v.slice(0, 4))}`
    : typeof v === "object" && v ? `{${Object.keys(v).slice(0, 8).join(", ")}}`
    : JSON.stringify(v);
  console.log(`  ${k.padEnd(24)} ${String(apercu).slice(0, 150)}`);
}

const groups = JSON.parse(readFileSync(`${M}/basemesh_vertex_groups.json`, "utf8"));
const noms = Object.keys(groups);
console.log(`\nbasemesh_vertex_groups.json — ${noms.length} groupes`);
console.log("  " + noms.join("  "));