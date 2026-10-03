#!/usr/bin/env node
/**
 * Audite les GLB destines a l'import Unreal : squelette, convention de nommage,
 * animations. Repond a la seule question qui compte pour nanos — chaque modele
 * arrivera-t-il sur le Mannequin que le jeu exige ?
 *
 * Ne lit QUE le chunk JSON de chaque GLB (en-tete de 12 octets + longueur du
 * premier chunk). Aucune geometrie n'est decodee : des centaines de fichiers en
 * quelques secondes, quel que soit leur poids.
 *
 * Usage :
 *   node scripts/unreal-audit-glb.mjs <racine> [--detail]
 */

import fs from "node:fs";
import path from "node:path";

const root = process.argv[2];
const DETAIL = process.argv.includes("--detail");

// `--json <fichier>` écrit le classement pour que l'import le rejoue sans
// redupliquer la détection côté Python : une seule source de vérité.
const jsonIdx = process.argv.indexOf("--json");
const JSON_OUT = jsonIdx !== -1 ? process.argv[jsonIdx + 1] : null;

if (!root || !fs.existsSync(root)) {
  console.error("Usage : node scripts/unreal-audit-glb.mjs <racine> [--detail]");
  process.exit(1);
}

/** Chunk JSON d'un GLB, sans toucher au binaire. */
const glbHeader = (file) => {
  const fd = fs.openSync(file, "r");
  try {
    const head = Buffer.alloc(20);
    fs.readSync(fd, head, 0, 20, 0);
    if (head.readUInt32LE(0) !== 0x46546c67) return null; // « glTF »
    const jsonLength = head.readUInt32LE(12);
    const json = Buffer.alloc(jsonLength);
    fs.readSync(fd, json, 0, jsonLength, 20);
    return JSON.parse(json.toString("utf8"));
  } catch {
    return null;
  } finally {
    fs.closeSync(fd);
  }
};

/**
 * Conventions reconnues, testees dans l'ordre : la premiere qui matche gagne.
 * Manny UE5 avant Mannequin UE4 car le premier est un SURENSEMBLE du second —
 * tester l'UE4 d'abord classerait tous les Manny comme UE4.
 */
const CONVENTIONS = [
  { nom: "Manny UE5", requis: ["pelvis", "spine_01", "spine_05"] },
  { nom: "Mannequin UE4", requis: ["pelvis", "spine_01", "spine_03", "clavicle_l"] },
  { nom: "Mixamo", requis: ["mixamorig:Hips"] },
  { nom: "VRoid / VRM", requis: ["J_Bip_C_Hips"] },
  { nom: "Rigify", requis: ["DEF-spine"] },
  { nom: "Daz Genesis", requis: ["hip", "abdomenLower"] },
];

const detecter = (os) => {
  const set = new Set(os);
  for (const c of CONVENTIONS) {
    if (c.requis.every((b) => set.has(b))) return c.nom;
  }
  // Un humanoide non reconnu reste convertible : UniGLB sait remapper, mais il
  // faut le savoir a l'avance.
  if (set.has("Hips") || set.has("hips") || set.has("pelvis")) return "humanoide (autre)";
  return os.length > 0 ? "non humanoide" : "aucun squelette";
};

const walk = (dir, acc = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, acc);
    else if (e.name.toLowerCase().endsWith(".glb")) acc.push(f);
  }
  return acc;
};

const fichiers = walk(root).sort();
if (fichiers.length === 0) {
  console.error(`Aucun .glb sous ${root}`);
  process.exit(1);
}

const parConvention = new Map();
const parPack = new Map();
const details = [];

