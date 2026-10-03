import { readFileSync } from "node:fs";
const M = "C:/Users/aniss/mes_projet/mpfb2-master/mpfb2-master/src/mpfb/data/mesh_metadata";
const cfg = JSON.parse(readFileSync(`${M}/hm08_config.json`, "utf8"));

console.log("groups_by_range :");
for (const [k, v] of Object.entries(cfg.groups_by_range)) {
  console.log(`  ${k.padEnd(22)} ${JSON.stringify(v)}`);
}
console.log("\nselect_groups :");
for (const [k, v] of Object.entries(cfg.select_groups)) {
  console.log(`  ${k.padEnd(14)} ${JSON.stringify(v).slice(0, 120)}`);
}