for (const file of fichiers) {
  const gltf = glbHeader(file);
  const pack = path.relative(root, file).split(path.sep)[0];

  if (!gltf) {
    parConvention.set("ILLISIBLE", (parConvention.get("ILLISIBLE") || 0) + 1);
    details.push({ pack, file, convention: "ILLISIBLE", os: 0, anims: 0 });
    continue;
  }

  // Les os d'un skin sont des noeuds : on releve leurs noms.
  const noms = [];
  for (const skin of gltf.skins || []) {
    for (const idx of skin.joints || []) {
      const n = gltf.nodes?.[idx]?.name;
      if (n) noms.push(n);
    }
  }

  // Un GLB d'animation PURE ne porte aucun skin : le mesh a ete retire, les
  // pistes ciblent directement les noeuds. Sans ce repli, ces fichiers — les
  // plus nombreux dans une bibliotheque d'animations — passeraient tous pour
  // « aucun squelette ».
  if (noms.length === 0 && (gltf.animations || []).length > 0) {
    for (const anim of gltf.animations) {
      for (const ch of anim.channels || []) {
        const n = gltf.nodes?.[ch.target?.node]?.name;
        if (n) noms.push(n);
      }
    }
  }

  const convention = detecter(noms);
  const anims = (gltf.animations || []).length;

  parConvention.set(convention, (parConvention.get(convention) || 0) + 1);
  if (!parPack.has(pack)) parPack.set(pack, { total: 0, conventions: new Map(), anims: 0 });
  const p = parPack.get(pack);
  p.total++;
  p.anims += anims;
  p.conventions.set(convention, (p.conventions.get(convention) || 0) + 1);

  details.push({ pack, file, convention, os: noms.length, anims });
}

// ------------------------------------------------------------------- sortie

console.log(`${fichiers.length} GLB analyses sous ${root}`);
console.log("");
console.log("=== par convention de squelette ===");
for (const [conv, n] of [...parConvention].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}  ${conv}`);
}

console.log("");
console.log("=== par pack ===");
console.log(`  ${"PACK".padEnd(30)} ${"GLB".padStart(4)} ${"ANIM".padStart(5)}  CONVENTIONS`);
for (const [pack, p] of [...parPack].sort((a, b) => b[1].total - a[1].total)) {
  const conv = [...p.conventions]
    .sort((a, b) => b[1] - a[1])
    .map(([c, n]) => `${n} ${c}`)
    .join(", ");
  console.log(`  ${pack.padEnd(30)} ${String(p.total).padStart(4)} ${String(p.anims).padStart(5)}  ${conv}`);
}

if (JSON_OUT) {
  // `passe` est la seule chose que l'import a besoin de savoir :
  //   A = déjà sur le Mannequin UE4, on importe tel quel ;
  //   B = autre squelette, UniGLB doit le normaliser.
  // Un fichier sans squelette part en A : il n'y a rien à convertir sur un prop.
  const entrees = details.map((d) => ({
    fichier: path.relative(root, d.file).split(path.sep).join("/"),
    convention: d.convention,
    os: d.os,
    animations: d.anims,
    passe: d.convention === "Mannequin UE4" || d.convention === "aucun squelette" ? "A" : "B",
  }));

  fs.mkdirSync(path.dirname(JSON_OUT), { recursive: true });
  fs.writeFileSync(
    JSON_OUT,
    JSON.stringify({ racine: root, total: entrees.length, entrees }, null, 2) + "\n",
    "utf8",
  );

  const a = entrees.filter((e) => e.passe === "A").length;
  console.log("");
  console.log(`Manifeste écrit : ${JSON_OUT}`);
  console.log(`  passe A (import direct)      ${a}`);
  console.log(`  passe B (conversion UniGLB)  ${entrees.length - a}`);
}

if (DETAIL) {
  console.log("");
  console.log("=== detail des humanoides ===");
  for (const d of details.filter((x) => !["non humanoide", "aucun squelette"].includes(x.convention))) {
    console.log(
      `  ${d.convention.padEnd(20)} ${String(d.os).padStart(4)} os  ${String(d.anims).padStart(3)} anim  ${path.relative(root, d.file)}`,
    );
  }
}